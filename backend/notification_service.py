"""Consent-aware SMS and WhatsApp delivery.

The application records every delivery attempt in the database. Provider calls are
made only when the matching channel is explicitly enabled and credentials exist.
"""
import base64
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from config import get_settings


settings = get_settings()


def normalize_phone(value: str) -> str:
    cleaned = "".join(character for character in value if character.isdigit() or character == "+")
    if cleaned.startswith("+"):
        return cleaned
    if len(cleaned) == 10:
        return f"+91{cleaned}"
    return f"+{cleaned}" if cleaned else ""


def mask_destination(value: str) -> str:
    normalized = normalize_phone(value)
    return f"***{normalized[-4:]}" if len(normalized) >= 4 else "***"


def send(channel: str, destination: str, body: str) -> tuple[str, str | None, str | None]:
    enabled = settings.sms_enabled if channel == "sms" else settings.whatsapp_enabled
    sender = settings.twilio_sms_from if channel == "sms" else settings.twilio_whatsapp_from
    if not enabled:
        return "disabled", None, f"{channel.upper()} delivery is disabled"
    if not settings.messaging_provider_enabled or not sender:
        return "configuration_error", None, "Messaging provider credentials or sender are missing"
    target = normalize_phone(destination)
    if not target:
        return "invalid_destination", None, "No valid destination number"
    if channel == "whatsapp":
        target = f"whatsapp:{target}"
        sender = sender if sender.startswith("whatsapp:") else f"whatsapp:{sender}"
    endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    payload = urlencode({"To": target, "From": sender, "Body": body}).encode()
    credentials = base64.b64encode(f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode()).decode()
    request = Request(endpoint, data=payload, headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    try:
        with urlopen(request, timeout=15) as response:
            data = json.loads(response.read().decode())
        return "sent", data.get("sid"), None
    except HTTPError as exc:
        return "failed", None, f"Provider rejected the message ({exc.code})"
    except (URLError, TimeoutError, ValueError) as exc:
        return "failed", None, str(exc)
