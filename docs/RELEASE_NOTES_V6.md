# OUR'S Smart Classroom v6.0

Version 6 completes the security, operational and role-separated update requested after v5 while preserving existing assignment submission, fee and announcement records.

## Major changes

- Same-origin HTTPS production stack with Caddy, private MySQL networking and strict production configuration validation
- Secure host-bound tenant routing for customer domains and a shared institution-search portal
- Separate student services for home, assignments, exams, results, attendance, behaviour, timetable, fees, announcements, profile, feedback and security
- Staff self-service face consent/enrollment plus assisted enrollment for teacher, HOD, dean, principal and other staff
- Three-sample face readiness, quality checks, institution-wide duplicate rejection and encrypted templates
- Date-of-birth and verified-guardian safeguards before enabling minor biometrics
- Timetable proposals, administrator approval/rejection, teacher/room/class conflict checks and temporary-room audit records
- Period-linked camera health, reconnect reporting, attendance states and **Needs review** fallback when a camera fails or no observation exists
- 80% configurable scheduled-presence attendance, reviewed raised-hand exit requests, health exceptions and audited corrections
- Timed online tests with question count, common/separate marks, instructions, optional close time, autosave, server deadline, automatic scoring and permitted correct-answer review
- Protected handwritten assignment uploads routed to the currently assigned subject teacher
- Verified online-payment order/webhook flow and administrator-reviewed offline receipts with idempotent balance updates
- In-app assignment, test, result, attendance, fee and announcement notifications; optional consent-controlled SMS/WhatsApp and FCM delivery foundations
- Sustained one-minute classroom behaviour episodes, separate entry/exit records and timetable-filtered break behaviour
- Always-on safety mode for sustained fight/crowd alerts; fighting labels require the validated shared behaviour model
- Teacher metrics with privacy-protected feedback and verified two-institution career transfer
- Faster repeat launch scripts and a deterministic frontend lockfile

## Database

Migration `0010` adds final-release controls without deleting v5 data. Both clean installation and `0009`→`0010` upgrade paths were verified.

Back up the MySQL database and `backend/data` uploads before upgrading. Copy the existing `.env`, then compare it with `.env.example` and add the new variables.

## Validation gate

- 26 backend/API workflow and security tests
- 5 frontend tests
- frontend lint and production build
- clean migration through `0010`
- v5 (`0009`) upgrade through `0010`
- production npm audit: no known vulnerabilities
- tested Python environment audit: no known vulnerabilities
- ZIP content/secret/exclusion checks required before distribution

## Production boundary

This is a production-oriented software baseline, not automatic legal or scientific approval for biometric monitoring. Customer deployment still requires institutional consent/privacy review, representative accuracy and bias validation, penetration testing, backup/restore testing, human appeal/correction procedures, camera-capacity testing and a monitored pilot.
