"use client";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Bell,
  BookOpenCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  GraduationCap,
  IndianRupee,
  Megaphone,
  Paperclip,
  Play,
  RefreshCw,
  ScanFace,
  Send,
  Star,
  Upload,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, nativePlatform } from "@/lib/api-client";

// Local Vite and production Caddy both proxy /api on the page's own origin.
// Keeping this relative is required for host-only secure session cookies.
const API = "";

function localDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type PortalUser = {
  id: number;
  name: string;
  email: string;
  role: "student" | "teacher" | "staff" | "admin";
  institution_id: number;
  institution_name: string;
  platform_admin: boolean;
  designation?: string;
  department_id?: number;
};
type StudentProfile = {
  student_id: number;
  name: string;
  email: string;
  roll_no: string;
  department: string;
  section_id?: number;
  section_name?: string;
  term_id?: number;
  term_name?: string;
  phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  address?: string;
  blood_group?: string;
  date_of_birth?: string;
  profile_photo_url?: string;
  admission_number?: string;
  gender?: string;
  program?: string;
  current_academic_year?: string;
  year_of_study?: string;
  current_semester?: string;
  class_name?: string;
  father_name?: string;
  mother_name?: string;
  admission_status?: string;
  messaging_consent: boolean;
  self_edit_enabled: boolean;
  guardian_biometric_consent: boolean;
  biometric_consent: boolean;
  face_samples: number;
  face_registered: boolean;
};
type PortalData = {
  generated_at: string;
  profile?: StudentProfile;
  fees?: {
    id: number;
    term_label: string;
    description: string;
    total_amount: number;
    paid_amount: number;
    balance: number;
    due_date?: string;
    status: string;
  }[];
  fee_payments?: {
    id: number;
    fee_record_id: number;
    amount: number;
    currency: string;
    payment_method: string;
    status: string;
    offline_reference?: string;
    paid_on?: string;
    receipt_file_name?: string;
    review_reason?: string;
    created_at: string;
    paid_at?: string;
  }[];
  attendance?: {
    id: number;
    class_session_id: number;
    date: string;
    period_number: number;
    course_code: string;
    course_title: string;
    status: string;
    attendance_percent: number;
    decision_source: string;
  }[];
  behaviour_episodes?: {
    id: number;
    course_code?: string;
    course_title?: string;
    behaviour: string;
    started_at: string;
    ended_at: string;
    duration_seconds: number;
    average_confidence: number;
    threshold_seconds: number;
  }[];
  presence_events?: {
    id: number;
    class_session_id?: number;
    event_type: string;
    captured_at: string;
    source: string;
    confidence: number;
  }[];
  timetable?: {
    id: number;
    weekday: number;
    period_number: number;
    start_time: string;
    end_time: string;
    classroom: string;
    course_code: string;
    course_title: string;
    teacher_name: string;
  }[];
  announcements: {
    id: number;
    title: string;
    body: string;
    audience: string;
    section_name?: string;
    created_by: string;
    published_at: string;
    expires_at?: string;
  }[];
  notifications?: {
    id: number;
    channel: string;
    template: string;
    status: string;
    error?: string;
    payload?: { message?: string; deep_link?: string };
    created_at: string;
  }[];
  teacher_metrics?: {
    classes_completed: number;
    classes_total: number;
    start_records: number;
    topics_completed: number;
    topics_total: number;
    aggregate_engagement: Record<string, number>;
    feedback_count: number;
    feedback_average?: number;
    feedback_minimum_met: boolean;
    feedback_dimensions: Record<string, number>;
    notice: string;
  };
  staff_profile?: {
    designation: string;
    employee_no?: string;
    biometric_consent: boolean;
    face_registered: boolean;
    face_samples: number;
  };
  career?: {
    platform_staff_id: string;
    professional_summary?: string;
    verified: boolean;
    services: {
      id: number;
      institution: string;
      designation: string;
      local_employee_id?: string;
      started_on: string;
      ended_on?: string;
      aggregate_feedback?: number;
      verified: boolean;
    }[];
  };
};
type Workspace = {
  summary: {
    assignments: number;
    topics_total: number;
    topics_completed: number;
    coverage_percent: number;
    classes_completed: number;
    classes_scheduled: number;
  };
  assignments: {
    id: number;
    course_id: number;
    course_code: string;
    course_title: string;
    section_id: number;
    section_name: string;
    teacher_name: string;
  }[];
  sessions: {
    id: number;
    date: string;
    period_number: number;
    classroom: string;
    status: string;
    course_code: string;
    course_title: string;
    teacher_name: string;
  }[];
  assessments: {
    id: number;
    title: string;
    instructions?: string;
    mode: "online" | "offline";
    scheduled_at: string;
    available_until?: string;
    duration_minutes: number;
    total_marks: number;
    question_count?: number;
    attempt_status?: string;
    result_score?: number;
    status: string;
    course_code: string;
    section_name: string;
  }[];
  coursework: {
    id: number;
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
    attachments?: {
      id: number;
      file_name: string;
      mime_type: string;
      size_bytes: number;
    }[];
  }[];
};
type StartedTest = {
  attempt_id: number;
  ends_at: string;
  seconds_remaining: number;
  assessment: {
    id: number;
    title: string;
    instructions?: string;
    duration_minutes: number;
    total_marks: number;
  };
  questions: {
    id: number;
    question_text: string;
    question_type: string;
    options?: string[];
    marks: number;
  }[];
  saved_answers?: Record<string, string>;
};
type TestResult = {
  assessment_id?: number;
  title?: string;
  score: number;
  total_marks: number;
  timed_out?: boolean;
  answers: {
    question_id: number;
    question_text: string;
    selected_answer: string;
    correct_answer?: string;
    is_correct: boolean;
    awarded_marks?: number;
    marks: number;
  }[];
};
type StudentAnalytics = {
  overall?: {
    attendance_percent: number;
    average_score: number;
    behaviours: Record<string, number>;
  };
  subjects?: {
    course_code: string;
    course_title: string;
    attendance_percent: number;
    average_score: number;
    behaviours: Record<string, number>;
  }[];
};

function tenantHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Institution-Domain":
      typeof window === "undefined" ? "localhost" : window.location.host,
  };
  const slug =
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem("ours_institution_slug") || "";
  if (slug) headers["X-Institution-Slug"] = slug;
  return headers;
}

function notifySessionExpiry(response: Response) {
  if (response.status === 401 && typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ours:session-expired"));
}

async function request<T>(
  path: string,
  method = "GET",
  body?: object,
): Promise<T> {
  const headers = tenantHeaders();
  if (body) headers["Content-Type"] = "application/json";
  const response = await apiFetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  notifySessionExpiry(response);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { detail?: string }).detail || "Request failed");
  }
  return data as T;
}

