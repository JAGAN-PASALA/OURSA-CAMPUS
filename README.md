# OURSA CAMPUS 

## v8.2 security changes

- Administrator accounts must enroll TOTP two-step authentication before using protected application APIs.
- Sign-in requires explicit acceptance of the versioned Terms of Use and Privacy Notice; review the template legal pages and complete institution-specific legal review before launch.
- Student uploads include explicit file-selection/processing confirmation. Fee receipts, coursework attachments, on-duty letters and student documents use the shared private storage and malware scanning service.
- Redis-backed rate limiting fails closed in production, password recovery and institution search are throttled, sessions have a 30-minute idle timeout, and logout/session rotation use registered revocation state.
- Production OpenAPI schema is disabled, health disclosure is minimized, Android backup is disabled, and wildcard Cordova access is removed.
- See `docs/SECURITY_UPGRADE_V8_2.md`, `docs/API_SECURITY_INVENTORY.md`, and `docs/RELEASE_NOTES_V8_2_SECURITY.md` for implementation details and release blockers.

## v8.1 interface completion

- One attendance page groups Present, Absent, OD/exempted, and Needs review/Pending students.
- Authorized teachers can correct any attendance row before or after finalization; a reason is mandatory and the backend preserves an audit record.
- Institution owners can upload or replace customer logos from the Institutions screen.
- Notifications can be separated into attendance, assignments/exams, fees, announcements, and security categories.
- Camera health and temporary-room diagnostics remain available but are collapsed during normal attendance work.

Before public deployment, complete every item in `docs/PUBLIC_LAUNCH_GATE.md`. Passing repository tests does not by itself certify a 100,000-concurrent-user deployment.

Production-oriented, white-label platform for colleges and schools. Each institution gets its own login domain and isolated users, courses, academic records, incidents, and encrypted face profiles. It runs in VS Code on Windows/Linux/macOS, supports SQLite for evaluation and MySQL for shared deployments, and does not require a paid AI API key.

## What is included

- Administrator, teacher, and student dashboards
- Responsive campus-portal interface with quick access to assignments, exams, results, attendance, behaviour, timetable, fees, announcements, feedback, profile, and security
- Platform-administrator institution provisioning with a custom domain, name, colour, and first administrator
- A platform-only operations dashboard for customer provisioning, platform-team accounts, system status, model releases, support consent, lifecycle controls and platform audit history
- Strict separation between platform operators and college operations: platform accounts cannot directly use college administration, academics, attendance, fees, coursework or assessment APIs
- Named, time-limited, college-approved and read-only support sessions for troubleshooting without impersonating a customer administrator
- Institution search and recommendations before role-based login
- Tenant isolation based on the selected institution or request domain, including independent face-profile training for every institution
- Secure Argon2 password hashing and standard expiring JWT sessions in HttpOnly cookies
- Role-based API access, login throttling, security headers, audit logs, and password-change/session revocation support
- Self-service password changes, one-time forgot-password email links, and administrator-issued temporary passwords
- Department email domains, automatic student email suffixes, duplicate protection, and correction screens for student, course, term, and institution details
- Student/course/enrollment management and combined academic, subject-attendance, and behaviour dashboards
- Academic terms, sections, term-specific teacher assignments, mid-term teacher replacement, required student class membership, and recurring physical-class timetables
- HOD subject/teacher allocation controls without granting full college-administrator access
- Date/period-level class sessions, planned syllabus topics, teacher-recorded actual coverage, and coverage dashboards
- Teacher-published coursework with typed or handwritten PDF/JPG/PNG submissions, upload progress, protected teacher downloads, subject-teacher routing, marks, feedback, and student result visibility
- Offline classroom tests with manual marks entry and timed online tests with a required question count, common or per-question marks, server-verified timing, answer autosave, automatic scoring, and answer review
- Student fee balances, targeted announcements, editable profile/guardian details, and consent-controlled SMS/WhatsApp attendance delivery records
- Consent-controlled student self-enrollment and staff face enrollment for teachers, HODs, deans, principals and other staff; institution-wide duplicate-face rejection; encrypted face templates; immediate template deletion when consent is withdrawn
- Face recognition only after three valid varied samples, with quality gates, configurable match thresholds, temporal behaviour smoothing, phone detection, attendance, and reviewed incident records
- Configurable presence thresholds (80% by default), camera-created teacher-and-student raised-hand requests that remain pending until teacher approval, manual teacher health exceptions, class finalisation, and sustained fight/crowd sound alerts
- Separate classroom entry/exit events and sustained behaviour episodes; sleeping or similar classroom behaviour is recorded only after the configurable 60-second threshold
- Timetable-aware always-on USB/IP/mobile-camera worker: normal classroom behaviour is associated with the active period, while out-of-period monitoring is safety-only
- Teacher teaching metrics and privacy-protected weekly student feedback; camera observations are supporting data and never the sole teacher-quality decision
- Verified staff career records and a two-institution approval workflow for carrying records to another participating college
- Model validation output with grouped person/session/camera holdouts, accuracy, per-class precision/recall/F1, a confusion matrix and candidate checksums
- One shared behaviour classifier across the platform; training creates a candidate and only an authorised platform operator can promote a candidate that passes the release gate
- SQLAlchemy database layer, MySQL support, and versioned Alembic migrations
- Docker Compose, health/readiness endpoints, environment validation, automated tests, and deployment guidance

