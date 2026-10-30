from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


def normalize_phone(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    raw = value.strip()
    digits = "".join(character for character in raw if character.isdigit())
    if raw.startswith("+"):
        normalized = f"+{digits}"
    elif len(digits) == 10:
        normalized = f"+91{digits}"
    else:
        normalized = f"+{digits}"
    if len(normalized) < 9 or len(normalized) > 16 or not normalized[1:].isdigit():
        raise ValueError("Enter a valid phone number with country code, for example +919876543210")
    return normalized


def validate_password_strength(value: str) -> str:
    if not any(char.isupper() for char in value) or not any(char.islower() for char in value) or not any(char.isdigit() for char in value):
        raise ValueError("Password must contain upper-case, lower-case and numeric characters")
    return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["admin", "teacher", "student"]
    terms_accepted: bool = False
    mfa_code: str | None = Field(default=None, min_length=6, max_length=8)



class InstitutionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    organization_type: Literal["college", "school", "training_center"] = "college"
    domain: str = Field(min_length=3, max_length=255)
    brand_name: str = Field(default="OUR'S", min_length=2, max_length=80)
    primary_color: str = Field(default="#4f46c8", pattern=r"^#[0-9a-fA-F]{6}$")
    admin_name: str = Field(min_length=2, max_length=120)
    admin_email: EmailStr
    admin_password: str = Field(min_length=12, max_length=128)

    @field_validator("domain")
    @classmethod
    def valid_domain(cls, value: str) -> str:
        domain = value.lower().strip().split(":", 1)[0].rstrip(".")
        if domain == "localhost":
            return domain
        labels = domain.split(".")
        if len(labels) < 2 or any(not label or label.startswith("-") or label.endswith("-") or not label.replace("-", "").isalnum() for label in labels):
            raise ValueError("Enter a valid domain such as college.oursapp.in")
        return domain


class StudentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(default="", max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    roll_no: str = Field(min_length=2, max_length=64)
    department: str = Field(min_length=2, max_length=120)
    department_id: int | None = Field(default=None, gt=0)
    section_id: int = Field(gt=0)
    term_id: int = Field(gt=0)
    date_of_birth: date | None = None


class StudentUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=1, max_length=255)
    roll_no: str = Field(min_length=2, max_length=64)
    department: str = Field(min_length=2, max_length=120)
    department_id: int | None = Field(default=None, gt=0)
    section_id: int | None = Field(default=None, gt=0)
    term_id: int | None = Field(default=None, gt=0)
    date_of_birth: date | None = None


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=2, max_length=30, pattern=r"^[A-Za-z0-9-]+$")
    email_domain: str = Field(min_length=3, max_length=255)

    @field_validator("email_domain")
    @classmethod
    def valid_email_domain(cls, value: str) -> str:
        domain = value.lower().strip().lstrip("@").rstrip(".")
        labels = domain.split(".")
        if len(labels) < 2 or any(not label or label.startswith("-") or label.endswith("-") or not label.replace("-", "").isalnum() for label in labels):
            raise ValueError("Enter a valid email domain such as cse.dsu.ac.in")
        return domain


class TeacherCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class StaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    access_role: Literal["teacher", "admin", "staff"] = "teacher"
    designation: Literal["teacher", "hod", "dean", "principal", "staff", "administrator"] = "teacher"
    employee_no: str | None = Field(default=None, max_length=64)
    department_id: int | None = Field(default=None, gt=0)
    biometric_consent: bool = False


class CourseCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    code: str = Field(min_length=2, max_length=40)
    total_lessons: int = Field(ge=1, le=1000)


class CourseUpdate(CourseCreate):
    pass


class EnrollmentCreate(BaseModel):
    student_id: int = Field(gt=0)
    course_id: int = Field(gt=0)


class EnrollmentUpdate(BaseModel):
    completed_lessons: int = Field(ge=0, le=1000)
    score: float = Field(ge=0, le=100)


class ConsentUpdate(BaseModel):
    granted: bool


