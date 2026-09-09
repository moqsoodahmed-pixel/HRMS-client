# Disaster Recovery Plan — DutyLaunch HRMS

**Status: no backup mechanism, no tested restore process, and no
disaster-recovery tooling currently exist for this application.** This
environment runs as a single Node.js process against a single standalone
MongoDB instance on one local Windows machine, with data in
`server/uploads/` on local disk only. There is no cloud infrastructure, no
managed database, no replica set, no object storage, and no CI/CD anywhere in
this repository or its infrastructure today — a single disk failure or file
deletion has no recovery path as things currently stand. This document
defines the technical recovery procedure that is required once the backup
mechanism proposed in `backup-and-recovery.md` is actually implemented. Every
step below assumes that implementation has happened; until it has, **the
honest recovery time for any scenario below is "data is not recoverable."**

This document is distinct from `business-continuity.md`: this is the
technical, step-by-step recovery procedure; `business-continuity.md` covers
business-level roles, communication, and fallback operations during the
outage this procedure is resolving.

---

## 1. Roles during recovery

| Role | Placeholder | Responsibility |
|---|---|---|
| Security Owner | [SECURITY OWNER] | Declares a disaster-recovery event, authorizes restore into production, owns the post-recovery review (§6) |
| Database Administrator | [DATABASE ADMINISTRATOR] | Executes `mongorestore` and database-level recovery actions |
| Approver | [APPROVER] | Authorizes any action with business/data impact (e.g. restoring over current production data, discarding data newer than the last backup) |
| On-call / Incident Commander | [ON-CALL CONTACT] | Coordinates recovery execution against the `business-continuity.md` communication plan |
| Legal Counsel | [LEGAL COUNSEL] | Consulted where a scenario (e.g. ransomware, compromise) may involve exposure of employee personal data — see §7 |

---

## 2. Failure scenarios and recovery procedures

Each scenario below references the backup/restore mechanism defined in
`backup-and-recovery.md` §6 (PROPOSED `mongodump`/`mongorestore` scripts).
None of these procedures can be executed today because no backup exists to
restore from — they are written so they are ready to execute the moment that
gap is closed.

### 2.1 Database corruption or loss

**Symptoms:** MongoDB fails to start, reports corrupted data files, or
collections return inconsistent/missing data not explained by application
logic.

1. **Identify** — stop the application server to prevent further writes
   against a corrupt database. Capture MongoDB logs and any error output
   before touching anything further (see §5, evidence preservation).
2. **Contain** — do not attempt ad-hoc repair of production data files
   without a backup to fall back to if repair fails; if `mongod --repair` is
   attempted, do so only against a copy of the data files, never the only
   copy.
3. **Recover** — provision a clean MongoDB instance (or repair the existing
   one in isolation) and run the PROPOSED restore procedure
   (`backup-and-recovery.md` §6) using the most recent verified backup
   archive and its checksum.
4. **Restore `server/uploads/`** from the matching backup archive (same
   timestamp as the DB dump used) to preserve DB-record-to-file consistency.
5. **Retrieve `ENCRYPTION_KEY`/`JWT_SECRET`** from the secrets vault
   (`backup-and-recovery.md` §5) — these are not part of the DB/uploads
   archive and must be set in the restored environment separately.
6. **Verify** per §4 before declaring recovery complete.

### 2.2 Server compromise (application host compromised)

**Symptoms:** unexpected processes, modified application files, unauthorized
outbound network activity, unexplained admin accounts, alerts from any
future host-intrusion tooling (none exists today).

1. **Identify/contain** — isolate the host from the network (or, in this
   local-machine context, disconnect it) to stop further attacker action,
   while preserving state for evidence (§5) — do not simply reboot or wipe
   immediately.
2. **Assume secrets are compromised.** Any secret resident on the host
   (`JWT_SECRET`, `ENCRYPTION_KEY`, SMTP credentials, DB credentials) must be
   treated as exposed. Follow the credential-rotation procedure in
   `incident-response-plan.md` ("Credential exposure") — this **will**
   invalidate all active sessions, which is correct and expected.
3. **Rebuild, don't clean.** Provision a fresh host/environment rather than
   attempting to clean the compromised one — an attacker with prior root/admin
   access cannot be reliably fully evicted by selective cleanup.
