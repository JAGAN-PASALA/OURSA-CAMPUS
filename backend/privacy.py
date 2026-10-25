import base64
import hashlib
import json

from cryptography.fernet import Fernet, InvalidToken

from config import get_settings


def _fernet() -> Fernet:
    settings = get_settings()
    key = settings.biometric_encryption_key
    if not key:
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.app_secret.encode()).digest()).decode()
    return Fernet(key.encode())


def encrypt_embedding(values: list[float]) -> bytes:
    return _fernet().encrypt(json.dumps(values, separators=(",", ":")).encode())


def decrypt_embedding(payload: bytes) -> list[float]:
    try:
        return json.loads(_fernet().decrypt(payload).decode())
    except (InvalidToken, json.JSONDecodeError) as exc:
        raise ValueError("Stored biometric data could not be decrypted") from exc


def encrypt_secret(value: str) -> bytes:
    return _fernet().encrypt(value.encode())


def decrypt_secret(payload: bytes) -> str:
    try:
        return _fernet().decrypt(payload).decode()
    except (InvalidToken, UnicodeDecodeError) as exc:
        raise ValueError("Stored protected value could not be decrypted") from exc