class StudentBiometricConsentUpdate(ConsentUpdate):
    guardian_confirmed: bool = False


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return validate_password_strength(value)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    role: Literal["admin", "teacher", "student"]


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    new_password: str = Field(min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return validate_password_strength(value)


class TemporaryPasswordReset(BaseModel):
    temporary_password: str = Field(min_length=12, max_length=128)

    @field_validator("temporary_password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return validate_password_strength(value)


class InstitutionUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    brand_name: str = Field(default="OUR'S", min_length=2, max_length=80)
    primary_color: str = Field(default="#4f46c8", pattern=r"^#[0-9a-fA-F]{6}$")


class AdministratorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class AcademicTermCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    academic_year: str = Field(min_length=4, max_length=20)
    start_date: date
    end_date: date


class AcademicTermUpdate(AcademicTermCreate):
    pass


class ClassSectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    department: str = Field(min_length=2, max_length=120)
    semester: int = Field(ge=1, le=12)
    batch_year: int = Field(ge=2000, le=2100)


class TeacherAssignmentCreate(BaseModel):
    teacher_id: int = Field(gt=0)
    course_id: int = Field(gt=0)
    section_id: int = Field(gt=0)
    term_id: int = Field(gt=0)


class TeacherReplacement(BaseModel):
    new_teacher_id: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)


class ProgressionBatchCreate(BaseModel):
    student_ids: list[int] = Field(min_length=1, max_length=500)
    source_term_id: int = Field(gt=0)
    destination_term_id: int = Field(gt=0)
    destination_section_id: int = Field(gt=0)
    reason: str | None = Field(default=None, max_length=1000)


class ProgressionBatchReview(BaseModel):
    decision: Literal["approved", "rejected"]
    reason: str | None = Field(default=None, max_length=1000)


class SectionMembershipCreate(BaseModel):
    student_id: int = Field(gt=0)
    section_id: int = Field(gt=0)
    term_id: int = Field(gt=0)


class TimetableSlotCreate(BaseModel):
    assignment_id: int = Field(gt=0)
    weekday: int = Field(ge=0, le=6)
    period_number: int = Field(ge=1, le=20)
    start_time: time
    end_time: time
    classroom: str = Field(min_length=1, max_length=80)
    effective_from: date | None = None
    effective_to: date | None = None


class TimetableReview(BaseModel):
    decision: Literal["approved", "rejected"]
    reason: str | None = Field(default=None, max_length=1000)


class ClassroomChangeCreate(BaseModel):
    classroom: str = Field(min_length=1, max_length=80)
    reason: str = Field(min_length=3, max_length=1000)


class SyllabusUnitCreate(BaseModel):
    course_id: int = Field(gt=0)
    title: str = Field(min_length=2, max_length=180)
    sequence_no: int = Field(ge=1, le=100)


class SyllabusTopicCreate(BaseModel):
    unit_id: int = Field(gt=0)
    title: str = Field(min_length=2, max_length=220)
    description: str | None = Field(default=None, max_length=3000)
    sequence_no: int = Field(ge=1, le=500)
    planned_date: date | None = None
    planned_periods: int = Field(default=1, ge=1, le=20)


class ClassSessionCreate(BaseModel):
    assignment_id: int = Field(gt=0)
    timetable_slot_id: int | None = Field(default=None, gt=0)
    session_date: date
    period_number: int = Field(ge=1, le=20)
    classroom: str = Field(min_length=1, max_length=80)


class TopicCoverageUpdate(BaseModel):
    topic_id: int = Field(gt=0)
    status: Literal["completed", "partial", "postponed"]
    coverage_percent: int = Field(ge=0, le=100)
    notes: str | None = Field(default=None, max_length=3000)
    class_status: Literal["completed", "cancelled"] = "completed"


class AssessmentCreate(BaseModel):
    assignment_id: int | None = Field(default=None, gt=0)
    course_id: int = Field(gt=0)
    section_id: int = Field(gt=0)
    title: str = Field(min_length=2, max_length=180)
    instructions: str | None = Field(default=None, max_length=10000)
    mode: Literal["offline", "online"] = "offline"
    scheduled_at: datetime
    available_until: datetime | None = None
    duration_minutes: int = Field(ge=5, le=300)
    total_marks: float = Field(default=100, gt=0, le=1000)
    question_count: int = Field(default=0, ge=0, le=500)
    marking_mode: Literal["common", "separate"] = "separate"
    common_marks: float | None = Field(default=None, gt=0, le=100)
    show_correct_answers: bool = True
    topic_ids: list[int] = Field(min_length=1, max_length=50)


class AssessmentUpdate(AssessmentCreate):
    pass


class AssessmentStatusUpdate(BaseModel):
    action: Literal["publish", "unpublish", "lock"]
    reason: str | None = Field(default=None, max_length=1000)


class LearningAssignmentCreate(BaseModel):
    assignment_id: int = Field(gt=0)
    title: str = Field(min_length=2, max_length=180)
    instructions: str = Field(min_length=2, max_length=10000)
    due_at: datetime
    max_marks: float = Field(gt=0, le=1000)


class LearningSubmissionCreate(BaseModel):
    answer_text: str = Field(min_length=1, max_length=20000)


class LearningSubmissionGrade(BaseModel):
    marks: float = Field(ge=0, le=1000)
    feedback: str | None = Field(default=None, max_length=5000)


class QuestionCreate(BaseModel):
    question_text: str = Field(min_length=2, max_length=5000)
    question_type: Literal["mcq", "true_false", "short_answer"]
    options: list[str] | None = Field(default=None, max_length=10)
    correct_answer: str | None = Field(default=None, max_length=2000)
    marks: float = Field(gt=0, le=100)


class OfflineResultCreate(BaseModel):
    student_id: int = Field(gt=0)
    marks: float = Field(ge=0, le=1000)


class AttendanceOverride(BaseModel):
    decision_source: Literal["approved_exit", "health", "teacher_override"]
    reason: str = Field(min_length=3, max_length=1000)


class AttendanceCorrectionCreate(BaseModel):
    status: Literal["Present", "Absent", "Late", "Needs review"]
    reason: str = Field(min_length=3, max_length=1000)


class InstitutionMonitoringPolicy(BaseModel):
    attendance_required_percent: int = Field(ge=1, le=100)
    fight_alert_seconds: int = Field(ge=10, le=1800)
    crowd_threshold: int = Field(ge=2, le=500)
    crowd_alert_seconds: int = Field(ge=5, le=1800)
    biometric_retention_days: int = Field(default=365, ge=30, le=3650)
    minor_guardian_consent_required: bool = True


class SubmittedAnswer(BaseModel):
    question_id: int = Field(gt=0)
    answer: str = Field(max_length=10000)


class AttemptSubmit(BaseModel):
    answers: list[SubmittedAnswer] = Field(max_length=500)


class AttemptAutosave(BaseModel):
    answers: list[SubmittedAnswer] = Field(max_length=500)


class StudentProfileUpdate(BaseModel):
    phone: str | None = Field(default=None, max_length=30)
    guardian_name: str | None = Field(default=None, max_length=120)
    guardian_phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=3000)
    blood_group: str | None = Field(default=None, max_length=10)
    date_of_birth: date | None = None
    messaging_consent: bool = False

    @field_validator("phone", "guardian_phone")
    @classmethod
    def valid_phone(cls, value: str | None) -> str | None:
        return normalize_phone(value)


