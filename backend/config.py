from functools import lru_cache
import json
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import urlparse

from cryptography.fernet import Fernet
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "OUR'S Smart Classroom"
    app_env: str = "development"
    app_secret: str = "development-only-change-me-please"
    biometric_encryption_key: str | None = None
    mfa_encryption_key: str | None = None
    database_url: str = f"sqlite:///{(BACKEND_ROOT / 'data' / 'smart_classroom_v2.db').as_posix()}"
    db_pool_size: int = 20
    db_max_overflow: int = 30
    db_pool_timeout_seconds: int = 30
    db_pool_recycle_seconds: int = 1800
    redis_url: str | None = None
    cors_origins: str = "http://localhost:3000,http://localhost:4173,http://localhost:5173"
    trusted_hosts: str = "localhost,127.0.0.1,testserver"
    shared_portal_hosts: str = "localhost,127.0.0.1,testserver"
    session_cookie_name: str = "ours_session"
    session_cookie_domain: str | None = None
    access_token_minutes: int = 480
    seed_demo_data: bool = False
    max_upload_mb: int = 25
    assignment_max_files: int = 5
    object_storage_endpoint: str | None = None
    object_storage_access_key: str | None = None
    object_storage_secret_key: str | None = None
    object_storage_bucket: str = "ours-private"
    object_storage_region: str = "us-east-1"
    object_storage_secure: bool = True
    clamav_host: str | None = None
    clamav_port: int = 3310
    login_attempts_per_minute: int = 8
    face_match_threshold: float = 0.38
    face_duplicate_threshold: float = 0.32
    face_enrollment_samples: int = 3
    face_min_size_pixels: int = 80
    face_min_blur_variance: float = 45.0
    face_min_brightness: float = 35.0
    face_max_brightness: float = 225.0
    behaviour_confidence_threshold: float = 0.60
    behaviour_smoothing_frames: int = 6
    behaviour_episode_threshold_seconds: int = 60
    behaviour_dataset_version: str = "classroom-v1"
    behaviour_min_groups_per_class: int = 3
    behaviour_min_samples_per_class: int = 20
    behaviour_track_timeout_seconds: float = 6.0
    behaviour_class_thresholds_json: str = '{"attentive":0.65,"sleeping":0.75,"talking":0.78,"fighting":0.85,"mobile phone usage":0.82}'
    frontend_base_url: str = "http://localhost:5173"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_use_tls: bool = True
    require_smtp_in_production: bool = True
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_sms_from: str | None = None
    twilio_whatsapp_from: str | None = None
    sms_enabled: bool = False
    whatsapp_enabled: bool = False
    camera_streams_json: str = "[]"
    camera_frame_interval_seconds: float = 2.0
    camera_health_timeout_seconds: int = 20
    camera_reconnect_seconds: int = 3
    attendance_finalize_grace_seconds: int = 30
    # A person can be temporarily unrecognised while writing, looking down or
    # passing behind another student. Count the interval between two trusted
    # observations, up to this limit, instead of turning one missed frame into
    # an absence. The value is deliberately configurable per deployment.
    attendance_presence_gap_seconds: int = 600
    attendance_identity_grace_seconds: int = 30
    campus_timezone: str = "Asia/Kolkata"
    allow_model_downloads: bool = True
    payment_provider: str = "disabled"
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None
    payment_currency: str = "INR"
    fcm_project_id: str | None = None
    fcm_service_account_file: str | None = None
    fcm_service_account_json: str | None = None
    firebase_web_config: str = "{}"
    firebase_vapid_key: str = ""
    native_app_origins: str = "capacitor://localhost,https://localhost,http://localhost"
    smtp_use_ssl: bool = False
    jwt_issuer: str = "eduvision-api"
    jwt_audience: str = "eduvision-dashboard"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def allowed_hosts(self) -> list[str]:
        return [item.strip().lower() for item in self.trusted_hosts.split(",") if item.strip()]

    @property
    def portal_hosts(self) -> list[str]:
        return [item.strip().lower().split(":", 1)[0] for item in self.shared_portal_hosts.split(",") if item.strip()]

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_from_email)

    @property
    def messaging_provider_enabled(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token)

    @property
    def payment_enabled(self) -> bool:
        return self.payment_provider == "razorpay" and bool(self.razorpay_key_id and self.razorpay_key_secret and self.razorpay_webhook_secret)

    @property
    def behaviour_class_thresholds(self) -> dict[str, float]:
        try:
            values = json.loads(self.behaviour_class_thresholds_json)
        except (TypeError, ValueError, json.JSONDecodeError):
            values = {}
        return {
            str(label): max(0.0, min(1.0, float(threshold)))
            for label, threshold in values.items()
        }

    @staticmethod
    def _is_public_host(host: str | None) -> bool:
        if not host or host.lower() == "localhost":
            return False
        try:
            return not ip_address(host).is_private and not ip_address(host).is_loopback
        except ValueError:
            return "." in host and not host.endswith(".local")

    @classmethod
    def _validate_public_https_origin(cls, raw: str, label: str) -> None:
        parsed = urlparse(raw)
        if parsed.scheme != "https" or not cls._is_public_host(parsed.hostname) or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
            raise RuntimeError(f"{label} must be an approved public HTTPS origin without a path in production")

    def validate_runtime(self) -> None:
        if self.is_production:
            forbidden_app_secrets = {"development-only-change-me-please", "generate-a-random-value-of-at-least-32-characters", "replace-me"}
            if self.app_secret.strip().lower() in forbidden_app_secrets or len(self.app_secret) < 32:
                raise RuntimeError("APP_SECRET must be a random value of at least 32 characters in production")
            if not self.biometric_encryption_key:
                raise RuntimeError("BIOMETRIC_ENCRYPTION_KEY is required in production")
            try:
                Fernet(self.biometric_encryption_key.encode())
            except (TypeError, ValueError) as exc:
                raise RuntimeError("BIOMETRIC_ENCRYPTION_KEY must be a valid Fernet key") from exc
            if not self.mfa_encryption_key:
                raise RuntimeError("MFA_ENCRYPTION_KEY is required in production")
            try:
                Fernet(self.mfa_encryption_key.encode())
            except (TypeError, ValueError) as exc:
                raise RuntimeError("MFA_ENCRYPTION_KEY must be a valid Fernet key") from exc
            if self.seed_demo_data:
                raise RuntimeError("SEED_DEMO_DATA must be false in production")
            try:
                database = make_url(self.database_url)
            except Exception as exc:
                raise RuntimeError("DATABASE_URL must be a valid MySQL connection URL") from exc
            if database.get_backend_name() != "mysql" or not all((database.username, database.password, database.host, database.database)):
                raise RuntimeError("Production must use an authenticated central MySQL database URL")
            if not self.redis_url or not self.redis_url.startswith(("redis://", "rediss://")):
                raise RuntimeError("REDIS_URL is required in production for distributed rate limits, locks and caching")
            if not all((self.object_storage_endpoint, self.object_storage_access_key, self.object_storage_secret_key, self.object_storage_bucket)):
                raise RuntimeError("Private object-storage settings are required in production")
            if not self.clamav_host:
                raise RuntimeError("CLAMAV_HOST is required in production so uploaded files are scanned")
            weak_database_passwords = {"secret", "password", "url_encoded_password", "replace-me"}
            if len(database.password or "") < 12 or (database.password or "").strip().lower() in weak_database_passwords:
                raise RuntimeError("The production MySQL application password must be a strong unique value of at least 12 characters")
            self._validate_public_https_origin(self.frontend_base_url, "FRONTEND_BASE_URL")
            if not self.allowed_origins:
                raise RuntimeError("CORS_ORIGINS must contain the approved frontend HTTPS origin")
            for origin in self.allowed_origins:
                self._validate_public_https_origin(origin, "CORS_ORIGINS")
            if self.frontend_base_url.rstrip("/") not in {origin.rstrip("/") for origin in self.allowed_origins}:
                raise RuntimeError("FRONTEND_BASE_URL must be present in CORS_ORIGINS")
            if not self.allowed_hosts or any(host in {"*", "localhost", "127.0.0.1", "::1"} for host in self.allowed_hosts):
                raise RuntimeError("TRUSTED_HOSTS must list only approved production hostnames")
            if not self.portal_hosts or any(not self._is_public_host(host) for host in self.portal_hosts):
                raise RuntimeError("SHARED_PORTAL_HOSTS must list the public portal hostname(s) in production")
            for host in self.portal_hosts:
                if host not in self.allowed_hosts and not any(item.startswith("*.") and host.endswith(item[1:]) for item in self.allowed_hosts):
                    raise RuntimeError("Every SHARED_PORTAL_HOSTS entry must also be allowed by TRUSTED_HOSTS")
            if self.require_smtp_in_production and not self.email_enabled:
                raise RuntimeError("SMTP settings are required in production for account recovery")
            if bool(self.smtp_username) != bool(self.smtp_password):
                raise RuntimeError("SMTP_USERNAME and SMTP_PASSWORD must either both be set or both remain unset")
            if self.session_cookie_domain:
                raise RuntimeError("SESSION_COOKIE_DOMAIN must remain unset so production sessions are host-only")
            if self.payment_provider not in {"disabled", "razorpay"}:
                raise RuntimeError("PAYMENT_PROVIDER must be disabled or razorpay")
            if self.payment_provider == "razorpay" and not self.payment_enabled:
                raise RuntimeError("Razorpay key ID, key secret and webhook secret are required when payments are enabled")
            if self.allow_model_downloads:
                raise RuntimeError("ALLOW_MODEL_DOWNLOADS must be false in production; install and verify model assets before startup")


@lru_cache
def get_settings() -> Settings:
    return Settings()
