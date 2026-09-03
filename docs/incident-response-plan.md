# Incident Response Plan — DutyLaunch HRMS

**Status: no incident-response tooling currently exists.** There is no
security monitoring/alerting, no SIEM, no malware/antivirus scanning of
uploaded files, no automated intrusion detection, and no on-call rotation in
place for this application today. The only forensic-relevant data source that
currently exists in the codebase is the application's own audit logging
(`AuditLog`/`NotificationAudit` collections, written via
`server/services/auditService.js` and related controllers). This document
defines the operational procedure the organization should follow once basic
capability (logging retention, an assigned on-call contact, a secrets vault)
is in place. Every "tool" referenced that does not exist yet is marked as
such; the procedures themselves are written to be followed today using
whatever manual means are available, imperfect as that is.

**General principle used throughout:** for every scenario, evidence
(audit logs, relevant files, timestamps) must be preserved **before** any
remediation step that could alter or destroy it (restarting a service,
deleting a file, rotating a database, repairing corruption). Speed of
remediation is not more important than the ability to later understand what
happened.

**Severity classification (used across all scenarios below):**

| Severity | Definition | Example |
|---|---|---|
| **Critical** | Active compromise, ongoing data exposure, or total service loss with no workaround | Confirmed database compromise, ransomware, active account takeover of a privileged account |
| **High** | Confirmed security failure with contained but real impact | Single compromised non-privileged account, confirmed malicious upload blocked but pattern suggests targeted probing |
| **Medium** | Suspected but unconfirmed issue, or confirmed issue with low/no data impact | Suspicious login pattern under investigation, a discovered vulnerability not yet known to be exploited |
| **Low** | Anomaly worth recording, no indication of actual impact | A single failed upload rejected by file-type validation, a one-off failed login |

Severity determines escalation speed in each scenario below, decided by
[SECURITY OWNER] (or [ON-CALL CONTACT] if unavailable).

---

## 1. Suspected account compromise

**Identification:** reports of unexpected account activity, logins from
unexpected patterns, or a user reporting they didn't perform an action shown
in their history. (No automated anomaly detection exists today — this relies
on user reports or manual `AuditLog` review.)

**Triage:** classify severity based on the account's privilege level (an
admin/HR account compromise is at minimum High, likely Critical) and whether
any action was taken with it.

**Containment:**
1. Disable/lock the affected user account immediately (via existing
   user-management functionality) to stop further use of the session/credential.
2. Force logout: since sessions are JWT-based, a single account cannot be
   selectively invalidated without a server-side revocation list (none
   exists today) — the only guaranteed way to invalidate a specific
   compromised session before its natural expiry is rotating `JWT_SECRET`,
   which invalidates **all** sessions org-wide (see §5, Credential
   exposure). For a single suspected account, prefer disabling the account
   first and reserve a full `JWT_SECRET` rotation for cases where the
   scope of compromise is unclear or spans multiple accounts.

**Eradication:** reset the account's password/credential once the identity
of the legitimate user is confirmed out-of-band (not via a channel that
might itself be compromised, e.g. don't rely solely on email if email
credentials are in question).

**Recovery:** re-enable the account only after the legitimate user confirms
control and, if relevant, after a broader compromise scope has been ruled
out via §6/§7.

**Evidence preservation:** export the account's `AuditLog` entries (logins,
actions performed) covering the suspected window **before** disabling/
resetting anything, in case the reset process itself affects loggable state.

**Notification/escalation:** [SECURITY OWNER] is notified for any High/
Critical classification. If the account had access to identity documents or
payroll data, involve [LEGAL COUNSEL] per §"Notification and escalation"
below to assess breach-notification exposure — no timeline is asserted here.

---

## 2. Unauthorized access (non-account-specific — e.g. access beyond intended permissions, or access via a vulnerability)

**Identification:** an authenticated or unauthenticated party accesses data
or functionality they should not have — discovered via user report, code
review, or a security review (e.g. `/security-review`) finding.

**Triage:** severity depends on what was accessed. Identity documents,
payroll data, or admin functionality = High/Critical. Non-sensitive metadata
= Medium/Low.

