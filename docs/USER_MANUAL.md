# OUR'S Smart Classroom v8.0 — User Manual

## Start and sign in

On Windows, run `start_windows.bat` whenever the computer has restarted or the two application terminals were closed. Keep the backend and dashboard terminals open. Visit `http://localhost:5173`, search the institution name, select the institution and role, then enter the account email and password.

Every user changes their own password under **Security**. **Forgot password** sends a single-use link only when SMTP is configured and the message is accepted by the mail provider. Passwords cannot be viewed. An authorised administrator may issue a temporary password.

## Platform owner

- Provision, archive and restore institutions and assign domains.
- Create or reset the first customer administrator and platform-team accounts.
- Approve shared behaviour-model releases and view platform audit/system health.
- Request time-limited, college-approved, read-only support access; the owner cannot silently enter college operations.

## College administrator

1. Create departments and their email suffixes.
2. Create terms, class sections, staff, subjects and teacher allocations.
3. Create students manually or use **People → Import students safely**. Download the master template and upload CSV, XLSX, or XLS. One row contains the institution, student identity, personal/guardian details, admission data, programme, department, academic year, year of study, semester, class and section. The importer maps common alternative column headings, matches existing students by admission number (then email/roll number), and defaults to create-or-update. Blank cells preserve existing values. Preview all row-level errors before confirmation.
4. To set profile photographs in the same import operation, upload an optional ZIP containing JPG/JPEG/PNG/WEBP images. Put each filename in the `Profile Photo` column, or name the file after the student's admission number or roll number (for example `ADM2026001.jpg`). Images are validated, malware-scanned by the private upload service, and served only to the student, institution administrators, and authorized teaching staff.
5. Correct student/course/department details. Student identity fields are read-only to students by default; use **Allow permitted profile editing** only for phone, address and notification consent.
6. Under **Timetable**, assign the class mentor, then add periods manually or download/import the timetable template. Preview conflicts before confirmation. Archive/remove operations preserve recorded history.
7. Configure fees, announcements, consent, camera policy and account lifecycle.
8. Assign a department HOD and an institution dean/principal before students submit OD requests.

## Teacher, mentor, HOD and dean

- Teachers see only their allocated class/term subjects. Replacement moves future classes and open work, while completed history stays with the original teacher.
- Publish assignments and review typed or handwritten PDF/JPG/PNG submissions routed to the allocated subject teacher.
- Create offline or online tests. Online tests require question count, duration, common/per-question marks and the exact questions before publication. The system autosaves, times, scores objective answers and can show correct answers after final submission.
- Link monitoring by classroom. Attendance accumulates trusted physical observations per period, including configured gaps for writing/occlusion, and rejects phone-screen face observations.
- Before publishing attendance, review named Present, Absent, OD, Pending and Needs Review lists. Resolve raised-hand or camera-failure rows, then finalize. Later corrections require a reason and remain audited.
- OD requests move in order: class mentor → department HOD → dean/principal. The active reviewer opens **On duty**, checks the letter and approves/rejects. Final approval marks only covered periods as OD and preserves the original attendance status.

## Student

- Dashboard: assignments, exams, results, fees, announcements, timetable, attendance and subject/overall behaviour summaries.
- Profile: academic identity is protected. If the administrator grants permission, update only phone, address and notification consent. Face enrolment remains separate.
- Face registration: record consent, start the camera and save three clear, varied samples. The final message is **Face registration complete: 3/3 unique samples saved.** A duplicate face or poor frame is rejected.
- Assignment: open **Assignments**, attach handwritten PDF/JPG/PNG files if needed, and make the final submission before the due time.
- Test: open **Exams**, start a published eligible test, answer and submit. Results/correct answers appear according to teacher settings.
- OD: open **On duty**, enter dates and period numbers, reason, and upload the signed PDF/JPG/PNG letter. Track every approval stage and decision.

## Cameras and attendance

Browser/mobile camera is suitable for testing. For continuous CCTV/IP/mobile streams, configure the room stream in `.env` and run the camera worker. The room name must exactly match the published timetable classroom. During breaks, academic phone/sleep/talking records are not created; safety monitoring may continue.

Camera inference assists staff review. It must not independently impose discipline, diagnose health or decide teacher quality. WhatsApp/SMS requires an approved provider, templates where required and recipient consent.

## Safe shutdown and backup

Press `Ctrl+C` in the backend, dashboard and camera-worker terminals. Back up MySQL, `backend/data` uploads, model files, `.env` and the biometric encryption key together. Test restoration on another machine before production use.
