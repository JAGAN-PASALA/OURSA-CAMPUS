"use client";
/* eslint-disable @next/next/no-img-element */

import {
  FormEvent,
  InputHTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  FileQuestion,
  FileText,
  Eye,
  EyeOff,
  GraduationCap,
  Home as HomeIcon,
  IndianRupee,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  Play,
  ScanFace,
  Search,
  Settings2,
  ShieldCheck,
  Square,
  Star,
  Trophy,
  UserCircle,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { TimetableManager } from "@/app/timetable-manager";
import { NotificationCenter, PushLifecycle } from "@/app/notification-center";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AdminServicesPageV6,
  AnnouncementManager,
  CareerPage,
  downloadProtectedAttachment,
  OnDutyPage,
  StaffProfilePage,
  StudentPortalDashboard,
  StudentServicePage,
  TeacherQualityPage,
} from "@/app/portal-ui";

// The browser always uses the current origin. Vite proxies /api locally and
// Caddy proxies /api in production, so cookies remain valid on localhost,
// approved LAN addresses, and institution HTTPS domains.
const API = "";

function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input-wrap">
      <Input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-visibility"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  );
}
type TenantBrand = {
  id: number;
  name: string;
  slug: string;
  organization_type: string;
  brand_name: string;
  primary_color: string;
  logo_url?: string;
  domain?: string;
  attendance_required_percent?: number;
  fight_alert_seconds?: number;
  crowd_threshold?: number;
  crowd_alert_seconds?: number;
};
type User = {
  id: number;
  name: string;
  email: string;
  role: "student" | "teacher" | "staff" | "admin";
  institution_id: number;
  institution_name: string;
  platform_admin: boolean;
  credential_change_required?: boolean;
  designation?: "teacher" | "hod" | "dean" | "principal" | "staff" | "administrator";
  department_id?: number;
};
type StudentSummary = {
  id: number;
  name: string;
  attendance: number;
  progress: number;
  average_score: number;
  attention: number;
  behaviour_observed?: boolean;
  behaviours?: Record<string, number>;
  status: string;
};
type Course = {
  id: number;
  title: string;
  progress: number;
  completed_lessons: number;
  total_lessons: number;
  score: number;
};
type Incident = {
  id: number;
  student_name: string;
  behaviour: string;
  confidence: number;
  occurred_at: string;
};
type StudentAnalytics = {
  overall: {
    attendance_percent: number;
    present_classes: number;
    total_classes: number;
    average_score: number;
    behaviours: Record<string, number>;
  };
  subjects: {
    course_id: number;
    course_code: string;
    course_title: string;
    attendance_percent: number;
    present_classes: number;
    total_classes: number;
    average_score: number;
    behaviours: Record<string, number>;
  }[];
};
type Dashboard = {
  student?: StudentSummary;
  students?: StudentSummary[];
  courses?: Course[];
  incidents?: Incident[];
  attendance_history?: { date: string; status: string }[];
  analytics?: StudentAnalytics;
  model?: { trained: boolean; samples: number; accuracy?: number };
};
type Detection = {
  faces: {
    entity_type?: "student" | "staff";
    student_id?: number;
    user_id?: number;
    role?: string;
    designation?: string;
    name: string;
    confidence: number;
    box: number[];
  }[];
  people: {
    track_id?: string;
    entity_type?: "student" | "staff";
    student_id?: number;
    user_id?: number;
    student_name?: string;
    behaviour: string;
    confidence: number;
    phone_detected?: boolean;
    spoof_rejected?: boolean;
    face_visible?: boolean;
    identity_source?: "face" | "temporal_track" | null;
    raised_hand?: boolean;
    box: number[];
  }[];
  phones: number;
  attendance_marked: string[];
  exit_permission_candidates?: {
    student_id: number;
    student_name: string;
    auto_approved?: boolean;
    request_id?: number;
    status?: string;
  }[];
  alerts?: { id: number; type: string; message: string }[];
  behaviour_model_status?: "ready" | "safe_mode";
  behaviour_model_message?: string;
  sample_saved?: boolean;
  annotated_image?: string;
  message?: string;
  resolved_class_session_id?: number | null;
  room_linked?: boolean;
  resolved_from_room?: boolean;
};
type AttendancePreview = {
  class_session_id: number;
  status: string;
  attendance_state?: string;
  camera_state?: string;
  failure_reason?: string;
  students: {
    student_id: number;
    student_name: string;
    roll_no: string;
    status: string;
    attendance_percent: number;
    required_percent?: number;
    shortfall_percent?: number;
    observed_seconds?: number;
    required_seconds?: number;
    first_seen_at?: string | null;
    last_seen_at?: string | null;
    decision_source?: string;
    raised_hand_request?: { id: number; status: string; detected_at: string };
  }[];
};
type ManagedStudent = {
  id: number;
  name: string;
  email: string;
  roll_no: string;
  department: string;
  department_id?: number;
  section_id?: number;
  section_name?: string;
  term_id?: number;
  term_name?: string;
  biometric_consent: boolean;
  face_registered: boolean;
  face_samples?: number;
  date_of_birth?: string;
  age_status?: "minor" | "adult" | "unknown";
  guardian_biometric_consent?: boolean;
  self_edit_enabled?: boolean;
};
type ManagedStaff = Omit<User, "role"> & {
  role: "teacher" | "admin" | "staff";
  designation: string;
  employee_no?: string;
  department_id?: number;
  biometric_consent: boolean;
  face_registered: boolean;
  face_samples: number;
};
type ManagedCourse = {
  id: number;
  title: string;
  code: string;
  total_lessons: number;
};
type ManagedEnrollment = {
  id: number;
  student_id: number;
  student_name: string;
  course_id: number;
  course_code: string;
  completed_lessons: number;
  total_lessons: number;
  score: number;
};
type DepartmentOption = {
  id: number;
  name: string;
  code: string;
  email_domain: string;
  email_domain_configured?: boolean;
};
type AuditEntry = {
  id: number;
  actor: string;
  action: string;
  entity_type: string;
  created_at: string;
};
type AcademicAssignment = {
  id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  section_id: number;
  section_name: string;
  teacher_name: string;
  term_id?: number;
  term_name?: string;
};
type AcademicSession = {
  id: number;
  assignment_id: number;
  section_id: number;
  date: string;
  period_number: number;
  classroom: string;
  scheduled_classroom?: string;
  temporary_classroom?: string;
  status: string;
  attendance_state?: string;
  camera_state?: string;
  failure_reason?: string;
  teacher_notes?: string;
  course_code: string;
  course_title: string;
  section_name: string;
  teacher_name: string;
};
type CameraHealth = {
  id: number;
  camera_key: string;
  classroom: string;
  source_kind: string;
  state: string;
  active_class_session_id?: number;
  last_frame_at?: string;
  last_success_at?: string;
  error_code?: string;
  error_message?: string;
  reconnect_count: number;
  processing_fps: number;
};
type AcademicTopic = {
  id: number;
  unit_id: number;
  course_id: number;
  course_code: string;
  unit_title: string;
  title: string;
  planned_date?: string;
  planned_periods: number;
  status: string;
  coverage_percent: number;
};
type AcademicAssessment = {
  id: number;
  course_id: number;
  section_id: number;
  title: string;
  mode: "online" | "offline";
  scheduled_at: string;
  duration_minutes: number;
  total_marks: number;
  question_count: number;
  questions_added?: number;
  marking_mode: "common" | "separate";
  common_marks?: number;
  show_correct_answers: boolean;
  attempt_status?: string;
  result_score?: number;
  status: string;
  course_code: string;
  section_name: string;
};
type LearningAssignment = {
  id: number;
  teacher_assignment_id: number;
  course_id: number;
  section_id: number;
  term_id: number;
  title: string;
  instructions: string;
  due_at: string;
  max_marks: number;
  status: string;
  course_code: string;
  section_name: string;
  teacher_name: string;
  submission_id?: number;
  submission_status?: string;
  submitted_at?: string;
  marks?: number;
  feedback?: string;
  submission_count?: number;
};
type CourseworkRoster = {
  assignment_id: number;
  title: string;
  max_marks: number;
  submissions: {
    id: number;
    student_id: number;
    student_name: string;
    roll_no: string;
    answer_text: string;
    submitted_at: string;
    status: string;
    marks?: number;
    feedback?: string;
    attachments: {
      id: number;
      file_name: string;
      mime_type: string;
      size_bytes: number;
    }[];
  }[];
};
type AcademicWorkspace = {
  summary: {
    assignments: number;
    topics_total: number;
    topics_completed: number;
    coverage_percent: number;
    classes_completed: number;
    classes_scheduled: number;
  };
  assignments: AcademicAssignment[];
  sessions: AcademicSession[];
  topics: AcademicTopic[];
  assessments: AcademicAssessment[];
  coursework: LearningAssignment[];
};
type AcademicCatalog = {
  departments: DepartmentOption[];
  terms: {
    id: number;
    name: string;
    academic_year: string;
    start_date: string;
    end_date: string;
  }[];
  sections: {
    id: number;
    name: string;
    department: string;
    semester: number;
    batch_year: number;
  }[];
  teachers: { id: number; name: string }[];
  courses: ManagedCourse[];
  assignments: (AcademicAssignment & { teacher_id: number; term_id: number })[];
  timetable: {
    id: number;
    assignment_id: number;
    course_code: string;
    section_name: string;
    teacher_name: string;
    weekday: number;
    period_number: number;
    start_time: string;
    end_time: string;
    classroom: string;
    effective_from: string;
    effective_to: string;
    publication_status: "pending" | "published" | "rejected";
    proposed_by?: number;
    approved_by?: number;
    review_reason?: string;
  }[];
  units: {
    id: number;
    course_id: number;
    course_code: string;
    title: string;
    sequence_no: number;
  }[];
};
type StartedAssessment = {
  attempt_id: number;
  ends_at: string;
  seconds_remaining: number;
  assessment: { title: string; duration_minutes: number; total_marks: number };
  questions: {
    id: number;
    question_text: string;
    question_type: string;
    options?: string[];
    marks: number;
  }[];
};
type AnswerReview = {
  question_id: number;
  question_text: string;
  selected_answer: string;
  correct_answer?: string;
  is_correct?: boolean;
  awarded_marks?: number;
  marks: number;
};
type AssessmentScore = {
  score: number;
  total_marks: number;
  status?: string;
  timed_out?: boolean;
  answers: AnswerReview[];
};
type AssessmentRoster = {
  assessment_id: number;
  title: string;
  total_marks: number;
  results: {
    student_id: number;
    student_name: string;
    roll_no: string;
    marks: number;
    percentage: number;
    status: string;
  }[];
};
type ManagedInstitution = TenantBrand & {
  active: boolean;
  administrators: { id: number; name: string; email: string }[];
};
type SupportSessionRecord = {
  id: number;
  institution_id: number;
  institution_name: string;
  represented_admin_id?: number;
  represented_admin_name?: string;
  platform_user_name: string;
  reason: string;
  ticket_reference?: string;
  status: "pending" | "approved" | "rejected" | "revoked" | "expired";
  read_only: boolean;
  requested_at: string;
  approved_at?: string;
  expires_at: string;
  revoked_at?: string;
};
type BehaviourModelRelease = {
  id: number;
  version: string;
  dataset_version: string;
  status: "candidate" | "active" | "rejected" | "superseded";
  sha256: string;
  samples: number;
  groups: number;
  accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  metrics: {
    classes?: string[];
    sample_counts?: Record<string, number>;
    independent_groups_by_class?: Record<string, number>;
    classification_report?: Record<string, { recall?: number }>;
    notice?: string;
  };
  created_at: string;
  promoted_at?: string;
};
type PlatformOverviewData = {
  institutions_total: number;
  institutions_active: number;
  institutions_archived: number;
  customer_users: number;
  pending_support_requests: number;
  active_model?: BehaviourModelRelease;
  scope_notice: string;
};
type PlatformSystemHealth = {
  api: string;
  database: string;
  email: string;
  payments: string;
  sms_whatsapp: string;
  behaviour_model: string;
  model_samples: number;
  environment: string;
};
type ManagedUser = User;
type LoginRole = "admin" | "teacher" | "student";

function institutionDomain() {
  return typeof window === "undefined" ? "localhost" : window.location.host;
}

function selectedInstitutionSlug() {
  return typeof window === "undefined"
    ? ""
    : window.localStorage.getItem("ours_institution_slug") || "";
}

function institutionHeaders() {
  const headers: Record<string, string> = {
    "X-Institution-Domain": institutionDomain(),
  };
  const slug = selectedInstitutionSlug();
  if (slug) headers["X-Institution-Slug"] = slug;
  return headers;
}

function notifySessionExpiry(response: Response) {
  if (response.status === 401 && typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ours:session-expired"));
}

function defaultAssessmentTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function localDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function departmentMatches(
  sectionDepartment: string,
  department?: DepartmentOption,
) {
  if (!department) return false;
  const normalized = sectionDepartment.trim().toLowerCase();
  return (
    normalized === department.name.trim().toLowerCase() ||
    normalized === department.code.trim().toLowerCase()
  );
}

async function apiRequest<T>(
  path: string,
  method = "GET",
  body?: object,
): Promise<T> {
  const headers: Record<string, string> = institutionHeaders();
  if (body) headers["Content-Type"] = "application/json";
  const response = await apiFetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    notifySessionExpiry(response);
    const detail = data.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message
          ? `${detail.message}${detail.dependencies ? ` (${Object.entries(detail.dependencies).filter(([, value]) => Number(value) > 0).map(([key, value]) => `${key}: ${value}`).join(", ")})` : ""}`
          : "Request failed";
    throw new Error(message);
  }
  return data;
}

