"""Read-heavy public-result launch test.

Run only against an authorised staging environment with synthetic accounts.
Never point this at production or a third-party system.
"""

import os
import random

from locust import HttpUser, between, task


INSTITUTION_SLUG = os.environ.get("LOADTEST_INSTITUTION_SLUG", "")
STUDENT_EMAILS = [value for value in os.environ.get("LOADTEST_STUDENT_EMAILS", "").split(",") if value]
STUDENT_PASSWORD = os.environ.get("LOADTEST_STUDENT_PASSWORD", "")


class ResultsReader(HttpUser):
    wait_time = between(0.5, 2.0)

    def on_start(self):
        if not INSTITUTION_SLUG or not STUDENT_EMAILS or not STUDENT_PASSWORD:
            raise RuntimeError("Set LOADTEST_INSTITUTION_SLUG, LOADTEST_STUDENT_EMAILS and LOADTEST_STUDENT_PASSWORD")
        self.headers = {"X-Institution-Slug": INSTITUTION_SLUG}
        response = self.client.post(
            "/api/auth/login",
            headers=self.headers,
            json={"email": random.choice(STUDENT_EMAILS), "password": STUDENT_PASSWORD, "role": "student"},
            name="POST /api/auth/login",
        )
        if response.status_code != 200:
            response.failure(f"login failed: {response.status_code}")

    @task(5)
    def portal(self):
        self.client.get("/api/portal", headers=self.headers, name="GET /api/portal")

    @task(3)
    def dashboard(self):
        self.client.get("/api/dashboard", headers=self.headers, name="GET /api/dashboard")

    @task(1)
    def notifications(self):
        self.client.get("/api/me/notifications", headers=self.headers, name="GET /api/me/notifications")
