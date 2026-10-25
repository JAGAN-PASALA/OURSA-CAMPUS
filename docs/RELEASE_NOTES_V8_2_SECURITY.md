# OUR’S Smart Classroom v8.2 Security Update

This update is based on the saved v8.1 source ZIP and the combined security backlog.

## Source changes
- Requires explicit Terms of Use and Privacy Notice acceptance at sign-in and records the accepted version per account.
- Adds Terms and Privacy Notice pages. These are templates; they must be completed and reviewed for the deploying institution and applicable law.
- Adds mandatory TOTP MFA enrollment for college/platform administrators, encrypted MFA secret storage, one-time TOTP counter checks, rate-limited setup confirmation, and a setup-only restricted session before enrollment.
- Fixes Redis session-revocation lookup and fails closed for production rate limits/session checks when Redis is unavailable.
- Adds 30-minute idle session timeout, secure session tracking in Redis, and consistent session registration when tokens rotate.
- Removes account-wide hard lockout triggered by failed passwords to reduce attacker-induced account lockout; generic credential errors and IP rate limits remain.
- Rate-limits public institution search and password recovery endpoints.
- Hides OpenAPI schema in production and reduces health endpoint infrastructure disclosure.
- Routes fee receipts, assignment attachments and on-duty letters through the shared private upload service with malware scanning and private storage. Adds upload confirmation checkboxes for student assignment, receipt, on-duty and document uploads.
- Bounds file reads for on-duty letters and spreadsheet imports.
- Disables Android backup and removes the wildcard Cordova access origin.
- Adds a static route security inventory and a controlled migration script for legacy v8.1 uploads.
- Adds Redis authentication to the production Compose configuration.

## Upgrade steps
1. Back up the database, upload directories and object storage before upgrading.
2. Copy the updated application files; retain the existing database and required biometric key. Set a new independent `MFA_ENCRYPTION_KEY` for production and store it safely. Do not change existing keys without a key-rotation plan.
3. Add `REDIS_PASSWORD` to `.env.production`. Use a strong URL-safe value, or URL-encode reserved characters because it is embedded in `REDIS_URL`.
4. Existing administrators must enroll an authenticator during their next sign-in. A secure recovery process must be established before production use; this release intentionally has no authentication bypass.
5. Run the legacy upload migration in dry-run mode from the backend environment: `python scripts/migrate_legacy_uploads.py`. Back up first, verify the count, then run `python scripts/migrate_legacy_uploads.py --apply` after private object storage and ClamAV are configured. Old files are deleted only after the database commit succeeds.
6. Review `docs/API_SECURITY_INVENTORY.md` and `docs/SECURITY_UPGRADE_V8_2.md`.
7. Run the backend and frontend tests in the project's supported Python/Node environment before deployment.

## Not certified by this source-only update
Runtime tests, database integration tests, frontend build/lint, dependency vulnerability scans, TLS for internal Redis/MySQL/MinIO traffic, immutable external audit storage, off-site encrypted backups and restore drills, WAF/monitoring setup, biometric key rotation, camera secret-manager migration, final CSP nonce/hash work, independent penetration testing, and legal review remain required before a public launch.
