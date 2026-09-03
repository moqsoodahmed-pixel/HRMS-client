# Employee Onboarding / Offboarding Policy (Joiner / Mover / Leaver)

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — ISO/IEC 27001:2022 readiness exercise for [ORGANIZATION NAME]. Subordinate to the Information Security Policy (01); referenced by the Access Control Policy (02) §7 and the Password and Authentication Policy (03). Supports Annex A control 6.1/6.5 (Screening / Termination or change of employment) and 5.18 (Access rights).

## 1. Purpose

This policy governs the identity-lifecycle events that most directly affect information security risk: hiring (**Joiner**), role or status change (**Mover**), and termination or departure (**Leaver**). It defines what must happen, in DutyLaunch HRMS and organizationally, at each event, and records — precisely and without overstatement — what is already enforced in code versus what remains a manual or organizational responsibility.

## 2. Scope

Applies to every Employee record and its linked User account in DutyLaunch HRMS, across all seven roles defined in policy 02, for the full employment lifecycle from creation (`createEmployee`) through archival (`archiveEmployee`) in `server/controllers/employeeController.js`.

## 3. Policy Statements

### Joiner — onboarding

1. **A document checklist is attached at creation, not as an afterthought.** When HR/admin creates an Employee record via `createEmployee`, a linked User account is created in the same operation, and the employee immediately enters a document-verification workflow governed by `server/utils/documentRequirements.js`. This module defines the required-document categories an employee must supply — including Aadhaar Card, Address Proof, PAN Card, Bank Account Details, Educational Certificates, Passport-size Photo, and Offer Letter (nine categories in total, with two — Cancelled Cheque and Experience Certificate — marked optional).
2. **The employee cannot reach ACTIVE status until every required document is VERIFIED.** This is enforced server-side in `updateEmployee` (`server/controllers/employeeController.js`): the only code path that ever transitions `status` to `ACTIVE` after creation checks `buildChecklist(...).summary.isComplete` first, and rejects the transition with `DOCUMENTS_INCOMPLETE` (HTTP 400) if any required document is missing, under review, or rejected — an uploaded-but-unverified document does not satisfy the requirement; only `VERIFIED` does.
3. **This gate applies to every role, including the most privileged.** The mandatory-document check is not conditioned on the caller's role — it applies identically whether the request is made by `HR_ADMIN`, `SUPER_ADMIN`, or `CTO`. This was specifically verified for `SUPER_ADMIN`/`CTO` (not only `HR_ADMIN`) by automated test (`server/scripts/smoke-test-business-rules.cjs`), consistent with policy 02 §5's "no business rule bypass for elevated roles" statement.
4. A newly created User account defaults to role `EMPLOYEE` (`server/controllers/employeeController.js`, `createEmployee`) with a default or seed-configured password (`SEED_EMPLOYEE_PASSWORD`, or a hardcoded fallback if unset — see Exceptions §6 note below). HR must ensure the new hire changes this default password at first login as part of the onboarding process; this is a manual/procedural expectation, not currently enforced by a forced-password-change flag in the codebase.
5. Onboarding must include communicating the Acceptable Use, Remote Working (policy 14), and Password/Authentication (policy 03) policies to the new hire before or at first login.

### Mover — role, department, or status change