The original `backend/data/smart_classroom.db` is not modified. The upgraded local database is `backend/data/smart_classroom_v2.db`.

## Fastest Windows/VS Code start

Requirements: Python 3.11 or 3.12, Node.js 22+, a webcam, and internet access during the first install/model download.

1. Extract the ZIP and open the extracted folder in VS Code.
2. Double-click `configure_mysql_windows.bat` and enter the MySQL administrator password.
3. Double-click `create_platform_admin_windows.bat` and create your real first administrator account.
4. Double-click `start_windows.bat`.
5. Keep both terminal windows open and visit `http://localhost:5173`.
6. Search for the platform organisation, choose **Administrator**, and sign in with the account you created.

Linux/macOS:

```bash
chmod +x start_linux.sh
./start_linux.sh
```

The start scripts install packages, apply database migrations, start FastAPI on port 8000, and start the dashboard on port 5173.

No demo accounts or visible sample passwords are created. Institution administrators create their own teacher and student accounts from the Administration dashboard.

### Upgrade from an earlier release

Stop all old API, dashboard and camera-worker terminals. Back up MySQL, uploaded files and the working `.env`; extract v8.2 into a new folder; copy the existing `.env` into the new project root; add the new variables from `.env.production.example`; and run `start_windows.bat` for local evaluation. Keep the same MySQL database and biometric key. The v8.2 schema update adds MFA columns and a legal-acceptance table without deleting user, face, attendance, assignment, test, fee or result records. Existing v8.1 local uploads need to be moved to private storage: back up first, run `python scripts/migrate_legacy_uploads.py` in dry-run mode, then use `--apply` only after confirming private object storage and ClamAV are configured. Administrator accounts must enroll MFA at next sign-in. Production requires `MFA_ENCRYPTION_KEY` and `REDIS_PASSWORD` in `.env.production`. Public deployment must use the production stack and launch gate; this source update is not penetration-tested or production-certified.

## Colleges, emails and passwords

- The platform owner creates each college in **Institutions** and enters its first administrator email.
- College administrators use **Administration → College accounts** to create student, teacher and additional administrator emails.
- Every signed-in user can change their own password under **Security**.
- College administrators can issue a temporary password to users in their own college. The platform owner can reset a customer administrator or add platform-team accounts.
- **Forgot password** sends a one-time 30-minute reset link when SMTP settings are configured in `.env`. Without SMTP, the college administrator can issue a temporary password immediately.

## Use your existing MySQL