function MetricCard({
  icon,
  label,
  value,
  note,
  tone = "indigo",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}

function AttendanceDonut({ value, label }: { value: number; label: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="donut-card">
      <div
        className="donut"
        style={{ background: `conic-gradient(#2f9d75 ${safe}%, #e7e9f3 0)` }}
      >
        <span>{safe}%</span>
      </div>
      <div>
        <strong>{label}</strong>
        <small>
          {safe}% present · {Math.round(100 - safe)}% absent
        </small>
      </div>
    </div>
  );
}

function BehaviourBars({ values }: { values: Record<string, number> }) {
  const colours: Record<string, string> = {
    attentive: "#2f9d75",
    sleeping: "#7867c8",
    talking: "#e49a38",
    fighting: "#d85858",
    "mobile phone usage": "#3976c8",
  };
  const rows = Object.entries(values);
  return (
    <div className="behaviour-bars">
      {rows.length ? (
        rows.map(([name, value]) => (
          <div key={name}>
            <span>{name}</span>
            <i>
              <b
                style={{
                  width: `${value}%`,
                  background: colours[name] || "#737b96",
                }}
              />
            </i>
            <strong>{value}%</strong>
          </div>
        ))
      ) : (
        <p className="empty-note">No behaviour observations recorded yet.</p>
      )}
    </div>
  );
}

function InstitutionPicker({
  onSelect,
}: {
  onSelect: (tenant: TenantBrand) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TenantBrand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiFetch(
          `${API}/api/public/institutions?q=${encodeURIComponent(query.trim())}`,
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.detail || "Institution search is unavailable");
        setResults(data);
        setError("");
      } catch (err) {
        setResults([]);
        setError(
          err instanceof Error ? err.message : "Cannot connect to the server",
        );
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);
  return (
    <main className="portal-shell">
      <section className="portal-card">
        <div className="ours-logo">OUR&apos;S</div>
        <p className="portal-kicker">Welcome to OUR&apos;S</p>
        <h1>Please login to proceed</h1>
        <p className="muted">
          Enter your college or school name to open its secure workspace.
        </p>
        <label className="institution-search">
          <Search size={19} />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter college or school name"
            autoFocus
          />
        </label>
        <div className="institution-recommendations">
          <span>
            {loading
              ? "Searching…"
              : query
                ? "Recommended institutions"
                : "Available institutions"}
          </span>
          {results.map((row) => (
            <button type="button" key={row.id} onClick={() => onSelect(row)}>
              <div
                className="institution-letter"
                style={{ background: row.primary_color }}
              >
                {row.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <strong>{row.name}</strong>
                <small>{row.organization_type.replace("_", " ")}</small>
              </div>
              <span>Continue</span>
            </button>
          ))}
          {!loading && !results.length && !error && (
            <p>
              No matching institution found. Check the spelling or contact your
              institution.
            </p>
          )}
          {error && (
            <div className="error-box">
              <AlertTriangle size={17} />
              {error}
            </div>
          )}
        </div>
        <footer>
          Secure institutional access · Attendance · Academics · Performance
        </footer>
      </section>
    </main>
  );
}

function Login({
  onLogin,
  tenant,
  onBack,
}: {
  onLogin: (user: User) => void;
  tenant: TenantBrand;
  onBack: () => void;
}) {
  const [role, setRole] = useState<LoginRole>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaSetupRequired, setMfaSetupRequired] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaSetupMessage, setMfaSetupMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await apiFetch(`${API}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...institutionHeaders(),
        },
        body: JSON.stringify({ email, password, role, terms_accepted: termsAccepted, mfa_code: mfaCode || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Login failed");
      if (data.mfa_setup_required) {
        setMfaSetupRequired(true);
        setMfaSetupMessage(data.message || "Set up two-step authentication.");
        const setup = await apiRequest<{ secret: string; message: string }>("/api/auth/mfa/setup", "POST", {});
        setMfaSecret(setup.secret);
        setMfaSetupMessage(setup.message);
        return;
      }
      if (data.mfa_required) {
        setMfaRequired(true);
        setError(data.message || "Enter your authenticator code.");
        return;
      }
      onLogin(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend is not running.");
    } finally {
      setLoading(false);
    }
  }
  async function confirmMfaSetup() {
    setError("");
    setLoading(true);
    try {
      const result = await apiRequest<{ mfa_enabled: boolean; user?: User }>("/api/auth/mfa/confirm", "POST", { code: mfaCode });
      setMfaSetupMessage(result.mfa_enabled ? "Two-step authentication enabled." : "MFA setup could not be confirmed.");
      setMfaSetupRequired(false);
      setMfaRequired(false);
      // The backend rotates the short setup session to a normal authenticated session.
      const me = await apiRequest<{ user: User }>("/api/auth/me");
      onLogin(me.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "MFA setup failed.");
    } finally {
      setLoading(false);
    }
  }
  async function forgotPassword() {
    if (!email) {
      setError("Enter your account email first");
      return;
    }
    setError("");
    setForgotMessage("");
    try {
      const result = await apiRequest<{ message: string }>(
        "/api/auth/forgot-password",
        "POST",
        { email, role },
      );
      setForgotMessage(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Password reset is unavailable",
      );
    }
  }
  const roles: { value: LoginRole; label: string; icon: React.ReactNode }[] = [
    { value: "admin", label: "Administrator", icon: <ShieldCheck size={19} /> },
    { value: "teacher", label: "Teacher", icon: <GraduationCap size={19} /> },
    { value: "student", label: "Student", icon: <Users size={19} /> },
  ];
  return (
    <main className="login-shell simple-login">
      <section className="login-panel">
        <form
          onSubmit={submit}
          className="login-card branded-login"
          style={
            { "--tenant-color": tenant.primary_color } as React.CSSProperties
          }
        >
          {!tenant.domain && (
            <button type="button" className="back-institution" onClick={onBack}>
              <ArrowLeft size={16} /> Change institution
            </button>
          )}
          <div className="institution-login-heading">
            {tenant.logo_url ? <img className="institution-logo large" src={tenant.logo_url} alt={`${tenant.name} logo`} /> : <div className="institution-letter large" style={{ background: tenant.primary_color }}>{tenant.name.slice(0, 1).toUpperCase()}</div>}
            <div>
              <p>Welcome to OUR&apos;S</p>
              <h1>{tenant.name}</h1>
            </div>
          </div>
          <p className="muted">
            Select your account type and enter the credentials provided by your
            institution.
          </p>
          <div className="role-selector">
            {roles.map((item) => (
              <button
                type="button"
                key={item.value}
                className={role === item.value ? "active" : ""}
                onClick={() => setRole(item.value)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <label>
            Email address
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <PasswordInput
              
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {mfaRequired && !mfaSetupRequired && (
            <label>
              Authenticator code
              <Input inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))} minLength={6} maxLength={6} required />
            </label>
          )}
          {mfaSetupRequired && (
            <section className="panel" aria-live="polite">
              <h2>Set up two-step authentication</h2>
              <p>Administrator access requires an authenticator app. Add this secret manually in your authenticator app; keep it private.</p>
              {mfaSetupMessage && <p className="muted">{mfaSetupMessage}</p>}
              <code style={{ display: "block", overflowWrap: "anywhere", padding: 10 }}>{mfaSecret || "Preparing a secure setup key…"}</code>
              <label>6-digit authenticator code<Input inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))} minLength={6} maxLength={6} required /></label>
              <Button type="button" disabled={loading || mfaCode.length !== 6 || !mfaSecret} onClick={() => void confirmMfaSetup()}>Confirm and continue</Button>
              <p className="muted">Save your authenticator safely. Recovery codes are not yet available; do not lose access to this authenticator.</p>
            </section>
          )}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required />
            <span>I have read and accept the <Link href="/terms" target="_blank" rel="noreferrer">Terms of Use</Link> and <Link href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</Link>. I understand that optional camera, face-recognition, and device permissions require separate handling.</span>
          </label>
          <button
            type="button"
            className="forgot-link"
            onClick={forgotPassword}
          >
            Forgot password?
          </button>
          {forgotMessage && <div className="success-box">{forgotMessage}</div>}
          {error && (
            <div className="error-box">
              <AlertTriangle size={17} />
              {error}
            </div>
          )}
          <Button
            className="primary-button tenant-button"
            type="submit"
            disabled={loading || mfaSetupRequired || !termsAccepted}
          >
            {loading
              ? "Signing in…"
              : mfaRequired ? "Verify and sign in" : `Sign in as ${roles.find((item) => item.value === role)?.label}`}
          </Button>
          <div className="login-footer">
            <span>Attendance</span>
            <i /> <span>Classes</span>
            <i /> <span>Performance</span>
          </div>
          <div className="login-legal"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Use</Link></div>
        </form>
      </section>
    </main>
  );
}

function ResetPassword({
  tenant,
  token,
  onComplete,
}: {
  tenant: TenantBrand;
  token: string;
  onComplete: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      const result = await apiRequest<{ message: string }>(
        "/api/auth/reset-password",
        "POST",
        { token, new_password: password },
      );
      setMessage(result.message);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Password could not be reset",
      );
    }
  }
  return (
    <main className="login-shell simple-login">
      <section className="login-panel">
        <form className="login-card branded-login" onSubmit={submit}>
          <div className="institution-login-heading">
            <div
              className="institution-letter large"
              style={{ background: tenant.primary_color }}
            >
              {tenant.name.slice(0, 1)}
            </div>
            <div>
              <p>Secure password reset</p>
              <h1>{tenant.name}</h1>
            </div>
          </div>
          {message ? (
            <>
              <div className="success-box">{message}</div>
              <Button
                type="button"
                className="primary-button"
                onClick={onComplete}
              >
                Return to sign in
              </Button>
            </>
          ) : (
            <>
              <label>
                New password
                <PasswordInput
                  
                  minLength={12}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <small className="password-help">
                Use 12+ characters with upper-case, lower-case and a number.
              </small>
              <label>
                Confirm new password
                <PasswordInput
                  
                  minLength={12}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                />
              </label>
              {error && (
                <div className="error-box">
                  <AlertTriangle size={17} />
                  {error}
                </div>
              )}
              <Button type="submit" className="primary-button">
                Reset password
              </Button>
            </>
          )}
        </form>
      </section>
    </main>
  );
}

function AccountSecurity() {
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.new_password !== form.confirm) {
      setError("New passwords do not match");
      return;
    }
    try {
      await apiRequest("/api/auth/change-password", "POST", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setForm({ current_password: "", new_password: "", confirm: "" });
      setMessage(
        "Password changed. Other signed-in sessions have been closed.",
      );
      setError("");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed");
    }
  }
  return (
    <div className="security-page">
      <section className="admin-banner">
        <div>
          <p className="eyebrow">Account security</p>
          <h1>Password and sessions</h1>
          <p>Change your password without asking an administrator.</p>
        </div>
        <ShieldCheck size={36} />
      </section>
      <form className="panel security-form" onSubmit={submit}>
        <h2>Change password</h2>
        <label>
          Current password
          <PasswordInput
            
            value={form.current_password}
            onChange={(event) =>
              setForm({ ...form, current_password: event.target.value })
            }
            required
          />
        </label>
        <label>
          New password
          <PasswordInput
            
            minLength={12}
            value={form.new_password}
            onChange={(event) =>
              setForm({ ...form, new_password: event.target.value })
            }
            required
          />
        </label>
        <label>
          Confirm new password
          <PasswordInput
            
            minLength={12}
            value={form.confirm}
            onChange={(event) =>
              setForm({ ...form, confirm: event.target.value })
            }
            required
          />
        </label>
        <small className="password-help">
          Use at least 12 characters with upper-case, lower-case and a number.
        </small>
        {message && <div className="success-box">{message}</div>}
        {error && (
          <div className="error-box">
            <AlertTriangle size={17} />
            {error}
          </div>
        )}
        <Button type="submit">Change password</Button>
      </form>
    </div>
  );
}

function LiveMonitor({
  onRefresh,
  user,
}: {
  onRefresh: () => void;
  user: User;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const soundedAlerts = useRef(new Set<number>());
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("none");
  const labelRef = useRef("none");
  const [sampleTrackId, setSampleTrackId] = useState("");
  const sampleTrackRef = useRef("");
  const [result, setResult] = useState<Detection | null>(null);
  const [status, setStatus] = useState("Camera is ready to start");
  const [students, setStudents] = useState<
    { id: number; name: string; roll_no: string }[]
  >([]);
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [studentId, setStudentId] = useState("");
  const [faceSubject, setFaceSubject] = useState("");
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classSessionId, setClassSessionId] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [campusDate, setCampusDate] = useState(localDateKey());
  const [campusTime, setCampusTime] = useState("");
  const [permissionReason, setPermissionReason] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [classroomChange, setClassroomChange] = useState({
    classroom: "",
    reason: "",
  });
  const [cameras, setCameras] = useState<CameraHealth[]>([]);
  const [attendancePreview, setAttendancePreview] =
    useState<AttendancePreview | null>(null);
  const rooms = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...cameras.map((camera) => camera.classroom),
            ...sessions.map((row) => row.classroom),
          ]
            .map((room) => room.trim())
            .filter(Boolean),
        ),
      ).sort((first, second) => first.localeCompare(second)),
    [cameras, sessions],
  );
  useEffect(() => {
    labelRef.current = label;
  }, [label]);
  useEffect(() => {
    sampleTrackRef.current = sampleTrackId;
  }, [sampleTrackId]);
  useEffect(() => {
    for (const alert of result?.alerts || []) {
      if (soundedAlerts.current.has(alert.id)) continue;
      soundedAlerts.current.add(alert.id);
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioContextClass) {
        const audio = new AudioContextClass();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = alert.type === "fighting" ? 880 : 620;
        gain.gain.value = 0.16;
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.7);
      }
    }
  }, [result]);
  useEffect(() => {
    Promise.all([
      apiRequest<{ id: number; name: string; roll_no: string }[]>(
        "/api/students",
      ),
      apiRequest<ManagedStaff[]>("/api/staff"),
      apiRequest<AcademicWorkspace>("/api/academics/workspace"),
      apiRequest<{ cameras: CameraHealth[] }>("/api/monitor/cameras"),
      apiRequest<{ campus_time: string }>("/api/health"),
    ])
      .then(([items, staffRows, academic, cameraRows, health]) => {
        setStudents(items);
        setStaff(staffRows);
        setCameras(cameraRows.cameras);
        const serverCampusDate = health.campus_time?.slice(0, 10) || localDateKey();
        setCampusDate(serverCampusDate);
        setCampusTime(health.campus_time || "");
        if (items[0]) {
          setStudentId(String(items[0].id));
          setFaceSubject(`student:${items[0].id}`);
        } else if (staffRows[0]) setFaceSubject(`staff:${staffRows[0].id}`);
        const rows = academic.sessions.filter(
          (row) =>
            row.status === "scheduled" ||
            row.date === serverCampusDate,
        );
        setSessions(rows);
        const firstRoom =
          rows[0]?.classroom || cameraRows.cameras[0]?.classroom || "";
        if (firstRoom) setSelectedRoom(firstRoom);
        const firstSession = rows.find((row) => row.classroom === firstRoom);
        if (firstSession) setClassSessionId(String(firstSession.id));
      })
      .catch(() =>
        setStatus(
          "Could not load people, cameras or scheduled physical classes",
        ),
      );
  }, []);
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        void apiRequest<{ cameras: CameraHealth[] }>("/api/monitor/cameras")
          .then((rows) => setCameras(rows.cameras))
          .catch(() => undefined),
      15000,
      );
    return () => window.clearInterval(timer);
  }, []);
  const loadAttendancePreview = useCallback(
    async (sessionId = classSessionId) => {
      if (!sessionId) {
        setAttendancePreview(null);
        return;
      }
      try {
        setAttendancePreview(
          await apiRequest<AttendancePreview>(
            `/api/academics/sessions/${sessionId}/attendance/preview`,
          ),
        );
      } catch {
        setAttendancePreview(null);
      }
    },
    [classSessionId],
  );
  useEffect(() => {
    if (!classSessionId) return;
    let cancelled = false;
    apiRequest<AttendancePreview>(
      `/api/academics/sessions/${classSessionId}/attendance/preview`,
    )
      .then((preview) => {
        if (!cancelled) setAttendancePreview(preview);
      })
      .catch(() => {
        if (!cancelled) setAttendancePreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [classSessionId]);
  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (videoRef.current?.srcObject)
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
    setStatus("Monitoring stopped");
  }, []);
  useEffect(() => () => stop(), [stop]);
  const analyseFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || busyRef.current || video.readyState < 2) return;
    busyRef.current = true;
    setBusy(true);
    canvas.width = 640;
    canvas.height =
      Math.round((video.videoHeight / video.videoWidth) * 640) || 360;
    canvas
      .getContext("2d")
      ?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) {
      busyRef.current = false;
      setBusy(false);
      return;
    }
    const form = new FormData();
    form.append("image", blob, "frame.jpg");
    form.append("classroom_id", selectedRoom);
    form.append("sample_label", labelRef.current);
    if (labelRef.current !== "none" && sampleTrackRef.current)
      form.append("sample_track_id", sampleTrackRef.current);
    try {
      const response = await apiFetch(`${API}/api/monitor/frame`, {
        method: "POST",
        credentials: "include",
        headers: institutionHeaders(),
        body: form,
      });
      notifySessionExpiry(response);
      const responseText = await response.text();
      let data: Detection & { detail?: string };
      try {
        data = JSON.parse(responseText) as Detection & { detail?: string };
      } catch {
        data = {
          faces: [],
          people: [],
          phones: 0,
          attendance_marked: [],
          detail: responseText || `Monitoring request failed (${response.status})`,
        };
      }
      if (!response.ok)
        throw new Error(
          data.detail || `Monitoring request failed (${response.status})`,
        );
      setResult(data);
      const resolvedSessionId = Number(data.resolved_class_session_id || 0);
      if (resolvedSessionId) {
        setClassSessionId(String(resolvedSessionId));
        void loadAttendancePreview(String(resolvedSessionId));
      }
      const pending =
        data.exit_permission_candidates?.filter(
          (row: { request_id?: number }) => row.request_id,
        ) || [];
      setStatus(
        pending.length
          ? `Raised-hand request detected for ${pending.map((row: { student_name: string }) => row.student_name).join(", ")}. Review it before finalising attendance.`
          : data.behaviour_model_status === "safe_mode"
            ? data.behaviour_model_message || "Behaviour model safe mode is active"
            : data.sample_saved
              ? `Saved one reviewed ${labelRef.current} sample for the selected tracked person`
              : labelRef.current === "none"
              ? "Live analysis active"
              : "Select one recognised tracked person before collecting a labelled sample",
      );
      if (data.attendance_marked?.length || pending.length) {
        onRefresh();
        if (!resolvedSessionId) void loadAttendancePreview(classSessionId);
      }
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Cannot reach monitoring service",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [classSessionId, loadAttendancePreview, onRefresh, selectedRoom]);
  async function start() {
    if (!selectedRoom) {
      setStatus("Select the classroom/room number before starting monitoring");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setRunning(true);
      setStatus("Camera started—loading AI models on the first frame");
      timerRef.current = setInterval(analyseFrame, 1800);
      analyseFrame();
    } catch {
      setStatus("Camera permission was denied or no camera was found");
    }
  }
  async function registerFace() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!running || !video || !canvas || !faceSubject) {
      setStatus("Start the camera and select a student or staff member first");
      return;
    }
    const [kind, id] = faceSubject.split(":");
    canvas.width = 640;
    canvas.height =
      Math.round((video.videoHeight / video.videoWidth) * 640) || 360;
    canvas
      .getContext("2d")
      ?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;
    const form = new FormData();
    form.append("image", blob, "face.jpg");
    try {
      const path =
        kind === "staff" ? `/api/staff/${id}/face` : `/api/students/${id}/face`;
      const response = await apiFetch(`${API}${path}`, {
        method: "POST",
        credentials: "include",
        headers: institutionHeaders(),
        body: form,
      });
      notifySessionExpiry(response);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      setStatus(data.message);
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Face registration failed",
      );
    }
  }
  async function grantAttendance(
    source: "approved_exit" | "health" | "teacher_override",
  ) {
    if (!classSessionId || !studentId) {
      setStatus("Select a physical class and student");
      return;
    }
    const defaultReason =
      source === "approved_exit"
        ? "Teacher approved a temporary classroom exit after the raised-hand request"
        : source === "health"
          ? "Student was present but received a health-related attendance exception"
          : "Attendance confirmed by the teacher";
    try {
      await apiRequest(
        `/api/academics/sessions/${classSessionId}/attendance/${studentId}/override`,
        "POST",
        {
          decision_source: source,
          reason: permissionReason.trim() || defaultReason,
        },
      );
      setStatus("Teacher-approved attendance saved with an audit record");
      setPermissionReason("");
      onRefresh();
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Attendance approval failed",
      );
    }
  }
  async function reviewRaisedHand(
    requestId: number,
    decision: "approved" | "rejected",
  ) {
    try {
      await apiRequest(
        `/api/academics/attendance/raised-hand/${requestId}`,
        "PATCH",
        {
          decision,
          reason:
            decision === "approved"
              ? "Teacher approved the detected student-and-teacher raised-hand request"
              : "Teacher rejected a false or unclear gesture",
        },
      );
      setStatus(
        decision === "approved"
          ? "Raised-hand request approved; attendance is recorded with the teacher's identity."
          : "Raised-hand request rejected.",
      );
      await loadAttendancePreview();
      onRefresh();
    } catch (err) {
      setStatus(
        err instanceof Error
          ? err.message
          : "Could not review raised-hand request",
      );
    }
  }
  async function finalizeAttendance() {
    if (!classSessionId) {
      setStatus("Select a physical class first");
      return;
    }
    const rows = attendancePreview?.students || [];
    const summary = ["Present", "Absent", "OD", "Needs review", "Pending"]
      .map((label) => `${label}: ${rows.filter((row) => row.status === label).length}`)
      .join("\n");
    if (attendancePreview?.attendance_state !== "published" && !window.confirm(`Publish this period's final attendance?\n\n${summary}\n\nYou can still make an audited correction afterward.`)) return;
    try {
      await apiRequest(
        `/api/academics/sessions/${classSessionId}/attendance/finalize`,
        "POST",
      );
      setStatus(
        "Class attendance finalized using the 80% rule and teacher exceptions",
      );
      await loadAttendancePreview();
      onRefresh();
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Could not finalize attendance",
      );
    }
  }
  async function correctAttendance(
    targetStudentId: number,
    correctedStatus: "Present" | "Absent",
  ) {
    if (!classSessionId || correctionReason.trim().length < 3) {
      setStatus("Enter a correction reason of at least 3 characters.");
      return;
    }
    try {
      await apiRequest(
        `/api/academics/sessions/${classSessionId}/attendance/${targetStudentId}/correct`,
        "PATCH",
        { status: correctedStatus, reason: correctionReason.trim() },
      );
      setStatus(
        `Attendance corrected to ${correctedStatus}; the original decision remains in the audit log.`,
      );
      setCorrectionReason("");
      await loadAttendancePreview();
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Attendance correction failed",
      );
    }
  }
  async function moveClassroom() {
    if (
      !classSessionId ||
      !classroomChange.classroom.trim() ||
      classroomChange.reason.trim().length < 3
    ) {
      setStatus("Enter the temporary classroom and a reason.");
      return;
    }
    try {
      await apiRequest(
        `/api/academics/sessions/${classSessionId}/classroom-change`,
        "POST",
        classroomChange,
      );
      setStatus(
        "Temporary classroom saved. Attendance stays in review until that room's camera is healthy.",
      );
      setClassroomChange({ classroom: "", reason: "" });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Classroom change failed");
    }
  }
  const selectedSession = sessions.find(
    (row) => row.id === Number(classSessionId),
  );
  return (
    <div className="monitor-grid">
      <section className="camera-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {selectedSession
                ? `${selectedSession.course_code} · ${selectedSession.section_name} · Room ${selectedSession.classroom}`
                : selectedRoom
                  ? `Room ${selectedRoom} · timetable auto-linking`
                  : "Select a classroom to link the camera"}
            </p>
            <h2>Live monitoring</h2>
          </div>
          <span className={running ? "live-pill active" : "live-pill"}>
            <i />
            {running ? "Live" : "Offline"}
          </span>
        </div>
        <div className="video-stage">
          <video ref={videoRef} muted playsInline />
          {result?.annotated_image && running && (
            <img
              src={`data:image/jpeg;base64,${result.annotated_image}`}
              alt="AI-annotated classroom feed"
            />
          )}
          {!running && (
            <div className="camera-empty">
              <Camera size={42} />
              <p>Start the camera to analyse the room</p>
            </div>
          )}
          <canvas ref={canvasRef} hidden />
        </div>
        {result?.alerts?.map((alert) => (
          <div className="critical-alert" key={alert.id}>
            <AlertTriangle /> <strong>{alert.message}</strong>
          </div>
        ))}
        <div className="camera-actions">
          {!running ? (
            <Button onClick={start}>
              <Play size={16} /> Start monitoring
            </Button>
          ) : (
            <Button variant="outline" onClick={stop}>
              <Square size={15} /> Stop
            </Button>
          )}
          <span>{busy ? "Analysing frame…" : status}</span>
        </div>
      </section>
      <aside className="monitor-side">
        <section className="panel compact">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current frame</p>
              <h3>AI observations</h3>
            </div>
            <ScanFace size={22} />
          </div>
          <p className="eyebrow spaced">Camera classroom</p>
          <select
            value={selectedRoom}
            onChange={(e) => {
              const room = e.target.value;
              const sameRoom = sessions
                .filter((row) => row.classroom === room)
                .sort((first, second) => {
                  const firstToday = first.date === campusDate ? 0 : 1;
                  const secondToday = second.date === campusDate ? 0 : 1;
                  return firstToday - secondToday || first.period_number - second.period_number;
                })[0];
              setSelectedRoom(room);
              setClassSessionId(sameRoom ? String(sameRoom.id) : "");
              setAttendancePreview(null);
            }}
            disabled={running}
          >
            <option value="">Select classroom</option>
            {rooms.map((room) => (
              <option key={room} value={room}>
                Room {room}
              </option>
            ))}
          </select>
          <small className="form-help">
            The server uses this room and the campus clock to link the stream to
            the active timetable period automatically. No period selection is
            needed.
          </small>
          {campusTime && (
            <small className="form-help">
              Campus time: {campusTime.replace("T", " ").slice(0, 19)}
            </small>
          )}
          {attendancePreview && (
            <div
              className={`camera-session-state state-${attendancePreview.camera_state || "unknown"}`}
            >
              <strong>
                Camera: {attendancePreview.camera_state || "unknown"}
              </strong>
              <span>
                Attendance: {attendancePreview.attendance_state || "draft"}
              </span>
              {attendancePreview.failure_reason && (
                <small>{attendancePreview.failure_reason}</small>
              )}
            </div>
          )}
          <div className="observation-list">
            <div>
              <span>Recognised faces</span>
              <strong>
                {result?.faces?.map((face) => face.name).join(", ") || "None"}
              </strong>
            </div>
            <div>
              <span>People analysed</span>
              <strong>{result?.people?.length || 0}</strong>
            </div>
            <div>
              <span>Raised hands</span>
              <strong>
                {result?.people?.filter((person) => person.raised_hand)
                  .length || 0}
              </strong>
            </div>
            <div>
              <span>Phones detected</span>
              <strong>{result?.phones || 0}</strong>
            </div>
            <div>
              <span>Phone-face attendance rejected</span>
              <strong>
                {result?.people?.filter((person) => person.spoof_rejected)
                  .length || 0}
              </strong>
            </div>
            <div>
              <span>Behaviour</span>
              <strong>
                {result?.people
                  ?.map(
                    (person) =>
                      `${person.student_name || "Unknown"}: ${person.behaviour}`,
                  )
                  .join(", ") || "Waiting"}
              </strong>
            </div>
          </div>
          <p className="eyebrow spaced">Student and staff face enrolment</p>
          <select
            value={faceSubject}
            onChange={(e) => setFaceSubject(e.target.value)}
          >
            <optgroup label="Students">
              {students.map((student) => (
                <option
                  key={`student-${student.id}`}
                  value={`student:${student.id}`}
                >
                  {student.roll_no} · {student.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Staff">
              {staff
                .filter(
                  (member) => user.role === "admin" || member.id === user.id,
                )
                .map((member) => (
                  <option
                    key={`staff-${member.id}`}
                    value={`staff:${member.id}`}
                  >
                    {member.designation.toUpperCase()} · {member.name}
                    {!member.biometric_consent ? " · consent required" : ""}
                  </option>
                ))}
            </optgroup>
          </select>

          <Button variant="outline" className="full" onClick={registerFace}>
            <ScanFace size={16} /> Register visible face
          </Button>
          <small className="form-help">
            Capture three clear, well-lit angles. Recognition starts only after
            all required samples pass quality and duplicate checks.
          </small>
        </section>
        <section className="panel compact">
          <p className="eyebrow">Teacher attendance permission</p>
          <h3>Attendance exceptions</h3>
          <label>
            Student for health/manual exception
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.roll_no} · {student.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            value={permissionReason}
            onChange={(event) => setPermissionReason(event.target.value)}
            placeholder="Reason for health/manual exception"
          />
          <div className="permission-actions">
            <Button variant="outline" onClick={() => grantAttendance("health")}>
              Approve health exception
            </Button>
            <Button
              variant="outline"
              onClick={() => grantAttendance("teacher_override")}
            >
              Manual teacher override
            </Button>
          </div>
          <small className="form-help">
            A raised hand never changes attendance automatically. The assigned
            teacher and recognised student must both face the camera and raise a
            hand; then the teacher reviews the pending row below.
          </small>
          <Input
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value)}
            placeholder="Required reason for any attendance correction"
          />
          {attendancePreview?.attendance_state === "published" && <p className="attendance-published-note">Attendance is finalized. Authorized corrections remain available below and every change is recorded in the audit history.</p>}
          <div className="attendance-status-groups">
            {["Present", "Absent", "OD", "Needs review", "Pending"].map((group) => {
              const rows = attendancePreview?.students.filter((row) => row.status === group) || [];
              if (!rows.length) return null;
              return <section className="attendance-group" key={group} aria-label={`${group} students`}>
                <h4>{group === "Needs review" ? "Needs review / exception" : group} ({rows.length})</h4>
                {rows.map((row) => <article key={row.student_id}>
                  <div className="attendance-student">
                    <strong>{row.roll_no} · {row.student_name}</strong>
                    <span>{Math.round(row.attendance_percent)}% observed · required {row.required_percent || 80}%</span>
                    <small>{Math.round(row.observed_seconds || 0)}s observed of {Math.round(row.required_seconds || 0)}s required{row.decision_source ? ` · ${row.decision_source.replaceAll("_", " ")}` : ""}</small>
                  </div>
                  <div className="attendance-row-actions">
                    {row.raised_hand_request?.status === "pending" && <><b>Raised hand</b><Button size="sm" onClick={()=>void reviewRaisedHand(row.raised_hand_request!.id,"approved")}>OK</Button><Button size="sm" variant="outline" onClick={()=>void reviewRaisedHand(row.raised_hand_request!.id,"rejected")}>Reject</Button></>}
                    <Button size="sm" disabled={row.status === "Present"} onClick={()=>void correctAttendance(row.student_id,"Present")}>Present</Button>
                    <Button size="sm" variant="outline" disabled={row.status === "Absent"} onClick={()=>void correctAttendance(row.student_id,"Absent")}>Absent</Button>
                  </div>
                </article>)}
              </section>;
            })}
            {!attendancePreview?.students.length && <p>No enrolled students are available for this class period.</p>}
          </div>
          <Button className="full" onClick={finalizeAttendance} disabled={attendancePreview?.attendance_state === "published"}>
            {attendancePreview?.attendance_state === "published" ? "Attendance published / finalized" : "Finalize class attendance after reviewing lists"}
          </Button>
        </section>
        <details className="panel compact camera-diagnostics">
          <summary>Camera operations and room diagnostics</summary>
          <p className="eyebrow">Camera operations</p>
          <h3>Room health & temporary moves</h3>
          <div className="camera-health-list">
            {cameras.map((camera) => (
              <article key={camera.id}>
                <div>
                  <strong>{camera.classroom}</strong>
                  <span>
                    {camera.camera_key} · {camera.source_kind}
                  </span>
                </div>
                <b className={`state-${camera.state}`}>{camera.state}</b>
                <small>
                  {camera.state === "online"
                    ? `${camera.processing_fps} FPS · last frame ${camera.last_frame_at ? new Date(camera.last_frame_at).toLocaleTimeString() : "waiting"}`
                    : camera.error_message || "Worker is reconnecting"}
                </small>
              </article>
            ))}
            {!cameras.length && (
              <small>No always-on camera worker has reported yet.</small>
            )}
          </div>
          <Input
            placeholder="Temporary classroom"
            value={classroomChange.classroom}
            onChange={(event) =>
              setClassroomChange({
                ...classroomChange,
                classroom: event.target.value,
              })
            }
          />
          <Input
            placeholder="Reason for room change"
            value={classroomChange.reason}
            onChange={(event) =>
              setClassroomChange({
                ...classroomChange,
                reason: event.target.value,
              })
            }
          />
          <Button
            className="full"
            variant="outline"
            onClick={() => void moveClassroom()}
            disabled={!classSessionId}
          >
            Save temporary classroom
          </Button>
          <small className="form-help">
            If a camera is offline, automatic finalization marks unseen students
            “Needs review”—never automatically absent.
          </small>
        </details>
        <section className="panel compact">
          <p className="eyebrow">Shared behaviour model</p>
          <h3>Capture labelled samples</h3>
          <p className="muted small">
            Behaviour samples contribute to one common classifier. Face profiles
            stay isolated inside this institution.
          </p>
          <select value={label} onChange={(e) => setLabel(e.target.value)}>
            <option value="none">Do not collect samples</option>
            <option value="attentive">Attentive</option>
            <option value="sleeping">Sleeping</option>
            <option value="talking">Talking</option>
            <option value="fighting">Fighting</option>
          </select>
          {label !== "none" && (
            <label>
              Label one recognised tracked person
              <select
                value={sampleTrackId}
                onChange={(event) => setSampleTrackId(event.target.value)}
              >
                <option value="">Select tracked person</option>
                {(result?.people || [])
                  .filter(
                    (person) =>
                      person.track_id &&
                      (person.student_id || person.user_id) &&
                      person.student_name !== "Unknown",
                  )
                  .map((person) => (
                    <option key={person.track_id} value={person.track_id}>
                      {person.student_name} · {person.track_id?.split(":").at(-1)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <p className="model-note">
            Only the selected recognised volunteer is labelled. A platform
            administrator trains a versioned candidate and must approve it
            after grouped validation and a shadow pilot.
          </p>
        </section>
      </aside>
    </div>
  );
}

// Kept for upgrade compatibility with deployments that still link to the old view.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StudentDashboard({ data }: { data: Dashboard }) {
  const student = data.student!;
  const analytics = data.analytics;
  return (
    <div className="dashboard-stack">
      <section className="welcome-band">
        <div>
          <p className="eyebrow">Student overview</p>
          <h1>Welcome back, {student.name.split(" ")[0]}</h1>
          <p>Your learning and classroom progress are up to date.</p>
        </div>
        <div className="score-orbit">
          <strong>{student.average_score}%</strong>
          <span>average score</span>
        </div>
      </section>
      <div className="metric-grid">
        <MetricCard
          icon={<CheckCircle2 />}
          label="Attendance"
          value={`${student.attendance}%`}
          note="80% presence rule"
          tone="emerald"
        />
        <MetricCard
          icon={<BookOpen />}
          label="Course progress"
          value={`${student.progress}%`}
          note="Across enrolled courses"
          tone="indigo"
        />
        <MetricCard
          icon={<Activity />}
          label="Attention"
          value={
            student.behaviour_observed ? `${student.attention}%` : "No data"
          }
          note="Camera observations"
          tone="amber"
        />
      </div>
      <div className="content-grid">
        <section className="panel span-two">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Learning</p>
              <h2>Course progress</h2>
            </div>
            <BookOpen />
          </div>
          <div className="course-list">
            {data.courses?.map((course) => (
              <article key={course.id}>
                <div>
                  <strong>{course.title}</strong>
                  <span>
                    {course.completed_lessons} of {course.total_lessons} lessons
                    · Score {course.score}%
                  </span>
                </div>
                <div className="progress-row">
                  <Progress value={course.progress} />
                  <b>{course.progress}%</b>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Overall</p>
              <h2>Attendance</h2>
            </div>
            <BarChart3 />
          </div>
          <AttendanceDonut
            value={analytics?.overall.attendance_percent || student.attendance}
            label="All subjects"
          />
        </section>
      </div>
      {analytics && (
        <section className="panel analytics-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Attendance · behaviour · academics</p>
              <h2>Subject-wise analysis</h2>
            </div>
            <Activity />
          </div>
          <div className="subject-analytics">
            {analytics.subjects.map((subject) => (
              <article key={subject.course_id}>
                <div className="subject-heading">
                  <div>
                    <strong>
                      {subject.course_code} · {subject.course_title}
                    </strong>
                    <small>
                      {subject.present_classes}/{subject.total_classes} classes
                      present · Academic score {subject.average_score}%
                    </small>
                  </div>
                  <AttendanceDonut
                    value={subject.attendance_percent}
                    label="Attendance"
                  />
                </div>
                <BehaviourBars values={subject.behaviours} />
              </article>
            ))}
          </div>
          <div className="overall-behaviour">
            <h3>Overall behaviour</h3>
            <BehaviourBars values={analytics.overall.behaviours} />
          </div>
        </section>
      )}
    </div>
  );
}

function TeacherDashboard({ data }: { data: Dashboard }) {
  const students = data.students || [];
  const average = (key: keyof StudentSummary) =>
    students.length
      ? Math.round(
          students.reduce((sum, item) => sum + Number(item[key]), 0) /
            students.length,
        )
      : 0;
  const observedStudents = students.filter(
    (student) => student.behaviour_observed,
  );
  const attentionAverage = observedStudents.length
    ? Math.round(
        observedStudents.reduce((sum, student) => sum + student.attention, 0) /
          observedStudents.length,
      )
    : null;
  return (
    <div className="dashboard-stack">
      <section className="welcome-band teacher">
        <div>
          <p className="eyebrow">Live academic operations</p>
          <h1>Classroom command centre</h1>
          <p>
            Monitor attendance, behaviour and academic outcomes from one view.
          </p>
        </div>
        <div className="model-status">
          <ShieldCheck size={22} />
          <div>
            <strong>
              {data.model?.trained
                ? "Behaviour model ready"
                : "Pose and face models ready"}
            </strong>
            <span>{data.model?.samples || 0} labelled samples</span>
          </div>
        </div>
      </section>
      <div className="metric-grid four">
        <MetricCard
          icon={<Users />}
          label="Students"
          value={`${students.length}`}
          note="Institution students"
          tone="indigo"
        />
        <MetricCard
          icon={<CheckCircle2 />}
          label="Attendance"
          value={`${average("attendance")}%`}
          note="80% presence rule"
          tone="emerald"
        />
        <MetricCard
          icon={<Activity />}
          label="Attention"
          value={attentionAverage === null ? "No data" : `${attentionAverage}%`}
          note="Engagement average"
          tone="amber"
        />
        <MetricCard
          icon={<BarChart3 />}
          label="Performance"
          value={`${average("average_score")}%`}
          note="Academic average"
          tone="rose"
        />
      </div>
      <div className="content-grid">
        <section className="panel span-two">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Performance and behaviour</p>
              <h2>Student overview</h2>
            </div>
            <Users />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Behaviour</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => {
                const topBehaviour = Object.entries(
                  student.behaviours || {},
                ).sort((a, b) => b[1] - a[1])[0];
                return (
                  <TableRow key={student.id}>
                    <TableCell className="student-name">
                      <span>{student.name.slice(0, 1)}</span>
                      {student.name}
                    </TableCell>
                    <TableCell>{student.attendance}%</TableCell>
                    <TableCell>
                      {topBehaviour
                        ? `${topBehaviour[0]} ${topBehaviour[1]}%`
                        : "No data"}
                    </TableCell>
                    <TableCell>{student.average_score}%</TableCell>
                    <TableCell>
                      <span
                        className={`status-chip ${student.status.toLowerCase()}`}
                      >
                        {student.status}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Safety</p>
              <h2>Recent incidents</h2>
            </div>
            <AlertTriangle />
          </div>
          <div className="incident-list">
            {data.incidents?.length ? (
              data.incidents.map((incident) => (
                <article key={incident.id}>
                  <div className="incident-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <strong>{incident.behaviour}</strong>
                    <span>
                      {incident.student_name} ·{" "}
                      {Math.round(incident.confidence * 100)}%
                    </span>
                    <time>
                      {new Date(incident.occurred_at).toLocaleString()}
                    </time>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <CheckCircle2 />
                <p>No recent incidents</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function PlatformInstitutions() {
  const [institutions, setInstitutions] = useState<ManagedInstitution[]>([]);
  const [logoFiles, setLogoFiles] = useState<Record<number, File | undefined>>({});
  const [message, setMessage] = useState("");
  const [lifecycle, setLifecycle] = useState({
    institution_id: "",
    action: "archive",
    typed_name: "",
    reason: "",
    current_password: "",
    backup_confirmed: false,
  });
  const [form, setForm] = useState({
    name: "",
    slug: "",
    organization_type: "college",
    domain: "",
    brand_name: "OUR'S",
    primary_color: "#4f46c8",
    admin_name: "",
    admin_email: "",
    admin_password: "",
  });
  const load = useCallback(async () => {
    try {
      setInstitutions(
        await apiRequest<ManagedInstitution[]>("/api/platform/institutions"),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load institutions",
      );
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/api/platform/institutions", "POST", form);
      setMessage(
        "Institution created. Point its DNS to this application, then use the new domain to sign in.",
      );
      setForm({
        name: "",
        slug: "",
        organization_type: "college",
        domain: "",
        brand_name: "OUR'S",
        primary_color: "#4f46c8",
        admin_name: "",
        admin_email: "",
        admin_password: "",
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create institution",
      );
    }
  }
  async function changeLifecycle(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(
        `/api/platform/institutions/${lifecycle.institution_id}/lifecycle`,
        "POST",
        lifecycle,
      );
      setMessage(`Institution ${lifecycle.action} completed and audited.`);
      setLifecycle({
        ...lifecycle,
        typed_name: "",
        reason: "",
        current_password: "",
        backup_confirmed: false,
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Lifecycle action failed",
      );
    }
  }
  async function uploadLogo(institutionId: number) {
    const logo = logoFiles[institutionId];
    if (!logo) {
      setMessage("Choose a PNG, JPG, WEBP or SVG logo first.");
      return;
    }
    const formData = new FormData();
    formData.append("logo", logo);
    try {
      const response = await apiFetch(`${API}/api/platform/institutions/${institutionId}/logo`, {
        method: "POST", credentials: "include", headers: institutionHeaders(), body: formData,
      });
      notifySessionExpiry(response);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Logo upload failed");
      setMessage("Institution logo uploaded. Sign-in and portal branding now use it.");
      setLogoFiles((current) => ({ ...current, [institutionId]: undefined }));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Logo upload failed");
    }
  }
  return (
    <div className="admin-stack">
      <section className="admin-banner platform-banner">
        <div>
          <p className="eyebrow">White-label platform</p>
          <h1>Institutions and domains</h1>
          <p>
            Create a separate, isolated workspace and sign-in domain for every
            customer.
          </p>
        </div>
        <Building2 size={38} />
      </section>
      {message && <div className="admin-message">{message}</div>}
      <div className="platform-grid">
        <form className="panel admin-form" onSubmit={create}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">New customer</p>
              <h2>Provision institution</h2>
            </div>
            <Database />
          </div>
          <Input
            placeholder="College or school name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <div className="form-row">
            <Input
              placeholder="Slug, e.g. abc-college"
              value={form.slug}
              onChange={(e) =>
                setForm({
                  ...form,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                })
              }
              required
            />
            <select
              value={form.organization_type}
              onChange={(e) =>
                setForm({ ...form, organization_type: e.target.value })
              }
            >
              <option value="college">College</option>
              <option value="school">School</option>
              <option value="training_center">Training centre</option>
            </select>
          </div>
          <Input
            placeholder="Domain, e.g. abc.oursapp.in"
            value={form.domain}
            onChange={(e) =>
              setForm({ ...form, domain: e.target.value.toLowerCase() })
            }
            required
          />
          <div className="form-row">
            <Input
              placeholder="Brand name"
              value={form.brand_name}
              onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
              required
            />
            <label className="color-label">
              Brand colour
              <Input
                type="color"
                value={form.primary_color}
                onChange={(e) =>
                  setForm({ ...form, primary_color: e.target.value })
                }
              />
            </label>
          </div>
          <h3>Institution administrator</h3>
          <Input
            placeholder="Administrator name"
            value={form.admin_name}
            onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
            required
          />
          <Input
            type="email"
            placeholder="Administrator email"
            value={form.admin_email}
            onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
            required
          />
          <PasswordInput
            
            minLength={12}
            placeholder="Temporary password (12+ characters)"
            value={form.admin_password}
            onChange={(e) =>
              setForm({ ...form, admin_password: e.target.value })
            }
            required
          />
          <Button type="submit">Create institution</Button>
        </form>
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Customer workspaces</p>
              <h2>Registered domains</h2>
            </div>
            <ShieldCheck />
          </div>
          <div className="institution-list">
            {institutions.map((row) => (
              <article key={row.id}>
                <span
                  className="institution-mark"
                  style={{ background: row.primary_color }}
                >
                  {row.logo_url ? <img src={row.logo_url} alt={`${row.name} logo`} /> : row.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{row.name}</strong>
                  <small>
                    {row.brand_name} · {row.organization_type.replace("_", " ")}
                  </small>
                  <code>{row.domain || "No primary domain"}</code>
                </div>
                <b className={row.active ? "good" : "bad"}>
                  {row.active ? "Active" : "Inactive"}
                </b>
                <div className="institution-logo-actions">
                  <input aria-label={`Choose logo for ${row.name}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event)=>setLogoFiles((current)=>({...current,[row.id]:event.target.files?.[0]}))}/>
                  <Button type="button" size="sm" variant="outline" onClick={()=>void uploadLogo(row.id)}>{row.logo_url ? "Replace logo" : "Upload logo"}</Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <form className="panel admin-form" onSubmit={changeLifecycle}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Protected lifecycle</p>
            <h2>Archive, restore or remove an empty test college</h2>
          </div>
          <ShieldCheck />
        </div>
        <label>
          Institution
          <select
            value={lifecycle.institution_id}
            onChange={(event) => {
              setLifecycle({
                ...lifecycle,
                institution_id: event.target.value,
                typed_name: "",
              });
            }}
            required
          >
            <option value="">Select customer institution</option>
            {institutions
              .filter((row) => row.organization_type !== "platform")
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.active ? "active" : "archived"}
                </option>
              ))}
          </select>
        </label>
        <label>
          Action
          <select
            value={lifecycle.action}
            onChange={(event) =>
              setLifecycle({ ...lifecycle, action: event.target.value })
            }
          >
            <option value="archive">Archive and disable sign-in</option>
            <option value="restore">Restore institution</option>
            <option value="delete">Permanently delete empty test institution</option>
          </select>
        </label>
        <Input
          value={lifecycle.typed_name}
          onChange={(event) =>
            setLifecycle({ ...lifecycle, typed_name: event.target.value })
          }
          placeholder="Type the exact institution name"
          required
        />
        <Input
          value={lifecycle.reason}
          onChange={(event) =>
            setLifecycle({ ...lifecycle, reason: event.target.value })
          }
          placeholder="Reason (at least 10 characters)"
          required
        />
        <PasswordInput
          
          value={lifecycle.current_password}
          onChange={(event) =>
            setLifecycle({
              ...lifecycle,
              current_password: event.target.value,
            })
          }
          placeholder="Confirm your platform-owner password"
          required
        />
        {lifecycle.action === "delete" && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={lifecycle.backup_confirmed}
              onChange={(event) =>
                setLifecycle({
                  ...lifecycle,
                  backup_confirmed: event.target.checked,
                })
              }
            />{" "}
            I verified the backup. Permanent deletion is allowed only for an
            empty test institution.
          </label>
        )}
        <Button type="submit" disabled={!lifecycle.institution_id}>
          Confirm protected action
        </Button>
      </form>
    </div>
  );
}

function PlatformAccountControls() {
  const [institutions, setInstitutions] = useState<ManagedInstitution[]>([]);
  const [team, setTeam] = useState<ManagedUser[]>([]);
  const [message, setMessage] = useState("");
  const [manage, setManage] = useState({
    institution_id: "",
    name: "",
    brand_name: "OUR'S",
    primary_color: "#4f46c8",
    administrator_id: "",
    temporary_password: "",
  });
  const [teamForm, setTeamForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const load = useCallback(async () => {
    try {
      const [rows, members] = await Promise.all([
        apiRequest<ManagedInstitution[]>("/api/platform/institutions"),
        apiRequest<ManagedUser[]>("/api/platform/team"),
      ]);
      setInstitutions(rows);
      setTeam(members);
      setManage((value) => {
        const selected =
          rows.find((row) => row.id === Number(value.institution_id)) ||
          rows[0];
        return selected
          ? {
              ...value,
              institution_id: String(selected.id),
              name: selected.name,
              brand_name: selected.brand_name,
              primary_color: selected.primary_color,
              administrator_id: String(selected.administrators[0]?.id || ""),
            }
          : value;
      });
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Platform accounts unavailable",
      );
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const selected = institutions.find(
    (row) => row.id === Number(manage.institution_id),
  );
  function selectInstitution(id: string) {
    const row = institutions.find((item) => item.id === Number(id));
    if (row)
      setManage({
        ...manage,
        institution_id: id,
        name: row.name,
        brand_name: row.brand_name,
        primary_color: row.primary_color,
        administrator_id: String(row.administrators[0]?.id || ""),
        temporary_password: "",
      });
  }
  async function updateInstitution(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(
        `/api/platform/institutions/${manage.institution_id}`,
        "PATCH",
        {
          name: manage.name,
          brand_name: manage.brand_name,
          primary_color: manage.primary_color,
        },
      );
      setMessage("Institution profile updated.");
      await load();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Institution update failed",
      );
    }
  }
  async function resetAdministrator(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(
        `/api/platform/institutions/${manage.institution_id}/administrators/${manage.administrator_id}/reset-password`,
        "POST",
        { temporary_password: manage.temporary_password },
      );
      setMessage(
        "Customer administrator received a new temporary password and old sessions were closed.",
      );
      setManage({ ...manage, temporary_password: "" });
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Administrator reset failed",
      );
    }
  }
  async function addTeamMember(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/api/platform/team", "POST", teamForm);
      setTeamForm({ name: "", email: "", password: "" });
      setMessage("Platform team administrator created.");
      await load();
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Team account could not be created",
      );
    }
  }
  return (
    <section className="platform-account-controls">
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-forms">
        <form className="panel admin-form" onSubmit={updateInstitution}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Owner control</p>
              <h2>Edit customer college</h2>
            </div>
            <Building2 />
          </div>
          <label>
            Institution
            <select
              value={manage.institution_id}
              onChange={(event) => selectInstitution(event.target.value)}
            >
              {institutions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            value={manage.name}
            onChange={(event) =>
              setManage({ ...manage, name: event.target.value })
            }
            placeholder="Institution name"
            required
          />
          <Input
            value={manage.brand_name}
            onChange={(event) =>
              setManage({ ...manage, brand_name: event.target.value })
            }
            placeholder="Brand name"
            required
          />
          <label className="color-label">
            Brand colour
            <Input
              type="color"
              value={manage.primary_color}
              onChange={(event) =>
                setManage({ ...manage, primary_color: event.target.value })
              }
            />
          </label>
          <Button type="submit">Save institution</Button>
        </form>
        <form className="panel admin-form" onSubmit={resetAdministrator}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Customer recovery</p>
              <h2>Reset college administrator</h2>
            </div>
            <ShieldCheck />
          </div>
          <label>
            Administrator
            <select
              value={manage.administrator_id}
              onChange={(event) =>
                setManage({ ...manage, administrator_id: event.target.value })
              }
            >
              {selected?.administrators.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.email}
                </option>
              ))}
            </select>
          </label>
          <PasswordInput
            
            minLength={12}
            placeholder="New temporary password"
            value={manage.temporary_password}
            onChange={(event) =>
              setManage({ ...manage, temporary_password: event.target.value })
            }
            required
          />
          <small className="password-help">
            Share it securely and ask the administrator to change it after
            login.
          </small>
          <Button type="submit" disabled={!manage.administrator_id}>
            Reset administrator
          </Button>
        </form>
        <form className="panel admin-form" onSubmit={addTeamMember}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your organisation</p>
              <h2>Add platform team member</h2>
            </div>
            <Users />
          </div>
          <Input
            placeholder="Team member name"
            value={teamForm.name}
            onChange={(event) =>
              setTeamForm({ ...teamForm, name: event.target.value })
            }
            required
          />
          <Input
            type="email"
            placeholder="Work email"
            value={teamForm.email}
            onChange={(event) =>
              setTeamForm({ ...teamForm, email: event.target.value })
            }
            required
          />
          <PasswordInput
            
            minLength={12}
            placeholder="Temporary password"
            value={teamForm.password}
            onChange={(event) =>
              setTeamForm({ ...teamForm, password: event.target.value })
            }
            required
          />
          <Button type="submit">Create platform administrator</Button>
          <div className="mini-account-list">
            {team.map((row) => (
              <small key={row.id}>
                {row.name} · {row.email}
              </small>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}

function PlatformDashboard({
  onNavigate,
}: {
  onNavigate: (view: string) => void;
}) {
  const [overview, setOverview] = useState<PlatformOverviewData | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setOverview(await apiRequest<PlatformOverviewData>("/api/platform/overview"));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Platform overview unavailable");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (!overview && !message)
    return <div className="loading-state">Loading platform operations…</div>;
  return (
    <div className="dashboard-stack">
      <section className="welcome-band teacher">
        <div>
          <p className="eyebrow">Platform owner workspace</p>
          <h1>OUR&apos;S platform operations</h1>
          <p>
            Manage customer institutions, approved support access and shared
            model releases without entering routine college operations.
          </p>
        </div>
        <div className="model-status">
          <ShieldCheck size={22} />
          <div>
            <strong>Tenant boundaries active</strong>
            <span>Support access requires college consent</span>
          </div>
        </div>
      </section>
      {message && <div className="admin-message">{message}</div>}
      {overview && (
        <>
          <div className="metric-grid four">
            <MetricCard icon={<Building2 />} label="Institutions" value={String(overview.institutions_total)} note={`${overview.institutions_active} active`} tone="indigo" />
            <MetricCard icon={<Users />} label="Customer users" value={String(overview.customer_users)} note="Across isolated tenants" tone="emerald" />
            <MetricCard icon={<ShieldCheck />} label="Support approvals" value={String(overview.pending_support_requests)} note="Pending your customers" tone="amber" />
            <MetricCard icon={<Activity />} label="Shared model" value={overview.active_model ? "Active" : "Safe mode"} note={overview.active_model?.version || "No promoted candidate"} tone="rose" />
          </div>
          <section className="panel platform-scope-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Owner boundary</p>
                <h2>Platform administration only</h2>
              </div>
              <ShieldCheck />
            </div>
            <p>{overview.scope_notice}</p>
            <div className="quick-action-row">
              <Button onClick={() => onNavigate("institutions")}>Manage institutions</Button>
              <Button variant="outline" onClick={() => onNavigate("support")}>Support requests</Button>
              <Button variant="outline" onClick={() => onNavigate("models")}>Model governance</Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PlatformSupportPage() {
  const [institutions, setInstitutions] = useState<ManagedInstitution[]>([]);
  const [sessions, setSessions] = useState<SupportSessionRecord[]>([]);
  const [inspection, setInspection] = useState<{
    institution: TenantBrand;
    counts: Record<string, number>;
    administrators: ManagedUser[];
    recent_audit: AuditEntry[];
    notice: string;
  } | null>(null);
  const [form, setForm] = useState({
    institution_id: "",
    represented_admin_id: "",
    reason: "",
    ticket_reference: "",
    duration_minutes: "30",
  });
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const [institutionRows, sessionRows] = await Promise.all([
        apiRequest<ManagedInstitution[]>("/api/platform/institutions"),
        apiRequest<SupportSessionRecord[]>("/api/platform/support-sessions"),
      ]);
      const customers = institutionRows.filter((row) => row.organization_type !== "platform");
      setInstitutions(customers);
      setSessions(sessionRows);
      setForm((value) => {
        const selected = customers.find((row) => row.id === Number(value.institution_id)) || customers[0];
        return {
          ...value,
          institution_id: selected ? String(selected.id) : "",
          represented_admin_id:
            value.represented_admin_id && selected?.administrators.some((admin) => admin.id === Number(value.represented_admin_id))
              ? value.represented_admin_id
              : String(selected?.administrators[0]?.id || ""),
        };
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Support requests unavailable");
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const selected = institutions.find((row) => row.id === Number(form.institution_id));
  async function requestAccess(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/api/platform/support-sessions", "POST", {
        institution_id: Number(form.institution_id),
        represented_admin_id: Number(form.represented_admin_id) || null,
        reason: form.reason,
        ticket_reference: form.ticket_reference || null,
        duration_minutes: Number(form.duration_minutes),
      });
      setForm((value) => ({ ...value, reason: "", ticket_reference: "" }));
      setMessage("Read-only access requested. The named college administrator must approve it before use.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Support request failed");
    }
  }
  async function openInspection(id: number) {
    try {
      setInspection(await apiRequest(`/api/platform/support-sessions/${id}/administration`));
      setMessage("Read-only support view opened and written to both audit trails.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Support view unavailable");
    }
  }
  async function revoke(id: number) {
    try {
      await apiRequest(`/api/platform/support-sessions/${id}/revoke`, "POST");
      setInspection(null);
      setMessage("Support access revoked.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not revoke access");
    }
  }
  return (
    <div className="admin-stack">
      <section className="admin-banner platform-banner">
        <div>
          <p className="eyebrow">Consent-based support</p>
          <h1>Customer support access</h1>
          <p>Every request is named, time-limited, read-only and audited for both organisations.</p>
        </div>
        <ShieldCheck size={38} />
      </section>
      {message && <div className="admin-message">{message}</div>}
      <div className="platform-grid">
        <form className="panel admin-form" onSubmit={requestAccess}>
          <h2>Request read-only access</h2>
          <label>
            Customer institution
            <select
              value={form.institution_id}
              onChange={(event) => {
                const institution = institutions.find((row) => row.id === Number(event.target.value));
                setForm({ ...form, institution_id: event.target.value, represented_admin_id: String(institution?.administrators[0]?.id || "") });
              }}
              required
            >
              <option value="">Select institution</option>
              {institutions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          <label>
            Approving administrator
            <select value={form.represented_admin_id} onChange={(event) => setForm({ ...form, represented_admin_id: event.target.value })} required>
              <option value="">Select administrator</option>
              {selected?.administrators.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.email}</option>)}
            </select>
          </label>
          <Input value={form.ticket_reference} onChange={(event) => setForm({ ...form, ticket_reference: event.target.value })} placeholder="Support ticket reference (optional)" />
          <label>
            Access duration
            <select value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </label>
          <textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Explain the support issue and why access is needed" minLength={10} required />
          <Button type="submit" disabled={!form.institution_id || !form.represented_admin_id}>Send approval request</Button>
        </form>
        <section className="panel">
          <div className="section-heading">
            <div><p className="eyebrow">Access ledger</p><h2>Requests and sessions</h2></div>
            <ListChecks />
          </div>
          <div className="support-session-list">
            {sessions.map((row) => (
              <article key={row.id}>
                <div>
                  <strong>{row.institution_name}</strong>
                  <span>{row.status} · expires {new Date(row.expires_at).toLocaleString()}</span>
                  <small>{row.reason}{row.ticket_reference ? ` · ${row.ticket_reference}` : ""}</small>
                </div>
                <div className="quick-action-row">
                  {row.status === "approved" && <Button size="sm" onClick={() => void openInspection(row.id)}>Open read-only view</Button>}
                  {(["pending", "approved"] as string[]).includes(row.status) && <Button size="sm" variant="outline" onClick={() => void revoke(row.id)}>Revoke</Button>}
                </div>
              </article>
            ))}
            {!sessions.length && <div className="empty-note">No support access has been requested.</div>}
          </div>
        </section>
      </div>
      {inspection && (
        <section className="panel support-inspection">
          <div className="section-heading">
            <div><p className="eyebrow">Approved read-only view</p><h2>{inspection.institution.name}</h2></div>
            <ShieldCheck />
          </div>
          <div className="metric-grid four">
            {Object.entries(inspection.counts).map(([label, value]) => <MetricCard key={label} icon={<Database />} label={label.replace("_", " ")} value={String(value)} note="Read-only count" />)}
          </div>
          <p className="model-note">{inspection.notice}</p>
          <div className="simple-list">
            {inspection.recent_audit.slice(0, 10).map((row) => <div key={row.id}><span><strong>{row.action}</strong><small>{row.actor} · {row.entity_type}</small></span><time>{new Date(row.created_at).toLocaleString()}</time></div>)}
          </div>
        </section>
      )}
    </div>
  );
}

function CollegeSupportRequests() {
  const [sessions, setSessions] = useState<SupportSessionRecord[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      setSessions(await apiRequest<SupportSessionRecord[]>("/api/admin/support-sessions"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Support requests unavailable");
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function review(row: SupportSessionRecord, decision: "approved" | "rejected" | "revoked") {
    const reason = window.prompt(`${decision === "approved" ? "Approval" : "Decision"} note (optional):`) || "";
    try {
      await apiRequest(`/api/admin/support-sessions/${row.id}/review`, "PATCH", { decision, reason: reason || null });
      setMessage(`Support request ${decision}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not review support request");
    }
  }
  return (
    <div className="admin-stack">
      <section className="admin-banner">
        <div><p className="eyebrow">College-controlled consent</p><h1>Platform support requests</h1><p>Only the named administrator can approve access. Approval expires automatically and remains read-only.</p></div>
        <ShieldCheck size={36} />
      </section>
      {message && <div className="admin-message">{message}</div>}
      <section className="panel">
        <div className="support-session-list">
          {sessions.map((row) => (
            <article key={row.id}>
              <div><strong>{row.platform_user_name}</strong><span>{row.status} · expires {new Date(row.expires_at).toLocaleString()}</span><small>{row.reason}{row.ticket_reference ? ` · ${row.ticket_reference}` : ""}</small></div>
              <div className="quick-action-row">
                {row.status === "pending" && <><Button size="sm" onClick={() => void review(row, "approved")}>Approve read-only</Button><Button size="sm" variant="outline" onClick={() => void review(row, "rejected")}>Reject</Button></>}
                {row.status === "approved" && <Button size="sm" variant="outline" onClick={() => void review(row, "revoked")}>Revoke now</Button>}
              </div>
            </article>
          ))}
          {!sessions.length && <div className="empty-note">No platform-support requests.</div>}
        </div>
      </section>
    </div>
  );
}

function ModelGovernancePage() {
  const [versions, setVersions] = useState<BehaviourModelRelease[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setVersions(await apiRequest<BehaviourModelRelease[]>("/api/model/versions"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Model registry unavailable");
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function train() {
    setBusy(true);
    try {
      const result = await apiRequest<{ version: string; macro_f1: number }>("/api/model/train", "POST");
      setMessage(`Candidate ${result.version} created with macro-F1 ${(result.macro_f1 * 100).toFixed(1)}%. It is not active until approved.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Candidate training failed");
    } finally {
      setBusy(false);
    }
  }
  async function decide(row: BehaviourModelRelease, approve: boolean) {
    const reason = window.prompt(`${approve ? "Promotion" : "Rejection"} reason (at least 10 characters):`)?.trim();
    if (!reason || reason.length < 10) {
      setMessage("Enter a reason of at least 10 characters.");
      return;
    }
    try {
      await apiRequest(`/api/model/versions/${row.id}/promote`, "POST", { approve, reason });
      setMessage(approve ? "Candidate promoted after the metric gate." : "Candidate rejected and retained in the audit record.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Model decision failed");
    }
  }
  return (
    <div className="admin-stack">
      <section className="admin-banner platform-banner">
        <div><p className="eyebrow">Shared behavior model</p><h1>Validation and release governance</h1><p>Training creates a candidate. Grouped holdout metrics and explicit approval are required before activation.</p></div>
        <Activity size={38} />
      </section>
      {message && <div className="admin-message">{message}</div>}
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Candidate pipeline</p><h2>Model releases</h2></div><Button onClick={() => void train()} disabled={busy}>{busy ? "Training…" : "Train new candidate"}</Button></div>
        <p className="model-note">No accuracy is guaranteed. Promote only after representative consented data, grouped validation, per-class review and a monitored classroom pilot.</p>
        <div className="model-release-list">
          {versions.map((row) => (
            <article key={row.id}>
              <div><strong>{row.version}</strong><span>{row.status} · {row.samples} samples · {row.groups} independent groups</span><small>Accuracy {(row.accuracy * 100).toFixed(1)}% · Macro-F1 {(row.macro_f1 * 100).toFixed(1)}% · Macro recall {(row.macro_recall * 100).toFixed(1)}%</small></div>
              {row.status === "candidate" && <div className="quick-action-row"><Button size="sm" onClick={() => void decide(row, true)}>Approve candidate</Button><Button size="sm" variant="outline" onClick={() => void decide(row, false)}>Reject</Button></div>}
            </article>
          ))}
          {!versions.length && <div className="empty-note">No governed model versions yet. Camera attendance and crowd safety remain available in safe mode.</div>}
        </div>
      </section>
    </div>
  );
}

function PlatformSystemPage() {
  const [health, setHealth] = useState<PlatformSystemHealth | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setHealth(await apiRequest<PlatformSystemHealth>("/api/platform/system-health"));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "System status unavailable");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="admin-stack">
      <section className="admin-banner platform-banner"><div><p className="eyebrow">Operations</p><h1>Production readiness</h1><p>This page reports configuration state only; secrets and credentials are never returned.</p></div><Database size={38} /></section>
      {message && <div className="admin-message">{message}</div>}
      {health && <section className="panel"><div className="system-health-grid">{Object.entries(health).map(([key, value]) => <article key={key}><span>{key.replaceAll("_", " ")}</span><strong className={["ready", "configured", "active", "production"].includes(String(value)) ? "good" : ""}>{String(value)}</strong></article>)}</div><p className="model-note">Use the production environment validator and deployment checklist before opening any public domain.</p></section>}
    </div>
  );
}

function PlatformAuditPage() {
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setAudits(await apiRequest<AuditEntry[]>("/api/platform/audit-logs?limit=100"));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Audit trail unavailable");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="admin-stack">
      <section className="admin-banner platform-banner"><div><p className="eyebrow">Immutable accountability</p><h1>Platform audit activity</h1><p>Review owner actions, customer provisioning, recovery and support-access events.</p></div><ListChecks size={38} /></section>
      {message && <div className="admin-message">{message}</div>}
      <section className="panel"><div className="simple-list">{audits.map((row) => <div key={row.id}><span><strong>{row.action}</strong><small>{row.actor} · {row.entity_type}</small></span><time>{new Date(row.created_at).toLocaleString()}</time></div>)}</div></section>
    </div>
  );
}

function CollegeAdminDashboard({ data, onNavigate }: { data: Dashboard; onNavigate: (view: string) => void }) {
  const students = data.students || [];
  const average = (key: "attendance" | "average_score") => students.length ? Math.round(students.reduce((total, row) => total + Number(row[key]), 0) / students.length) : 0;
  return (
    <div className="dashboard-stack">
      <section className="welcome-band teacher"><div><p className="eyebrow">Institution administration</p><h1>College operations</h1><p>Manage people, departments, classes, academics, fees and policy within this institution.</p></div><div className="model-status"><ShieldCheck size={22} /><div><strong>College-only authority</strong><span>All changes are tenant-scoped and audited</span></div></div></section>
      <div className="metric-grid four"><MetricCard icon={<Users />} label="Students" value={String(students.length)} note="Institution records" tone="indigo" /><MetricCard icon={<ClipboardCheck />} label="Attendance" value={`${average("attendance")}%`} note="Overall average" tone="emerald" /><MetricCard icon={<Trophy />} label="Academic score" value={`${average("average_score")}%`} note="Recorded results" tone="amber" /><MetricCard icon={<AlertTriangle />} label="Open observations" value={String(data.incidents?.length || 0)} note="Recent safety/behaviour records" tone="rose" /></div>
      <section className="panel"><div className="section-heading"><div><p className="eyebrow">Common tasks</p><h2>Administration shortcuts</h2></div><Settings2 /></div><div className="quick-action-row"><Button onClick={() => onNavigate("users")}>Students and staff</Button><Button variant="outline" onClick={() => onNavigate("allocations")}>Teacher allocation</Button><Button variant="outline" onClick={() => onNavigate("timetable")}>Timetable</Button><Button variant="outline" onClick={() => onNavigate("support_requests")}>Support consent</Button></div></section>
    </div>
  );
}

function InstitutionAccountControls({
  focus = "users",
}: {
  focus?: "profile" | "users" | "camera" | "privacy";
}) {
  const [accounts, setAccounts] = useState<ManagedUser[]>([]);
  const [staff, setStaff] = useState<ManagedStaff[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [profile, setProfile] = useState({
    name: "",
    brand_name: "OUR'S",
    primary_color: "#4f46c8",
  });
  const [policy, setPolicy] = useState({
    attendance_required_percent: "80",
    fight_alert_seconds: "120",
    crowd_threshold: "40",
    crowd_alert_seconds: "30",
  });
  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    password: "",
    access_role: "teacher",
    designation: "teacher",
    employee_no: "",
    department_id: "",
    biometric_consent: false,
  });
  const [administrator, setAdministrator] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [reset, setReset] = useState({ user_id: "", temporary_password: "" });
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const [users, staffRows, institution, academic] = await Promise.all([
        apiRequest<ManagedUser[]>("/api/admin/users"),
        apiRequest<ManagedStaff[]>("/api/staff"),
        apiRequest<TenantBrand>("/api/admin/institution"),
        apiRequest<AcademicCatalog>("/api/admin/academics/catalog"),
      ]);
      setAccounts(users);
      setStaff(staffRows);
      setDepartments(academic.departments);
      setStaffForm((value) => ({
        ...value,
        department_id:
          value.department_id || String(academic.departments[0]?.id || ""),
      }));
      setProfile({
        name: institution.name,
        brand_name: institution.brand_name,
        primary_color: institution.primary_color,
      });
      setPolicy({
        attendance_required_percent: String(
          institution.attendance_required_percent || 80,
        ),
        fight_alert_seconds: String(institution.fight_alert_seconds || 120),
        crowd_threshold: String(institution.crowd_threshold || 40),
        crowd_alert_seconds: String(institution.crowd_alert_seconds || 30),
      });
      setReset((value) => ({
        ...value,
        user_id:
          value.user_id ||
          String(users.find((row) => row.role !== "admin")?.id || ""),
      }));
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Account controls unavailable",
      );
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/api/admin/institution", "PATCH", profile);
      setMessage("College profile updated. Refresh to see the new header.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Profile update failed");
    }
  }
  async function savePolicy(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(
        "/api/admin/institution/monitoring-policy",
        "PATCH",
        Object.fromEntries(
          Object.entries(policy).map(([key, value]) => [key, Number(value)]),
        ),
      );
      setMessage("Attendance and safety-alert rules updated.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Monitoring policy update failed",
      );
    }
  }
  async function createStaff(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/api/admin/staff", "POST", {
        ...staffForm,
        employee_no: staffForm.employee_no || null,
        department_id: Number(staffForm.department_id) || null,
      });
      setStaffForm((value) => ({
        name: "",
        email: "",
        password: "",
        access_role: "teacher",
        designation: "teacher",
        employee_no: "",
        department_id: value.department_id,
        biometric_consent: false,
      }));
      setMessage(
        "Staff account created. It is now available for teaching assignment and face enrolment.",
      );
      await load();
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Staff account could not be created",
      );
    }
  }
  async function createAdministrator(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/api/admin/administrators", "POST", administrator);
      setAdministrator({ name: "", email: "", password: "" });
      setMessage("Additional college administrator created.");
      await load();
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Administrator could not be created",
      );
    }
  }
  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(
        `/api/admin/users/${reset.user_id}/reset-password`,
        "POST",
        { temporary_password: reset.temporary_password },
      );
      setReset({ ...reset, temporary_password: "" });
      setMessage("Temporary password issued and previous sessions closed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Password reset failed");
    }
  }
  async function setStaffConsent(member: ManagedStaff, granted: boolean) {
    try {
      await apiRequest(
        `/api/admin/staff/${member.id}/biometric-consent`,
        "PATCH",
        { granted },
      );
      setMessage(
        granted
          ? `${member.name} can now register a face profile.`
          : `${member.name}'s staff face profile was deleted.`,
      );
      await load();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not update staff consent",
      );
    }
  }
  return (
    <section className="institution-account-controls" data-account-focus={focus}>
      <div className="section-heading account-heading">
        <div>
          <p className="eyebrow">College accounts</p>
          <h2>
            {{
              profile: "Institution profile",
              users: "Staff and account management",
              camera: "Attendance and camera policy",
              privacy: "Staff biometric consent",
            }[focus]}
          </h2>
        </div>
        <Users />
      </div>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-forms">
        <form className="panel admin-form" data-account-module="profile" onSubmit={saveProfile}>
          <h3>Edit college details</h3>
          <Input
            value={profile.name}
            onChange={(event) =>
              setProfile({ ...profile, name: event.target.value })
            }
            placeholder="College name"
            required
          />
          <Input
            value={profile.brand_name}
            onChange={(event) =>
              setProfile({ ...profile, brand_name: event.target.value })
            }
            placeholder="Brand name"
            required
          />
          <label className="color-label">
            Brand colour
            <Input
              type="color"
              value={profile.primary_color}
              onChange={(event) =>
                setProfile({ ...profile, primary_color: event.target.value })
              }
            />
          </label>

          <Button type="submit">Save college profile</Button>
        </form>

        <form className="panel admin-form" data-account-module="camera" onSubmit={savePolicy}>
          <h3>Attendance and alert rules</h3>
          <label>
            Presence required (%)
            <Input
              type="number"
              min="1"
              max="100"
              value={policy.attendance_required_percent}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  attendance_required_percent: event.target.value,
                })
              }
              required
            />
          </label>

          <label>
            Fight alert after seconds
            <Input
              type="number"
              min="10"
              value={policy.fight_alert_seconds}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  fight_alert_seconds: event.target.value,
                })
              }
              required
            />
          </label>
          <div className="form-row">
            <label>
              Crowd count
              <Input
                type="number"
                min="2"
                value={policy.crowd_threshold}
                onChange={(event) =>
                  setPolicy({ ...policy, crowd_threshold: event.target.value })
                }
                required
              />
            </label>

            <label>
              Crowd seconds
              <Input
                type="number"
                min="5"
                value={policy.crowd_alert_seconds}
                onChange={(event) =>
                  setPolicy({
                    ...policy,
                    crowd_alert_seconds: event.target.value,
                  })
                }
                required
              />
            </label>
          </div>
          <Button type="submit">Save monitoring rules</Button>
        </form>

        <form className="panel admin-form" data-account-module="users" onSubmit={createStaff}>
          <h3>Create staff account</h3>
          <Input
            placeholder="Staff name"
            value={staffForm.name}
            onChange={(event) =>
              setStaffForm({ ...staffForm, name: event.target.value })
            }
            required
          />
          <Input
            type="email"
            placeholder="Staff email"
            value={staffForm.email}
            onChange={(event) =>
              setStaffForm({ ...staffForm, email: event.target.value })
            }
            required
          />
          <Input
            placeholder="Employee number (optional)"
            value={staffForm.employee_no}
            onChange={(event) =>
              setStaffForm({
                ...staffForm,
                employee_no: event.target.value.toUpperCase(),
              })
            }
          />
          <label>
            Department
            <select
              value={staffForm.department_id}
              onChange={(event) =>
                setStaffForm({
                  ...staffForm,
                  department_id: event.target.value,
                })
              }
            >
              <option value="">Institution-wide staff</option>
              {departments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} · {row.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Designation
              <select
                value={staffForm.designation}
                onChange={(event) =>
                  setStaffForm({
                    ...staffForm,
                    designation: event.target.value,
                  })
                }
              >
                <option value="teacher">Teacher</option>
                <option value="hod">HOD</option>
                <option value="dean">Dean</option>
                <option value="principal">Principal</option>
                <option value="staff">Other staff</option>
                <option value="administrator">Administrator</option>
              </select>
            </label>
            <label>
              Login access
              <select
                value={staffForm.access_role}
                onChange={(event) =>
                  setStaffForm({
                    ...staffForm,
                    access_role: event.target.value,
                  })
                }
              >
                <option value="teacher">Teaching access</option>
                <option value="admin">Administration access</option>
                <option value="staff">Face enrolment only (no login)</option>
              </select>
            </label>
          </div>
          <PasswordInput
            
            minLength={12}
            placeholder="Temporary password"
            value={staffForm.password}
            onChange={(event) =>
              setStaffForm({ ...staffForm, password: event.target.value })
            }
            required
          />
          <label className="check-row">
            <input
              type="checkbox"
              checked={staffForm.biometric_consent}
              onChange={(event) =>
                setStaffForm({
                  ...staffForm,
                  biometric_consent: event.target.checked,
                })
              }
            />{" "}
            Record staff consent for face registration
          </label>
          <Button type="submit">Create staff member</Button>
        </form>

        <form className="panel admin-form" data-account-module="users" onSubmit={createAdministrator}>
          <h3>Add college administrator</h3>
          <Input
            placeholder="Administrator name"
            value={administrator.name}
            onChange={(event) =>
              setAdministrator({ ...administrator, name: event.target.value })
            }
            required
          />
          <Input
            type="email"
            placeholder="Administrator email"
            value={administrator.email}
            onChange={(event) =>
              setAdministrator({ ...administrator, email: event.target.value })
            }
            required
          />
          <PasswordInput
            
            minLength={12}
            placeholder="Temporary password"
            value={administrator.password}
            onChange={(event) =>
              setAdministrator({
                ...administrator,
                password: event.target.value,
              })
            }
            required
          />
          <Button type="submit">Create administrator</Button>
        </form>
      </div>
      <form className="panel reset-account-form" data-account-module="users" onSubmit={resetPassword}>
        <div>
          <h3>Reset a college account</h3>
          <small>
            Students and teachers should change this temporary password after
            signing in.
          </small>
        </div>
        <select
          value={reset.user_id}
          onChange={(event) =>
            setReset({ ...reset, user_id: event.target.value })
          }
        >
          {accounts.map((row) => (
            <option key={row.id} value={row.id}>
              {row.role} · {row.name} · {row.email}
            </option>
          ))}
        </select>
        <PasswordInput
          
          minLength={12}
          placeholder="New temporary password"
          value={reset.temporary_password}
          onChange={(event) =>
            setReset({ ...reset, temporary_password: event.target.value })
          }
          required
        />
        <Button type="submit">Reset password</Button>
      </form>
      <section className="panel" data-account-module="privacy">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Staff biometrics</p>
            <h3>Teacher, HOD, dean and staff faces</h3>
          </div>
          <ScanFace />
        </div>
        <div className="simple-list">
          {staff.map((member) => (
            <div key={member.id}>
              <span>
                <strong>{member.name}</strong>
                <small>
                  {member.designation} · {member.face_samples || 0} face samples
                </small>
              </span>
              <Button
                size="sm"
                variant={member.biometric_consent ? "outline" : "default"}
                onClick={() =>
                  setStaffConsent(member, !member.biometric_consent)
                }
              >
                {member.biometric_consent
                  ? "Withdraw & delete"
                  : "Record consent"}
              </Button>
            </div>
          ))}
        </div>
        <small className="form-help">
          After consent, register three face angles in Live monitor → Student
          and staff face enrolment.
        </small>
      </section>
    </section>
  );
}

function AdminPanel({
  focus = "users",
}: {
  focus?: "users" | "departments" | "courses" | "enrollments" | "privacy" | "audit";
}) {
  const [students, setStudents] = useState<ManagedStudent[]>([]);
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [enrollments, setEnrollments] = useState<ManagedEnrollment[]>([]);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [catalog, setCatalog] = useState<AcademicCatalog | null>(null);
  const [message, setMessage] = useState("");
  const [studentImportFile, setStudentImportFile] = useState<File | null>(null);
  const [studentPhotosZip, setStudentPhotosZip] = useState<File | null>(null);
  const [studentImportPreview, setStudentImportPreview] = useState<{ valid: number; invalid: number; commit_allowed: boolean; rows: { row: number; valid: boolean; errors: string[] }[] } | null>(null);
  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
    password: "",
    roll_no: "",
    department: "",
    department_id: "",
    section_id: "",
    term_id: "",
    date_of_birth: "",
  });
  const [courseForm, setCourseForm] = useState({
    title: "",
    code: "",
    total_lessons: "10",
  });
  const [enrollmentForm, setEnrollmentForm] = useState({
    student_id: "",
    course_id: "",
  });
  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    code: "",
    email_domain: "",
  });
  const [editDepartment, setEditDepartment] = useState({
    id: "",
    name: "",
    code: "",
    email_domain: "",
  });
  const [editStudent, setEditStudent] = useState({
    id: "",
    name: "",
    email: "",
    roll_no: "",
    department: "",
    department_id: "",
    section_id: "",
    term_id: "",
    date_of_birth: "",
  });
  const [editCourse, setEditCourse] = useState({
    id: "",
    title: "",
    code: "",
    total_lessons: "10",
  });
  const load = useCallback(async () => {
    try {
      const [
        studentRows,
        courseRows,
        enrollmentRows,
        auditRows,
        academicCatalog,
      ] = await Promise.all([
        apiRequest<ManagedStudent[]>("/api/students"),
        apiRequest<ManagedCourse[]>("/api/admin/courses"),
        apiRequest<ManagedEnrollment[]>("/api/admin/enrollments"),
        apiRequest<AuditEntry[]>("/api/admin/audit-logs?limit=25"),
        apiRequest<AcademicCatalog>("/api/admin/academics/catalog"),
      ]);
      setStudents(studentRows);
      setCourses(courseRows);
      setEnrollments(enrollmentRows);
      setAudits(auditRows);
      setCatalog(academicCatalog);
      setEnrollmentForm((value) => ({
        student_id: value.student_id || String(studentRows[0]?.id || ""),
        course_id: value.course_id || String(courseRows[0]?.id || ""),
      }));
      setStudentForm((value) => {
        const departmentId =
          value.department_id ||
          String(academicCatalog.departments[0]?.id || "");
        const department = academicCatalog.departments.find(
          (row) => row.id === Number(departmentId),
        );
        const matching = academicCatalog.sections.filter((row) =>
          departmentMatches(row.department, department),
        );
        const currentSectionIsValid = matching.some(
          (row) => row.id === Number(value.section_id),
        );
        return {
          ...value,
          department_id: departmentId,
          department: department?.name || value.department,
          section_id: currentSectionIsValid
            ? value.section_id
            : String(matching[0]?.id || ""),
          term_id: value.term_id || String(academicCatalog.terms[0]?.id || ""),
        };
      });
      setEditDepartment((value) => {
        const selected =
          academicCatalog.departments.find(
            (row) => row.id === Number(value.id),
          ) || academicCatalog.departments[0];
        return selected
          ? {
              id: String(selected.id),
              name: selected.name,
              code: selected.code,
              email_domain:
                selected.email_domain_configured === false
                  ? ""
                  : selected.email_domain,
            }
          : value;
      });
      setEditStudent((value) => {
        const selected =
          studentRows.find((row) => row.id === Number(value.id)) ||
          studentRows[0];
        return selected
          ? {
              id: String(selected.id),
              name: selected.name,
              email: selected.email,
              roll_no: selected.roll_no,
              department: selected.department,
              department_id: String(selected.department_id || ""),
              section_id: String(selected.section_id || ""),
              term_id: String(selected.term_id || ""),
              date_of_birth: selected.date_of_birth || "",
            }
          : value;
      });
      setEditCourse((value) => {
        const selected =
          courseRows.find((row) => row.id === Number(value.id)) ||
          courseRows[0];
        return selected
          ? {
              id: String(selected.id),
              title: selected.title,
              code: selected.code,
              total_lessons: String(selected.total_lessons),
            }
          : value;
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Administrator data unavailable",
      );
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function send(path: string, method: string, body?: object) {
    return apiRequest(path, method, body);
  }
  async function uploadStudentImport(commit = false) {
    if (!studentImportFile) return setMessage("Choose a CSV, XLSX, or XLS student master file first");
    const form = new FormData(); form.append("file", studentImportFile); if (studentPhotosZip) form.append("photos_zip", studentPhotosZip); if (commit) form.append("confirm", "true");
    try {
      const response = await apiFetch(`${API}/api/admin/import/students/${commit ? "commit" : "preview"}`, { method: "POST", credentials: "include", headers: institutionHeaders(), body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : result.detail?.message || "Import failed");
      if (commit) { setMessage(`Student import completed: ${result.created} created, ${result.updated} updated`); setStudentImportPreview(null); await load(); }
      else { setStudentImportPreview(result); setMessage(`Preview ready: ${result.valid} valid, ${result.invalid} need correction`); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed"); }
  }
  async function addStudent(event: FormEvent) {
    event.preventDefault();
    try {
      await send("/api/admin/students", "POST", {
        ...studentForm,
        department_id: Number(studentForm.department_id),
        section_id: Number(studentForm.section_id),
        term_id: Number(studentForm.term_id),
      });
      setStudentForm((value) => ({
        ...value,
        name: "",
        email: "",
        password: "",
        roll_no: "",
        date_of_birth: "",
      }));
      setMessage(
        "Student account created and assigned to the selected class and term",
      );
      load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create student",
      );
    }
  }
  async function addCourse(event: FormEvent) {
    event.preventDefault();
    try {
      await send("/api/admin/courses", "POST", {
        ...courseForm,
        total_lessons: Number(courseForm.total_lessons),
      });
      setCourseForm({ title: "", code: "", total_lessons: "10" });
      setMessage("Course created");
      load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create course",
      );
    }
  }
  async function addEnrollment(event: FormEvent) {
    event.preventDefault();
    try {
      await send("/api/admin/enrollments", "POST", {
        student_id: Number(enrollmentForm.student_id),
        course_id: Number(enrollmentForm.course_id),
      });
      setMessage("Student enrolled");
      load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not enroll student",
      );
    }
  }
  async function setConsent(student: ManagedStudent, granted: boolean) {
    if (granted && student.age_status === "unknown") {
      setMessage(
        "Record the student's date of birth before enabling face registration.",
      );
      return;
    }
    const needsGuardian =
      granted &&
      student.age_status === "minor" &&
      !student.guardian_biometric_consent;
    if (
      needsGuardian &&
      !window.confirm(
        "Confirm that the student's guardian identity and biometric consent were verified by the institution.",
      )
    )
      return;
    try {
      await send(
        `/api/admin/students/${student.id}/biometric-consent`,
        "PATCH",
        { granted, guardian_confirmed: needsGuardian },
      );
      setMessage(
        granted
          ? "Biometric consent recorded"
          : "Consent withdrawn and face template deleted",
      );
      load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update consent",
      );
    }
  }
  async function setProfileEditPermission(student: ManagedStudent) {
    try {
      await send(`/api/admin/students/${student.id}/profile-edit-permission`, "PATCH", { enabled: !student.self_edit_enabled });
      setMessage(student.self_edit_enabled ? "Student profile editing revoked" : "Permitted profile fields can now be edited by the student");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change profile permission");
    }
  }
  async function addDepartment(event: FormEvent) {
    event.preventDefault();
    try {
      await send("/api/admin/departments", "POST", departmentForm);
      setDepartmentForm({ name: "", code: "", email_domain: "" });
      setMessage("Department and email suffix created");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create department",
      );
    }
  }
  function selectDepartmentToEdit(id: string) {
    const row = catalog?.departments.find(
      (department) => department.id === Number(id),
    );
    if (row)
      setEditDepartment({
        id,
        name: row.name,
        code: row.code,
        email_domain:
          row.email_domain_configured === false ? "" : row.email_domain,
      });
  }
  async function updateDepartment(event: FormEvent) {
    event.preventDefault();
    try {
      await send(`/api/admin/departments/${editDepartment.id}`, "PATCH", {
        name: editDepartment.name,
        code: editDepartment.code,
        email_domain: editDepartment.email_domain,
      });
      setMessage("Department details and email domain corrected");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update department",
      );
    }
  }
  function selectStudentToEdit(id: string) {
    const row = students.find((student) => student.id === Number(id));
    if (row)
      setEditStudent({
        id,
        name: row.name,
        email: row.email,
        roll_no: row.roll_no,
        department: row.department,
        department_id: String(row.department_id || ""),
        section_id: String(row.section_id || ""),
        term_id: String(row.term_id || ""),
        date_of_birth: row.date_of_birth || "",
      });
  }
  async function updateStudent(event: FormEvent) {
    event.preventDefault();
    try {
      await send(`/api/admin/students/${editStudent.id}`, "PATCH", {
        ...editStudent,
        department_id: Number(editStudent.department_id) || null,
        section_id: Number(editStudent.section_id) || null,
        term_id: Number(editStudent.term_id) || null,
      });
      setMessage("Student details, department, class and term corrected");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update student",
      );
    }
  }
  function selectCourseToEdit(id: string) {
    const row = courses.find((course) => course.id === Number(id));
    if (row)
      setEditCourse({
        id,
        title: row.title,
        code: row.code,
        total_lessons: String(row.total_lessons),
      });
  }
  async function updateCourse(event: FormEvent) {
    event.preventDefault();
    try {
      await send(`/api/admin/courses/${editCourse.id}`, "PATCH", {
        title: editCourse.title,
        code: editCourse.code,
        total_lessons: Number(editCourse.total_lessons),
      });
      setMessage("Course details corrected");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update course",
      );
    }
  }
  const selectedDepartment = catalog?.departments.find(
    (row) => row.id === Number(studentForm.department_id),
  );
  const matchingSections =
    catalog?.sections.filter((row) =>
      departmentMatches(row.department, selectedDepartment),
    ) || [];
  return (
    <div className="admin-stack" data-admin-focus={focus}>
      <section className="admin-banner">
        <div>
          <p className="eyebrow">Organisation controls</p>
          <h1>
            {{
              users: "Students and user records",
              departments: "Departments",
              courses: "Courses",
              enrollments: "Course enrollments",
              privacy: "Student privacy and biometric consent",
              audit: "Institution audit history",
            }[focus]}
          </h1>
          <p>
            Create accounts, correct records and control biometric processing.
          </p>
        </div>
        <Database size={34} />
      </section>
      {message && <div className="admin-message">{message}</div>}
      <section className="panel" data-admin-module="users">
        <div className="section-heading"><div><p className="eyebrow">Bulk setup</p><h2>Import students safely</h2></div><FileText /></div>
        <p>Upload one student master spreadsheet containing personal and academic fields. To set profile photographs, include a ZIP of JPG/PNG/WEBP images whose filenames match the profile_photo column. Existing students are matched and updated; preview every row before confirming. Role and password fields are never imported from the master template.</p>
        <div className="quick-action-row">
          <a className="button button-outline" href="/api/admin/import/students/template">Download master CSV template</a>
          <Input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => { setStudentImportFile(event.target.files?.[0] || null); setStudentImportPreview(null); }} />
          <label className="import-photo-zip">Optional profile photo ZIP<Input type="file" accept=".zip" onChange={(event) => { setStudentPhotosZip(event.target.files?.[0] || null); setStudentImportPreview(null); }} /></label>
          <Button type="button" variant="outline" onClick={() => void uploadStudentImport(false)}>Preview import</Button>
          <Button type="button" disabled={!studentImportPreview?.commit_allowed} onClick={() => void uploadStudentImport(true)}>Confirm import</Button>
        </div>
        {studentImportPreview && <div className="import-preview"><strong>{studentImportPreview.valid} valid · {studentImportPreview.invalid} invalid</strong>{studentImportPreview.rows.filter((row) => !row.valid).map((row) => <p key={row.row}>Row {row.row}: {row.errors.join("; ")}</p>)}</div>}
      </section>
      <div className="admin-forms">
        <form className="panel admin-form" data-admin-module="departments" onSubmit={addDepartment}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Email organisation</p>
              <h2>New department</h2>
            </div>
            <Building2 />
          </div>
          <Input
            placeholder="Department name"
            value={departmentForm.name}
            onChange={(e) =>
              setDepartmentForm({ ...departmentForm, name: e.target.value })
            }
            required
          />
          <Input
            placeholder="Code, e.g. CSE"
            value={departmentForm.code}
            onChange={(e) =>
              setDepartmentForm({
                ...departmentForm,
                code: e.target.value.toUpperCase(),
              })
            }
            required
          />
          <Input
            placeholder="Email domain, e.g. cse.dsu.ac.in"
            value={departmentForm.email_domain}
            onChange={(e) =>
              setDepartmentForm({
                ...departmentForm,
                email_domain: e.target.value.toLowerCase(),
              })
            }
            required
          />
          <Button type="submit">Create department</Button>
        </form>

        <form className="panel admin-form" data-admin-module="users" onSubmit={addStudent}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Account</p>
              <h2>New student</h2>
            </div>
            <UserPlus />
          </div>
          <Input
            placeholder="Full name"
            value={studentForm.name}
            onChange={(e) =>
              setStudentForm({ ...studentForm, name: e.target.value })
            }
            required
          />
          <label>
            Department
            <select
              value={studentForm.department_id}
              onChange={(e) => {
                const row = catalog?.departments.find(
                  (item) => item.id === Number(e.target.value),
                );
                const sections =
                  catalog?.sections.filter((sectionRow) =>
                    departmentMatches(sectionRow.department, row),
                  ) || [];
                setStudentForm({
                  ...studentForm,
                  department_id: e.target.value,
                  department: row?.name || "",
                  section_id: String(sections[0]?.id || ""),
                });
              }}
              required
            >
              <option value="">Create/select department</option>
              {catalog?.departments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} · {row.name}
                  {row.email_domain_configured === false
                    ? " · email setup required"
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <Input
            placeholder="Email username or full email"
            value={studentForm.email}
            onChange={(e) =>
              setStudentForm({ ...studentForm, email: e.target.value })
            }
            required
          />
          {selectedDepartment && !studentForm.email.includes("@") && (
            <small className="form-help">
              Login email: {studentForm.email || "username"}@
              {selectedDepartment.email_domain}
            </small>
          )}
          {selectedDepartment?.email_domain_configured === false && (
            <small className="form-help">
              This recovered department needs its real email domain below. Until
              then, enter the student&apos;s complete email address.
            </small>
          )}
          <PasswordInput
            
            placeholder="Temporary password (10+ characters)"
            value={studentForm.password}
            onChange={(e) =>
              setStudentForm({ ...studentForm, password: e.target.value })
            }
            required
          />
          <Input
            placeholder="Register / roll number"
            value={studentForm.roll_no}
            onChange={(e) =>
              setStudentForm({ ...studentForm, roll_no: e.target.value })
            }
            required
          />
          <label>
            Date of birth
            <Input
              type="date"
              value={studentForm.date_of_birth}
              onChange={(event) =>
                setStudentForm({
                  ...studentForm,
                  date_of_birth: event.target.value,
                })
              }
              required
            />
          </label>
          <div className="form-row">
            <label>
              Class section
              <select
                value={studentForm.section_id}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, section_id: e.target.value })
                }
                required
              >
                <option value="">Select class section</option>
                {matchingSections.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · Semester {row.semester}
                  </option>
                ))}
              </select>
              {selectedDepartment && !matchingSections.length && (
                <small className="form-help">
                  No matching class exists. Create one for{" "}
                  {selectedDepartment.code} under Academic plan → Class section.
                </small>
              )}
            </label>

            <label>
              Academic term
              <select
                value={studentForm.term_id}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, term_id: e.target.value })
                }
                required
              >
                <option value="">Select academic term</option>
                {catalog?.terms.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.academic_year}
                  </option>
                ))}
              </select>
              {catalog && !catalog.terms.length && (
                <small className="form-help">
                  Create an academic term under Academic plan first.
                </small>
              )}
            </label>
          </div>
          <Button
            type="submit"
            disabled={
              !studentForm.department_id ||
              !studentForm.section_id ||
              !studentForm.term_id
            }
          >
            Create student
          </Button>
        </form>

        <form className="panel admin-form" data-admin-module="courses" onSubmit={addCourse}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Learning</p>
              <h2>New course</h2>
            </div>
            <BookOpen />
          </div>
          <Input
            placeholder="Course title"
            value={courseForm.title}
            onChange={(e) =>
              setCourseForm({ ...courseForm, title: e.target.value })
            }
            required
          />
          <div className="form-row">
            <Input
              placeholder="Code"
              value={courseForm.code}
              onChange={(e) =>
                setCourseForm({ ...courseForm, code: e.target.value })
              }
              required
            />
            <Input
              type="number"
              min="1"
              placeholder="Lessons"
              value={courseForm.total_lessons}
              onChange={(e) =>
                setCourseForm({ ...courseForm, total_lessons: e.target.value })
              }
              required
            />
          </div>
          <Button type="submit">Create course</Button>
        </form>

        <form className="panel admin-form" data-admin-module="enrollments" onSubmit={addEnrollment}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Assignment</p>
              <h2>Enroll student</h2>
            </div>
            <GraduationCap />
          </div>
          <label>
            Student
            <select
              value={enrollmentForm.student_id}
              onChange={(e) =>
                setEnrollmentForm({
                  ...enrollmentForm,
                  student_id: e.target.value,
                })
              }
              required
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.roll_no} · {student.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Course
            <select
              value={enrollmentForm.course_id}
              onChange={(e) =>
                setEnrollmentForm({
                  ...enrollmentForm,
                  course_id: e.target.value,
                })
              }
              required
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.title}
                </option>
              ))}
            </select>
          </label>

          <Button type="submit">Create enrollment</Button>
        </form>
      </div>
      <div className="admin-forms correction-forms">
        <form className="panel admin-form" data-admin-module="users" onSubmit={updateStudent}>
          <h3>Correct student details</h3>
          <select
            value={editStudent.id}
            onChange={(e) => selectStudentToEdit(e.target.value)}
          >
            {students.map((row) => (
              <option key={row.id} value={row.id}>
                {row.roll_no} · {row.name}
              </option>
            ))}
          </select>
          <Input
            value={editStudent.name}
            onChange={(e) =>
              setEditStudent({ ...editStudent, name: e.target.value })
            }
            placeholder="Student name"
            required
          />
          <Input
            value={editStudent.email}
            onChange={(e) =>
              setEditStudent({ ...editStudent, email: e.target.value })
            }
            placeholder="Email"
            required
          />
          <Input
            value={editStudent.roll_no}
            onChange={(e) =>
              setEditStudent({ ...editStudent, roll_no: e.target.value })
            }
            placeholder="Register number"
            required
          />
          <label>
            Date of birth
            <Input
              type="date"
              value={editStudent.date_of_birth}
              onChange={(event) =>
                setEditStudent({
                  ...editStudent,
                  date_of_birth: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Department
            <select
              value={editStudent.department_id}
              onChange={(e) => {
                const row = catalog?.departments.find(
                  (item) => item.id === Number(e.target.value),
                );
                const sections =
                  catalog?.sections.filter((section) =>
                    departmentMatches(section.department, row),
                  ) || [];
                setEditStudent({
                  ...editStudent,
                  department_id: e.target.value,
                  department: row?.name || editStudent.department,
                  section_id: String(sections[0]?.id || ""),
                });
              }}
            >
              <option value="">Legacy department</option>
              {catalog?.departments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} · {row.name}
                </option>
              ))}
            </select>
          </label>

          <div className="form-row">
            <label>
              Class section
              <select
                value={editStudent.section_id}
                onChange={(event) =>
                  setEditStudent({
                    ...editStudent,
                    section_id: event.target.value,
                  })
                }
              >
                <option value="">Keep without active class</option>
                {catalog?.sections
                  .filter((section) =>
                    departmentMatches(
                      section.department,
                      catalog.departments.find(
                        (department) =>
                          department.id === Number(editStudent.department_id),
                      ),
                    ),
                  )
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · Semester {row.semester}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Academic term
              <select
                value={editStudent.term_id}
                onChange={(event) =>
                  setEditStudent({
                    ...editStudent,
                    term_id: event.target.value,
                  })
                }
              >
                <option value="">Keep without active term</option>
                {catalog?.terms.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.academic_year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Button type="submit" disabled={!editStudent.id}>
            Save correction
          </Button>
          {students.find((row) => row.id === Number(editStudent.id)) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void setProfileEditPermission(students.find((row) => row.id === Number(editStudent.id))!)}
            >
              {students.find((row) => row.id === Number(editStudent.id))?.self_edit_enabled
                ? "Revoke student profile editing"
                : "Allow permitted profile editing"}
            </Button>
          )}
        </form>

        <form className="panel admin-form" data-admin-module="departments" onSubmit={updateDepartment}>
          <h3>Correct department details</h3>
          <select
            value={editDepartment.id}
            onChange={(e) => selectDepartmentToEdit(e.target.value)}
          >
            {catalog?.departments.map((row) => (
              <option key={row.id} value={row.id}>
                {row.code} · {row.name}
                {row.email_domain_configured === false
                  ? " · email setup required"
                  : ""}
              </option>
            ))}
          </select>
          <Input
            value={editDepartment.name}
            onChange={(e) =>
              setEditDepartment({ ...editDepartment, name: e.target.value })
            }
            placeholder="Department name"
            required
          />
          <Input
            value={editDepartment.code}
            onChange={(e) =>
              setEditDepartment({
                ...editDepartment,
                code: e.target.value.toUpperCase(),
              })
            }
            placeholder="Department code"
            required
          />
          <Input
            value={editDepartment.email_domain}
            onChange={(e) =>
              setEditDepartment({
                ...editDepartment,
                email_domain: e.target.value.toLowerCase(),
              })
            }
            placeholder="Email domain, e.g. cse.dsu.ac.in"
            required
          />
          <small className="form-help">
            For a recovered department, enter its real email suffix so
            username-only student emails work.
          </small>
          <Button type="submit" disabled={!editDepartment.id}>
            Save department
          </Button>
        </form>

        <form className="panel admin-form" data-admin-module="courses" onSubmit={updateCourse}>
          <h3>Correct course details</h3>
          <select
            value={editCourse.id}
            onChange={(e) => selectCourseToEdit(e.target.value)}
          >
            {courses.map((row) => (
              <option key={row.id} value={row.id}>
                {row.code} · {row.title}
              </option>
            ))}
          </select>
          <Input
            value={editCourse.title}
            onChange={(e) =>
              setEditCourse({ ...editCourse, title: e.target.value })
            }
            placeholder="Course name"
            required
          />
          <Input
            value={editCourse.code}
            onChange={(e) =>
              setEditCourse({ ...editCourse, code: e.target.value })
            }
            placeholder="Course code"
            required
          />
          <Input
            type="number"
            min="1"
            value={editCourse.total_lessons}
            onChange={(e) =>
              setEditCourse({ ...editCourse, total_lessons: e.target.value })
            }
            required
          />
          <Button type="submit" disabled={!editCourse.id}>
            Save correction
          </Button>
        </form>
      </div>
      <section className="panel" data-admin-module="privacy">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Privacy control</p>
            <h2>Students and biometric consent</h2>
          </div>
          <ShieldCheck />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Face template</TableHead>
              <TableHead>Consent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>
                  <strong>{student.name}</strong>
                  <small className="cell-note">
                    {student.roll_no} · {student.email}
                  </small>
                </TableCell>
                <TableCell>{student.department}</TableCell>
                <TableCell>
                  {student.face_registered
                    ? `Registered (${student.face_samples || 0} samples)`
                    : student.face_samples
                      ? `Learning (${student.face_samples}/3)`
                      : "Not registered"}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant={student.biometric_consent ? "outline" : "default"}
                    disabled={
                      !student.biometric_consent &&
                      student.age_status === "unknown"
                    }
                    onClick={() =>
                      setConsent(student, !student.biometric_consent)
                    }
                  >
                    {student.biometric_consent
                      ? "Withdraw & delete"
                      : student.age_status === "unknown"
                        ? "DOB required"
                        : student.age_status === "minor" &&
                            !student.guardian_biometric_consent
                          ? "Verify guardian & enable"
                          : "Enable consent"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <div className="admin-lower">
        <section className="panel" data-admin-module="enrollments">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Academic records</p>
              <h2>Enrollments</h2>
            </div>
          </div>
          <div className="simple-list">
            {enrollments.map((row) => (
              <div key={row.id}>
                <span>
                  <strong>{row.student_name}</strong>
                  <small>{row.course_code}</small>
                </span>
                <b>
                  {row.completed_lessons}/{row.total_lessons} · {row.score}%
                </b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel" data-admin-module="audit">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Security</p>
              <h2>Recent audit activity</h2>
            </div>
          </div>
          <div className="simple-list">
            {audits.map((row) => (
              <div key={row.id}>
                <span>
                  <strong>{row.action}</strong>
                  <small>
                    {row.actor} · {row.entity_type}
                  </small>
                </span>
                <time>{new Date(row.created_at).toLocaleString()}</time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AcademicPlanner({
  user,
  focus = "overview",
}: {
  user: User;
  focus?: "overview" | "timetable" | "assignments" | "exams" | "submissions" | "results" | "classes" | "syllabus" | "allocations" | "terms";
}) {
  const [workspace, setWorkspace] = useState<AcademicWorkspace | null>(null);
  const [catalog, setCatalog] = useState<AcademicCatalog | null>(null);
  const [students, setStudents] = useState<ManagedStudent[]>([]);
  const [message, setMessage] = useState("");
  const [coverage, setCoverage] = useState({
    session_id: "",
    topic_id: "",
    status: "completed",
    coverage_percent: "100",
    notes: "",
  });
  const [assessment, setAssessment] = useState({
    assignment_id: "",
    title: "",
    instructions: "",
    mode: "offline",
    scheduled_at: defaultAssessmentTime(),
    available_until: "",
    duration_minutes: "30",
    total_marks: "20",
    question_count: "10",
    marking_mode: "common",
    common_marks: "1",
    show_correct_answers: true,
    topic_id: "",
  });
  const [courseworkForm, setCourseworkForm] = useState({
    assignment_id: "",
    title: "",
    instructions: "",
    due_at: defaultAssessmentTime(),
    max_marks: "10",
  });
  const [courseworkAnswers, setCourseworkAnswers] = useState<
    Record<number, string>
  >({});
  const [courseworkRoster, setCourseworkRoster] =
    useState<CourseworkRoster | null>(null);
  const [courseworkGrade, setCourseworkGrade] = useState({
    submission_id: "",
    marks: "",
    feedback: "",
  });
  const [question, setQuestion] = useState({
    assessment_id: "",
    question_text: "",
    question_type: "mcq",
    options: "",
    correct_answer: "",
    marks: "1",
  });
  const [resultForm, setResultForm] = useState({
    assessment_id: "",
    student_id: "",
    marks: "",
  });
  const [term, setTerm] = useState({
    name: "",
    academic_year: "",
    start_date: "",
    end_date: "",
  });
  const [editTerm, setEditTerm] = useState({
    id: "",
    name: "",
    academic_year: "",
    start_date: "",
    end_date: "",
  });
  const [section, setSection] = useState({
    name: "",
    department: "",
    semester: "1",
    batch_year: String(new Date().getFullYear()),
  });
  const [assign, setAssign] = useState({
    teacher_id: "",
    course_id: "",
    section_id: "",
    term_id: "",
  });
  const [replacement, setReplacement] = useState({
    assignment_id: "",
    new_teacher_id: "",
    reason: "Staff replacement",
  });
  const [membership, setMembership] = useState({
    student_id: "",
    section_id: "",
    term_id: "",
  });
  const [slot, setSlot] = useState({
    assignment_id: "",
    weekday: "0",
    period_number: "1",
    start_time: "09:00",
    end_time: "10:00",
    classroom: "",
    effective_from: "",
    effective_to: "",
  });
  const [unit, setUnit] = useState({
    course_id: "",
    title: "",
    sequence_no: "1",
  });
  const [topic, setTopic] = useState({
    unit_id: "",
    title: "",
    sequence_no: "1",
    planned_date: "",
    planned_periods: "1",
  });
  const [started, setStarted] = useState<StartedAssessment | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState<AssessmentScore | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [teacherResults, setTeacherResults] = useState<AssessmentRoster | null>(
    null,
  );
  const [resultImportFile, setResultImportFile] = useState<File>();
  const [resultImportPreview, setResultImportPreview] = useState<{batch_id:number;commit_allowed:boolean;rows:{row:number;roll_no:string;student_name:string;marks:number;absent:boolean;valid:boolean;errors:string[]}[]} | null>(null);
  const submittingAttempt = useRef(false);

  const load = useCallback(async () => {
    try {
      let studentRows: ManagedStudent[] = [];
      const academic = await apiRequest<AcademicWorkspace>(
        "/api/academics/workspace",
      );
      setWorkspace(academic);
      setCoverage((value) => ({
        ...value,
        session_id: value.session_id || String(academic.sessions[0]?.id || ""),
        topic_id:
          value.topic_id ||
          String(
            academic.topics.find((row) => row.status !== "completed")?.id ||
              academic.topics[0]?.id ||
              "",
          ),
      }));
      setAssessment((value) => {
        const assignmentId =
          value.assignment_id || String(academic.assignments[0]?.id || "");
        const selectedAssignment = academic.assignments.find(
          (row) => row.id === Number(assignmentId),
        );
        const eligible = academic.topics.filter(
          (row) =>
            row.status === "completed" &&
            row.course_id === selectedAssignment?.course_id,
        );
        const currentIsEligible = eligible.some(
          (row) => row.id === Number(value.topic_id),
        );
        return {
          ...value,
          assignment_id: assignmentId,
          topic_id: currentIsEligible
            ? value.topic_id
            : String(eligible[0]?.id || ""),
        };
      });
      setCourseworkForm((value) => ({
        ...value,
        assignment_id:
          value.assignment_id || String(academic.assignments[0]?.id || ""),
      }));
      setSlot((value) => ({
        ...value,
        assignment_id:
          value.assignment_id || String(academic.assignments[0]?.id || ""),
      }));
      if (user.role !== "student") {
        studentRows = await apiRequest<ManagedStudent[]>("/api/students");
        setStudents(studentRows);
        setResultForm((value) => ({
          ...value,
          student_id: value.student_id || String(studentRows[0]?.id || ""),
        }));
      }
      if (user.role === "admin" || user.designation === "hod") {
        const adminCatalog = await apiRequest<AcademicCatalog>(
          "/api/admin/academics/catalog",
        );
        setCatalog(adminCatalog);
        setSection((value) => ({
          ...value,
          department:
            value.department || adminCatalog.departments[0]?.code || "",
        }));
        setAssign((value) => ({
          ...value,
          teacher_id:
            value.teacher_id || String(adminCatalog.teachers[0]?.id || ""),
          course_id:
            value.course_id || String(adminCatalog.courses[0]?.id || ""),
          section_id:
            value.section_id || String(adminCatalog.sections[0]?.id || ""),
          term_id: value.term_id || String(adminCatalog.terms[0]?.id || ""),
        }));
        setReplacement((value) => {
          const assignmentId =
            value.assignment_id ||
            String(adminCatalog.assignments[0]?.id || "");
          const current = adminCatalog.assignments.find(
            (row) => row.id === Number(assignmentId),
          );
          const nextTeacher = adminCatalog.teachers.find(
            (row) => row.id !== current?.teacher_id,
          );
          return {
            ...value,
            assignment_id: assignmentId,
            new_teacher_id:
              current?.teacher_id === Number(value.new_teacher_id) ||
              !value.new_teacher_id
                ? String(nextTeacher?.id || "")
                : value.new_teacher_id,
          };
        });
        setMembership((value) => ({
          ...value,
          student_id: value.student_id || String(studentRows[0]?.id || ""),
          section_id:
            value.section_id || String(adminCatalog.sections[0]?.id || ""),
          term_id: value.term_id || String(adminCatalog.terms[0]?.id || ""),
        }));
        setSlot((value) => ({
          ...value,
          assignment_id:
            value.assignment_id ||
            String(adminCatalog.assignments[0]?.id || ""),
        }));
        setUnit((value) => ({
          ...value,
          course_id:
            value.course_id || String(adminCatalog.courses[0]?.id || ""),
        }));
        setTopic((value) => ({
          ...value,
          unit_id: value.unit_id || String(adminCatalog.units[0]?.id || ""),
        }));
        setEditTerm((value) => {
          const selected =
            adminCatalog.terms.find((row) => row.id === Number(value.id)) ||
            adminCatalog.terms[0];
          return selected
            ? {
                id: String(selected.id),
                name: selected.name,
                academic_year: selected.academic_year,
                start_date: selected.start_date,
                end_date: selected.end_date,
              }
            : value;
        });
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Academic planner unavailable",
      );
    }
  }, [user.designation, user.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submitAction(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  async function saveCoverage(event: FormEvent) {
    event.preventDefault();
    await submitAction(
      () =>
        apiRequest(
          `/api/academics/sessions/${coverage.session_id}/coverage`,
          "PATCH",
          {
            topic_id: Number(coverage.topic_id),
            status: coverage.status,
            coverage_percent: Number(coverage.coverage_percent),
            notes: coverage.notes || null,
            class_status:
              coverage.status === "postponed" ? "cancelled" : "completed",
          },
        ),
      "Class coverage saved. This topic is now available for tests when completed.",
    );
  }

  async function createAssessment(event: FormEvent) {
    event.preventDefault();
    const assignmentRow = workspace?.assignments.find(
      (row) => row.id === Number(assessment.assignment_id),
    );
    const scheduled = new Date(assessment.scheduled_at);
    const topicRow = workspace?.topics.find(
      (row) => row.id === Number(assessment.topic_id),
    );
    if (!assignmentRow) {
      setMessage("Select a course and section.");
      return;
    }
    if (
      !topicRow ||
      topicRow.course_id !== assignmentRow.course_id ||
      topicRow.status !== "completed"
    ) {
      setMessage("Select a completed topic from the chosen course.");
      return;
    }
    if (Number.isNaN(scheduled.getTime())) {
      setMessage("Select a valid test date and time.");
      return;
    }
    await submitAction(
      async () => {
        const closes = assessment.available_until
          ? new Date(assessment.available_until)
          : null;
        if (closes && (Number.isNaN(closes.getTime()) || closes <= scheduled))
          throw new Error(
            "The test closing time must be after its opening time.",
          );
        const created = await apiRequest<{ id: number }>(
          "/api/academics/assessments",
          "POST",
          {
            assignment_id: assignmentRow.id,
            course_id: assignmentRow.course_id,
            section_id: assignmentRow.section_id,
            title: assessment.title.trim(),
            instructions: assessment.instructions.trim() || null,
            mode: assessment.mode,
            scheduled_at: scheduled.toISOString(),
            available_until: closes?.toISOString() || null,
            duration_minutes: Number(assessment.duration_minutes),
            total_marks: Number(assessment.total_marks),
            question_count:
              assessment.mode === "online"
                ? Number(assessment.question_count)
                : 0,
            marking_mode: assessment.marking_mode,
            common_marks:
              assessment.mode === "online" &&
              assessment.marking_mode === "common"
                ? Number(assessment.common_marks)
                : null,
            show_correct_answers: assessment.show_correct_answers,
            topic_ids: [topicRow.id],
          },
        );
        setQuestion((value) => ({
          ...value,
          assessment_id: String(created.id),
        }));
        setAssessment((value) => ({ ...value, title: "", instructions: "" }));
      },
      assessment.mode === "online"
        ? "Online test draft created. Add questions, then publish it."
        : "Offline classroom test created. Publish it and enter marks after the test.",
    );
  }

  async function addQuestion(event: FormEvent) {
    event.preventDefault();
    const options =
      question.question_type === "mcq"
        ? question.options
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : question.question_type === "true_false"
          ? ["True", "False"]
          : null;
    await submitAction(
      () =>
        apiRequest(
          `/api/academics/assessments/${question.assessment_id}/questions`,
          "POST",
          {
            question_text: question.question_text,
            question_type: question.question_type,
            options,
            correct_answer: question.correct_answer || null,
            marks: Number(question.marks),
          },
        ),
      "Question added to the draft test.",
    );
    setQuestion((value) => ({
      ...value,
      question_text: "",
      options: "",
      correct_answer: "",
    }));
  }

  async function startTest(id: number) {
    try {
      const test = await apiRequest<StartedAssessment>(
        `/api/student/assessments/${id}/start`,
        "POST",
      );
      setStarted(test);
      setSecondsRemaining(test.seconds_remaining);
      setAnswers({});
      setScore(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not start test",
      );
    }
  }

  const submitTest = useCallback(async () => {
    if (!started || submittingAttempt.current) return;
    submittingAttempt.current = true;
    try {
      const response = await apiRequest<AssessmentScore>(
        `/api/student/attempts/${started.attempt_id}/submit`,
        "POST",
        {
          answers: started.questions.map((row) => ({
            question_id: row.id,
            answer: answers[row.id] || "",
          })),
        },
      );
      setScore(response);
      setStarted(null);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not submit test",
      );
    } finally {
      submittingAttempt.current = false;
    }
  }, [answers, load, started]);

  async function viewResult(id: number) {
    try {
      const response = await apiRequest<AssessmentScore>(
        `/api/student/assessments/${id}/result`,
      );
      setScore(response);
      setStarted(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load result",
      );
    }
  }
  async function viewTeacherResults(id: number) {
    try {
      setTeacherResults(
        await apiRequest<AssessmentRoster>(
          `/api/academics/assessments/${id}/results`,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load class results",
      );
    }
  }
  async function downloadResultTemplate(assessmentId:number){try{const response=await apiFetch(`${API}/api/academics/assessments/${assessmentId}/results-import/template`,{credentials:"include",headers:institutionHeaders()});if(!response.ok)throw new Error("Could not download template");const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`assessment-${assessmentId}-results.csv`;anchor.click();URL.revokeObjectURL(url);}catch(error){setMessage(error instanceof Error?error.message:"Template download failed");}}
  async function previewResultImport(){if(!teacherResults||!resultImportFile)return;const body=new FormData();body.append("file",resultImportFile);try{const response=await apiFetch(`${API}/api/academics/assessments/${teacherResults.assessment_id}/results-import/preview`,{method:"POST",credentials:"include",headers:institutionHeaders(),body});const result=await response.json();if(!response.ok)throw new Error(typeof result.detail==="string"?result.detail:"Import preview failed");setResultImportPreview(result);setMessage(result.commit_allowed?"All rows are valid. Review and publish.":"Correct the listed rows and upload again.");}catch(error){setMessage(error instanceof Error?error.message:"Import preview failed");}}
  async function publishResultImport(){if(!resultImportPreview)return;await submitAction(()=>apiRequest(`/api/academics/results-import/${resultImportPreview.batch_id}/publish`,"POST"),"Results published to students.");setResultImportPreview(null);setResultImportFile(undefined);if(teacherResults)await viewTeacherResults(teacherResults.assessment_id);}
  function selectTermToEdit(id: string) {
    const row = catalog?.terms.find((item) => item.id === Number(id));
    if (row)
      setEditTerm({
        id,
        name: row.name,
        academic_year: row.academic_year,
        start_date: row.start_date,
        end_date: row.end_date,
      });
  }
  async function updateTerm(event: FormEvent) {
    event.preventDefault();
    await submitAction(
      () =>
        apiRequest(`/api/admin/academics/terms/${editTerm.id}`, "PATCH", {
          name: editTerm.name,
          academic_year: editTerm.academic_year,
          start_date: editTerm.start_date,
          end_date: editTerm.end_date,
        }),
      "Academic term corrected.",
    );
  }
  async function replaceTeacher(event: FormEvent) {
    event.preventDefault();
    await submitAction(
      () =>
        apiRequest(
          `/api/admin/academics/assignments/${replacement.assignment_id}/replace`,
          "PATCH",
          {
            new_teacher_id: Number(replacement.new_teacher_id),
            reason: replacement.reason,
          },
        ),
      "Teacher replaced. Future classes, open tests and assignments now route to the new teacher.",
    );
  }
  async function submitTimetable(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...slot,
      assignment_id: Number(slot.assignment_id),
      weekday: Number(slot.weekday),
      period_number: Number(slot.period_number),
    };
    await submitAction(
      () =>
        apiRequest(
          user.role === "admin"
            ? "/api/admin/academics/timetable"
            : "/api/academics/timetable/proposals",
          "POST",
          payload,
        ),
      user.role === "admin"
        ? "Timetable published and physical class sessions generated."
        : "Timetable proposal sent to the administrator. It will not create classes until approved.",
    );
  }
  async function reviewTimetable(
    slotId: number,
    decision: "approved" | "rejected",
  ) {
    const reason =
      decision === "rejected"
        ? window.prompt("Reason for rejecting this proposal:")?.trim()
        : "Approved by the institution administrator";
    if (decision === "rejected" && !reason) return;
    await submitAction(
      () =>
        apiRequest(`/api/admin/academics/timetable/${slotId}/review`, "PATCH", {
          decision,
          reason: reason || null,
        }),
      decision === "approved"
        ? "Timetable approved; physical sessions were generated."
        : "Timetable proposal rejected with an audit reason.",
    );
  }
  async function createCoursework(event: FormEvent) {
    event.preventDefault();
    const due = new Date(courseworkForm.due_at);
    if (Number.isNaN(due.getTime())) {
      setMessage("Select a valid assignment due date and time.");
      return;
    }
    await submitAction(
      () =>
        apiRequest("/api/academics/coursework", "POST", {
          assignment_id: Number(courseworkForm.assignment_id),
          title: courseworkForm.title,
          instructions: courseworkForm.instructions,
          due_at: due.toISOString(),
          max_marks: Number(courseworkForm.max_marks),
        }),
      "Assignment draft created. Publish it when ready.",
    );
    setCourseworkForm((value) => ({ ...value, title: "", instructions: "" }));
  }
  async function submitCoursework(row: LearningAssignment) {
    const answer = courseworkAnswers[row.id]?.trim();
    if (!answer) {
      setMessage("Enter your assignment answer before final submission.");
      return;
    }
    await submitAction(
      () =>
        apiRequest(`/api/student/coursework/${row.id}/submit`, "POST", {
          answer_text: answer,
        }),
      "Assignment finally submitted and forwarded to the assigned subject teacher.",
    );
  }
  async function viewCourseworkSubmissions(id: number) {
    try {
      const roster = await apiRequest<CourseworkRoster>(
        `/api/academics/coursework/${id}/submissions`,
      );
      setCourseworkRoster(roster);
      const first = roster.submissions[0];
      setCourseworkGrade({
        submission_id: String(first?.id || ""),
        marks:
          first?.marks === undefined || first?.marks === null
            ? ""
            : String(first.marks),
        feedback: first?.feedback || "",
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load assignment submissions",
      );
    }
  }
  async function gradeCoursework(event: FormEvent) {
    event.preventDefault();
    await submitAction(
      () =>
        apiRequest(
          `/api/academics/coursework/submissions/${courseworkGrade.submission_id}/grade`,
          "PATCH",
          {
            marks: Number(courseworkGrade.marks),
            feedback: courseworkGrade.feedback || null,
          },
        ),
      "Assignment marks and feedback saved for the student.",
    );
    if (courseworkRoster)
      await viewCourseworkSubmissions(courseworkRoster.assignment_id);
  }

  useEffect(() => {
    if (!started) return;
    const update = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(started.ends_at).getTime() - Date.now()) / 1000),
      );
      setSecondsRemaining(remaining);
      if (remaining === 0) void submitTest();
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [started, submitTest]);

  if (!workspace)
    return <div className="loading-state">Loading timetable and syllabus…</div>;
  const selectedAssessmentAssignment = workspace.assignments.find(
    (row) => row.id === Number(assessment.assignment_id),
  );
  const completedTopics = workspace.topics.filter(
    (row) =>
      row.status === "completed" &&
      row.course_id === selectedAssessmentAssignment?.course_id,
  );
  const draftAssessments = workspace.assessments.filter(
    (row) => row.status === "draft",
  );
  const offlineAssessments = workspace.assessments.filter(
    (row) => row.mode === "offline",
  );
  const selectedDraft = draftAssessments.find(
    (row) => row.id === Number(question.assessment_id),
  );

  return (
    <div
      className="academic-stack"
      data-focus={focus}
      data-hod={user.designation === "hod" && user.role !== "admin" ? "true" : "false"}
    >
      <section className="academic-banner">
        <div>
          <p className="eyebrow">Physical classroom plan</p>
          <h1>
            {{
              overview: "Teaching overview",
              timetable: "My timetable",
              assignments: "Assignments",
              exams: "Tests and examinations",
              submissions: "Student submissions",
              results: "Results and marks",
              classes: "My classes and students",
              syllabus: "Academics and syllabus coverage",
              allocations: "Subject and teacher allocation",
              terms: "Academic terms",
            }[focus]}
          </h1>
          <p>
            Plan every period, record what was actually taught, and assess only
            completed topics.
          </p>
        </div>
        <CalendarDays size={38} />
      </section>
      {message && <div className="admin-message">{message}</div>}
      <div className="metric-grid four" data-module="overview">
        <MetricCard
          icon={<BookOpen />}
          label="Syllabus coverage"
          value={`${workspace.summary.coverage_percent}%`}
          note={`${workspace.summary.topics_completed}/${workspace.summary.topics_total} topics`}
          tone="indigo"
        />
        <MetricCard
          icon={<CheckCircle2 />}
          label="Classes completed"
          value={`${workspace.summary.classes_completed}`}
          note="Physical sessions recorded"
          tone="emerald"
        />
        <MetricCard
          icon={<Clock3 />}
          label="Classes scheduled"
          value={`${workspace.summary.classes_scheduled}`}
          note="From the published timetable"
          tone="amber"
        />
        <MetricCard
          icon={<FileQuestion />}
          label="Assessments"
          value={`${workspace.assessments.length}`}
          note="Online and classroom tests"
          tone="rose"
        />
      </div>

      <div className="academic-grid">
        <section className="panel span-two" data-module="overview timetable classes">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Published plan</p>
              <h2>Physical class timetable</h2>
            </div>
            <CalendarDays />
          </div>
          <div className="schedule-list">
            {workspace.sessions.length ? (
              workspace.sessions.slice(0, 15).map((row) => (
                <article key={row.id}>
                  <time>
                    {new Date(`${row.date}T00:00:00`).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" },
                    )}
                  </time>
                  <div>
                    <strong>
                      {row.course_code} · {row.course_title}
                    </strong>
                    <span>
                      {row.section_name} · Period {row.period_number} · Room{" "}
                      {row.classroom}
                    </span>
                  </div>
                  <b className={`state-${row.status}`}>{row.status}</b>
                </article>
              ))
            ) : (
              <div className="empty-note">No classes published yet.</div>
            )}
          </div>
        </section>
        <section className="panel" data-module="overview syllabus">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Syllabus</p>
              <h2>Topic coverage</h2>
            </div>
            <ListChecks />
          </div>
          <div className="topic-list">
            {workspace.topics.map((row) => (
              <article key={row.id}>
                <div>
                  <strong>{row.title}</strong>
                  <span>
                    {row.course_code} · {row.unit_title}
                    {row.planned_date ? ` · ${row.planned_date}` : ""}
                  </span>
                </div>
                <div className="topic-progress">
                  <Progress value={row.coverage_percent} />
                  <b>{row.coverage_percent}%</b>
                </div>
                <small className={`state-${row.status}`}>{row.status}</small>
              </article>
            ))}
          </div>
        </section>
      </div>

      {user.role !== "student" && (
        <div className="teacher-tools">
          <form className="panel academic-form" data-module="syllabus" onSubmit={saveCoverage}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">After every period</p>
                <h2>Record actual topic coverage</h2>
              </div>
              <ClipboardCheck />
            </div>
            <label>
              Physical class
              <select
                value={coverage.session_id}
                onChange={(e) =>
                  setCoverage({ ...coverage, session_id: e.target.value })
                }
                required
              >
                {workspace.sessions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.date} · {row.course_code} · Period {row.period_number}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Topic
              <select
                value={coverage.topic_id}
                onChange={(e) =>
                  setCoverage({ ...coverage, topic_id: e.target.value })
                }
                required
              >
                {workspace.topics.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.course_code} · {row.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Status
                <select
                  value={coverage.status}
                  onChange={(e) => {
                    const status = e.target.value;
                    setCoverage({
                      ...coverage,
                      status,
                      coverage_percent:
                        status === "completed"
                          ? "100"
                          : status === "postponed"
                            ? "0"
                            : "50",
                    });
                  }}
                >
                  <option value="completed">Completed</option>
                  <option value="partial">Partially covered</option>
                  <option value="postponed">Postponed</option>
                </select>
              </label>
              <label>
                Coverage %
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={coverage.coverage_percent}
                  onChange={(e) =>
                    setCoverage({
                      ...coverage,
                      coverage_percent: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label>
              Teacher notes
              <textarea
                value={coverage.notes}
                onChange={(e) =>
                  setCoverage({ ...coverage, notes: e.target.value })
                }
                placeholder="What was covered, homework, or reason for postponement"
              />
            </label>
            <Button type="submit">Save class record</Button>
          </form>
          <form className="panel academic-form" data-module="exams" onSubmit={createAssessment}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Completed topics only</p>
                <h2>Create a test</h2>
              </div>
              <FileQuestion />
            </div>
            <label>
              Course and section
              <select
                value={assessment.assignment_id}
                onChange={(e) => {
                  const assignmentId = e.target.value;
                  const assignmentRow = workspace.assignments.find(
                    (row) => row.id === Number(assignmentId),
                  );
                  const firstTopic = workspace.topics.find(
                    (row) =>
                      row.course_id === assignmentRow?.course_id &&
                      row.status === "completed",
                  );
                  setAssessment({
                    ...assessment,
                    assignment_id: assignmentId,
                    topic_id: String(firstTopic?.id || ""),
                  });
                }}
                required
              >
                {workspace.assignments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.course_code} · {row.section_name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              placeholder="Test title"
              value={assessment.title}
              onChange={(e) =>
                setAssessment({ ...assessment, title: e.target.value })
              }
              required
            />
            <label>
              Instructions shown to students
              <textarea
                value={assessment.instructions}
                onChange={(event) =>
                  setAssessment({
                    ...assessment,
                    instructions: event.target.value,
                  })
                }
                placeholder="Scope, permitted materials and submission rules"
              />
            </label>
            <label>
              Covered topic
              <select
                value={assessment.topic_id}
                onChange={(e) =>
                  setAssessment({ ...assessment, topic_id: e.target.value })
                }
                required
              >
                <option value="">Select completed topic</option>
                {completedTopics.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.course_code} · {row.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Mode
                <select
                  value={assessment.mode}
                  onChange={(e) =>
                    setAssessment({ ...assessment, mode: e.target.value })
                  }
                >
                  <option value="offline">Physical classroom</option>
                  <option value="online">Online</option>
                </select>
              </label>
              <label>
                Date and time
                <Input
                  type="datetime-local"
                  value={assessment.scheduled_at}
                  onChange={(e) =>
                    setAssessment({
                      ...assessment,
                      scheduled_at: e.target.value,
                    })
                  }
                  required
                />
              </label>
            </div>
            {assessment.mode === "online" && (
              <>
                <label>
                  Test closes at (optional)
                  <Input
                    type="datetime-local"
                    value={assessment.available_until}
                    onChange={(event) =>
                      setAssessment({
                        ...assessment,
                        available_until: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="form-row">
                  <label>
                    Number of questions
                    <Input
                      type="number"
                      min="1"
                      max="500"
                      value={assessment.question_count}
                      onChange={(e) =>
                        setAssessment({
                          ...assessment,
                          question_count: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Marks method
                    <select
                      value={assessment.marking_mode}
                      onChange={(e) =>
                        setAssessment({
                          ...assessment,
                          marking_mode: e.target.value,
                        })
                      }
                    >
                      <option value="common">
                        Same marks for every question
                      </option>
                      <option value="separate">
                        Different marks per question
                      </option>
                    </select>
                  </label>
                </div>
                {assessment.marking_mode === "common" && (
                  <label>
                    Marks for each question
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={assessment.common_marks}
                      onChange={(e) =>
                        setAssessment({
                          ...assessment,
                          common_marks: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                )}
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={assessment.show_correct_answers}
                    onChange={(e) =>
                      setAssessment({
                        ...assessment,
                        show_correct_answers: e.target.checked,
                      })
                    }
                  />{" "}
                  Show correct answers after submission
                </label>
              </>
            )}
            <div className="form-row">
              <label>
                Minutes
                <Input
                  type="number"
                  min="5"
                  value={assessment.duration_minutes}
                  onChange={(e) =>
                    setAssessment({
                      ...assessment,
                      duration_minutes: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Total marks
                <Input
                  type="number"
                  min="1"
                  value={
                    assessment.marking_mode === "common" &&
                    assessment.mode === "online"
                      ? String(
                          Number(assessment.question_count) *
                            Number(assessment.common_marks),
                        )
                      : assessment.total_marks
                  }
                  onChange={(e) =>
                    setAssessment({
                      ...assessment,
                      total_marks: e.target.value,
                    })
                  }
                  disabled={
                    assessment.marking_mode === "common" &&
                    assessment.mode === "online"
                  }
                />
              </label>
            </div>
            <Button type="submit" disabled={!completedTopics.length}>
              Create test draft
            </Button>
            {!completedTopics.length && (
              <small className="form-help">
                Complete a topic in this selected course before creating a test.
              </small>
            )}
          </form>
          <form className="panel academic-form" data-module="assignments" onSubmit={createCoursework}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Class coursework</p>
                <h2>Post an assignment</h2>
              </div>
              <ClipboardCheck />
            </div>
            <label>
              Subject and class
              <select
                value={courseworkForm.assignment_id}
                onChange={(event) =>
                  setCourseworkForm({
                    ...courseworkForm,
                    assignment_id: event.target.value,
                  })
                }
                required
              >
                {workspace.assignments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.course_code} · {row.section_name} · {row.teacher_name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              placeholder="Assignment title"
              value={courseworkForm.title}
              onChange={(event) =>
                setCourseworkForm({
                  ...courseworkForm,
                  title: event.target.value,
                })
              }
              required
            />
            <label>
              Instructions
              <textarea
                value={courseworkForm.instructions}
                onChange={(event) =>
                  setCourseworkForm({
                    ...courseworkForm,
                    instructions: event.target.value,
                  })
                }
                placeholder="Questions, task and submission instructions"
                required
              />
            </label>
            <div className="form-row">
              <label>
                Due date and time
                <Input
                  type="datetime-local"
                  value={courseworkForm.due_at}
                  onChange={(event) =>
                    setCourseworkForm({
                      ...courseworkForm,
                      due_at: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Maximum marks
                <Input
                  type="number"
                  min="1"
                  value={courseworkForm.max_marks}
                  onChange={(event) =>
                    setCourseworkForm({
                      ...courseworkForm,
                      max_marks: event.target.value,
                    })
                  }
                  required
                />
              </label>
            </div>
            <Button type="submit" disabled={!workspace.assignments.length}>
              Create assignment draft
            </Button>
          </form>
          {user.role === "teacher" && (
            <form className="panel academic-form" data-module="timetable" onSubmit={submitTimetable}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Administrator approval required</p>
                  <h2>Propose a timetable period</h2>
                </div>
                <CalendarDays />
              </div>
              <label>
                My assigned class
                <select
                  value={slot.assignment_id}
                  onChange={(event) =>
                    setSlot({ ...slot, assignment_id: event.target.value })
                  }
                >
                  {workspace.assignments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.course_code} · {row.section_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Weekday
                  <select
                    value={slot.weekday}
                    onChange={(event) =>
                      setSlot({ ...slot, weekday: event.target.value })
                    }
                  >
                    {[
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ].map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Period
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={slot.period_number}
                    onChange={(event) =>
                      setSlot({ ...slot, period_number: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="form-row">
                <Input
                  type="time"
                  value={slot.start_time}
                  onChange={(event) =>
                    setSlot({ ...slot, start_time: event.target.value })
                  }
                  required
                />
                <Input
                  type="time"
                  value={slot.end_time}
                  onChange={(event) =>
                    setSlot({ ...slot, end_time: event.target.value })
                  }
                  required
                />
              </div>
              <Input
                placeholder="Classroom"
                value={slot.classroom}
                onChange={(event) =>
                  setSlot({ ...slot, classroom: event.target.value })
                }
                required
              />
              <div className="form-row">
                <Input
                  type="date"
                  value={slot.effective_from}
                  onChange={(event) =>
                    setSlot({ ...slot, effective_from: event.target.value })
                  }
                  required
                />
                <Input
                  type="date"
                  value={slot.effective_to}
                  onChange={(event) =>
                    setSlot({ ...slot, effective_to: event.target.value })
                  }
                  required
                />
              </div>
              <Button type="submit" disabled={!workspace.assignments.length}>
                Send timetable proposal
              </Button>
              <small className="form-help">
                The server checks teacher, room and class conflicts before
                accepting the proposal.
              </small>
            </form>
          )}
        </div>
      )}

      {user.role !== "student" && (
        <div className="assessment-tools">
          <form className="panel academic-form" data-module="exams" onSubmit={addQuestion}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Online assessment</p>
                <h2>Add question</h2>
              </div>
              <ListChecks />
            </div>
            <label>
              Draft test
              <select
                value={question.assessment_id}
                onChange={(e) =>
                  setQuestion({ ...question, assessment_id: e.target.value })
                }
                required
              >
                <option value="">Choose draft</option>
                {draftAssessments
                  .filter((row) => row.mode === "online")
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.title} · {row.questions_added || 0}/
                      {row.question_count}
                    </option>
                  ))}
              </select>
            </label>
            {selectedDraft && (
              <small className="question-progress">
                Question{" "}
                {Math.min(
                  (selectedDraft.questions_added || 0) + 1,
                  selectedDraft.question_count,
                )}{" "}
                of {selectedDraft.question_count} ·{" "}
                {selectedDraft.marking_mode === "common"
                  ? `${selectedDraft.common_marks} marks each`
                  : "separate marks"}
              </small>
            )}
            <textarea
              value={question.question_text}
              onChange={(e) =>
                setQuestion({ ...question, question_text: e.target.value })
              }
              placeholder="Question"
              required
            />
            <div className="form-row">
              <label>
                Type
                <select
                  value={question.question_type}
                  onChange={(e) =>
                    setQuestion({ ...question, question_type: e.target.value })
                  }
                >
                  <option value="mcq">Multiple choice</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">
                    Short answer (exact match)
                  </option>
                </select>
              </label>
              <label>
                Marks
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={
                    selectedDraft?.marking_mode === "common"
                      ? String(selectedDraft.common_marks || 1)
                      : question.marks
                  }
                  onChange={(e) =>
                    setQuestion({ ...question, marks: e.target.value })
                  }
                  disabled={selectedDraft?.marking_mode === "common"}
                />
              </label>
            </div>
            {question.question_type === "mcq" && (
              <Input
                placeholder="Options separated by commas"
                value={question.options}
                onChange={(e) =>
                  setQuestion({ ...question, options: e.target.value })
                }
                required
              />
            )}
            <Input
              placeholder="Correct answer used for automatic evaluation"
              value={question.correct_answer}
              onChange={(e) =>
                setQuestion({ ...question, correct_answer: e.target.value })
              }
              required
            />
            <Button
              type="submit"
              disabled={
                !selectedDraft ||
                (selectedDraft.questions_added || 0) >=
                  selectedDraft.question_count
              }
            >
              Add question
            </Button>
          </form>
          <section className="panel" data-module="exams results">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Assessment register</p>
                <h2>Publish and conduct</h2>
              </div>
              <ClipboardCheck />
            </div>
            <div className="assessment-list teacher-assessment-list">
              {workspace.assessments.map((row) => (
                <article key={row.id}>
                  <div>
                    <strong>{row.title}</strong>
                    <span>
                      {row.course_code} · {row.section_name} · {row.mode} ·{" "}
                      {new Date(row.scheduled_at).toLocaleString()}
                    </span>
                    {row.mode === "online" && (
                      <small>
                        {row.questions_added || 0}/{row.question_count}{" "}
                        questions ·{" "}
                        {row.marking_mode === "common"
                          ? `${row.common_marks} each`
                          : "separate marks"}
                      </small>
                    )}
                  </div>
                  <b>{row.total_marks} marks</b>
                  {row.status === "draft" ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        submitAction(
                          () =>
                            apiRequest(
                              `/api/academics/assessments/${row.id}/publish`,
                              "PATCH",
                            ),
                          "Assessment published to students.",
                        )
                      }
                    >
                      Publish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewTeacherResults(row.id)}
                    >
                      Results
                    </Button>
                  )}
                  <small className={`state-${row.status}`}>{row.status}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {user.role !== "student" && (
        <section className="panel" data-module="assignments submissions">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Assignment register</p>
              <h2>Publish and review coursework</h2>
            </div>
            <ClipboardCheck />
          </div>
          <div className="assessment-list teacher-assessment-list">
            {workspace.coursework.length ? (
              workspace.coursework.map((row) => (
                <article key={row.id}>
                  <div>
                    <strong>{row.title}</strong>
                    <span>
                      {row.course_code} · {row.section_name} · due{" "}
                      {new Date(row.due_at).toLocaleString()}
                    </span>
                    <small>
                      {row.submission_count || 0} final submission(s) · routed
                      to {row.teacher_name}
                    </small>
                  </div>
                  <b>{row.max_marks} marks</b>
                  {row.status === "draft" ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        submitAction(
                          () =>
                            apiRequest(
                              `/api/academics/coursework/${row.id}/publish`,
                              "PATCH",
                            ),
                          "Assignment published to students.",
                        )
                      }
                    >
                      Publish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewCourseworkSubmissions(row.id)}
                    >
                      Submissions
                    </Button>
                  )}
                  <small className={`state-${row.status}`}>{row.status}</small>
                </article>
              ))
            ) : (
              <div className="empty-note">
                No coursework assignments created yet.
              </div>
            )}
          </div>
        </section>
      )}

      {user.role !== "student" && courseworkRoster && (
        <form className="panel academic-form" data-module="submissions" onSubmit={gradeCoursework}>
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Final submissions</p>
                <h2>{courseworkRoster.title}</h2>
              </div>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setCourseworkRoster(null)}
              >
                Close
              </Button>
            </div>
            {courseworkRoster.submissions.length ? (
              <>
                <label>
                  Student submission
                  <select
                    value={courseworkGrade.submission_id}
                    onChange={(event) => {
                      const row = courseworkRoster.submissions.find(
                        (item) => item.id === Number(event.target.value),
                      );
                      setCourseworkGrade({
                        submission_id: event.target.value,
                        marks:
                          row?.marks === undefined || row?.marks === null
                            ? ""
                            : String(row.marks),
                        feedback: row?.feedback || "",
                      });
                    }}
                  >
                    {courseworkRoster.submissions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.roll_no} · {row.student_name} · {row.status}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="submission-answer">
                  {courseworkRoster.submissions.find(
                    (row) => row.id === Number(courseworkGrade.submission_id),
                  )?.answer_text ||
                    "No typed answer; review the attached handwritten work."}
                </div>
                <div className="submission-files">
                  {courseworkRoster.submissions
                    .find(
                      (row) => row.id === Number(courseworkGrade.submission_id),
                    )
                    ?.attachments.map((attachment) => (
                      <Button
                        key={attachment.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void downloadProtectedAttachment(
                            attachment.id,
                            attachment.file_name,
                          )
                        }
                      >
                        <FileText size={15} />
                        {attachment.file_name}
                      </Button>
                    ))}
                </div>
                <div className="form-row">
                  <label>
                    Marks out of {courseworkRoster.max_marks}
                    <Input
                      type="number"
                      min="0"
                      max={courseworkRoster.max_marks}
                      value={courseworkGrade.marks}
                      onChange={(event) =>
                        setCourseworkGrade({
                          ...courseworkGrade,
                          marks: event.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Feedback
                    <textarea
                      value={courseworkGrade.feedback}
                      onChange={(event) =>
                        setCourseworkGrade({
                          ...courseworkGrade,
                          feedback: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <Button type="submit">Save grade for student</Button>
              </>
            ) : (
              <div className="empty-note">No final submissions yet.</div>
            )}
          </section>
        </form>
      )}

      {user.role !== "student" && teacherResults && (
        <section className="panel" data-module="results">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Class results</p>
              <h2>{teacherResults.title}</h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTeacherResults(null)}
            >
              Close
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Register number</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Percentage</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teacherResults.results.map((row) => (
                <TableRow key={row.student_id}>
                  <TableCell>{row.student_name}</TableCell>
                  <TableCell>{row.roll_no}</TableCell>
                  <TableCell>
                    {row.marks}/{teacherResults.total_marks}
                  </TableCell>
                  <TableCell>{row.percentage}%</TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!teacherResults.results.length && (
            <div className="empty-note">
              No student results have been submitted yet.
            </div>
          )}
          <div className="result-import-box">
            <h3>Bulk offline results</h3>
            <p>Download the class template, enter marks or mark a student absent, then preview every row before publishing.</p>
            <div className="inline-actions"><Button variant="outline" onClick={()=>void downloadResultTemplate(teacherResults.assessment_id)}>Download CSV template</Button><Input type="file" accept=".csv,.xlsx" onChange={event=>{setResultImportFile(event.target.files?.[0]);setResultImportPreview(null);}}/><Button disabled={!resultImportFile} onClick={()=>void previewResultImport()}>Preview import</Button></div>
            {resultImportPreview&&<><Table><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Student</TableHead><TableHead>Marks</TableHead><TableHead>Validation</TableHead></TableRow></TableHeader><TableBody>{resultImportPreview.rows.map(row=><TableRow key={row.row}><TableCell>{row.row}</TableCell><TableCell>{row.roll_no} · {row.student_name}</TableCell><TableCell>{row.absent?"Absent":row.marks}</TableCell><TableCell>{row.valid?"Ready":row.errors.join(", ")}</TableCell></TableRow>)}</TableBody></Table><Button disabled={!resultImportPreview.commit_allowed} onClick={()=>void publishResultImport()}>Approve and publish results</Button></>}
          </div>
        </section>
      )}

      {user.role !== "student" && offlineAssessments.length > 0 && (
        <form
          className="panel result-form"
          data-module="results"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAction(
              () =>
                apiRequest(
                  `/api/academics/assessments/${resultForm.assessment_id}/offline-results`,
                  "POST",
                  {
                    student_id: Number(resultForm.student_id),
                    marks: Number(resultForm.marks),
                  },
                ),
              "Offline classroom-test marks saved.",
            );
          }}
        >
          <div>
            <p className="eyebrow">Physical test results</p>
            <h2>Enter student marks</h2>
          </div>
          <label>
            Test
            <select
              value={resultForm.assessment_id}
              onChange={(e) =>
                setResultForm({ ...resultForm, assessment_id: e.target.value })
              }
              required
            >
              <option value="">Choose test</option>
              {offlineAssessments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Student
            <select
              value={resultForm.student_id}
              onChange={(e) =>
                setResultForm({ ...resultForm, student_id: e.target.value })
              }
              required
            >
              {students.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.roll_no} · {row.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Marks
            <Input
              type="number"
              min="0"
              value={resultForm.marks}
              onChange={(e) =>
                setResultForm({ ...resultForm, marks: e.target.value })
              }
              required
            />
          </label>
          <Button type="submit">Save marks</Button>
        </form>
      )}

      {user.role === "student" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Course assignments</p>
              <h2>My coursework</h2>
            </div>
            <ClipboardCheck />
          </div>
          <div className="student-coursework">
            {workspace.coursework.length ? (
              workspace.coursework.map((row) => (
                <article key={row.id}>
                  <div>
                    <strong>{row.title}</strong>
                    <span>
                      {row.course_code} · {row.section_name} ·{" "}
                      {row.teacher_name}
                    </span>
                    <small>
                      Due {new Date(row.due_at).toLocaleString()} ·{" "}
                      {row.max_marks} marks
                    </small>
                    <p>{row.instructions}</p>
                  </div>
                  {row.submission_status ? (
                    <div className="submission-result">
                      <b>
                        {row.submission_status === "graded"
                          ? `${row.marks}/${row.max_marks}`
                          : "Submitted"}
                      </b>
                      {row.feedback && (
                        <small>Teacher feedback: {row.feedback}</small>
                      )}
                    </div>
                  ) : (
                    <div>
                      <textarea
                        value={courseworkAnswers[row.id] || ""}
                        onChange={(event) =>
                          setCourseworkAnswers({
                            ...courseworkAnswers,
                            [row.id]: event.target.value,
                          })
                        }
                        placeholder="Enter your answer. Final submission cannot be changed."
                      />
                      <Button size="sm" onClick={() => submitCoursework(row)}>
                        Final submit
                      </Button>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="empty-note">
                No published assignments for your class and term.
              </div>
            )}
          </div>
        </section>
      )}

      {user.role === "student" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Tests from taught topics</p>
              <h2>My assessments</h2>
            </div>
            <FileQuestion />
          </div>
          {score && (
            <div className="result-review">
              <div className="score-result">
                <CheckCircle2 />
                <strong>
                  Your score: {score.score} / {score.total_marks}
                </strong>
                {score.timed_out && <span>Submitted when time expired</span>}
              </div>
              {score.answers.map((answer, index) => (
                <article
                  className={`answer-review ${answer.is_correct ? "answer-correct" : "answer-wrong"}`}
                  key={answer.question_id}
                >
                  <div>
                    <strong>
                      {index + 1}. {answer.question_text}
                    </strong>
                    <small>
                      {answer.awarded_marks ?? 0}/{answer.marks} marks
                    </small>
                  </div>
                  <p>
                    Your answer:{" "}
                    <b>{answer.selected_answer || "Not answered"}</b>
                  </p>
                  {!answer.is_correct && answer.correct_answer && (
                    <p>
                      Correct answer: <b>{answer.correct_answer}</b>
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
          {started ? (
            <div className="test-runner">
              <div className="test-heading">
                <div>
                  <strong>{started.assessment.title}</strong>
                  <span>
                    {started.assessment.duration_minutes} minutes ·{" "}
                    {started.assessment.total_marks} marks
                  </span>
                </div>
                <time
                  className={
                    secondsRemaining < 60 ? "test-timer urgent" : "test-timer"
                  }
                >
                  {String(Math.floor(secondsRemaining / 60)).padStart(2, "0")}:
                  {String(secondsRemaining % 60).padStart(2, "0")}
                </time>
              </div>
              {started.questions.map((row, index) => (
                <article key={row.id}>
                  <p>
                    <b>{index + 1}.</b> {row.question_text}{" "}
                    <small>{row.marks} mark(s)</small>
                  </p>
                  {row.options ? (
                    row.options.map((option) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name={`q-${row.id}`}
                          value={option}
                          checked={answers[row.id] === option}
                          onChange={(e) =>
                            setAnswers({ ...answers, [row.id]: e.target.value })
                          }
                        />
                        {option}
                      </label>
                    ))
                  ) : (
                    <Input
                      value={answers[row.id] || ""}
                      onChange={(e) =>
                        setAnswers({ ...answers, [row.id]: e.target.value })
                      }
                      placeholder="Enter the exact answer"
                    />
                  )}
                </article>
              ))}
              <Button onClick={submitTest}>Submit answers</Button>
            </div>
          ) : (
            <div className="assessment-list">
              {workspace.assessments.length ? (
                workspace.assessments.map((row) => (
                  <article key={row.id}>
                    <div>
                      <strong>{row.title}</strong>
                      <span>
                        {row.course_code} · {row.mode} ·{" "}
                        {new Date(row.scheduled_at).toLocaleString()}
                      </span>
                      {row.result_score !== undefined &&
                        row.result_score !== null && (
                          <small>
                            Recorded score: {row.result_score}/{row.total_marks}
                          </small>
                        )}
                    </div>
                    <b>{row.total_marks} marks</b>
                    {row.mode === "online" && !row.attempt_status && (
                      <Button size="sm" onClick={() => startTest(row.id)}>
                        Start test
                      </Button>
                    )}
                    {row.mode === "online" &&
                      row.attempt_status === "in_progress" && (
                        <Button size="sm" onClick={() => startTest(row.id)}>
                          Continue test
                        </Button>
                      )}
                    {row.mode === "online" &&
                      row.attempt_status &&
                      row.attempt_status !== "in_progress" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewResult(row.id)}
                        >
                          View result
                        </Button>
                      )}
                    <small className={`state-${row.status}`}>
                      {row.status}
                    </small>
                  </article>
                ))
              ) : (
                <div className="empty-note">No published tests yet.</div>
              )}
            </div>
          )}
        </section>
      )}

      {user.role === "admin" && catalog && (
        <section className="panel" data-module="timetable">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Timetable governance</p>
              <h2>Teacher proposals awaiting review</h2>
            </div>
            <CalendarDays />
          </div>
          <div className="assessment-list teacher-assessment-list">
            {catalog.timetable
              .filter((row) => row.publication_status === "pending")
              .map((row) => (
                <article key={row.id}>
                  <div>
                    <strong>
                      {row.course_code} · {row.section_name}
                    </strong>
                    <span>
                      {row.teacher_name} ·{" "}
                      {
                        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                          row.weekday
                        ]
                      }{" "}
                      · {row.start_time}–{row.end_time}
                    </span>
                    <small>
                      Period {row.period_number} · Room {row.classroom} ·{" "}
                      {row.effective_from} to {row.effective_to}
                    </small>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void reviewTimetable(row.id, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void reviewTimetable(row.id, "rejected")}
                  >
                    Reject
                  </Button>
                </article>
              ))}
            {!catalog.timetable.some(
              (row) => row.publication_status === "pending",
            ) && (
              <div className="empty-note">
                No timetable proposals need review.
              </div>
            )}
          </div>
        </section>
      )}

      {(user.role === "admin" || user.designation === "hod") && catalog && (
        <section className="admin-academic" data-module="terms classes allocations timetable syllabus">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Administrator setup</p>
              <h2>Publish the academic plan</h2>
            </div>
            <Database />
          </div>
          <div className="setup-grid">
            <form
              className="panel academic-form"
              data-module="terms"
              onSubmit={(event) => {
                event.preventDefault();
                void submitAction(
                  () => apiRequest("/api/admin/academics/terms", "POST", term),
                  "Academic term created.",
                );
              }}
            >
              <h3>1. Academic term</h3>
              <Input
                placeholder="Term name"
                value={term.name}
                onChange={(e) => setTerm({ ...term, name: e.target.value })}
                required
              />
              <Input
                placeholder="Academic year, e.g. 2026-27"
                value={term.academic_year}
                onChange={(e) =>
                  setTerm({ ...term, academic_year: e.target.value })
                }
                required
              />
              <div className="form-row">
                <Input
                  type="date"
                  value={term.start_date}
                  onChange={(e) =>
                    setTerm({ ...term, start_date: e.target.value })
                  }
                  required
                />
                <Input
                  type="date"
                  value={term.end_date}
                  onChange={(e) =>
                    setTerm({ ...term, end_date: e.target.value })
                  }
                  required
                />
              </div>
              <Button type="submit">Create term</Button>
            </form>
            <form className="panel academic-form" data-module="terms" onSubmit={updateTerm}>
              <h3>Correct an academic term</h3>
              <label>
                Existing term
                <select
                  value={editTerm.id}
                  onChange={(event) => selectTermToEdit(event.target.value)}
                >
                  {catalog.terms.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.academic_year}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                placeholder="Term name"
                value={editTerm.name}
                onChange={(event) =>
                  setEditTerm({ ...editTerm, name: event.target.value })
                }
                required
              />
              <Input
                placeholder="Academic year"
                value={editTerm.academic_year}
                onChange={(event) =>
                  setEditTerm({
                    ...editTerm,
                    academic_year: event.target.value,
                  })
                }
                required
              />
              <div className="form-row">
                <Input
                  type="date"
                  value={editTerm.start_date}
                  onChange={(event) =>
                    setEditTerm({ ...editTerm, start_date: event.target.value })
                  }
                  required
                />
                <Input
                  type="date"
                  value={editTerm.end_date}
                  onChange={(event) =>
                    setEditTerm({ ...editTerm, end_date: event.target.value })
                  }
                  required
                />
              </div>
              <Button type="submit" disabled={!editTerm.id}>
                Save term correction
              </Button>
            </form>
            <form
              className="panel academic-form"
              data-module="classes"
              onSubmit={(event) => {
                event.preventDefault();
                void submitAction(
                  () =>
                    apiRequest("/api/admin/academics/sections", "POST", {
                      ...section,
                      semester: Number(section.semester),
                      batch_year: Number(section.batch_year),
                    }),
                  "Class section created and is now selectable for students.",
                );
              }}
            >
              <h3>2. Class section</h3>
              <Input
                placeholder="Section, e.g. CSE-A"
                value={section.name}
                onChange={(e) =>
                  setSection({ ...section, name: e.target.value })
                }
                required
              />
              <label>
                Department
                <select
                  value={section.department}
                  onChange={(e) =>
                    setSection({ ...section, department: e.target.value })
                  }
                  required
                >
                  <option value="">Select department</option>
                  {catalog.departments.map((row) => (
                    <option key={row.id} value={row.code}>
                      {row.code} · {row.name}
                    </option>
                  ))}
                </select>
                {!catalog.departments.length && (
                  <small className="form-help">
                    Create a department in Administration before creating its
                    class.
                  </small>
                )}
              </label>
              <div className="form-row">
                <Input
                  type="number"
                  min="1"
                  max="20"
                  placeholder="Semester"
                  value={section.semester}
                  onChange={(e) =>
                    setSection({ ...section, semester: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="Batch year"
                  value={section.batch_year}
                  onChange={(e) =>
                    setSection({ ...section, batch_year: e.target.value })
                  }
                />
              </div>
              <Button type="submit" disabled={!catalog.departments.length}>
                Create section
              </Button>
            </form>
            <form
              className="panel academic-form"
              data-module="allocations"
              onSubmit={(event) => {
                event.preventDefault();
                void submitAction(
                  () =>
                    apiRequest(
                      "/api/admin/academics/assignments",
                      "POST",
                      Object.fromEntries(
                        Object.entries(assign).map(([key, value]) => [
                          key,
                          Number(value),
                        ]),
                      ),
                    ),
                  "Teacher assigned to course and section.",
                );
              }}
            >
              <h3>3. Teacher assignment</h3>
              <label>
                Teacher
                <select
                  value={assign.teacher_id}
                  onChange={(e) =>
                    setAssign({ ...assign, teacher_id: e.target.value })
                  }
                >
                  {catalog.teachers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Course
                <select
                  value={assign.course_id}
                  onChange={(e) =>
                    setAssign({ ...assign, course_id: e.target.value })
                  }
                >
                  {catalog.courses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.code} · {row.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Section
                  <select
                    value={assign.section_id}
                    onChange={(e) =>
                      setAssign({ ...assign, section_id: e.target.value })
                    }
                  >
                    {catalog.sections.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Term
                  <select
                    value={assign.term_id}
                    onChange={(e) =>
                      setAssign({ ...assign, term_id: e.target.value })
                    }
                  >
                    {catalog.terms.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Button type="submit">Assign teacher</Button>
            </form>
            <form className="panel academic-form" data-module="allocations" onSubmit={replaceTeacher}>
              <h3>Replace assigned teacher</h3>
              <label>
                Current class teacher
                <select
                  value={replacement.assignment_id}
                  onChange={(event) => {
                    const current = catalog.assignments.find(
                      (row) => row.id === Number(event.target.value),
                    );
                    const nextTeacher = catalog.teachers.find(
                      (row) => row.id !== current?.teacher_id,
                    );
                    setReplacement({
                      ...replacement,
                      assignment_id: event.target.value,
                      new_teacher_id: String(nextTeacher?.id || ""),
                    });
                  }}
                >
                  {catalog.assignments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.course_code} · {row.section_name} · {row.term_name} ·{" "}
                      {row.teacher_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                New teacher
                <select
                  value={replacement.new_teacher_id}
                  onChange={(event) =>
                    setReplacement({
                      ...replacement,
                      new_teacher_id: event.target.value,
                    })
                  }
                >
                  {catalog.teachers
                    .filter(
                      (row) =>
                        row.id !==
                        catalog.assignments.find(
                          (item) =>
                            item.id === Number(replacement.assignment_id),
                        )?.teacher_id,
                    )
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                </select>
              </label>
              <Input
                placeholder="Reason, e.g. staff left college"
                value={replacement.reason}
                onChange={(event) =>
                  setReplacement({ ...replacement, reason: event.target.value })
                }
                required
              />
              <small className="form-help">
                Use a new assignment each semester. Use replacement only for a
                mid-term staff change; completed records remain with the
                previous teacher.
              </small>
              <Button
                type="submit"
                disabled={
                  !replacement.assignment_id || !replacement.new_teacher_id
                }
              >
                Replace teacher
              </Button>
            </form>
            <form
              className="panel academic-form"
              data-module="classes"
              onSubmit={(event) => {
                event.preventDefault();
                void submitAction(
                  () =>
                    apiRequest(
                      "/api/admin/academics/section-memberships",
                      "POST",
                      {
                        student_id: Number(membership.student_id),
                        section_id: Number(membership.section_id),
                        term_id: Number(membership.term_id),
                      },
                    ),
                  "Student assigned to the selected class and term. Any previous class in that term was replaced.",
                );
              }}
            >
              <h3>4. Assign or move student</h3>
              <label>
                Student
                <select
                  value={membership.student_id}
                  onChange={(e) =>
                    setMembership({ ...membership, student_id: e.target.value })
                  }
                >
                  {students.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.roll_no} · {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <select
                  value={membership.section_id}
                  onChange={(e) =>
                    setMembership({ ...membership, section_id: e.target.value })
                  }
                >
                  {catalog.sections.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Term
                <select
                  value={membership.term_id}
                  onChange={(e) =>
                    setMembership({ ...membership, term_id: e.target.value })
                  }
                >
                  {catalog.terms.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit">Assign or move</Button>
            </form>
            <form
              className="panel academic-form"
              data-module="timetable"
              onSubmit={(event) => {
                event.preventDefault();
                void submitAction(
                  () =>
                    apiRequest("/api/admin/academics/timetable", "POST", {
                      ...slot,
                      assignment_id: Number(slot.assignment_id),
                      weekday: Number(slot.weekday),
                      period_number: Number(slot.period_number),
                    }),
                  "Timetable published and physical class sessions generated.",
                );
              }}
            >
              <h3>5. Timetable period</h3>
              <label>
                Assignment
                <select
                  value={slot.assignment_id}
                  onChange={(e) =>
                    setSlot({ ...slot, assignment_id: e.target.value })
                  }
                >
                  {catalog.assignments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.course_code} · {row.section_name} ·{" "}
                      {row.teacher_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Weekday
                  <select
                    value={slot.weekday}
                    onChange={(e) =>
                      setSlot({ ...slot, weekday: e.target.value })
                    }
                  >
                    {[
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ].map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Period
                  <Input
                    type="number"
                    min="1"
                    value={slot.period_number}
                    onChange={(e) =>
                      setSlot({ ...slot, period_number: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="form-row">
                <Input
                  type="time"
                  value={slot.start_time}
                  onChange={(e) =>
                    setSlot({ ...slot, start_time: e.target.value })
                  }
                />
                <Input
                  type="time"
                  value={slot.end_time}
                  onChange={(e) =>
                    setSlot({ ...slot, end_time: e.target.value })
                  }
                />
              </div>
              <Input
                placeholder="Classroom"
                value={slot.classroom}
                onChange={(e) =>
                  setSlot({ ...slot, classroom: e.target.value })
                }
                required
              />
              <div className="form-row">
                <Input
                  type="date"
                  value={slot.effective_from}
                  onChange={(e) =>
                    setSlot({ ...slot, effective_from: e.target.value })
                  }
                  required
                />
                <Input
                  type="date"
                  value={slot.effective_to}
                  onChange={(e) =>
                    setSlot({ ...slot, effective_to: e.target.value })
                  }
                  required
                />
              </div>
              <Button type="submit">Publish timetable</Button>
            </form>
            <div className="syllabus-setup">
              <form
                className="panel academic-form"
                data-module="syllabus"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAction(
                    () =>
                      apiRequest(
                        "/api/admin/academics/syllabus/units",
                        "POST",
                        {
                          course_id: Number(unit.course_id),
                          title: unit.title,
                          sequence_no: Number(unit.sequence_no),
                        },
                      ),
                    "Syllabus unit created.",
                  );
                }}
              >
                <h3>6. Syllabus unit</h3>
                <label>
                  Course
                  <select
                    value={unit.course_id}
                    onChange={(e) =>
                      setUnit({ ...unit, course_id: e.target.value })
                    }
                  >
                    {catalog.courses.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.code} · {row.title}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  placeholder="Unit title"
                  value={unit.title}
                  onChange={(e) => setUnit({ ...unit, title: e.target.value })}
                  required
                />
                <Input
                  type="number"
                  min="1"
                  placeholder="Sequence"
                  value={unit.sequence_no}
                  onChange={(e) =>
                    setUnit({ ...unit, sequence_no: e.target.value })
                  }
                />
                <Button type="submit">Add unit</Button>
              </form>
              <form
                className="panel academic-form"
                data-module="syllabus"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAction(
                    () =>
                      apiRequest(
                        "/api/admin/academics/syllabus/topics",
                        "POST",
                        {
                          unit_id: Number(topic.unit_id),
                          title: topic.title,
                          sequence_no: Number(topic.sequence_no),
                          planned_date: topic.planned_date || null,
                          planned_periods: Number(topic.planned_periods),
                        },
                      ),
                    "Syllabus topic and planned date added.",
                  );
                }}
              >
                <h3>7. Topic and target date</h3>
                <label>
                  Unit
                  <select
                    value={topic.unit_id}
                    onChange={(e) =>
                      setTopic({ ...topic, unit_id: e.target.value })
                    }
                  >
                    {catalog.units.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.course_code} · {row.title}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  placeholder="Topic title"
                  value={topic.title}
                  onChange={(e) =>
                    setTopic({ ...topic, title: e.target.value })
                  }
                  required
                />
                <div className="form-row">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Sequence"
                    value={topic.sequence_no}
                    onChange={(e) =>
                      setTopic({ ...topic, sequence_no: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="Periods"
                    value={topic.planned_periods}
                    onChange={(e) =>
                      setTopic({ ...topic, planned_periods: e.target.value })
                    }
                  />
                </div>
                <Input
                  type="date"
                  value={topic.planned_date}
                  onChange={(e) =>
                    setTopic({ ...topic, planned_date: e.target.value })
                  }
                />
                <Button type="submit">Add planned topic</Button>
              </form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<TenantBrand | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [data, setData] = useState<Dashboard>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState(() =>
    typeof window === "undefined"
      ? "dashboard"
      : new URLSearchParams(window.location.search).get("view") || "dashboard",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await apiRequest<Dashboard>("/api/dashboard"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard unavailable");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);
  function login(newUser: User) {
    setUser(newUser);
    const destination = newUser.credential_change_required ? "security" : "dashboard";
    setActiveView(destination);
    window.history.replaceState({}, "", `${window.location.pathname}?view=${destination}`);
    if (!newUser.platform_admin && !newUser.credential_change_required) void loadDashboard();
  }
  function chooseInstitution(selected: TenantBrand) {
    window.localStorage.setItem("ours_institution_slug", selected.slug);
    setTenant(selected);
    setUser(null);
    setData({});
  }
  function changeInstitution() {
    window.localStorage.removeItem("ours_institution_slug");
    setTenant(null);
    setUser(null);
    setData({});
  }
  async function logout() {
    try {
      await apiRequest("/api/auth/logout", "POST");
    } finally {
      setUser(null);
      setData({});
      setActiveView("dashboard");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }
  useEffect(() => {
    const expire = () => {
      setUser(null);
      setData({});
      setError("Your session expired. Please sign in again.");
      setActiveView("dashboard");
    };
    const restoreView = () =>
      setActiveView(
        new URLSearchParams(window.location.search).get("view") || "dashboard",
      );
    window.addEventListener("ours:session-expired", expire);
    window.addEventListener("popstate", restoreView);
    return () => {
      window.removeEventListener("ours:session-expired", expire);
      window.removeEventListener("popstate", restoreView);
    };
  }, []);
  useEffect(() => {
    const restore = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const linkToken = params.get("reset_token") || "";
        const linkInstitution = params.get("institution") || "";
        if (linkToken && linkInstitution) {
          window.localStorage.setItem("ours_institution_slug", linkInstitution);
          setResetToken(linkToken);
        }
        const brand = await apiRequest<TenantBrand>("/api/public/tenant");
        setTenant(brand);
        window.localStorage.setItem("ours_institution_slug", brand.slug);
        if (!linkToken) {
          try {
            const session = await apiRequest<{ user: User }>("/api/auth/me");
            setUser(session.user);
            if (!session.user.platform_admin) await loadDashboard();
          } catch {
            /* No active session is a normal login-page state. */
          }
        }
      } catch {
        if (selectedInstitutionSlug())
          window.localStorage.removeItem("ours_institution_slug");
        setTenant(null);
      } finally {
        setCheckingSession(false);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, [loadDashboard]);
  useEffect(() => {
    if (!user || user.platform_admin) return;
    const timer = window.setInterval(() => void loadDashboard(true), 30000);
    return () => window.clearInterval(timer);
  }, [loadDashboard, user]);
  if (checkingSession)
    return <main className="loading-state">Checking secure session…</main>;
  if (!tenant) return <InstitutionPicker onSelect={chooseInstitution} />;
  if (resetToken)
    return (
      <ResetPassword
        tenant={tenant}
        token={resetToken}
        onComplete={() => {
          window.history.replaceState({}, "", window.location.pathname);
          setResetToken("");
        }}
      />
    );
  if (!user)
    return <Login onLogin={login} tenant={tenant} onBack={changeInstitution} />;
  const isStudent = user.role === "student";
  const isPlatformOwner = user.platform_admin;
  const isCollegeAdmin = user.role === "admin" && !isPlatformOwner;
  const isHod = user.role === "teacher" && user.designation === "hod";
  const studentItems = [
    { id: "dashboard", label: "Dashboard", icon: <HomeIcon /> },
    { id: "assignments", label: "Assignments", icon: <FileText /> },
    { id: "exams", label: "Exams", icon: <FileQuestion /> },
    { id: "results", label: "Results", icon: <Trophy /> },
    { id: "attendance", label: "Attendance", icon: <ClipboardCheck /> },
    { id: "on_duty", label: "On duty", icon: <ClipboardCheck /> },
    { id: "behaviour", label: "Behaviour", icon: <Activity /> },
    { id: "timetable", label: "Timetable", icon: <CalendarDays /> },
    { id: "fees", label: "Fees", icon: <IndianRupee /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone /> },
    { id: "feedback", label: "Feedback", icon: <Star /> },
    { id: "profile", label: "Profile", icon: <UserCircle /> },
    { id: "documents", label: "Documents", icon: <FileText /> },
    { id: "security", label: "Security", icon: <ShieldCheck /> },
  ];
  const platformItems = [
    { id: "dashboard", label: "Platform", icon: <HomeIcon /> },
    { id: "institutions", label: "Institutions", icon: <Building2 /> },
    { id: "college_admins", label: "Admins & team", icon: <Users /> },
    { id: "support", label: "Support access", icon: <ShieldCheck /> },
    { id: "models", label: "Model releases", icon: <Activity /> },
    { id: "system", label: "System status", icon: <Database /> },
    { id: "platform_audit", label: "Audit", icon: <ListChecks /> },
    { id: "security", label: "Security", icon: <ShieldCheck /> },
  ];
  const adminItems = [
    { id: "dashboard", label: "Dashboard", icon: <HomeIcon /> },
    { id: "users", label: "People", icon: <Users /> },
    { id: "departments", label: "Departments", icon: <Building2 /> },
    { id: "courses", label: "Courses", icon: <BookOpen /> },
    { id: "classes", label: "Classes", icon: <GraduationCap /> },
    { id: "terms", label: "Terms", icon: <CalendarDays /> },
    { id: "allocations", label: "Allocations", icon: <UserPlus /> },
    { id: "timetable", label: "Timetable", icon: <Clock3 /> },
    { id: "syllabus", label: "Syllabus", icon: <BookOpen /> },
    { id: "attendance", label: "Attendance", icon: <Camera /> },
    { id: "on_duty", label: "On duty", icon: <ClipboardCheck /> },
    { id: "assignments", label: "Assignments", icon: <FileText /> },
    { id: "exams", label: "Exams", icon: <FileQuestion /> },
    { id: "submissions", label: "Submissions", icon: <ListChecks /> },
    { id: "results", label: "Results", icon: <Trophy /> },
    { id: "enrollments", label: "Enrollments", icon: <ClipboardCheck /> },
    { id: "fees", label: "Fees", icon: <IndianRupee /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone /> },
    { id: "institution_profile", label: "Institution", icon: <Settings2 /> },
    { id: "camera_policy", label: "Camera policy", icon: <ScanFace /> },
    { id: "privacy", label: "Privacy", icon: <ShieldCheck /> },
    { id: "audit", label: "Audit", icon: <ListChecks /> },
    { id: "support_requests", label: "Support consent", icon: <ShieldCheck /> },
    { id: "security", label: "Security", icon: <ShieldCheck /> },
  ];
  const teacherItems = [
    { id: "dashboard", label: "Dashboard", icon: <HomeIcon /> },
    { id: "timetable", label: "Timetable", icon: <CalendarDays /> },
    { id: "classes", label: "Classes", icon: <GraduationCap /> },
    { id: "syllabus", label: "Syllabus", icon: <BookOpen /> },
    ...(isHod
      ? [{ id: "allocations", label: "Allocations", icon: <UserPlus /> }]
      : []),
    { id: "attendance", label: "Attendance & camera", icon: <Camera /> },
    { id: "on_duty", label: "On duty", icon: <ClipboardCheck /> },
    { id: "assignments", label: "Assignments", icon: <FileText /> },
    { id: "exams", label: "Exams", icon: <FileQuestion /> },
    { id: "submissions", label: "Submissions", icon: <ListChecks /> },
    { id: "results", label: "Results", icon: <Trophy /> },
    { id: "teaching", label: "Teaching", icon: <BarChart3 /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone /> },
    { id: "career", label: "Career", icon: <BriefcaseBusiness /> },
    { id: "profile", label: "Profile", icon: <UserCircle /> },
    { id: "security", label: "Security", icon: <ShieldCheck /> },
  ];
  const baseItems = isStudent
    ? studentItems
    : isPlatformOwner
      ? platformItems
      : isCollegeAdmin
        ? adminItems
        : teacherItems;
  const items = [...baseItems, {id:"notifications",label:"Notifications",icon:<Bell />}];
  const effectiveView = user.credential_change_required
    ? "security"
    : items.some((item) => item.id === activeView)
    ? activeView
    : "dashboard";
  function openView(id: string) {
    setActiveView(id);
    setDrawerOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("view", id);
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  let content: React.ReactNode;
  if (effectiveView === "notifications") {
    content = <NotificationCenter userId={user.id} onNavigate={openView} />;
  } else if (effectiveView === "timetable" && !isStudent && !isPlatformOwner) {
    content = <TimetableManager userId={user.id} />;
  } else if (isStudent) {
    if (effectiveView === "dashboard")
      content = loading ? (
        <div className="loading-state">Loading your campus portal…</div>
      ) : (
        <StudentPortalDashboard
          user={user}
          analytics={data.analytics}
          onNavigate={openView}
        />
      );
    else if (effectiveView === "security") content = <AccountSecurity />;
    else
      content = (
        <StudentServicePage view={effectiveView} analytics={data.analytics} />
      );
  } else if (isPlatformOwner) {
    if (effectiveView === "dashboard")
      content = <PlatformDashboard onNavigate={openView} />;
    else if (effectiveView === "institutions")
      content = <PlatformInstitutions />;
    else if (effectiveView === "college_admins")
      content = <PlatformAccountControls />;
    else if (effectiveView === "support")
      content = <PlatformSupportPage />;
    else if (effectiveView === "models")
      content = <ModelGovernancePage />;
    else if (effectiveView === "system")
      content = <PlatformSystemPage />;
    else if (effectiveView === "platform_audit")
      content = <PlatformAuditPage />;
    else content = <AccountSecurity />;
  } else if (isCollegeAdmin) {
    if (effectiveView === "dashboard")
      content = loading ? (
        <div className="loading-state">Loading institution operations…</div>
      ) : (
        <CollegeAdminDashboard data={data} onNavigate={openView} />
      );
    else if (effectiveView === "users")
      content = <div className="admin-combined"><AdminPanel focus="users" /><InstitutionAccountControls focus="users" /></div>;
    else if (["departments", "courses", "enrollments", "audit"].includes(effectiveView))
      content = <AdminPanel focus={effectiveView as "departments" | "courses" | "enrollments" | "audit"} />;
    else if (["classes", "terms", "allocations", "timetable", "syllabus", "assignments", "exams", "submissions", "results"].includes(effectiveView))
      content = <AcademicPlanner user={user} focus={effectiveView as "classes" | "terms" | "allocations" | "timetable" | "syllabus" | "assignments" | "exams" | "submissions" | "results"} />;
    else if (effectiveView === "attendance")
      content = <LiveMonitor onRefresh={() => void loadDashboard(true)} user={user} />;
    else if (effectiveView === "on_duty") content = <OnDutyPage role="admin" />;
    else if (effectiveView === "fees") content = <AdminServicesPageV6 />;
    else if (effectiveView === "announcements") content = <AnnouncementManager />;
    else if (effectiveView === "institution_profile") content = <InstitutionAccountControls focus="profile" />;
    else if (effectiveView === "camera_policy") content = <InstitutionAccountControls focus="camera" />;
    else if (effectiveView === "privacy")
      content = <div className="admin-combined"><AdminPanel focus="privacy" /><InstitutionAccountControls focus="privacy" /></div>;
    else if (effectiveView === "support_requests") content = <CollegeSupportRequests />;
    else content = <AccountSecurity />;
  } else {
    if (effectiveView === "dashboard")
      content = loading ? (
        <div className="loading-state">Loading classroom data…</div>
      ) : (
        <TeacherDashboard data={data} />
      );
    else if (["timetable", "classes", "syllabus", "allocations", "assignments", "exams", "submissions", "results"].includes(effectiveView))
      content = <AcademicPlanner user={user} focus={effectiveView as "timetable" | "classes" | "syllabus" | "allocations" | "assignments" | "exams" | "submissions" | "results"} />;
    else if (effectiveView === "attendance")
      content = (
        <LiveMonitor onRefresh={() => void loadDashboard(true)} user={user} />
      );
    else if (effectiveView === "on_duty") content = <OnDutyPage role={user.role} />;
    else if (effectiveView === "teaching") content = <TeacherQualityPage />;
    else if (effectiveView === "announcements") content = <AnnouncementManager />;
    else if (effectiveView === "career") content = <CareerPage />;
    else if (effectiveView === "profile")
      content = <StaffProfilePage user={user} />;
    else content = <AccountSecurity />;
  }
  return (
    <main
      className="campus-app"
      style={{ "--tenant-color": tenant.primary_color } as React.CSSProperties}
    >
      <PushLifecycle userId={user.id} />
      <header className="campus-topbar">
        <button
          className="campus-icon-button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
        >
          <Menu />
        </button>
        <div className="campus-title">
          <span className="campus-monogram">O</span>
          <div>
            <strong>{tenant.name}</strong>
            <small>{tenant.brand_name} Campus Portal</small>
          </div>
        </div>
        <div className="campus-header-actions">
          <button
            className="campus-icon-button"
            onClick={() => openView("notifications")}
            aria-label="Notifications"
          >
            <Bell />
          </button>
          <button
            className="campus-user-button"
            onClick={() => openView(isStudent ? "profile" : "security")}
          >
            <span>{user.name.slice(0, 1)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {isPlatformOwner
                  ? "platform owner"
                  : user.designation || user.role}
              </small>
            </div>
          </button>
          <button
            className="campus-icon-button"
            onClick={() => void logout()}
            aria-label="Sign out"
          >
            <LogOut />
          </button>
        </div>
      </header>
      <nav className="campus-service-rail" aria-label="Campus services">
        {items.map((item) => (
          <button
            key={item.id}
            className={effectiveView === item.id ? "active" : ""}
            onClick={() => openView(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {drawerOpen && (
        <>
          <button
            className="drawer-scrim"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="campus-drawer">
            <header>
              <div className="drawer-profile">
                <span>{user.name.slice(0, 1)}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)}>
                <X />
              </button>
            </header>
            <p>{tenant.name}</p>
            <nav>
              {items.map((item) => (
                <button
                  key={item.id}
                  className={effectiveView === item.id ? "active" : ""}
                  onClick={() => openView(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <footer>
              {!tenant.domain && (
                <button onClick={changeInstitution}>
                  <Building2 />
                  Change institution
                </button>
              )}
              <button onClick={() => void logout()}>
                <LogOut />
                Sign out
              </button>
            </footer>
          </aside>
        </>
      )}
      <section className="campus-content">
        {error && (
          <div className="error-box page-error">
            <AlertTriangle size={17} />
            {error}
          </div>
        )}
        {content}
      </section>
    </main>
  );
}
