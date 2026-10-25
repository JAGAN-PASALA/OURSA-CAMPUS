"""Semester timetables and explicit class-mentor delegation."""
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
import database as db
from config import get_settings
from models import AcademicTerm, ClassSection, ClassMentor, ClassSession, Course, SectionMembership, StaffProfile, TeacherAssignment, TimetableSlot, TimetableChange, User
from schemas import TimetableSlotCreate, TimetableReview


def campus_today():
    return datetime.now(ZoneInfo(get_settings().campus_timezone)).date()


def manages_academics(session, actor):
    if actor.platform_admin:
        return False
    profile = session.scalar(select(StaffProfile).where(StaffProfile.user_id == actor.id, StaffProfile.active.is_(True)))
    return actor.role == "admin" or (actor.role == "teacher" and profile is not None and profile.designation == "hod")


def mentors(session, actor, assignment):
    return bool(session.scalar(select(ClassMentor.id).where(ClassMentor.teacher_id == actor.id, ClassMentor.section_id == assignment.section_id, ClassMentor.term_id == assignment.term_id)))


def timetable_access(session, actor, assignment_id):
    assignment = session.get(TeacherAssignment, assignment_id)
    if not assignment or actor.platform_admin:
        raise HTTPException(404, "Teaching allocation not found")
    records = [session.get(ClassSection, assignment.section_id), session.get(AcademicTerm, assignment.term_id), session.get(Course, assignment.course_id), session.get(User, assignment.teacher_id)]
    if any(r is None or r.institution_id != actor.institution_id for r in records):
        raise HTTPException(404, "Teaching allocation not found")
    if not assignment.active or any(not r.active for r in records):
        raise HTTPException(409, "Class, semester, subject and assigned teacher must be active")
    if not manages_academics(session, actor) and not (actor.role == "teacher" and (assignment.teacher_id == actor.id or mentors(session, actor, assignment))):
        raise HTTPException(403, "Only an assigned teacher or class mentor can propose this timetable")
    return assignment


def semester_dates(session, assignment, payload):
    term = session.get(AcademicTerm, assignment.term_id)
    start, end = payload.effective_from or term.start_date, payload.effective_to or term.end_date
    if not term.start_date <= start <= end <= term.end_date or (end-start).days > 370:
        raise HTTPException(400, "Dates must be within the assigned semester (maximum one year)")
    if end < campus_today() or payload.end_time <= payload.start_time or not payload.classroom.strip():
        raise HTTPException(400, "Check semester dates, classroom and period times")
    return payload.model_copy(update={"effective_from": start, "effective_to": end, "classroom": payload.classroom.strip()})


class MentorInput(BaseModel):
    section_id: int = Field(gt=0)
    term_id: int = Field(gt=0)
    teacher_id: int = Field(gt=0)


class RenameClass(BaseModel):
    name: str = Field(min_length=1, max_length=80)


