# OUR'S Smart Classroom v4.3

> Historical release note: v6 supersedes the first-sample recognition behaviour below and now requires three valid varied samples before recognition is enabled.

## Operations and corrections

- Institution administrators can correct student names, email addresses, register numbers, departments, course names/codes, and academic term details.
- Departments have a unique code and email domain. Entering only a student email username automatically appends the selected department domain.
- Duplicate institution email addresses, register numbers, department codes/domains, course codes, enrollments, assignments, and section memberships return a clear `already exists` conflict instead of creating a second record.

## Assessments

- Online tests require a question count before the draft is created.
- Teachers select common marks for every question or separate marks for each question.
- A draft cannot be published until the exact question count has been added.
- Student attempts include a server-calculated end time and dashboard countdown, and are automatically submitted by the interface when time expires.
- MCQ, True/False, and exact-match short answers are automatically evaluated by the backend.
- Students can reopen submitted results and see their answer and the correct answer when answer review is enabled.
- Teachers can open a class result roster. Offline test marks continue to be entered manually.

## Attendance, face recognition, and safety

- A valid first face sample is now immediately available for recognition; three varied angles remain recommended for reliability.
- Attendance accumulates recognised presence time against the physical timetable period. The default rule is present for at least 80% of the class.
- Teachers can approve audited attendance exceptions for a raised-hand exit, health reason, or manual confirmation, then finalise the class attendance.
- A sustained fighting prediction triggers an in-browser sound after 120 continuous seconds by default.
- A configurable crowd threshold triggers an in-browser sound after its configured duration.
- All thresholds are editable under Administration → College accounts.

## Analytics

- Student dashboards show overall attendance as a pie/donut chart.
- Subject cards combine attendance, assessment average, and behaviour distribution.
- Overall and subject-level behaviour includes attentive, sleeping, talking, fighting, and detected phone use when observations exist.

## Validation completed

- 12 backend/API tests
- 5 frontend tests
- ESLint
- Production frontend build
- Fresh Alembic migration through revision `0006`
- Fresh backend startup and health check

Camera predictions are decision-support signals. Institutions should validate accuracy on representative, consented classroom data and keep a teacher in the decision loop for attendance exceptions and behaviour incidents.
