# Backup and Recovery Procedure — DutyLaunch HRMS

**Status: NO backup mechanism is currently implemented.** There is no scheduled
`mongodump`, no filesystem backup of `server/uploads/`, no offsite copy, and no
tested restore process anywhere in this repository or the environment it runs
in today. This environment is a single local Windows machine running MongoDB
as a local service and the Node server directly, with no cloud infrastructure,
no managed database, no object storage, and no CI/CD. This document defines
the procedure that is **required to exist** before this application holds any
real employee data in a production context. Every script, schedule, and
control below is a **PROPOSAL** pending implementation and sign-off by
[SECURITY OWNER] and [APPROVER], not a description of something already built.

---

## 1. Scope: what must be backed up

A restorable backup of this application requires **three components, captured
together**:

| # | Component | Location (dev/test) | Why it's required |
|---|-----------|----------------------|--------------------|
| 1 | MongoDB database | Local MongoDB service, all collections (`Employee`, `User`, `EmployeeDocument`, `AuditLog`/`NotificationAudit`, `Leave`/`LeaveRequest`, `Payroll`/`SalaryStructure`/`Payslip`, `Policy`, `Announcement`, `Asset`, `Notification`, etc.) | System of record for all structured HR data |
| 2 | Upload directory | `server/uploads/` (observed subfolders: `uploads/documents/<employeeId>/...`, `uploads/payslips/...`) | Binary files (identity documents, payslip PDFs, profile photos) referenced by DB records via relative path. A DB backup without this directory leaves every `EmployeeDocument`/payslip record pointing at a file that no longer exists. |
| 3 | `ENCRYPTION_KEY` (and `JWT_SECRET`) | `server/.env` | AES-256-GCM identity-document fields in the database are unreadable ciphertext without this exact key. **If the key is lost, encrypted fields are lost permanently — no brute-force or vendor recovery path exists.** |

**Consistency requirement:** components 1 and 2 must represent the *same
point in time*. A document uploaded after the DB dump but before the
filesystem copy (or vice versa) produces either a dangling file or a dangling
DB reference. See §4 for the proposed approach to minimizing this window.

**Explicitly out of scope for the backup artifact itself:**
- `server/.env` in full must **not** be copied into the same backup location
  as the database dump / uploads archive. It contains `JWT_SECRET`,
  `ENCRYPTION_KEY`, SMTP credentials, and seed passwords. Bundling secrets
  with data defeats the purpose of separating "what must be restored" from
  "what must never leak." See §5 for the proposed key-handling approach.
- `node_modules/`, build artifacts (`client/dist`), and log files are
  reproducible or non-authoritative and are not part of the data backup
  (application logs may separately be retained per an operational logging
  procedure, out of scope here).

---

## 2. Proposed backup frequency and retention

**PROPOSED — not yet implemented or approved:**

| Backup type | Frequency | Retention | Notes |
|---|---|---|---|
| Full DB dump (`mongodump`) + uploads archive | Daily, off business hours | [RETENTION PERIOD] rolling window | Primary recovery point |
| Incremental / point-in-time (oplog-based) | Continuous, if MongoDB is run as a replica set | [RETENTION PERIOD] | Not applicable to a single standalone `mongod` instance — see §7 gap |
| Pre-deployment / pre-migration snapshot | Before any schema migration or bulk data operation | Until next full backup confirms superseding it, minimum [RETENTION PERIOD] | Manual trigger, see §6 |
| Monthly archival copy | Monthly | [RETENTION PERIOD] (longer-term, e.g. distinct from daily rolling window) | For audit/compliance evidence retention, distinct from operational recovery |

Actual frequency and retention numbers must be set by [SECURITY OWNER] and
[APPROVER] based on acceptable data-loss exposure (see RPO discussion in
`business-continuity.md`) and any [RETENTION PERIOD] obligations that apply
once real employee data is in scope — retention of personal data is also a
legal question requiring jurisdiction-specific review, not just an
operational one.

---

## 3. Proposed encryption of backup artifacts

Backup artifacts (mongodump output, uploads archive) will themselves contain
sensitive personal and financial data (bank details, identity document
metadata, payroll figures) and, per §1, encrypted document fields whose
protection depends on `ENCRYPTION_KEY` staying separate.

**PROPOSED controls:**
- **At rest:** every backup archive is encrypted (e.g. AES-256, via GPG or an
  archive tool with strong encryption) before it is written to any storage
  location, including local disk. The backup archive's own encryption
  passphrase/key is a *third* secret, distinct from `JWT_SECRET` and
  `ENCRYPTION_KEY`, and must itself be held in a secrets manager or vault
  accessible only to [DATABASE ADMINISTRATOR] and [SECURITY OWNER].
