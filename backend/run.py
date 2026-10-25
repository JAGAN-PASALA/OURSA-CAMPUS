import os
from pathlib import Path

import uvicorn
from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url

from config import get_settings


def migrate() -> None:
    root = Path(__file__).resolve().parent
    alembic = Config(str(root / "alembic.ini"))
    alembic.set_main_option("script_location", str(root / "alembic"))
    command.upgrade(alembic, "head")


def ensure_database_directory() -> None:
    database = make_url(get_settings().database_url)
    if database.get_backend_name() == "sqlite" and database.database and database.database != ":memory:":
        path = Path(database.database)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent / path
        path.parent.mkdir(parents=True, exist_ok=True)


if __name__ == "__main__":
    settings = get_settings()
    settings.validate_runtime()
    ensure_database_directory()
    migrate()
    uvicorn.run(
        "main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "8000")),
        workers=int(os.getenv("API_WORKERS", "1")),
        proxy_headers=settings.is_production,
        forwarded_allow_ips=os.getenv("FORWARDED_ALLOW_IPS", "127.0.0.1"),
    )