4. **Restore data** onto the clean host from the most recent backup
   **predating the compromise window**, per §2.1 steps 3–5. If the
   compromise window is unknown, prefer the oldest backup still within
   [RETENTION PERIOD] that can plausibly be trusted, accepting the
   associated data-loss trade-off, and document that decision.
5. **Verify** per §4, with particular attention to unexpected `User`/admin
   records or modified `AuditLog` entries that might indicate persistence.

### 2.3 Accidental mass deletion

**Symptoms:** a bulk operation, script, or admin action deletes far more
records than intended (e.g. wrong filter on a delete query).

1. **Identify** — stop the process/script that caused it if still running.
   Determine scope: which collection(s), how many records, and the
   approximate timestamp of the deletion (cross-reference `AuditLog` if the
   deleting action was itself audited).
2. **Contain** — freeze further writes to the affected collection(s) where
   feasible while scope is assessed, to avoid new legitimate data being
   overwritten by a restore.
3. **Recover** — this is the scenario most likely to tolerate a **partial**
   restore: restore the affected collection(s) only from the most recent
   backup predating the deletion into a scratch environment, then
   selectively re-insert only the deleted records into production, rather
   than restoring the entire database and losing legitimate writes that
   happened after the backup but before the deletion. This requires
   [DATABASE ADMINISTRATOR] judgment and is inherently more delicate than a
   full restore — document exactly what was re-inserted.
4. **Verify** per §4, focused on the affected collection(s) and their
   cross-references (e.g. restored `Employee` records still resolve to
   correct `EmployeeDocument`/`uploads/` paths).

### 2.4 Ransomware

**Symptoms:** files encrypted/renamed on the host, ransom note present,
MongoDB data files or `server/uploads/` inaccessible or altered.

1. **Identify/contain** — isolate the host immediately (network
   disconnect) to stop lateral spread or further encryption. Do not pay
   any ransom or attempt decryption tools without [SECURITY OWNER] and
   [LEGAL COUNSEL] involvement.
2. **Assume total loss of the host's local data**, including any backup
   copy that was reachable from that host (this is why
   `backup-and-recovery.md` §4 requires at least one offsite/immutable
   copy not reachable from the primary host — if that has not been
   implemented, this scenario currently has **no recovery path**).
3. **Rebuild** on new/clean infrastructure — never restore onto the
   compromised host.
4. **Restore** from the most recent offsite/immutable backup copy
   confirmed **not** to have been reachable/writable by the compromised
   host, per §2.1 steps 3–5.
5. **Rotate all secrets** (`JWT_SECRET`, `ENCRYPTION_KEY`, SMTP credentials,
   any DB credentials) per `incident-response-plan.md`, since a ransomware
   actor with host access had access to `server/.env`.
6. **Verify** per §4 with heightened scrutiny — confirm restored data is
   not itself partially corrupted or tampered with (checksum verification
   from `backup-and-recovery.md` §6 is the first check).
7. This scenario very likely warrants formal incident classification and
   legal consultation — see `incident-response-plan.md` and §7 below.

### 2.5 Total infrastructure loss at [HOSTING PROVIDER]

**Symptoms:** the hosting provider suffers a regional/total outage or
data-center loss affecting the application server and/or database.

*(Not applicable to the current local-machine dev/test environment — this
scenario applies once the application is deployed to real hosting
infrastructure. Documented now so the procedure exists before it is needed.)*

1. **Identify** — confirm via [HOSTING PROVIDER]'s status channel that the
   outage is provider-side, not application-level, to avoid mis-diagnosing
   as §2.1/§2.2.
2. **Contain** — none required on the application side; this is an external
   dependency failure.
3. **Recover** — provision replacement infrastructure (with a different
   provider or a different region/availability zone, per whatever
   redundancy arrangement is in place once real hosting is chosen) and
   restore the full stack (application deployment + database + uploads)
   from the most recent offsite backup, per §2.1 steps 3–5.
4. **Verify** per §4.
5. This scenario should also trigger the communication plan in
   `business-continuity.md` §4, since recovery time is bounded by
   [HOSTING PROVIDER]'s outage duration plus rebuild time, not just internal
   effort.

---

## 3. General recovery sequence (applies across scenarios)

1. Declare the event and assign roles (§1).
2. Preserve evidence before remediating (§5) — do not restore over or
   delete anything that might be needed for post-incident analysis until
   it is captured.
