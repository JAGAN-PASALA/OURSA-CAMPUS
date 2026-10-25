#!/usr/bin/env python3
"""Fail-closed checks for the production environment file before deployment."""

from __future__ import annotations

import argparse
import base64
import binascii
from pathlib import Path
from urllib.parse import unquote, urlparse


REQUIRED = {
    "APP_SECRET",
    "BIOMETRIC_ENCRYPTION_KEY",
    "MYSQL_PASSWORD",
    "MYSQL_ROOT_PASSWORD",
    "DATABASE_URL",
    "PUBLIC_DOMAINS",
    "ACME_EMAIL",
    "FRONTEND_BASE_URL",
    "CORS_ORIGINS",
    "TRUSTED_HOSTS",
    "SHARED_PORTAL_HOSTS",
    "SMTP_HOST",
    "SMTP_FROM_EMAIL",
}
PLACEHOLDERS = {
    "change-me",
    "password",
    "replace-me",
    "secret",
    "url_encoded_password",
    "generate-a-random-value-of-at-least-32-characters",
}


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"Line {number} must use NAME=value syntax")
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key] = value
    return values


def split_values(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def public_https_origin(raw: str) -> bool:
    parsed = urlparse(raw)
    return bool(parsed.scheme == "https" and parsed.hostname and "." in parsed.hostname and not parsed.path.strip("/") and not parsed.query and not parsed.fragment)


def host_allowed(host: str, allowed: list[str]) -> bool:
    host = host.lower()
    return host in allowed or any(item.startswith("*.") and host.endswith(item[1:]) for item in allowed)


def validate(values: dict[str, str]) -> list[str]:
    errors: list[str] = []
    missing = sorted(key for key in REQUIRED if not values.get(key, "").strip())
    if missing:
        errors.append("Missing required values: " + ", ".join(missing))

    if values.get("APP_ENV", "production").lower() != "production":
        errors.append("APP_ENV must be production")
    if values.get("SEED_DEMO_DATA", "false").lower() != "false":
        errors.append("SEED_DEMO_DATA must be false")
    if values.get("ALLOW_MODEL_DOWNLOADS", "false").lower() != "false":
        errors.append("ALLOW_MODEL_DOWNLOADS must be false")
    if values.get("SESSION_COOKIE_DOMAIN", "").strip():
        errors.append("SESSION_COOKIE_DOMAIN must remain unset so cookies stay host-only")

    app_secret = values.get("APP_SECRET", "")
    if len(app_secret) < 32 or app_secret.strip().lower() in PLACEHOLDERS:
        errors.append("APP_SECRET must be a unique random value of at least 32 characters")

    biometric_key = values.get("BIOMETRIC_ENCRYPTION_KEY", "")
    try:
        decoded_key = base64.urlsafe_b64decode(biometric_key.encode())
        if len(decoded_key) != 32:
            raise ValueError
    except (ValueError, binascii.Error):
        errors.append("BIOMETRIC_ENCRYPTION_KEY must be a valid Fernet key")

    app_db_password = values.get("MYSQL_PASSWORD", "")
    root_db_password = values.get("MYSQL_ROOT_PASSWORD", "")
    for label, password in (("MYSQL_PASSWORD", app_db_password), ("MYSQL_ROOT_PASSWORD", root_db_password)):
        if len(password) < 16 or password.strip().lower() in PLACEHOLDERS:
            errors.append(f"{label} must be a unique value of at least 16 characters")
    if app_db_password and root_db_password and app_db_password == root_db_password:
        errors.append("MYSQL_PASSWORD and MYSQL_ROOT_PASSWORD must be different")

    database_url = values.get("DATABASE_URL", "")
    parsed_database = urlparse(database_url)
    if parsed_database.scheme != "mysql+pymysql" or parsed_database.hostname != "db" or not parsed_database.username or not parsed_database.password or not parsed_database.path.strip("/"):
        errors.append("DATABASE_URL must be an authenticated mysql+pymysql URL using Docker host 'db'")
    else:
        if unquote(parsed_database.password) != app_db_password:
            errors.append("DATABASE_URL password must match MYSQL_PASSWORD after URL decoding")
        if unquote(parsed_database.username) != values.get("MYSQL_USER", "ours_app"):
            errors.append("DATABASE_URL user must match MYSQL_USER")
        if parsed_database.path.strip("/") != values.get("MYSQL_DATABASE", "ours_classroom"):
            errors.append("DATABASE_URL database must match MYSQL_DATABASE")

    frontend = values.get("FRONTEND_BASE_URL", "")
    origins = split_values(values.get("CORS_ORIGINS", ""))
    if not public_https_origin(frontend):
        errors.append("FRONTEND_BASE_URL must be one public HTTPS origin without a path")
    if not origins or any(not public_https_origin(origin) for origin in origins):
        errors.append("Every CORS_ORIGINS entry must be a public HTTPS origin without a path")
    if frontend.rstrip("/") not in {origin.rstrip("/") for origin in origins}:
        errors.append("FRONTEND_BASE_URL must appear in CORS_ORIGINS")

    allowed_hosts = [item.lower() for item in split_values(values.get("TRUSTED_HOSTS", ""))]
    portal_hosts = [item.lower().split(":", 1)[0] for item in split_values(values.get("SHARED_PORTAL_HOSTS", ""))]
    domains = [item.lower() for item in split_values(values.get("PUBLIC_DOMAINS", ""))]
    if any("//" in host or "/" in host for host in allowed_hosts + portal_hosts + domains):
        errors.append("Domain/host settings must contain hostnames only, without schemes or paths")
    for host in portal_hosts + domains:
        if not host_allowed(host, allowed_hosts):
            errors.append(f"Host {host!r} must be covered by TRUSTED_HOSTS")

    username_set = bool(values.get("SMTP_USERNAME", "").strip())
    password_set = bool(values.get("SMTP_PASSWORD", "").strip())
    if username_set != password_set:
        errors.append("SMTP_USERNAME and SMTP_PASSWORD must either both be set or both remain unset")

    if values.get("PAYMENT_PROVIDER", "disabled") == "razorpay":
        for key in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"):
            if not values.get(key, "").strip():
                errors.append(f"{key} is required when Razorpay is enabled")
    if values.get("SMS_ENABLED", "false").lower() == "true" or values.get("WHATSAPP_ENABLED", "false").lower() == "true":
        for key in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"):
            if not values.get(key, "").strip():
                errors.append(f"{key} is required when SMS or WhatsApp is enabled")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", default=".env.production", type=Path)
    args = parser.parse_args()
    if not args.path.is_file():
        print(f"Production environment file not found: {args.path}")
        return 1
    try:
        errors = validate(load_env(args.path))
    except (OSError, ValueError) as exc:
        print(f"Could not read {args.path}: {exc}")
        return 1
    if errors:
        print("Production environment preflight failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Production environment preflight passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
