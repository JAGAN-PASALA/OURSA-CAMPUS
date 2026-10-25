#!/usr/bin/env python3
"""Move v8.1 local fee, coursework and on-duty files to scanned private storage.

Run from the backend environment after configuring MySQL, private object storage,
and ClamAV. Default is dry-run; pass --apply to migrate and remove old files only
after the database transaction commits successfully.
"""
import argparse
import hashlib
import sys
from pathlib import Path
from uuid import uuid4

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND))

import database as db
import storage_service
from models import Course, FeePayment, LearningAssignment, LearningSubmission, LearningSubmissionAttachment, OnDutyRequest

ROOTS = {
    "fee": BACKEND / "data" / "payment_receipts",
    "assignment": BACKEND / "data" / "submissions",
    "on_duty": BACKEND / "data" / "on_duty",
}


def is_under(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="perform migration; without this flag only report")
    args = parser.parse_args()
    session = db.SessionLocal()
    migrations = []
    uploaded_keys = []
    originals = []
    try:
        for row in session.query(FeePayment).filter(FeePayment.receipt_storage_name.is_not(None)).all():
            name = row.receipt_storage_name or ""
            if name.startswith("institutions/"):
                continue
            source = (ROOTS["fee"] / Path(name).name).resolve()
            if not is_under(source, ROOTS["fee"]) or not source.is_file():
                print(f"SKIP fee payment {row.id}: legacy receipt missing or path invalid")
                continue
            key = f"institutions/{row.institution_id}/fee-receipts/{row.student_id}/legacy-{uuid4().hex}{source.suffix.lower()}"
            migrations.append(("fee", row, source, key, row.receipt_mime_type or "application/octet-stream"))

        for row in session.query(LearningSubmissionAttachment).all():
            name = row.storage_name or ""
            if name.startswith("institutions/"):
                continue
            source = (ROOTS["assignment"] / Path(name).name).resolve()
            if not is_under(source, ROOTS["assignment"]) or not source.is_file():
                print(f"SKIP assignment attachment {row.id}: legacy file missing or path invalid")
                continue
            submission = session.get(LearningSubmission, row.submission_id)
            assignment = session.get(LearningAssignment, submission.learning_assignment_id) if submission else None
            course = session.get(Course, assignment.course_id) if assignment else None
            if not submission or not assignment or not course:
                print(f"SKIP assignment attachment {row.id}: parent records missing")
                continue
            key = f"institutions/{course.institution_id}/assignments/{assignment.id}/submissions/{submission.id}/legacy-{uuid4().hex}{source.suffix.lower()}"
            migrations.append(("assignment", row, source, key, row.mime_type or "application/octet-stream"))

        for row in session.query(OnDutyRequest).filter(OnDutyRequest.attachment_path.is_not(None)).all():
            name = row.attachment_path or ""
            if name.startswith("institutions/"):
                continue
            source = Path(name).resolve()
            if not is_under(source, ROOTS["on_duty"]) or not source.is_file():
                print(f"SKIP on-duty request {row.id}: legacy file missing or path invalid")
                continue
            key = f"institutions/{row.institution_id}/on-duty/{row.student_id}/legacy-{uuid4().hex}{source.suffix.lower()}"
            content_type = "application/pdf" if source.suffix.lower() == ".pdf" else "image/jpeg" if source.suffix.lower() in {".jpg", ".jpeg"} else "image/png"
            migrations.append(("on_duty", row, source, key, content_type))

        print(f"Legacy files eligible for migration: {len(migrations)}")
        if not args.apply:
            print("DRY RUN only. Review the output, back up the database and files, then rerun with --apply.")
            return 0

        for kind, row, source, key, content_type in migrations:
            payload = source.read_bytes()
            checksum = hashlib.sha256(payload).hexdigest()
            previous_checksum = getattr(row, "receipt_checksum_sha256", None) if kind == "fee" else getattr(row, "checksum_sha256", None) if kind == "assignment" else None
            if previous_checksum and previous_checksum.lower() != checksum:
                raise RuntimeError(f"Legacy source checksum does not match its database record: {source}")
            stored = storage_service.put_private(key, payload, content_type)
            uploaded_keys.append(stored.key)
            if stored.size != len(payload) or not storage_service.verify_private(stored.key, checksum):
                raise RuntimeError(f"Read-back checksum verification failed for {source}")
            if kind == "fee": row.receipt_storage_name = stored.key
            elif kind == "assignment": row.storage_name = stored.key
            else: row.attachment_path = stored.key
            originals.append(source)
        session.commit()
        for source in originals:
            try:
                source.unlink(missing_ok=True)
            except OSError as cleanup_error:
                print(f"WARNING: migrated successfully but could not remove legacy copy {source}: {cleanup_error}")
        # Do not delete migrated objects after a successful DB commit, even if
        # best-effort cleanup of an old local copy fails.
        uploaded_keys.clear()
        print(f"Migrated {len(migrations)} files; old copies removed only after commit.")
        return 0
    except Exception:
        session.rollback()
        for key in uploaded_keys:
            try: storage_service.delete_private(key)
            except Exception as cleanup_error: print(f"WARNING: failed to remove orphaned object {key}: {cleanup_error}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    raise SystemExit(main())
