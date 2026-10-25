# OUR'S Smart Classroom v8.0 release candidate

This release preserves all v7.3 academic, CCTV, attendance, assignment, examination, fee, notification, face and multi-institution workflows and adds launch foundations that were not present in v7.3.

## Added

- One-time initial credentials with forced change and account lockout.
- Password show/hide controls throughout account forms.
- Automatic institutional login ID from register number and department domain when email is omitted.
- Expanded bulk student import personal/guardian contact fields.
- Bulk offline result CSV/XLSX preview and audited publication.
- Secure Certificates & Documents service with malware scanning.
- Institution logo upload API and branded login rendering.
- Redis distributed limits/session controls and explicit MySQL pooling.
- Private object storage and production dependency readiness.
- 100,000-concurrency load-test scenario and public-launch gate.
- Pose-insufficient recognition fix: face/attendance processing no longer discards a person merely because behaviour keypoints are incomplete.

## Upgrade

Back up MySQL and private files, copy the previous `.env` values into the new production environment, add Redis/MinIO/ClamAV settings, and run Alembic revision `0014`. Test the upgrade on a restored database copy before changing production.
