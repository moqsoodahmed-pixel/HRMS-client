# Acceptable Use Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — ISO/IEC 27001:2022 readiness exercise for [ORGANIZATION NAME]. Subordinate to the Information Security Policy (01).

## 1. Purpose

This policy defines acceptable use of the DutyLaunch HRMS application and related IT resources by employees, managers, HR administrators, finance staff, auditors, and system administrators, and the consequences of misuse.

## 2. Scope

Applies to every individual granted an account under any of the seven roles defined in policy 02 (`SUPER_ADMIN`, `CTO`, `HR_ADMIN`, `FINANCE`, `MANAGER`, `EMPLOYEE`, `AUDITOR`), and to any device or network used to access the application.

## 3. Policy Statements

1. **No account sharing.** Each individual must use only their own uniquely assigned account and credentials. Sharing a login, password, or authenticated session with another person — including a colleague standing in during absence, or an administrator "borrowing" another user's session for convenience — is prohibited. Every audit log entry attributes an action to a specific account, and shared credentials undermine that attribution (see policy 02 §5 on ownership-scoped access and the `AuditLog` collection).

2. **Use only your assigned access, and only for legitimate work purposes.** Users must not attempt to access data, functions, or records beyond what their role requires (least privilege, policy 02 §2), even where a bug, misconfiguration, or elevated-role colleague's cooperation might make broader access technically possible. `SUPER_ADMIN` and `CTO` holders in particular must exercise their elevated access only for legitimate administrative purposes, not for routine day-to-day tasks better performed under a lower-privileged role.

3. **No unauthorized export or download of HR data.** Bulk export, download, screenshotting, printing, or forwarding of employee personal data, identity documents, or compensation data outside the application is prohibited except where required for a legitimate, authorized business purpose (e.g. an approved payroll run, a legally mandated disclosure once reviewed by [LEGAL COUNSEL]). This applies with particular force to:
   - Identity document numbers, which are encrypted at rest and masked by default (`server/utils/encryption.js`); any use of the "reveal" action to view plaintext must be for a legitimate, specific purpose, as the action is itself audit-logged.
   - Compensation records, subject to the compensation approval workflow.
   - Any data accessed via `AUDITOR` read access, which exists for audit/compliance review, not general data extraction.

4. **Reporting suspected security incidents.** Any user who suspects a security incident — including but not limited to a compromised account, suspicious login activity, a phishing attempt referencing the HRMS, an unexpected change to their own or another employee's records, or discovery of exposed credentials/secrets — must report it immediately per policy 09 (Incident Management Policy, referenced). Do not attempt to independently investigate, alter records, or "fix" a suspected compromise before reporting.

5. **No attempt to bypass technical controls.** Users must not attempt to circumvent authentication (policy 03), authorization (policy 02), file-upload validation (Statement 6 below), or audit logging. This includes attempting to forge cookies/tokens, tamper with request payloads to reach unauthorized endpoints, or upload files with a spoofed file type.

6. **Acceptable file handling.** Only files of the permitted types (PDF, JPEG, PNG, DOCX, XLSX, legacy XLS, CSV) and within the documented size limits (10MB for documents, 2MB for profile photos) may be uploaded. Users must not attempt to upload disguised or mislabeled file types; the application independently verifies file content against its declared type via magic-byte signature checking (`server/utils/fileSignature.js`) and will reject mismatches, but circumventing or attempting to circumvent this control is itself a policy violation regardless of technical success.

7. **No sharing of seed/demonstration credentials.** Seed/demonstration accounts and passwords (`SEED_ADMIN_PASSWORD`, `SEED_EMPLOYEE_PASSWORD`, from `server/seed/seed.js`) exist solely for local development and demonstration. They must never be used, shared, or referenced outside a non-production environment, and must never be assumed valid or safe to reuse in any environment presented to real users.

8. **Document integrity.** Users with document verification responsibilities (e.g. `HR_ADMIN`) must only mark a document `VERIFIED` after genuine review, and must not mark an employee's `documentStatus` as complete or transition an employee to `ACTIVE` by working around the mandatory-document enforcement in `server/controllers/employeeController.js` (e.g. by requesting an elevated-role user do it on their behalf without the underlying data being complete — which the server rejects regardless of caller role).

9. **Reasonable and lawful use.** The HRMS and any IT resources used to access it must be used only for lawful purposes consistent with [ORGANIZATION NAME]'s employment policies. This policy does not itself define a broader acceptable-use-of-IT-resources policy (e.g. internet/email use unrelated to the HRMS) — that remains governed by [ORGANIZATION NAME]'s general HR/IT policies outside this ISMS suite.

## 4. Roles & Responsibilities

- **All users:** Responsible for complying with every statement above, and for reporting suspected incidents promptly.
- **HR_ADMIN:** Responsible for genuine, good-faith document verification (Statement 8) and for not facilitating unauthorized data export on behalf of others.
- **SUPER_ADMIN / CTO:** Held to a higher standard given elevated access; must exercise elevated permissions only for legitimate administrative need (Statement 2), and are not exempt from any statement in this policy.
- **[SECURITY OWNER]:** Owns this policy and the incident-reporting channel referenced in Statement 4; investigates reported violations.
- **[APPROVER]:** Approves disciplinary escalation for confirmed violations, in coordination with HR leadership.

## 5. Related Evidence in This Repository

- `server/utils/encryption.js` — AES-256-GCM encryption and masking of identity document numbers; separately audit-logged reveal action.
- `server/middleware/auth.js`, `server/routes/` — enforcement that access is limited to a user's assigned role regardless of what the frontend displays.
- `server/utils/fileSignature.js` — magic-byte file-signature verification rejecting mismatched file types (`INVALID_FILE_TYPE`).
- `AuditLog` collection — attributes every covered action (login, document verify/reject, compensation request/approve/reject, leave actions, etc.) to a specific actor; append-only at the application layer.
- `server/controllers/employeeController.js` — server-side, role-independent enforcement of the mandatory-document-before-ACTIVE rule.
- `server/seed/seed.js` — clearly-scoped, non-production seed/demonstration accounts.

## 6. Exceptions

Any need to deviate from this policy (e.g. a legitimate bulk data export for a payroll vendor) requires prior written approval from [SECURITY OWNER], documented with business justification, scope, and a review date.

## 7. Enforcement & Compliance

Violation of this policy may result in disciplinary action up to and including termination of access or employment, consistent with [ORGANIZATION NAME]'s HR policies, and may be escalated as a security incident under policy 09 where warranted. Suspected violations are investigated using the `AuditLog` collection and, where relevant, the automated regression suites (`server/scripts/smoke-test.cjs`, `server/scripts/smoke-test-business-rules.cjs`) to confirm expected control behavior.

## 8. Review Cycle

Reviewed at least annually and upon any material change to roles, data handled, or the incident-reporting process. Next scheduled review: [REVIEW DATE].
