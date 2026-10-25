"""Resilient timetable-aware CCTV/IP/mobile camera processing worker.

Run this separately from the API. Configure CAMERA_STREAMS_JSON in .env. Each
camera keeps running when no dashboard is open. Outside scheduled periods the
vision service receives no class_session_id, which activates safety-only mode.
"""
import json
import logging
import signal
import threading
import time
from datetime import datetime, timezone

import cv2
from sqlalchemy import and_, or_, select

import database as db
from config import get_settings
from ml_service import vision
from models import ClassSession, Course, Institution, TeacherAssignment, TimetableSlot, User


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
settings = get_settings()
running = True


def stop(*_):
    global running
    running = False


def active_class(institution_id: int, classroom: str, local_now: datetime) -> tuple[int | None, int | None]:
    with db.session_scope() as session:
        existing_session = session.scalar(
            select(ClassSession)
            .join(TimetableSlot, TimetableSlot.id == ClassSession.timetable_slot_id)
            .join(TeacherAssignment, TeacherAssignment.id == ClassSession.assignment_id)
            .join(User, User.id == TeacherAssignment.teacher_id)
            .where(
                User.institution_id == institution_id,
                ClassSession.session_date == local_now.date(),
                ClassSession.attendance_state != "published",
                ClassSession.status.in_(("scheduled", "in_progress")),
                TimetableSlot.active.is_(True),
                TimetableSlot.publication_status == "published",
                TimetableSlot.start_time <= local_now.time().replace(tzinfo=None),
                TimetableSlot.end_time >= local_now.time().replace(tzinfo=None),
                or_(
                    ClassSession.temporary_classroom == classroom,
                    and_(ClassSession.temporary_classroom.is_(None), TimetableSlot.classroom == classroom),
                ),
            )
            .order_by(ClassSession.period_number)
        )
        if existing_session:
            assignment = session.get(TeacherAssignment, existing_session.assignment_id)
            if existing_session.status == "scheduled":
                existing_session.status = "in_progress"
                existing_session.actual_start = existing_session.actual_start or datetime.now(timezone.utc)
            existing_session.camera_state = "online"
            existing_session.failure_reason = None
            return existing_session.id, assignment.teacher_id if assignment else None
        slot = session.scalar(
            select(TimetableSlot)
            .join(TeacherAssignment, TeacherAssignment.id == TimetableSlot.assignment_id)
            .join(Course, Course.id == TeacherAssignment.course_id)
            .join(User, User.id == TeacherAssignment.teacher_id)
            .where(
                Course.institution_id == institution_id,
                User.institution_id == institution_id,
                TimetableSlot.classroom == classroom,
                TimetableSlot.weekday == local_now.weekday(),
                TimetableSlot.start_time <= local_now.time().replace(tzinfo=None),
                TimetableSlot.end_time >= local_now.time().replace(tzinfo=None),
                TimetableSlot.effective_from <= local_now.date(),
                TimetableSlot.effective_to >= local_now.date(),
                TimetableSlot.active.is_(True),
                TimetableSlot.publication_status == "published",
                TeacherAssignment.active.is_(True),
            )
            .order_by(TimetableSlot.period_number)
        )
        if not slot:
            return None, None
        assignment = session.get(TeacherAssignment, slot.assignment_id)
        if not assignment or not assignment.active:
            return None, None
        class_session = session.scalar(select(ClassSession).where(ClassSession.section_id == slot.section_id, ClassSession.session_date == local_now.date(), ClassSession.period_number == slot.period_number))
        if not class_session:
            class_session = ClassSession(assignment_id=assignment.id, timetable_slot_id=slot.id, section_id=slot.section_id, session_date=local_now.date(), period_number=slot.period_number, classroom=slot.classroom, status="in_progress", attendance_state="draft", camera_state="online", actual_start=datetime.now(timezone.utc), created_by=assignment.teacher_id)
            session.add(class_session)
            session.flush()
        elif class_session.status == "scheduled":
            class_session.status = "in_progress"
            class_session.actual_start = class_session.actual_start or datetime.now(timezone.utc)
        class_session.camera_state = "online"
        class_session.failure_reason = None
        return class_session.id, assignment.teacher_id


