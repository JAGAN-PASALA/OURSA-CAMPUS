"""Add institution domains and tenant isolation.

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

from models import Base


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


TENANT_TABLES = ["users", "students", "courses", "academic_terms", "class_sections", "incidents", "audit_logs"]


def _columns(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    for table_name in ("institutions", "institution_domains"):
        if table_name not in existing:
            Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)
            existing.add(table_name)

    institutions = Base.metadata.tables["institutions"]
    domains = Base.metadata.tables["institution_domains"]
    default_id = bind.execute(sa.select(institutions.c.id).where(institutions.c.slug == "ours-platform")).scalar()
    if default_id is None:
        result = bind.execute(institutions.insert().values(name="OUR'S Platform", slug="ours-platform", organization_type="platform", brand_name="OUR'S", primary_color="#4f46c8", active=True))
        default_id = result.inserted_primary_key[0]
    if bind.execute(sa.select(domains.c.id).where(domains.c.domain == "localhost")).scalar() is None:
        bind.execute(domains.insert().values(institution_id=default_id, domain="localhost", is_primary=True, active=True))

    for table_name in TENANT_TABLES:
        if "institution_id" in _columns(bind, table_name):
            continue
        op.add_column(table_name, sa.Column("institution_id", sa.Integer(), nullable=True))
        bind.execute(sa.text(f"UPDATE {table_name} SET institution_id = :institution_id WHERE institution_id IS NULL"), {"institution_id": default_id})
        with op.batch_alter_table(table_name) as batch:
            batch.alter_column("institution_id", existing_type=sa.Integer(), nullable=False)
            batch.create_index(f"ix_{table_name}_institution_id", ["institution_id"])
            batch.create_foreign_key(f"fk_{table_name}_institution", "institutions", ["institution_id"], ["id"], ondelete="CASCADE")

    if "platform_admin" not in _columns(bind, "users"):
        op.add_column("users", sa.Column("platform_admin", sa.Boolean(), nullable=False, server_default=sa.false()))
    bind.execute(sa.text("UPDATE users SET platform_admin = :enabled WHERE institution_id = :institution_id AND role = 'admin' AND email = 'admin@example.com'"), {"enabled": True, "institution_id": default_id})


def downgrade() -> None:
    bind = op.get_bind()
    if "platform_admin" in _columns(bind, "users"):
        op.drop_column("users", "platform_admin")
    for table_name in reversed(TENANT_TABLES):
        if "institution_id" in _columns(bind, table_name):
            with op.batch_alter_table(table_name) as batch:
                batch.drop_constraint(f"fk_{table_name}_institution", type_="foreignkey")
                batch.drop_index(f"ix_{table_name}_institution_id")
                batch.drop_column("institution_id")
    for table_name in ("institution_domains", "institutions"):
        if table_name in set(sa.inspect(bind).get_table_names()):
            Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