class StudentProfilePermissionUpdate(BaseModel):
    enabled: bool


class OnDutyReviewUpdate(BaseModel):
    decision: Literal["approved", "rejected"]
    reason: str | None = Field(default=None, max_length=2000)

    @field_validator("reason")
    @classmethod
    def require_rejection_reason(cls, value: str | None, info):
        if info.data.get("decision") == "rejected" and not (value or "").strip():
            raise ValueError("A reason is required when rejecting an on-duty request")
        return value.strip() if value else None


class PushDeviceCreate(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    platform: Literal["web", "android", "ios"] = "web"
    device_label: str | None = Field(default=None, max_length=120)


class PushPreferenceUpdate(BaseModel):
    attendance_enabled: bool = True
    security_enabled: bool = True


class OnlinePaymentCreate(BaseModel):
    amount: float = Field(gt=0, le=100000000)
    idempotency_key: str = Field(min_length=12, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")


class OfflinePaymentReview(BaseModel):
    decision: Literal["approved", "rejected"]
    reason: str | None = Field(default=None, max_length=2000)

    @field_validator("reason")
    @classmethod
    def rejection_reason(cls, value: str | None, info):
        return value.strip() if value else None


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    body: str = Field(min_length=2, max_length=10000)
    audience: Literal["all", "students", "teachers", "administrators"] = "all"
    section_id: int | None = Field(default=None, gt=0)
    expires_at: datetime | None = None


class FeeRecordUpsert(BaseModel):
    student_id: int = Field(gt=0)
    term_label: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=2, max_length=180)
    total_amount: float = Field(ge=0, le=100000000)
    paid_amount: float = Field(default=0, ge=0, le=100000000)
    due_date: date | None = None


class RaisedHandReview(BaseModel):
    decision: Literal["approved", "rejected"]
    reason: str | None = Field(default=None, max_length=1000)


class TeacherFeedbackCreate(BaseModel):
    assignment_id: int = Field(gt=0)
    week_start: date
    clarity: int = Field(ge=1, le=5)
    pace: int = Field(ge=1, le=5)
    interaction: int = Field(ge=1, le=5)
    doubt_resolution: int = Field(ge=1, le=5)
    helpfulness: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class CareerProfileUpdate(BaseModel):
    professional_summary: str | None = Field(default=None, max_length=5000)


class CareerTransferCreate(BaseModel):
    platform_staff_id: str = Field(min_length=8, max_length=40)
    previous_institution_slug: str = Field(min_length=2, max_length=80)
    previous_employee_id: str = Field(min_length=1, max_length=64)
    consent: bool
    notes: str | None = Field(default=None, max_length=2000)


class CareerTransferReview(BaseModel):
    approve: bool
    notes: str | None = Field(default=None, max_length=2000)


class SupportSessionCreate(BaseModel):
    institution_id: int = Field(gt=0)
    represented_admin_id: int | None = Field(default=None, gt=0)
    reason: str = Field(min_length=10, max_length=500)
    ticket_reference: str | None = Field(default=None, max_length=120)
    duration_minutes: int = Field(default=30, ge=5, le=60)


class SupportSessionReview(BaseModel):
    decision: Literal["approved", "rejected", "revoked"]
    reason: str | None = Field(default=None, max_length=500)


class InstitutionLifecycleRequest(BaseModel):
    action: Literal["archive", "restore", "delete"]
    typed_name: str = Field(min_length=2, max_length=180)
    reason: str = Field(min_length=10, max_length=1000)
    current_password: str = Field(min_length=8, max_length=128)
    backup_confirmed: bool = False


class BehaviourModelPromotion(BaseModel):
    approve: bool
    reason: str = Field(min_length=10, max_length=1000)