**Containment:** if the access path is a specific endpoint/permission check
defect, restrict or disable the affected functionality (e.g. feature-flag
off, or temporarily require a stricter role check) while a fix is prepared.
If access is ongoing (e.g. an open session actively being used), disable the
session/account per §1.

**Eradication:** fix the underlying authorization defect (code change,
tested and reviewed like any other production change — not a background-agent
change deployed without review).

**Recovery:** re-enable the functionality once the fix is verified (including
re-running `server/scripts/smoke-test.cjs` and
`server/scripts/smoke-test-business-rules.cjs` to confirm the fix didn't
regress existing behavior).

**Evidence preservation:** capture the `AuditLog` entries showing what was
accessed and when, plus the relevant request path/parameters if available
from application logs, before deploying the fix.

**Notification/escalation:** as in §1 — [SECURITY OWNER] decides
escalation; [LEGAL COUNSEL] involved if personal data (identity documents,
payroll, employee PII) was actually accessed, not just theoretically
accessible.

---

## 3. Data leakage (data exposed/exfiltrated, whether accidental or malicious)

**Identification:** discovery that data left the system inappropriately —
e.g. a misconfigured export, a document accessible via a guessable/
unauthenticated URL, or evidence of bulk data retrieval in `AuditLog`.

**Triage:** severity scales directly with sensitivity of what leaked —
identity documents or payroll data leaking is Critical by default.

**Containment:** immediately close the exposure path (revoke a shared link,
fix an access-control gap, take down a misconfigured export endpoint).

**Eradication:** root-cause the leak path and fix it; verify no other
endpoint shares the same defect (e.g. if one document-serving route lacked
an ownership check, check sibling routes).

**Recovery:** confirm the fix, then determine what (if anything) needs to be
done about data already exposed (e.g. it cannot be "un-leaked," but scope and
recipients of exposure should be assessed for the notification decision
below).

**Evidence preservation:** export relevant `AuditLog` entries and any
available request logs showing what was accessed, by what identity/IP, and
when — this is the primary evidence for scoping the leak and is required
before the notification decision in §"Notification and escalation" can be
made responsibly.

**Notification/escalation:** this scenario most directly raises potential
breach-notification obligations. [LEGAL COUNSEL] and, if designated,
[DATA PROTECTION OFFICER] must be engaged to determine whether external or
regulatory notification is required. **This document does not assert any
jurisdiction, applicable regulation, or notification deadline** — that
determination requires jurisdiction-specific legal review that has not been
performed as part of this documentation exercise.

---

## 4. Malware

**Identification:** unexpected process behavior, unexplained file changes,
or (if endpoint/AV tooling is ever deployed) an AV alert. **No AV/endpoint
detection tooling exists in this environment today** — identification
currently depends entirely on manual observation.

**Triage:** default to High/Critical — malware presence implies host
compromise until scoped otherwise.

**Containment:** isolate the affected host from the network immediately.
Do not attempt to "clean" the host in place as a first response — treat it
as compromised (see `disaster-recovery.md` §2.2, Server compromise, which
this scenario feeds into directly).

**Eradication:** rebuild the host from a known-clean state rather than
attempting in-place removal, consistent with `disaster-recovery.md`.

**Recovery:** restore application and data per `disaster-recovery.md`
§2.1–2.2, onto the rebuilt host, then rotate all secrets per §5 below since
`server/.env` on the compromised host must be assumed read.

**Evidence preservation:** where feasible, preserve a disk image or at
minimum copies of suspicious files and system/application logs before
rebuilding — once the host is wiped, this evidence is gone.

**Notification/escalation:** [SECURITY OWNER] notified immediately (High/
Critical default). [LEGAL COUNSEL] engaged if the malware had plausible
access to employee personal data (which, on this host, it would, given
`server/uploads/` and the database are co-located).

---

## 5. Malicious upload

