"""Recover selectable departments from existing academic records.

Revision ID: 0007
Revises: 0006
"""
import re

from alembic import op
import sqlalchemy as sa


revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


STOP_WORDS = {"and", "of", "the", "department", "school", "faculty"}


def _department_code(label: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", label)
    significant = [word for word in words if word.casefold() not in STOP_WORDS]
    if len(significant) > 1:
        code = "".join(word[0] for word in significant)
    else:
        code = "".join(words)
    code = re.sub(r"[^A-Za-z0-9-]", "", code).upper()
    return (code or "DEPT")[:30]


def upgrade() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    institutions = sa.Table("institutions", metadata, autoload_with=bind)
    departments = sa.Table("departments", metadata, autoload_with=bind)
    students = sa.Table("students", metadata, autoload_with=bind)
    sections = sa.Table("class_sections", metadata, autoload_with=bind)

    institution_slugs = dict(bind.execute(sa.select(institutions.c.id, institutions.c.slug)).all())
    department_rows = [dict(row._mapping) for row in bind.execute(sa.select(departments)).all()]
    student_rows = [dict(row._mapping) for row in bind.execute(sa.select(students.c.id, students.c.institution_id, students.c.department, students.c.department_id)).all()]
    section_rows = [dict(row._mapping) for row in bind.execute(sa.select(sections.c.institution_id, sections.c.department)).all()]

    labels: dict[tuple[int, str], str] = {}
    for row in student_rows + section_rows:
        label = (row.get("department") or "").strip()
        if label:
            labels.setdefault((row["institution_id"], label.casefold()), label)

    for (institution_id, normalized_label), label in sorted(labels.items()):
        candidate_code = _department_code(label).casefold()
        existing = next(
            (
                row
                for row in department_rows
                if row["institution_id"] == institution_id
                and (
                    normalized_label in {(row["name"] or "").strip().casefold(), (row["code"] or "").strip().casefold()}
                    or candidate_code == (row["code"] or "").strip().casefold()
                )
            ),
            None,
        )
        if not existing:
            base_code = _department_code(label)
            code = base_code
            suffix = 2
            used_codes = {(row["code"] or "").casefold() for row in department_rows if row["institution_id"] == institution_id}
            while code.casefold() in used_codes:
                ending = str(suffix)
                code = f"{base_code[:30 - len(ending)]}{ending}"
                suffix += 1
            slug = re.sub(r"[^a-z0-9-]", "-", institution_slugs.get(institution_id, "institution").lower()).strip("-") or "institution"
            placeholder_domain = f"{code.lower()}.{slug}.invalid"
            result = bind.execute(
                departments.insert().values(
                    institution_id=institution_id,
                    name=label,
                    code=code,
                    email_domain=placeholder_domain,
                    active=True,
                )
            )
            existing = {
                "id": result.inserted_primary_key[0],
                "institution_id": institution_id,
                "name": label,
                "code": code,
                "email_domain": placeholder_domain,
                "active": True,
            }
            department_rows.append(existing)

        for student in student_rows:
            if (
                student["institution_id"] == institution_id
                and (student.get("department") or "").strip().casefold() == normalized_label
                and not student.get("department_id")
            ):
                bind.execute(students.update().where(students.c.id == student["id"]).values(department_id=existing["id"]))


def downgrade() -> None:
    # Backfilled rows may be in active use, so a downgrade preserves them.
    pass
