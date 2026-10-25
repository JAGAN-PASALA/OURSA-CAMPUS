import os
import hashlib
import json
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


TEST_DB = Path(tempfile.mkdtemp(prefix="eduvision-tests-")) / "test.db"
os.environ.update({
    "APP_SECRET": "test-secret-that-is-long-enough-for-jwt-signing",
    "DATABASE_URL": f"sqlite:///{TEST_DB.as_posix()}",
    "SEED_DEMO_DATA": "true",
    "APP_ENV": "test",
})

from fastapi.testclient import TestClient
import pytest
from cryptography.fernet import Fernet

from main import app
import main
import database as db
from config import Settings
from models import AttendanceCorrection, BehaviourModelVersion, BehaviourObservation, ClassSession, Department, NotificationDelivery, PasswordResetToken, SectionMembership, SessionAttendance, StaffProfile, Student, User
from privacy import decrypt_embedding, encrypt_embedding


def login(client: TestClient, email: str, password: str, domain: str = "testserver", role: str | None = None) -> None:
    expected_role = role or ("admin" if email.startswith(("admin", "owner")) else "teacher" if email.startswith("teacher") else "student")
    response = client.post("/api/auth/login", json={"email": email, "password": password, "role": expected_role, "terms_accepted": True}, headers={"X-Institution-Domain": domain})
    assert response.status_code == 200, response.text
    assert response.cookies.get("ours_session")


def default_class_fields(client: TestClient, headers: dict | None = None) -> dict:
    catalog = client.get("/api/admin/academics/catalog", headers=headers or {}).json()
    section = catalog["sections"][0]
    department = next(row for row in catalog["departments"] if row["code"].casefold() == section["department"].casefold() or row["name"].casefold() == section["department"].casefold())
    return {
        "department": department["name"],
        "department_id": department["id"],
        "section_id": section["id"],
        "term_id": catalog["terms"][0]["id"],
    }


def test_health_login_and_student_dashboard():
    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/ready").status_code == 200
        recommendations = client.get("/api/public/institutions", params={"q": "development"})
        assert recommendations.status_code == 200
        assert recommendations.json()[0]["slug"] == "ours-platform"
        login(client, "student@example.com", "Student@123")
        response = client.get("/api/dashboard")
        assert response.status_code == 200
        assert response.json()["student"]["name"] == "Arjun Kumar"
        assert len(response.json()["courses"]) == 3


def test_admin_crud_consent_and_audit_log():
    with TestClient(app) as client:
        login(client, "admin@example.com", "Admin@123")
        class_fields = default_class_fields(client)
        created = client.post("/api/admin/students", json={
            "name": "Startup Test Student",
            "email": "startup.student@example.com",
            "password": "Temporary123",
            "roll_no": "START001",
            "date_of_birth": "2000-01-01",
            **class_fields,
        })
        assert created.status_code == 201, created.text
        student_id = created.json()["id"]
        consent = client.patch(f"/api/admin/students/{student_id}/biometric-consent", json={"granted": True})
        assert consent.status_code == 200
        assert consent.json()["biometric_consent"] is True
        course = client.post("/api/admin/courses", json={"title": "Responsible AI", "code": "RAI900", "total_lessons": 12})
        assert course.status_code == 201, course.text
        enrollment = client.post("/api/admin/enrollments", json={"student_id": student_id, "course_id": course.json()["id"]})
        assert enrollment.status_code == 201, enrollment.text
        logs = client.get("/api/admin/audit-logs")
        assert logs.status_code == 200
        assert any(row["action"] == "biometric.consent_updated" for row in logs.json())


def test_student_cannot_use_admin_api():
    with TestClient(app) as client:
        login(client, "student@example.com", "Student@123")
        response = client.get("/api/admin/courses")
        assert response.status_code == 403


def test_institution_domain_and_records_are_isolated():
    second_domain = "second.example.test"
    with TestClient(app) as client:
        login(client, "owner@example.com", "Owner@12345")
        created = client.post("/api/platform/institutions", json={
            "name": "Second College",
            "slug": "second-college",
            "organization_type": "college",
            "domain": second_domain,
            "brand_name": "Second Campus",
            "primary_color": "#123456",
            "admin_name": "Second Administrator",
            "admin_email": "admin@example.com",
            "admin_password": "SecondAdmin123",
        })
        assert created.status_code == 201, created.text
        assert client.get("/api/public/tenant", headers={"X-Institution-Domain": second_domain}).json()["name"] == "Second College"

        client.cookies.clear()
        login(client, "admin@example.com", "SecondAdmin123", second_domain)
        tenant_headers = {"X-Institution-Domain": second_domain}
        department = client.post("/api/admin/departments", headers=tenant_headers, json={"name": "Science", "code": "SCI", "email_domain": "science.second.example.test"})
        assert department.status_code == 201, department.text
        today = datetime.now(timezone.utc).date()
        term = client.post("/api/admin/academics/terms", headers=tenant_headers, json={"name": "Semester 1", "academic_year": str(today.year), "start_date": str(today - timedelta(days=7)), "end_date": str(today + timedelta(days=120))})
        assert term.status_code == 201, term.text
        section = client.post("/api/admin/academics/sections", headers=tenant_headers, json={"name": "SCI-A", "department": "SCI", "semester": 1, "batch_year": today.year})
        assert section.status_code == 201, section.text
        student = client.post("/api/admin/students", headers={"X-Institution-Domain": second_domain}, json={
            "name": "Tenant Student",
            "email": "student@example.com",
            "password": "TenantStudent123",
            "roll_no": "TENANT001",
            "department": "Science",
            "department_id": department.json()["id"],
            "section_id": section.json()["id"],
            "term_id": term.json()["id"],
        })
        assert student.status_code == 201, student.text
        tenant_students = client.get("/api/students", headers={"X-Institution-Domain": second_domain})
        assert [row["roll_no"] for row in tenant_students.json()] == ["TENANT001"]

        wrong_domain = client.get("/api/dashboard", headers={"X-Institution-Domain": "testserver"})
        assert wrong_domain.status_code == 401
        client.cookies.clear()
        login(client, "admin@example.com", "Admin@123")
        default_students = client.get("/api/students")
        assert "TENANT001" not in [row["roll_no"] for row in default_students.json()]


def test_role_selected_on_login_must_match_account():
    with TestClient(app) as client:
        response = client.post("/api/auth/login", json={"email": "teacher@example.com", "password": "Teacher@123", "role": "student", "terms_accepted": True})
        assert response.status_code == 401


def test_platform_owner_is_separated_from_college_operations():
    with TestClient(app) as client:
        login(client, "owner@example.com", "Owner@12345")
        overview = client.get("/api/platform/overview")
        assert overview.status_code == 200, overview.text
        assert "scope_notice" in overview.json()
        assert client.get("/api/platform/system-health").status_code == 200
        assert client.get("/api/admin/courses").status_code == 403
        assert client.get("/api/students").status_code == 403
        assert client.get("/api/academics/workspace").status_code == 403
        assert client.post("/api/announcements", json={"title": "Blocked", "body": "Platform owners do not publish college notices.", "audience": "all"}).status_code == 403


