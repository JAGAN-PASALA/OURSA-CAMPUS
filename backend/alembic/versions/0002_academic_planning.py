"""Add physical-class planning and assessment records.

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

from models import Base


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


NEW_TABLES = [
    "academic_terms",
    "class_sections",
    "teacher_assignments",
    "section_memberships",
    "timetable_slots",
    "syllabus_units",
    "syllabus_topics",
    "class_sessions",
    "topic_coverage",
    "session_attendance",
    "assessments",
    "assessment_topics",
    "questions",
    "assessment_attempts",
    "student_answers",
    "assessment_results",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())
    for table_name in NEW_TABLES:
        if table_name not in existing:
            Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)
            existing.add(table_name)
    incident_columns = {column["name"] for column in sa.inspect(bind).get_columns("incidents")}
    if "class_session_id" not in incident_columns:
        with op.batch_alter_table("incidents") as batch:
            batch.add_column(sa.Column("class_session_id", sa.Integer(), nullable=True))
            batch.create_foreign_key("fk_incidents_class_session", "class_sessions", ["class_session_id"], ["id"], ondelete="SET NULL")
            batch.create_index("ix_incidents_class_session_id", ["class_session_id"])


def downgrade() -> None:
    bind = op.get_bind()
    incident_columns = {column["name"] for column in sa.inspect(bind).get_columns("incidents")}
    if "class_session_id" in incident_columns:
        with op.batch_alter_table("incidents") as batch:
            batch.drop_index("ix_incidents_class_session_id")
            batch.drop_constraint("fk_incidents_class_session", type_="foreignkey")
            batch.drop_column("class_session_id")
    existing = set(sa.inspect(bind).get_table_names())
    for table_name in reversed(NEW_TABLES):
        if table_name in existing:
            Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)

