"""Shared Redis primitives used by every API replica."""

from functools import lru_cache

from redis import Redis
from redis.exceptions import RedisError

from config import get_settings


@lru_cache
def redis_client() -> Redis | None:
    url = get_settings().redis_url
    return Redis.from_url(url, decode_responses=True, socket_timeout=2) if url else None


def fixed_window_allow(key: str, limit: int, seconds: int) -> bool:
    """Atomic cross-replica rate limit. Development may run without Redis."""
    client = redis_client()
    settings = get_settings()
    if client is None:
        # Never silently disable abuse controls in production.
        return not settings.is_production
    try:
        # INCR and initial expiry must be atomic so a crash cannot leave a
        # permanent counter that blocks the key forever.
        value = int(client.eval(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",
            1, key, seconds,
        ))
        return value <= limit
    except RedisError:
        # Fail closed for protected operations if the shared limiter is down.
        return not settings.is_production


def revoke_session(jti: str, ttl_seconds: int) -> None:
    client = redis_client()
    if client:
        client.setex(f"revoked:{jti}", ttl_seconds, "1")


def touch_session(jti: str, idle_ttl_seconds: int) -> bool:
    client = redis_client()
    if client is None:
        return not get_settings().is_production
    try:
        key = f"session-active:{jti}"
        if not client.exists(key):
            return False
        client.expire(key, idle_ttl_seconds)
        return True
    except RedisError:
        return not get_settings().is_production


def start_session(jti: str, ttl_seconds: int) -> bool:
    client = redis_client()
    if client is None:
        return not get_settings().is_production
    try:
        client.setex(f"session-active:{jti}", ttl_seconds, "1")
        return True
    except RedisError:
        return not get_settings().is_production


def session_is_revoked(jti: str | None) -> bool:
    client = redis_client()
    if not jti:
        return False
    if client is None:
        # With no revocation store, production must not treat sessions as valid.
        return get_settings().is_production
    try:
        return bool(client.exists(f"revoked:{jti}"))
    except RedisError:
        return get_settings().is_production


def redis_ready() -> bool:
    client = redis_client()
    if client is None:
        return not get_settings().is_production
    try:
        return bool(client.ping())
    except RedisError:
        return False
