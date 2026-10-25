# OUR'S Smart Classroom v7.3 Final

## Final operations update (26 September 2026)

- Added migration `0013` without deleting existing academic, identity, biometric or financial data.
- Added safe CSV/XLSX student and timetable imports with templates, preview, resolved mappings, row errors, duplicate checks and explicit create/update confirmation.
- Student personal details are read-only by default. Administrators can grant/revoke limited self-edit access; face enrolment remains independent.
- Added supporting-letter OD requests and sequential mentor, department-HOD and dean/principal approval. Final approval records OD per covered period while retaining original attendance provenance.
- Attendance review now projects and names Present, Absent, OD, Pending and Needs Review students before publication, confirms counts and remains idempotent after publication.
- Announcement timestamps now convert database UTC timestamps to the configured campus timezone, including naive MySQL `DATETIME` values and old records.
- Added exact three-sample face-enrolment progress/success language, timetable and student import screens, and public Privacy/Terms pages.

## Room-linked camera and cumulative attendance patch

- Live browser/mobile monitoring now selects a classroom/room number. The backend resolves the active timetable period using the configured campus timezone; a stale period cannot be selected accidentally.
- Health and camera status expose the configured campus time, and date filtering uses the browser's local calendar date instead of UTC date conversion.
- Attendance accumulates the interval between trusted physical observations (up to the configured gap), records audited exit/re-entry events for longer gaps, and displays observed percentage, required percentage, seconds and shortfall.
- A face detected inside a phone screen is rejected for attendance, while temporary face occlusion during writing can use a short-lived stable body-track identity.
- Browser camera health is recorded even when a room is outside a scheduled class; academic attendance and ordinary behaviour are not created outside an active timetable window.

## V7.1 deployment update

- Added explicit class mentors. Mentors can propose timetable changes for their class; HOD/college administrators approve or publish them.
- Timetable periods now display subject and assigned teacher, inherit dates from the selected academic term, preserve history, support safe removal, and generate the remaining semester sessions.
- Added audited timetable-change review, class rename/archive safeguards, and semester-bound validation.
- Added transactional push delivery with retries, expired-token deactivation, web FCM service worker, in-app notifications, and Android/iOS FCM registration.
- Added Capacitor Android/iOS projects, secure native token storage, HTTPS-only mobile API configuration, and PWA manifest.
- Added SMTP implicit TLS support for port 465 and a separate notification worker in production Compose.

V7.1 still requires deployment-specific domain, MySQL, SMTP, Firebase/FCM, Android signing, and Apple/APNs credentials before public release.

Version 7 completes the role-separation, support-consent, model-governance and same-origin reliability work while preserving all v6 institution, academic, attendance, coursework, assessment, fee, face and audit records.

## Major changes

- Separate platform operations, college-administrator, HOD, teacher and student navigation/workspaces
- Server-enforced denial of college operations for platform-owner/team accounts
- HOD subject/teacher allocation permission without full college-administrator authority
- Named-college-administrator approval for expiring, revocable, read-only platform support sessions
- Protected institution archive/restore and tightly limited empty-test-tenant deletion
- Platform operations dashboard, system status, support, audit and customer lifecycle pages
- Same-origin browser API requests for localhost, LAN and HTTPS deployments, including stale-session recovery
- More forgiving college search recommendations that ignore common punctuation
- Behaviour sample provenance, consent/review status, persistent person tracking and person-specific phone association
- Grouped person/session/camera holdout validation, candidate model registry, metrics, checksums and explicit promotion gates
- Safe mode keeps face attendance and crowd counting available while hiding unvalidated behaviour/fighting labels
- Migration `0011` for support sessions, tenant lifecycle metadata and behaviour-model governance

## Data preservation

Migration `0012` is additive. It does not delete or rewrite existing v6/v7 accounts, institutions, face templates, attendance, assignments, tests, fees, submissions or results. Back up MySQL, uploaded files, models, `.env` and the biometric key before upgrading.

## Validation gate

- 32 backend/API workflow, isolation and security tests
- 5 frontend/rendered-interface tests
- TypeScript, ESLint and production frontend build
- live same-origin health, institution-search, cookie-login and platform-dashboard smoke test
- clean migration through `0011` and v6 `0010` to v7 `0011` upgrade
- MySQL DDL compilation for 55 tables
- Python compilation and production dependency audits with no known reported vulnerabilities

## Production boundary

This release is a production-oriented engineering baseline, not automatic permission to deploy biometric or behaviour monitoring. A customer rollout still requires legal/privacy review, representative false-match and behaviour validation, penetration testing, backup/restore testing, human correction/appeal procedures, load/camera pilots and ongoing operations.
