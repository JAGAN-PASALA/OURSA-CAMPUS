"""Private object storage and mandatory malware scanning for user uploads."""

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import hashlib
import hmac
import socket

import boto3
from botocore.client import Config

from config import get_settings


@dataclass(frozen=True)
class StoredObject:
    key: str
    size: int
    scan_status: str


def scan_bytes(payload: bytes) -> str:
    settings = get_settings()
    if not settings.clamav_host:
        return "clean" if not settings.is_production else "unavailable"
    try:
        with socket.create_connection((settings.clamav_host, settings.clamav_port), timeout=10) as stream:
            stream.sendall(b"zINSTREAM\0")
            for offset in range(0, len(payload), 64 * 1024):
                chunk = payload[offset : offset + 64 * 1024]
                stream.sendall(len(chunk).to_bytes(4, "big") + chunk)
            stream.sendall((0).to_bytes(4, "big"))
            response = stream.recv(4096).decode("utf-8", "replace")
    except OSError:
        return "unavailable"
    if "FOUND" in response:
        return "infected"
    return "clean" if response.rstrip("\x00\r\n ").endswith("OK") else "unavailable"


def _client():
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.object_storage_endpoint,
        aws_access_key_id=settings.object_storage_access_key,
        aws_secret_access_key=settings.object_storage_secret_key,
        region_name=settings.object_storage_region,
        use_ssl=settings.object_storage_secure,
        config=Config(signature_version="s3v4"),
    )


def put_private(key: str, payload: bytes, content_type: str) -> StoredObject:
    settings = get_settings()
    scan_status = scan_bytes(payload)
    if scan_status != "clean":
        raise ValueError("The upload could not pass malware scanning")
    if not settings.object_storage_endpoint and not settings.is_production:
        target = Path(__file__).resolve().parent / "data" / "private_objects" / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        return StoredObject(key=key, size=len(payload), scan_status=scan_status)
    _client().put_object(
        Bucket=settings.object_storage_bucket,
        Key=key,
        Body=BytesIO(payload),
        ContentLength=len(payload),
        ContentType=content_type,
        ServerSideEncryption="AES256",
    )
    return StoredObject(key=key, size=len(payload), scan_status=scan_status)


def verify_private(key: str, expected_sha256: str) -> bool:
    """Read back a private object and verify its content checksum."""
    local = local_path(key)
    if local:
        payload = local.read_bytes()
    else:
        response = _client().get_object(Bucket=get_settings().object_storage_bucket, Key=key)
        payload = response["Body"].read()
    actual = hashlib.sha256(payload).hexdigest()
    return hmac.compare_digest(actual, expected_sha256.lower())


def delete_private(key: str) -> None:
    """Delete a private object after a failed database transaction or approved retention action."""
    settings = get_settings()
    if not settings.object_storage_endpoint and not settings.is_production:
        path = Path(__file__).resolve().parent / "data" / "private_objects" / key
        path.unlink(missing_ok=True)
        return
    _client().delete_object(Bucket=settings.object_storage_bucket, Key=key)


def download_url(key: str, expires_seconds: int = 300) -> str:
    settings = get_settings()
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.object_storage_bucket, "Key": key},
        ExpiresIn=expires_seconds,
    )


def read_private(key: str) -> bytes:
    """Read a private object without exposing its storage URL."""
    local = local_path(key)
    if local:
        return local.read_bytes()

    response = _client().get_object(
        Bucket=get_settings().object_storage_bucket,
        Key=key,
    )
    body = response["Body"]
    try:
        return body.read()
    finally:
        body.close()


def local_path(key: str) -> Path | None:
    settings = get_settings()
    if settings.object_storage_endpoint:
        return None
    path = Path(__file__).resolve().parent / "data" / "private_objects" / key
    return path if path.is_file() else None


def storage_ready() -> bool:
    settings = get_settings()
    if not settings.object_storage_endpoint:
        return not settings.is_production
    try:
        _client().head_bucket(Bucket=settings.object_storage_bucket)
        return True
    except Exception:
        return False
