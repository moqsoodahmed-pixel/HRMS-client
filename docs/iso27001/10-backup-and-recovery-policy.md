# Backup and Recovery Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — prepared as part of an ISO/IEC 27001:2022 readiness exercise. [ORGANIZATION NAME] is **not** currently ISO/IEC 27001 certified.

## 1. Purpose

This policy establishes governance-level requirements for backing up and restoring DutyLaunch HRMS data and configuration, so that the application can recover from data loss, corruption, ransomware, infrastructure failure, or operator error. It sets *obligations and targets*; the step-by-step backup and restore procedure is maintained separately at `docs/backup-and-recovery.md`, which this policy governs.

## 2. IMPORTANT — Current State

**No automated backup mechanism exists today.** There is no backup script, no scheduled `mongodump` or equivalent, no offsite/redundant copy of the database or of `server/uploads/`, and no tested restore procedure anywhere in this repository or configured at the infrastructure level. This is a genuine, currently unaddressed gap and must be recorded as such in the Statement of Applicability referenced in policy 01. Nothing in this document should be read as implying a backup capability that exists today.

## 3. Scope

This policy covers all data required to restore the HRMS to an operating state, including:

- The MongoDB database (employee records, compensation, leave, documents metadata, `AuditLog` entries, users/credentials).
- Uploaded files under `server/uploads/` (identity documents, photos), referenced by database records via UUID filenames.
- Application configuration required to run the system, including the values of `JWT_SECRET` and `ENCRYPTION_KEY` (see policy 06 — loss of `ENCRYPTION_KEY` makes previously encrypted identity documents permanently unreadable, independent of whether the database itself is intact).

## 4. Policy Statements

1. **A backup mechanism must be implemented before this application handles production data.** Running without any backup capability is an accepted-risk-only state and must not be treated as a long-term operating condition.
2. **Backup frequency** must be defined and documented in `docs/backup-and-recovery.md` at a cadence no less frequent than [RETENTION PERIOD]; the specific interval (e.g. daily, hourly) is an operational decision to be set there, not in this policy.
3. **Backups must be encrypted at rest**, using a key managed independently from the primary application's `ENCRYPTION_KEY` where feasible, so that compromise of one does not automatically compromise the other. Backup encryption key custody must be documented once established.
4. **Backups must include at least one copy stored offsite or in a separate failure domain** from the primary database/file store, so that a single infrastructure failure (including [HOSTING PROVIDER] outage or regional failure) cannot destroy both primary and backup data simultaneously.
5. **Backup retention** must be defined explicitly in `docs/backup-and-recovery.md`, expressed as [RETENTION PERIOD]-style values per data category (e.g. daily backups retained for [RETENTION PERIOD], with longer-interval backups retained longer). Retention must not be indefinite by default — a defined expiry avoids unbounded accumulation of sensitive data copies.
6. **The `server/uploads/` directory (identity documents, photos) must be backed up with the same rigor as the database**, since database records reference these files by filename and are not restorable to a working state without them.
7. **Restore procedures must be tested, not assumed.** A backup that has never been restored is not considered a valid control. Restore testing cadence is proposed as **PROPOSED — not yet adopted**: at minimum once per [RETENTION PERIOD] cycle, exercised against a non-production environment, with results (success/failure, time taken) recorded.
8. **Recovery objectives must be defined once a backup mechanism exists** — specifically a Recovery Point Objective (maximum acceptable data loss) and Recovery Time Objective (maximum acceptable downtime). Neither is defined today; both are placeholders pending `docs/backup-and-recovery.md`.
9. **Access to backups is restricted.** Only [SECURITY OWNER] and explicitly designated engineering personnel may access backup storage or restore procedures; backup access should be logged once a mechanism exists, consistent with policy 11.
10. **Backup failures must be treated as security-relevant events** and escalated to [SECURITY OWNER]; a silently failing backup job that goes unnoticed provides no more protection than having no backup at all.

## 5. Roles & Responsibilities

- **[SECURITY OWNER]:** Accountable for the existence, testing, and access control of backups; owns `docs/backup-and-recovery.md`.
- **Engineering/Development team:** Responsible for implementing the backup mechanism, encryption, offsite replication, and executing restore tests.
- **[APPROVER]:** Approves the recovery objectives (RPO/RTO) once proposed, and any material change to retention or offsite arrangements.

## 6. Related Evidence in This Repository

- Automated database backup mechanism: **NONE — gap.**
- Automated file/`uploads/` backup mechanism: **NONE — gap.**
- Tested restore procedure: **NONE — gap.**
- `server/uploads/` — the file store that would need to be included in any backup, currently excluded from version control via `server/.gitignore` (which is a source-control exclusion, not a backup measure).
- `server/config/env.js` — startup validation of `ENCRYPTION_KEY`/`JWT_SECRET`, relevant because loss of these values (not just database loss) is itself a recovery scenario this policy must eventually cover.
- `docs/backup-and-recovery.md` — the detailed operational plan this policy governs. **To be authored; treat as a required dependency, not optional reading.**

## 7. Exceptions

Operating without a backup mechanism is currently the de facto state and is **not** an approved exception — it is a tracked gap. Any other deviation from this policy (e.g. a shorter-than-defined retention period for a specific data category) requires written approval from [SECURITY OWNER], with justification and review date, recorded per policy 01 §10.

## 8. Enforcement & Compliance

Compliance is assessed by confirming (a) a backup mechanism exists, (b) it runs on the defined cadence, and (c) restore tests have been executed and recorded. Until all three are true, this policy is enforced as "target state," and the gap must remain visible in the Statement of Applicability rather than being closed on paper only.

## 9. Review Cycle

This policy is reviewed at least annually, immediately upon implementation of any backup mechanism (to confirm the implementation matches these requirements), and after any failed or partial restore test. Next scheduled review: [REVIEW DATE].
