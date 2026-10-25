# OUR'S v8 public launch gate

Version 8 is a production release candidate. Passing the repository tests is necessary, but it is not evidence that one server can safely serve 100,000 simultaneous users.

## Implemented launch foundations

- Host-only secure session cookies, tenant resolution and server-side authorization.
- Forced replacement of initial DOB or administrator-issued credentials.
- Cross-replica Redis login throttling plus database-backed account lockout.
- MySQL connection-pool controls and health/readiness checks.
- Private S3-compatible document storage, short-lived downloads and ClamAV scanning.
- Bulk offline-result template, validation preview, approval/publish and audit events.
- Student document upload/download with student, assigned-teacher, HOD/dean and administrator authorization.
- Institution logo storage and public logo delivery without exposing the private bucket.
- Automatic timetable-period attendance finalization, camera-failure protection and correction history.
- People remain visible to face recognition even when pose keypoints are insufficient for behaviour classification.

## Mandatory deployment for the 100,000-concurrent objective

Use a managed MySQL cluster with read replicas, managed Redis, private object storage, a queue/worker tier, multiple API and frontend replicas, an L7 load balancer/WAF, CDN, centralized logs/metrics/traces, autoscaling, and tested backups. Camera inference must run on separate campus/edge workers; never send every CCTV frame through the public web API.

Run `loadtest/locustfile.py` in an authorised staging environment, gradually increasing traffic. Define and meet service objectives before launch. A 100,000-user claim may be made only after an independent load report on the real production topology.

## Release blockers outside source code

1. Independent penetration test and remediation.
2. Dependency, container, secret and static-code scans in CI.
3. Backup restoration and disaster-recovery exercise.
4. SMTP domain authentication (SPF, DKIM and DMARC) and reset-email delivery tests.
5. Privacy/legal review for biometric and minor data, institution contracts, consent and retention policy.
6. Representative classroom accuracy/bias evaluation and a supervised pilot. Camera output must not be the sole basis for discipline, attendance correction or teacher appraisal.
7. Signed messaging-provider approval and consent before enabling SMS or WhatsApp.

## Business launch recommendation

Launch in stages: one supervised campus, then a small multi-college cohort, then regional scale. Offer institution onboarding, migration assistance, administrator training, a support SLA, incident communication, retention/export terms and an exit/data-deletion process. Use feature flags to disable camera or behaviour processing per institution without disabling academics.

## Credential rule

Where a college selects DOB (`DDMMYYYY`) as the first credential, it is one-time only. The application immediately restricts the account to the Security page until a strong private password is set. Colleges should move to randomly generated activation codes when operationally possible.