**Preventive controls that already exist** (evidence-grounded, not
proposed): `server/middleware/upload.js` restricts uploads to an explicit
MIME-type allowlist (PDF, JPEG/JPG, PNG, DOCX, CSV, XLS/XLSX) with a 10 MB
general limit (2 MB for image-only uploads) and rejects anything else at the
multer layer. `server/utils/fileSignature.js` then checks the file's actual
leading bytes against the signature expected for its declared MIME type
(e.g. `%PDF`, PNG's 8-byte magic number, ZIP local-file headers for
DOCX/XLSX, OLE2 header for legacy XLS) — this exists specifically because
the multipart `Content-Type` header is client-supplied and trivially spoofed,
so a renamed executable or script claiming to be `application/pdf` is
rejected rather than stored and later served back under a trusted-looking
Content-Type. (`text/csv` is intentionally left unchecked in that module
since plain text has no binary signature to verify.)

**Known real gap:** there is **no active malware/antivirus scanning of
uploaded file contents** beyond the type/signature check above. A file that
is a structurally valid PDF/DOCX/image but contains an embedded exploit,
malicious macro, or steganographic payload would currently pass both checks
undetected. This is a genuine gap, not a theoretical one, and should be
tracked in the risk register until content-scanning (e.g. an AV engine or
sandboxed detonation step) is implemented.

**Identification:** a file fails/passes upload validation but later behaves
unexpectedly when opened, or a future scanning tool (once implemented)
flags a stored file.

**Triage:** a file rejected by existing validation (blocked at upload) is
Low — the control worked as intended, log it. A file that passed validation
but is later found malicious is High/Critical, since it indicates a gap
being actively exploited.

**Containment:** if a malicious file is found already stored, remove it
from `server/uploads/` and identify/notify anyone who may have downloaded
it. Identify the associated `EmployeeDocument` (or equivalent) record and
mark it appropriately rather than silently deleting the DB reference.

**Eradication:** if the file exploited a gap in validation (e.g. a
signature-check bypass), fix the validation logic and re-verify with the
smoke-test suites plus a manual test against the specific bypass found.

**Recovery:** restore/re-request the legitimate document from the affected
employee if the malicious file replaced a needed real one.

**Evidence preservation:** preserve the malicious file itself (in an
isolated, non-executable location) and the `AuditLog` entry for its upload
(who uploaded it, when, from where) before deleting it from the live
uploads path.

**Notification/escalation:** [SECURITY OWNER] notified for any High/Critical
case; treat as a potential broader compromise per §4 if the file was
actually executed/opened on any host.

---

## 6. Credential exposure (e.g. leaked `JWT_SECRET` or `ENCRYPTION_KEY`)

**Identification:** a secret is found in a place it shouldn't be (committed
to a repository, logged, shared insecurely, or suspected known by an
unauthorized party).

**Triage:** Critical by default — both `JWT_SECRET` and `ENCRYPTION_KEY`
are load-bearing security controls (see `server/config/env.js`, which fails
startup entirely if either is missing or malformed, precisely because there
is no safe fallback for a signing or encryption key).

**Containment:**
1. **`JWT_SECRET` exposure:** rotate it immediately. Because
   `server/config/env.js` performs a fail-fast startup check
   (`validateEnv()` calls `process.exit(1)` if `JWT_SECRET` is missing or
   under 32 characters), rotating it requires updating `server/.env` (or
   the equivalent secrets store) and **restarting the application process**
   — the running process does not pick up a changed value without a
   restart. **Rotating `JWT_SECRET` invalidates every currently active
   session, forcing all users to log in again. This is the correct and
   intended response to suspected `JWT_SECRET` compromise, not a bug or
   an unwanted side effect** — it should be communicated to users via the
   `business-continuity.md` communication plan as "you have been logged
   out for a security reason," not treated as an outage to apologize for.
2. **`ENCRYPTION_KEY` exposure:** this is materially different and higher
   risk. Rotating `ENCRYPTION_KEY` does **not** automatically re-encrypt
   existing data — every AES-256-GCM-encrypted identity-document field
   already in the database was encrypted with the old key. Simply swapping
   the value in `.env` and restarting would make all existing encrypted
   fields **unreadable** (ciphertext now paired with the wrong key), not
   secure. A key rotation here requires a deliberate re-encryption
   migration (decrypt every affected field with the old key, re-encrypt
   with the new key, verify) before the old key can be safely retired —
   this migration does not exist today and must be built and tested (in a
   non-production environment first) as part of responding to this
   scenario, not attempted ad hoc under incident pressure.
