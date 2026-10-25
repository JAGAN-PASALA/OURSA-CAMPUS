"""Final operational controls: profile permission and on-duty workflow."""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = depends_on = None


def _columns(bind, table):
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade():
    bind = op.get_bind()
    if "self_edit_enabled" not in _columns(bind, "student_profiles"):
        op.add_column("student_profiles", sa.Column("self_edit_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    if not sa.inspect(bind).has_table("on_duty_requests"):
        op.create_table(
            "on_duty_requests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("institution_id", sa.Integer(), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("from_date", sa.Date(), nullable=False, index=True),
            sa.Column("to_date", sa.Date(), nullable=False, index=True),
            sa.Column("periods_json", sa.Text(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("attachment_name", sa.String(255)),
            sa.Column("attachment_path", sa.String(500)),
            sa.Column("status", sa.String(24), nullable=False, server_default="pending", index=True),
            sa.Column("current_stage", sa.String(24), nullable=False, server_default="mentor", index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("resolved_at", sa.DateTime(timezone=True)),
        )
        op.create_table(
            "on_duty_reviews",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("request_id", sa.Integer(), sa.ForeignKey("on_duty_requests.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("stage", sa.String(24), nullable=False, index=True),
            sa.Column("reviewer_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), index=True),
            sa.Column("decision", sa.String(24), nullable=False, server_default="pending", index=True),
            sa.Column("reason", sa.Text()),
            sa.Column("reviewed_at", sa.DateTime(timezone=True)),
            sa.UniqueConstraint("request_id", "stage", name="uq_od_request_stage"),
        )
    attendance_columns = _columns(bind, "session_attendance")
    if "od_request_id" not in attendance_columns:
        op.add_column("session_attendance", sa.Column("od_request_id", sa.Integer(), sa.ForeignKey("on_duty_requests.id", ondelete="SET NULL"), nullable=True))
        op.create_index("ix_session_attendance_od_request_id", "session_attendance", ["od_request_id"])
    if "od_original_status" not in attendance_columns:
        op.add_column("session_attendance", sa.Column("od_original_status", sa.String(20)))
    if "od_original_source" not in attendance_columns:
        op.add_column("session_attendance", sa.Column("od_original_source", sa.String(40)))


def downgrade():
    op.drop_column("session_attendance", "od_original_source")
    op.drop_column("session_attendance", "od_original_status")
    op.drop_index("ix_session_attendance_od_request_id", table_name="session_attendance")
    op.drop_column("session_attendance", "od_request_id")
    op.drop_table("on_duty_reviews")
    op.drop_table("on_duty_requests")
    op.drop_column("student_profiles", "self_edit_enabled")