def register_routes(app, current_user, allocation_manager, conflict_check, generate_sessions):
    def scoped_slot(session, actor, slot_id):
        row = session.scalar(select(TimetableSlot).where(TimetableSlot.id == slot_id).with_for_update())
        if not row:
            raise HTTPException(404, "Timetable period not found")
        return row, timetable_access(session, actor, row.assignment_id)

    @app.get("/api/timetable/context")
    def context(actor: User = Depends(current_user), session: Session = Depends(db.get_db)):
        if actor.platform_admin or actor.role not in {"admin", "teacher"}:
            raise HTTPException(403, "Staff timetable access required")
        data = db.academic_catalog(session, actor.institution_id)
        manager = manages_academics(session, actor)
        mentor_rows = session.scalars(select(ClassMentor).join(ClassSection).where(ClassSection.institution_id == actor.institution_id)).all()
        pairs = {(m.section_id, m.term_id) for m in mentor_rows if m.teacher_id == actor.id}
        assignments = [a for a in data["assignments"] if manager or a["teacher_id"] == actor.id or (a["section_id"], a["term_id"]) in pairs]
        ids = {a["id"] for a in assignments}
        active_slots = set(session.scalars(select(TimetableSlot.id).where(TimetableSlot.assignment_id.in_(ids), TimetableSlot.active.is_(True))))
        changes = session.scalars(select(TimetableChange).where(TimetableChange.institution_id == actor.institution_id, TimetableChange.status == "pending")).all()
        return {"can_manage": manager, "assignments": assignments,
                "sections": [s for s in data["sections"] if s["active"] and (manager or any(a["section_id"] == s["id"] for a in assignments))],
                "terms": [t for t in data["terms"] if t["active"]], "teachers": data["teachers"] if manager else [],
                "mentors": [{"section_id": m.section_id, "term_id": m.term_id, "teacher_id": m.teacher_id} for m in mentor_rows if manager or m.teacher_id == actor.id],
                "timetable": [s for s in data["timetable"] if s["id"] in active_slots],
                "changes": [{"id": c.id, "slot_id": c.slot_id, "payload": json.loads(c.payload_json)} for c in changes if manager or c.proposed_by == actor.id]}

    @app.post("/api/timetable/mentors")
    def assign_mentor(payload: MentorInput, actor: User = Depends(allocation_manager), session: Session = Depends(db.get_db)):
        records = [session.get(ClassSection, payload.section_id), session.get(AcademicTerm, payload.term_id), session.get(User, payload.teacher_id)]
        if any(r is None or r.institution_id != actor.institution_id or not r.active for r in records) or records[2].role != "teacher":
            raise HTTPException(404, "Active class, semester or teacher not found")
        row = session.scalar(select(ClassMentor).where(ClassMentor.section_id == payload.section_id, ClassMentor.term_id == payload.term_id))
        if row:
            row.teacher_id = payload.teacher_id
        else:
            row = ClassMentor(**payload.model_dump())
            session.add(row)
        session.flush()
        db.write_audit(session, actor.id, "class.mentor_assigned", "class_mentor", row.id, payload.model_dump())
        session.commit()
        return {"id": row.id}

    def apply_change(session, actor, row, payload):
        assignment = timetable_access(session, actor, payload.assignment_id)
        old_assignment = session.get(TeacherAssignment, row.assignment_id)
        if (assignment.section_id, assignment.term_id) != (row.section_id, old_assignment.term_id):
            raise HTTPException(400, "Select a subject allocated to the same class and semester")
        payload = semester_dates(session, assignment, payload)
        start = max(payload.effective_from, campus_today() + timedelta(days=1))
        if start > payload.effective_to:
            raise HTTPException(400, "There are no future semester dates left to change")
        payload = payload.model_copy(update={"effective_from": start})
        conflict_check(session, assignment, payload, exclude_slot_id=row.id)
        future = session.scalars(select(ClassSession).where(ClassSession.timetable_slot_id == row.id, ClassSession.session_date >= start)).all()
        if any(c.status not in {"scheduled", "cancelled"} or c.attendance_state == "published" or c.actual_start for c in future):
            raise HTTPException(409, "A future class has activity; review it before changing the timetable")
        before = {k: str(getattr(row, k)) for k in payload.model_dump()}
        for c in future:
            c.status = "cancelled"
        if row.effective_from >= start:
            for key, value in payload.model_dump().items():
                setattr(row, key, value)
            target = row
        else:
            row.effective_to = start - timedelta(days=1)
            target = TimetableSlot(section_id=row.section_id, publication_status="published", proposed_by=actor.id, approved_by=actor.id, **payload.model_dump())
            session.add(target)
        session.flush()
        generated = generate_sessions(session, target, actor.id)
        db.write_audit(session, actor.id, "timetable.updated", "timetable_slot", target.id, {"previous": before, "new": payload.model_dump(mode="json")})
        return generated

    @app.patch("/api/timetable/{slot_id}")
    def edit_slot(slot_id: int, payload: TimetableSlotCreate, actor: User = Depends(current_user), session: Session = Depends(db.get_db)):
        row, assignment = scoped_slot(session, actor, slot_id)
        if not row.active or row.publication_status != "published":
            raise HTTPException(409, "Only a published period can be edited")
        manager = manages_academics(session, actor)
        if not manager and not mentors(session, actor, assignment):
            raise HTTPException(403, "Only the class mentor, HOD or administrator can edit this timetable")
        target = timetable_access(session, actor, payload.assignment_id)
        if (target.section_id, target.term_id) != (assignment.section_id, assignment.term_id):
            raise HTTPException(400, "Select a subject already allocated to this class and semester")
        payload = semester_dates(session, target, payload)
        if manager:
            count = apply_change(session, actor, row, payload)
            session.commit()
            return {"status": "published", "sessions_generated": count}
        change = TimetableChange(institution_id=actor.institution_id, slot_id=row.id, proposed_by=actor.id, payload_json=payload.model_dump_json())
        session.add(change)
        session.flush()
        db.write_audit(session, actor.id, "timetable.change_proposed", "timetable_change", change.id)
        session.commit()
        return {"status": "pending"}

    @app.patch("/api/timetable/changes/{change_id}/review")
    def review_change(change_id: int, payload: TimetableReview, actor: User = Depends(allocation_manager), session: Session = Depends(db.get_db)):
        change = session.scalar(select(TimetableChange).where(TimetableChange.id == change_id).with_for_update())
        if not change or change.institution_id != actor.institution_id:
            raise HTTPException(404, "Change request not found")
        if change.status != "pending":
            raise HTTPException(409, "This change was already reviewed")
        if payload.decision == "approved":
            row, _ = scoped_slot(session, actor, change.slot_id)
            if not row.active:
                raise HTTPException(409, "This period has been removed")
            apply_change(session, actor, row, TimetableSlotCreate.model_validate_json(change.payload_json))
        elif not (payload.reason or "").strip():
            raise HTTPException(400, "A rejection reason is required")
        change.status, change.reviewed_by, change.reason = payload.decision, actor.id, payload.reason
        db.write_audit(session, actor.id, "timetable.change_reviewed", "timetable_change", change.id, payload.model_dump())
        session.commit()
        return {"status": change.status}

    @app.delete("/api/timetable/{slot_id}")
    def remove_slot(slot_id: int, actor: User = Depends(allocation_manager), session: Session = Depends(db.get_db)):
        row, _ = scoped_slot(session, actor, slot_id)
        row.active = False
        session.query(ClassSession).filter(ClassSession.timetable_slot_id == row.id, ClassSession.session_date > campus_today(), ClassSession.status == "scheduled", ClassSession.actual_start.is_(None), ClassSession.attendance_state != "published").update({ClassSession.status: "cancelled"})
        db.write_audit(session, actor.id, "timetable.archived", "timetable_slot", row.id)
        session.commit()
        return {"status": "archived", "history_preserved": True}

    @app.patch("/api/admin/academics/sections/{section_id}")
    def rename_class(section_id: int, payload: RenameClass, actor: User = Depends(allocation_manager), session: Session = Depends(db.get_db)):
        row = session.get(ClassSection, section_id)
        if not row or row.institution_id != actor.institution_id:
            raise HTTPException(404, "Class not found")
        if not payload.name.strip():
            raise HTTPException(400, "Enter a class name")
        row.name = payload.name.strip()
        db.write_audit(session, actor.id, "class.renamed", "class_section", row.id, {"name": row.name})
        from sqlalchemy.exc import IntegrityError
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            raise HTTPException(409, "This class name already exists for that batch")
        return {"id": row.id}

    @app.delete("/api/admin/academics/sections/{section_id}")
    def archive_class(section_id: int, actor: User = Depends(allocation_manager), session: Session = Depends(db.get_db)):
        row = session.get(ClassSection, section_id)
        if not row or row.institution_id != actor.institution_id:
            raise HTTPException(404, "Class not found")
        if session.scalar(select(SectionMembership.id).where(SectionMembership.section_id == row.id, SectionMembership.active.is_(True))):
            raise HTTPException(409, "Move or withdraw active students before archiving their class")
        row.active = False
        session.query(TeacherAssignment).filter(TeacherAssignment.section_id == row.id).update({TeacherAssignment.active: False})
        session.query(TimetableSlot).filter(TimetableSlot.section_id == row.id).update({TimetableSlot.active: False})
        session.query(ClassSession).filter(ClassSession.section_id == row.id, ClassSession.session_date > campus_today(), ClassSession.status == "scheduled", ClassSession.actual_start.is_(None), ClassSession.attendance_state != "published").update({ClassSession.status: "cancelled"})
        db.write_audit(session, actor.id, "class.archived", "class_section", row.id)
        session.commit()
        return {"status": "archived", "history_preserved": True}
