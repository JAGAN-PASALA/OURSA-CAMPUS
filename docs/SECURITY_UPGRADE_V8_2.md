# OUR’S Smart Classroom v8.2 — Security upgrade notes

## Implemented in this source update (not yet independently penetration-tested)
- Rate limiter fails closed in production when Redis is missing or errors; session revocation checks Redis instead of returning before checking it.
- Redis-backed idle-session activity with a 30-minute inactivity timeout; production sessions fail closed when the activity store is unavailable.
- Login requires explicit acceptance of a versioned Terms/Privacy notice; acceptance is recorded by user and version.
- Administrator accounts must enroll TOTP MFA before accessing application APIs; MFA secrets are encrypted using a dedicated MFA_ENCRYPTION_KEY (required in production).
- Generic credential failure responses; account-wide hard lockout removed to reduce attacker-triggered account denial of service.
- Atomic Redis-backed rate limits on institution search, forgot-password, reset-password and MFA enrollment confirmation endpoints.
- Production OpenAPI schema disabled; health endpoint no longer reports database technology/version.
- Fee receipts, assignment attachments, and on-duty letters now use the common private storage + malware scan path. Private download links are short-lived and downloads remain authorization-checked.
- Android app backup disabled and wildcard Cordova origin removed.
- Additive migration adds MFA columns to existing users table; legal acceptance uses a new table created by SQLAlchemy metadata.
- Added Terms of Use and Privacy Notice template pages and public API endpoints.

## Required deployment work before public launch
1. Set unique high-entropy APP_SECRET, BIOMETRIC_ENCRYPTION_KEY and MFA_ENCRYPTION_KEY values and preserve them securely. Rotating encryption keys requires a planned re-encryption migration; changing APP_SECRET invalidates existing JWTs.
2. Configure Redis with authentication (now enabled in the production Compose file) and TLS, private object storage with TLS, MySQL TLS, network segmentation, firewall/WAF rules, monitoring/alerting and append-only external audit-log storage. The Compose file still does not provision internal TLS certificates for Redis, MinIO or MySQL.
3. Configure encrypted automated database/object backups, off-site immutable copies, tested restoration, RPO/RTO and incident response. The application ZIP cannot configure your cloud provider account by itself.
4. Configure ClamAV and private S3/MinIO in production. Production upload fails closed if scanning/storage is unavailable.
5. Complete institution-specific legal review: actual data controller/processor details, grievance contact, lawful bases, retention periods, child/guardian consent, processor/hosting disclosures, user-rights workflows and jurisdictional requirements. The included legal documents are templates, not legal guarantees.
6. Review camera RTSP secrets and move them to a managed secret store; implement biometric key rotation with a planned key version and re-encryption migration.
7. Reduce CSP `style-src 'unsafe-inline'` after frontend nonce/hash support is configured.
8. Run `pytest -q` in staging, `npm run lint`, `npm test`, dependency scans (`pip-audit`, `npm audit`), API authorization tests for every route, and an independent penetration test.
9. Verify existing v8.1 file paths and data: old local fee receipts, assignment attachments and on-duty letters are not automatically migrated to object storage by this update; migrate them with a controlled, checksummed job before deleting old copies.
10. Test admin MFA enrollment and recovery operationally. This release intentionally does not offer an unsafe MFA bypass; establish a verified, audited administrator recovery process before rollout.

## Status limits
Python syntax compilation was performed during packaging. Runtime tests, database integration tests, npm build, dependency vulnerability scans, cloud configuration checks, and penetration tests have not yet been run in this environment. Do not call this release production-certified until those checks pass.
