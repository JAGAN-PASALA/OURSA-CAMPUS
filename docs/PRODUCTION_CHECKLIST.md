# Production deployment checklist

## Required configuration

- Set `APP_ENV=production` and `SEED_DEMO_DATA=false`.
- Generate a random `APP_SECRET` of at least 32 characters.
- Generate a separate Fernet `BIOMETRIC_ENCRYPTION_KEY`; store both keys in a secrets manager, not Git or the ZIP.
- Set the exact public dashboard origin in `CORS_ORIGINS`.
- Configure a transactional SMTP provider and verify password-reset delivery, expiry and single-use behaviour.
- If SMS/WhatsApp is enabled, use an approved provider account, verified senders/templates, explicit recipient consent, and a tested opt-out/correction process.
- Keep demo seeding disabled and require users to change temporary passwords.
- Use a dedicated MySQL user with access only to this database.
- Keep platform-owner/team accounts separate from customer administrators; never reuse a customer account as a platform operator.

## Network and runtime

- Use the supplied Caddy service or another maintained reverse proxy/load balancer to terminate TLS.
- Serve the dashboard and `/api` through one HTTPS site so secure HttpOnly session cookies remain first-party.
- Keep MySQL private; require TLS if it crosses a host boundary.
- Do not publish development ports 5173/8000 or MySQL directly to the internet.
- Restrict API/docs exposure. FastAPI documentation is disabled automatically in production.
- Pin and scan container images/dependencies; rebuild for security updates.
- Run the API as the non-root container user already configured.
- Add central logs, uptime checks for `/api/health` and `/api/ready`, error alerting, CPU/RAM/GPU metrics, and disk/volume alerts.
- Supervise the separate camera worker, isolate camera credentials, restrict CCTV network access, and alert when any configured stream disconnects.

## Data operations

- Define retention periods for attendance, entry/exit events, behaviour episodes, incidents, uploaded coursework, notification records, feedback, audit logs, pose samples, and biometric templates.
- Automate encrypted database/model backups and prove restoration in a separate environment.
- Back up uploaded coursework with the same tenant isolation and restoration testing as database records.
- Preserve audit logs from administrator alteration using an external append-only log destination.
- Document key rotation. Rotating the biometric key requires decrypting/re-encrypting templates in a controlled maintenance job.
- Test institution search, cross-tenant access denial, database backups and domain routing before onboarding customers.
- Test the two-institution staff-transfer approval workflow; never retrieve career records from college name and employee number alone.
- Test the named-administrator support-consent flow, expiry and revocation; support access must stay read-only.
- Archive customer tenants before any removal. Permit permanent deletion only for verified empty test tenants after a tested backup.

## Security release gate

- Threat model the camera, browser, API, database, model supply chain, and administrator roles.
- Run SAST, dependency/container scanning, secret scanning, and an independent penetration test.
- Add your organisation's SSO/MFA provider before a high-risk or large deployment.
- Load test concurrent camera streams; move CPU/GPU inference to a queue/worker service when one API process is insufficient.
- Malware-scan uploaded coursework, place it in private object storage for multi-server deployments, and enforce the configured size/count/type limits at the proxy too.
- Review rate limits at the reverse proxy; the in-process login limiter is an additional local control, not a distributed limiter.

## AI release gate

- Use a consented, representative validation set that is completely separate from training data.
- Measure false match/false non-match rates for face recognition across relevant lighting, cameras, demographics, masks, and distances.
- Measure precision, recall, F1, and confusion matrices per action and subgroup.
- Test temporal stability and false-alert rates during full-length classes.
- Validate the one-minute behaviour threshold and sustained fight/crowd alert thresholds independently for every approved camera placement.
- Require staff review, record corrections, and prohibit automatic punishment or grading.
- Keep camera observations as supporting evidence only; do not use them as the sole measure of teacher quality or student intent.
- Run a monitored pilot with a documented rollback/disable switch.
- Train with grouped person/session/camera holdouts, inspect per-class recall and macro-F1, verify the candidate checksum, and require an explicit release approval before activation.

## Recurring operations

- Review security monthly: dependency advisories, access roles, tenant isolation, TLS/secrets, SMTP/provider delivery, backups/restores, audit alerts and open remediation items.
- Review platform support sessions and revoke anything that is no longer required.
- Review active versus candidate model versions and preserve rollback evidence.
