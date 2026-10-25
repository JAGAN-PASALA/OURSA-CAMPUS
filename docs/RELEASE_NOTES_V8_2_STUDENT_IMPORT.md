# OUR'S Smart Classroom v8.2 — Complete Student Profile Import

## Included changes
- Adds a single master student import covering institution, name, admission and register numbers, DOB, gender, admission year, programme, department, batch, academic year, year of study, semester, class, section, blood group, mobile, email, parents/guardian, address and admission status.
- Supports CSV, XLSX and XLS input, common header aliases, row-level validation, and create-or-update matching.
- Adds optional photo ZIP upload (JPG/JPEG/PNG/WEBP), filename mapping by the `Profile Photo` column or admission/roll number, private storage, and an authenticated profile-photo endpoint.
- Adds persisted profile fields and migration `0015`.
- Keeps student submissions accessible through the existing teacher-scoped coursework workflow. Teachers may view/grade only coursework allocated to them; attachment downloads verify the same assignment ownership and institution boundary.

## Upgrade
1. Back up the database and private object storage.
2. Install backend requirements, including `xlrd==2.0.1` for legacy `.xls` files.
3. Apply Alembic migration `0015` using the project's normal migration process.
4. Restart backend and frontend.
5. Test preview and commit with a small copy of the college's data before importing live records.

## Important behaviour
- The institution column is checked against the signed-in institution; the server does not allow the spreadsheet to select a different tenant.
- New accounts use DOB in `DDMMYYYY` form as a temporary initial password and are flagged to change it. Colleges should communicate this only through their approved secure process and require password change at first sign-in.
- Blank cells do not erase existing values. Existing attendance, marks, fee transactions and historical enrolments are not recreated by the profile import.
- Photographs must be supplied in a ZIP; the workbook may reference filenames or use admission/roll numbers as image filenames. ZIP files are bounded and images are decoded before storage.
- Automated tests, frontend build/lint, live MySQL migration, ClamAV/object-storage integration and deployment verification must pass in the target environment before production use.