def test_public_institution_search_ignores_common_name_punctuation():
    with TestClient(app) as client:
        response = client.get("/api/public/institutions?q=OURS")
        assert response.status_code == 200
        assert any(row["slug"] == "ours-platform" for row in response.json())


def test_hod_can_allocate_any_college_teacher_but_ordinary_teacher_cannot():
    hod_domain = "hod-allocation.example.test"
    with TestClient(app) as client:
        login(client, "owner@example.com", "Owner@12345")
        provisioned = client.post("/api/platform/institutions", json={
            "name": "HOD Allocation College", "slug": "hod-allocation-college", "organization_type": "college",
            "domain": hod_domain, "brand_name": "HOD College", "primary_color": "#315b7d",
            "admin_name": "HOD College Administrator", "admin_email": "hod.admin@example.com", "admin_password": "HodAdmin@12345",
        })
        assert provisioned.status_code == 201, provisioned.text
        client.cookies.clear()
        login(client, "hod.admin@example.com", "HodAdmin@12345", hod_domain, role="admin")
        client.headers.update({"X-Institution-Domain": hod_domain})
        cse_department = client.post("/api/admin/departments", json={"name": "Computer Science", "code": "CSE", "email_domain": "cse.hod.example.edu"})
        assert cse_department.status_code == 201, cse_department.text
        department = client.post("/api/admin/departments", json={"name": "Humanities", "code": "HUM", "email_domain": "hum.example.edu"})
        assert department.status_code == 201, department.text
        hod = client.post("/api/admin/staff", json={
            "name": "CSE Department Head", "email": "hod.allocations@example.com", "password": "HodSecure@12345",
            "access_role": "teacher", "designation": "hod", "employee_no": "HOD-ALLOC-1",
            "department_id": cse_department.json()["id"], "biometric_consent": False,
        })
        assert hod.status_code == 201, hod.text
        cross_teacher = client.post("/api/admin/staff", json={
            "name": "Humanities Faculty", "email": "humanities.faculty@example.com", "password": "Faculty@12345",
            "access_role": "teacher", "designation": "teacher", "employee_no": "HUM-FAC-1",
            "department_id": department.json()["id"], "biometric_consent": False,
        })
        assert cross_teacher.status_code == 201, cross_teacher.text
        course = client.post("/api/admin/courses", json={"title": "Interdisciplinary Communication", "code": "HUM901", "total_lessons": 12})
        assert course.status_code == 201, course.text
        today = datetime.now(timezone.utc).date()
        term = client.post("/api/admin/academics/terms", json={"name": "Semester 1", "academic_year": str(today.year), "start_date": str(today), "end_date": str(today + timedelta(days=120))})
        assert term.status_code == 201, term.text
        section = client.post("/api/admin/academics/sections", json={"name": "HUM-A", "department": "HUM", "semester": 1, "batch_year": today.year})
        assert section.status_code == 201, section.text
        term_id = term.json()["id"]

        client.cookies.clear()
        login(client, "hod.allocations@example.com", "HodSecure@12345", hod_domain, role="teacher")
        hod_catalog = client.get("/api/admin/academics/catalog")
        assert hod_catalog.status_code == 200, hod_catalog.text
        assert any(row["id"] == cross_teacher.json()["id"] for row in hod_catalog.json()["teachers"])
        allocated = client.post("/api/admin/academics/assignments", json={
            "teacher_id": cross_teacher.json()["id"], "course_id": course.json()["id"],
            "section_id": section.json()["id"], "term_id": term_id,
        })
        assert allocated.status_code == 201, allocated.text

        client.cookies.clear()
        login(client, "humanities.faculty@example.com", "Faculty@12345", hod_domain, role="teacher")
        assert client.get("/api/admin/academics/catalog").status_code == 403


def test_platform_support_requires_named_admin_consent_and_is_read_only():
    support_domain = "support-college.example.test"
    with TestClient(app) as client:
        login(client, "owner@example.com", "Owner@12345")
        created = client.post("/api/platform/institutions", json={
            "name": "Support Consent College", "slug": "support-consent-college", "organization_type": "college",
            "domain": support_domain, "brand_name": "Support College", "primary_color": "#246a73",
            "admin_name": "Support Administrator", "admin_email": "support.admin@example.com", "admin_password": "SupportAdmin@123",
        })
        assert created.status_code == 201, created.text
        institution = next(row for row in client.get("/api/platform/institutions").json() if row["slug"] == "support-consent-college")
        administrator_id = institution["administrators"][0]["id"]
        requested = client.post("/api/platform/support-sessions", json={
            "institution_id": institution["id"], "represented_admin_id": administrator_id,
            "reason": "Investigate a reported timetable configuration issue", "ticket_reference": "SUP-001", "duration_minutes": 30,
        })
        assert requested.status_code == 201, requested.text
        support_id = requested.json()["id"]
        assert client.get(f"/api/platform/support-sessions/{support_id}/administration").status_code == 403

        client.cookies.clear()
        login(client, "support.admin@example.com", "SupportAdmin@123", support_domain, role="admin")
        tenant_headers = {"X-Institution-Domain": support_domain}
        pending = client.get("/api/admin/support-sessions", headers=tenant_headers)
        assert pending.status_code == 200, pending.text
        approved = client.patch(f"/api/admin/support-sessions/{support_id}/review", headers=tenant_headers, json={"decision": "approved", "reason": "Approved for this support ticket"})
        assert approved.status_code == 200, approved.text

        client.cookies.clear()
        login(client, "owner@example.com", "Owner@12345")
        inspection = client.get(f"/api/platform/support-sessions/{support_id}/administration")
        assert inspection.status_code == 200, inspection.text
        assert inspection.json()["support"]["read_only"] is True
        assert "password" not in json.dumps(inspection.json()).lower()
        assert client.post("/api/admin/departments", json={"name": "Blocked", "code": "BLK", "email_domain": "blocked.example.edu"}).status_code == 403
        assert client.post(f"/api/platform/support-sessions/{support_id}/revoke").status_code == 200
        assert client.get(f"/api/platform/support-sessions/{support_id}/administration").status_code == 403


