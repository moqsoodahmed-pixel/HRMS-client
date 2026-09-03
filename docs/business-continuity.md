# Business Continuity Plan — DutyLaunch HRMS

**Status: no formal business continuity capability currently exists.** There
is no backup mechanism, no standby infrastructure, no documented incident
commander role, and no exercise history for this application today — it runs
as a single Node.js process against a single local MongoDB instance on one
Windows machine, with no redundancy at any layer. This document defines the
continuity plan that should govern the organization's response to an outage
of this system once implemented; it describes intended process and proposed
targets, not existing capability. Where a control below does not yet exist,
it is marked accordingly.

This document is distinct from `disaster-recovery.md`: this plan addresses
**what the business does** to keep functioning (or degrade gracefully) during
an outage; `disaster-recovery.md` addresses the **technical steps** to
restore the system itself. They are used together, not interchangeably.

---

## 1. Critical business functions supported by this system

| Function | What breaks without it | Time-sensitivity |
|---|---|---|
| **Payroll processing** (SalaryStructure, Payslip generation) | Employees are not paid on schedule; payslips cannot be generated or accessed | High — tied to a fixed pay cycle; delay is directly visible to every employee |
| **Leave approval workflow** (LeaveRequest) | Employees cannot request leave; managers cannot approve/reject; leave balances become stale or disputed | Medium — workarounds (email, paper) possible short-term but error-prone |
| **Employee records access** (Employee, User profiles) | HR/managers cannot look up employee data (contact info, role, reporting line, compensation) for operational decisions | Medium-High — blocks routine HR operations and manager decisions |
| **Document verification / onboarding gate** (EmployeeDocument, identity document upload and encrypted storage) | New hires cannot complete onboarding; identity/compliance documents cannot be verified or stored; onboarding stalls entirely | High for affected new hires — this system is the onboarding gate, not a convenience layer around it |
| Announcements, notifications, asset tracking | Reduced internal communication and asset visibility | Low — degrades convenience, not core HR obligations |

Impact ratings above are a starting assessment for planning purposes and
should be reviewed and formally ranked by [SECURITY OWNER] and business
stakeholders, including [APPROVER].

---

## 2. Proposed Recovery Time / Recovery Point Objectives

**PROPOSED — not yet adopted, agreed, or tested against real capability.**
These numbers describe a target, not a demonstrated capability; see
`disaster-recovery.md` for the current, honest recovery-time reality given
that no tested restore process exists yet.

| Function | Proposed RTO | Proposed RPO | Rationale |
|---|---|---|---|
| Payroll processing | [RTO — e.g. 24 hours, PROPOSED] | [RPO — e.g. 24 hours, PROPOSED] | Aligned to pay-cycle tolerance; must be confirmed against actual payroll calendar |
| Document verification / onboarding gate | [RTO PROPOSED] | [RPO PROPOSED] | Should be tight enough not to stall active onboarding cohorts |
| Leave approval | [RTO PROPOSED] | [RPO PROPOSED] | Lower urgency; manual fallback feasible |
| Employee records access | [RTO PROPOSED] | [RPO PROPOSED] | Read-heavy; degraded/read-only access may be an acceptable interim state |

Until a tested backup and restore capability exists (see
`backup-and-recovery.md`), **any RPO target is aspirational** — actual
recoverable data loss today would be total (no backups = no recovery point at
all, only what can be manually reconstructed). These targets should not be
represented internally as met capabilities until the restore-testing
schedule in `backup-and-recovery.md` §8 has been executed successfully at
least once.

---

## 3. Continuity roles and responsibilities

| Role | Placeholder | Responsibility during an outage |
|---|---|---|
| Security Owner | [SECURITY OWNER] | Overall accountability for the continuity response; decides when to declare an outage a formal incident (hands off to `incident-response-plan.md` where applicable) |
| Approver | [APPROVER] | Authorizes continuity actions with business impact (e.g. invoking manual payroll fallback, external communication) |
| Incident Commander (proposed role) | [ON-CALL CONTACT] or a named individual, PROPOSED | Single point of coordination during an active outage: drives status tracking, assigns technical recovery work (with `disaster-recovery.md`), and controls the communication cadence in §4. This role does not currently exist as a defined responsibility and should be assigned before it is needed. |
| Database Administrator | [DATABASE ADMINISTRATOR] | Executes technical recovery actions against MongoDB per `disaster-recovery.md` |
| Legal Counsel | [LEGAL COUNSEL] | Advises if the outage involves potential data loss/exposure with legal notification implications (see §5) |
| HR/business stakeholder | [APPROVER] (or a distinct business owner, TBD) | Confirms which business functions can run manually and for how long |

**Gap:** no incident commander or on-call rotation exists today. Until one is
assigned, an outage has no defined single owner of the response, which is
itself a continuity risk.

---

## 4. Communication plan during an outage

