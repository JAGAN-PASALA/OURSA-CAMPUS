# AI safety and privacy operating guide

## Intended use

OUR'S Smart Classroom assists authorised educators with attendance and classroom review. Its predictions are signals for human review, not facts about intent, character, discipline, disability, or academic ability.

## Consent and biometric lifecycle

1. Provide a clear notice explaining purpose, data fields, retention, access, alternatives, and withdrawal.
2. Record valid consent before face enrollment. The API enforces this state.
3. Capture at least three varied, well-lit enrollment samples from the correct student or staff member. Duplicate-face checking is an aid, not proof of identity; investigate false-match warnings through an authorised human process.
4. Encrypt templates in storage and restrict all database/backup access.
5. When consent is withdrawn, the application deletes the face template immediately. Apply the approved deletion timeline to backups as well.
6. Offer a non-biometric attendance alternative without penalty.

## Action model controls

- Collect pose samples only in authorised sessions; the implementation does not store submitted camera frames.
- Balance samples across actions, people, positions, clothing, cameras, and lighting.
- Do not interpret a single frame as a complex action. The runtime smooths predictions across frames, but fighting/talking remain temporal and context-dependent.
- Ordinary behaviour episodes are recorded only after the configured sustained threshold. During breaks/out-of-period monitoring, restrict processing to the approved safety purpose.
- Treat `uncertain` as no decision. Do not lower thresholds merely to produce more alerts.
- Review confusion matrices and per-class scores after every retraining.
- Version and approve models before promotion. Retain a rollback model and evaluation report.

## Human review

- Show the reviewer the time, confidence, classroom, and relevant authorised context.
- Permit correction/dismissal and record the review in the audit trail.
- Never automatically punish, grade, exclude, or notify guardians from a prediction alone.
- Never use camera observations alone to rank a teacher. Combine verified academic records and sufficiently aggregated anonymous feedback, and provide a correction/appeal route.
- Provide an appeal/correction process for affected students.

## Limitations to disclose

Camera angle, occlusion, crowding, skin tone, lighting, masks, disability, cultural behaviour, and domain shift can change accuracy. Validation accuracy from a small random split is not proof of real-world safety. Every customer environment requires its own monitored evaluation and legal review.
