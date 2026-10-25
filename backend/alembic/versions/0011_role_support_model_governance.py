"""Add HOD-support and behaviour-model governance records.

Revision ID: 0011
Revises: 0010
"""

from alembic import op
import sqlalchemy as sa

from models import Base


revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def _columns(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _add(table_name: str, column: sa.Column) -> None:
    if column.name not in _columns(op.get_bind(), table_name):
        op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in ("support_sessions", "behaviour_model_versions"):
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)

    _add("behaviour_samples", sa.Column("dataset_version", sa.String(length=80), nullable=False, server_default="unversioned"))
    _add("behaviour_samples", sa.Column("subject_key", sa.String(length=120), nullable=True))
    _add("behaviour_samples", sa.Column("session_key", sa.String(length=160), nullable=True))
    _add("behaviour_samples", sa.Column("camera_key", sa.String(length=120), nullable=True))
    _add("behaviour_samples", sa.Column("track_id", sa.String(length=80), nullable=True))
    _add("behaviour_samples", sa.Column("review_status", sa.String(length=24), nullable=False, server_default="approved"))
    _add("behaviour_samples", sa.Column("consent_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add("institutions", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    _add("institutions", sa.Column("archived_by", sa.Integer(), nullable=True))
    if bind.dialect.name != "sqlite":
        existing_fks = {row.get("name") for row in sa.inspect(bind).get_foreign_keys("institutions")}
        if "fk_institutions_archived_by" not in existing_fks:
            op.create_foreign_key("fk_institutions_archived_by", "institutions", "users", ["archived_by"], ["id"], ondelete="SET NULL")

    inspector = sa.inspect(bind)
    existing_indexes = {row["name"] for row in inspector.get_indexes("behaviour_samples") if row.get("name")}
    for name, columns in (
        ("ix_behaviour_samples_dataset_version", ["dataset_version"]),
        ("ix_behaviour_samples_subject_key", ["subject_key"]),
        ("ix_behaviour_samples_session_key", ["session_key"]),
        ("ix_behaviour_samples_camera_key", ["camera_key"]),
        ("ix_behaviour_samples_review_status", ["review_status"]),
    ):
        if name not in existing_indexes:
            op.create_index(name, "behaviour_samples", columns)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in ("behaviour_model_versions", "support_sessions"):
        Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
    for name in (
        "ix_behaviour_samples_review_status",
        "ix_behaviour_samples_camera_key",
        "ix_behaviour_samples_session_key",
        "ix_behaviour_samples_subject_key",
        "ix_behaviour_samples_dataset_version",
    ):
        op.drop_index(name, table_name="behaviour_samples")
    for column in (
        "consent_verified",
        "review_status",
        "track_id",
        "camera_key",
        "session_key",
        "subject_key",
        "dataset_version",
    ):
        op.drop_column("behaviour_samples", column)
    if bind.dialect.name != "sqlite":
        op.drop_constraint("fk_institutions_archived_by", "institutions", type_="foreignkey")
    op.drop_column("institutions", "archived_by")
    op.drop_column("institutions", "archived_at")
