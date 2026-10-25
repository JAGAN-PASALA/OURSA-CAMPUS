"""Hosted-payment adapter with signed webhook verification.

OUR'S stores only provider order/transaction identifiers. Card, CVV, UPI PIN
and banking credentials stay entirely within the approved hosted gateway.
"""
import base64
import hashlib
import hmac
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from config import get_settings


settings = get_settings()


def create_order(amount_rupees: float, receipt_reference: str, notes: dict[str, str]) -> dict:
    amount_paise = int(round(amount_rupees * 100))
    if amount_paise < 100:
        raise ValueError("Online payment must be at least INR 1.00")
    if settings.app_env.lower() == "test" and settings.payment_provider == "test":
        return {
            "provider": "test",
            "order_id": f"order_test_{uuid4().hex}",
            "public_key": "test_public_key",
            "amount_minor": amount_paise,
            "currency": settings.payment_currency,
        }
    if not settings.payment_enabled:
        raise RuntimeError("Online payment is not configured")
    payload = json.dumps({
        "amount": amount_paise,
        "currency": settings.payment_currency,
        "receipt": receipt_reference[:40],
        "notes": notes,
    }).encode()
    credentials = base64.b64encode(f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode()).decode()
    request = Request(
        "https://api.razorpay.com/v1/orders",
        data=payload,
        headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            result = json.loads(response.read().decode())
    except HTTPError as exc:
        raise RuntimeError(f"Payment provider rejected order creation ({exc.code})") from exc
    except (URLError, TimeoutError, ValueError) as exc:
        raise RuntimeError("Payment provider is temporarily unavailable") from exc
    return {
        "provider": "razorpay",
        "order_id": result["id"],
        "public_key": settings.razorpay_key_id,
        "amount_minor": result["amount"],
        "currency": result["currency"],
    }


def verify_razorpay_webhook(payload: bytes, signature: str | None) -> bool:
    if not signature or not settings.razorpay_webhook_secret:
        return False
    expected = hmac.new(settings.razorpay_webhook_secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def test_signature(payload: bytes, secret: str) -> str:
    """Used only by automated tests; never exposes configured production keys."""
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
