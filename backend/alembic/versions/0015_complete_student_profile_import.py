"""Complete student profile fields used by the master import workflow."""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

COLUMNS = [
    ("gender", sa.String(length=30)),
    ("admission_year", sa.String(length=20)),
    ("program", sa.String(length=120)),
    ("admission_batch", sa.String(length=40)),
    ("current_academic_year", sa.String(length=30)),
    ("year_of_study", sa.String(length=40)),
    ("current_semester", sa.String(length=40)),
    ("class_name", sa.String(length=120)),
    ("section_name", sa.String(length=80)),
    ("father_name", sa.String(length=120)),
    ("mother_name", sa.String(length=120)),
    ("admission_status", sa.String(length=30)),
    ("profile_photo_storage_key", sa.String(length=500)),
]


def upgrade():
    bind = op.get_bind()
    existing = {column["name"] for column in sa.inspect(bind).get_columns("student_profiles")}
    for name, type_ in COLUMNS:
        if name not in existing:
            op.add_column("student_profiles", sa.Column(name, type_, nullable=True))
    student_columns = {column["name"] for column in sa.inspect(bind).get_columns("students")}
    if "admission_number" not in student_columns:
        op.add_column("students", sa.Column("admission_number", sa.String(length=80), nullable=True))
    student_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("students")}
    if "ix_students_admission_number" not in student_indexes:
        op.create_index("ix_students_admission_number", "students", ["admission_number"])
    constraints = {item.get("name") for item in sa.inspect(bind).get_unique_constraints("students")}
    if "uq_institution_student_admission" not in constraints:
        with op.batch_alter_table("students") as batch_op:
            batch_op.create_unique_constraint("uq_institution_student_admission", ["institution_id", "admission_number"])


def downgrade():
    bind = op.get_bind()
    constraints = {item.get("name") for item in sa.inspect(bind).get_unique_constraints("students")}
    if "uq_institution_student_admission" in constraints:
        with op.batch_alter_table("students") as batch_op:
            batch_op.drop_constraint("uq_institution_student_admission", type_="unique")
    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("students")}
    if "ix_students_admission_number" in indexes:
        op.drop_index("ix_students_admission_number", table_name="students")
    student_columns = {column["name"] for column in sa.inspect(bind).get_columns("students")}
    if "admission_number" in student_columns:
        op.drop_column("students", "admission_number")
    existing = {column["name"] for column in sa.inspect(bind).get_columns("student_profiles")}
    for name, _ in reversed(COLUMNS):
        if name in existing:
            op.drop_column("student_profiles", name)
