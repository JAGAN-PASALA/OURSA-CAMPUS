"""Add staff identities, replaceable teaching assignments and coursework.

Revision ID: 0008
Revises: 0007
"""
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

from models import Base


revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def _columns(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def _indexes(bind, table_name: str) -> set[str]:
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    if "started_at" not in _columns(bind, "teacher_assignments"):
        with op.batch_alter_table("teacher_assignments") as batch:
            batch.add_column(sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
            batch.add_column(sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True))
    if "teacher_assignment_id" not in _columns(bind, "assessments"):
        with op.batch_alter_table("assessments") as batch:
            batch.add_column(sa.Column("teacher_assignment_id", sa.Integer(), nullable=True))
            batch.create_foreign_key("fk_assessment_teacher_assignment", "teacher_assignments", ["teacher_assignment_id"], ["id"], ondelete="SET NULL")
    if "ix_assessments_teacher_assignment_id" not in _indexes(bind, "assessments"):
        op.create_index("ix_assessments_teacher_assignment_id", "assessments", ["teacher_assignment_id"])

    for table_name in ("staff_profiles", "staff_face_embeddings", "learning_assignments", "learning_submissions"):
        Base.metadata.tables[table_name].create(bind=bind, checkfirst=True)

    metadata = sa.MetaData()
    users = sa.Table("users", metadata, autoload_with=bind)
    staff = sa.Table("staff_profiles", metadata, autoload_with=bind)
    assignments = sa.Table("teacher_assignments", metadata, autoload_with=bind)
    assessments = sa.Table("assessments", metadata, autoload_with=bind)
    profiled_user_ids = set(bind.scalars(sa.select(staff.c.user_id)).all())
    for row in bind.execute(sa.select(users.c.id, users.c.institution_id, users.c.role).where(users.c.role.in_(["teacher", "admin"]))).all():
        if row.id not in profiled_user_ids:
            bind.execute(staff.insert().values(institution_id=row.institution_id, user_id=row.id, designation="teacher" if row.role == "teacher" else "administrator", biometric_consent=False, active=True))
    active_assignments: dict[tuple[int, int, int], list[int]] = {}
    for row in bind.execute(sa.select(assignments.c.id, assignments.c.course_id, assignments.c.section_id, assignments.c.term_id).where(assignments.c.active.is_(True)).order_by(assignments.c.id)).all():
        active_assignments.setdefault((row.course_id, row.section_id, row.term_id), []).append(row.id)
    for assignment_ids in active_assignments.values():
        for obsolete_id in assignment_ids[:-1]:
            bind.execute(assignments.update().where(assignments.c.id == obsolete_id).values(active=False, ended_at=datetime.now(timezone.utc)))
    for row in bind.execute(sa.select(assessments.c.id, assessments.c.course_id, assessments.c.section_id, assessments.c.created_by, assessments.c.teacher_assignment_id)).all():
        if row.teacher_assignment_id:
            continue
        assignment_id = bind.scalar(
            sa.select(assignments.c.id)
            .where(assignments.c.course_id == row.course_id, assignments.c.section_id == row.section_id, assignments.c.teacher_id == row.created_by)
            .order_by(assignments.c.active.desc(), assignments.c.id.desc())
            .limit(1)
        )
        if assignment_id:
            bind.execute(assessments.update().where(assessments.c.id == row.id).values(teacher_assignment_id=assignment_id))


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in ("learning_submissions", "learning_assignments", "staff_face_embeddings", "staff_profiles"):
        Base.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
    if "ix_assessments_teacher_assignment_id" in _indexes(bind, "assessments"):
        op.drop_index("ix_assessments_teacher_assignment_id", table_name="assessments")
    if "teacher_assignment_id" in _columns(bind, "assessments"):
        with op.batch_alter_table("assessments") as batch:
            batch.drop_constraint("fk_assessment_teacher_assignment", type_="foreignkey")
            batch.drop_column("teacher_assignment_id")
    if "started_at" in _columns(bind, "teacher_assignments"):
        with op.batch_alter_table("teacher_assignments") as batch:
            if "ended_at" in _columns(bind, "teacher_assignments"):
                batch.drop_column("ended_at")
            batch.drop_column("started_at")