def test_institution_lifecycle_requires_archive_and_blocks_nonempty_deletion():
    with TestClient(app) as client:
        login(client, "owner@example.com", "Owner@12345")
        created = client.post("/api/platform/institutions", json={
            "name": "Disposable Empty College", "slug": "disposable-empty-college", "organization_type": "college",
            "domain": "disposable-empty.example.test", "brand_name": "Disposable", "primary_color": "#394867",
            "admin_name": "Disposable Administrator", "admin_email": "disposable.admin@example.com", "admin_password": "DisposableAdmin@123",
        })
        assert created.status_code == 201, created.text
        institution_id = created.json()["id"]
        request = {
            "typed_name": "Disposable Empty College",
            "reason": "Removing an unused test tenant after backup verification.",
            "current_password": "Owner@12345",
            "backup_confirmed": True,
        }
        active_delete = client.post(f"/api/platform/institutions/{institution_id}/lifecycle", json={**request, "action": "delete"})
        assert active_delete.status_code == 409
        wrong_name = client.post(f"/api/platform/institutions/{institution_id}/lifecycle", json={**request, "action": "archive", "typed_name": "Disposable"})
        assert wrong_name.status_code == 400
        archived = client.post(f"/api/platform/institutions/{institution_id}/lifecycle", json={**request, "action": "archive"})
        assert archived.status_code == 200, archived.text
        assert archived.json()["active"] is False
        deleted = client.post(f"/api/platform/institutions/{institution_id}/lifecycle", json={**request, "action": "delete"})
        assert deleted.status_code == 200, deleted.text
        assert deleted.json()["status"] == "deleted"

        protected = client.post("/api/platform/institutions", json={
            "name": "Protected Records College", "slug": "protected-records-college", "organization_type": "college",
            "domain": "protected-records.example.test", "brand_name": "Protected", "primary_color": "#315b7d",
            "admin_name": "Protected Administrator", "admin_email": "protected.admin@example.com", "admin_password": "ProtectedAdmin@123",
        })
        assert protected.status_code == 201, protected.text
        protected_id = protected.json()["id"]
        with db.SessionLocal() as session:
            session.add(Department(institution_id=protected_id, name="Computer Science", code="CSE-PROTECTED", email_domain="cse.protected.example.test"))
            session.commit()
        protected_request = {**request, "typed_name": "Protected Records College"}
        assert client.post(f"/api/platform/institutions/{protected_id}/lifecycle", json={**protected_request, "action": "archive"}).status_code == 200
        blocked = client.post(f"/api/platform/institutions/{protected_id}/lifecycle", json={**protected_request, "action": "delete"})
        assert blocked.status_code == 409
        assert blocked.json()["detail"]["dependencies"]["departments"] == 1


def test_active_model_release_cannot_be_rejected_as_a_candidate():
    with TestClient(app) as client:
        with db.SessionLocal() as session:
            row = BehaviourModelVersion(
                version="test-active-protected", dataset_version="test-v1", status="active",
                model_path="models/candidates/missing.joblib", sha256="0" * 64,
                samples=100, groups=10, accuracy=.9, macro_precision=.9, macro_recall=.9, macro_f1=.9,
                metrics_json=json.dumps({"classes": ["attentive", "sleeping"]}),
            )
            session.add(row)
            session.commit()
            version_id = row.id
        login(client, "owner@example.com", "Owner@12345")
        response = client.post(f"/api/model/versions/{version_id}/promote", json={"approve": False, "reason": "An active release must remain protected"})
        assert response.status_code == 409


def test_biometric_template_is_encrypted_at_rest():
    values = [0.125, -0.25, 0.75]
    encrypted = encrypt_embedding(values)
    assert b"0.125" not in encrypted
    assert decrypt_embedding(encrypted) == values


def test_physical_class_coverage_and_online_assessment_flow():
    with TestClient(app) as client:
        login(client, "teacher@example.com", "Teacher@123")
        workspace = client.get("/api/academics/workspace")
        assert workspace.status_code == 200, workspace.text
        data = workspace.json()
        class_session = next(row for row in data["sessions"] if row["status"] == "scheduled")
        topic = next(row for row in data["topics"] if row["status"] == "planned")
        covered = client.patch(f"/api/academics/sessions/{class_session['id']}/coverage", json={
            "topic_id": topic["id"],
            "status": "completed",
            "coverage_percent": 100,
            "notes": "Theory and practical example completed",
            "class_status": "completed",
        })
        assert covered.status_code == 200, covered.text
        assessment = client.post("/api/academics/assessments", json={
            "course_id": topic["course_id"],
            "section_id": class_session["section_id"],
            "title": "Regression concept check",
            "mode": "online",
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "duration_minutes": 20,
            "total_marks": 2,
            "question_count": 1,
            "marking_mode": "common",
            "common_marks": 2,
            "show_correct_answers": True,
            "topic_ids": [topic["id"]],
        })
        assert assessment.status_code == 201, assessment.text
        assessment_id = assessment.json()["id"]
        question = client.post(f"/api/academics/assessments/{assessment_id}/questions", json={
            "question_text": "Which method predicts a continuous target?",
            "question_type": "mcq",
            "options": ["Regression", "Clustering", "Association"],
            "correct_answer": "Regression",
            "marks": 2,
        })
        assert question.status_code == 201, question.text
        assert client.patch(f"/api/academics/assessments/{assessment_id}/publish").status_code == 200

        client.cookies.clear()
        login(client, "student@example.com", "Student@123")
        started = client.post(f"/api/student/assessments/{assessment_id}/start")
        assert started.status_code == 201, started.text
        submitted = client.post(f"/api/student/attempts/{started.json()['attempt_id']}/submit", json={"answers": [{"question_id": question.json()["id"], "answer": "Regression"}]})
        assert submitted.status_code == 200, submitted.text
        assert submitted.json()["score"] == 2


def test_department_email_suffix_duplicates_and_record_corrections():
    with TestClient(app) as client:
        login(client, "admin@example.com", "Admin@123")
        department = client.post("/api/admin/departments", json={"name": "Information Science", "code": "ISE", "email_domain": "ise.dsu.ac.in"})
        assert department.status_code == 201, department.text
        catalog = client.get("/api/admin/academics/catalog").json()
        term_id = catalog["terms"][0]["id"]
        today = datetime.now(timezone.utc).date()
        section = client.post("/api/admin/academics/sections", json={"name": "ISE-A", "department": "ISE", "semester": 1, "batch_year": today.year})
        assert section.status_code == 201, section.text
        student = client.post("/api/admin/students", json={
            "name": "Nisha Rao",
            "email": "nisha.rao",
            "password": "Temporary123",
            "roll_no": "ISE001",
            "department": "Information Science",
            "department_id": department.json()["id"],
            "section_id": section.json()["id"],
            "term_id": term_id,
        })
        assert student.status_code == 201, student.text
        assert student.json()["email"] == "nisha.rao@ise.dsu.ac.in"
        duplicate = client.post("/api/admin/students", json={
            "name": "Nisha Rao",
            "email": "nisha.second",
            "password": "Temporary123",
            "roll_no": "ISE001",
            "department": "Information Science",
            "department_id": department.json()["id"],
            "section_id": section.json()["id"],
            "term_id": term_id,
        })
        assert duplicate.status_code == 409
        assert "already exists" in duplicate.json()["detail"].lower()
        corrected = client.patch(f"/api/admin/students/{student.json()['id']}", json={
            "name": "Nisha R. Rao",
            "email": "nisha.rao",
            "roll_no": "ISE001",
            "department": "Information Science",
            "department_id": department.json()["id"],
        })
        assert corrected.status_code == 200, corrected.text
        assert corrected.json()["name"] == "Nisha R. Rao"
        corrected_department = client.patch(f"/api/admin/departments/{department.json()['id']}", json={"name": "Information Science and Engineering", "code": "ISC", "email_domain": "isc.dsu.ac.in"})
        assert corrected_department.status_code == 200, corrected_department.text
        corrected_catalog = client.get("/api/admin/academics/catalog").json()
        assert next(row for row in corrected_catalog["sections"] if row["id"] == section.json()["id"])["department"] == "ISC"
        assert next(row for row in client.get("/api/students").json() if row["id"] == student.json()["id"])["department"] == "Information Science and Engineering"
        course = client.post("/api/admin/courses", json={"title": "Data Warehousing", "code": "ISE301", "total_lessons": 20})
        corrected_course = client.patch(f"/api/admin/courses/{course.json()['id']}", json={"title": "Data Warehouse Systems", "code": "ISE302", "total_lessons": 22})
        assert corrected_course.status_code == 200, corrected_course.text
        assert corrected_course.json()["code"] == "ISE302"


