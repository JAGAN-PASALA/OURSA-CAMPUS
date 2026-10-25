import json
import math
import hashlib
from collections import defaultdict
from contextlib import contextmanager
from datetime import date, datetime, time as clock_time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import and_, create_engine, func, or_, select, text
from sqlalchemy.orm import Session, selectinload, sessionmaker

from auth import hash_password
from config import get_settings
import notification_service
import push_service
from models import (
    AcademicTerm,
    Announcement,
    Assessment,
    AssessmentAttempt,
    AssessmentResult,
    AssessmentTopic,
    AuditLog,
    Attendance,
    AttendanceCorrection,
    Base,
    BehaviourEpisode,
    BehaviourObservation,
    BehaviourSample,
    BehaviourModelVersion,
    ClassSection,
    ClassSession,
    ClassroomChange,
    CameraWorkerStatus,
    ClassroomPresenceEvent,
    Course,
    Department,
    Enrollment,
    FaceEmbedding,
    FeeRecord,
    FeePayment,
    Incident,
    Institution,
    InstitutionDomain,
    LearningAssignment,
    LearningSubmission,
    LearningSubmissionAttachment,
    ModelMeta,
    NotificationDelivery,
    PushDevice,
    Question,
    RaisedHandAttendanceRequest,
    SectionMembership,
    SessionAttendance,
    StaffCareerIdentity,
    StaffCareerServiceRecord,
    StaffFaceEmbedding,
    StaffProfile,
    StaffTransferRequest,
    Student,
    StudentAnswer,
    StudentProfile,
    SyllabusTopic,
    SyllabusUnit,
    TeacherAssignment,
    TeacherFeedback,
    TimetableSlot,
    TopicCoverage,
    User,
)
from privacy import decrypt_embedding, decrypt_secret, encrypt_embedding, encrypt_secret


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine_options = {"pool_pre_ping": True, "connect_args": connect_args}
if not settings.database_url.startswith("sqlite"):
    engine_options.update(
        pool_recycle=settings.db_pool_recycle_seconds,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout_seconds,
    )
engine = create_engine(settings.database_url, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def campus_now() -> datetime:
    """Return the configured campus wall-clock time, including its timezone."""
    return datetime.now(ZoneInfo(settings.campus_timezone))


def campus_datetime_iso(value: datetime | None) -> str | None:
    """Serialize database timestamps in the configured campus timezone.

    MySQL commonly returns DATETIME values without tzinfo even when SQLAlchemy's
    timezone flag is enabled. Application writes are UTC, so a naive value is
    interpreted as UTC before conversion. This also fixes existing records.
    """
    if value is None:
        return None
    source = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return source.astimezone(ZoneInfo(settings.campus_timezone)).isoformat()


def campus_date() -> date:
    return campus_now().date()


def get_db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_database() -> None:
    settings.validate_runtime()
    Base.metadata.create_all(engine)
    # create_all does not alter existing tables. Additive, backward-compatible
    # security columns let existing v8.1 databases upgrade without data loss.
    from sqlalchemy import inspect
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        existing = {column["name"] for column in inspector.get_columns("users")}
        additions = {
            "mfa_enabled": "BOOLEAN NOT NULL DEFAULT FALSE",
            "mfa_secret_encrypted": "VARCHAR(512) NULL",
            "mfa_last_counter": "INTEGER NULL",
        }
        with engine.begin() as connection:
            for name, definition in additions.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE users ADD COLUMN {name} {definition}"))
    if settings.seed_demo_data:
        seed_demo_data()


def database_ready() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def public_institution(institution: Institution, domain: str | None = None) -> dict:
    return {
        "id": institution.id,
        "name": institution.name,
        "slug": institution.slug,
        "organization_type": institution.organization_type,
        "brand_name": institution.brand_name,
        "primary_color": institution.primary_color,
        "logo_url": f"/api/public/institutions/{institution.id}/logo" if institution.logo_storage_key else None,
        "domain": domain,
        "attendance_required_percent": institution.attendance_required_percent,
        "fight_alert_seconds": institution.fight_alert_seconds,
        "crowd_threshold": institution.crowd_threshold,
        "crowd_alert_seconds": institution.crowd_alert_seconds,
        "biometric_retention_days": institution.biometric_retention_days,
        "minor_guardian_consent_required": institution.minor_guardian_consent_required,
    }


def public_user(user: User, session: Session | None = None) -> dict:
    profile = session.scalar(select(StaffProfile).where(StaffProfile.user_id == user.id)) if session and user.role != "student" else None
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "institution_id": user.institution_id,
        "institution_name": user.institution.name if user.institution else "",
        "platform_admin": user.platform_admin,
        "credential_change_required": user.must_change_password,
        "designation": profile.designation if profile else None,
        "department_id": profile.department_id if profile else None,
    }


def normalize_domain(value: str | None) -> str:
    if not value:
        return ""
    host = value.strip().lower().rstrip(".")
    if host.startswith("http://") or host.startswith("https://"):
        host = host.split("://", 1)[1]
    return host.split("/", 1)[0].split(":", 1)[0]


def get_institution_by_domain(session: Session, domain: str | None) -> tuple[Institution | None, str]:
    normalized = normalize_domain(domain)
    row = session.execute(
        select(Institution, InstitutionDomain.domain)
        .join(InstitutionDomain, InstitutionDomain.institution_id == Institution.id)
        .where(InstitutionDomain.domain == normalized, InstitutionDomain.active.is_(True), Institution.active.is_(True))
    ).first()
    if row:
        return row[0], row[1]
    if normalized in ("", "localhost", "127.0.0.1", "::1", "testserver"):
        institution = session.scalar(select(Institution).where(Institution.slug == "ours-platform", Institution.active.is_(True)))
        return institution, normalized or "localhost"
    return None, normalized


def get_institution_by_slug(session: Session, slug: str | None) -> Institution | None:
    normalized = (slug or "").strip().lower()
    if not normalized:
        return None
    return session.scalar(select(Institution).where(Institution.slug == normalized, Institution.active.is_(True)))


def monitoring_policy(institution_id: int) -> dict:
    with SessionLocal() as session:
        row = session.get(Institution, institution_id)
        return {
            "fight_alert_seconds": row.fight_alert_seconds if row else 120,
            "crowd_threshold": row.crowd_threshold if row else 40,
            "crowd_alert_seconds": row.crowd_alert_seconds if row else 30,
        }


def search_public_institutions(session: Session, query: str, limit: int = 8) -> list[dict]:
    normalized = query.strip()
    statement = select(Institution).where(Institution.active.is_(True))
    if normalized:
        compact_query = "".join(character for character in normalized.casefold() if character.isalnum())
        compact_name = func.lower(Institution.name)
        for punctuation in ("'", "’", " ", "-", ".", "&"):
            compact_name = func.replace(compact_name, punctuation, "")
        statement = statement.where(or_(
            Institution.name.ilike(f"%{normalized}%"),
            compact_name.like(f"%{compact_query}%"),
        ))
    rows = session.scalars(statement.order_by(Institution.name).limit(min(limit, 20))).all()
    return [{"id": row.id, "name": row.name, "slug": row.slug, "organization_type": row.organization_type, "brand_name": row.brand_name, "primary_color": row.primary_color} for row in rows]


def list_institutions(session: Session) -> list[dict]:
    rows = session.execute(
        select(Institution, InstitutionDomain.domain)
        .outerjoin(InstitutionDomain, (InstitutionDomain.institution_id == Institution.id) & InstitutionDomain.is_primary.is_(True))
        .order_by(Institution.name)
    ).all()
    result = []
    for institution, domain in rows:
        administrators = session.scalars(select(User).where(User.institution_id == institution.id, User.role == "admin", User.platform_admin.is_(False), User.active.is_(True)).order_by(User.name)).all()
        result.append({**public_institution(institution, domain), "active": institution.active, "administrators": [{"id": row.id, "name": row.name, "email": row.email} for row in administrators]})
    return result


def get_user_by_email(session: Session, email: str, institution_id: int | None = None) -> User | None:
    filters = [func.lower(User.email) == email.lower()]
    if institution_id is not None:
        filters.append(User.institution_id == institution_id)
    return session.scalar(select(User).where(*filters))


def get_user(session: Session, user_id: int) -> User | None:
    return session.get(User, user_id)


def seed_demo_data() -> None:
    with session_scope() as session:
        institution = session.scalar(select(Institution).where(Institution.slug == "ours-platform"))
        if not institution:
            institution = Institution(name="OUR'S Development Institution", slug="ours-platform", organization_type="platform", brand_name="OUR'S")
            session.add(institution)
            session.flush()
        if not session.scalar(select(InstitutionDomain.id).where(InstitutionDomain.institution_id == institution.id, InstitutionDomain.domain == "localhost")):
            session.add(InstitutionDomain(institution_id=institution.id, domain="localhost", is_primary=True))
        if not session.scalar(select(func.count()).select_from(User).where(User.institution_id == institution.id)):
            users = [
                User(institution_id=institution.id, name="Institution Administrator", email="admin@example.com", password_hash=hash_password("Admin@123"), role="admin", platform_admin=False),
                User(institution_id=institution.id, name="Dr. Priya Sharma", email="teacher@example.com", password_hash=hash_password("Teacher@123"), role="teacher"),
                User(institution_id=institution.id, name="Arjun Kumar", email="student@example.com", password_hash=hash_password("Student@123"), role="student"),
                User(institution_id=institution.id, name="Meera Reddy", email="meera@example.com", password_hash=hash_password("Student@123"), role="student"),
                User(institution_id=institution.id, name="Kiran Rao", email="kiran@example.com", password_hash=hash_password("Student@123"), role="student"),
                User(institution_id=institution.id, name="Platform Owner", email="owner@example.com", password_hash=hash_password("Owner@12345"), role="admin", platform_admin=True),
            ]
            session.add_all(users)
            session.flush()
            department = Department(institution_id=institution.id, name="Computer Science and Engineering", code="CSE", email_domain="cse.example.edu")
            session.add(department)
            session.flush()
            session.add_all([
                StaffProfile(institution_id=institution.id, user_id=users[0].id, designation="administrator", biometric_consent=False),
                StaffProfile(institution_id=institution.id, user_id=users[1].id, designation="teacher", employee_no="FAC001", department_id=department.id, biometric_consent=False),
                StaffProfile(institution_id=institution.id, user_id=users[5].id, designation="administrator", biometric_consent=False),
            ])
            students = [
                Student(institution_id=institution.id, user_id=users[2].id, roll_no="CSE001", department="CSE", department_id=department.id),
                Student(institution_id=institution.id, user_id=users[3].id, roll_no="CSE002", department="CSE", department_id=department.id),
                Student(institution_id=institution.id, user_id=users[4].id, roll_no="CSE003", department="CSE", department_id=department.id),
            ]
            courses = [
                Course(institution_id=institution.id, title="Machine Learning Foundations", code="ML101", total_lessons=12),
                Course(institution_id=institution.id, title="Python for Data Science", code="PY201", total_lessons=10),
                Course(institution_id=institution.id, title="Database Systems", code="DB110", total_lessons=8),
            ]
            session.add_all(students + courses)
            session.flush()
            # Test/demo profiles keep the historical editable-fixture behavior;
            # production-created students remain read-only until an admin grant.
            session.add_all([StudentProfile(student_id=student.id, self_edit_enabled=True) for student in students])
            values = [(9, 84), (8, 78), (7, 88), (10, 91), (6, 74), (6, 80), (7, 83), (7, 82), (5, 69)]
            for index, (student, course) in enumerate((s, c) for s in students for c in courses):
                completed, score = values[index]
                session.add(Enrollment(student_id=student.id, course_id=course.id, completed_lessons=completed, score=score))
            today = campus_date()
            for index, student in enumerate(students):
                for offset in range(7):
                    attendance_status = "Absent" if (offset + index) % 8 == 0 else "Present"
                    session.add(Attendance(student_id=student.id, class_date=today - timedelta(days=offset), status=attendance_status, confidence=.94))
            session.add(Incident(institution_id=institution.id, student_id=students[0].id, classroom_id="CSE-A", behaviour="mobile phone usage", confidence=.88, occurred_at=datetime.now(timezone.utc) - timedelta(days=1)))
            session.add(ModelMeta(id=1))
            session.add(AuditLog(institution_id=institution.id, action="demo.seeded", entity_type="system", details_json=json.dumps({"warning": "Replace demo accounts before deployment"})))
            session.flush()

        if not session.scalar(select(func.count()).select_from(AcademicTerm).where(AcademicTerm.institution_id == institution.id)):
            teacher = get_user_by_email(session, "teacher@example.com", institution.id)
            ml_course = session.scalar(select(Course).where(Course.institution_id == institution.id, Course.code == "ML101"))
            if teacher and ml_course:
                today = campus_date()
                term = AcademicTerm(institution_id=institution.id, name="Semester 5", academic_year=f"{today.year}-{today.year + 1}", start_date=today - timedelta(days=30), end_date=today + timedelta(days=120))
                section = ClassSection(institution_id=institution.id, name="CSE-A", department="CSE", semester=5, batch_year=today.year - 2)
                session.add_all([term, section])
                session.flush()
                students_for_section = session.scalars(select(Student).where(Student.institution_id == institution.id)).all()
                session.add_all([SectionMembership(student_id=student.id, section_id=section.id, term_id=term.id) for student in students_for_section])
                assignment = TeacherAssignment(teacher_id=teacher.id, course_id=ml_course.id, section_id=section.id, term_id=term.id)
                session.add(assignment)
                session.flush()
                slot = TimetableSlot(assignment_id=assignment.id, section_id=section.id, weekday=today.weekday(), period_number=1, start_time=clock_time(9, 0), end_time=clock_time(10, 0), classroom="AI Lab 1", effective_from=term.start_date, effective_to=term.end_date)
                unit = SyllabusUnit(course_id=ml_course.id, title="Unit 1 · Regression Foundations", sequence_no=1)
                session.add_all([slot, unit])
                session.flush()
                topics = [
                    SyllabusTopic(unit_id=unit.id, title="Introduction to supervised learning", sequence_no=1, planned_date=today - timedelta(days=7), status="completed", coverage_percent=100, completed_at=datetime.now(timezone.utc) - timedelta(days=7)),
                    SyllabusTopic(unit_id=unit.id, title="Simple Linear Regression", sequence_no=2, planned_date=today, status="planned", coverage_percent=0),
                    SyllabusTopic(unit_id=unit.id, title="Multiple Linear Regression", sequence_no=3, planned_date=today + timedelta(days=7), status="planned", coverage_percent=0),
                    SyllabusTopic(unit_id=unit.id, title="Regression evaluation metrics", sequence_no=4, planned_date=today + timedelta(days=14), status="planned", coverage_percent=0),
                ]
                class_session = ClassSession(assignment_id=assignment.id, timetable_slot_id=slot.id, section_id=section.id, session_date=today, period_number=1, classroom=slot.classroom, created_by=teacher.id)
                session.add_all(topics + [class_session])
                session.flush()
                previous_session = ClassSession(assignment_id=assignment.id, section_id=section.id, session_date=today - timedelta(days=7), period_number=1, classroom=slot.classroom, status="completed", actual_start=datetime.now(timezone.utc) - timedelta(days=7, hours=1), actual_end=datetime.now(timezone.utc) - timedelta(days=7), teacher_notes="Introduced supervised learning with classroom examples.", created_by=teacher.id)
                session.add(previous_session)
                session.flush()
                session.add(TopicCoverage(class_session_id=previous_session.id, topic_id=topics[0].id, status="completed", coverage_percent=100, notes="Concept and examples completed", recorded_by=teacher.id))


