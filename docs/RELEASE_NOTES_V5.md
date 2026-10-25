# OUR'S Smart Classroom v5.0

Version 5 introduces the responsive campus portal requested for day-to-day student and staff use while preserving the v4.4 academic, attendance, test, coursework, tenant, and face records.

## Campus portal

- A responsive institution header, service rail, and mobile drawer replace the prototype-style navigation.
- Students have separate Dashboard, Assignments, Exams, Results, Attendance, Behaviour, Timetable, Fees, Announcements, Feedback, Profile, and Security services.
- Teachers and administrators have focused Academics, Attendance & camera, Teaching, Announcements, Career, Administration, Fees & services, Institutions, and Security services according to permission.
- Portal data refreshes without requiring a full sign-out/sign-in cycle.

## Coursework and assessments

- Students can submit typed work or handwritten PDF, JPG, and PNG files with upload progress.
- File signatures, size, count, deadline, tenant, class, and teacher access are verified by the backend.
- Online tests support question count, common or per-question marks, server-side duration, periodic answer autosave, continuation after refresh, automatic submission, automatic objective scoring, and controlled correct-answer review.
- Offline tests retain teacher-entered marks.

## Attendance, behaviour, and cameras

- The default 80% period-presence rule remains configurable.
- Student-and-teacher raised-hand detection creates a pending request. It never grants attendance until the assigned teacher approves it.
- Teacher health/manual exceptions are audit logged.
- Classroom entry and exit events are stored independently from daily attendance.
- Behaviour is stored as an episode with start/end time only after the configurable 60-second threshold.
- The camera worker accepts USB, authenticated IP CCTV, and mobile IP-camera streams and automatically links frames to the active timetable period.
- Outside a timetable period, ordinary classroom behaviours are not added to academic records; sustained fight/crowd safety alerts remain active and can sound locally.

## Identity and face enrollment

- Students can register their own face after consent from Profile.
- Every proposed student or staff template is compared with existing face templates in that institution. A likely duplicate belonging to another identity is rejected.
- Teachers, HODs, deans, principals, administrators, and face-only staff remain supported.
- Face templates stay encrypted and tenant isolated; the behaviour classifier remains shared.

## Campus services and communication

- Administrators can add fee items and payments; students see balances and due dates.
- Administrators and teachers can publish audience- and class-targeted announcements.
- Attendance finalisation creates an in-app notification and, only when configured and consented, attempts SMS/WhatsApp delivery through the provider.
- SMTP can be tested from the administrator UI. Forgot-password email contains a single-use reset link, never the old password.

## Teaching feedback and career continuity

- Teachers receive academic, attendance, interaction, feedback, and observation metrics with transparent limitations.
- Weekly feedback is anonymous in aggregate and withheld until the minimum response threshold is reached.
- Camera data alone does not determine teaching quality.
- Staff career continuity uses a platform career identifier plus requests approved by both the previous and receiving institution. College name and employee ID alone cannot expose a record.

## Database and compatibility

- Alembic revision `0009` creates the new portal tables without replacing existing v4.4 tables or rows.
- Fresh SQLite migration and v4.4-to-v5 upgrade migration are verified.
- Existing `.env` and MySQL database can be reused; new optional SMTP, messaging, upload, behaviour-threshold, and camera settings are documented in `.env.example`.

## Production boundary

Provider accounts, verified message senders, public DNS, HTTPS, backups, consent/retention policies, legal review, camera placement review, bias/false-match testing, penetration testing, monitoring, and a supervised pilot remain deployment responsibilities. Automated behaviour predictions require human review and must not be used as disciplinary findings by themselves.