def test_common_and_separate_marks_question_limits_and_answer_review():
    with TestClient(app) as client:
        login(client, "teacher@example.com", "Teacher@123")
        data = client.get("/api/academics/workspace").json()
        assignment = data["assignments"][0]
        topic = next(row for row in data["topics"] if row["status"] == "completed" and row["course_id"] == assignment["course_id"])
        created = client.post("/api/academics/assessments", json={
            "course_id": assignment["course_id"], "section_id": assignment["section_id"], "title": "Automatic grading test",
            "mode": "online", "scheduled_at": datetime.now(timezone.utc).isoformat(), "duration_minutes": 15,
            "total_marks": 99, "question_count": 2, "marking_mode": "common", "common_marks": 3,
            "show_correct_answers": True, "topic_ids": [topic["id"]],
        })
        assert created.status_code == 201, created.text
        assessment_id = created.json()["id"]
        first = client.post(f"/api/academics/assessments/{assessment_id}/questions", json={"question_text": "Python is interpreted.", "question_type": "true_false", "options": None, "correct_answer": "True", "marks": 20})
        second = client.post(f"/api/academics/assessments/{assessment_id}/questions", json={"question_text": "Write ML in full.", "question_type": "short_answer", "options": None, "correct_answer": "Machine Learning", "marks": 20})
        assert first.json()["marks"] == 3
        assert second.json()["marks"] == 3
        too_many = client.post(f"/api/academics/assessments/{assessment_id}/questions", json={"question_text": "Extra question", "question_type": "true_false", "options": None, "correct_answer": "True", "marks": 1})
        assert too_many.status_code == 409
        published = client.patch(f"/api/academics/assessments/{assessment_id}/publish")
        assert published.status_code == 200, published.text
        assert published.json()["total_marks"] == 6
        client.cookies.clear()
        login(client, "student@example.com", "Student@123")
        started = client.post(f"/api/student/assessments/{assessment_id}/start")
        assert started.status_code == 201, started.text
        submitted = client.post(f"/api/student/attempts/{started.json()['attempt_id']}/submit", json={"answers": [
            {"question_id": first.json()["id"], "answer": "False"},
            {"question_id": second.json()["id"], "answer": "Machine Learning"},
        ]})
        assert submitted.status_code == 200, submitted.text
        assert submitted.json()["score"] == 3
        assert submitted.json()["answers"][0]["correct_answer"] == "True"
        result = client.get(f"/api/student/assessments/{assessment_id}/result")
        assert result.status_code == 200
        assert result.json()["answers"][1]["is_correct"] is True
        client.cookies.clear()
        login(client, "teacher@example.com", "Teacher@123")
        roster = client.get(f"/api/academics/assessments/{assessment_id}/results")
        assert roster.status_code == 200
        assert roster.json()["results"][0]["roll_no"] == "CSE001"
        assert roster.json()["results"][0]["percentage"] == 50


def test_face_is_recognisable_only_after_required_samples_and_attendance_threshold_with_override():
    with TestClient(app):
        with db.SessionLocal() as session:
            default_institution_id = session.query(User).filter_by(email="student@example.com").first().institution_id
            user = session.query(User).filter_by(email="student@example.com", institution_id=default_institution_id).one()
            student = session.query(Student).filter_by(user_id=user.id).one()
            student.biometric_consent = True
            class_session = session.query(ClassSession).filter(ClassSession.timetable_slot_id.isnot(None)).first()
            session.commit()
            student_id = student.id
            institution_id = student.institution_id
            class_session_id = class_session.id
        sample = [0.0] * 128
        sample[0] = 1.0
        assert db.save_embedding(student_id, sample) == 1
        assert not any(row["student_id"] == student_id for row in db.load_embeddings(institution_id))
        assert db.save_embedding(student_id, sample) == 2
        assert db.save_embedding(student_id, sample) == 3
        assert any(row["student_id"] == student_id for row in db.load_embeddings(institution_id))
        tracking = db.mark_attendance(student_id, .9, class_session_id)
        assert tracking["status"] == "Tracking"
        with db.SessionLocal() as session:
            row = session.query(SessionAttendance).filter_by(class_session_id=class_session_id, student_id=student_id).one()
            assert row.required_seconds == 2880
            row.observed_seconds = row.required_seconds - 5
            row.last_seen_at = datetime.now(timezone.utc) - timedelta(seconds=5)
            session.commit()
        present = db.mark_attendance(student_id, .95, class_session_id)
        assert present["status"] == "Present"
        with db.SessionLocal() as session:
            second_student = session.query(Student).filter(Student.id != student_id, Student.institution_id == institution_id).first()
            teacher = session.query(User).filter_by(email="teacher@example.com", institution_id=institution_id).one()
            second_id, teacher_id = second_student.id, teacher.id
        override = db.override_session_attendance(class_session_id, second_id, teacher_id, "health", "Medical exception approved by teacher")
        assert override["status"] == "Present"
        assert override["decision_source"] == "health"
        with db.SessionLocal() as session:
            session.add(BehaviourObservation(institution_id=institution_id, class_session_id=class_session_id, student_id=student_id, behaviour="attentive", sample_count=10, observed_seconds=20, average_confidence=.9))
            session.add(BehaviourObservation(institution_id=institution_id, class_session_id=class_session_id, student_id=student_id, behaviour="sleeping", sample_count=2, observed_seconds=5, average_confidence=.8))
            session.commit()
            analytics = db.analytics_for_student(session, student_id)
            assert analytics["overall"]["attendance_percent"] >= 0
            assert analytics["subjects"][0]["behaviours"]["attentive"] == 80


def test_secure_forgot_password_and_single_use_reset(monkeypatch):
    fixed_token = "secure-reset-token-" + "x" * 48
    monkeypatch.setattr(main.secrets, "token_urlsafe", lambda _: fixed_token)
    headers = {"X-Institution-Slug": "ours-platform"}
    with TestClient(app) as client:
        requested = client.post("/api/auth/forgot-password", headers=headers, json={"email": "teacher@example.com", "role": "teacher"})
        assert requested.status_code == 200
        with db.SessionLocal() as session:
            row = session.query(PasswordResetToken).filter_by(token_hash=hashlib.sha256(fixed_token.encode()).hexdigest()).one()
            assert row.used_at is None
        reset = client.post("/api/auth/reset-password", headers=headers, json={"token": fixed_token, "new_password": "NewTeacherPass123"})
        assert reset.status_code == 200, reset.text
        reused = client.post("/api/auth/reset-password", headers=headers, json={"token": fixed_token, "new_password": "AnotherPass123"})
        assert reused.status_code == 400
        login(client, "teacher@example.com", "NewTeacherPass123")


