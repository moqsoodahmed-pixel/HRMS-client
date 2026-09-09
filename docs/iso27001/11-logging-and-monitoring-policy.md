# Logging and Monitoring Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — prepared as part of an ISO/IEC 27001:2022 readiness exercise. [ORGANIZATION NAME] is **not** currently ISO/IEC 27001 certified.

## 1. Purpose

This policy defines what security-relevant activity must be logged in the DutyLaunch HRMS application, the integrity requirements those logs must meet, how long they are retained, and how they are reviewed. It also records, honestly, the current absence of any external monitoring or alerting capability.

## 2. Scope

Applies to the application-level audit trail (`AuditLog`), HTTP access logging, and error logging produced by the DutyLaunch HRMS backend, and to any future external monitoring/SIEM capability.

## 3. Policy Statements

### 3.1 What must be logged

1. **Security-sensitive actions must be recorded in the application audit trail.** This is already implemented: the `AuditLog` collection (`server/models/NotificationAudit.js`) records actor, action, module, target record, a human-readable label, and timestamp for events including: login and login-failed, employee create/update/archive, document upload/verify/reject/requirements-completed, compensation request/approve/reject, leave apply/approve/reject/cancel, policy publish, holiday creation, and identity-number "reveal." Any new security-sensitive action added to the application must be added to this audit trail as part of its implementation, not retrofitted later.
2. **HTTP access is logged.** `morgan` (dev format) logs method, path, status code, and response time for every request to stdout. Request bodies are **not** logged by this format — the review confirms credentials and personal data are not incidentally written to this log by the current configuration.
3. **Unhandled server errors are logged server-side, never exposed to the client.** `server/middleware/errorHandler.js` logs the full error via `console.error`; the response returned to the client contains only a sanitized code/message. This separation must be preserved in any future refactor.
4. **What is currently NOT logged, and is a gap:** there is no structured/JSON logging, no request/response correlation ID threading a single request through logs, and no log redaction/scrubbing framework. If a future log statement is added that could include personal data or secrets, it must be reviewed for redaction before merge — no automated safeguard currently prevents this.

### 3.2 Log integrity

5. **The audit trail is append-only at the application layer.** No route in `server/routes/index.js` (or elsewhere) permits deletion of `AuditLog` records; this has been verified by an explicit passing automated test assertion in `server/scripts/smoke-test-business-rules.cjs`. This must remain true — no future change may introduce a delete or bulk-purge capability for audit records without explicit, documented approval from [SECURITY OWNER] and a corresponding update to this policy.
6. **Read access to the audit trail is restricted by role.** Only AUDITOR, SUPER_ADMIN, and CTO roles can read `/audit` endpoints (`server/routes/index.js`, gated by `AUDIT_ROLES` in `server/utils/roles.js`); HR_ADMIN and EMPLOYEE cannot, verified by automated test. This prevents the roles most likely to be the *subject* of an audited action (e.g. HR_ADMIN performing employee edits) from also controlling visibility into that trail.
7. **Application-level append-only status is not the same as tamper-proof storage.** Anyone with direct database access (e.g. a compromised MongoDB credential, or physical/infrastructure-level access) could still alter or delete audit records outside the application layer. This policy does not claim otherwise; database-level access control and hardening are addressed in policy 06 and policy 02.

### 3.3 Log review

8. **Regular, proactive review of the audit trail and access logs is PROPOSED — not yet adopted as a running process.** Until adopted, log review happens reactively (e.g. during an incident investigation per policy 09) rather than on a schedule. Proposed cadence, pending [SECURITY OWNER] adoption: audit trail spot-review not less than [RETENTION PERIOD], with specific attention to identity-number "reveal" events, failed logins, and role/permission changes.

### 3.4 Retention

9. **Audit log retention** is to be defined as [RETENTION PERIOD], balancing investigative usefulness against unnecessary accumulation of records referencing personal data. No retention/purge job exists today — records accumulate indefinitely by default, which is itself a gap to track (indefinite retention of personal-data-adjacent records is not a defensible long-term state and must be resolved once [LEGAL COUNSEL] and [SECURITY OWNER] set the actual period).
10. **Access/error logs to stdout** are not currently persisted beyond process/container lifetime in any centralized way (see Section 3.5); retention of these, once centralized, should also follow [RETENTION PERIOD].

### 3.5 Monitoring, alerting, and the current gap

11. **No external monitoring, alerting, or SIEM integration exists today.** There are no dashboards, no anomaly detection, no automated alert on suspicious patterns (e.g. repeated login failures, unusual audit activity volume, or off-hours identity-document reveals), and no on-call/escalation tooling wired to any of the logging described above. Detection of a security event today depends on someone manually querying the `AuditLog` via the `/audit` endpoints or noticing an application error — there is no proactive detection capability. This is a material gap and must be tracked in the Statement of Applicability referenced in policy 01.
12. Implementing centralized log shipping and alerting is a prerequisite for meaningfully executing the "detect" step of policy 09 (Incident Response Policy) at anything faster than manual, after-the-fact discovery.

## 4. Roles & Responsibilities

- **[SECURITY OWNER]:** Owns this policy, decides when log review becomes a standing process, and is accountable for closing the monitoring gap over time.
- **Engineering/Development team:** Maintains the `AuditLog` mechanism, adds new security-sensitive actions to it as features are built, and is responsible for not introducing redaction or deletion regressions.
- **AUDITOR/SUPER_ADMIN/CTO role holders:** The only roles with read access to the audit trail; responsible for using that access appropriately and not sharing exports outside authorized purposes.

## 5. Related Evidence in This Repository

- `server/models/NotificationAudit.js` — the `AuditLog` schema and model (actor, action, module, target, label, timestamp).
- `server/services/auditService.js` — the write path used across controllers to record audit entries; fails soft (an audit-write failure is logged via `console.error` but never blocks the underlying business operation).
- `server/routes/index.js` (`/audit`, `/audit/filters`, `/audit/:id`) — read-only, role-restricted audit endpoints.
- `server/utils/roles.js` (`AUDIT_ROLES`) — the role restriction enforcing AUDITOR/SUPER_ADMIN/CTO-only read access.
- `server/scripts/smoke-test-business-rules.cjs` — contains the passing automated assertion that no delete route exists for audit records, and the role-restriction check for `/audit` access.
- `server/middleware/errorHandler.js` — server-side error logging via `console.error`, never leaked to clients.
- `morgan` HTTP access logging (configured in the Express app entrypoint) — dev-format request logging to stdout.
- External monitoring/SIEM/alerting: **NONE — gap.**
- Structured/JSON logging, correlation IDs, log redaction framework: **NONE — gap.**

## 6. Exceptions

Any request to reduce audit coverage (e.g. exempting a new security-sensitive action from logging) requires written approval from [SECURITY OWNER] with documented justification, recorded per policy 01 §10. No exception may weaken the append-only property of the audit trail.

## 7. Enforcement & Compliance

Compliance is verified through the existing automated test suite (`smoke-test.cjs`, `smoke-test-business-rules.cjs`), which must continue to pass its audit-related assertions on every change. Any code review touching `server/services/auditService.js`, `server/models/NotificationAudit.js`, or `/audit` routes must confirm this policy's integrity and access-restriction requirements are preserved.

## 8. Review Cycle

This policy is reviewed at least annually, whenever a new security-sensitive action type is added to the application, and upon any decision to adopt scheduled log review or external monitoring. Next scheduled review: [REVIEW DATE].
