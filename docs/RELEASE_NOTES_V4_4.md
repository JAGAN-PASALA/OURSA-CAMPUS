# OUR'S Smart Classroom v4.4

## Departments, classes and terms

- Existing department names from older databases are recovered into the department list during migration `0007`.
- Recovered departments can be corrected with a real name, code and department email suffix.
- A new student must now have a department, matching class section and academic term; the API rejects unassigned student creation.
- Changing the department immediately refreshes the available class list.
- **Assign or move student** moves an existing student between classes for the selected term and automatically enrolls them in courses assigned to that class.

## Staff identities and faces

- Teachers, HODs, deans, principals, administrators and other staff can be entered with employee number, department and biometric-consent state.
- Staff can receive teaching access, administration access, or face-enrolment-only access with no dashboard login.
- Staff and students use separate encrypted face tables and can each capture three varied face samples.
- Matching starts after the first valid sample with an enrollment-aware threshold, reducing the immediate post-registration **Unknown** problem.

## Attendance and behaviour monitoring

- Attendance accumulation is restricted to students assigned to the selected class and exact academic term.
- The default present rule remains 80% of the scheduled class duration.
- A recognised logged-in teacher and recognised student can face the camera and raise a hand in the same frame to create an automatic, audited exit attendance approval.
- Health and manual exceptions remain explicit teacher permissions.
- The untrained behaviour state is shown as **calibration pending**, while pretrained pose, face and object detection remain available.
- Existing sustained fighting and crowd rules produce an in-browser sound alert after the configured duration.

## Teaching assignments and replacement

- A teacher assignment belongs to one course, class and term.
- A new semester receives a new assignment.
- **Replace assigned teacher** handles a staff departure during a term. Future timetable periods, scheduled classes, open tests and open coursework move to the replacement teacher; completed records remain unchanged.
- Duplicate active teacher assignments for the same course/class/term are rejected with a clear replacement instruction.

## Coursework and tests

- Teachers can draft and publish coursework for an assigned subject and class.
- Students in the exact class and term can submit once; the final answer is routed to the currently assigned subject teacher.
- Teachers can open the submission roster, enter marks and feedback, and students can see the returned result.
- Online tests remain server-timed and backend-scored, with required question count, common or separate marks, and optional correct-answer review.
- Assessment visibility and start permission now verify both class and academic term, preventing a student in another semester from opening the test.

## Validation completed

- 15 backend/API regression tests
- 5 frontend tests
- ESLint and production frontend build
- Python compilation
- Fresh migration through revision `0008`
- Upgrade migration from a v4.3 database through revisions `0007` and `0008`

Camera and behaviour predictions remain decision-support signals. Validate them with consented, representative data and retain teacher review for incidents and exceptions.