def test_institution_admin_can_create_teacher_and_reset_tenant_account():
    with TestClient(app) as client:
        login(client, "admin@example.com", "Admin@123")
        teacher = client.post("/api/admin/teachers", json={"name": "Account Teacher", "email": "account.teacher@example.com", "password": "TeacherStart123"})
        assert teacher.status_code == 201, teacher.text
        accounts = client.get("/api/admin/users")
        assert any(row["email"] == "account.teacher@example.com" for row in accounts.json())
        reset = client.post(f"/api/admin/users/{teacher.json()['id']}/reset-password", json={"temporary_password": "TeacherReset123"})
        assert reset.status_code == 200, reset.text
        client.cookies.clear()
        login(client, "account.teacher@example.com", "TeacherReset123", role="teacher")


def test_student_is_created_in_selected_department_class_and_term():
    with TestClient(app) as client:
        login(client, "admin@example.com", "Admin@123")
        catalog = client.get("/api/admin/academics/catalog").json()
        department = next(row for row in catalog["departments"] if row["code"] == "CSE")
        section = next(row for row in catalog["sections"] if row["department"] == "CSE")
        term = catalog["terms"][0]
        missing_class = client.post("/api/admin/students", json={
            "name": "Unassigned Student", "email": "unassigned.student@example.com", "password": "Temporary123",
            "roll_no": "NO-CLASS-001", "department": department["name"], "department_id": department["id"],
        })
        assert missing_class.status_code == 422
        created = client.post("/api/admin/students", json={
            "name": "Class Assigned Student", "email": "class.assigned", "password": "Temporary123",
            "roll_no": "CSE-CLASS-001", "department": department["name"], "department_id": department["id"],
            "section_id": section["id"], "term_id": term["id"],
        })
        assert created.status_code == 201, created.text
        with db.SessionLocal() as session:
            membership = session.query(SectionMembership).filter_by(student_id=created.json()["id"], section_id=section["id"], term_id=term["id"], active=True).one()
            assert membership.id


def test_online_test_is_limited_to_the_students_exact_class_and_term():
    with TestClient(app) as client:
        login(client, "admin@example.com", "Admin@123")
        catalog = client.get("/api/admin/academics/catalog").json()
        current = catalog["assignments"][0]
        today = datetime.now(timezone.utc).date()
        future_term = client.post("/api/admin/academics/terms", json={
            "name": "Future permission test", "academic_year": f"{today.year + 1}-{today.year + 2}",
            "start_date": str(today + timedelta(days=180)), "end_date": str(today + timedelta(days=300)),
        })
        assert future_term.status_code == 201, future_term.text
        future_assignment = client.post("/api/admin/academics/assignments", json={
            "teacher_id": current["teacher_id"], "course_id": current["course_id"],
            "section_id": current["section_id"], "term_id": future_term.json()["id"],
        })
        assert future_assignment.status_code == 201, future_assignment.text

        client.cookies.clear()
        login(client, "teacher@example.com", "NewTeacherPass123")
        workspace = client.get("/api/academics/workspace").json()
        topic = next(row for row in workspace["topics"] if row["course_id"] == current["course_id"] and row["status"] == "completed")
        assessment = client.post("/api/academics/assessments", json={
            "assignment_id": future_assignment.json()["id"], "course_id": current["course_id"], "section_id": current["section_id"],
            "title": "Future term only", "mode": "online", "scheduled_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "duration_minutes": 10, "total_marks": 1, "question_count": 1, "marking_mode": "common",
            "common_marks": 1, "show_correct_answers": True, "topic_ids": [topic["id"]],
        })
        assert assessment.status_code == 201, assessment.text
        question = client.post(f"/api/academics/assessments/{assessment.json()['id']}/questions", json={
            "question_text": "Permission test?", "question_type": "true_false", "options": ["True", "False"],
            "correct_answer": "True", "marks": 1,
        })
        assert question.status_code == 201, question.text
        assert client.patch(f"/api/academics/assessments/{assessment.json()['id']}/publish").status_code == 200

        client.cookies.clear()
        login(client, "student@example.com", "Student@123")
        visible_ids = {row["id"] for row in client.get("/api/academics/workspace").json()["assessments"]}
        assert assessment.json()["id"] not in visible_ids
        assert client.post(f"/api/student/assessments/{assessment.json()['id']}/start").status_code == 403