- **In transit:** any transfer of a backup artifact off the originating host
  (to offsite/redundant storage, per §4) uses TLS (e.g. `scp`/`sftp`/HTTPS to
  object storage over TLS 1.2+) — never an unencrypted file share or email
  attachment.
- **Never** store the backup-archive encryption passphrase in the same
  location as the archive itself.

---

## 4. Proposed offsite / redundant storage

Today, all data lives on one local machine — a single disk failure or
ransomware event destroys the only copy that exists. **PROPOSED:**
- Backups are copied to a location physically/logically separate from the
  primary host — e.g. a separate volume plus a remote target (cloud object
  storage, a second site, or [HOSTING PROVIDER]'s backup service once one is
  selected). "Redundant" means the loss of the primary host must not also
  destroy the only backup copy.
- At least one retained backup copy is kept immutable/write-once for the
  minimum window needed to survive a ransomware scenario where an attacker
  with host access also targets locally-reachable backup files (see
  `disaster-recovery.md` §"Ransomware").
- The specific offsite target, and any data-residency implications of storing
  employee data outside the org's home jurisdiction, must be confirmed with
  [LEGAL COUNSEL] before adoption.

---

## 5. Proposed encryption-key handling

`ENCRYPTION_KEY` protects identity-document fields at rest in MongoDB. It must
be backed up so a restored database is actually readable, but it must **not**
be stored in the same place, with the same access, or on the same schedule as
the data it protects — otherwise anyone who can steal the backup can decrypt
it.

**PROPOSED:**
- `ENCRYPTION_KEY` and `JWT_SECRET` are stored in a dedicated secrets
  manager or sealed vault (e.g. a cloud KMS/secrets manager, or an offline
  sealed/split-knowledge backup such as a printed value in a physical safe)
  — never inside the same backup archive, folder, or repository as the
  database dump.
- Access to the vault holding these secrets is restricted to
  [SECURITY OWNER] and [DATABASE ADMINISTRATOR], logged, and reviewed on the
  same cadence as other privileged access.
- Rotating `ENCRYPTION_KEY` requires re-encrypting all affected document
  fields and is a distinct, higher-risk procedure not covered by routine
  backup/restore — it is out of scope here and should be documented
  separately if/when key rotation is implemented.

---

## 6. PROPOSED backup script outline (mongodump/mongorestore)

The following is an illustrative outline only — **not implemented, not
tested, not scheduled**. It is provided to make the proposed procedure
concrete enough to review and eventually build.

```bash
#!/usr/bin/env bash
# PROPOSED — not yet implemented. Illustrative outline for review only.
# backup-hrms.sh
set -euo pipefail

TIMESTAMP="$(date +%Y%m%dT%H%M%S)"
BACKUP_ROOT="/secure/backup/staging"          # PROPOSED: separate volume, not app host's primary disk
WORKDIR="${BACKUP_ROOT}/hrms-${TIMESTAMP}"
MONGO_URI="${MONGO_URI:?MONGO_URI must be set}"       # never hardcode credentials in this script
UPLOADS_DIR="/path/to/server/uploads"
GPG_RECIPIENT="backup-key@[ORGANIZATION NAME]"        # PROPOSED: org backup encryption key, distinct from ENCRYPTION_KEY

mkdir -p "${WORKDIR}"

# 1. Dump MongoDB (all collections, includes indexes via --gzip)
mongodump --uri="${MONGO_URI}" --gzip --archive="${WORKDIR}/mongo.gz"

# 2. Archive uploads directory — captured immediately after the DB dump to
#    minimize (not eliminate) the consistency window described in §1.
#    A true point-in-time guarantee requires app-level write-quiescing or a
#    replica-set + oplog approach; this is a best-effort approximation.
tar -czf "${WORKDIR}/uploads.tar.gz" -C "$(dirname "${UPLOADS_DIR}")" "$(basename "${UPLOADS_DIR}")"

# 3. Checksum both artifacts for later integrity verification
sha256sum "${WORKDIR}/mongo.gz" "${WORKDIR}/uploads.tar.gz" > "${WORKDIR}/SHA256SUMS"

# 4. Encrypt the combined artifact — do NOT include server/.env in this step
tar -cf - -C "${WORKDIR}" mongo.gz uploads.tar.gz SHA256SUMS \
  | gpg --encrypt --recipient "${GPG_RECIPIENT}" --output "${BACKUP_ROOT}/hrms-${TIMESTAMP}.tar.gpg"

# 5. Transfer encrypted artifact to offsite/redundant storage over TLS
#    (e.g. aws s3 cp / rclone / scp — target TBD, see §4)

# 6. Remove unencrypted staging files
rm -rf "${WORKDIR}"

echo "Backup complete: hrms-${TIMESTAMP}.tar.gpg"
```