3. In both cases, the exposed value must also be assumed known by an
   unauthorized party for the entire window it was exposed — evidence
   preservation (§ below) should establish that window if possible.

**Eradication:** confirm the exposure source (e.g. a repository, a log
file, a shared document) is fully remediated — the leaked value removed
from history where feasible, or at minimum access revoked to wherever it
was exposed.

**Recovery:** restart the application with the rotated `JWT_SECRET`;
communicate the forced re-login per §above. For `ENCRYPTION_KEY`, recovery
is complete only once the re-encryption migration has run successfully and
been verified (spot-check that previously-encrypted fields still decrypt
correctly post-migration).

**Evidence preservation:** capture how/where the secret was exposed
(commit history, log excerpt, chat message) before remediating that
exposure source, so the exposure window and likely audience can be
assessed.

**Notification/escalation:** [SECURITY OWNER] notified immediately.
Whether this constitutes a reportable incident depends on whether the
exposure demonstrably enabled unauthorized access to personal data — a
determination for [LEGAL COUNSEL], not asserted here.

---

## 7. Database compromise

**Identification:** unauthorized access to MongoDB directly (not via the
application), evidence of unexpected queries/modifications, or an
unrecognized admin/connection in MongoDB's own access logs (if enabled —
not confirmed configured in this environment today).

**Triage:** Critical by default — direct database access bypasses all
application-layer authorization entirely.

**Containment:** isolate the database from network access beyond the
application server immediately; rotate the database credential used by the
application.

**Eradication:** determine the access vector (weak/default credential,
exposed port, compromised host per §4) and close it. Treat the host itself
as compromised per `disaster-recovery.md` §2.2 if the access vector
suggests host-level compromise rather than a database-specific
misconfiguration.

**Recovery:** follow `disaster-recovery.md` §2.1 (database corruption or
loss) restore procedure if data integrity is in question, using a backup
predating the compromise window. Rotate `ENCRYPTION_KEY`/`JWT_SECRET` per
§6 above given the co-located `.env`.

**Evidence preservation:** export `AuditLog` contents and any MongoDB-level
access logs before any restore or repair action that might overwrite them.

**Notification/escalation:** direct database compromise very likely
constitutes access to personal data (identity document ciphertext, payroll
figures, contact details) — engage [LEGAL COUNSEL] and
[DATA PROTECTION OFFICER] per §"Notification and escalation" below.

---

## 8. Service outage

**Identification:** application or database unreachable/unresponsive,
whether from infrastructure failure, resource exhaustion, or an
unidentified cause.

**Triage:** severity depends on cause and duration — an outage with no
evidence of malicious cause is typically Medium/High operationally but not
a security incident per se; escalate to Critical/security-incident
handling immediately if any evidence suggests the outage is caused by an
attack (e.g. resource exhaustion consistent with a denial-of-service
pattern, or found alongside signs from §4/§7).

**Containment/eradication/recovery:** follow `disaster-recovery.md` for the
applicable technical scenario, and `business-continuity.md` for business
communication during the outage.

**Evidence preservation:** capture logs and process state before restarting
services, in case root cause needs later determination.

**Notification/escalation:** operational outage without confirmed security
cause follows `business-continuity.md` communication plan, not necessarily
formal incident escalation — [SECURITY OWNER] makes that call if cause is
ambiguous.

---

## 9. Discovered security vulnerability (not yet exploited)

**Identification:** found via code review, a security review
(`/security-review` or manual audit), a dependency vulnerability advisory,
or external report.

**Triage:** severity based on exploitability and impact if exploited (a
theoretical low-impact issue is Low/Medium; an unauthenticated path to
personal data or credential exposure is High/Critical even with no evidence
of active exploitation yet).

**Containment:** if actively exploitable and severe, consider temporarily
disabling the affected functionality while a fix is prepared, per the same
logic as §2.