def test_staff_faces_coursework_submission_grading_and_midterm_replacement():
    with TestClient(app) as client:
        login(client, "admin@example.com", "Admin@123")
        staff = client.post("/api/admin/staff", json={
            "name": "Replacement Faculty", "email": "replacement.faculty@example.com", "password": "Replacement123",
            "access_role": "teacher", "designation": "hod", "employee_no": "FAC-REPLACE-1", "biometric_consent": True,
        })
        assert staff.status_code == 201, staff.text
        assert staff.json()["designation"] == "hod"
        staff_id = staff.json()["id"]
        assert db.save_staff_embedding(staff_id, [1.0] + [0.0] * 127) == 1
        assert db.save_staff_embedding(staff_id, [1.0] + [0.0] * 127) == 2
        assert db.save_staff_embedding(staff_id, [1.0] + [0.0] * 127) == 3
        institution_id = staff.json()["institution_id"]
        assert any(row["user_id"] == staff_id and row["entity_type"] == "staff" for row in db.load_embeddings(institution_id))
        face_only = client.post("/api/admin/staff", json={
            "name": "College Dean", "email": "dean.face@example.com", "password": "FaceOnlyRecord123",
            "access_role": "staff", "designation": "dean", "employee_no": "DEAN-FACE-1", "biometric_consent": True,
        })
        assert face_only.status_code == 201, face_only.text
        assert face_only.json()["role"] == "staff"
        denied_login = client.post("/api/auth/login", json={"email": "dean.face@example.com", "password": "FaceOnlyRecord123", "role": "teacher", "terms_accepted": True})
        assert denied_login.status_code == 401

        catalog = client.get("/api/admin/academics/catalog").json()
        previous = next(row for row in catalog["assignments"] if row["term_name"].startswith("Semester 5"))
        replaced = client.patch(f"/api/admin/academics/assignments/{previous['id']}/replace", json={"new_teacher_id": staff_id, "reason": "Original staff member left mid-term"})
        assert replaced.status_code == 200, replaced.text

        client.cookies.clear()
        login(client, "replacement.faculty@example.com", "Replacement123", role="teacher")
        workspace = client.get("/api/academics/workspace").json()
        teaching = next(row for row in workspace["assignments"] if row["id"] == replaced.json()["id"])
        created = client.post("/api/academics/coursework", json={
            "assignment_id": teaching["id"], "title": "Replacement workflow assignment",
            "instructions": "Explain the covered concept.", "due_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(), "max_marks": 10,
        })
        assert created.status_code == 201, created.text
        coursework_id = created.json()["id"]
        assert client.patch(f"/api/academics/coursework/{coursework_id}/publish").status_code == 200

        client.cookies.clear()
        login(client, "student@example.com", "Student@123")
        visible = client.get("/api/academics/workspace")
        assert any(row["id"] == coursework_id for row in visible.json()["coursework"])
        submitted = client.post(f"/api/student/coursework/{coursework_id}/submit", json={"answer_text": "My final coursework answer"})
        assert submitted.status_code == 201, submitted.text

        client.cookies.clear()
        login(client, "replacement.faculty@example.com", "Replacement123", role="teacher")
        roster = client.get(f"/api/academics/coursework/{coursework_id}/submissions")
        assert roster.status_code == 200, roster.text
        submission_id = roster.json()["submissions"][0]["id"]
        graded = client.patch(f"/api/academics/coursework/submissions/{submission_id}/grade", json={"marks": 8, "feedback": "Good work"})
        assert graded.status_code == 200, graded.text

        client.cookies.clear()
        login(client, "student@example.com", "Student@123")
        coursework = next(row for row in client.get("/api/academics/workspace").json()["coursework"] if row["id"] == coursework_id)
        assert coursework["submission_status"] == "graded"
        assert coursework["marks"] == 8
        assert coursework["feedback"] == "Good work"

        # A teacher from the same institution but without this allocation must not
        # be able to enumerate or grade another teacher's student submissions.
        client.cookies.clear()
        login(client, "admin@example.com", "Admin@123")
        outsider = client.post("/api/admin/staff", json={
            "name": "Unallocated Teacher", "email": "unallocated.teacher@example.com", "password": "Unallocated123",
            "access_role": "teacher", "designation": "teacher", "employee_no": "FAC-UNALLOC-1", "biometric_consent": False,
        })
        assert outsider.status_code == 201, outsider.text
        client.cookies.clear()
        login(client, "unallocated.teacher@example.com", "Unallocated123", role="teacher")
        denied_roster = client.get(f"/api/academics/coursework/{coursework_id}/submissions")
        assert denied_roster.status_code == 403, denied_roster.text


