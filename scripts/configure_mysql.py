"""Create a local MySQL database/user and safely update the project .env file."""

from __future__ import annotations

import getpass
import re
import secrets
from pathlib import Path
from urllib.parse import quote_plus

import pymysql
from cryptography.fernet import Fernet


PROJECT_ROOT = Path(__file__).resolve().parents[1]
IDENTIFIER = re.compile(r"^[A-Za-z0-9_]+$")


def prompt(label: str, default: str, secret: bool = False) -> str:
    suffix = f" [{default}]" if default and not secret else ""
    value = (getpass.getpass if secret else input)(f"{label}{suffix}: ").strip()
    return value or default


def valid_identifier(value: str, label: str) -> str:
    if not IDENTIFIER.fullmatch(value):
        raise ValueError(f"{label} may contain only letters, numbers, and underscores")
    return value


def update_env(values: dict[str, str]) -> None:
    env_path = PROJECT_ROOT / ".env"
    lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
    remaining = dict(values)
    output: list[str] = []
    for line in lines:
        key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else ""
        if key in remaining:
            output.append(f"{key}={remaining.pop(key)}")
        else:
            output.append(line)
    if output and output[-1]:
        output.append("")
    output.extend(f"{key}={value}" for key, value in remaining.items())
    env_path.write_text("\n".join(output).rstrip() + "\n", encoding="utf-8")


def main() -> None:
    print("\nOUR'S Smart Classroom — MySQL setup\n")
    host = prompt("MySQL host", "127.0.0.1")
    port = int(prompt("MySQL port", "3306"))
    root_user = prompt("MySQL administrator user", "root")
    root_password = prompt("MySQL administrator password", "", secret=True)
    database = valid_identifier(prompt("Database name", "ours_classroom"), "Database name")
    app_user = valid_identifier(prompt("Application database user", "ours_app"), "Application user")
    app_password = prompt("New application database password", "", secret=True) or secrets.token_urlsafe(24)

    admin = pymysql.connect(host=host, port=port, user=root_user, password=root_password, charset="utf8mb4", autocommit=True)
    try:
        with admin.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            for account_host in ("localhost", "127.0.0.1"):
                cursor.execute(f"CREATE USER IF NOT EXISTS '{app_user}'@'{account_host}' IDENTIFIED BY %s", (app_password,))
                cursor.execute(f"ALTER USER '{app_user}'@'{account_host}' IDENTIFIED BY %s", (app_password,))
                cursor.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON `{database}`.* TO '{app_user}'@'{account_host}'")
    finally:
        admin.close()

    test = pymysql.connect(host=host, port=port, user=app_user, password=app_password, database=database, charset="utf8mb4")
    test.close()
    database_url = f"mysql+pymysql://{quote_plus(app_user)}:{quote_plus(app_password)}@{host}:{port}/{database}?charset=utf8mb4"
    update_env({
        "APP_ENV": "development",
        "APP_SECRET": secrets.token_urlsafe(48),
        "SEED_DEMO_DATA": "false",
        "DATABASE_URL": database_url,
        "BIOMETRIC_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        "CORS_ORIGINS": "http://localhost:5173,http://localhost:3000",
        # Browsers use the current origin. Vite proxies /api locally and Caddy
        # proxies it in production, so no cross-origin API URL is required.
        "NEXT_PUBLIC_API_URL": "",
        "FRONTEND_BASE_URL": "http://localhost:5173",
    })
    print("\nMySQL is connected and .env has been updated.")
    if not prompt("Press Enter to hide the generated password, or type SHOW", "").upper() == "SHOW":
        print("Keep the .env file private. Now run start_windows.bat.")
    else:
        print(f"Application user: {app_user}\nApplication password: {app_password}\nKeep this password private.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, pymysql.MySQLError) as error:
        raise SystemExit(f"\nMySQL setup failed: {error}\nCheck that MySQL is running and the administrator password is correct.") from error
