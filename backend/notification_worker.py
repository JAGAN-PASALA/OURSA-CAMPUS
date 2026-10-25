"""Deliver committed push jobs; run independently of the camera worker."""
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
import database as db
import push_service
from models import PushJob, PushDevice, NotificationDelivery, User, Institution
from privacy import decrypt_secret


def deliver_batch(limit=50):
    completed = 0
    for _ in range(limit):
        with db.session_scope() as session:
            now = datetime.now(timezone.utc)
            job = session.scalar(select(PushJob).where(PushJob.next_attempt_at <= now).order_by(PushJob.id).limit(1).with_for_update(skip_locked=True))
            if not job:
                break
            delivery, device = session.get(NotificationDelivery, job.delivery_id), session.get(PushDevice, job.device_id)
            user = session.get(User, delivery.user_id) if delivery else None
            institution = session.get(Institution, delivery.institution_id) if delivery else None
            if not delivery or not device or not device.active or not user or not user.active or not institution or not institution.active or device.user_id != delivery.user_id or device.institution_id != delivery.institution_id:
                if delivery:
                    delivery.status = "cancelled"
                session.delete(job)
                continue
            payload = json.loads(delivery.payload_json or "{}")
            try:
                status, provider_id, error = push_service.send(decrypt_secret(device.encrypted_token), "OUR'S Smart Classroom", payload.get("message", "New update"), {"template": delivery.template, "deep_link": payload.get("deep_link", "/"), "notification_id": str(delivery.id)})
            except Exception:
                status, provider_id, error = "failed", None, "Push delivery failed; check provider configuration"
            job.attempts += 1
            delivery.provider_message_id, delivery.error = provider_id, error
            if status == "sent":
                delivery.status, delivery.sent_at = "sent", now
                session.delete(job)
                completed += 1
            elif status == "invalid_token":
                device.active, delivery.status = False, "failed"
                session.delete(job)
            elif job.attempts >= 6:
                delivery.status = "failed"
                session.delete(job)
            else:
                delivery.status = "queued"
                job.next_attempt_at = now + timedelta(seconds=min(3600, 30 * 2 ** job.attempts))
    return completed


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    db.init_database()
    while True:
        try:
            deliver_batch()
        except Exception:
            logging.error("Notification worker iteration failed; retrying")
        time.sleep(5)