3. Stop the affected application/database to prevent further
   damage/inconsistency.
4. Retrieve the appropriate backup artifact and, separately, the
   `ENCRYPTION_KEY`/`JWT_SECRET` from the secrets vault
   (`backup-and-recovery.md` §5).
5. Execute the restore procedure (`backup-and-recovery.md` §6) into a
   clean/isolated environment first, not directly into production, where
   time permits.
6. Verify (§4).
7. Cut over to the restored environment / resume production traffic.
8. Conduct the post-recovery review (§6 below).

---

## 4. Verification after recovery — required before declaring recovery complete

A restored MongoDB process that starts without errors is **not** sufficient
evidence of a successful recovery. The following must all pass:

1. **Checksum verification** — the restored archive matches the
   `SHA256SUMS` recorded at backup time (`backup-and-recovery.md` §6).
2. **Application starts cleanly** against the restored database and
   `server/uploads/` directory, with `ENCRYPTION_KEY`/`JWT_SECRET` set from
   the vault (not regenerated — regenerating `ENCRYPTION_KEY` would make
   existing encrypted fields permanently unreadable).
3. **Run both automated regression suites against the restored
   environment and require 100% pass:**
   - `server/scripts/smoke-test.cjs` (143 assertions)
   - `server/scripts/smoke-test-business-rules.cjs` (75 assertions)
   
   These suites exercise real application behavior (not just process
   liveness) and are the concrete bar for "the restored system actually
   works," not merely "the restored system started."
4. **Spot-check data integrity** — confirm a sample of `EmployeeDocument`
   records resolve to real files in the restored `uploads/` directory, and
   that encrypted identity-document fields decrypt correctly with the
   restored `ENCRYPTION_KEY`.
5. **Confirm audit trail continuity** — check that `AuditLog`/notification
   audit records in the restored database are present and that the
   recovery actions themselves (restore performed, by whom, when) are
   recorded somewhere durable, even if that's a manual log until proper
   tooling exists.

Only after all of the above pass should [SECURITY OWNER] declare recovery
complete and authorize resumption of normal traffic.

---

## 5. Evidence preservation

For any scenario involving possible compromise (§2.2, §2.4) or accidental
data loss with disputed cause (§2.3):
- Preserve `AuditLog`/`NotificationAudit` records, application logs, and
  MongoDB logs **before** any remediation step that could alter or
  overwrite them (e.g. before restarting MongoDB with a repair flag, before
  restoring over a corrupted database).
- Export/copy these logs to a separate location, outside the affected
  host, prior to remediation.
- This preserved evidence feeds directly into the identification and
  post-incident steps in `incident-response-plan.md` — do not treat
  recovery speed as more important than evidence preservation for any
  scenario that may require post-incident forensic review or a
  notification decision (§7 below).

---

## 6. Post-recovery review

After every disaster-recovery event, regardless of scenario:
1. [SECURITY OWNER] convenes a review with [DATABASE ADMINISTRATOR] and any
   other individuals involved in the response.
2. Document: what failed and why, what recovery steps were taken, actual
   time-to-recovery versus the RTO/RPO targets proposed in
   `business-continuity.md` §2, and whether verification (§4) passed on
   the first attempt or required rework.
3. Identify corrective actions — e.g. gaps in the backup scope, missing
   monitoring that would have caught the issue earlier, secrets that
   should have been rotated sooner.
4. Feed corrective actions into the organization's risk register and into
   the lessons-learned process defined in `incident-response-plan.md`
   §"Lessons learned," even if the triggering event was not formally
   classified as a security incident.
5. Update this document and `backup-and-recovery.md` if the review reveals
   the documented procedure was wrong, incomplete, or untested for the
   scenario encountered.

---

## 7. Notification considerations

Several scenarios above (particularly ransomware and server compromise) may
involve exposure or loss of employee personal data. **This document asserts
no specific legal notification timeline or obligation.** Whether external or
regulatory notification is required is a jurisdiction-specific legal
question that must be routed to [LEGAL COUNSEL] and, if designated,
[DATA PROTECTION OFFICER] — see `incident-response-plan.md` §"Notification
and escalation" for the corresponding process.

---

*Document owner: [SECURITY OWNER]. Approved by: [APPROVER]. Next review:
[REVIEW DATE].*
