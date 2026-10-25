"""Add departments, assessment controls, attendance duration and behaviour analytics.

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa

from models import Base


revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def _columns(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _add(table_name: str, column: sa.Column) -> None:
    bind = op.get_bind()
    if column.name not in _columns(bind, table_name):
        op.add_column(table_name, column)


def _add_foreign_key_column(table_name: str, column_name: str, referred_table: str, constraint_name: str) -> None:
    bind = op.get_bind()
    if column_name in _columns(bind, table_name):
        return
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table(table_name, recreate="always") as batch:
            batch.add_column(sa.Column(column_name, sa.Integer(), nullable=True))
            batch.create_foreign_key(constraint_name, referred_table, [column_name], ["id"], ondelete="SET NULL")
    else:
        op.add_column(table_name, sa.Column(column_name, sa.Integer(), nullable=True))
        op.create_foreign_key(constraint_name, table_name, referred_table, [column_name], ["id"], ondelete="SET NULL")


def upgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    for table_name in ("departments", "behaviour_observations"):
        if table_name not in existing:
            Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)

    _add("institutions", sa.Column("attendance_required_percent", sa.Integer(), nullable=False, server_default="80"))
    _add("institutions", sa.Column("fight_alert_seconds", sa.Integer(), nullable=False, server_default="120"))
    _add("institutions", sa.Column("crowd_threshold", sa.Integer(), nullable=False, server_default="40"))
    _add("institutions", sa.Column("crowd_alert_seconds", sa.Integer(), nullable=False, server_default="30"))
    _add_foreign_key_column("students", "department_id", "departments", "fk_students_department_id")

    _add("session_attendance", sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=True))
    _add("session_attendance", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    _add("session_attendance", sa.Column("observed_seconds", sa.Float(), nullable=False, server_default="0"))
    _add("session_attendance", sa.Column("required_seconds", sa.Float(), nullable=False, server_default="0"))
    _add("session_attendance", sa.Column("attendance_percent", sa.Float(), nullable=False, server_default="0"))
    _add("session_attendance", sa.Column("decision_source", sa.String(length=40), nullable=False, server_default="camera"))
    _add("session_attendance", sa.Column("exemption_reason", sa.Text(), nullable=True))
    _add_foreign_key_column("session_attendance", "approved_by", "users", "fk_session_attendance_approved_by")
    _add("session_attendance", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))

    _add("assessments", sa.Column("question_count", sa.Integer(), nullable=False, server_default="0"))
    _add("assessments", sa.Column("marking_mode", sa.String(length=20), nullable=False, server_default="separate"))
    _add("assessments", sa.Column("common_marks", sa.Float(), nullable=True))
    _add("assessments", sa.Column("show_correct_answers", sa.Boolean(), nullable=False, server_default=sa.true()))

    _add("incidents", sa.Column("duration_seconds", sa.Float(), nullable=False, server_default="0"))
    _add("incidents", sa.Column("alert_triggered", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    for table_name, columns in (
        ("incidents", ["alert_triggered", "duration_seconds"]),
        ("assessments", ["show_correct_answers", "common_marks", "marking_mode", "question_count"]),
        ("session_attendance", ["approved_at", "approved_by", "exemption_reason", "decision_source", "attendance_percent", "required_seconds", "observed_seconds", "last_seen_at", "first_seen_at"]),
        ("students", ["department_id"]),
        ("institutions", ["crowd_alert_seconds", "crowd_threshold", "fight_alert_seconds", "attendance_required_percent"]),
    ):
        for column in columns:
            if column in _columns(op.get_bind(), table_name):
                op.drop_column(table_name, column)
    for table_name in ("behaviour_observations", "departments"):
        Base.metadata.tables[table_name].drop(bind=op.get_bind(), checkfirst=True)