function uploadWithProgress(
  path: string,
  form: FormData,
  onProgress: (value: number) => void,
): Promise<{ id: number; status: string; attachment_count: number }> {
  if(nativePlatform()) {
    onProgress(0);
    return apiFetch(`${API}${path}`, {method:"POST",headers:tenantHeaders(),body:form}).then(async response=>{
      const data=await response.json();
      if(!response.ok) throw new Error(data.detail || "Upload failed");
      onProgress(100);
      return data;
    });
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}${path}`);
    xhr.withCredentials = true;
    for (const [key, value] of Object.entries(tenantHeaders()))
      xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) =>
      event.lengthComputable &&
      onProgress(Math.round((100 * event.loaded) / event.total));
    xhr.onerror = () => reject(new Error("Upload connection failed"));
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status === 401)
        window.dispatchEvent(new CustomEvent("ours:session-expired"));
      if (xhr.status < 200 || xhr.status >= 300)
        reject(new Error(data.detail || "Submission failed"));
      else resolve(data);
    };
    xhr.send(form);
  });
}

export async function downloadProtectedAttachment(
  id: number,
  fileName: string,
) {
  const response = await apiFetch(
    `${API}/api/academics/coursework/attachments/${id}`,
    { credentials: "include", headers: tenantHeaders() },
  );
  notifySessionExpiry(response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail || "Download failed");
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const result = await response.json() as { url?: string };
    if (!result.url) throw new Error("Secure download link is unavailable");
    window.location.assign(result.url);
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function usePortal() {
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setPortal(await request<PortalData>("/api/portal"));
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Portal data is unavailable",
      );
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void reload(), 0);
    const timer = window.setInterval(() => void reload(), 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [reload]);
  return { portal, error, reload };
}

function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setWorkspace(await request<Workspace>("/api/academics/workspace"));
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Academic workspace is unavailable",
      );
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void reload(), 0);
    const timer = window.setInterval(() => void reload(), 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [reload]);
  return { workspace, error, reload };
}

function Page({
  eyebrow,
  title,
  note,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="portal-page">
      <header className="portal-page-heading">
        <div>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          {note && <span>{note}</span>}
        </div>
        <i>{icon}</i>
      </header>
      {children}
    </section>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="portal-error">
      <AlertCircle size={18} />
      {children}
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="portal-empty">
      <FileText size={34} />
      <p>{children}</p>
    </div>
  );
}
function Loading() {
  return (
    <div className="portal-loading">
      <RefreshCw className="spin" /> Loading secure campus data…
    </div>
  );
}

export function StudentPortalDashboard({
  user,
  analytics,
  onNavigate,
}: {
  user: PortalUser;
  analytics?: StudentAnalytics;
  onNavigate: (page: string) => void;
}) {
  const { portal, error } = usePortal();
  const { workspace } = useWorkspace();
  if (!portal || !workspace) return <Loading />;
  const pendingAssignments = workspace.coursework.filter(
    (row) => !row.submission_id,
  ).length;
  const pendingTests = workspace.assessments.filter(
    (row) => row.mode === "online" && !row.attempt_status,
  ).length;
  const feeBalance = (portal.fees || []).reduce(
    (total, row) => total + row.balance,
    0,
  );
  const attendance =
    analytics?.overall?.attendance_percent ??
    (portal.attendance?.length
      ? Math.round(
          (100 *
            portal.attendance.filter((row) => row.status === "Present")
              .length) /
            portal.attendance.length,
        )
      : 0);
  return (
    <Page
      eyebrow="Student home"
      title={`Hello, ${user.name.split(" ")[0]}`}
      note={`${portal.profile?.roll_no || "Student"} · ${portal.profile?.section_name || "Class assignment pending"}`}
      icon={<GraduationCap />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="portal-hero-grid">
        <article className="campus-welcome-card">
          <span>Today at a glance</span>
          <strong>{attendance}% attendance</strong>
          <p>
            {pendingAssignments} assignments and {pendingTests} online tests
            need attention.
          </p>
          <button onClick={() => onNavigate("assignments")}>
            Open coursework
          </button>
        </article>
        <article className="profile-mini-card">
          <div>{user.name.slice(0, 1)}</div>
          <strong>{user.name}</strong>
          <span>{portal.profile?.department}</span>
          <small>{portal.profile?.term_name}</small>
        </article>
      </div>
      <div className="service-summary-grid">
        <button onClick={() => onNavigate("assignments")}>
          <FileText />
          <span>Assignments</span>
          <strong>{pendingAssignments}</strong>
          <small>pending</small>
        </button>
        <button onClick={() => onNavigate("exams")}>
          <FileCheck2 />
          <span>Exams</span>
          <strong>{pendingTests}</strong>
          <small>available</small>
        </button>
        <button onClick={() => onNavigate("attendance")}>
          <UserRoundCheck />
          <span>Attendance</span>
          <strong>{attendance}%</strong>
          <small>overall</small>
        </button>
        <button onClick={() => onNavigate("fees")}>
          <IndianRupee />
          <span>Fee balance</span>
          <strong>₹{feeBalance.toLocaleString("en-IN")}</strong>
          <small>outstanding</small>
        </button>
      </div>
      <div className="portal-two-column">
        <section className="portal-card-list">
          <h2>Latest announcements</h2>
          {portal.announcements.slice(0, 4).map((row) => (
            <article key={row.id}>
              <i>
                <Megaphone />
              </i>
              <div>
                <strong>{row.title}</strong>
                <p>{row.body}</p>
                <small>
                  {row.created_by} ·{" "}
                  {new Date(row.published_at).toLocaleDateString()}
                </small>
              </div>
            </article>
          ))}
          {!portal.announcements.length && <Empty>No announcements yet.</Empty>}
        </section>
        <section className="portal-card-list">
          <h2>Upcoming services</h2>
          {workspace.assessments.slice(0, 3).map((row) => (
            <article key={row.id}>
              <i>
                <Clock3 />
              </i>
              <div>
                <strong>{row.title}</strong>
                <p>
                  {row.course_code} · {row.duration_minutes} minutes
                </p>
                <small>{new Date(row.scheduled_at).toLocaleString()}</small>
              </div>
            </article>
          ))}
          {!workspace.assessments.length && <Empty>No scheduled tests.</Empty>}
        </section>
      </div>
      <section className="portal-card-list notification-feed">
        <h2>Recent account notifications</h2>
        {(portal.notifications || []).slice(0, 6).map((row) => (
          <article key={row.id}>
            <i>
              <Bell />
            </i>
            <div>
              <strong>{row.template.replaceAll("_", " ")}</strong>
              <p>{row.payload?.message || "Your campus record was updated."}</p>
              <small>{new Date(row.created_at).toLocaleString()}</small>
            </div>
          </article>
        ))}
        {!portal.notifications?.length && <Empty>No new notifications.</Empty>}
      </section>
    </Page>
  );
}

function StudentAssignments() {
  const { workspace, error, reload } = useWorkspace();
  const [text, setText] = useState<Record<number, string>>({});
  const [files, setFiles] = useState<Record<number, File[]>>({});
  const [uploadConsent, setUploadConsent] = useState<Record<number, boolean>>({});
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [message, setMessage] = useState("");
  async function submit(
    row: NonNullable<typeof workspace>["coursework"][number],
  ) {
    if ((files[row.id] || []).length && !uploadConsent[row.id]) {
      setMessage("Please confirm that you want to upload the selected files for this assignment.");
      return;
    }
    const form = new FormData();
    form.append("answer_text", text[row.id] || "");
    for (const file of files[row.id] || []) form.append("files", file);
    try {
      await uploadWithProgress(
        `/api/student/coursework/${row.id}/submit-files`,
        form,
        (value) => setProgress((current) => ({ ...current, [row.id]: value })),
      );
      setMessage(`${row.title} submitted to ${row.teacher_name}.`);
      setFiles((current) => ({ ...current, [row.id]: [] }));
      setUploadConsent((current) => ({ ...current, [row.id]: false }));
      setText((current) => ({ ...current, [row.id]: "" }));
      await reload();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Submission failed",
      );
    }
  }
  if (!workspace) return <Loading />;
  return (
    <Page
      eyebrow="Coursework"
      title="Assignments"
      note="Upload typed answers, PDFs or clear photos of handwritten work."
      icon={<FileText />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <div className="portal-message">{message}</div>}
      <div className="assignment-grid">
        {workspace.coursework.map((row) => (
          <article className="assignment-card" key={row.id}>
            <header>
              <div>
                <span>{row.course_code}</span>
                <h2>{row.title}</h2>
                <small>
                  {row.section_name} · {row.teacher_name}
                </small>
              </div>
              <b>{row.max_marks} marks</b>
            </header>
            <p>{row.instructions}</p>
            <div className="deadline">
              <Clock3 />
              Due {new Date(row.due_at).toLocaleString()}
            </div>
            {row.submission_id ? (
              <div className="submitted-box">
                <CheckCircle2 />
                <div>
                  <strong>
                    {row.submission_status === "graded"
                      ? `Graded: ${row.marks}/${row.max_marks}`
                      : "Final submission received"}
                  </strong>
                  <span>
                    {row.feedback || "The teacher will publish feedback here."}
                  </span>
                  {row.attachments?.map((attachment) => (
                    <button
                      key={attachment.id}
                      onClick={() =>
                        void downloadProtectedAttachment(
                          attachment.id,
                          attachment.file_name,
                        )
                      }
                    >
                      <Download />
                      {attachment.file_name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="assignment-submit">
                <textarea
                  value={text[row.id] || ""}
                  onChange={(event) =>
                    setText({ ...text, [row.id]: event.target.value })
                  }
                  placeholder="Optional typed answer or note to your teacher"
                />
                <label className="file-picker">
                  <Upload />
                  <span>Select PDF, JPG or PNG (maximum 5 files)</span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    multiple
                    onChange={(event) => {
                      setFiles({ ...files, [row.id]: Array.from(event.target.files || []) });
                      setUploadConsent((current) => ({ ...current, [row.id]: false }));
                    }}
                  />
                </label>
                {(files[row.id] || []).map((file) => (
                  <small key={`${file.name}-${file.size}`}>
                    <Paperclip /> {file.name} · {Math.ceil(file.size / 1024)} KB
                  </small>
                ))}
                {!!files[row.id]?.length && <label className="upload-consent"><input type="checkbox" checked={!!uploadConsent[row.id]} onChange={(event) => setUploadConsent((current) => ({ ...current, [row.id]: event.target.checked }))} /> I authorize OUR’S to upload and scan only the selected file(s), store them securely, and make them available to authorized staff for this assignment.</label>}
                {progress[row.id] > 0 && progress[row.id] < 100 && (
                  <div className="upload-progress">
                    <i style={{ width: `${progress[row.id]}%` }} />{" "}
                    <span>{progress[row.id]}%</span>
                  </div>
                )}
                <Button
                  onClick={() => void submit(row)}
                  disabled={(!text[row.id]?.trim() && !files[row.id]?.length) || (!!files[row.id]?.length && !uploadConsent[row.id])}
                >
                  Final submit
                </Button>
              </div>
            )}
          </article>
        ))}
        {!workspace.coursework.length && (
          <Empty>
            No published assignments for your active class and term.
          </Empty>
        )}
      </div>
    </Page>
  );
}

function StudentExams({ resultsOnly = false }: { resultsOnly?: boolean }) {
  const { workspace, error, reload } = useWorkspace();
  const [started, setStarted] = useState<StartedTest | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function start(id: number) {
    try {
      const data = await request<StartedTest>(
        `/api/student/assessments/${id}/start`,
        "POST",
      );
      setStarted(data);
      setRemaining(data.seconds_remaining);
      setAnswers(
        Object.fromEntries(
          Object.entries(data.saved_answers || {}).map(([key, value]) => [
            Number(key),
            value,
          ]),
        ),
      );
      setResult(null);
      setMessage("");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Test could not start",
      );
    }
  }
  const submit = useCallback(
    async (automatic = false) => {
      if (!started || submitting) return;
      setSubmitting(true);
      try {
        const data = await request<TestResult>(
          `/api/student/attempts/${started.attempt_id}/submit`,
          "POST",
          {
            answers: started.questions.map((question) => ({
              question_id: question.id,
              answer: answers[question.id] || "",
            })),
          },
        );
        setResult(data);
        setStarted(null);
        setMessage(
          automatic
            ? "Time ended. Your answers were submitted automatically."
            : "Your test was submitted and marked.",
        );
        await reload();
      } catch (caught) {
        setMessage(
          caught instanceof Error ? caught.message : "Test submission failed",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [answers, reload, started, submitting],
  );
  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [started]);
  useEffect(() => {
    if (!started || remaining !== 0 || submitting) return;
    const timer = window.setTimeout(() => void submit(true), 0);
    return () => window.clearTimeout(timer);
  }, [remaining, started, submit, submitting]);
  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(
      () =>
        void request(
          `/api/student/attempts/${started.attempt_id}/autosave`,
          "PATCH",
          {
            answers: started.questions.map((question) => ({
              question_id: question.id,
              answer: answers[question.id] || "",
            })),
          },
        ).catch(() => undefined),
      8000,
    );
    return () => window.clearInterval(timer);
  }, [answers, started]);
  async function viewResult(id: number) {
    try {
      setResult(
        await request<TestResult>(`/api/student/assessments/${id}/result`),
      );
      setMessage("");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Result is unavailable",
      );
    }
  }
  if (!workspace) return <Loading />;
  if (started && !resultsOnly)
    return (
      <Page
        eyebrow="Online examination"
        title={started.assessment.title}
        note="Answers are saved automatically. Final submission is permanent."
        icon={<Clock3 />}
      >
        <div className="exam-toolbar">
          <span>
            {started.questions.length} questions ·{" "}
            {started.assessment.total_marks} marks
          </span>
          <time className={remaining < 60 ? "urgent" : ""}>
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </time>
        </div>
        {started.assessment.instructions && (
          <section className="exam-instructions">
            <strong>Instructions</strong>
            <p>{started.assessment.instructions}</p>
          </section>
        )}
        <div className="question-stack">
          {started.questions.map((question, index) => (
            <article key={question.id}>
              <header>
                <strong>
                  {index + 1}. {question.question_text}
                </strong>
                <span>{question.marks} mark(s)</span>
              </header>
              {question.options ? (
                question.options.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={answers[question.id] === option}
                      onChange={() =>
                        setAnswers({ ...answers, [question.id]: option })
                      }
                    />
                    {option}
                  </label>
                ))
              ) : (
                <Input
                  value={answers[question.id] || ""}
                  onChange={(event) =>
                    setAnswers({
                      ...answers,
                      [question.id]: event.target.value,
                    })
                  }
                  placeholder="Enter your answer"
                />
              )}
            </article>
          ))}
        </div>
        <Button onClick={() => void submit(false)} disabled={submitting}>
          {submitting ? "Submitting…" : "Final submission"}
        </Button>
      </Page>
    );
  const rows = workspace.assessments.filter(
    (row) =>
      !resultsOnly ||
      (row.attempt_status && row.attempt_status !== "in_progress") ||
      row.result_score !== undefined,
  );
  return (
    <Page
      eyebrow={resultsOnly ? "Academic record" : "Examinations"}
      title={resultsOnly ? "Results" : "My tests"}
      note={
        resultsOnly
          ? "Published test and assignment marks."
          : "Only tests for your current class and term are shown."
      }
      icon={resultsOnly ? <FileCheck2 /> : <BookOpenCheck />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <div className="portal-message">{message}</div>}
      {result && (
        <section className="result-sheet">
          <header>
            <CheckCircle2 />
            <div>
              <span>Result</span>
              <strong>
                {result.score} / {result.total_marks}
              </strong>
            </div>
          </header>
          {result.answers.map((answer, index) => (
            <article
              className={answer.is_correct ? "correct" : "wrong"}
              key={answer.question_id}
            >
              <strong>
                {index + 1}. {answer.question_text}
              </strong>
              <p>Your answer: {answer.selected_answer || "Not answered"}</p>
              {!answer.is_correct && answer.correct_answer && (
                <p>
                  Correct answer: <b>{answer.correct_answer}</b>
                </p>
              )}
              <small>
                {answer.awarded_marks || 0}/{answer.marks} marks
              </small>
            </article>
          ))}
        </section>
      )}
      <div className="exam-list">
        {rows.map((row) => (
          <article key={row.id}>
            <div className="exam-date">
              <b>{new Date(row.scheduled_at).getDate()}</b>
              <span>
                {new Date(row.scheduled_at).toLocaleString("en", {
                  month: "short",
                })}
              </span>
            </div>
            <div>
              <span>
                {row.course_code} · {row.mode}
              </span>
              <h2>{row.title}</h2>
              {row.instructions && <p>{row.instructions}</p>}
              <p>
                {new Date(row.scheduled_at).toLocaleString()} ·{" "}
                {row.duration_minutes} minutes · {row.total_marks} marks
              </p>
              {row.available_until && (
                <small>
                  Closes {new Date(row.available_until).toLocaleString()}
                </small>
              )}
            </div>
            <div className="exam-actions">
              {row.result_score !== undefined && row.result_score !== null && (
                <strong>
                  {row.result_score}/{row.total_marks}
                </strong>
              )}
              {row.mode === "online" &&
                (!row.attempt_status || row.attempt_status === "in_progress") &&
                !resultsOnly && (
                  <Button size="sm" onClick={() => void start(row.id)}>
                    <Play />
                    {row.attempt_status ? "Continue" : "Start"}
                  </Button>
                )}
              {row.mode === "online" &&
                row.attempt_status &&
                row.attempt_status !== "in_progress" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void viewResult(row.id)}
                  >
                    View answers
                  </Button>
                )}
            </div>
          </article>
        ))}
        {!rows.length && (
          <Empty>
            {resultsOnly
              ? "No published results yet."
              : "No published tests for your class."}
          </Empty>
        )}
      </div>
      {resultsOnly && (
        <section className="assignment-results">
          <h2>Assignment results</h2>
          {workspace.coursework
            .filter((row) => row.submission_id)
            .map((row) => (
              <article key={row.id}>
                <div>
                  <strong>{row.title}</strong>
                  <span>
                    {row.course_code} · {row.submission_status}
                  </span>
                </div>
                <b>
                  {row.marks !== undefined && row.marks !== null
                    ? `${row.marks}/${row.max_marks}`
                    : "Awaiting marks"}
                </b>
              </article>
            ))}
        </section>
      )}
    </Page>
  );
}

function AttendancePage({ analytics }: { analytics?: StudentAnalytics }) {
  const { portal, error } = usePortal();
  if (!portal) return <Loading />;
  const rows = portal.attendance || [];
  const percent =
    analytics?.overall?.attendance_percent ??
    (rows.length
      ? Math.round(
          (100 * rows.filter((row) => row.status === "Present").length) /
            rows.length,
        )
      : 0);
  return (
    <Page
      eyebrow="Verified attendance"
      title="Attendance"
      note="General, subject-wise and classroom entry/exit records are kept separately."
      icon={<UserRoundCheck />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="attendance-overview">
        <div
          className="portal-donut"
          style={{
            background: `conic-gradient(#00a9b5 ${percent}%, #e4eef0 0)`,
          }}
        >
          <div>
            <strong>{percent}%</strong>
            <span>overall</span>
          </div>
        </div>
        <div>
          <h2>
            {rows.filter((row) => row.status === "Present").length} present
          </h2>
          <p>
            {rows.filter((row) => row.status === "Absent").length} absent ·{" "}
            {rows.length} finalised periods
          </p>
          <small>
            Camera presence must reach the institution threshold unless the
            teacher approves a documented exception.
          </small>
        </div>
      </div>
      <section className="subject-attendance">
        <h2>Subject attendance and academics</h2>
        {analytics?.subjects?.map((subject) => (
          <article key={subject.course_code}>
            <div>
              <strong>{subject.course_code}</strong>
              <span>{subject.course_title}</span>
            </div>
            <b>{subject.attendance_percent}% attendance</b>
            <small>{subject.average_score}% academic average</small>
          </article>
        )) || <Empty>No subject attendance yet.</Empty>}
      </section>
      <div className="portal-two-column">
        <section className="portal-table-card">
          <h2>Period attendance</h2>
          <div className="portal-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Presence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {new Date(`${row.date}T00:00:00`).toLocaleDateString()}
                    </td>
                    <td>{row.course_code}</td>
                    <td>{row.period_number}</td>
                    <td>
                      <span
                        className={`status-pill ${row.status.toLowerCase()}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{Math.round(row.attendance_percent)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="presence-timeline">
          <h2>Classroom entry & exit</h2>
          {(portal.presence_events || []).map((row) => (
            <article key={row.id}>
              <i className={row.event_type} />
              <div>
                <strong>
                  {row.event_type === "entry"
                    ? "Entered classroom"
                    : "Exit recorded"}
                </strong>
                <span>{new Date(row.captured_at).toLocaleString()}</span>
                <small>{row.source.replaceAll("_", " ")}</small>
              </div>
            </article>
          ))}
          {!portal.presence_events?.length && (
            <Empty>No entry/exit events recorded.</Empty>
          )}
        </section>
      </div>
    </Page>
  );
}

function BehaviourPage({ analytics }: { analytics?: StudentAnalytics }) {
  const { portal, error } = usePortal();
  if (!portal) return <Loading />;
  return (
    <Page
      eyebrow="Learning engagement"
      title="Behaviour observations"
      note="An episode appears only after the same behaviour continues for at least 60 seconds during a scheduled class."
      icon={<Bell />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="behaviour-summary">
        {Object.entries(analytics?.overall?.behaviours || {}).map(
          ([name, value]) => (
            <article key={name}>
              <span>{name}</span>
              <strong>{value}%</strong>
              <i>
                <b style={{ width: `${value}%` }} />
              </i>
            </article>
          ),
        )}
        {!Object.keys(analytics?.overall?.behaviours || {}).length && (
          <Empty>No verified classroom behaviour episodes yet.</Empty>
        )}
      </div>
      <section className="portal-table-card">
        <h2>Episode history</h2>
        <div className="portal-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Behaviour</th>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {(portal.behaviour_episodes || []).map((row) => (
                <tr key={row.id}>
                  <td>{row.course_code || "Safety"}</td>
                  <td>{row.behaviour}</td>
                  <td>{new Date(row.started_at).toLocaleTimeString()}</td>
                  <td>{new Date(row.ended_at).toLocaleTimeString()}</td>
                  <td>
                    {Math.floor(row.duration_seconds / 60)}m{" "}
                    {Math.round(row.duration_seconds % 60)}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!portal.behaviour_episodes?.length && (
          <Empty>
            No episode has crossed the one-minute verification threshold.
          </Empty>
        )}
      </section>
    </Page>
  );
}

function TimetablePage() {
  const { portal } = usePortal();
  if (!portal) return <Loading />;
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return (
    <Page
      eyebrow="Academic schedule"
      title="Timetable"
      note="Published periods drive automatic camera attendance."
      icon={<CalendarDays />}
    >
      <div className="timetable-grid">
        {days.map((day, index) => (
          <section key={day}>
            <h2>{day}</h2>
            {(portal.timetable || [])
              .filter((row) => row.weekday === index)
              .map((row) => (
                <article key={row.id}>
                  <b>{row.period_number}</b>
                  <div>
                    <strong>
                      {row.course_code} · {row.course_title}
                    </strong>
                    <span>
                      {row.start_time}–{row.end_time} · {row.classroom}
                    </span>
                    <small>{row.teacher_name}</small>
                  </div>
                </article>
              ))}
            {!(portal.timetable || []).some((row) => row.weekday === index) && (
              <p>No class</p>
            )}
          </section>
        ))}
      </div>
    </Page>
  );
}

function FeesPage() {
  const { portal, reload } = usePortal();
  const [offline, setOffline] = useState({
    fee_record_id: "",
    amount: "",
    reference: "",
    paid_on: localDateKey(),
    receipt: null as File | null,
  });
  const [message, setMessage] = useState("");
  const [receiptConsent, setReceiptConsent] = useState(false);
  if (!portal) return <Loading />;
  const balance = (portal.fees || []).reduce(
    (total, row) => total + row.balance,
    0,
  );
  const selectedFee =
    portal.fees?.find((row) => row.id === Number(offline.fee_record_id)) ||
    portal.fees?.find((row) => row.balance > 0);
  async function payOnline(feeId: number, amount: number) {
    try {
      if (typeof crypto.randomUUID !== "function")
        throw new Error(
          "This browser cannot create a secure payment request. Update the browser and try again.",
        );
      const key = crypto.randomUUID();
      const order = await request<{
        provider: string;
        order_id: string;
        public_key: string;
        amount_minor: number;
        currency: string;
      }>(`/api/student/fees/${feeId}/payments/online`, "POST", {
        amount,
        idempotency_key: key,
      });
      if (order.provider !== "razorpay") {
        setMessage(
          "Payment order created. The configured test provider will confirm it through its signed webhook.",
        );
        return;
      }
      if (!document.querySelector("script[data-ours-razorpay]")) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.dataset.oursRazorpay = "true";
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Secure payment window could not load"));
          document.head.appendChild(script);
        });
      }
      const Gateway = (
        window as typeof window & {
          Razorpay?: new (options: Record<string, unknown>) => {
            open: () => void;
          };
        }
      ).Razorpay;
      if (!Gateway) throw new Error("Secure payment window is unavailable");
      new Gateway({
        key: order.public_key,
        order_id: order.order_id,
        amount: order.amount_minor,
        currency: order.currency,
        name: "OUR'S",
        description: "Institution fee payment",
        handler: () => {
          setMessage(
            "Payment received by the gateway. The balance updates only after signed server verification.",
          );
          window.setTimeout(() => void reload(), 2500);
        },
        modal: {
          ondismiss: () =>
            setMessage(
              "Payment window closed. No fee is marked paid unless the gateway confirms it.",
            ),
        },
      }).open();
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Online payment could not start",
      );
    }
  }
  async function submitOffline(event: FormEvent) {
    event.preventDefault();
    if (!selectedFee || !offline.receipt) {
      setMessage("Select a fee and receipt file.");
      return;
    }
    if (!receiptConsent) {
      setMessage("Please confirm that you want to upload the selected receipt for fee verification.");
      return;
    }
    const data = new FormData();
    data.append("amount", offline.amount || String(selectedFee.balance));
    data.append("reference", offline.reference);
    data.append("paid_on", offline.paid_on);
    data.append("receipt", offline.receipt);
    try {
      const response = await apiFetch(
        `${API}/api/student/fees/${selectedFee.id}/payments/offline`,
        {
          method: "POST",
          credentials: "include",
          headers: tenantHeaders(),
          body: data,
        },
      );
      notifySessionExpiry(response);
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail || "Receipt submission failed");
      setMessage(result.message);
      setOffline({
        fee_record_id: "",
        amount: "",
        reference: "",
        paid_on: localDateKey(),
        receipt: null,
      });
      setReceiptConsent(false);
      await reload();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Receipt submission failed",
      );
    }
  }
  return (
    <Page
      eyebrow="Student finance"
      title="Fees & billing"
      note="Online balances change only after a signed gateway webhook; uploaded receipts require accounts approval."
      icon={<IndianRupee />}
    >
      <article className="fee-total">
        <span>Outstanding balance</span>
        <strong>₹{balance.toLocaleString("en-IN")}</strong>
        <small>
          Never enter a card PIN, CVV or banking password inside OUR&apos;S.
        </small>
      </article>
      <div className="fee-list">
        {(portal.fees || []).map((row) => (
          <article key={row.id}>
            <div>
              <span>{row.term_label}</span>
              <strong>{row.description}</strong>
              <small>
                {row.due_date
                  ? `Due ${new Date(`${row.due_date}T00:00:00`).toLocaleDateString()}`
                  : "No due date"}
              </small>
            </div>
            <div>
              <b>₹{row.balance.toLocaleString("en-IN")}</b>
              <span className={`status-pill ${row.status}`}>{row.status}</span>
              {row.balance > 0 && (
                <Button
                  size="sm"
                  onClick={() => void payOnline(row.id, row.balance)}
                >
                  Pay securely
                </Button>
              )}
            </div>
          </article>
        ))}
        {!portal.fees?.length && <Empty>No fee records published.</Empty>}
      </div>
      <form className="fee-admin-form" onSubmit={submitOffline}>
        <h2>Submit an offline payment receipt</h2>
        <label>
          Fee
          <select
            value={offline.fee_record_id || String(selectedFee?.id || "")}
            onChange={(event) => {
              const row = portal.fees?.find(
                (fee) => fee.id === Number(event.target.value),
              );
              setOffline({
                ...offline,
                fee_record_id: event.target.value,
                amount: row ? String(row.balance) : "",
              });
            }}
          >
            {portal.fees
              ?.filter((row) => row.balance > 0)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.term_label} · {row.description}
                </option>
              ))}
          </select>
        </label>
        <div>
          <Input
            type="number"
            min="1"
            step="0.01"
            placeholder="Amount"
            value={offline.amount || String(selectedFee?.balance || "")}
            onChange={(event) =>
              setOffline({ ...offline, amount: event.target.value })
            }
            required
          />
          <Input
            type="date"
            value={offline.paid_on}
            onChange={(event) =>
              setOffline({ ...offline, paid_on: event.target.value })
            }
            required
          />
        </div>
        <Input
          placeholder="Bank/receipt reference"
          value={offline.reference}
          onChange={(event) =>
            setOffline({ ...offline, reference: event.target.value })
          }
          required
        />
        <Input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(event) => {
            setOffline({ ...offline, receipt: event.target.files?.[0] || null });
            setReceiptConsent(false);
          }}
          required
        />
        <label className="upload-consent"><input type="checkbox" checked={receiptConsent} onChange={(event) => setReceiptConsent(event.target.checked)} /> I authorize OUR’S to upload and scan only this selected receipt and share it with authorized accounts staff to verify this payment.</label>
        <Button type="submit" disabled={!selectedFee || !offline.receipt || !receiptConsent}>
          Send for verification
        </Button>
      </form>
      <section className="portal-table-card">
        <h2>Payment history</h2>
        <div className="portal-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {(portal.fee_payments || []).map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleDateString()}</td>
                  <td>{row.payment_method}</td>
                  <td>₹{row.amount.toLocaleString("en-IN")}</td>
                  <td>
                    <span className={`status-pill ${row.status}`}>
                      {row.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>{row.offline_reference || "Gateway"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {message && <div className="portal-message">{message}</div>}
    </Page>
  );
}

function AnnouncementsPage() {
  const { portal } = usePortal();
  if (!portal) return <Loading />;
  return (
    <Page
      eyebrow="Campus communication"
      title="Announcements"
      note="Messages published for your institution and active class."
      icon={<Megaphone />}
    >
      <div className="announcement-feed">
        {portal.announcements.map((row) => (
          <article key={row.id}>
            <header>
              <Megaphone />
              <div>
                <strong>{row.title}</strong>
                <span>
                  {row.created_by} ·{" "}
                  {new Date(row.published_at).toLocaleString()}
                </span>
              </div>
            </header>
            <p>{row.body}</p>
            {row.section_name && <small>{row.section_name}</small>}
          </article>
        ))}
        {!portal.announcements.length && <Empty>No announcements yet.</Empty>}
      </div>
    </Page>
  );
}

function ProfilePage() {
  const { portal, reload } = usePortal();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [form, setForm] = useState({
    phone: "",
    guardian_name: "",
    guardian_phone: "",
    address: "",
    blood_group: "",
    date_of_birth: "",
    messaging_consent: false,
  });
  const [message, setMessage] = useState("");
  const [samples, setSamples] = useState<number | null>(null);
  useEffect(() => {
    if (!portal?.profile) return;
    const profile = portal.profile;
    const timer = window.setTimeout(
      () =>
        setForm({
          phone: profile.phone || "",
          guardian_name: profile.guardian_name || "",
          guardian_phone: profile.guardian_phone || "",
          address: profile.address || "",
          blood_group: profile.blood_group || "",
          date_of_birth: profile.date_of_birth || "",
          messaging_consent: profile.messaging_consent,
        }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [portal?.profile]);
  useEffect(
    () => () => streamRef.current?.getTracks().forEach((track) => track.stop()),
    [],
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await request("/api/me/profile", "PATCH", {
        ...form,
        date_of_birth: form.date_of_birth || null,
      });
      setMessage("Profile updated.");
      await reload();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Profile update failed",
      );
    }
  }
  async function consent() {
    try {
      await request("/api/me/biometric-consent", "PATCH", { granted: true });
      setMessage("Biometric consent recorded. You can now capture your face.");
      await reload();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Consent update failed",
      );
    }
  }
  async function startCamera() {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = streamRef.current;
    } catch {
      setMessage("Camera permission was not granted.");
    }
  }
  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setMessage("Start the camera and keep one clear face in view.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;
    const data = new FormData();
    data.append("image", blob, "face.jpg");
    try {
      const response = await apiFetch(`${API}/api/me/face`, {
        method: "POST",
        credentials: "include",
        headers: tenantHeaders(),
        body: data,
      });
      notifySessionExpiry(response);
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Face capture failed");
      setSamples(result.samples);
      setMessage(
        result.message ||
          (result.ready
            ? "Face registration complete: 3/3 unique samples saved."
            : "Face sample saved."),
      );
      await reload();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Face capture failed",
      );
    }
  }
  if (!portal?.profile) return <Loading />;
  const profile = portal.profile;
  return (
    <Page
      eyebrow="My account"
      title="Profile"
      note="Review your academic identity and communication consent."
      icon={<UserRoundCheck />}
    >
      <div className="profile-layout">
        <aside className="profile-card">
          {profile.profile_photo_url ? <img className="student-profile-photo" src={`${API}${profile.profile_photo_url}`} alt={`${profile.name} profile`} /> : <div>{profile.name.slice(0, 1)}</div>}
          <h2>{profile.name}</h2>
          <span>{profile.roll_no}</span>
          <p>
            {profile.department} · {profile.section_name || "Class pending"}
          </p>
          <small>{profile.email}</small>
          <div className="profile-facts">
            {([["Admission No.", profile.admission_number], ["Gender", profile.gender], ["Programme", profile.program], ["Admission Year", profile.admission_year], ["Admission Batch", profile.admission_batch], ["Academic Year", profile.current_academic_year], ["Year of Study", profile.year_of_study], ["Semester", profile.current_semester || profile.term_name], ["Class", profile.class_name], ["Father", profile.father_name], ["Mother", profile.mother_name], ["Admission Status", profile.admission_status]] as const).filter(([, value]) => value).map(([label, value]) => <p key={label}><strong>{label}</strong><span>{value}</span></p>)}
          </div>
        </aside>
        <form className="profile-form" onSubmit={save}>
          <h2>Personal details</h2>
          <p className="form-help">
            {profile.self_edit_enabled
              ? "Your administrator has enabled phone, address and notification-consent updates. Academic identity details remain protected."
              : "Personal details are read-only. Ask your college administrator to correct or enable permitted fields."}
          </p>
          <div className="form-grid">
            <label>
              Phone
              <Input
                value={form.phone}
                disabled={!profile.self_edit_enabled}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </label>
            <label>
              Date of birth
              <Input
                type="date"
                value={form.date_of_birth}
                onChange={(event) =>
                  setForm({ ...form, date_of_birth: event.target.value })
                }
                required
                disabled
              />
            </label>
            <label>
              Guardian name
              <Input
                value={form.guardian_name}
                disabled
                onChange={(event) =>
                  setForm({ ...form, guardian_name: event.target.value })
                }
              />
            </label>
            <label>
              Guardian phone
              <Input
                value={form.guardian_phone}
                disabled
                onChange={(event) =>
                  setForm({ ...form, guardian_phone: event.target.value })
                }
              />
            </label>
            <label>
              Blood group
              <Input
                value={form.blood_group}
                disabled
                onChange={(event) =>
                  setForm({ ...form, blood_group: event.target.value })
                }
              />
            </label>
            <label className="wide">
              Address
              <textarea
                value={form.address}
                disabled={!profile.self_edit_enabled}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
              />
            </label>
          </div>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={form.messaging_consent}
              disabled={!profile.self_edit_enabled}
              onChange={(event) =>
                setForm({ ...form, messaging_consent: event.target.checked })
              }
            />
            I consent to attendance notifications at my/guardian phone number.
          </label>
          <Button type="submit" disabled={!profile.self_edit_enabled}>Save permitted details</Button>
        </form>
      </div>
      <section className="face-self-card">
        <div>
          <h2>Register your unique face</h2>
          <p>
            Capture three samples from slightly different angles. A face already
            linked to any student or staff account in this institution is
            rejected.
          </p>
          <span className={profile.face_registered ? "ready" : "pending"}>
            {profile.face_registered
              ? "Face registration complete: 3/3 unique samples saved."
              : `${samples ?? profile.face_samples}/3 valid samples saved`}
          </span>
          {!profile.guardian_biometric_consent && (
            <small>
              Students under 18 need verified guardian consent from the college
              administrator.
            </small>
          )}
        </div>
        {!profile.biometric_consent ? (
          <Button onClick={() => void consent()}>Record my consent</Button>
        ) : (
          <div className="self-camera">
            <video ref={videoRef} autoPlay muted playsInline />
            <div>
              <Button variant="outline" onClick={() => void startCamera()}>
                <Camera />
                Start camera
              </Button>
              <Button onClick={() => void capture()}>
                <ScanFace />
                Capture sample
              </Button>
            </div>
          </div>
        )}
      </section>
      {message && <div className="portal-message">{message}</div>}
    </Page>
  );
}

function FeedbackPage() {
  const { workspace } = useWorkspace();
  const [assignmentId, setAssignmentId] = useState("");
  const [ratings, setRatings] = useState({
    clarity: 5,
    pace: 5,
    interaction: 5,
    doubt_resolution: 5,
    helpfulness: 5,
  });
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const weekStart = useMemo(() => {
    const value = new Date();
    const day = value.getDay();
    value.setDate(value.getDate() - ((day + 6) % 7));
    return localDateKey(value);
  }, []);
  const selectedAssignmentId =
    assignmentId || String(workspace?.assignments[0]?.id || "");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await request("/api/student/teacher-feedback", "POST", {
        assignment_id: Number(selectedAssignmentId),
        week_start: weekStart,
        ...ratings,
        comment: comment || null,
      });
      setMessage("Your anonymous weekly feedback was submitted.");
      setComment("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Feedback failed");
    }
  }
  if (!workspace) return <Loading />;
  return (
    <Page
      eyebrow="Weekly voice"
      title="Teacher feedback"
      note="Individual feedback is protected. Teachers see aggregates only after enough responses."
      icon={<Star />}
    >
      <form className="feedback-form" onSubmit={submit}>
        <label>
          Subject teacher
          <select
            value={selectedAssignmentId}
            onChange={(event) => setAssignmentId(event.target.value)}
          >
            {workspace.assignments.map((row) => (
              <option key={row.id} value={row.id}>
                {row.course_code} · {row.teacher_name}
              </option>
            ))}
          </select>
        </label>
        {Object.entries(ratings).map(([field, value]) => (
          <label className="rating-row" key={field}>
            <span>{field.replaceAll("_", " ")}</span>
            <input
              type="range"
              min="1"
              max="5"
              value={value}
              onChange={(event) =>
                setRatings({ ...ratings, [field]: Number(event.target.value) })
              }
            />
            <b>{value}/5</b>
          </label>
        ))}
        <label>
          Optional constructive comment
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={!selectedAssignmentId}>
          Submit weekly feedback
        </Button>
        {message && <div className="portal-message">{message}</div>}
      </form>
    </Page>
  );
}

type OnDutyRow = { id:number; student_name:string; roll_no:string; from_date:string; to_date:string; periods:number[]; reason:string; status:string; current_stage:string; attachment_name?:string; reviews:{stage:string;decision:string;reason?:string}[] };
export function OnDutyPage({ role }: { role: PortalUser["role"] }) {
  const [rows,setRows]=useState<OnDutyRow[]>([]); const [message,setMessage]=useState("");
  const [form,setForm]=useState({from_date:"",to_date:"",periods:"",reason:""}); const [letter,setLetter]=useState<File>(); const [letterConsent,setLetterConsent]=useState(false);
  const load=useCallback(async()=>setRows(await request<OnDutyRow[]>("/api/on-duty")),[]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load().catch(e=>setMessage(e.message)),0);return()=>window.clearTimeout(timer);},[load]);
  async function submit(event:FormEvent){event.preventDefault();if(!letter)return setMessage("Upload the signed supporting letter.");if(!letterConsent)return setMessage("Please confirm that you want to upload the selected supporting letter.");const body=new FormData();Object.entries(form).forEach(([key,value])=>body.append(key,value));body.append("letter",letter);try{const response=await apiFetch(`${API}/api/on-duty`,{method:"POST",credentials:"include",headers:tenantHeaders(),body});const result=await response.json();if(!response.ok)throw new Error(result.detail||"Submission failed");setMessage("On-duty request submitted to the class mentor.");setForm({from_date:"",to_date:"",periods:"",reason:""});setLetter(undefined);setLetterConsent(false);await load();}catch(e){setMessage(e instanceof Error?e.message:"Submission failed");}}
  async function review(id:number,decision:"approved"|"rejected"){const reason=decision==="rejected"?window.prompt("Reason for rejection")?.trim():undefined;if(decision==="rejected"&&!reason)return;try{await request(`/api/on-duty/${id}/review`,"PATCH",{decision,reason});setMessage(`Request ${decision}.`);await load();}catch(e){setMessage(e instanceof Error?e.message:"Review failed");}}
  return <Page eyebrow="Attendance service" title="On-duty requests" note="Supporting letters follow mentor, HOD and dean approval. Approved periods retain the original attendance audit." icon={<FileCheck2 />}>
    {role==="student"&&<form className="feedback-form" onSubmit={submit}><div className="form-row"><label>From<Input type="date" required value={form.from_date} onChange={e=>setForm({...form,from_date:e.target.value})}/></label><label>To<Input type="date" required value={form.to_date} onChange={e=>setForm({...form,to_date:e.target.value})}/></label></div><label>Periods (comma separated)<Input required placeholder="1,2,3" value={form.periods} onChange={e=>setForm({...form,periods:e.target.value})}/></label><label>Reason<textarea required value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label><label>Signed letter (PDF/JPG/PNG)<Input type="file" accept=".pdf,.jpg,.jpeg,.png" required onChange={e=>{setLetter(e.target.files?.[0]);setLetterConsent(false);}}/></label><label className="upload-consent"><input type="checkbox" checked={letterConsent} onChange={e=>setLetterConsent(e.target.checked)}/> I authorize OUR’S to upload and scan only this selected letter and share it with the authorized reviewers of my on-duty request.</label><Button type="submit" disabled={!letter || !letterConsent}>Submit on-duty request</Button></form>}
    <section className="service-records">{rows.map(row=><article key={row.id}><div><strong>{row.roll_no} · {row.student_name}</strong><p>{row.from_date} to {row.to_date} · periods {row.periods.join(", ")}</p><p>{row.reason}</p><small>Status: {row.status} · stage: {row.current_stage}</small></div><a href={`/api/on-duty/${row.id}/letter`}>View letter</a>{role!=="student"&&row.status==="pending"&&<div><Button onClick={()=>void review(row.id,"approved")}>Approve current stage</Button><Button variant="outline" onClick={()=>void review(row.id,"rejected")}>Reject</Button></div>}</article>)}</section>{!rows.length&&<p>No on-duty requests.</p>}{message&&<div className="portal-message">{message}</div>}
  </Page>;
}

export function StudentServicePage({
  view,
  analytics,
}: {
  view: string;
  analytics?: StudentAnalytics;
}) {
  if (view === "assignments") return <StudentAssignments />;
  if (view === "exams") return <StudentExams />;
  if (view === "results") return <StudentExams resultsOnly />;
  if (view === "attendance") return <AttendancePage analytics={analytics} />;
  if (view === "behaviour") return <BehaviourPage analytics={analytics} />;
  if (view === "timetable") return <TimetablePage />;
  if (view === "fees") return <FeesPage />;
  if (view === "announcements") return <AnnouncementsPage />;
  if (view === "feedback") return <FeedbackPage />;
  if (view === "on_duty") return <OnDutyPage role="student" />;
  if (view === "documents") return <StudentDocumentsPage />;
  if (view === "profile") return <ProfilePage />;
  return null;
}

type StudentDocumentRow = { id:number; category:string; title:string; file_name:string; mime_type:string; size_bytes:number; scan_status:string; created_at:string };
function StudentDocumentsPage() {
  const { portal } = usePortal();
  const [rows,setRows]=useState<StudentDocumentRow[]>([]);
  const [title,setTitle]=useState(""); const [category,setCategory]=useState("certificate"); const [file,setFile]=useState<File>(); const [fileConsent,setFileConsent]=useState(false); const [message,setMessage]=useState("");
  const studentId=portal?.profile?.student_id;
  const load=useCallback(async()=>{if(studentId)setRows(await request<StudentDocumentRow[]>(`/api/students/${studentId}/documents`));},[studentId]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load().catch(e=>setMessage(e.message)),0);return()=>window.clearTimeout(timer);},[load]);
  async function submit(event:FormEvent){event.preventDefault();if(!studentId||!file)return;if(!fileConsent){setMessage("Please confirm that you want to upload the selected document.");return;}const body=new FormData();body.append("title",title);body.append("category",category);body.append("file",file);try{const response=await apiFetch(`${API}/api/students/${studentId}/documents`,{method:"POST",credentials:"include",headers:tenantHeaders(),body});const result=await response.json();if(!response.ok)throw new Error(result.detail||"Upload failed");setTitle("");setFile(undefined);setFileConsent(false);setMessage("Document scanned and stored securely.");await load();}catch(e){setMessage(e instanceof Error?e.message:"Upload failed");}}
  async function download(id:number){try{const response=await apiFetch(`${API}/api/student-documents/${id}/download`,{credentials:"include",headers:tenantHeaders()});if(!response.ok){const result=await response.json();throw new Error(result.detail||"Download failed");}const type=response.headers.get("content-type")||"";if(type.includes("application/json")){const {url}=await response.json();window.location.assign(url);}else{const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=rows.find(row=>row.id===id)?.file_name||"document";anchor.click();URL.revokeObjectURL(url);}}catch(e){setMessage(e instanceof Error?e.message:"Download failed");}}
  return <Page eyebrow="Private records" title="Certificates & documents" note="Only you and authorised institutional staff can access clean scanned files." icon={<FileCheck2 />}>
    <form className="feedback-form" onSubmit={submit}><label>Document title<Input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={180}/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="certificate">Certificate</option><option value="identity">Identity</option><option value="academic">Academic record</option><option value="other">Other</option></select></label><label>PDF/JPG/PNG<Input type="file" accept=".pdf,.jpg,.jpeg,.png" required onChange={e=>{setFile(e.target.files?.[0]);setFileConsent(false);}}/></label><label className="upload-consent"><input type="checkbox" checked={fileConsent} onChange={e=>setFileConsent(e.target.checked)}/> I authorize OUR’S to upload and scan only this selected document and make it available to authorized staff for the stated institutional purpose.</label><Button type="submit" disabled={!file || !fileConsent}>Scan and upload</Button></form>
    <section className="service-records">{rows.map(row=><article key={row.id}><div><strong>{row.title}</strong><p>{row.category} · {row.file_name}</p><small>{Math.ceil(row.size_bytes/1024)} KB · {row.scan_status}</small></div><Button variant="outline" disabled={row.scan_status!=="clean"} onClick={()=>void download(row.id)}>Download</Button></article>)}</section>{!rows.length&&<p>No documents uploaded.</p>}{message&&<div className="portal-message">{message}</div>}
  </Page>;
}

export function TeacherQualityPage() {
  const { portal, error } = usePortal();
  if (!portal) return <Loading />;
  const metrics = portal.teacher_metrics;
  return (
    <Page
      eyebrow="Teaching dashboard"
      title="Classroom practice & feedback"
      note="Ratings combine verified teaching records and anonymous weekly feedback; camera data alone never determines quality."
      icon={<GraduationCap />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      {metrics ? (
        <>
          <div className="teacher-metric-grid">
            <article>
              <span>Classes completed</span>
              <strong>
                {metrics.classes_completed}/{metrics.classes_total}
              </strong>
            </article>
            <article>
              <span>Syllabus coverage</span>
              <strong>
                {metrics.topics_total
                  ? Math.round(
                      (100 * metrics.topics_completed) / metrics.topics_total,
                    )
                  : 0}
                %
              </strong>
            </article>
            <article>
              <span>Feedback responses</span>
              <strong>{metrics.feedback_count}</strong>
            </article>
            <article>
              <span>Aggregate rating</span>
              <strong>
                {metrics.feedback_average
                  ? `${metrics.feedback_average}/5`
                  : "Protected"}
              </strong>
            </article>
          </div>
          <div className="portal-two-column">
            <section className="behaviour-summary">
              <h2>Aggregate class engagement</h2>
              {Object.entries(metrics.aggregate_engagement).map(
                ([name, value]) => (
                  <article key={name}>
                    <span>{name}</span>
                    <strong>{value}%</strong>
                    <i>
                      <b style={{ width: `${value}%` }} />
                    </i>
                  </article>
                ),
              )}
            </section>
            <section className="feedback-dimensions">
              <h2>Anonymous feedback</h2>
              {metrics.feedback_minimum_met ? (
                Object.entries(metrics.feedback_dimensions).map(
                  ([name, value]) => (
                    <article key={name}>
                      <span>{name.replaceAll("_", " ")}</span>
                      <b>{value}/5</b>
                    </article>
                  ),
                )
              ) : (
                <Empty>
                  At least three responses are required before aggregates are
                  shown.
                </Empty>
              )}
            </section>
          </div>
          <ErrorNote>{metrics.notice}</ErrorNote>
        </>
      ) : (
        <Empty>Teaching metrics are available to teacher accounts.</Empty>
      )}
    </Page>
  );
}

export function StaffProfilePage({ user }: { user: PortalUser }) {
  const { portal, reload } = usePortal();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [message, setMessage] = useState("");
  useEffect(
    () => () => streamRef.current?.getTracks().forEach((track) => track.stop()),
    [],
  );
  async function setConsent(granted: boolean) {
    try {
      await request("/api/me/staff-biometric-consent", "PATCH", { granted });
      setMessage(
        granted
          ? "Consent recorded. Capture three clear samples to activate recognition."
          : "Consent withdrawn and the stored face template was deleted.",
      );
      await reload();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Consent update failed",
      );
    }
  }
  async function startCamera() {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
      }
    } catch {
      setMessage("Camera permission was not granted.");
    }
  }
  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setMessage("Start the camera and keep one clear face in view.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;
    const data = new FormData();
    data.append("image", blob, "staff-face.jpg");
    try {
      const response = await apiFetch(`${API}/api/me/staff-face`, {
        method: "POST",
        credentials: "include",
        headers: tenantHeaders(),
        body: data,
      });
      notifySessionExpiry(response);
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Face capture failed");
      setMessage(result.message);
      await reload();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Face capture failed",
      );
    }
  }
  if (!portal) return <Loading />;
  const profile = portal.staff_profile;
  return (
    <Page
      eyebrow="Staff account"
      title="Profile & face recognition"
      note="You control your own biometric consent. Administrators can assist only with your permission."
      icon={<UserRoundCheck />}
    >
      <div className="profile-layout">
        <aside className="profile-card">
          <div>{user.name.slice(0, 1)}</div>
          <h2>{user.name}</h2>
          <span>{profile?.designation || user.role}</span>
          <p>{profile?.employee_no || "Employee number not set"}</p>
          <small>{user.email}</small>
        </aside>
        <section className="face-self-card">
          <div>
            <h2>My face profile</h2>
            <p>
              Capture three different, well-lit angles. Blurred, dark, duplicate
              or multi-face images are rejected.
            </p>
            <span className={profile?.face_registered ? "ready" : "pending"}>
              {profile?.face_registered
                ? "Face profile ready"
                : `${profile?.face_samples || 0}/3 valid samples saved`}
            </span>
          </div>
          {!profile?.biometric_consent ? (
            <Button onClick={() => void setConsent(true)}>
              Record my consent
            </Button>
          ) : (
            <div className="self-camera">
              <video ref={videoRef} autoPlay muted playsInline />
              <div>
                <Button variant="outline" onClick={() => void startCamera()}>
                  <Camera />
                  Start camera
                </Button>
                <Button onClick={() => void capture()}>
                  <ScanFace />
                  Capture sample
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void setConsent(false)}
                >
                  Withdraw consent
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
      {message && <div className="portal-message">{message}</div>}
    </Page>
  );
}

export function AnnouncementManager() {
  const [form, setForm] = useState({
    title: "",
    body: "",
    audience: "all",
    expires_at: "",
  });
  const [message, setMessage] = useState("");
  const { portal, reload } = usePortal();
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await request("/api/announcements", "POST", {
        ...form,
        expires_at: form.expires_at
          ? new Date(form.expires_at).toISOString()
          : null,
      });
      setMessage("Announcement published.");
      setForm({ title: "", body: "", audience: "all", expires_at: "" });
      await reload();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Announcement failed",
      );
    }
  }
  return (
    <Page
      eyebrow="Campus communication"
      title="Publish announcement"
      note="Updates appear immediately on the intended portal."
      icon={<Megaphone />}
    >
      <form className="announcement-form" onSubmit={submit}>
        <Input
          placeholder="Announcement title"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          required
        />
        <textarea
          placeholder="Message"
          value={form.body}
          onChange={(event) => setForm({ ...form, body: event.target.value })}
          required
        />
        <div>
          <label>
            Audience
            <select
              value={form.audience}
              onChange={(event) =>
                setForm({ ...form, audience: event.target.value })
              }
            >
              <option value="all">Everyone</option>
              <option value="students">Students</option>
              <option value="teachers">Teachers</option>
              <option value="administrators">Administrators</option>
            </select>
          </label>
          <label>
            Expiry (optional)
            <Input
              type="datetime-local"
              value={form.expires_at}
              onChange={(event) =>
                setForm({ ...form, expires_at: event.target.value })
              }
            />
          </label>
        </div>
        <Button type="submit">
          <Send />
          Publish
        </Button>
        {message && <div className="portal-message">{message}</div>}
      </form>
      <div className="announcement-feed compact">
        {portal?.announcements.map((row) => (
          <article key={row.id}>
            <header>
              <Bell />
              <div>
                <strong>{row.title}</strong>
                <span>{new Date(row.published_at).toLocaleString()}</span>
              </div>
            </header>
            <p>{row.body}</p>
          </article>
        ))}
      </div>
    </Page>
  );
}

type FeePaymentReviewRow = {
  id: number;
  student_name: string;
  roll_no: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  offline_reference?: string;
  paid_on?: string;
  receipt_file_name?: string;
  created_at: string;
};

export function AdminServicesPageV6() {
  const [students, setStudents] = useState<
    { id: number; name: string; roll_no: string }[]
  >([]);
  const [payments, setPayments] = useState<FeePaymentReviewRow[]>([]);
  const [fee, setFee] = useState({
    student_id: "",
    term_label: "",
    description: "Tuition fee",
    total_amount: "",
    paid_amount: "0",
    due_date: "",
  });
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [studentRows, paymentRows] = await Promise.all([
        request<{ id: number; name: string; roll_no: string }[]>(
          "/api/students",
        ),
        request<FeePaymentReviewRow[]>("/api/admin/fee-payments"),
      ]);
      setStudents(studentRows);
      setPayments(paymentRows);
      setFee((current) => ({
        ...current,
        student_id: current.student_id || String(studentRows[0]?.id || ""),
      }));
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Fee services are unavailable",
      );
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveFee(event: FormEvent) {
    event.preventDefault();
    try {
      await request("/api/admin/fees", "POST", {
        student_id: Number(fee.student_id),
        term_label: fee.term_label,
        description: fee.description,
        total_amount: Number(fee.total_amount),
        paid_amount: Number(fee.paid_amount),
        due_date: fee.due_date || null,
      });
      setMessage(
        "Fee record published to the student portal and the student was notified.",
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Fee update failed",
      );
    }
  }

  async function reviewPayment(
    payment: FeePaymentReviewRow,
    decision: "approved" | "rejected",
  ) {
    const reason = (reasons[payment.id] || "").trim();
    if (decision === "rejected" && !reason) {
      setMessage("Enter a rejection reason before rejecting a receipt.");
      return;
    }
    try {
      await request(`/api/admin/fee-payments/${payment.id}/review`, "PATCH", {
        decision,
        reason: reason || null,
      });
      setMessage(
        decision === "approved"
          ? "Receipt approved and the verified amount was added to the fee ledger."
          : "Receipt rejected; the student was notified with the reason.",
      );
      await load();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Payment review failed",
      );
    }
  }

  async function downloadReceipt(payment: FeePaymentReviewRow) {
    try {
      const response = await apiFetch(
        `${API}/api/fee-payments/${payment.id}/receipt`,
        { credentials: "include", headers: tenantHeaders() },
      );
      notifySessionExpiry(response);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { detail?: string }).detail || "Receipt download failed",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payment.receipt_file_name || `receipt-${payment.id}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Receipt download failed",
      );
    }
  }

  async function testEmail() {
    try {
      const result = await request<{ message: string }>(
        "/api/admin/email/test",
        "POST",
      );
      setMessage(result.message);
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Email test failed",
      );
    }
  }

  return (
    <Page
      eyebrow="Institution services"
      title="Fees, receipts & recovery email"
      note="A fee balance changes only after a signed gateway event or an administrator-approved receipt."
      icon={<IndianRupee />}
    >
      <div className="portal-two-column">
        <form className="fee-admin-form" onSubmit={saveFee}>
          <h2>Publish or correct a fee item</h2>
          <label>
            Student
            <select
              value={fee.student_id}
              onChange={(event) =>
                setFee({ ...fee, student_id: event.target.value })
              }
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.roll_no} · {student.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            placeholder="Term"
            value={fee.term_label}
            onChange={(event) =>
              setFee({ ...fee, term_label: event.target.value })
            }
            required
          />
          <Input
            placeholder="Description"
            value={fee.description}
            onChange={(event) =>
              setFee({ ...fee, description: event.target.value })
            }
            required
          />
          <div>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Total"
              value={fee.total_amount}
              onChange={(event) =>
                setFee({ ...fee, total_amount: event.target.value })
              }
              required
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Already verified paid amount"
              value={fee.paid_amount}
              onChange={(event) =>
                setFee({ ...fee, paid_amount: event.target.value })
              }
            />
          </div>
          <Input
            type="date"
            value={fee.due_date}
            onChange={(event) =>
              setFee({ ...fee, due_date: event.target.value })
            }
          />
          <Button type="submit" disabled={!fee.student_id}>
            Publish fee record
          </Button>
        </form>
        <section className="email-test-card">
          <h2>Forgot-password email</h2>
          <p>
            Send a real SMTP test to your administrator address before inviting
            users. Passwords are never sent; users receive a single-use reset
            link.
          </p>
          <Button variant="outline" onClick={() => void testEmail()}>
            <Send />
            Send test email
          </Button>
          <small>
            Production startup rejects missing SMTP settings when
            REQUIRE_SMTP_IN_PRODUCTION=true.
          </small>
        </section>
      </div>
      <section className="portal-table-card payment-review">
        <h2>Offline payment receipt review</h2>
        <div className="portal-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Receipt</th>
                <th>Status / decision</th>
              </tr>
            </thead>
            <tbody>
              {payments
                .filter((row) => row.payment_method === "offline")
                .map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.roll_no}</strong>
                      <br />
                      {row.student_name}
                    </td>
                    <td>
                      {row.offline_reference}
                      <br />
                      <small>
                        {row.paid_on ||
                          new Date(row.created_at).toLocaleDateString()}
                      </small>
                    </td>
                    <td>₹{row.amount.toLocaleString("en-IN")}</td>
                    <td>
                      {row.receipt_file_name ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void downloadReceipt(row)}
                        >
                          <Download />
                          Review file
                        </Button>
                      ) : (
                        "No file"
                      )}
                    </td>
                    <td>
                      {row.status === "pending_review" ? (
                        <div className="payment-review-actions">
                          <Input
                            placeholder="Reason (required if rejected)"
                            value={reasons[row.id] || ""}
                            onChange={(event) =>
                              setReasons({
                                ...reasons,
                                [row.id]: event.target.value,
                              })
                            }
                          />
                          <Button
                            size="sm"
                            onClick={() => void reviewPayment(row, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void reviewPayment(row, "rejected")}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className={`status-pill ${row.status}`}>
                          {row.status.replaceAll("_", " ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!payments.some((row) => row.payment_method === "offline") && (
          <Empty>No offline receipts have been submitted.</Empty>
        )}
      </section>
      {message && <div className="portal-message">{message}</div>}
    </Page>
  );
}

export function CareerPage() {
  const { portal, reload } = usePortal();
  const [summary, setSummary] = useState<string | null>(null);
  const [transfer, setTransfer] = useState({
    previous_institution_slug: "",
    previous_employee_id: "",
    consent: false,
    notes: "",
  });
  const [message, setMessage] = useState("");
  const summaryValue = summary ?? portal?.career?.professional_summary ?? "";
  async function save() {
    try {
      await request("/api/staff/career", "PATCH", {
        professional_summary: summaryValue || null,
      });
      setMessage("Career profile updated.");
      setSummary(null);
      await reload();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Update failed");
    }
  }
  async function requestTransfer() {
    if (!portal?.career) return;
    try {
      await request("/api/staff/career/transfers", "POST", {
        platform_staff_id: portal.career.platform_staff_id,
        ...transfer,
      });
      setMessage(
        "Transfer verification request created. Both institutions must approve it.",
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Transfer request failed",
      );
    }
  }
  if (!portal) return <Loading />;
  return (
    <Page
      eyebrow="Consent-based professional record"
      title="Teaching career profile"
      note="College name and employee ID alone can never retrieve a record. Teacher consent and both institutions' approval are required."
      icon={<GraduationCap />}
    >
      {portal.career ? (
        <>
          <article className="career-id">
            <span>Stable platform staff ID</span>
            <strong>{portal.career.platform_staff_id}</strong>
            <small>
              {portal.career.verified ? "Verified" : "Verification pending"}
            </small>
          </article>
          <section className="career-editor">
            <h2>Professional summary</h2>
            <textarea
              value={summaryValue}
              onChange={(event) => setSummary(event.target.value)}
            />
            <Button onClick={() => void save()}>Save profile</Button>
          </section>
          <section className="service-records">
            <h2>Verified service history</h2>
            {portal.career.services.map((row) => (
              <article key={row.id}>
                <div>
                  <strong>{row.institution}</strong>
                  <span>
                    {row.designation} · {row.local_employee_id || "No local ID"}
                  </span>
                </div>
                <small>
                  {row.started_on} – {row.ended_on || "Present"}
                </small>
              </article>
            ))}
          </section>
          <section className="transfer-form">
            <h2>Request continuation from a previous college</h2>
            <Input
              placeholder="Previous institution slug"
              value={transfer.previous_institution_slug}
              onChange={(event) =>
                setTransfer({
                  ...transfer,
                  previous_institution_slug: event.target.value,
                })
              }
            />
            <Input
              placeholder="Previous verified employee ID"
              value={transfer.previous_employee_id}
              onChange={(event) =>
                setTransfer({
                  ...transfer,
                  previous_employee_id: event.target.value,
                })
              }
            />
            <textarea
              placeholder="Optional note"
              value={transfer.notes}
              onChange={(event) =>
                setTransfer({ ...transfer, notes: event.target.value })
              }
            />
            <label>
              <input
                type="checkbox"
                checked={transfer.consent}
                onChange={(event) =>
                  setTransfer({ ...transfer, consent: event.target.checked })
                }
              />
              I consent to the approved professional record transfer.
            </label>
            <Button
              onClick={() => void requestTransfer()}
              disabled={!transfer.consent}
            >
              Request verification
            </Button>
          </section>
        </>
      ) : (
        <section className="career-editor">
          <h2>Create your protected career identity</h2>
          <p>
            Save a professional summary to create your stable platform staff ID.
          </p>
          <textarea
            value={summaryValue}
            onChange={(event) => setSummary(event.target.value)}
          />
          <Button onClick={() => void save()}>Create career profile</Button>
        </section>
      )}
      {message && <div className="portal-message">{message}</div>}
    </Page>
  );
}

export function AdminServicesPage() {
  const [students, setStudents] = useState<
    { id: number; name: string; roll_no: string }[]
  >([]);
  const [fee, setFee] = useState({
    student_id: "",
    term_label: "",
    description: "Tuition fee",
    total_amount: "",
    paid_amount: "0",
    due_date: "",
  });
  const [message, setMessage] = useState("");
  useEffect(() => {
    void request<{ id: number; name: string; roll_no: string }[]>(
      "/api/students",
    )
      .then((rows) => {
        setStudents(rows);
        if (rows[0])
          setFee((current) => ({ ...current, student_id: String(rows[0].id) }));
      })
      .catch(() => undefined);
  }, []);
  async function saveFee(event: FormEvent) {
    event.preventDefault();
    try {
      await request("/api/admin/fees", "POST", {
        student_id: Number(fee.student_id),
        term_label: fee.term_label,
        description: fee.description,
        total_amount: Number(fee.total_amount),
        paid_amount: Number(fee.paid_amount),
        due_date: fee.due_date || null,
      });
      setMessage("Fee record published to the student portal.");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Fee update failed",
      );
    }
  }
  async function testEmail() {
    try {
      const result = await request<{ message: string }>(
        "/api/admin/email/test",
        "POST",
      );
      setMessage(result.message);
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Email test failed",
      );
    }
  }
  return (
    <Page
      eyebrow="Institution services"
      title="Fees & communication setup"
      note="Passwords are never emailed. Forgot-password uses a single-use 30-minute reset link."
      icon={<IndianRupee />}
    >
      <div className="portal-two-column">
        <form className="fee-admin-form" onSubmit={saveFee}>
          <h2>Publish or correct a fee item</h2>
          <label>
            Student
            <select
              value={fee.student_id}
              onChange={(event) =>
                setFee({ ...fee, student_id: event.target.value })
              }
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.roll_no} · {student.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            placeholder="Term"
            value={fee.term_label}
            onChange={(event) =>
              setFee({ ...fee, term_label: event.target.value })
            }
            required
          />
          <Input
            placeholder="Description"
            value={fee.description}
            onChange={(event) =>
              setFee({ ...fee, description: event.target.value })
            }
            required
          />
          <div>
            <Input
              type="number"
              min="0"
              placeholder="Total"
              value={fee.total_amount}
              onChange={(event) =>
                setFee({ ...fee, total_amount: event.target.value })
              }
              required
            />
            <Input
              type="number"
              min="0"
              placeholder="Paid"
              value={fee.paid_amount}
              onChange={(event) =>
                setFee({ ...fee, paid_amount: event.target.value })
              }
            />
          </div>
          <Input
            type="date"
            value={fee.due_date}
            onChange={(event) =>
              setFee({ ...fee, due_date: event.target.value })
            }
          />
          <Button type="submit">Publish fee record</Button>
        </form>
        <section className="email-test-card">
          <h2>Forgot-password email</h2>
          <p>
            Send a real SMTP test to your administrator address. The delivery
            attempt and any provider error are logged.
          </p>
          <Button variant="outline" onClick={() => void testEmail()}>
            <Send />
            Send test email
          </Button>
          <small>
            Configure SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD and
            SMTP_FROM_EMAIL in .env first.
          </small>
        </section>
      </div>
      {message && <div className="portal-message">{message}</div>}
    </Page>
  );
}