def student_to_dict(student: Student) -> dict:
    return {
        "id": student.id,
        "user_id": student.user_id,
        "name": student.user.name,
        "email": student.user.email,
        "roll_no": student.roll_no,
        "department": student.department,
        "department_id": student.department_id,
        "biometric_consent": student.biometric_consent,
        "face_registered": False,
    }


def list_students(session: Session, institution_id: int, teacher_id: int | None = None) -> list[dict]:
    statement = select(Student).options(selectinload(Student.user)).where(Student.institution_id == institution_id)
    if teacher_id:
        assigned_students = select(SectionMembership.student_id).join(
            TeacherAssignment,
            and_(
                TeacherAssignment.section_id == SectionMembership.section_id,
                TeacherAssignment.term_id == SectionMembership.term_id,
            ),
        ).where(
            TeacherAssignment.teacher_id == teacher_id,
            TeacherAssignment.active.is_(True),
            SectionMembership.active.is_(True),
        )
        statement = statement.where(Student.id.in_(assigned_students))
    rows = session.scalars(statement.order_by(Student.roll_no)).all()
    student_ids = [row.id for row in rows]
    face_rows = {row.student_id: row.enrollment_samples for row in session.scalars(select(FaceEmbedding).where(FaceEmbedding.student_id.in_(student_ids or [-1]))).all()}
    profile_rows = {row.student_id: row for row in session.scalars(select(StudentProfile).where(StudentProfile.student_id.in_(student_ids or [-1]))).all()}
    result = []
    for student in rows:
        item = student_to_dict(student)
        profile = profile_rows.get(student.id)
        if profile and profile.date_of_birth:
            today = campus_date()
            age = today.year - profile.date_of_birth.year - ((today.month, today.day) < (profile.date_of_birth.month, profile.date_of_birth.day))
            age_status = "minor" if age < 18 else "adult"
        else:
            age_status = "unknown"
        membership = session.execute(
            select(SectionMembership, ClassSection, AcademicTerm)
            .join(ClassSection, ClassSection.id == SectionMembership.section_id)
            .join(AcademicTerm, AcademicTerm.id == SectionMembership.term_id)
            .where(SectionMembership.student_id == student.id, SectionMembership.active.is_(True))
            .order_by(AcademicTerm.start_date.desc(), SectionMembership.id.desc())
        ).first()
        if membership:
            membership_row, section, term = membership
            item.update({"section_id": section.id, "section_name": section.name, "term_id": term.id, "term_name": term.name, "membership_id": membership_row.id})
        else:
            item.update({"section_id": None, "section_name": None, "term_id": None, "term_name": None, "membership_id": None})
        item["face_samples"] = face_rows.get(student.id, 0)
        item["face_registered"] = face_rows.get(student.id, 0) >= settings.face_enrollment_samples
        item["date_of_birth"] = str(profile.date_of_birth) if profile and profile.date_of_birth else None
        item["age_status"] = age_status
        item["guardian_biometric_consent"] = bool(profile and profile.guardian_biometric_consent)
        item["self_edit_enabled"] = bool(profile and profile.self_edit_enabled)
        result.append(item)
    return result


def list_staff(session: Session, institution_id: int) -> list[dict]:
    rows = session.execute(
        select(User, StaffProfile, StaffFaceEmbedding)
        .outerjoin(StaffProfile, StaffProfile.user_id == User.id)
        .outerjoin(StaffFaceEmbedding, StaffFaceEmbedding.user_id == User.id)
        .where(User.institution_id == institution_id, User.role.in_(["teacher", "admin", "staff"]), User.active.is_(True))
        .order_by(User.name)
    ).all()
    return [{
        **public_user(user),
        "designation": profile.designation if profile else ("teacher" if user.role == "teacher" else "administrator"),
        "employee_no": profile.employee_no if profile else None,
        "department_id": profile.department_id if profile else None,
        "biometric_consent": bool(profile and profile.biometric_consent),
        "face_samples": embedding.enrollment_samples if embedding else 0,
        "face_registered": bool(embedding and embedding.enrollment_samples >= settings.face_enrollment_samples),
    } for user, profile, embedding in rows]


def list_courses(session: Session, institution_id: int) -> list[dict]:
    rows = session.scalars(select(Course).where(Course.institution_id == institution_id).order_by(Course.code)).all()
    return [{"id": row.id, "title": row.title, "code": row.code, "total_lessons": row.total_lessons, "active": row.active} for row in rows]


def list_enrollments(session: Session, institution_id: int) -> list[dict]:
    rows = session.execute(
        select(Enrollment, Student, User, Course)
        .join(Student, Student.id == Enrollment.student_id)
        .join(User, User.id == Student.user_id)
        .join(Course, Course.id == Enrollment.course_id)
        .where(Student.institution_id == institution_id, Course.institution_id == institution_id)
        .order_by(User.name, Course.code)
    ).all()
    return [{
        "id": enrollment.id,
        "student_id": student.id,
        "student_name": user.name,
        "course_id": course.id,
        "course_code": course.code,
        "completed_lessons": enrollment.completed_lessons,
        "total_lessons": course.total_lessons,
        "score": round(enrollment.score, 1),
    } for enrollment, student, user, course in rows]


def student_summary(session: Session, student_id: int) -> dict | None:
    student = session.scalar(select(Student).options(selectinload(Student.user)).where(Student.id == student_id))
    if not student:
        return None
    session_attendance = session.scalars(select(SessionAttendance).where(SessionAttendance.student_id == student_id, SessionAttendance.status.in_(["Present", "Absent"]))).all()
    attendance = session.scalars(select(Attendance).where(Attendance.student_id == student_id)).all()
    enrollments = session.scalars(select(Enrollment).options(selectinload(Enrollment.course)).where(Enrollment.student_id == student_id)).all()
    attendance_source = session_attendance or attendance
    attendance_percent = round(100 * sum(row.status == "Present" for row in attendance_source) / len(attendance_source)) if attendance_source else 0
    total_lessons = sum(row.course.total_lessons for row in enrollments)
    progress = round(100 * sum(row.completed_lessons for row in enrollments) / total_lessons) if total_lessons else 0
    assessment_scores = []
    for result, total_marks in session.execute(select(AssessmentResult, Assessment.total_marks).join(Assessment, Assessment.id == AssessmentResult.assessment_id).where(AssessmentResult.student_id == student_id)).all():
        if total_marks:
            assessment_scores.append(100 * result.marks / total_marks)
    coursework_scores = [100 * marks / max_marks for marks, max_marks in session.execute(select(LearningSubmission.marks, LearningAssignment.max_marks).join(LearningAssignment, LearningAssignment.id == LearningSubmission.learning_assignment_id).where(LearningSubmission.student_id == student_id, LearningSubmission.status == "graded", LearningSubmission.marks.is_not(None))).all() if max_marks]
    recorded_scores = assessment_scores + coursework_scores
    score = round(sum(recorded_scores) / len(recorded_scores)) if recorded_scores else round(sum(row.score for row in enrollments) / len(enrollments)) if enrollments else 0
    since = datetime.now(timezone.utc) - timedelta(days=30)
    observations = session.scalars(select(BehaviourObservation).where(BehaviourObservation.student_id == student_id, BehaviourObservation.last_seen_at >= since)).all()
    observation_seconds = sum(row.observed_seconds for row in observations)
    attentive_seconds = sum(row.observed_seconds for row in observations if row.behaviour == "attentive")
    behaviours: dict[str, float] = defaultdict(float)
    for row in observations:
        behaviours[row.behaviour] += row.observed_seconds
    attention = round(100 * attentive_seconds / observation_seconds) if observation_seconds else 0
    status = "Excellent" if score >= 85 else "Good" if score >= 75 else "Needs support"
    return {"id": student.id, "name": student.user.name, "attendance": attendance_percent, "progress": progress, "average_score": score, "attention": attention, "behaviour_observed": observation_seconds > 0, "behaviours": _percent_distribution(behaviours), "status": status}