6. **Employee updates go through a Zod-validated, allowlisted schema — a client cannot mass-assign server-controlled fields.** The `updateEmployee` endpoint validates all input against `employeeSchema.partial()` (`server/controllers/employeeController.js`). This schema enumerates exactly which fields a caller may set (e.g. `designation`, `department`, `manager`, `status`, `employmentType`, `workLocation`) and does **not** include `role`, `documentStatus`, `isArchived`, or other server-controlled fields — Zod strips any field not defined in the schema, so a request body containing e.g. `{ "role": "SUPER_ADMIN" }` has that field silently discarded rather than applied. This was verified by inspection of the schema definition, not merely assumed.
7. A change of `manager` is additionally guarded against creating a reporting-line cycle (`assertNoManagerCycle`), and a change of `officialEmail` is propagated to the linked User's login email in the same operation, keeping identity and access records consistent.
8. Any Mover event that changes a user's effective access level (e.g. a role change, which — unlike the fields above — is not exposed through this endpoint at all today and would require a separate, more privileged action) must be treated as an access-control event under policy 02 and recorded in the audit log. Every `updateEmployee` call is already audit-logged (`EMPLOYEE_UPDATED`, with old/new values) regardless of which allowed fields changed.
9. A status transition into `ACTIVE` triggered by a Mover event (e.g. returning from `ON_LEAVE` or completing `PROBATION`) is subject to the same mandatory-document gate as initial onboarding (Statement 2), since the gate is keyed on the transition itself (`employee.status !== 'ACTIVE'` before the update), not on whether the employee is newly hired.

### Leaver — offboarding

10. **Archival deactivates the linked User account.** `archiveEmployee` (`server/controllers/employeeController.js`) sets `employee.isArchived = true`, sets `employee.status = 'INACTIVE'`, records a `dateOfExit` if not already set, and — critically — sets the linked User's `isActive: false`. The `login` handler in `server/controllers/authController.js` checks `user.isActive` and rejects login for a deactivated account with `ACCOUNT_INACTIVE` (HTTP 403). This means: **a terminated employee cannot start a new session** from the moment of archival onward.
11. Archival is blocked while the employee still has direct reports (`reports > 0` check against other non-archived employees whose `manager` points to this one) — the reporting line must be reassigned before offboarding can complete. This prevents an orphaned management chain as a side effect of a Leaver event.
12. Every archival is audit-logged (`EMPLOYEE_ARCHIVED`), providing a timestamped record of who was offboarded, by whom, and when.

### Leaver — the session-revocation gap (read this before assuming offboarding is complete)

13. **Deactivation blocks new logins; it does not revoke an already-issued session token.** DutyLaunch HRMS has no server-side session/token revocation list (this is the same gap recorded in policy 03 §13). A JWT is a self-contained, stateless credential: once issued at login, it remains cryptographically valid for its full lifetime (default 30 minutes; up to 7 days with "remember me") regardless of any later change to `isActive`. **Concretely: if an employee's session token was issued shortly before they were archived, that token can still be used to call the API — subject to whatever role/authorization checks otherwise apply to it — until it naturally expires.** Only the ability to start a *new* session is blocked at archival; an already-active one is not forcibly ended.
14. This is a real, currently unmitigated gap, not a theoretical one, and must not be described as "handled" in any Statement of Applicability derived from this document. The residual exposure window is bounded (≤ 30 minutes for a default session, ≤ 7 days for a "remember me" session) but is not zero, and is largest precisely for the accounts most likely to use "remember me" for convenience.
15. **Recommended corrective actions (not yet implemented — for [SECURITY OWNER] and Engineering to prioritize):**
    - Implement a token-revocation mechanism — e.g. a short deny-list/blacklist of revoked token IDs (`jti`) checked on each request, or a `tokenVersion`/`passwordChangedAt`-style claim on the User record that is bumped on archival and compared against the token's issued-at claim during verification — so that archival can invalidate any already-issued token immediately rather than merely blocking new ones.
    - As an interim, lower-effort mitigation, shorten the maximum session lifetime for the most sensitive roles (`SUPER_ADMIN`, `CTO`, `HR_ADMIN`, `FINANCE`) — e.g. disallowing or shortening the 7-day "remember me" option for these roles specifically — to bound the exposure window without requiring a revocation-list implementation.
    - Until either is implemented, offboarding procedure should note the residual risk explicitly to [SECURITY OWNER], particularly for a Leaver event involving an adversarial or contested termination, where the standard mitigation is to combine archival with a `JWT_SECRET` rotation (policy 15 §9) as an emergency, blunt-instrument action that invalidates *all* sessions organization-wide — a workable but disruptive last resort, not a routine offboarding step.

## 4. Roles & Responsibilities

