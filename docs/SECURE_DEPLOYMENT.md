# Secure multi-institution deployment

This guide is for a real internet deployment. `http://localhost:5173` is a local development address and must not be advertised to colleges.

## Architecture

- Caddy is the only public service and listens on ports 80/443.
- Caddy obtains HTTPS certificates and routes `/api/*` to FastAPI and all other paths to the dashboard.
- MySQL stays on an internal Docker network with no public port.
- API session cookies are host-only, HttpOnly, SameSite=Lax and Secure in production.
- Browser API calls use the same HTTPS origin as the dashboard. Do not configure a browser-visible direct API origin.
- The camera worker is separate from the web API and continues when no dashboard is open.

## Prerequisites

1. A maintained Linux server with Docker Engine and Compose.
2. Public DNS A/AAAA records for the shared portal and every tenant domain.
3. Firewall rules allowing only SSH from approved administrators and public HTTP/HTTPS.
4. A transactional SMTP account.
5. An approved payment/messaging provider if those optional features are enabled.
6. A protected method for cameras to reach the worker. Prefer a college-local edge worker or private VPN; do not expose CCTV streams directly to the internet.

## Configure secrets

Copy `.env.production.example` to `.env.production`. Do not commit or send the completed file.

Generate independent values:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Use the first value for `APP_SECRET` and the second for `BIOMETRIC_ENCRYPTION_KEY`. Use different strong MySQL root/application passwords and URL-encode the application password inside `DATABASE_URL`.

Set:

- `FRONTEND_BASE_URL=https://portal.yourdomain.example`
- `CORS_ORIGINS=https://portal.yourdomain.example`
- `SHARED_PORTAL_HOSTS=portal.yourdomain.example`
- `TRUSTED_HOSTS=portal.yourdomain.example,*.yourdomain.example`
- `PUBLIC_DOMAINS=portal.yourdomain.example,college1.yourdomain.example`
- real SMTP settings
- `ALLOW_MODEL_DOWNLOADS=false`

Every public customer domain must be present in DNS, `PUBLIC_DOMAINS` and `TRUSTED_HOSTS`, and registered to exactly one institution inside OUR'S. Adding it only in the dashboard is insufficient. Update and restart Caddy when domains change.

## Model assets

Production disables runtime model downloads. Place verified copies of these assets in the `ai_models` volume before starting cameras:

- `face_detection_yunet_2023mar.onnx`
- `face_recognition_sface_2021dec.onnx`
- `yolo11n-pose.pt`
- `yolo11n.pt`
- the validated shared `behaviour_classifier.joblib` when behaviour labels are enabled

Record checksums and source versions. Without a validated behaviour model, the application deliberately hides academic behaviour/fighting labels; face attendance and crowd counts remain separate capabilities.

## Deploy

After filling every required value in the private `.env.production`, validate interpolation first:

```bash
python scripts/validate_production_env.py .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml config
```

The Compose file passes only required application values to the API/camera containers; the MySQL root password is not injected into either application container.

Then start:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Create the first platform administrator from a one-off backend container or a protected management host. Never enable demo seeding in production.

Check:

- `https://portal.yourdomain.example/api/health`
- `https://portal.yourdomain.example/api/ready`
- HTTPS certificate/redirect and security headers
- password-reset delivery and link origin
- cross-tenant access rejection
- camera health/reconnect and no-camera **Needs review** fallback
- backup and restore

## Backups and data

Back up, encrypt and test restoration for:

- MySQL
- protected assignment submissions
- offline payment receipts
- shared validated model files
- encryption keys in a separate secrets backup

Losing `BIOMETRIC_ENCRYPTION_KEY` makes face templates unreadable. Exposing it compromises every template encrypted by that key. Plan controlled key rotation rather than replacing it casually.

## Operations

- Put the Compose stack under service supervision and collect structured Caddy/API/camera logs.
- Alert on `/api/ready`, camera staleness, MySQL health, disk usage and backup failures.
- Rate-limit at the edge/WAF; the API login limiter is an additional single-process defence.
- Apply OS/container/dependency patches in staging first and rerun the release gate.
- Keep camera and provider credentials in a secrets manager.
- Run malware scanning/private object storage for uploads before a large multi-server rollout.
- Complete a privacy/legal, penetration, bias/accuracy and full-classroom pilot before customer use.
- Keep platform accounts out of customer operations. Use only named, customer-approved, expiring read-only support sessions for troubleshooting tenant context.
- Promote shared behaviour-model candidates only after grouped holdout review, metric-gate approval and checksum verification.

## Mobile and other devices

Public/mobile browser camera access requires a valid HTTPS origin. Do not ask users to bypass a browser's “Not secure” warning. The included local HTTP launcher is only for development on the same trusted machine/network; customer traffic must use the Caddy HTTPS URL.