**PROPOSED process** (no tooling for this exists today — e.g. no status
page, no incident channel is currently configured):

1. **Detection → internal notification.** Whoever first observes the outage
   (application error, inaccessible service, MongoDB down) notifies
   [ON-CALL CONTACT] / [SECURITY OWNER] immediately.
2. **Initial assessment (target: within [target time, e.g. 30 minutes,
   PROPOSED]).** Incident Commander (or [SECURITY OWNER] if unassigned)
   determines affected function(s) from §1 and rough scope.
3. **Stakeholder notification.** Affected business stakeholders (HR,
   payroll processor, impacted employees if onboarding-blocking) are told:
   what's down, what functions are affected, and an initial estimate of
   restoration time — even if that estimate is "unknown, next update at
   [time]."
4. **Status cadence.** Updates continue at a fixed interval (e.g. every
   [interval, PROPOSED]) until resolution, even if the update is "no change."
   Silence during an outage is itself a failure mode.
5. **Resolution notification.** Confirmation that the system is restored
   **and verified functional** (per the smoke-test verification in
   `disaster-recovery.md`) — not merely that the process is running again.
6. **External/legal notification decision.** If the outage involved or may
   have involved data loss, corruption, or exposure of employee personal
   data, [LEGAL COUNSEL] and, if designated, [DATA PROTECTION OFFICER] are
   consulted on whether any external or regulatory notification is required.
   **No specific jurisdiction, regulation, or notification deadline is
   asserted by this document** — that determination requires
   jurisdiction-specific legal review, which has not been performed here.

Communication channel(s) (email distribution list, chat channel, etc.) are
TBD and should be fixed as part of implementing this plan.

---

## 5. Dependencies and their failure impact

| Dependency | Impact if unavailable | Notes |
|---|---|---|
| MongoDB | **Total** — every function in §1 requires database access; no function degrades gracefully without it | Single point of failure today: one standalone `mongod` instance, no replica set, no automatic failover |
| Node.js/Express server process | **Total** — no server, no application, regardless of DB state | Single process, no process supervisor/restart policy evidenced, no load balancing or redundancy |
| SMTP (password reset / notification emails) | **Low** — confirmed non-blocking. `server/services/emailService.js` treats SMTP as best-effort: if `SMTP_USER`/`SMTP_PASSWORD` are not configured, or if `transporter.sendMail` throws, the function logs the failure and returns rather than throwing, so the request that triggered the email (e.g. password reset) does not fail outright | This is an existing, correct design property, not a gap — core HR operations (payroll, leave, records, document upload) do not depend on outbound email succeeding |
| `server/uploads/` disk availability | **High** for document verification / onboarding; document upload and retrieval fail if this path is inaccessible or full | No redundancy (RAID, replication) evidenced for this local disk path |
| [HOSTING PROVIDER] (once applicable) | Not applicable today — this environment runs on a local machine with no hosting provider. Once deployed to real infrastructure, provider-level outages become an additional dependency to plan for | Placeholder pending actual hosting decision |

---

## 6. Manual fallback / degraded-operation options

**PROPOSED, not currently established as formal procedure:**
- **Payroll:** if the system is unavailable during a pay cycle, payroll
  figures must be reconstructed from the most recent verified backup (see
  `backup-and-recovery.md`) or, if no backup is available, from external
  records (bank submissions, prior payslip PDFs already distributed) —
  [APPROVER] decides whether to delay disbursement or process manually.
  This is a last resort, not a routine process.
- **Leave approval:** revert temporarily to email or a manual
  approval log; reconcile into the system once restored.
- **Onboarding/document verification:** new-hire starts may need to be
  delayed if identity document upload/verification cannot occur; this should
  be communicated to affected candidates per §4 rather than bypassing
  verification.
- These fallbacks are placeholders for planning discussion, not tested
  procedures.

---

## 7. Testing and exercise schedule

**No continuity exercise has ever been performed.** **PROPOSED cadence:
annually**, at minimum, plus after any material change to infrastructure
(e.g. moving off a single local machine to real hosting).

A minimal annual exercise should:
1. Simulate an outage of one critical function from §1 (tabletop exercise is
   an acceptable minimum bar initially; a live failover test is the more
   rigorous target once infrastructure supports it).
2. Walk through the communication plan in §4 with the actual named
   individuals in the roles in §3 (not hypothetical placeholders — this
   requires the placeholders to have been filled in by then).
3. Cross-reference with a `disaster-recovery.md` technical recovery test
   (ideally the same exercise covers both — a BC/DR combined test).
4. Document what worked, what didn't, and feed corrective actions back into
   both this plan and the organization's risk register, mirroring the
   lessons-learned process described in `incident-response-plan.md`.
5. Report results and any resulting plan updates to [APPROVER].

---

*Document owner: [SECURITY OWNER]. Approved by: [APPROVER]. Next review:
[REVIEW DATE].*
