"""Class mentors, audited timetable changes, transactional push queue."""
from alembic import op
from models import Base
revision = "0012"
down_revision = "0011"
branch_labels = depends_on = None

def upgrade():
    for name in ("class_mentors", "timetable_changes", "push_jobs"):
        Base.metadata.tables[name].create(bind=op.get_bind(), checkfirst=True)

def downgrade():
    for name in ("push_jobs", "timetable_changes", "class_mentors"):
        Base.metadata.tables[name].drop(bind=op.get_bind(), checkfirst=True)
