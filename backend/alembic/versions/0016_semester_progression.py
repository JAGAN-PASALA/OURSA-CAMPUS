"""Add administrator-reviewed academic progression history."""
from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "academic_progression_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("institution_id", sa.Integer(), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_term_id", sa.Integer(), sa.ForeignKey("academic_terms.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("destination_term_id", sa.Integer(), sa.ForeignKey("academic_terms.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("destination_section_id", sa.Integer(), sa.ForeignKey("class_sections.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_academic_progression_batches_institution_id", "academic_progression_batches", ["institution_id"])

    op.create_table(
        "academic_progression_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("academic_progression_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_section_id", sa.Integer(), sa.ForeignKey("class_sections.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("batch_id", "student_id", name="uq_progression_batch_student"),
    )
    op.create_index("ix_academic_progression_records_batch_id", "academic_progression_records", ["batch_id"])
    op.create_index("ix_academic_progression_records_student_id", "academic_progression_records", ["student_id"])


def downgrade():
    op.drop_index("ix_academic_progression_records_student_id", table_name="academic_progression_records")
    op.drop_index("ix_academic_progression_records_batch_id", table_name="academic_progression_records")
    op.drop_table("academic_progression_records")
    op.drop_index("ix_academic_progression_batches_institution_id", table_name="academic_progression_batches")
    op.drop_table("academic_progression_batches")
