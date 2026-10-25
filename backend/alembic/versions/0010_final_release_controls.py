"""Add final-release security, attendance, camera, notification and payment controls.

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa

from models import Base


revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


NEW_TABLES = [
    "attendance_corrections",
    "classroom_changes",
    "camera_worker_status",
    "push_devices",
    "fee_payments",
    "payment_webhook_events",
]


def _columns(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _indexes(bind, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    return {
        *(index["name"] for index in inspector.get_indexes(table_name) if index.get("name")),
        *(constraint["name"] for constraint in inspector.get_unique_constraints(table_name) if constraint.get("name")),
    }


def _foreign_keys(bind, table_name: str) -> set[str]:
    return {row["name"] for row in sa.inspect(bind).get_foreign_keys(table_name) if row.get("name")}


def _add(table_name: str, column: sa.Column) -> None:
    bind = op.get_bind()
    if column.name not in _columns(bind, table_name):
        op.add_column(table_name, column)


def _add_nullable_foreign_key(table_name: str, column_name: str, constraint_name: str) -> None:
    bind = op.get_bind()
    if column_name in _columns(bind, table_name):
        return
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table(table_name, recreate="always") as batch:
            batch.add_column(sa.Column(column_name, sa.Integer(), nullable=True))
            batch.create_foreign_key(constraint_name, "users", [column_name], ["id"], ondelete="SET NULL")
    else:
        op.add_column(table_name, sa.Column(column_name, sa.Integer(), nullable=True))
        op.create_foreign_key(constraint_name, table_name, "users", [column_name], ["id"], ondelete="SET NULL")


def upgrade() -> None:
    bind = op.get_bind()
    _add("institutions", sa.Column("biometric_retention_days", sa.Integer(), nullable=False, server_default="365"))
    _add("institutions", sa.Column("minor_guardian_consent_required", sa.Boolean(), nullable=False, server_default=sa.true()))
    _add("student_profiles", sa.Column("guardian_biometric_consent", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add("student_profiles", sa.Column("guardian_consent_recorded_at", sa.DateTime(timezone=True), nullable=True))

    _add("timetable_slots", sa.Column("publication_status", sa.String(length=24), nullable=False, server_default="published"))
    _add_nullable_foreign_key("timetable_slots", "proposed_by", "fk_timetable_proposed_by")
    _add_nullable_foreign_key("timetable_slots", "approved_by", "fk_timetable_approved_by")
    _add("timetable_slots", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    _add("timetable_slots", sa.Column("review_reason", sa.Text(), nullable=True))
    if "ix_timetable_slots_publication_status" not in _indexes(bind, "timetable_slots"):
        op.create_index("ix_timetable_slots_publication_status", "timetable_slots", ["publication_status"])
    if "ix_timetable_slots_proposed_by" not in _indexes(bind, "timetable_slots"):
        op.create_index("ix_timetable_slots_proposed_by", "timetable_slots", ["proposed_by"])

    _add("class_sessions", sa.Column("attendance_state", sa.String(length=24), nullable=False, server_default="draft"))
    _add("class_sessions", sa.Column("attendance_published_at", sa.DateTime(timezone=True), nullable=True))
    _add("class_sessions", sa.Column("camera_state", sa.String(length=24), nullable=False, server_default="unknown"))
    _add("class_sessions", sa.Column("failure_reason", sa.Text(), nullable=True))
    _add("class_sessions", sa.Column("temporary_classroom", sa.String(length=80), nullable=True))
    if "ix_class_sessions_attendance_state" not in _indexes(bind, "class_sessions"):
        op.create_index("ix_class_sessions_attendance_state", "class_sessions", ["attendance_state"])
    if "ix_class_sessions_camera_state" not in _indexes(bind, "class_sessions"):
        op.create_index("ix_class_sessions_camera_state", "class_sessions", ["camera_state"])

    _add("assessments", sa.Column("instructions", sa.Text(), nullable=True))
    _add("assessments", sa.Column("available_until", sa.DateTime(timezone=True), nullable=True))
    if "ix_assessments_available_until" not in _indexes(bind, "assessments"):
        op.create_index("ix_assessments_available_until", "assessments", ["available_until"])
    _add("face_embeddings", sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True))
    _add("staff_face_embeddings", sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True))
    _add("notification_deliveries", sa.Column("dedup_key", sa.String(length=160), nullable=True))
    if "ix_notification_deliveries_dedup_key" not in _indexes(bind, "notification_deliveries"):
        op.create_index("ix_notification_deliveries_dedup_key", "notification_deliveries", ["dedup_key"])
    if "uq_notification_dedup" not in _indexes(bind, "notification_deliveries"):
        op.create_index("uq_notification_dedup", "notification_deliveries", ["institution_id", "dedup_key"], unique=True)

    for table_name in NEW_TABLES:
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in reversed(NEW_TABLES):
        Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)

    op.drop_index("uq_notification_dedup", table_name="notification_deliveries")
    op.drop_index("ix_notification_deliveries_dedup_key", table_name="notification_deliveries")
    op.drop_column("notification_deliveries", "dedup_key")
    op.drop_column("staff_face_embeddings", "last_used_at")
    op.drop_column("face_embeddings", "last_used_at")
    op.drop_index("ix_assessments_available_until", table_name="assessments")
    op.drop_column("assessments", "available_until")
    op.drop_column("assessments", "instructions")

    op.drop_index("ix_class_sessions_camera_state", table_name="class_sessions")
    op.drop_index("ix_class_sessions_attendance_state", table_name="class_sessions")
    for column in ("temporary_classroom", "failure_reason", "camera_state", "attendance_published_at", "attendance_state"):
        op.drop_column("class_sessions", column)

    op.drop_index("ix_timetable_slots_proposed_by", table_name="timetable_slots")
    op.drop_index("ix_timetable_slots_publication_status", table_name="timetable_slots")
    op.drop_constraint("fk_timetable_approved_by", "timetable_slots", type_="foreignkey")
    op.drop_constraint("fk_timetable_proposed_by", "timetable_slots", type_="foreignkey")
    for column in ("review_reason", "approved_at", "approved_by", "proposed_by", "publication_status"):
        op.drop_column("timetable_slots", column)

    op.drop_column("student_profiles", "guardian_consent_recorded_at")
    op.drop_column("student_profiles", "guardian_biometric_consent")
    op.drop_column("institutions", "minor_guardian_consent_required")
    op.drop_column("institutions", "biometric_retention_days")
