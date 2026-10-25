# MySQL setup

## Create the database and least-privileged application user

Run this in MySQL Workbench or the `mysql` client as an administrator. Replace the sample password.

```sql
CREATE DATABASE ours_classroom
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'ours_app'@'localhost'
  IDENTIFIED BY 'REPLACE_WITH_A_STRONG_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON ours_classroom.* TO 'ours_app'@'localhost';
FLUSH PRIVILEGES;
```

If the API runs on another server, use its private-network host instead of `%` whenever possible. Require TLS for remote database connections.

## Configure the project

Copy `.env.example` to `.env` in the project root and set:

```env
DATABASE_URL=mysql+pymysql://ours_app:URL_ENCODED_PASSWORD@127.0.0.1:3306/ours_classroom?charset=utf8mb4
```

URL-encode special password characters. For example, `@` becomes `%40` and `#` becomes `%23`.

Start/restart the backend. It applies migrations before serving requests:

```bash
cd backend
../.venv/bin/python run.py
```

To check the migration directly:

```bash
cd backend
../.venv/bin/python -m alembic -c alembic.ini current
```

The expected revision is `0008 (head)`.

## Where to inspect data

In MySQL Workbench, open **Schemas → ours_classroom → Tables**. Important tables:

| Table | Purpose |
|---|---|
| `institutions`, `institution_domains` | Customer organisations, login domains, and branding |
| `users`, `students`, `staff_profiles` | Student/staff accounts, roles, departments, and consent state |
| `courses`, `enrollments` | Courses, completion, and scores |
| `attendance` | Daily attendance decisions and confidence |
| `incidents` | Predictions requiring human review |
| `face_embeddings`, `staff_face_embeddings` | Encrypted student/staff face templates; never raw photos |
| `learning_assignments`, `learning_submissions` | Published coursework, final submissions, grades, and feedback |
| `behaviour_samples`, `model_meta` | Pose features and model validation metadata |
| `audit_logs` | Security and administrator activity |

Do not manually edit encrypted embeddings. Use the application consent/delete controls.

## Backup and restore test

Create encrypted/off-host backups according to your organisation policy. A basic database backup is:

```bash
mysqldump --single-transaction --routines --triggers ours_classroom > ours_classroom.sql
```

Test restoration regularly in a separate database:

```bash
mysql restored_ours_classroom < ours_classroom.sql
```

Back up the AI model volume/directory separately. Never consider a backup complete until a restoration test succeeds.