On Windows, double-click `configure_mysql_windows.bat`. It creates a least-privileged application user, tests the connection, generates secrets, and writes `.env`. Then run `create_platform_admin_windows.bat` once before starting the application.

For manual setup, create the database/user, copy `.env.example` to `.env`, and change `DATABASE_URL`:

```env
DATABASE_URL=mysql+pymysql://ours_app:YOUR_PASSWORD@127.0.0.1:3306/ours_classroom?charset=utf8mb4
```

Then restart the backend. `backend/run.py` automatically applies the migrations. Full SQL and MySQL Workbench steps are in [docs/MYSQL_SETUP.md](docs/MYSQL_SETUP.md).

## Create customer institutions and domains

1. Search for your platform organisation, select **Administrator**, and sign in with the platform account created during setup.
2. Open **Institutions**, then enter the school/college name, domain, branding and initial administrator.
3. In your DNS provider, point that domain to the public server running this application and enable HTTPS in your reverse proxy.
4. The customer can search for the institution on the main portal or sign in through its assigned domain. The backend keeps the session and all records isolated to the selected institution.

Registering a domain in the dashboard does not buy or configure DNS automatically. See [docs/MULTI_TENANT_DOMAINS.md](docs/MULTI_TENANT_DOMAINS.md).

For a fresh production database with `SEED_DEMO_DATA=false`, run `python scripts/create_platform_admin.py` once (or `create_platform_admin_windows.bat`) before the first login.

## Docker with MySQL

For a local full-stack MySQL check:

```bash
docker compose up --build
```

Open `http://localhost:5173`. Data stays in the `mysql_data` Docker volume. The credentials in the base Compose file are explicitly local-development values.

For deployment, copy `.env.production.example` to a private `.env.production`, provide strong values, point the listed DNS names to the server, and run the standalone TLS-enabled production stack:

```bash
python scripts/validate_production_env.py .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

The included Caddy service obtains and renews HTTPS certificates. MySQL is not published to the internet, its root password is not passed to application containers, the API is reached through the same HTTPS origin as the dashboard, and production startup refuses weak secrets, non-MySQL databases, insecure origins, invalid biometric encryption, shared-domain cookies, or unconfigured SMTP. Read [docs/SECURE_DEPLOYMENT.md](docs/SECURE_DEPLOYMENT.md) and [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) before exposing the service.

## Administrator workflow

1. Sign in as administrator and open **Administration**.
2. Create the department and its real email suffix. Existing department names from older databases are recovered automatically and can be corrected under **Correct department details**.
3. Open **Academic plan** and create the academic term and class section first.
4. Return to **Administration → New student**. Select **Department → Class section → Academic term**; all three are required. Existing students can be changed with **Academic plan → Assign or move student**.
5. Create courses and assign one teacher to each course, class and term. Create a new assignment for every new semester. If staff leave during a term, use **Replace assigned teacher**; future periods, open tests and open coursework move to the replacement while completed history is preserved.
6. Publishing a recurring timetable generates physical class sessions. Add syllabus units and dated topics.
7. Create teachers, HODs, deans, principals and other staff under **Administration → College accounts**. Choose teaching, administration, or face-enrolment-only access. Record biometric consent only after your approved consent process.
8. Sign in as teacher, open **Live monitor**, select the physical class, then capture three clear face angles for each student and staff member. Recognition stays disabled until all three valid samples are stored. Students and staff can instead enroll their own face from **Profile**, subject to the same consent, quality and duplicate checks.
9. Students can also register their own face from **Profile**, after granting consent. A face already registered to another person in that institution is rejected. Camera presence accumulates against the scheduled class duration; the default attendance rule is 80%. For an exit exception, the logged-in assigned teacher and recognised student face the camera and raise a hand in the same frame. This creates a pending row; the teacher must approve or reject it before finalising attendance. Health exceptions remain a deliberate teacher action because a camera must not diagnose health.
10. After class, record actual topic coverage. Only completed topics can be selected for tests.
11. For coursework, the teacher creates and publishes an assignment. Students see it under **Assignments**, type an answer or upload up to the configured number of handwritten PDF/JPG/PNG files, and make one final submission. The currently assigned subject teacher receives protected files, grades the work, and returns feedback.
12. For online tests, choose the required question count and common or separate marks, add exactly that number of questions, and publish. Only students in the exact class and term can start it. The server applies the timer, autosaves answers, scores the final submission, and shows correct answers when enabled. Offline marks remain teacher-entered.
13. Teachers capture labelled action examples in varied lighting, positions, people, clothing and camera angles. Until the classifier is calibrated the monitor says **calibration pending**. The platform administrator trains and publishes the shared behaviour model; face profiles remain institution-specific.

Students see published physical classes, coursework, planned/covered topics, tests, results, fee balances, and announcements through separate campus-portal services. Their dashboard includes overall and subject-level attendance charts, one-minute behaviour episodes with start/end times, separate entry/exit history, coursework marks, and assessment scores.

## Always-on cameras and mobile cameras

The browser monitor is useful during setup. For continuous CCTV operation, configure `CAMERA_STREAMS_JSON` in `.env` and run `start_camera_worker_windows.bat` in a separate terminal. A local USB camera normally uses source `0`. An IP camera or an old mobile phone running an IP-camera app uses its authenticated RTSP/HTTP stream URL. Keep camera credentials private and do not commit `.env`.

The worker automatically links a configured classroom to its active timetable period. During breaks or outside scheduled classes, it does not add phone, sleeping, or talking observations to student academic behaviour; it keeps only safety monitoring such as sustained fighting/crowding. Use a supervised pilot to tune thresholds for each camera angle and classroom.

WhatsApp and SMS require an approved provider, verified sender/templates where applicable, and explicit recipient consent. Forgot-password delivery requires working SMTP. Administrators can test SMTP under **Fees & services** without seeing or storing anyone's password.

Configuration examples and troubleshooting are in [docs/CAMERA_AND_MESSAGING_SETUP.md](docs/CAMERA_AND_MESSAGING_SETUP.md).

The service stores pose features for action training, not camera frames. Face templates are encrypted before database storage. A teacher must review automated incident predictions; they are not disciplinary findings.

## Guides supplied with this release

- [Complete role-based user manual](docs/USER_MANUAL.md)
- [Secure internet deployment guide](docs/SECURE_DEPLOYMENT.md)
- [Production release checklist](docs/PRODUCTION_CHECKLIST.md)
- [Camera and messaging setup](docs/CAMERA_AND_MESSAGING_SETUP.md)
- [Version 7 release notes](docs/RELEASE_NOTES_V7.md)
- `output/pdf/OURS_Smart_Classroom_v7_User_Manual.pdf` - printable role-based manual

## Manual development commands

Backend:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cd backend
python run.py
```

Frontend, in a second terminal:

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

API documentation is available in development at `http://localhost:8000/docs`. Health endpoints are `/api/health` and `/api/ready`.

## Validation

```bash
cd backend
../.venv/bin/python -m pytest tests -q
cd ..
npm run lint
npm run build
```

The v7 release gate covers 32 backend/API tests, 5 rendered/frontend tests, TypeScript, lint, a production build, live same-origin proxy/login smoke testing, clean and v6-to-v7 migrations, MySQL schema compilation, production-environment checks, dependency audits, Python compilation, and package integrity checks. See [docs/VALIDATION_REPORT.md](docs/VALIDATION_REPORT.md) for the exact scope and limitations.

## Important production boundary

This repository is a production-oriented engineering baseline, not evidence that biometric/action recognition is legally or scientifically suitable for every institution. Before customer deployment, complete a privacy/legal review, threat model and penetration test, bias and false-match evaluation on representative consented data, retention policy, human-review procedure, uptime/backup testing, and a monitored pilot. See [docs/AI_SAFETY_AND_PRIVACY.md](docs/AI_SAFETY_AND_PRIVACY.md).