- **[SECURITY OWNER]:** Owns this policy; owns prioritizing the session-revocation corrective action in Statement 15; owns the periodic access review referenced in policy 02 §9, which should specifically confirm that archived employees hold no residual active sessions once a revocation mechanism exists.
- **HR_ADMIN:** Initiates Joiner (`createEmployee`), Mover (`updateEmployee`), and Leaver (`archiveEmployee`) actions; ensures required documents are collected and verified promptly so the ACTIVE-status gate is not a source of onboarding delay; ensures direct reports are reassigned before archiving a manager.
- **SUPER_ADMIN / CTO:** Subject to the same mandatory-document gate as any other role (Statement 3); may execute Leaver events; responsible for deciding whether an emergency `JWT_SECRET` rotation (Statement 15) is warranted for a high-risk termination.
- **Engineering/Development team:** Maintains `server/controllers/employeeController.js` and `server/utils/documentRequirements.js`; implements the corrective actions in Statement 15 when prioritized.
- **Manager:** Confirms departmental knowledge transfer and reporting-line reassignment ahead of a direct report's or peer's offboarding.

## 5. Related Evidence in This Repository

- `server/controllers/employeeController.js` — `createEmployee` (Joiner), `updateEmployee` (Mover, including the allowlisted Zod schema and the ACTIVE-status document gate), `archiveEmployee` (Leaver, including the `isActive: false` propagation and direct-reports check).
- `server/utils/documentRequirements.js` — `REQUIRED_DOCUMENT_TYPES` and `buildChecklist(...)`, the mechanism behind the mandatory-document gate.
- `server/controllers/authController.js` — `login` handler's `user.isActive` check, the enforcement point that blocks a deactivated account from starting a new session.
- `server/scripts/smoke-test-business-rules.cjs` — automated verification that the document gate applies to `SUPER_ADMIN`/`CTO`, not only `HR_ADMIN` (75 assertions, currently 100% passing).
- `docs/iso27001/02-access-control-policy.md` §7 and §9 — cross-references Joiner/Mover/Leaver as an access-control event and the (currently missing) periodic access review.
- `docs/iso27001/03-password-and-authentication-policy.md` §13 — the underlying session-revocation gap this policy applies to the specific Leaver scenario.
- **NONE — gap:** no server-side token/session revocation list exists (Statement 13). No forced-password-change-at-first-login flag exists for new hires (Statement 4). No role-change endpoint with its own access-review trigger currently exists separate from `updateEmployee`'s allowlisted fields.

## 6. Exceptions

Any deviation from this policy — e.g. activating a new hire before all required documents are verified, or delaying archival of a departing employee's account beyond their last working day — requires written approval from [SECURITY OWNER], documented with justification and a review date, recorded in the exceptions register established under policy 01. Note: use of the hardcoded fallback default password (`Employee@123456`) referenced in Statement 4 when `SEED_EMPLOYEE_PASSWORD` is unset must not occur in any production environment; this fallback is acceptable only in non-production/demo contexts alongside the seed accounts described in policy 02 §11.

## 7. Enforcement & Compliance

Compliance with the Joiner document gate and the Mover allowlist is evidenced by `server/scripts/smoke-test-business-rules.cjs` (100% passing) and by code review of the relevant Zod schemas. Compliance with the Leaver process is evidenced by the `EMPLOYEE_ARCHIVED` audit log entry and by confirming `isActive: false` on the linked User record. The session-revocation gap (Statements 13–15) must not be represented as closed in any audit, Statement of Applicability, or certification-readiness assessment until a corrective action from Statement 15 is actually implemented and verified.

## 8. Review Cycle

Reviewed at least annually, and immediately upon any change to `employeeSchema`, `buildChecklist`, `archiveEmployee`, or the `login` handler's `isActive` check. Next scheduled review: [REVIEW DATE]. The session-revocation gap (Statement 13) must be re-assessed at every review, in coordination with policy 03 §13 and policy 15 §9, until closed or formally risk-accepted by [SECURITY OWNER].