def analytics_for_student(session: Session, student_id: int) -> dict:
    memberships = session.scalars(select(SectionMembership).where(SectionMembership.student_id == student_id, SectionMembership.active.is_(True))).all()
    membership_pairs = [(membership.section_id, membership.term_id) for membership in memberships]
    assignment_query = select(TeacherAssignment, Course).join(Course, Course.id == TeacherAssignment.course_id)
    if membership_pairs:
        assignment_query = assignment_query.where(or_(*(and_(TeacherAssignment.section_id == section_id, TeacherAssignment.term_id == term_id) for section_id, term_id in membership_pairs)))
    else:
        enrolled_course_ids = session.scalars(select(Enrollment.course_id).where(Enrollment.student_id == student_id)).all()
        assignment_query = assignment_query.where(TeacherAssignment.course_id.in_(enrolled_course_ids or [-1]), TeacherAssignment.active.is_(True))
    assignments = session.execute(assignment_query).all()
    subjects = []
    overall_behaviour: dict[str, float] = defaultdict(float)
    total_present = total_classes = 0
    all_scores: list[float] = []
    seen_courses: set[int] = set()
    for assignment, course in assignments:
        if course.id in seen_courses:
            continue
        seen_courses.add(course.id)
        assignment_ids = [row.id for row, row_course in assignments if row_course.id == course.id]
        session_ids = session.scalars(select(ClassSession.id).where(ClassSession.assignment_id.in_(assignment_ids or [-1]))).all()
        attendance_rows = session.scalars(select(SessionAttendance).where(SessionAttendance.student_id == student_id, SessionAttendance.class_session_id.in_(session_ids or [-1]), SessionAttendance.status.in_(["Present", "Absent"]))).all()
        behaviour_rows = session.scalars(select(BehaviourObservation).where(BehaviourObservation.student_id == student_id, BehaviourObservation.class_session_id.in_(session_ids or [-1]))).all()
        behaviours: dict[str, float] = defaultdict(float)
        for row in behaviour_rows:
            behaviours[row.behaviour] += row.observed_seconds
            overall_behaviour[row.behaviour] += row.observed_seconds
        results = session.scalars(select(AssessmentResult).join(Assessment, Assessment.id == AssessmentResult.assessment_id).where(AssessmentResult.student_id == student_id, Assessment.course_id == course.id)).all()
        scores = []
        for result in results:
            assessment = session.get(Assessment, result.assessment_id)
            if assessment and assessment.total_marks:
                scores.append(round(100 * result.marks / assessment.total_marks, 1))
        graded_coursework = session.execute(select(LearningSubmission.marks, LearningAssignment.max_marks).join(LearningAssignment, LearningAssignment.id == LearningSubmission.learning_assignment_id).where(LearningSubmission.student_id == student_id, LearningSubmission.status == "graded", LearningSubmission.marks.is_not(None), LearningAssignment.course_id == course.id)).all()
        scores.extend(round(100 * marks / maximum, 1) for marks, maximum in graded_coursework if maximum)
        present = sum(row.status == "Present" for row in attendance_rows)
        total = len(attendance_rows)
        total_present += present
        total_classes += total
        all_scores.extend(scores)
        subjects.append({
            "course_id": course.id,
            "course_code": course.code,
            "course_title": course.title,
            "attendance_percent": round(100 * present / total, 1) if total else 0,
            "present_classes": present,
            "total_classes": total,
            "average_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "behaviours": _percent_distribution(behaviours),
        })
    return {
        "overall": {
            "attendance_percent": round(100 * total_present / total_classes, 1) if total_classes else 0,
            "present_classes": total_present,
            "total_classes": total_classes,
            "average_score": round(sum(all_scores) / len(all_scores), 1) if all_scores else 0,
            "behaviours": _percent_distribution(overall_behaviour),
        },
        "subjects": subjects,
    }


def _percent_distribution(values: dict[str, float]) -> dict[str, float]:
    total = sum(values.values())
    return {key: round(100 * value / total, 1) if total else 0 for key, value in sorted(values.items())}


def dashboard_for(session: Session, user: User) -> dict:
    if user.role == "student":
        student = session.scalar(select(Student).where(Student.user_id == user.id))
        if not student:
            return {"student": None, "courses": [], "attendance_history": []}
        rows = session.scalars(select(Enrollment).options(selectinload(Enrollment.course)).where(Enrollment.student_id == student.id)).all()
        courses = [{
            "id": row.course.id,
            "title": row.course.title,
            "total_lessons": row.course.total_lessons,
            "completed_lessons": row.completed_lessons,
            "progress": round(100 * row.completed_lessons / row.course.total_lessons),
            "score": round(row.score),
        } for row in rows]
        history = session.scalars(select(Attendance).where(Attendance.student_id == student.id).order_by(Attendance.class_date.desc()).limit(7)).all()
        return {"student": student_summary(session, student.id), "courses": courses, "attendance_history": [{"date": str(row.class_date), "status": row.status} for row in history], "analytics": analytics_for_student(session, student.id)}
    if user.role in {"teacher", "staff"}:
        student_ids = [row["id"] for row in list_students(session, user.institution_id, user.id)]
    else:
        student_ids = session.scalars(select(Student.id).where(Student.institution_id == user.institution_id).order_by(Student.id)).all()
    incidents = session.execute(
        select(Incident, User.name)
        .outerjoin(Student, Student.id == Incident.student_id)
        .outerjoin(User, User.id == Student.user_id)
        .where(Incident.institution_id == user.institution_id)
        .order_by(Incident.occurred_at.desc()).limit(8)
    ).all()
    meta = session.get(ModelMeta, 1)
    return {
        "students": [student_summary(session, student_id) for student_id in student_ids],
        "incidents": [{"id": row.id, "student_name": name or "Unknown", "behaviour": row.behaviour, "confidence": row.confidence, "reviewed": row.reviewed, "occurred_at": row.occurred_at.isoformat()} for row, name in incidents],
        "model": {"trained": bool(meta and meta.trained), "samples": meta.samples if meta else 0, "accuracy": meta.accuracy if meta else 0},
    }


def _student_profile(session: Session, student: Student) -> StudentProfile:
    profile = session.scalar(select(StudentProfile).where(StudentProfile.student_id == student.id))
    if not profile:
        profile = StudentProfile(student_id=student.id)
        session.add(profile)
        session.flush()
    return profile


def _announcement_rows(session: Session, user: User, student: Student | None = None) -> list[dict]:
    now = datetime.now(timezone.utc)
    filters = [Announcement.institution_id == user.institution_id, or_(Announcement.expires_at.is_(None), Announcement.expires_at >= now)]
    audiences = ["all"]
    if user.role == "student":
        audiences.append("students")
    elif user.role in {"teacher", "staff"}:
        audiences.append("teachers")
    else:
        audiences.append("administrators")
    filters.append(Announcement.audience.in_(audiences))
    rows = session.execute(
        select(Announcement, User.name, ClassSection.name)
        .join(User, User.id == Announcement.created_by)
        .outerjoin(ClassSection, ClassSection.id == Announcement.section_id)
        .where(*filters)
        .order_by(Announcement.published_at.desc())
        .limit(100)
    ).all()
    allowed_sections = set()
    if student:
        allowed_sections = set(session.scalars(select(SectionMembership.section_id).where(SectionMembership.student_id == student.id, SectionMembership.active.is_(True))).all())
    return [
        {"id": row.id, "title": row.title, "body": row.body, "audience": row.audience, "section_id": row.section_id, "section_name": section_name, "created_by": author, "published_at": campus_datetime_iso(row.published_at), "expires_at": campus_datetime_iso(row.expires_at)}
        for row, author, section_name in rows
        if not row.section_id or not student or row.section_id in allowed_sections
    ]


def _teacher_metrics(session: Session, user: User) -> dict:
    assignment_ids = session.scalars(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id == user.id)).all()
    sessions = session.scalars(select(ClassSession).where(ClassSession.assignment_id.in_(assignment_ids or [-1]))).all()
    completed = [row for row in sessions if row.status == "completed"]
    started_on_time = sum(bool(row.actual_start) for row in completed)
    course_ids = session.scalars(select(TeacherAssignment.course_id).where(TeacherAssignment.id.in_(assignment_ids or [-1]))).all()
    topics = session.scalars(select(SyllabusTopic).join(SyllabusUnit, SyllabusUnit.id == SyllabusTopic.unit_id).where(SyllabusUnit.course_id.in_(course_ids or [-1]))).all()
    feedback_rows = session.scalars(select(TeacherFeedback).where(TeacherFeedback.teacher_id == user.id)).all()
    feedback_average = None
    feedback_count = len(feedback_rows)
    dimensions = {"clarity": 0.0, "pace": 0.0, "interaction": 0.0, "doubt_resolution": 0.0, "helpfulness": 0.0}
    if feedback_rows:
        for item in feedback_rows:
            for field in dimensions:
                dimensions[field] += float(getattr(item, field))
        dimensions = {field: round(total / feedback_count, 2) for field, total in dimensions.items()}
        feedback_average = round(sum(dimensions.values()) / len(dimensions), 2)
    engagement = session.execute(
        select(BehaviourObservation.behaviour, func.sum(BehaviourObservation.observed_seconds))
        .join(ClassSession, ClassSession.id == BehaviourObservation.class_session_id)
        .where(ClassSession.assignment_id.in_(assignment_ids or [-1]))
        .group_by(BehaviourObservation.behaviour)
    ).all()
    engagement_values = {name: float(seconds or 0) for name, seconds in engagement}
    observed_periods = session.scalar(
        select(func.count(func.distinct(ClassroomPresenceEvent.class_session_id))).where(
            ClassroomPresenceEvent.staff_user_id == user.id,
            ClassroomPresenceEvent.class_session_id.is_not(None),
        )
    ) or 0
    approved_interactions = session.scalar(
        select(func.count()).select_from(RaisedHandAttendanceRequest).where(
            RaisedHandAttendanceRequest.teacher_user_id == user.id,
            RaisedHandAttendanceRequest.status == "approved",
        )
    ) or 0
    return {
        "classes_completed": len(completed),
        "classes_total": len(sessions),
        "start_records": started_on_time,
        "topics_completed": sum(row.status == "completed" for row in topics),
        "topics_total": len(topics),
        "aggregate_engagement": _percent_distribution(engagement_values),
        "camera_observed_periods": observed_periods,
        "approved_student_interactions": approved_interactions,
        "feedback_count": feedback_count,
        "feedback_average": feedback_average if feedback_count >= 3 else None,
        "feedback_minimum_met": feedback_count >= 3,
        "feedback_dimensions": dimensions if feedback_count >= 3 else {},
        "notice": "Camera observations are context only. They do not independently decide teaching quality.",
    }