```bash
#!/usr/bin/env bash
# PROPOSED — not yet implemented. Illustrative restore outline for review only.
# restore-hrms.sh
set -euo pipefail

ARCHIVE="$1"                       # e.g. hrms-20260830T020000.tar.gpg
RESTORE_MONGO_URI="${RESTORE_MONGO_URI:?}"
RESTORE_UPLOADS_DIR="${RESTORE_UPLOADS_DIR:?}"
WORKDIR="$(mktemp -d)"

gpg --decrypt "${ARCHIVE}" | tar -xf - -C "${WORKDIR}"
sha256sum -c "${WORKDIR}/SHA256SUMS"                 # verify integrity before restoring anything

mongorestore --uri="${RESTORE_MONGO_URI}" --gzip --archive="${WORKDIR}/mongo.gz" --drop
tar -xzf "${WORKDIR}/uploads.tar.gz" -C "$(dirname "${RESTORE_UPLOADS_DIR}")"

# ENCRYPTION_KEY / JWT_SECRET are NOT in this archive — retrieve separately
# from the secrets vault (§5) and set them in the restored environment's
# server/.env (or secrets manager) before starting the app.

echo "Restore staged. Set ENCRYPTION_KEY and JWT_SECRET, then start the server and run verification (see §7)."
rm -rf "${WORKDIR}"
```

Before any implementation, this outline needs review for: `--drop` semantics
(destructive — restores must target a scratch/DR environment, never
production, without explicit sign-off), handling of large `uploads/`
directories, and a real scheduler (cron on Linux, Task Scheduler on Windows,
or a CI/CD job) — none of which exists today.

---

## 7. Access control over backups

**PROPOSED:**
- Only [DATABASE ADMINISTRATOR] and [SECURITY OWNER] (or their designated
  backups) may trigger a manual backup or restore, and only [SECURITY OWNER]
  may authorize a restore into a production environment.
- The backup automation's MongoDB credential is scoped to backup/restore
  operations only (not the application's general-purpose service account)
  and is itself stored in a secrets manager, not in a script or crontab in
  plaintext.
- Access to stored backup archives (encrypted or not) is logged; who
  accessed which archive and when is retained for [RETENTION PERIOD].
- Any restore of production data into a lower environment (e.g. staging/dev,
  for testing) must first mask or exclude identity-document and payroll
  fields, or be treated with the same access controls as production —
  decision owned by [SECURITY OWNER].

**Known current gap:** MongoDB in this environment runs as a single standalone
instance, not a replica set. This means there is no oplog to support
point-in-time recovery or truly consistent live backups — `mongodump` against
a live standalone instance can capture a database in a state that reflects
writes at slightly different times across collections. This should be
weighed against moving to a replica set (even a single-node one, which still
provides an oplog) as part of implementing this procedure.

---

## 8. Restore testing schedule

**No restore has ever been tested.** An unverified backup is not a backup —
it is an unverified assumption. **PROPOSED cadence: quarterly.**

Each quarterly restore test should:
1. Provision an isolated environment (not production, not shared with active
   development).
2. Retrieve the most recent backup archive and the corresponding
   `ENCRYPTION_KEY`/`JWT_SECRET` from the secrets vault, per §5.
3. Run the restore script/procedure end to end.
4. Start the application against the restored database and uploads
   directory.
5. Run both automated regression suites against the restored environment —
   `server/scripts/smoke-test.cjs` (143 assertions) and
   `server/scripts/smoke-test-business-rules.cjs` (75 assertions) — and
   require both to pass at 100% before the restore is considered verified.
   A restored process that merely *starts* is not sufficient evidence of a
   successful restore.
6. Spot-check that a known `EmployeeDocument` record resolves to a real,
   openable file in the restored `uploads/` directory, and that its
   encrypted fields decrypt correctly with the restored `ENCRYPTION_KEY`.
7. Record the test outcome (pass/fail, duration, issues found) and report to
   [SECURITY OWNER]; any failure triggers a corrective-action item before the
   next scheduled backup cycle is trusted.

Until this quarterly test has been run at least once successfully, this
backup procedure should be treated as **unproven** regardless of whether
backups are being taken.

---

*Document owner: [SECURITY OWNER]. Approved by: [APPROVER]. Next review:
[REVIEW DATE].*
