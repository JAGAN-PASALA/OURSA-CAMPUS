# Camera, email, SMS and WhatsApp setup

## Continuous camera monitoring

The dashboard camera stops when the browser closes. Use the separate worker for CCTV-style monitoring:

1. Publish the department/class/term timetable and use the exact classroom/room number in every timetable period. The dashboard stream is linked to this room; teachers do not choose a stale period from the camera screen.
2. Add `CAMERA_STREAMS_JSON` to the private `.env` file.
3. Start the API normally.
4. Run `start_camera_worker_windows.bat` and keep that terminal or the equivalent production service running.

One USB camera:

```env
CAMERA_STREAMS_JSON=[{"institution_slug":"your-college","classroom":"CSE-A","source":0}]
CAMERA_FRAME_INTERVAL_SECONDS=2
CAMPUS_TIMEZONE=Asia/Kolkata
```

Multiple authenticated IP cameras:

```env
CAMERA_STREAMS_JSON=[{"institution_slug":"your-college","classroom":"CSE-A","source":"rtsp://camera-user:camera-password@10.0.10.21:554/stream"},{"institution_slug":"your-college","classroom":"CSE-B","source":"rtsp://camera-user:camera-password@10.0.10.22:554/stream"}]
```

An old mobile phone can be used only after an approved IP-camera application exposes an RTSP or HTTP video-stream URL on the campus network. Put that stream URL in `source`. Keep the phone powered, disable battery optimisation for the camera app, use a stable Wi-Fi network, and restrict the stream so it is not public.

The institution slug and classroom must already exist and must match the timetable. The worker finds the active period and creates/opens that physical class session. During scheduled classes it records eligible presence and sustained behaviour. Outside scheduled classes, ordinary academic behaviour is disabled and the worker remains in safety-only mode.

The same room resolution is used by the browser/mobile **Live monitoring** screen. Select a room once, then the server uses `CAMPUS_TIMEZONE` and the current timetable start/end time to link each frame to the active period. The API also returns the campus time from `/api/health`; keep the server's `CAMPUS_TIMEZONE` set to the college's actual timezone rather than relying on the computer's clock.

## Cumulative attendance and anti-spoofing

Attendance is based on cumulative physical presence during that room's class session, not on a single face frame. A trusted body track can continue counting while a student looks down to write or a face is briefly occluded. The interval between trusted observations is credited up to `ATTENDANCE_PRESENCE_GAP_SECONDS` (default 600 seconds); longer gaps create an audited exit/re-entry pair rather than silently crediting the whole outage. At finalisation, the institution's configured threshold (normally 80%) is applied. The teacher view shows the observed percentage, required percentage, seconds observed/required and the shortfall, for example `79% · 1% below 80%`.

If a detected face is inside a detected phone screen, it is marked as a spoof rejection and cannot grant attendance. Camera failure or an empty observation window remains **Needs review**, never an automatic absence. Teachers can correct the final decision with a reason, and the correction is audited.

## Face-enrollment troubleshooting

- Record valid biometric consent first.
- Keep exactly one face clearly visible, facing the camera, with even lighting.
- Capture three varied angles. Recognition is enabled only after all three valid samples are stored.
- Student self-registration is available under **Profile**. Staff enrollment is available to authorised administrators/teachers.
- If the face matches another student or staff template above the duplicate threshold, registration is rejected with that identity for review.
- If a registered person still appears as Unknown, check camera distance/lighting, confirm the camera and account belong to the same institution, and capture additional consented samples. Do not simply lower the threshold without a measured false-match test.

## Forgot-password email

Add your transactional SMTP credentials to `.env`:

```env
FRONTEND_BASE_URL=https://portal.yourdomain.example
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_USERNAME=your-smtp-user
SMTP_PASSWORD=your-provider-app-password
SMTP_FROM_EMAIL=no-reply@yourdomain.example
SMTP_USE_TLS=true
```

Restart the backend, then use **Fees & services → Test password-reset email configuration**. A forgot-password request sends a single-use reset link that expires after 30 minutes. It never sends or reveals the old password. If SMTP is unavailable, an administrator can issue a temporary password through the account controls.

## Attendance SMS and WhatsApp

Provider delivery is off by default. The current provider adapter uses Twilio's approved API:

```env
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_SMS_FROM=your-approved-sender
TWILIO_WHATSAPP_FROM=whatsapp:+your-approved-number
SMS_ENABLED=true
WHATSAPP_ENABLED=true
```

Restart the backend after changing `.env`. Messages are considered only when attendance is finalised, a valid student/guardian phone exists, and the student's messaging-consent setting is enabled. Each channel attempt is recorded without exposing provider credentials. Provider approval, WhatsApp templates, country rules, recipient consent and opt-out handling remain required.

If a message is not delivered, check **Notifications** in the student portal and server/provider logs for `disabled`, `configuration_error`, `invalid_destination`, or `failed`. A provider failure never changes the saved attendance decision.
