"""Replace legacy PJ demo tenant branding.

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa


revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    institutions = sa.table(
        "institutions",
        sa.column("slug", sa.String()),
        sa.column("name", sa.String()),
        sa.column("organization_type", sa.String()),
        sa.column("brand_name", sa.String()),
    )
    legacy = bind.execute(sa.select(institutions.c.slug).where(institutions.c.slug == "pj-demo")).scalar()
    current = bind.execute(sa.select(institutions.c.slug).where(institutions.c.slug == "ours-platform")).scalar()
    if legacy and not current:
        bind.execute(institutions.update().where(institutions.c.slug == "pj-demo").values(slug="ours-platform", name="OUR'S Platform", organization_type="platform", brand_name="OUR'S"))
    elif legacy:
        bind.execute(institutions.update().where(institutions.c.slug == "pj-demo").values(name="OUR'S Legacy Institution", brand_name="OUR'S"))


def downgrade() -> None:
    pass
