"""Create or promote the first platform administrator for a fresh deployment."""

from __future__ import annotations

import getpass
import re
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import select


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from auth import hash_password  # noqa: E402
from database import SessionLocal  # noqa: E402
from models import Institution, InstitutionDomain, User  # noqa: E402


def main() -> None:
    alembic = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.upgrade(alembic, "head")

    name = input("Platform organisation name [OUR'S Platform]: ").strip() or "OUR'S Platform"
    domain = input("Platform login domain [localhost]: ").strip().lower() or "localhost"
    if not re.fullmatch(r"[a-z0-9.-]+(?::[0-9]+)?", domain):
        raise SystemExit("Enter a hostname such as classroom.example.com or localhost")
    email = input("Platform administrator email: ").strip().lower()
    password = getpass.getpass("New password (minimum 12 characters): ")
    if "@" not in email or len(password) < 12:
        raise SystemExit("Enter a valid email and a password of at least 12 characters")

    with SessionLocal() as session:
        hostname = domain.split(":", 1)[0]
        domain_row = session.scalar(select(InstitutionDomain).where(InstitutionDomain.domain == hostname))
        institution = session.get(Institution, domain_row.institution_id) if domain_row else session.scalar(select(Institution).where(Institution.slug == "ours-platform"))
        if institution and institution.slug != "ours-platform":
            raise SystemExit("That domain is already assigned to a customer institution")
        if not institution:
            institution = Institution(name=name, slug="ours-platform", organization_type="platform", brand_name="OUR'S", primary_color="#242a45")
            session.add(institution)
            session.flush()
        if not domain_row:
            session.add(InstitutionDomain(institution_id=institution.id, domain=hostname, is_primary=True))
        user = session.scalar(select(User).where(User.institution_id == institution.id, User.email == email))
        if not user:
            user = User(institution_id=institution.id, name="Platform Administrator", email=email, password_hash=hash_password(password), role="admin", platform_admin=True)
            session.add(user)
        else:
            user.password_hash = hash_password(password)
            user.role = "admin"
            user.platform_admin = True
            user.active = True
            user.token_version += 1
        session.commit()
    print(f"Platform administrator ready. Sign in at https://{domain} (use http://localhost:5173 for local setup).")


if __name__ == "__main__":
    main()