def run_camera(config: dict) -> None:
    slug = str(config.get("institution_slug", "")).strip()
    classroom = str(config.get("classroom", "")).strip()
    source_value = config.get("source", 0)
    source = int(source_value) if isinstance(source_value, str) and source_value.isdigit() else source_value
    camera_key = str(config.get("camera_key") or f"{slug}:{classroom}").strip()[:100]
    source_kind = "local" if isinstance(source, int) else "ip_camera" if str(source).startswith(("http://", "https://", "rtsp://")) else "stream"
    with db.SessionLocal() as session:
        institution = session.scalar(select(Institution).where(Institution.slug == slug, Institution.active.is_(True)))
        if not institution:
            raise RuntimeError(f"Institution slug '{slug}' is not active")
        institution_id = institution.id
    logging.info("Monitoring %s for %s", classroom, slug)
    capture = None
    reconnects = 0
    last_status = 0.0
    last_finalize = 0.0
    frames = 0
    fps_started = time.monotonic()
    try:
        while running:
            # Resolve every room using the same configured campus clock as the
            # API, rather than the computer's local timezone.
            local_now = db.campus_now()
            if time.monotonic() - last_finalize >= 15:
                db.finalize_due_sessions(institution_id, local_now)
                last_finalize = time.monotonic()
            if capture is None or not capture.isOpened():
                if capture is not None:
                    capture.release()
                capture = cv2.VideoCapture(source)
                if not capture.isOpened():
                    reconnects += 1
                    db.update_camera_status(institution_id, camera_key, classroom, source_kind, "offline", error_code="open_failed", error_message="Camera stream could not be opened", reconnect=True)
                    logging.warning("Camera %s is offline; retrying", classroom)
                    time.sleep(max(1.0, settings.camera_reconnect_seconds))
                    continue
            ok, frame = capture.read()
            if not ok:
                logging.warning("Camera %s frame unavailable; reconnecting", classroom)
                reconnects += 1
                db.update_camera_status(institution_id, camera_key, classroom, source_kind, "offline", error_code="frame_unavailable", error_message="No camera frame received", reconnect=True)
                capture.release()
                capture = None
                time.sleep(max(1.0, settings.camera_reconnect_seconds))
                continue
            class_session_id, teacher_id = active_class(institution_id, classroom, local_now)
            try:
                result = vision.analyse(frame, classroom, "none", None, institution_id, None, class_session_id, teacher_id)
            except Exception as exc:
                db.update_camera_status(institution_id, camera_key, classroom, source_kind, "failed", class_session_id=class_session_id, error_code="processing_failed", error_message=str(exc)[:500])
                logging.error("Camera %s processing failed; retrying after backoff", classroom)
                time.sleep(max(1.0, settings.camera_reconnect_seconds))
                continue
            frames += 1
            elapsed = max(0.001, time.monotonic() - fps_started)
            fps = frames / elapsed
            if time.monotonic() - last_status >= 5:
                db.update_camera_status(institution_id, camera_key, classroom, source_kind, "online", class_session_id=class_session_id, processing_fps=fps)
                last_status = time.monotonic()
                if elapsed >= 60:
                    frames = 0
                    fps_started = time.monotonic()
            if result.get("alerts"):
                print("\a", end="", flush=True)
                for alert in result["alerts"]:
                    logging.warning("SAFETY ALERT %s: %s", classroom, alert["message"])
            time.sleep(max(0.25, settings.camera_frame_interval_seconds))
    finally:
        if capture is not None:
            capture.release()
        db.update_camera_status(institution_id, camera_key, classroom, source_kind, "offline", error_code="worker_stopped", error_message="Camera worker stopped")


def main() -> None:
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    db.init_database()
    try:
        cameras = json.loads(settings.camera_streams_json)
    except json.JSONDecodeError as exc:
        raise RuntimeError("CAMERA_STREAMS_JSON is not valid JSON") from exc
    if not isinstance(cameras, list) or not cameras:
        raise RuntimeError("Add at least one camera to CAMERA_STREAMS_JSON")
    failures: list[Exception] = []
    def launch(camera: dict) -> None:
        try:
            run_camera(camera)
        except Exception as exc:  # keep other configured cameras running
            logging.exception("Camera worker stopped")
            failures.append(exc)
    threads = [threading.Thread(target=launch, args=(camera,), daemon=True, name=f"camera-{index}") for index, camera in enumerate(cameras, 1)]
    for thread in threads:
        thread.start()
    while running and any(thread.is_alive() for thread in threads):
        time.sleep(1)
    if failures and len(failures) == len(threads):
        raise RuntimeError("All configured camera workers stopped")


if __name__ == "__main__":
    main()
