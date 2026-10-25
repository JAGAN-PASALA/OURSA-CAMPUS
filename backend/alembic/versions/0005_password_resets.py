"""Add one-time password reset tokens.

Revision ID: 0005
Revises: 0004
"""
from alembic import op

from models import Base


revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.tables["password_reset_tokens"].create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    Base.metadata.tables["password_reset_tokens"].drop(bind=op.get_bind(), checkfirst=True)
