# OUR'S Smart Classroom v7.3 - Validation Report

## Release gate

The final v7.3 source passed these repeatable checks on 26 September 2026:

- 32 backend/API tests
- 5 frontend/rendered-interface tests
- TypeScript type checking
- ESLint with no reported errors
- verified production frontend build
- live Vite same-origin proxy, health, institution recommendation, cookie login and platform-dashboard smoke test
- Python source compilation
- clean database migration through revision `0013`
- upgrade migration from v6 revision `0010` through `0011`
- SQLite integrity checks after both migration paths
- MySQL DDL compilation for 55 schema tables
- npm production dependency audit with no known reported vulnerabilities
- tested Python environment audit with no known reported vulnerabilities
- release archive secret/database/cache exclusion and ZIP integrity checks (performed during packaging)

The two Python warnings are upstream Starlette/httpx deprecation notices in the test client; they are not failed product tests.

## High-value workflow coverage

- tenant/domain isolation, exact login role and host-bound session checks
- platform-owner separation from college administration and academics
- HOD allocation authority versus ordinary-teacher denial
- named-administrator support consent, read-only access and revocation
- passwords, secure cookies, reset tokens and session revocation
- student/staff creation, duplicate checks and class membership
- guardian consent for a minor's biometric enrolment
- three-sample face readiness and cross-student/staff duplicate-face protections
- assignment publication, protected file submission, teacher routing and grading
- online-test timing, autosave/submission/scoring and offline marks
- timetable proposals, conflict detection and administrator approval
- camera-failure attendance fallback, reviewed corrections and notification deduplication
- fee receipt review and idempotent approval
- shared-model candidate protection and promotion metric gates
- production configuration rejection when HTTPS, hostnames, cookies, databases or secrets are unsafe

## Important scope

Passing this gate confirms the tested source and workflows in the supplied environment. It is not a guarantee for every future infrastructure, browser, camera, SMTP/payment/messaging provider, dataset or legal requirement. Before a college rollout, complete staging, independent penetration testing, encrypted backup restoration, load testing, privacy/biometric review, representative accuracy/bias evaluation and a supervised full-classroom pilot.

## Operational acceptance tests still required

1. Send password-reset mail to real domains and verify SPF/DKIM/DMARC, spam handling, expiry and single use.
2. Validate SMS/WhatsApp templates, consent, opt-out and correction with the approved provider.
3. Verify payment signatures and replay handling in provider sandbox mode.
4. Test every approved CCTV/mobile stream for reconnect, frame rate, crowd load and camera placement.
5. Measure face false-match/false-non-match and behaviour precision/recall on representative consented data.
6. Restore an encrypted production-shaped backup into a separate environment.
7. Test cross-tenant denial with two real staging institutions and every role.
8. Load-test expected concurrent users, test attempts, uploads and camera streams.
9. Exercise support approval/revocation and institution archive/restore in staging.
