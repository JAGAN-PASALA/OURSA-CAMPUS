"""Add the campus portal, presence, communication and career records.

Revision ID: 0009
Revises: 0008
"""
from alembic import op

from models import Base


revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


NEW_TABLES = [
    "staff_career_identities",
    "staff_career_service_records",
    "staff_transfer_requests",
    "student_profiles",
    "learning_submission_attachments",
    "behaviour_episodes",
    "classroom_presence_events",
    "raised_hand_attendance_requests",
    "announcements",
    "fee_records",
    "notification_deliveries",
    "teacher_feedback",
]


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in NEW_TABLES:
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in reversed(NEW_TABLES):
        Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