def portal_for_user(session: Session, user: User) -> dict:
    user_deliveries = session.scalars(
        select(NotificationDelivery)
        .where(NotificationDelivery.user_id == user.id, NotificationDelivery.channel == "in_app")
        .order_by(NotificationDelivery.created_at.desc())
        .limit(60)
    ).all()
    base = {
        "announcements": _announcement_rows(session, user),
        "notifications": [
            {
                "id": row.id,
                "channel": row.channel,
                "template": row.template,
                "status": row.status,
                "error": row.error,
                "payload": json.loads(row.payload_json) if row.payload_json else {},
                "created_at": row.created_at.isoformat(),
            }
            for row in user_deliveries
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    if user.role != "student":
        staff_profile = session.scalar(select(StaffProfile).where(StaffProfile.user_id == user.id))
        staff_face = session.scalar(select(StaffFaceEmbedding).where(StaffFaceEmbedding.user_id == user.id))
        identity = session.scalar(select(StaffCareerIdentity).where(StaffCareerIdentity.user_id == user.id))
        career = None
        if identity:
            services = session.execute(
                select(StaffCareerServiceRecord, Institution.name)
                .join(Institution, Institution.id == StaffCareerServiceRecord.institution_id)
                .where(StaffCareerServiceRecord.identity_id == identity.id)
                .order_by(StaffCareerServiceRecord.started_on.desc())
            ).all()
            career = {"platform_staff_id": identity.platform_staff_id, "professional_summary": identity.professional_summary, "verified": identity.verified, "services": [{"id": row.id, "institution": institution_name, "designation": row.designation, "local_employee_id": row.local_employee_id, "started_on": str(row.started_on), "ended_on": str(row.ended_on) if row.ended_on else None, "aggregate_feedback": row.aggregate_feedback, "verified": bool(row.verified_by)} for row, institution_name in services]}
        base.update({
            "teacher_metrics": _teacher_metrics(session, user) if user.role == "teacher" else None,
            "career": career,
            "staff_profile": {
                "designation": staff_profile.designation if staff_profile else user.role,
                "employee_no": staff_profile.employee_no if staff_profile else None,
                "biometric_consent": bool(staff_profile and staff_profile.biometric_consent),
                "face_registered": bool(staff_face and staff_face.enrollment_samples >= settings.face_enrollment_samples),
                "face_samples": staff_face.enrollment_samples if staff_face else 0,
            },
        })
        return base

    student = session.scalar(select(Student).options(selectinload(Student.user)).where(Student.user_id == user.id))
    if not student:
        return {**base, "profile": None}
    profile = _student_profile(session, student)
    membership_row = session.execute(
        select(SectionMembership, ClassSection, AcademicTerm)
        .join(ClassSection, ClassSection.id == SectionMembership.section_id)
        .join(AcademicTerm, AcademicTerm.id == SectionMembership.term_id)
        .where(SectionMembership.student_id == student.id, SectionMembership.active.is_(True))
        .order_by(AcademicTerm.start_date.desc())
    ).first()
    membership, section, term = membership_row if membership_row else (None, None, None)
    fees = session.scalars(select(FeeRecord).where(FeeRecord.student_id == student.id).order_by(FeeRecord.due_date.desc(), FeeRecord.id.desc())).all()
    payments = session.scalars(
        select(FeePayment)
        .where(FeePayment.student_id == student.id)
        .order_by(FeePayment.created_at.desc())
        .limit(100)
    ).all()
    attendance_rows = session.execute(
        select(SessionAttendance, ClassSession, Course.code, Course.title)
        .join(ClassSession, ClassSession.id == SessionAttendance.class_session_id)
        .join(TeacherAssignment, TeacherAssignment.id == ClassSession.assignment_id)
        .join(Course, Course.id == TeacherAssignment.course_id)
        .where(SessionAttendance.student_id == student.id)
        .order_by(ClassSession.session_date.desc(), ClassSession.period_number.desc())
        .limit(120)
    ).all()
    episodes = session.execute(
        select(BehaviourEpisode, Course.code, Course.title)
        .outerjoin(ClassSession, ClassSession.id == BehaviourEpisode.class_session_id)
        .outerjoin(TeacherAssignment, TeacherAssignment.id == ClassSession.assignment_id)
        .outerjoin(Course, Course.id == TeacherAssignment.course_id)
        .where(BehaviourEpisode.student_id == student.id)
        .order_by(BehaviourEpisode.started_at.desc())
        .limit(120)
    ).all()
    presence = session.scalars(select(ClassroomPresenceEvent).where(ClassroomPresenceEvent.student_id == student.id).order_by(ClassroomPresenceEvent.captured_at.desc()).limit(120)).all()
    deliveries = session.scalars(
        select(NotificationDelivery)
        .where(NotificationDelivery.student_id == student.id, NotificationDelivery.channel == "in_app")
        .order_by(NotificationDelivery.created_at.desc())
        .limit(60)
    ).all()
    face = session.scalar(select(FaceEmbedding).where(FaceEmbedding.student_id == student.id))
    timetable = []
    if membership:
        timetable_rows = session.execute(
            select(TimetableSlot, Course.code, Course.title, User.name)
            .join(TeacherAssignment, TeacherAssignment.id == TimetableSlot.assignment_id)
            .join(Course, Course.id == TeacherAssignment.course_id)
            .join(User, User.id == TeacherAssignment.teacher_id)
            .where(
                TimetableSlot.section_id == membership.section_id,
                TeacherAssignment.term_id == membership.term_id,
                TimetableSlot.active.is_(True),
                TimetableSlot.publication_status == "published",
            )
            .order_by(TimetableSlot.weekday, TimetableSlot.period_number)
        ).all()
        timetable = [{"id": row.id, "weekday": row.weekday, "period_number": row.period_number, "start_time": row.start_time.strftime("%H:%M"), "end_time": row.end_time.strftime("%H:%M"), "classroom": row.classroom, "course_code": code, "course_title": title, "teacher_name": teacher_name} for row, code, title, teacher_name in timetable_rows]
    base["announcements"] = _announcement_rows(session, user, student)
    base.update({
        "profile": {"student_id": student.id, "name": student.user.name, "email": student.user.email, "roll_no": student.roll_no, "department": student.department, "section_id": section.id if section else None, "section_name": section.name if section else profile.section_name, "term_id": term.id if term else None, "term_name": term.name if term else profile.current_semester, "phone": profile.phone, "guardian_name": profile.guardian_name, "guardian_phone": profile.guardian_phone, "address": profile.address, "blood_group": profile.blood_group, "date_of_birth": str(profile.date_of_birth) if profile.date_of_birth else None, "admission_number": student.admission_number, "gender": profile.gender, "admission_year": profile.admission_year, "program": profile.program, "admission_batch": profile.admission_batch, "current_academic_year": profile.current_academic_year, "year_of_study": profile.year_of_study, "current_semester": profile.current_semester, "class_name": profile.class_name, "father_name": profile.father_name, "mother_name": profile.mother_name, "admission_status": profile.admission_status, "profile_photo_url": f"/api/students/{student.id}/profile-photo" if profile.profile_photo_storage_key else None, "messaging_consent": profile.messaging_consent, "self_edit_enabled": profile.self_edit_enabled, "guardian_biometric_consent": profile.guardian_biometric_consent, "biometric_consent": student.biometric_consent, "face_samples": face.enrollment_samples if face else 0, "face_registered": bool(face and face.enrollment_samples >= settings.face_enrollment_samples)},
        "fees": [{"id": row.id, "term_label": row.term_label, "description": row.description, "total_amount": row.total_amount, "paid_amount": row.paid_amount, "balance": max(0, row.total_amount - row.paid_amount), "due_date": str(row.due_date) if row.due_date else None, "status": row.status} for row in fees],
        "fee_payments": [{"id": row.id, "fee_record_id": row.fee_record_id, "amount": float(row.amount), "currency": row.currency, "payment_method": row.payment_method, "status": row.status, "gateway_order_id": row.gateway_order_id, "offline_reference": row.offline_reference, "paid_on": str(row.paid_on) if row.paid_on else None, "receipt_file_name": row.receipt_file_name, "review_reason": row.review_reason, "created_at": row.created_at.isoformat(), "paid_at": row.paid_at.isoformat() if row.paid_at else None} for row in payments],
        "attendance": [{"id": row.id, "class_session_id": class_session.id, "date": str(class_session.session_date), "period_number": class_session.period_number, "course_code": code, "course_title": title, "status": row.status, "attendance_percent": row.attendance_percent, "decision_source": row.decision_source} for row, class_session, code, title in attendance_rows],
        "behaviour_episodes": [{"id": row.id, "course_code": code, "course_title": title, "behaviour": row.behaviour, "started_at": row.started_at.isoformat(), "ended_at": row.ended_at.isoformat(), "duration_seconds": round(row.duration_seconds, 1), "average_confidence": round(row.average_confidence, 3), "threshold_seconds": row.threshold_seconds} for row, code, title in episodes],
        "presence_events": [{"id": row.id, "class_session_id": row.class_session_id, "event_type": row.event_type, "captured_at": row.captured_at.isoformat(), "source": row.source, "confidence": row.confidence} for row in presence],
        "notifications": [{"id": row.id, "channel": row.channel, "template": row.template, "status": row.status, "error": row.error, "payload": json.loads(row.payload_json) if row.payload_json else {}, "created_at": row.created_at.isoformat()} for row in deliveries],
        "timetable": timetable,
    })
    return base


def academic_catalog(session: Session, institution_id: int) -> dict:
    terms = session.scalars(select(AcademicTerm).where(AcademicTerm.institution_id == institution_id).order_by(AcademicTerm.start_date.desc())).all()
    sections = session.scalars(select(ClassSection).where(ClassSection.institution_id == institution_id).order_by(ClassSection.department, ClassSection.name)).all()
    teachers = session.scalars(select(User).where(User.institution_id == institution_id, User.role == "teacher", User.active.is_(True)).order_by(User.name)).all()
    assignments = session.execute(
        select(TeacherAssignment, User.name, Course.title, Course.code, ClassSection.name, AcademicTerm.name)
        .join(User, User.id == TeacherAssignment.teacher_id)
        .join(Course, Course.id == TeacherAssignment.course_id)
        .join(ClassSection, ClassSection.id == TeacherAssignment.section_id)
        .join(AcademicTerm, AcademicTerm.id == TeacherAssignment.term_id)
        .where(Course.institution_id == institution_id, ClassSection.institution_id == institution_id, TeacherAssignment.active.is_(True))
        .order_by(Course.code, ClassSection.name)
    ).all()
    slots = session.execute(
        select(TimetableSlot, Course.code, ClassSection.name, User.name)
        .join(TeacherAssignment, TeacherAssignment.id == TimetableSlot.assignment_id)
        .join(Course, Course.id == TeacherAssignment.course_id)
        .join(ClassSection, ClassSection.id == TimetableSlot.section_id)
        .join(User, User.id == TeacherAssignment.teacher_id)
        .where(Course.institution_id == institution_id, ClassSection.institution_id == institution_id)
        .order_by(TimetableSlot.weekday, TimetableSlot.period_number)
    ).all()
    units = session.execute(select(SyllabusUnit, Course.code).join(Course, Course.id == SyllabusUnit.course_id).where(Course.institution_id == institution_id).order_by(Course.code, SyllabusUnit.sequence_no)).all()
    departments = session.scalars(select(Department).where(Department.institution_id == institution_id, Department.active.is_(True)).order_by(Department.code)).all()
    return {
        "departments": [{"id": row.id, "name": row.name, "code": row.code, "email_domain": row.email_domain, "email_domain_configured": not row.email_domain.endswith(".invalid"), "active": row.active} for row in departments],
        "terms": [{"id": row.id, "name": row.name, "academic_year": row.academic_year, "start_date": str(row.start_date), "end_date": str(row.end_date), "active": row.active} for row in terms],
        "sections": [{"id": row.id, "name": row.name, "department": row.department, "semester": row.semester, "batch_year": row.batch_year, "active": row.active} for row in sections],
        "teachers": [public_user(row, session) for row in teachers],
        "courses": list_courses(session, institution_id),
        "assignments": [{"id": row.id, "teacher_id": row.teacher_id, "course_id": row.course_id, "section_id": row.section_id, "term_id": row.term_id, "teacher_name": teacher_name, "course_title": course_title, "course_code": course_code, "section_name": section_name, "term_name": term_name} for row, teacher_name, course_title, course_code, section_name, term_name in assignments],
        "timetable": [{"id": row.id, "assignment_id": row.assignment_id, "weekday": row.weekday, "period_number": row.period_number, "start_time": row.start_time.strftime("%H:%M"), "end_time": row.end_time.strftime("%H:%M"), "classroom": row.classroom, "course_code": course_code, "section_name": section_name, "teacher_name": teacher_name, "effective_from": str(row.effective_from), "effective_to": str(row.effective_to), "publication_status": row.publication_status, "proposed_by": row.proposed_by, "approved_by": row.approved_by, "review_reason": row.review_reason} for row, course_code, section_name, teacher_name in slots],
        "units": [{"id": row.id, "course_id": row.course_id, "course_code": code, "title": row.title, "sequence_no": row.sequence_no} for row, code in units],
    }


def academic_workspace(session: Session, user: User) -> dict:
    assignment_filter = [Course.institution_id == user.institution_id, ClassSection.institution_id == user.institution_id, TeacherAssignment.active.is_(True)]
    section_ids: list[int] | None = None
    membership_pairs: list[tuple[int, int]] = []
    if user.role in {"teacher", "staff"}:
        assignment_filter.append(TeacherAssignment.teacher_id == user.id)
    elif user.role == "student":
        student = session.scalar(select(Student).where(Student.user_id == user.id))
        memberships = session.scalars(select(SectionMembership).where(SectionMembership.student_id == student.id, SectionMembership.active.is_(True))).all() if student else []
        membership_pairs = [(membership.section_id, membership.term_id) for membership in memberships]
        section_ids = list({section_id for section_id, _ in membership_pairs})
        if membership_pairs:
            assignment_filter.append(or_(*(and_(TeacherAssignment.section_id == section_id, TeacherAssignment.term_id == term_id) for section_id, term_id in membership_pairs)))
        else:
            enrolled_course_ids = session.scalars(select(Enrollment.course_id).where(Enrollment.student_id == student.id)).all() if student else []
            assignment_filter.append(TeacherAssignment.course_id.in_(enrolled_course_ids or [-1]))

    assignment_rows = session.execute(
        select(TeacherAssignment, Course, ClassSection, User.name)
        .join(Course, Course.id == TeacherAssignment.course_id)
        .join(ClassSection, ClassSection.id == TeacherAssignment.section_id)
        .join(User, User.id == TeacherAssignment.teacher_id)
        .where(*assignment_filter)
        .order_by(Course.code, ClassSection.name)
    ).all()
    assignment_ids = [row.id for row, _, _, _ in assignment_rows]
    record_assignment_ids = assignment_ids
    if user.role == "student" and membership_pairs:
        record_assignment_ids = session.scalars(
            select(TeacherAssignment.id)
            .join(Course, Course.id == TeacherAssignment.course_id)
            .where(
                Course.institution_id == user.institution_id,
                or_(*(and_(TeacherAssignment.section_id == section_id, TeacherAssignment.term_id == term_id) for section_id, term_id in membership_pairs)),
            )
        ).all()
    course_ids = list({course.id for _, course, _, _ in assignment_rows})
    visible_section_ids = list({section.id for _, _, section, _ in assignment_rows})

    sessions = session.execute(
        select(ClassSession, Course.code, Course.title, ClassSection.name, User.name)
        .join(TeacherAssignment, TeacherAssignment.id == ClassSession.assignment_id)
        .join(Course, Course.id == TeacherAssignment.course_id)
        .join(ClassSection, ClassSection.id == ClassSession.section_id)
        .join(User, User.id == TeacherAssignment.teacher_id)
        .where(ClassSession.assignment_id.in_(record_assignment_ids or [-1]))
        .order_by(ClassSession.session_date.desc(), ClassSession.period_number)
        .limit(80)
    ).all()
    topics = session.execute(
        select(SyllabusTopic, SyllabusUnit, Course.code)
        .join(SyllabusUnit, SyllabusUnit.id == SyllabusTopic.unit_id)
        .join(Course, Course.id == SyllabusUnit.course_id)
        .where(SyllabusUnit.course_id.in_(course_ids or [-1]))
        .order_by(Course.code, SyllabusUnit.sequence_no, SyllabusTopic.sequence_no)
    ).all()
    assessment_filter = [Assessment.status.in_(["published", "completed"])] if user.role == "student" else []
    if user.role == "student":
        assessment_filter.append(Assessment.teacher_assignment_id.in_(record_assignment_ids or [-1]))
    elif user.role in {"teacher", "staff"}:
        assessment_filter.append(Assessment.teacher_assignment_id.in_(assignment_ids or [-1]))
    assessments = session.execute(
        select(Assessment, Course.code, ClassSection.name)
        .join(Course, Course.id == Assessment.course_id)
        .join(ClassSection, ClassSection.id == Assessment.section_id)
        .where(Assessment.course_id.in_(course_ids or [-1]), Assessment.section_id.in_(visible_section_ids or [-1]), *assessment_filter)
        .order_by(Assessment.scheduled_at.desc())
    ).all()
    coursework_filter = [LearningAssignment.status == "published"] if user.role == "student" else []
    coursework_rows = session.execute(
        select(LearningAssignment, Course.code, ClassSection.name, User.name)
        .join(Course, Course.id == LearningAssignment.course_id)
        .join(ClassSection, ClassSection.id == LearningAssignment.section_id)
        .join(TeacherAssignment, TeacherAssignment.id == LearningAssignment.teacher_assignment_id)
        .join(User, User.id == TeacherAssignment.teacher_id)
        .where(LearningAssignment.teacher_assignment_id.in_(assignment_ids or [-1]), *coursework_filter)
        .order_by(LearningAssignment.due_at.desc())
    ).all()
    completed_topics = sum(topic.status == "completed" for topic, _, _ in topics)
    total_topics = len(topics)
    completed_sessions = sum(row.status == "completed" for row, *_ in sessions)
    scheduled_sessions = sum(row.status == "scheduled" for row, *_ in sessions)
    return {
        "summary": {"assignments": len(assignment_rows), "topics_total": total_topics, "topics_completed": completed_topics, "coverage_percent": round(100 * completed_topics / total_topics) if total_topics else 0, "classes_completed": completed_sessions, "classes_scheduled": scheduled_sessions},
        "assignments": [{"id": row.id, "course_id": course.id, "course_code": course.code, "course_title": course.title, "section_id": section.id, "section_name": section.name, "teacher_name": teacher_name} for row, course, section, teacher_name in assignment_rows],
        "sessions": [{"id": row.id, "assignment_id": row.assignment_id, "section_id": row.section_id, "date": str(row.session_date), "period_number": row.period_number, "classroom": row.temporary_classroom or row.classroom, "scheduled_classroom": row.classroom, "temporary_classroom": row.temporary_classroom, "status": row.status, "attendance_state": row.attendance_state, "attendance_published_at": row.attendance_published_at.isoformat() if row.attendance_published_at else None, "camera_state": row.camera_state, "failure_reason": row.failure_reason, "teacher_notes": row.teacher_notes, "course_code": code, "course_title": title, "section_name": section_name, "teacher_name": teacher_name} for row, code, title, section_name, teacher_name in sessions],
        "topics": [{"id": topic.id, "unit_id": unit.id, "course_id": unit.course_id, "course_code": code, "unit_title": unit.title, "title": topic.title, "planned_date": str(topic.planned_date) if topic.planned_date else None, "planned_periods": topic.planned_periods, "status": topic.status, "coverage_percent": topic.coverage_percent} for topic, unit, code in topics],
        "assessments": [_assessment_workspace_row(session, user, row, code, section_name) for row, code, section_name in assessments],
        "coursework": [_coursework_workspace_row(session, user, row, code, section_name, teacher_name) for row, code, section_name, teacher_name in coursework_rows],
    }


def _assessment_workspace_row(session: Session, user: User, row: Assessment, code: str, section_name: str) -> dict:
    data = {"id": row.id, "teacher_assignment_id": row.teacher_assignment_id, "course_id": row.course_id, "section_id": row.section_id, "title": row.title, "instructions": row.instructions, "mode": row.mode, "scheduled_at": row.scheduled_at.isoformat(), "available_until": row.available_until.isoformat() if row.available_until else None, "duration_minutes": row.duration_minutes, "total_marks": row.total_marks, "question_count": row.question_count, "marking_mode": row.marking_mode, "common_marks": row.common_marks, "show_correct_answers": row.show_correct_answers, "status": row.status, "course_code": code, "section_name": section_name}
    if user.role == "student":
        student = session.scalar(select(Student).where(Student.user_id == user.id))
        attempt = session.scalar(select(AssessmentAttempt).where(AssessmentAttempt.assessment_id == row.id, AssessmentAttempt.student_id == student.id)) if student else None
        result = session.scalar(select(AssessmentResult).where(AssessmentResult.assessment_id == row.id, AssessmentResult.student_id == student.id)) if student else None
        data.update({"attempt_status": attempt.status if attempt else None, "result_score": result.marks if result else None})
    else:
        data["questions_added"] = session.scalar(select(func.count()).select_from(Question).where(Question.assessment_id == row.id)) or 0
    return data


def _coursework_workspace_row(session: Session, user: User, row: LearningAssignment, code: str, section_name: str, teacher_name: str) -> dict:
    data = {"id": row.id, "teacher_assignment_id": row.teacher_assignment_id, "course_id": row.course_id, "section_id": row.section_id, "term_id": row.term_id, "title": row.title, "instructions": row.instructions, "due_at": row.due_at.isoformat(), "max_marks": row.max_marks, "status": row.status, "course_code": code, "section_name": section_name, "teacher_name": teacher_name}
    if user.role == "student":
        student = session.scalar(select(Student).where(Student.user_id == user.id))
        submission = session.scalar(select(LearningSubmission).where(LearningSubmission.learning_assignment_id == row.id, LearningSubmission.student_id == student.id)) if student else None
        attachments = session.scalars(select(LearningSubmissionAttachment).where(LearningSubmissionAttachment.submission_id == submission.id).order_by(LearningSubmissionAttachment.id)).all() if submission else []
        data.update({"submission_id": submission.id if submission else None, "submission_status": submission.status if submission else None, "submitted_at": submission.submitted_at.isoformat() if submission else None, "marks": submission.marks if submission else None, "feedback": submission.feedback if submission else None, "attachments": [{"id": attachment.id, "file_name": attachment.file_name, "mime_type": attachment.mime_type, "size_bytes": attachment.size_bytes} for attachment in attachments]})
    else:
        data["submission_count"] = session.scalar(select(func.count()).select_from(LearningSubmission).where(LearningSubmission.learning_assignment_id == row.id)) or 0
    return data


def save_embedding(student_id: int, embedding: list[float]) -> int:
    with session_scope() as session:
        row = session.scalar(select(FaceEmbedding).where(FaceEmbedding.student_id == student_id))
        if row:
            previous = decrypt_embedding(row.encrypted_embedding)
            count = row.enrollment_samples
            averaged = [((old * count) + new) / (count + 1) for old, new in zip(previous, embedding)]
            magnitude = math.sqrt(sum(value * value for value in averaged)) or 1
            row.encrypted_embedding = encrypt_embedding([value / magnitude for value in averaged])
            row.enrollment_samples += 1
            row.updated_at = datetime.now(timezone.utc)
        else:
            session.add(FaceEmbedding(student_id=student_id, encrypted_embedding=encrypt_embedding(embedding)))
            return 1
        return row.enrollment_samples


def save_staff_embedding(user_id: int, embedding: list[float]) -> int:
    with session_scope() as session:
        row = session.scalar(select(StaffFaceEmbedding).where(StaffFaceEmbedding.user_id == user_id))
        if row:
            previous = decrypt_embedding(row.encrypted_embedding)
            count = row.enrollment_samples
            averaged = [((old * count) + new) / (count + 1) for old, new in zip(previous, embedding)]
            magnitude = math.sqrt(sum(value * value for value in averaged)) or 1
            row.encrypted_embedding = encrypt_embedding([value / magnitude for value in averaged])
            row.enrollment_samples += 1
            row.updated_at = datetime.now(timezone.utc)
        else:
            session.add(StaffFaceEmbedding(user_id=user_id, encrypted_embedding=encrypt_embedding(embedding)))
            return 1
        return row.enrollment_samples


def load_embeddings(institution_id: int, include_incomplete: bool = False) -> list[dict]:
    with SessionLocal() as session:
        student_rows = session.execute(
            select(FaceEmbedding, User.name)
            .join(Student, Student.id == FaceEmbedding.student_id)
            .join(User, User.id == Student.user_id)
            .where(Student.institution_id == institution_id, Student.biometric_consent.is_(True), FaceEmbedding.enrollment_samples >= (1 if include_incomplete else settings.face_enrollment_samples))
        ).all()
        staff_rows = session.execute(
            select(StaffFaceEmbedding, User, StaffProfile)
            .join(User, User.id == StaffFaceEmbedding.user_id)
            .join(StaffProfile, StaffProfile.user_id == User.id)
            .where(User.institution_id == institution_id, User.active.is_(True), StaffProfile.active.is_(True), StaffProfile.biometric_consent.is_(True), StaffFaceEmbedding.enrollment_samples >= (1 if include_incomplete else settings.face_enrollment_samples))
        ).all()
        students = [{"entity_type": "student", "student_id": row.student_id, "user_id": None, "role": "student", "designation": "student", "name": name, "enrollment_samples": row.enrollment_samples, "embedding": decrypt_embedding(row.encrypted_embedding)} for row, name in student_rows]
        staff = [{"entity_type": "staff", "student_id": None, "user_id": user.id, "role": user.role, "designation": profile.designation, "name": user.name, "enrollment_samples": row.enrollment_samples, "embedding": decrypt_embedding(row.encrypted_embedding)} for row, user, profile in staff_rows]
        return students + staff


def touch_biometric(entity_type: str, entity_id: int) -> None:
    with session_scope() as session:
        if entity_type == "student":
            row = session.scalar(select(FaceEmbedding).where(FaceEmbedding.student_id == entity_id))
        else:
            row = session.scalar(select(StaffFaceEmbedding).where(StaffFaceEmbedding.user_id == entity_id))
        if row:
            row.last_used_at = datetime.now(timezone.utc)


def save_behaviour_sample(
    label: str,
    features: list[float],
    actor_user_id: int | None,
    *,
    dataset_version: str,
    subject_key: str,
    session_key: str,
    camera_key: str,
    track_id: str,
    consent_verified: bool,
) -> None:
    with session_scope() as session:
        session.add(BehaviourSample(
            label=label,
            features_json=json.dumps(features),
            dataset_version=dataset_version,
            subject_key=subject_key,
            session_key=session_key,
            camera_key=camera_key,
            track_id=track_id,
            review_status="approved",
            consent_verified=consent_verified,
            captured_by=actor_user_id,
        ))


def list_behaviour_samples(dataset_version: str | None = None) -> list[dict]:
    with SessionLocal() as session:
        statement = select(BehaviourSample).where(
            BehaviourSample.review_status == "approved",
            BehaviourSample.consent_verified.is_(True),
            BehaviourSample.subject_key.is_not(None),
            BehaviourSample.session_key.is_not(None),
            BehaviourSample.camera_key.is_not(None),
        )
        if dataset_version:
            statement = statement.where(BehaviourSample.dataset_version == dataset_version)
        rows = session.scalars(statement.order_by(BehaviourSample.id)).all()
        return [{
            "id": row.id,
            "label": row.label,
            "features": json.loads(row.features_json),
            "dataset_version": row.dataset_version,
            "subject_key": row.subject_key,
            "session_key": row.session_key,
            "camera_key": row.camera_key,
            "track_id": row.track_id,
        } for row in rows]


def register_behaviour_model_candidate(
    *,
    version: str,
    dataset_version: str,
    model_path: str,
    sha256: str,
    samples: int,
    groups: int,
    metrics: dict,
    created_by: int | None,
) -> dict:
    with session_scope() as session:
        row = BehaviourModelVersion(
            version=version,
            dataset_version=dataset_version,
            status="candidate",
            model_path=model_path,
            sha256=sha256,
            samples=samples,
            groups=groups,
            accuracy=float(metrics.get("accuracy", 0)),
            macro_precision=float(metrics.get("macro_precision", 0)),
            macro_recall=float(metrics.get("macro_recall", 0)),
            macro_f1=float(metrics.get("macro_f1", 0)),
            metrics_json=json.dumps(metrics),
            created_by=created_by,
        )
        session.add(row)
        session.flush()
        return {"id": row.id, "version": row.version, "status": row.status}


def list_behaviour_model_versions(session: Session) -> list[dict]:
    rows = session.scalars(select(BehaviourModelVersion).order_by(BehaviourModelVersion.created_at.desc())).all()
    return [behaviour_model_version_payload(row) for row in rows]


def behaviour_model_version_payload(row: BehaviourModelVersion) -> dict:
    return {
        "id": row.id,
        "version": row.version,
        "dataset_version": row.dataset_version,
        "status": row.status,
        "sha256": row.sha256,
        "samples": row.samples,
        "groups": row.groups,
        "accuracy": row.accuracy,
        "macro_precision": row.macro_precision,
        "macro_recall": row.macro_recall,
        "macro_f1": row.macro_f1,
        "metrics": json.loads(row.metrics_json),
        "created_at": row.created_at.isoformat(),
        "promoted_at": row.promoted_at.isoformat() if row.promoted_at else None,
    }


def _class_duration_seconds(session: Session, class_session: ClassSession) -> float:
    slot = session.get(TimetableSlot, class_session.timetable_slot_id) if class_session.timetable_slot_id else None
    if slot:
        start = datetime.combine(class_session.session_date, slot.start_time)
        end = datetime.combine(class_session.session_date, slot.end_time)
        return max(60.0, (end - start).total_seconds())
    if class_session.actual_start and class_session.actual_end:
        return max(60.0, (class_session.actual_end - class_session.actual_start).total_seconds())
    return 3600.0


def _student_belongs_to_class_session(session: Session, class_session: ClassSession, student_id: int) -> bool:
    assignment = session.get(TeacherAssignment, class_session.assignment_id)
    if not assignment:
        return False
    return bool(
        session.scalar(
            select(SectionMembership.id).where(
                SectionMembership.student_id == student_id,
                SectionMembership.section_id == class_session.section_id,
                SectionMembership.term_id == assignment.term_id,
                SectionMembership.active.is_(True),
            )
        )
    )


def student_in_class_session(class_session_id: int, student_id: int) -> bool:
    with SessionLocal() as session:
        class_session = session.get(ClassSession, class_session_id)
        return bool(class_session and _student_belongs_to_class_session(session, class_session, student_id))


def active_class_session_for_room(
    session: Session,
    institution_id: int,
    classroom: str,
    local_now: datetime,
    actor_id: int | None = None,
) -> ClassSession | None:
    """Resolve a camera to the class currently scheduled in its room.

    A browser/mobile stream should identify a physical room only. The server
    chooses the active timetable period using the campus timezone, so a stale
    period selected in a browser cannot send attendance to the wrong class.
    """
    room = classroom.strip()
    wall_time = local_now.time().replace(tzinfo=None)
    base_filters = (
        Course.institution_id == institution_id,
        User.institution_id == institution_id,
        ClassSession.session_date == local_now.date(),
        ClassSession.attendance_state != "published",
        ClassSession.status.in_(("scheduled", "in_progress")),
        TimetableSlot.active.is_(True),
        TimetableSlot.publication_status == "published",
        TimetableSlot.start_time <= wall_time,
        TimetableSlot.end_time >= wall_time,
        or_(
            ClassSession.temporary_classroom == room,
            and_(ClassSession.temporary_classroom.is_(None), TimetableSlot.classroom == room),
        ),
    )
    class_session = session.scalar(
        select(ClassSession)
        .join(TimetableSlot, TimetableSlot.id == ClassSession.timetable_slot_id)
        .join(TeacherAssignment, TeacherAssignment.id == ClassSession.assignment_id)
        .join(Course, Course.id == TeacherAssignment.course_id)
        .join(User, User.id == TeacherAssignment.teacher_id)
        .where(*base_filters)
        .order_by(ClassSession.period_number)
    )
    if class_session:
        if class_session.status == "scheduled":
            class_session.status = "in_progress"
            class_session.actual_start = class_session.actual_start or datetime.now(timezone.utc)
        class_session.camera_state = "online"
        class_session.failure_reason = None
        return class_session

    slot = session.scalar(
        select(TimetableSlot)
        .join(TeacherAssignment, TeacherAssignment.id == TimetableSlot.assignment_id)
        .join(Course, Course.id == TeacherAssignment.course_id)
        .join(User, User.id == TeacherAssignment.teacher_id)
        .where(
            Course.institution_id == institution_id,
            User.institution_id == institution_id,
            TimetableSlot.classroom == room,
            TimetableSlot.weekday == local_now.weekday(),
            TimetableSlot.start_time <= wall_time,
            TimetableSlot.end_time >= wall_time,
            TimetableSlot.effective_from <= local_now.date(),
            TimetableSlot.effective_to >= local_now.date(),
            TimetableSlot.active.is_(True),
            TimetableSlot.publication_status == "published",
            TeacherAssignment.active.is_(True),
        )
        .order_by(TimetableSlot.period_number)
    )
    if not slot:
        return None
    assignment = session.get(TeacherAssignment, slot.assignment_id)
    if not assignment or not assignment.active:
        return None
    class_session = session.scalar(
        select(ClassSession).where(
            ClassSession.section_id == slot.section_id,
            ClassSession.session_date == local_now.date(),
            ClassSession.period_number == slot.period_number,
        )
    )
    if not class_session:
        class_session = ClassSession(
            assignment_id=assignment.id,
            timetable_slot_id=slot.id,
            section_id=slot.section_id,
            session_date=local_now.date(),
            period_number=slot.period_number,
            classroom=slot.classroom,
            status="in_progress",
            attendance_state="draft",
            camera_state="online",
            actual_start=datetime.now(timezone.utc),
            created_by=actor_id or assignment.teacher_id,
        )
        session.add(class_session)
        session.flush()
    elif class_session.status == "scheduled":
        class_session.status = "in_progress"
        class_session.actual_start = class_session.actual_start or datetime.now(timezone.utc)
        class_session.camera_state = "online"
        class_session.failure_reason = None
    return class_session


def mark_attendance(student_id: int, confidence: float, class_session_id: int | None = None) -> dict:
    outcome = {"newly_present": False, "status": "Unlinked", "attendance_percent": 0.0}
    with session_scope() as session:
        if class_session_id:
            session_row = session.get(ClassSession, class_session_id)
            if session_row:
                if not _student_belongs_to_class_session(session, session_row, student_id):
                    return {"newly_present": False, "status": "Not assigned to this class", "attendance_percent": 0.0}
                student = session.get(Student, student_id)
                institution = session.get(Institution, student.institution_id) if student else None
                now = datetime.now(timezone.utc)
                total_seconds = _class_duration_seconds(session, session_row)
                required_percent = institution.attendance_required_percent if institution else 80
                required_seconds = total_seconds * required_percent / 100
                class_row = session.scalar(select(SessionAttendance).where(SessionAttendance.class_session_id == class_session_id, SessionAttendance.student_id == student_id))
                if class_row:
                    class_row.confidence = max(class_row.confidence, confidence)
                    previous = class_row.last_seen_at
                    if previous and previous.tzinfo is None:
                        previous = previous.replace(tzinfo=timezone.utc)
                    gap_limit = max(1, settings.attendance_presence_gap_seconds)
                    raw_elapsed = max((now - previous).total_seconds(), 0) if previous else 0
                    elapsed = min(raw_elapsed, gap_limit) if previous else 2
                    if class_row.decision_source == "camera":
                        class_row.observed_seconds = min(total_seconds, class_row.observed_seconds + elapsed)
                        if previous and raw_elapsed > gap_limit:
                            # Keep a physical entry/exit history while still
                            # crediting at most the configured absence gap.
                            exit_at = previous + timedelta(seconds=gap_limit)
                            session.add(
                                ClassroomPresenceEvent(
                                    institution_id=student.institution_id,
                                    class_session_id=class_session_id,
                                    student_id=student_id,
                                    event_type="exit",
                                    source="camera_gap",
                                    confidence=confidence,
                                    captured_at=exit_at,
                                )
                            )
                            session.add(
                                ClassroomPresenceEvent(
                                    institution_id=student.institution_id,
                                    class_session_id=class_session_id,
                                    student_id=student_id,
                                    event_type="entry",
                                    source="camera_reentry",
                                    confidence=confidence,
                                    captured_at=now,
                                )
                            )
                else:
                    class_row = SessionAttendance(class_session_id=class_session_id, student_id=student_id, status="Tracking", confidence=confidence, first_seen_at=now, observed_seconds=2, decision_source="camera")
                    session.add(class_row)
                    if student:
                        session.add(ClassroomPresenceEvent(institution_id=student.institution_id, class_session_id=class_session_id, student_id=student_id, event_type="entry", source="camera", confidence=confidence, captured_at=now))
                class_row.last_seen_at = now
                class_row.required_seconds = required_seconds
                class_row.attendance_percent = round(100 * class_row.observed_seconds / total_seconds, 2)
                previously_present = class_row.status == "Present"
                if class_row.decision_source != "camera" or class_row.observed_seconds >= required_seconds:
                    class_row.status = "Present"
                outcome = {"newly_present": class_row.status == "Present" and not previously_present, "status": class_row.status, "attendance_percent": class_row.attendance_percent}
                if class_row.status == "Present":
                    row = session.scalar(select(Attendance).where(Attendance.student_id == student_id, Attendance.class_date == session_row.session_date))
                    if row:
                        row.status = "Present"
                        row.confidence = max(row.confidence, confidence)
                    else:
                        session.add(Attendance(student_id=student_id, class_date=session_row.session_date, status="Present", confidence=confidence))
        return outcome


def mark_staff_presence(institution_id: int, user_id: int, confidence: float, class_session_id: int | None = None) -> None:
    if not class_session_id:
        return
    with session_scope() as session:
        class_session = session.get(ClassSession, class_session_id)
        user = session.get(User, user_id)
        if not class_session or not user or user.institution_id != institution_id:
            return
        now = datetime.now(timezone.utc)
        last = session.scalar(
            select(ClassroomPresenceEvent)
            .where(
                ClassroomPresenceEvent.class_session_id == class_session_id,
                ClassroomPresenceEvent.staff_user_id == user_id,
                ClassroomPresenceEvent.event_type == "seen",
            )
            .order_by(ClassroomPresenceEvent.captured_at.desc())
        )
        last_at = last.captured_at if last else None
        if last_at and last_at.tzinfo is None:
            last_at = last_at.replace(tzinfo=timezone.utc)
        if not last_at or (now - last_at).total_seconds() >= 60:
            session.add(ClassroomPresenceEvent(institution_id=institution_id, class_session_id=class_session_id, staff_user_id=user_id, event_type="seen", source="camera", confidence=confidence, captured_at=now))


def override_session_attendance(class_session_id: int, student_id: int, actor_id: int, decision_source: str, reason: str, audit_action: str | None = None) -> dict:
    with session_scope() as session:
        class_session = session.get(ClassSession, class_session_id)
        if not class_session:
            raise ValueError("Class session not found")
        if not _student_belongs_to_class_session(session, class_session, student_id):
            raise ValueError("Student is not assigned to this class and academic term")
        now = datetime.now(timezone.utc)
        row = session.scalar(select(SessionAttendance).where(SessionAttendance.class_session_id == class_session_id, SessionAttendance.student_id == student_id))
        already_approved = bool(row and row.status == "Present" and row.decision_source == decision_source and row.approved_by == actor_id)
        if not row:
            row = SessionAttendance(class_session_id=class_session_id, student_id=student_id, confidence=0)
            session.add(row)
        row.status = "Present"
        row.decision_source = decision_source
        row.exemption_reason = reason
        row.approved_by = actor_id
        row.approved_at = now
        row.marked_at = now
        daily = session.scalar(select(Attendance).where(Attendance.student_id == student_id, Attendance.class_date == class_session.session_date))
        if daily:
            daily.status = "Present"
        else:
            session.add(Attendance(student_id=student_id, class_date=class_session.session_date, status="Present", confidence=0))
        if audit_action and not already_approved:
            write_audit(session, actor_id, audit_action, "class_session", class_session_id, {"student_id": student_id, "decision_source": decision_source, "reason": reason})
        return {"student_id": student_id, "status": row.status, "decision_source": decision_source, "reason": reason, "newly_approved": not already_approved}


def create_raised_hand_request(institution_id: int, class_session_id: int, student_id: int, teacher_user_id: int, evidence_reference: str | None = None) -> dict:
    with session_scope() as session:
        class_session = session.get(ClassSession, class_session_id)
        assignment = session.get(TeacherAssignment, class_session.assignment_id) if class_session else None
        if not class_session or not assignment or assignment.teacher_id != teacher_user_id or not _student_belongs_to_class_session(session, class_session, student_id):
            return {"created": False, "reason": "gesture does not match the assigned class"}
        existing = session.scalar(select(RaisedHandAttendanceRequest).where(RaisedHandAttendanceRequest.class_session_id == class_session_id, RaisedHandAttendanceRequest.student_id == student_id, RaisedHandAttendanceRequest.status == "pending"))
        if existing:
            return {"created": False, "request_id": existing.id, "status": existing.status}
        row = RaisedHandAttendanceRequest(institution_id=institution_id, class_session_id=class_session_id, student_id=student_id, teacher_user_id=teacher_user_id, evidence_reference=evidence_reference)
        session.add(row)
        session.flush()
        write_audit(session, teacher_user_id, "attendance.raised_hand_detected", "raised_hand_request", row.id, {"student_id": student_id, "class_session_id": class_session_id})
        return {"created": True, "request_id": row.id, "status": row.status}


def add_notification(
    session: Session,
    *,
    institution_id: int,
    user_id: int | None,
    student_id: int | None,
    template: str,
    message: str,
    dedup_key: str,
    deep_link: str | None = None,
    push_category: str = "attendance",
) -> NotificationDelivery:
    """Create one in-app notification and fan it out to opted-in push devices.

    The database uniqueness constraint makes retries safe across API and camera
    workers. Provider failures are recorded without rolling back core data.
    """
    existing = session.scalar(
        select(NotificationDelivery).where(
            NotificationDelivery.institution_id == institution_id,
            NotificationDelivery.dedup_key == dedup_key,
        )
    )
    if existing:
        return existing
    now = datetime.now(timezone.utc)
    payload = {"message": message}
    if deep_link:
        payload["deep_link"] = deep_link.replace("/portal?", "/?")
    delivery = NotificationDelivery(
        institution_id=institution_id,
        user_id=user_id,
        student_id=student_id,
        channel="in_app",
        template=template,
        status="sent",
        payload_json=json.dumps(payload),
        dedup_key=dedup_key,
        sent_at=now,
    )
    session.add(delivery)
    if not user_id:
        return delivery
    devices = session.scalars(
        select(PushDevice).where(PushDevice.user_id == user_id, PushDevice.active.is_(True))
    ).all()
    for device in devices:
        enabled = device.security_enabled if push_category == "security" else device.attendance_enabled
        if not enabled:
            continue
        from models import PushJob
        queued = NotificationDelivery(
                institution_id=institution_id,
                user_id=user_id,
                student_id=student_id,
                channel="push",
                template=template,
                status="queued",
                payload_json=json.dumps(payload),
                dedup_key=f"{dedup_key}:push:{device.id}",
            )
        session.add(queued)
        session.flush()
        session.add(PushJob(delivery_id=queued.id, device_id=device.id))
    return delivery


def register_push_device(session: Session, user: User, token: str, platform: str, device_label: str | None) -> PushDevice:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    device = session.scalar(select(PushDevice).where(PushDevice.token_hash == token_hash))
    if device and (device.user_id != user.id or device.institution_id != user.institution_id):
        # A push token can belong to only one authenticated user at a time.
        device.user_id = user.id
        device.institution_id = user.institution_id
    if not device:
        device = PushDevice(
            institution_id=user.institution_id,
            user_id=user.id,
            token_hash=token_hash,
            encrypted_token=encrypt_secret(token),
        )
        session.add(device)
    device.encrypted_token = encrypt_secret(token)
    device.platform = platform
    device.device_label = device_label
    device.active = True
    device.last_seen_at = datetime.now(timezone.utc)
    session.flush()
    return device


def update_camera_status(
    institution_id: int,
    camera_key: str,
    classroom: str,
    source_kind: str,
    state: str,
    *,
    class_session_id: int | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    reconnect: bool = False,
    processing_fps: float = 0,
) -> None:
    with session_scope() as session:
        row = session.scalar(
            select(CameraWorkerStatus).where(
                CameraWorkerStatus.institution_id == institution_id,
                CameraWorkerStatus.camera_key == camera_key,
            )
        )
        if not row:
            row = CameraWorkerStatus(
                institution_id=institution_id,
                camera_key=camera_key,
                classroom=classroom,
                source_kind=source_kind,
            )
            session.add(row)
        now = datetime.now(timezone.utc)
        row.classroom = classroom
        row.source_kind = source_kind
        row.state = state
        row.active_class_session_id = class_session_id
        row.last_frame_at = now if state == "online" else row.last_frame_at
        row.last_success_at = now if state == "online" else row.last_success_at
        row.error_code = error_code
        row.error_message = error_message[:1000] if error_message else None
        row.reconnect_count += 1 if reconnect else 0
        row.processing_fps = processing_fps
        row.updated_at = now
        if class_session_id:
            class_session = session.get(ClassSession, class_session_id)
            if class_session:
                class_session.camera_state = state
                class_session.failure_reason = row.error_message if state != "online" else None


def camera_status_for_institution(session: Session, institution_id: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    rows = session.scalars(
        select(CameraWorkerStatus)
        .where(CameraWorkerStatus.institution_id == institution_id)
        .order_by(CameraWorkerStatus.classroom, CameraWorkerStatus.camera_key)
    ).all()
    result = []
    for row in rows:
        last_frame = row.last_frame_at
        if last_frame and last_frame.tzinfo is None:
            last_frame = last_frame.replace(tzinfo=timezone.utc)
        stale = bool(last_frame and (now - last_frame).total_seconds() > settings.camera_health_timeout_seconds)
        state = "offline" if stale and row.state == "online" else row.state
        result.append({
            "id": row.id,
            "camera_key": row.camera_key,
            "classroom": row.classroom,
            "source_kind": row.source_kind,
            "state": state,
            "active_class_session_id": row.active_class_session_id,
            "last_frame_at": row.last_frame_at.isoformat() if row.last_frame_at else None,
            "last_success_at": row.last_success_at.isoformat() if row.last_success_at else None,
            "error_code": row.error_code,
            "error_message": row.error_message,
            "reconnect_count": row.reconnect_count,
            "processing_fps": round(row.processing_fps, 2),
        })
    return result


def record_classroom_change(session: Session, class_session: ClassSession, classroom: str, reason: str, actor_id: int, institution_id: int) -> ClassroomChange:
    previous = class_session.temporary_classroom or class_session.classroom
    change = session.scalar(select(ClassroomChange).where(ClassroomChange.class_session_id == class_session.id))
    if not change:
        change = ClassroomChange(
            institution_id=institution_id,
            class_session_id=class_session.id,
            previous_classroom=previous,
            new_classroom=classroom,
            reason=reason,
            changed_by=actor_id,
        )
        session.add(change)
    else:
        change.previous_classroom = previous
        change.new_classroom = classroom
        change.reason = reason
        change.changed_by = actor_id
        change.changed_at = datetime.now(timezone.utc)
    class_session.temporary_classroom = classroom
    class_session.camera_state = "awaiting_camera"
    class_session.failure_reason = "Classroom changed; waiting for the camera assigned to the new room"
    write_audit(session, actor_id, "classroom.changed", "class_session", class_session.id, {"from": previous, "to": classroom, "reason": reason})
    return change


def finalize_due_sessions(institution_id: int, local_now: datetime) -> int:
    """Finalize ended timetable periods once; called by the always-on camera worker."""
    cutoff = local_now.time().replace(tzinfo=None)
    with session_scope() as session:
        rows = session.execute(
            select(ClassSession, TimetableSlot, TeacherAssignment)
            .join(TimetableSlot, TimetableSlot.id == ClassSession.timetable_slot_id)
            .join(TeacherAssignment, TeacherAssignment.id == ClassSession.assignment_id)
            .join(User, User.id == TeacherAssignment.teacher_id)
            .where(
                User.institution_id == institution_id,
                ClassSession.session_date == local_now.date(),
                ClassSession.attendance_state != "published",
                TimetableSlot.end_time < cutoff,
            )
        ).all()
        count = 0
        grace = settings.attendance_finalize_grace_seconds
        local_seconds = local_now.hour * 3600 + local_now.minute * 60 + local_now.second
        for class_session, slot, assignment in rows:
            end_seconds = slot.end_time.hour * 3600 + slot.end_time.minute * 60 + slot.end_time.second
            if local_seconds - end_seconds < grace:
                continue
            finalize_session_attendance(session, class_session, assignment.teacher_id)
            count += 1
        return count


def apply_biometric_retention(session: Session, institution_id: int) -> dict:
    institution = session.get(Institution, institution_id)
    if not institution:
        return {"students_deleted": 0, "staff_deleted": 0}
    cutoff = datetime.now(timezone.utc) - timedelta(days=institution.biometric_retention_days)
    student_rows = session.execute(
        select(FaceEmbedding, Student)
        .join(Student, Student.id == FaceEmbedding.student_id)
        .join(User, User.id == Student.user_id)
        .where(
            Student.institution_id == institution_id,
            or_(
                Student.biometric_consent.is_(False),
                User.active.is_(False),
                and_(FaceEmbedding.last_used_at.is_not(None), FaceEmbedding.last_used_at < cutoff),
                and_(FaceEmbedding.last_used_at.is_(None), FaceEmbedding.updated_at < cutoff),
            ),
        )
    ).all()
    staff_rows = session.execute(
        select(StaffFaceEmbedding, User, StaffProfile)
        .join(User, User.id == StaffFaceEmbedding.user_id)
        .join(StaffProfile, StaffProfile.user_id == User.id)
        .where(
            User.institution_id == institution_id,
            or_(
                User.active.is_(False),
                StaffProfile.active.is_(False),
                StaffProfile.biometric_consent.is_(False),
                and_(StaffFaceEmbedding.last_used_at.is_not(None), StaffFaceEmbedding.last_used_at < cutoff),
                and_(StaffFaceEmbedding.last_used_at.is_(None), StaffFaceEmbedding.updated_at < cutoff),
            ),
        )
    ).all()
    for embedding, _student in student_rows:
        session.delete(embedding)
    for embedding, _user, _profile in staff_rows:
        session.delete(embedding)
    return {"students_deleted": len(student_rows), "staff_deleted": len(staff_rows)}


def attendance_preview(session: Session, class_session: ClassSession) -> list[dict]:
    assignment = session.get(TeacherAssignment, class_session.assignment_id)
    term_id = assignment.term_id if assignment else -1
    rows = session.execute(
        select(SectionMembership, Student, User)
        .join(Student, Student.id == SectionMembership.student_id)
        .join(User, User.id == Student.user_id)
        .where(SectionMembership.section_id == class_session.section_id, SectionMembership.term_id == term_id, SectionMembership.active.is_(True))
        .order_by(Student.roll_no)
    ).all()
    result = []
    for _, student, account in rows:
        attendance = session.scalar(select(SessionAttendance).where(SessionAttendance.class_session_id == class_session.id, SessionAttendance.student_id == student.id))
        institution = session.get(Institution, student.institution_id)
        required_percent = institution.attendance_required_percent if institution else 80
        observed_percent = attendance.attendance_percent if attendance else 0
        raised = session.scalar(select(RaisedHandAttendanceRequest).where(RaisedHandAttendanceRequest.class_session_id == class_session.id, RaisedHandAttendanceRequest.student_id == student.id).order_by(RaisedHandAttendanceRequest.detected_at.desc()))
        preview_status = attendance.status if attendance else "Pending"
        if class_session.attendance_state != "published" and attendance and attendance.decision_source == "camera":
            preview_status = "Present" if observed_percent >= required_percent else "Absent"
        result.append({
            "student_id": student.id,
            "student_name": account.name,
            "roll_no": student.roll_no,
            "status": preview_status,
            "attendance_percent": observed_percent,
            "required_percent": required_percent,
            "shortfall_percent": round(max(0, required_percent - observed_percent), 2),
            "observed_seconds": round(attendance.observed_seconds, 1) if attendance else 0,
            "required_seconds": round(attendance.required_seconds, 1) if attendance else 0,
            "first_seen_at": attendance.first_seen_at.isoformat() if attendance and attendance.first_seen_at else None,
            "last_seen_at": attendance.last_seen_at.isoformat() if attendance and attendance.last_seen_at else None,
            "decision_source": attendance.decision_source if attendance else None,
            "raised_hand_request": {"id": raised.id, "status": raised.status, "detected_at": raised.detected_at.isoformat()} if raised else None,
        })
    return result


def finalize_session_attendance(session: Session, class_session: ClassSession, actor_id: int) -> list[dict]:
    if class_session.attendance_state == "published":
        return attendance_preview(session, class_session)
    assignment = session.get(TeacherAssignment, class_session.assignment_id)
    term_id = assignment.term_id if assignment else -1
    course = session.get(Course, assignment.course_id) if assignment else None
    memberships = session.scalars(
        select(SectionMembership).where(
            SectionMembership.section_id == class_session.section_id,
            SectionMembership.term_id == term_id,
            SectionMembership.active.is_(True),
        )
    ).all()
    results = []
    now = datetime.now(timezone.utc)
    camera_failed = class_session.camera_state in {"offline", "failed", "authentication_failed", "configuration_error"}
    any_camera_observation = bool(
        session.scalar(
            select(SessionAttendance.id).where(
                SessionAttendance.class_session_id == class_session.id,
                SessionAttendance.first_seen_at.is_not(None),
            ).limit(1)
        )
    )
    for membership in memberships:
        row = session.scalar(select(SessionAttendance).where(SessionAttendance.class_session_id == class_session.id, SessionAttendance.student_id == membership.student_id))
        if not row:
            # An entirely empty observation window cannot distinguish absence
            # from a disconnected/blocked camera. Keep it reviewable instead
            # of silently penalising every student.
            status_value = "Needs review" if camera_failed or not any_camera_observation else "Absent"
            source_value = "camera_failure_review" if status_value == "Needs review" else "camera"
            row = SessionAttendance(class_session_id=class_session.id, student_id=membership.student_id, status=status_value, confidence=0, decision_source=source_value, marked_at=now)
            session.add(row)
        elif row.decision_source == "camera":
            if camera_failed:
                row.status = "Needs review"
                row.decision_source = "camera_failure_review"
            else:
                row.status = "Present" if row.required_seconds and row.observed_seconds >= row.required_seconds else "Absent"
        student = session.get(Student, membership.student_id)
        account = session.get(User, student.user_id) if student else None
        daily = session.scalar(select(Attendance).where(Attendance.student_id == membership.student_id, Attendance.class_date == class_session.session_date))
        if daily:
            # The legacy daily summary must never turn an already-present day
            # into absent because a later subject period was missed.
            if daily.status != "Present" or row.status == "Present":
                daily.status = row.status
            daily.confidence = max(daily.confidence, row.confidence)
        else:
            session.add(Attendance(student_id=membership.student_id, class_date=class_session.session_date, status=row.status, confidence=row.confidence))
        if student and row.first_seen_at:
            session.add(ClassroomPresenceEvent(institution_id=student.institution_id, class_session_id=class_session.id, student_id=student.id, event_type="exit", source="attendance_finalization", confidence=row.confidence, captured_at=now))
        message = f"Attendance: {row.status} for {course.title if course else 'class'} on {class_session.session_date}, period {class_session.period_number}. Contact the subject teacher if a correction is needed."
        if student:
            add_notification(
                session,
                institution_id=student.institution_id,
                user_id=account.id if account else None,
                student_id=student.id,
                template="attendance_finalized",
                message=message,
                dedup_key=f"attendance-final:{class_session.id}:{student.id}",
                deep_link="/portal?view=attendance",
            )
            profile = session.scalar(select(StudentProfile).where(StudentProfile.student_id == student.id))
            destination = (profile.guardian_phone or profile.phone) if profile and profile.messaging_consent else None
            if destination:
                for channel in ("sms", "whatsapp"):
                    channel_key = f"attendance-final:{class_session.id}:{student.id}:{channel}"
                    if session.scalar(select(NotificationDelivery.id).where(NotificationDelivery.institution_id == student.institution_id, NotificationDelivery.dedup_key == channel_key)):
                        continue
                    delivery_status, provider_id, error = notification_service.send(channel, destination, message)
                    session.add(NotificationDelivery(institution_id=student.institution_id, user_id=account.id if account else None, student_id=student.id, channel=channel, destination_masked=notification_service.mask_destination(destination), template="attendance_finalized", status=delivery_status, provider_message_id=provider_id, error=error, payload_json=json.dumps({"class_session_id": class_session.id, "status": row.status}), dedup_key=channel_key, sent_at=now if delivery_status == "sent" else None))
        results.append({"student_id": membership.student_id, "status": row.status, "attendance_percent": row.attendance_percent, "decision_source": row.decision_source})
    class_session.status = "completed"
    class_session.actual_end = class_session.actual_end or now
    class_session.attendance_state = "published"
    class_session.attendance_published_at = now
    write_audit(session, actor_id, "attendance.finalized", "class_session", class_session.id, {"students": len(results)})
    return results


def correct_session_attendance(
    session: Session,
    class_session: ClassSession,
    student_id: int,
    status_value: str,
    reason: str,
    actor_id: int,
    decision_source: str = "authorised_correction",
) -> dict:
    if not _student_belongs_to_class_session(session, class_session, student_id):
        raise ValueError("Student is not assigned to this class and academic term")
    row = session.scalar(
        select(SessionAttendance).where(
            SessionAttendance.class_session_id == class_session.id,
            SessionAttendance.student_id == student_id,
        )
    )
    if not row:
        row = SessionAttendance(
            class_session_id=class_session.id,
            student_id=student_id,
            status="Not seen",
            confidence=0,
        )
        session.add(row)
        session.flush()
    previous_status = row.status
    previous_source = row.decision_source
    now = datetime.now(timezone.utc)
    row.status = status_value
    row.decision_source = decision_source
    row.exemption_reason = reason
    row.approved_by = actor_id
    row.approved_at = now
    row.marked_at = now
    student = session.get(Student, student_id)
    account = session.get(User, student.user_id) if student else None
    if not student:
        raise ValueError("Student not found")
    correction = AttendanceCorrection(
        institution_id=student.institution_id,
        class_session_id=class_session.id,
        session_attendance_id=row.id,
        student_id=student_id,
        previous_status=previous_status,
        new_status=status_value,
        previous_source=previous_source,
        reason=reason,
        corrected_by=actor_id,
    )
    session.add(correction)
    daily = session.scalar(
        select(Attendance).where(
            Attendance.student_id == student_id,
            Attendance.class_date == class_session.session_date,
        )
    )
    if status_value == "Present":
        daily_status = "Present"
    else:
        daily_status = "Present" if session.scalar(
            select(SessionAttendance.id)
            .join(ClassSession, ClassSession.id == SessionAttendance.class_session_id)
            .where(
                SessionAttendance.student_id == student_id,
                ClassSession.session_date == class_session.session_date,
                ClassSession.id != class_session.id,
                SessionAttendance.status == "Present",
            ).limit(1)
        ) else status_value
    if daily:
        daily.status = daily_status
    else:
        session.add(Attendance(student_id=student_id, class_date=class_session.session_date, status=daily_status, confidence=row.confidence))
    session.flush()
    message = f"Attendance corrected to {status_value} for period {class_session.period_number} on {class_session.session_date}. Reason: {reason}"
    add_notification(
        session,
        institution_id=student.institution_id,
        user_id=account.id if account else None,
        student_id=student_id,
        template="attendance_corrected",
        message=message,
        dedup_key=f"attendance-correction:{correction.id}",
        deep_link="/portal?view=attendance",
    )
    write_audit(session, actor_id, "attendance.corrected", "session_attendance", row.id, {"previous_status": previous_status, "new_status": status_value, "reason": reason})
    return {"student_id": student_id, "status": status_value, "decision_source": row.decision_source, "reason": reason, "correction_id": correction.id}


def record_behaviour_observation(institution_id: int, class_session_id: int | None, student_id: int | None, behaviour: str, confidence: float, seconds: float = 2.0) -> None:
    if not class_session_id or not student_id or behaviour in ("uncertain", "unclassified"):
        return
    with session_scope() as session:
        now = datetime.now(timezone.utc)
        row = session.scalar(select(BehaviourObservation).where(BehaviourObservation.class_session_id == class_session_id, BehaviourObservation.student_id == student_id, BehaviourObservation.behaviour == behaviour))
        if not row:
            row = BehaviourObservation(institution_id=institution_id, class_session_id=class_session_id, student_id=student_id, behaviour=behaviour, sample_count=1, observed_seconds=seconds, average_confidence=confidence, first_seen_at=now, last_seen_at=now)
            session.add(row)
        else:
            total_confidence = row.average_confidence * row.sample_count + confidence
            row.sample_count += 1
            row.observed_seconds += seconds
            row.average_confidence = total_confidence / row.sample_count
            row.last_seen_at = now


def save_behaviour_episode(institution_id: int, class_session_id: int | None, student_id: int | None, behaviour: str, started_at: datetime, ended_at: datetime, average_confidence: float, episode_id: int | None = None) -> int:
    duration = max(0.0, (ended_at - started_at).total_seconds())
    if duration < settings.behaviour_episode_threshold_seconds:
        return 0
    with session_scope() as session:
        row = session.get(BehaviourEpisode, episode_id) if episode_id else session.scalar(select(BehaviourEpisode).where(BehaviourEpisode.institution_id == institution_id, BehaviourEpisode.class_session_id == class_session_id, BehaviourEpisode.student_id == student_id, BehaviourEpisode.behaviour == behaviour, BehaviourEpisode.started_at == started_at))
        if not row:
            row = BehaviourEpisode(institution_id=institution_id, class_session_id=class_session_id, student_id=student_id, behaviour=behaviour, started_at=started_at, ended_at=ended_at, duration_seconds=duration, average_confidence=average_confidence, threshold_seconds=settings.behaviour_episode_threshold_seconds)
            session.add(row)
            session.flush()
        else:
            row.ended_at = ended_at
            row.duration_seconds = duration
            row.average_confidence = average_confidence
        return row.id


def create_incident(institution_id: int, student_id: int | None, classroom_id: str, behaviour: str, confidence: float, class_session_id: int | None = None, duration_seconds: float = 0, alert_triggered: bool = False) -> int:
    with session_scope() as session:
        row = Incident(institution_id=institution_id, student_id=student_id, classroom_id=classroom_id, class_session_id=class_session_id, behaviour=behaviour, confidence=confidence, duration_seconds=duration_seconds, alert_triggered=alert_triggered)
        session.add(row)
        session.flush()
        if alert_triggered:
            recipient_ids = set(session.scalars(select(User.id).where(User.institution_id == institution_id, User.role == "admin", User.active.is_(True))).all())
            if class_session_id:
                class_session = session.get(ClassSession, class_session_id)
                assignment = session.get(TeacherAssignment, class_session.assignment_id) if class_session else None
                if assignment:
                    recipient_ids.add(assignment.teacher_id)
            message = f"Safety alert in {classroom_id}: {behaviour} detected for {round(duration_seconds)} seconds. Human verification is required."
            for user_id in recipient_ids:
                add_notification(session, institution_id=institution_id, user_id=user_id, student_id=None, template="safety_alert", message=message, dedup_key=f"safety-alert:{row.id}:{user_id}", deep_link="/portal?view=monitoring", push_category="security")
            write_audit(session, None, "safety.alert_triggered", "incident", row.id, {"classroom": classroom_id, "behaviour": behaviour, "duration_seconds": duration_seconds}, institution_id=institution_id)
        return row.id


def update_model_meta(samples: int, accuracy: float, metrics: dict) -> None:
    with session_scope() as session:
        row = session.get(ModelMeta, 1) or ModelMeta(id=1)
        row.trained = True
        row.samples = samples
        row.accuracy = accuracy
        row.metrics_json = json.dumps(metrics)
        row.trained_at = datetime.now(timezone.utc)
        session.add(row)


def write_audit(session: Session, actor_user_id: int | None, action: str, entity_type: str, entity_id: int | str | None = None, details: dict | None = None, ip_address: str | None = None, institution_id: int | None = None) -> None:
    actor = session.get(User, actor_user_id) if actor_user_id else None
    tenant_id = institution_id or (actor.institution_id if actor else None)
    if tenant_id is None:
        tenant_id = session.scalar(select(Institution.id).order_by(Institution.id))
    if tenant_id is None:
        raise RuntimeError("Cannot write an audit entry without an institution")
    session.add(AuditLog(institution_id=tenant_id, actor_user_id=actor_user_id, action=action, entity_type=entity_type, entity_id=str(entity_id) if entity_id is not None else None, details_json=json.dumps(details) if details else None, ip_address=ip_address))


def list_audit_logs(session: Session, institution_id: int, limit: int = 100) -> list[dict]:
    rows = session.execute(select(AuditLog, User.name).outerjoin(User, User.id == AuditLog.actor_user_id).where(AuditLog.institution_id == institution_id).order_by(AuditLog.created_at.desc()).limit(min(limit, 500))).all()
    return [{"id": row.id, "actor": name or "System", "action": row.action, "entity_type": row.entity_type, "entity_id": row.entity_id, "details": json.loads(row.details_json) if row.details_json else None, "created_at": row.created_at.isoformat()} for row, name in rows]
