"""Firebase Cloud Messaging adapter.

Tokens are supplied by authenticated clients and encrypted before database
storage.  This module never logs tokens or service-account material.
"""
import json
from pathlib import Path
from threading import Lock

from config import get_settings


settings = get_settings()
_credentials = None
_credentials_lock = Lock()


def _service_account_info() -> dict | None:
    if settings.fcm_service_account_json:
        try:
            return json.loads(settings.fcm_service_account_json)
        except json.JSONDecodeError:
            return None
    if settings.fcm_service_account_file:
        path = Path(settings.fcm_service_account_file).expanduser()
        if path.is_file():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                return None
    return None


def enabled() -> bool:
    return bool(settings.fcm_project_id and _service_account_info())


def _access_token() -> str:
    global _credentials
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2 import service_account

    with _credentials_lock:
        if _credentials is None:
            info = _service_account_info()
            if not info:
                raise RuntimeError("FCM service-account credentials are not configured")
            _credentials = service_account.Credentials.from_service_account_info(
                info,
                scopes=["https://www.googleapis.com/auth/firebase.messaging"],
            )
        if not _credentials.valid or _credentials.expired:
            _credentials.refresh(GoogleRequest())
        return str(_credentials.token)


def send(token: str, title: str, body: str, data: dict[str, str]) -> tuple[str, str | None, str | None]:
    if not enabled():
        return "disabled", None, "Push delivery is not configured"
    import requests

    endpoint = f"https://fcm.googleapis.com/v1/projects/{settings.fcm_project_id}/messages:send"
    payload = {
        "message": {
            "token": token,
            "notification": {"title": title, "body": body},
            "data": {str(key): str(value) for key, value in data.items()},
            "webpush": {"fcm_options": {"link": settings.frontend_base_url.rstrip("/") + (data.get("deep_link", "/") if data.get("deep_link", "/").startswith("/?") else "/")}, "notification": {"tag": data.get("notification_id", "ours-update")}},
            "android": {"priority": "high"},
            "apns": {"payload": {"aps": {"sound": "default"}}},
        }
    }
    try:
        response = requests.post(
            endpoint,
            json=payload,
            headers={"Authorization": f"Bearer {_access_token()}"},
            timeout=15,
        )
        if response.status_code >= 400:
            if response.status_code == 404:
                details = response.json().get("error", {}).get("details", [])
                if any(d.get("errorCode") == "UNREGISTERED" for d in details):
                    return "invalid_token", None, "Device registration expired"
            return "failed", None, f"Push provider rejected the message ({response.status_code})"
        result = response.json()
        return "sent", result.get("name"), None
    except (OSError, ValueError, requests.RequestException, RuntimeError) as exc:
        return "failed", None, str(exc)