def test_campus_portal_fee_announcement_profile_and_handwritten_assignment():
    with TestClient(app) as client:
        login(client, "admin@example.com", "Admin@123")
        student = next(row for row in client.get("/api/students").json() if row["email"] == "student@example.com")
        fee = client.post("/api/admin/fees", json={
            "student_id": student["id"], "term_label": "Semester 5", "description": "Laboratory fee",
            "total_amount": 2500, "paid_amount": 500, "due_date": str(datetime.now(timezone.utc).date() + timedelta(days=20)),
        })
        assert fee.status_code == 201, fee.text
        announcement = client.post("/api/announcements", json={"title": "Campus portal notice", "body": "Laboratory schedule is available.", "audience": "students"})
        assert announcement.status_code == 201, announcement.text

        client.cookies.clear()
        login(client, "student@example.com", "Student@123")
        profile = client.patch("/api/me/profile", json={
            "phone": "9876543210", "guardian_name": "Guardian", "guardian_phone": "9876500000",
            "address": "Bengaluru", "blood_group": "O+", "date_of_birth": "2005-01-02", "messaging_consent": True,
        })
        assert profile.status_code == 200, profile.text
        portal = client.get("/api/portal")
        assert portal.status_code == 200, portal.text
        assert any(row["description"] == "Laboratory fee" and row["balance"] == 2000 for row in portal.json()["fees"])
        assert any(row["title"] == "Campus portal notice" for row in portal.json()["announcements"])

        client.cookies.clear()
        login(client, "replacement.faculty@example.com", "Replacement123", role="teacher")
        assignment = client.get("/api/academics/workspace").json()["assignments"][0]
        coursework = client.post("/api/academics/coursework", json={
            "assignment_id": assignment["id"], "title": "Handwritten portal upload",
            "instructions": "Upload the signed handwritten solution.",
            "due_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(), "max_marks": 15,
        })
        assert coursework.status_code == 201, coursework.text
        coursework_id = coursework.json()["id"]
        assert client.patch(f"/api/academics/coursework/{coursework_id}/publish").status_code == 200

        client.cookies.clear()
        login(client, "student@example.com", "Student@123")
        submitted = client.post(
            f"/api/student/coursework/{coursework_id}/submit-files",
            data={"answer_text": "My handwritten solution is attached."},
            files=[("files", ("solution.pdf", b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF", "application/pdf"))],
        )
        assert submitted.status_code == 201, submitted.text
        assert submitted.json()["attachment_count"] == 1

        client.cookies.clear()
        login(client, "replacement.faculty@example.com", "Replacement123", role="teacher")
        roster = client.get(f"/api/academics/coursework/{coursework_id}/submissions")
        assert roster.status_code == 200, roster.text
        attachment = roster.json()["submissions"][0]["attachments"][0]
        downloaded = client.get(f"/api/academics/coursework/attachments/{attachment['id']}")
        assert downloaded.status_code == 200
        assert downloaded.content.startswith(b"%PDF-")


def test_pending_raised_hand_review_test_autosave_and_final_attendance_notification():
    with TestClient(app) as client:
        login(client, "replacement.faculty@example.com", "Replacement123", role="teacher")
        workspace = client.get("/api/academics/workspace").json()
        assignment = workspace["assignments"][0]
        topic = next(row for row in workspace["topics"] if row["course_id"] == assignment["course_id"] and row["status"] == "completed")
        session_date = datetime.now(timezone.utc).date() + timedelta(days=5)
        class_session = client.post("/api/academics/sessions", json={
            "assignment_id": assignment["id"], "session_date": str(session_date), "period_number": 20, "classroom": "Portal Test Room",
        })
        assert class_session.status_code == 201, class_session.text
        class_session_id = class_session.json()["id"]
        with db.SessionLocal() as session:
            teacher = session.query(User).filter_by(email="replacement.faculty@example.com").one()
            student = session.query(Student).join(User, User.id == Student.user_id).filter(User.email == "student@example.com", Student.institution_id == teacher.institution_id).one()
            teacher_id, student_id, institution_id = teacher.id, student.id, teacher.institution_id
        detected = db.create_raised_hand_request(institution_id, class_session_id, student_id, teacher_id, "camera:test")
        assert detected["created"] is True
        preview = client.get(f"/api/academics/sessions/{class_session_id}/attendance/preview")
        pending = next(row for row in preview.json()["students"] if row["student_id"] == student_id)["raised_hand_request"]
        assert pending["status"] == "pending"
        approved = client.patch(f"/api/academics/attendance/raised-hand/{pending['id']}", json={"decision": "approved", "reason": "Teacher verified the camera gesture"})
        assert approved.status_code == 200, approved.text
        finalised = client.post(f"/api/academics/sessions/{class_session_id}/attendance/finalize")
        assert finalised.status_code == 200, finalised.text
        student_result = next(row for row in finalised.json()["students"] if row["student_id"] == student_id)
        assert student_result["status"] == "Present"
        assert student_result["decision_source"] == "approved_exit"

        assessment = client.post("/api/academics/assessments", json={
            "assignment_id": assignment["id"], "course_id": assignment["course_id"], "section_id": assignment["section_id"],
            "title": "Autosave portal test", "mode": "online", "scheduled_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
            "duration_minutes": 10, "total_marks": 2, "question_count": 1, "marking_mode": "common", "common_marks": 2,
            "show_correct_answers": True, "topic_ids": [topic["id"]],
        })
        assert assessment.status_code == 201, assessment.text
        question = client.post(f"/api/academics/assessments/{assessment.json()['id']}/questions", json={
            "question_text": "Autosave works?", "question_type": "true_false", "options": ["True", "False"], "correct_answer": "True", "marks": 2,
        })
        assert question.status_code == 201, question.text
        assert client.patch(f"/api/academics/assessments/{assessment.json()['id']}/publish").status_code == 200

        client.cookies.clear()
        login(client, "student@example.com", "Student@123")
        started = client.post(f"/api/student/assessments/{assessment.json()['id']}/start")
        assert started.status_code == 201, started.text
        attempt_id = started.json()["attempt_id"]
        saved = client.patch(f"/api/student/attempts/{attempt_id}/autosave", json={"answers": [{"question_id": question.json()["id"], "answer": "True"}]})
        assert saved.status_code == 200, saved.text
        continued = client.post(f"/api/student/assessments/{assessment.json()['id']}/start")
        assert continued.json()["saved_answers"][str(question.json()["id"])] == "True"
        submitted = client.post(f"/api/student/attempts/{attempt_id}/submit", json={"answers": [{"question_id": question.json()["id"], "answer": "True"}]})
        assert submitted.status_code == 200, submitted.text
        assert submitted.json()["score"] == 2
        portal = client.get("/api/portal").json()
        assert any(row["class_session_id"] == class_session_id and row["status"] == "Present" for row in portal["attendance"])
        assert any(row["template"] == "attendance_finalized" for row in portal["notifications"])


def test_minor_face_consent_requires_verified_guardian_consent():
    with TestClient(app) as client:
        login(client, "admin@example.com", "Admin@123")
        fields = default_class_fields(client)
        created = client.post("/api/admin/students", json={
            "name": "Minor Consent Student",
            "email": "minor.consent@example.com",
            "password": "Temporary123",
            "roll_no": "MINOR-CONSENT-001",
            "date_of_birth": "2014-01-01",
            **fields,
        })
        assert created.status_code == 201, created.text
        student_id = created.json()["id"]
        denied = client.patch(f"/api/admin/students/{student_id}/biometric-consent", json={"granted": True, "guardian_confirmed": False})
        assert denied.status_code == 409
        approved = client.patch(f"/api/admin/students/{student_id}/biometric-consent", json={"granted": True, "guardian_confirmed": True})
        assert approved.status_code == 200, approved.text
        assert approved.json()["guardian_biometric_consent"] is True


def test_offline_fee_receipt_requires_admin_review_and_is_idempotent():
    with TestClient(app) as client:
        login(client, "admin@example.com", "Admin@123")
        student = next(row for row in client.get("/api/students").json() if row["email"] == "student@example.com")
        fee = client.post("/api/admin/fees", json={
            "student_id": student["id"],
            "term_label": "Security test term",
            "description": "Verified receipt test",
            "total_amount": 900,
            "paid_amount": 0,
            "due_date": str(datetime.now(timezone.utc).date() + timedelta(days=10)),
        })
        assert fee.status_code == 201, fee.text
        client.cookies.clear()
        login(client, "student@example.com", "Student@123")
        uploaded = client.post(
            f"/api/student/fees/{fee.json()['id']}/payments/offline",
            data={"amount": "900", "reference": "SECURE-RECEIPT-001", "paid_on": str(datetime.now(timezone.utc).date())},
            files={"receipt": ("receipt.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
        )
        assert uploaded.status_code == 201, uploaded.text
        payment_id = uploaded.json()["payment_id"]
        portal = client.get("/api/portal").json()
        pending_fee = next(row for row in portal["fees"] if row["id"] == fee.json()["id"])
        assert pending_fee["balance"] == 900

        client.cookies.clear()
        login(client, "admin@example.com", "Admin@123")
        reviewed = client.patch(f"/api/admin/fee-payments/{payment_id}/review", json={"decision": "approved", "reason": "Receipt matched bank statement"})
        assert reviewed.status_code == 200, reviewed.text
        assert reviewed.json()["status"] == "paid"
        repeated = client.patch(f"/api/admin/fee-payments/{payment_id}/review", json={"decision": "approved", "reason": "Repeated safe request"})
        assert repeated.status_code == 200
        assert repeated.json()["status"] == "paid"

        client.cookies.clear()
        login(client, "student@example.com", "Student@123")
        portal = client.get("/api/portal").json()
        paid_fee = next(row for row in portal["fees"] if row["id"] == fee.json()["id"])
        assert paid_fee["balance"] == 0
        assert any(row["template"] == "fee_payment_reviewed" for row in portal["notifications"])


def test_teacher_timetable_proposal_conflict_and_admin_approval():
    today = datetime.now(timezone.utc).date()
    with TestClient(app) as client:
        login(client, "replacement.faculty@example.com", "Replacement123", role="teacher")
        assignment = client.get("/api/academics/workspace").json()["assignments"][0]
        proposal = {
            "assignment_id": assignment["id"],
            "weekday": (today.weekday() + 2) % 7,
            "period_number": 17,
            "start_time": "07:00:00",
            "end_time": "07:45:00",
            "classroom": "Secure Timetable Room",
            "effective_from": str(today + timedelta(days=1)),
            "effective_to": str(today + timedelta(days=40)),
        }
        created = client.post("/api/academics/timetable/proposals", json=proposal)
        assert created.status_code == 201, created.text
        assert created.json()["publication_status"] == "pending"
        conflict = client.post("/api/academics/timetable/proposals", json=proposal)
        assert conflict.status_code == 409

        client.cookies.clear()
        login(client, "admin@example.com", "Admin@123")
        approved = client.patch(f"/api/admin/academics/timetable/{created.json()['id']}/review", json={"decision": "approved", "reason": "Academic office approved"})
        assert approved.status_code == 200, approved.text
        assert approved.json()["publication_status"] == "published"
        assert approved.json()["sessions_generated"] > 0


def test_camera_failure_never_auto_marks_absent_and_correction_is_audited_once():
    with TestClient(app) as client:
        login(client, "replacement.faculty@example.com", "Replacement123", role="teacher")
        assignment = client.get("/api/academics/workspace").json()["assignments"][0]
        class_session = client.post("/api/academics/sessions", json={
            "assignment_id": assignment["id"],
            "session_date": str(datetime.now(timezone.utc).date() + timedelta(days=35)),
            "period_number": 18,
            "classroom": "Camera Failure Room",
        })
        assert class_session.status_code == 201, class_session.text
        class_session_id = class_session.json()["id"]
        with db.SessionLocal() as session:
            row = session.get(ClassSession, class_session_id)
            row.camera_state = "offline"
            row.failure_reason = "Test camera disconnected"
            session.commit()
        finalised = client.post(f"/api/academics/sessions/{class_session_id}/attendance/finalize")
        assert finalised.status_code == 200, finalised.text
        assert finalised.json()["students"]
        assert all(row["status"] == "Needs review" for row in finalised.json()["students"])
        student_id = finalised.json()["students"][0]["student_id"]
        corrected = client.patch(f"/api/academics/sessions/{class_session_id}/attendance/{student_id}/correct", json={"status": "Present", "reason": "Teacher verified the signed classroom register"})
        assert corrected.status_code == 200, corrected.text
        repeated_finalise = client.post(f"/api/academics/sessions/{class_session_id}/attendance/finalize")
        assert repeated_finalise.status_code == 200
        with db.SessionLocal() as session:
            corrections = session.query(AttendanceCorrection).filter_by(class_session_id=class_session_id, student_id=student_id).count()
            notifications = session.query(NotificationDelivery).filter(NotificationDelivery.dedup_key == f"attendance-final:{class_session_id}:{student_id}").count()
            assert corrections == 1
            assert notifications == 1


def test_production_security_configuration_rejects_insecure_origin():
    secure = Settings(
        app_env="production",
        seed_demo_data=False,
        app_secret="s" * 48,
        biometric_encryption_key=Fernet.generate_key().decode(),
        database_url="mysql+pymysql://ours_app:database-pass-12345@db:3306/ours_classroom",
        frontend_base_url="https://portal.ours.example",
        cors_origins="https://portal.ours.example",
        trusted_hosts="portal.ours.example,*.ours.example",
        shared_portal_hosts="portal.ours.example",
        smtp_host="smtp.example.com",
        smtp_from_email="no-reply@ours.example",
        allow_model_downloads=False,
        redis_url="redis://redis:6379/0",
        object_storage_endpoint="http://minio:9000",
        object_storage_access_key="test-access-key",
        object_storage_secret_key="test-secret-key-12345",
        clamav_host="clamav",
    )
    secure.validate_runtime()
    insecure = secure.model_copy(update={"frontend_base_url": "http://portal.ours.example"})
    with pytest.raises(RuntimeError, match="HTTPS"):
        insecure.validate_runtime()


def test_production_security_configuration_rejects_invalid_biometric_key():
    settings = Settings(
        app_env="production",
        seed_demo_data=False,
        app_secret="s" * 48,
        biometric_encryption_key="not-a-valid-fernet-key",
        database_url="mysql+pymysql://ours_app:database-pass-12345@db:3306/ours_classroom",
        frontend_base_url="https://portal.ours.example",
        cors_origins="https://portal.ours.example",
        trusted_hosts="portal.ours.example",
        shared_portal_hosts="portal.ours.example",
        smtp_host="smtp.example.com",
        smtp_from_email="no-reply@ours.example",
        allow_model_downloads=False,
    )
    with pytest.raises(RuntimeError, match="Fernet"):
        settings.validate_runtime()


def test_production_security_configuration_rejects_non_mysql_database():
    settings = Settings(
        app_env="production",
        seed_demo_data=False,
        app_secret="s" * 48,
        biometric_encryption_key=Fernet.generate_key().decode(),
        database_url="postgresql://ours_app:database-pass-12345@db:5432/ours_classroom",
        frontend_base_url="https://portal.ours.example",
        cors_origins="https://portal.ours.example",
        trusted_hosts="portal.ours.example",
        shared_portal_hosts="portal.ours.example",
        smtp_host="smtp.example.com",
        smtp_from_email="no-reply@ours.example",
        allow_model_downloads=False,
    )
    with pytest.raises(RuntimeError, match="MySQL"):
        settings.validate_runtime()


def test_production_security_configuration_rejects_shared_domain_cookie():
    settings = Settings(
        app_env="production",
        seed_demo_data=False,
        app_secret="s" * 48,
        biometric_encryption_key=Fernet.generate_key().decode(),
        database_url="mysql+pymysql://ours_app:database-pass-12345@db:3306/ours_classroom",
        frontend_base_url="https://portal.ours.example",
        cors_origins="https://portal.ours.example",
        trusted_hosts="portal.ours.example",
        shared_portal_hosts="portal.ours.example",
        smtp_host="smtp.example.com",
        smtp_from_email="no-reply@ours.example",
        allow_model_downloads=False,
        session_cookie_domain=".ours.example",
        redis_url="redis://redis:6379/0",
        object_storage_endpoint="http://minio:9000",
        object_storage_access_key="test-access-key",
        object_storage_secret_key="test-secret-key-12345",
        clamav_host="clamav",
    )
    with pytest.raises(RuntimeError, match="host-only"):
        settings.validate_runtime()


def test_production_security_configuration_rejects_weak_database_password():
    settings = Settings(
        app_env="production",
        seed_demo_data=False,
        app_secret="s" * 48,
        biometric_encryption_key=Fernet.generate_key().decode(),
        database_url="mysql+pymysql://ours_app:secret@db:3306/ours_classroom",
        frontend_base_url="https://portal.ours.example",
        cors_origins="https://portal.ours.example",
        trusted_hosts="portal.ours.example",
        shared_portal_hosts="portal.ours.example",
        smtp_host="smtp.example.com",
        smtp_from_email="no-reply@ours.example",
        allow_model_downloads=False,
        redis_url="redis://redis:6379/0",
        object_storage_endpoint="http://minio:9000",
        object_storage_access_key="test-access-key",
        object_storage_secret_key="test-secret-key-12345",
        clamav_host="clamav",
    )
    with pytest.raises(RuntimeError, match="MySQL application password"):
        settings.validate_runtime()


def test_login_requires_explicit_terms_acceptance():
    with TestClient(app) as client:
        response = client.post("/api/auth/login", json={
            "email": "student@example.com",
            "password": "Student@123",
            "role": "student",
            "terms_accepted": False,
        })
        assert response.status_code == 400
        assert "accept" in response.json()["detail"].lower()


def test_totp_matches_rfc6238_sha1_six_digit_vector():
    code, counter = main._totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59)
    assert code == "287082"
    assert counter == 1


def test_login_records_terms_acceptance_version():
    from models import UserLegalAcceptance
    with TestClient(app) as client:
        login(client, "student@example.com", "Student@123")
        with db.SessionLocal() as session:
            user = session.query(User).filter_by(email="student@example.com").first()
            accepted = session.query(UserLegalAcceptance).filter_by(user_id=user.id).all()
            assert accepted
            assert accepted[-1].document_version == main.LEGAL_DOCUMENT_VERSION