**Eradication:** fix the vulnerability with a reviewed, tested code change;
re-run both smoke-test suites plus a targeted test for the specific
vulnerability class found.

**Recovery:** deploy the fix; confirm via re-test that the vulnerability no
longer reproduces.

**Evidence preservation:** not generally applicable unless there is
evidence the vulnerability was already found/exploited by someone else
(in which case treat as §2/§3 as appropriate) — document the finding,
fix, and verification for the record regardless.

**Notification/escalation:** internal only, unless evidence emerges of
prior exploitation, in which case escalate per the relevant scenario above.
Feed into the risk register per §"Lessons learned" regardless of
disposition.

---

## 10. Insider misuse

**Identification:** a person with legitimate access uses it improperly —
e.g. viewing employee records without a business reason, exporting data for
unauthorized use, or approving their own leave/payroll change outside
normal process. Primary detection method available today is manual
`AuditLog` review; there is no automated anomaly detection for this.

**Triage:** severity depends on data sensitivity and intent — accessing
payroll/identity data without cause is High; a self-approval process gap is
at minimum Medium and also indicates a control weakness independent of
intent.

**Containment:** restrict the individual's access pending review (in
coordination with HR/[APPROVER] — this scenario is as much an HR process as
a technical one).

**Eradication:** if the root cause is a missing control (e.g. no check
preventing self-approval), fix it as a §2/§9-style defect in addition to
addressing the individual conduct.

**Recovery:** restore normal access once the review concludes, per HR/
[APPROVER] decision.

**Evidence preservation:** export the relevant `AuditLog` entries covering
the individual's activity for the period in question before any access
change that might be visible to them and prompt evidence tampering (e.g.
before revoking access, quietly capture the trail first where feasible).

**Notification/escalation:** primarily an HR/[APPROVER] matter; involve
[LEGAL COUNSEL] if the conduct may have exposed personal data to
unauthorized third parties or otherwise carries legal exposure.

---

## Notification and escalation (applies across all scenarios)

- [SECURITY OWNER] is the default point of escalation for any scenario
  above classified Medium or higher.
- Any scenario involving actual or reasonably suspected access to,
  exposure of, or loss of employee personal data (identity documents,
  payroll/compensation data, contact information) must be brought to
  [LEGAL COUNSEL] and, where designated, [DATA PROTECTION OFFICER] for a
  determination on whether external or regulatory notification is
  required.
- **This document does not assert compliance with, or notification
  deadlines under, any specific law or regulation (e.g. GDPR, CCPA, DPDP,
  or any other regime).** No jurisdiction has been specified for this
  exercise, and notification obligations vary substantially by
  jurisdiction and by the nature of the data involved. Jurisdiction-specific
  legal review is required before any notification timeline or content is
  finalized — none is proposed here.
- Evidence preserved per each scenario's steps above should be handed to
  whoever performs that legal review, not summarized or interpreted away
  before they see it.

---

## Lessons learned / post-incident corrective action process

For every incident handled under this plan, regardless of severity:

1. [SECURITY OWNER] convenes a post-incident review with the individuals
   involved in the response, within a reasonable time after resolution
   (e.g. [target — PROPOSED, such as 5 business days]).
2. Document: timeline (identification → containment → eradication →
   recovery), root cause, what worked, what didn't, and whether the
   relevant procedure in this document was adequate or needs revision.
3. Identify concrete corrective actions (control gaps to close, monitoring
   to add, this document's own steps to fix) and assign an owner and
   target date for each.
4. Feed every corrective action into the organization's risk register as a
   tracked item — an incident that produces no risk-register entry has not
   actually been learned from.
5. Where the incident also triggered `disaster-recovery.md` recovery
   steps, cross-reference that document's own post-recovery review (its
   §6) rather than duplicating it — one incident should produce one
   coherent record, not two contradictory ones.
6. Update this document, `backup-and-recovery.md`, `disaster-recovery.md`,
   or `business-continuity.md` if the review reveals any of them was
   wrong, incomplete, or untested for the scenario actually encountered.

---

*Document owner: [SECURITY OWNER]. Approved by: [APPROVER]. Next review:
[REVIEW DATE].*
