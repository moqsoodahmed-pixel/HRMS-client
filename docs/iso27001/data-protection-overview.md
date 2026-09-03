# Data Protection Overview

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]

> Status: ISO/IEC 27001:2022 readiness draft for DutyLaunch HRMS,
> describing the personal data this application actually processes and
> the technical/organizational controls actually in place around it, as
> evidence toward Annex A control 5.34 (Privacy and protection of PII).
> [ORGANIZATION NAME] is **not** currently ISO/IEC 27001 certified, and
> this document is **not** a legal compliance determination — see Section
> 8, which must be read before this document is relied upon for any
> regulatory purpose.

## 1. Purpose and Scope

This document inventories the categories of personal data processed by
DutyLaunch HRMS, the purpose of that processing, who has access to it,
where and how it is stored, its intended retention treatment, any
third-party involvement, and the security controls that protect it. It
applies to all personal data held by the application on behalf of
[ORGANIZATION NAME] regarding its own employees.

## 2. Categories of Personal Data Processed

| Category | Examples | Where evidenced |
|---|---|---|
| Identity data | Name, date of birth, gender, blood group, nationality | Employee profile model/controllers |
| Contact details | Personal and official email, mobile number | Employee profile model/controllers |
| Employment data | Designation, department, employment type, date of joining/exit, manager relationship | `server/controllers/employeeController.js` |
| Government identity document numbers | Aadhaar, PAN, Passport, Driving Licence, Voter ID | Encrypted at rest (`server/utils/encryption.js`), masked by default, plaintext revealed only via an explicit, audited reveal action |
| Employee-uploaded documents | Certificates, bank details, address proof, offer letters | `server/services/storageService.js`, `server/middleware/upload.js` |
| Compensation/salary data | Salary structure, compensation change requests/approvals | Compensation controller and workflow |
| Leave and attendance records | Leave requests, approvals, attendance history | Leave/attendance controllers |
| Profile photo | Uploaded image, MIME/size restricted (2MB limit) | `server/middleware/upload.js` |
| Account/authentication data | Email address, bcrypt password hash (cost 12) | User model, `server/middleware/auth.js` |

**Data subjects:** the organization's own employees. This application does
not process personal data belonging to external customers or end-users of
a public-facing product.

## 3. Purpose of Processing

Personal data is processed for internal HR administration (employee
records, organizational structure), payroll and compensation management,
leave/attendance tracking, and compliance/onboarding recordkeeping
(mandatory document collection and verification prior to activating an
employee record). No secondary or unrelated purpose (e.g. marketing,
profiling, sale of data) is evidenced anywhere in this codebase.

## 4. Who Has Access — Mapped to Enforced Roles

Access is governed by the role-based model defined in policy 02 (Access
Control Policy) and centrally enforced server-side
(`server/middleware/auth.js`, `server/utils/roles.js`) — never by
frontend-only checks. The seven roles and their actual data-access
implications:

| Role | Data-access implication (as server-enforced) |
|---|---|
| `SUPER_ADMIN` | Full platform-administrator access, including identity-document reveal and compensation approval, via `ELEVATED_ROLES`. |
| `CTO` | Equivalent to `SUPER_ADMIN` — included in `ELEVATED_ROLES`, not by hardcoded name/email. |
| `HR_ADMIN` | Broad HR-data access (employee records, documents, leave) via `HR_ROLES`/`HR_MANAGER_ROLES`; can request but not approve compensation changes (`COMPENSATION_REQUESTER_ROLES`, not `COMPENSATION_APPROVER_ROLES`); can view payroll (`PAYROLL_VIEW_ROLES`) but not write it directly (`PAYROLL_WRITE_ROLES` excludes `HR_ADMIN` — a compensation change from HR must go through the request/approval workflow). |
| `FINANCE` | Payroll view and write access (`PAYROLL_VIEW_ROLES`, `PAYROLL_WRITE_ROLES`), scoped to compensation/payroll data. |
| `MANAGER` | Access scoped to direct reports for leave approval (`LEAVE_APPROVER_ROLES`) and reporting (`REPORT_ROLES`); not a general HR-data role. |
| `EMPLOYEE` | Self-service access to their own record only, enforced via `authorizeOwnerOrAdmin()` rather than by role membership in a broad group. |
| `AUDITOR` | Read/audit access (`AUDIT_ROLES`, `REPORT_ROLES`) — evidenced for oversight, not for operational write access. |

Only `SUPER_ADMIN`/`CTO` may approve a compensation change
(`COMPENSATION_APPROVER_ROLES`); this separation-of-duties enforcement is
covered by `server/scripts/smoke-test-business-rules.cjs`.

Access to plaintext government identity document numbers is further
restricted beyond role membership: values are stored encrypted and
returned masked by default in all API responses; plaintext is exposed
only through an explicit reveal action, which is itself access-controlled
and produces an audit record rather than being a passive display
property.

## 5. Storage Location and Mechanism

- **Structured data** (employee records, compensation, leave, audit logs,
  account data) is stored in MongoDB via Mongoose models. The connection
  target is configured via environment variable
  (`MONGODB_URI`) and is not hardcoded; the actual hosting location of the
  database in any given deployment (self-hosted, [HOSTING PROVIDER]
  -managed, etc.) is an operational/environment detail not fixed by the
  codebase itself.
- **Uploaded files** (documents, profile photos) are stored outside the
  web root (`server/uploads/`), under generated UUID filenames rather
  than client-supplied names, and are served only through an
  authenticated, authorized application route — never as directly
  reachable static files (`server/services/storageService.js`,
  `server/middleware/upload.js`).
- **Government identity document numbers** are additionally encrypted at
  rest with AES-256-GCM before being written to MongoDB
  (`server/utils/encryption.js`), independent of the database's own
  storage security.
- **Passwords** are stored only as bcrypt hashes (cost factor 12), never
  in plaintext or reversibly encrypted form.

No evidence exists of personal data being replicated to, or processed by,
any analytics, logging-aggregation, or third-party SaaS platform beyond
what is described in Section 6.

## 6. Retention

Retention periods for each data category are governed in detail by policy
06 (Data Retention and Deletion Policy). Consistent with that policy, no
specific retention duration is asserted in this document — every period
is a placeholder pending review:

- Retention triggers are proposed per data category in policy 06 Section
  4 (e.g. employment end date, document supersession, statutory payroll
  record requirements).
- Actual numeric retention periods are marked [RETENTION PERIOD] there and
  here, and must be set by [LEGAL COUNSEL] for the organization's actual
  operating jurisdiction(s) before being treated as binding.
- As stated plainly in policy 06 Section 5, no automated retention or
  deletion job currently exists in this codebase; data is retained
  indefinitely today unless manually removed.

## 7. Third-Party Processing

No evidence exists of personal data being shared with or processed by any
named external third party for HR-data storage or processing beyond one
mechanism:

- **Outbound transactional email via SMTP.** The application sends
  password-reset, welcome, and payslip-ready notification emails via an
  SMTP relay configured through environment variables
  (`server/services/emailService.js`, `server/.env.example`: `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`). The example
  configuration defaults to Gmail SMTP (`smtp.gmail.com:587`) with
  `SMTP_SECURE=false` — i.e. STARTTLS negotiated over port 587 rather
  than implicit TLS, which is a standard and acceptable configuration
  provided the STARTTLS upgrade is actually negotiated and not silently
  downgraded; this should be explicitly verified in whatever environment
  is actually deployed, since the specific SMTP account/provider used in
  production is an operational detail not fixed by the codebase.
  Email content includes the recipient's name, and — for the welcome
  email only — a **temporary password in plaintext email body**
  (`sendWelcome` in `server/services/emailService.js`).

  **Flagged for review, not asserted as compliant or non-compliant:**
  sending a temporary password by email is common onboarding practice,
  but two points should be explicitly confirmed as organizational policy:
  (1) the application should require the user to change this temporary
  password on first login (verify this is enforced, not merely
  suggested), and (2) the email transport for this specific message
  should be confirmed to use a properly negotiated TLS connection in
  whatever environment is actually deployed, given the sensitivity of a
  credential traveling over email.

No other outbound integration, analytics SDK, or third-party API call
touching personal data is evidenced in this codebase.

## 8. Security Controls Protecting This Data

- **Encryption at rest** for government identity document numbers —
  AES-256-GCM (`server/utils/encryption.js`).
- **Masking by default** — identity numbers are never returned in
  plaintext in bulk/list API responses; plaintext requires an explicit
  reveal action.
- **Password hashing** — bcrypt, cost factor 12, never reversible.
- **Role-based access control**, enforced server-side per route
  (`server/middleware/auth.js`, `server/utils/roles.js`), not trusted to
  frontend checks — see Section 4 above and policy 02.
- **Input validation and allowlisting** on every write endpoint via Zod
  schemas (`server/controllers/*.js`), preventing mass-assignment of
  unintended fields (e.g. role, salary approval flags).
- **NoSQL injection prevention** — `express-mongo-sanitize` applied
  globally (`server/app.js`).
- **ObjectId validation** before any ID-derived database lookup
  (`assertObjectId`, `server/utils/helpers.js`), preventing
  path-traversal-style misuse of identifiers.
- **File-upload integrity** — MIME-type allowlist combined with a
  magic-byte content-signature check (`server/utils/fileSignature.js`),
  rejecting a spoofed `Content-Type`.
- **Generic error responses** — no stack traces or internal detail
  returned to clients (`server/middleware/errorHandler.js`).
- **Audit logging** — an immutable `AuditLog` collection
  (`server/models/NotificationAudit.js`) records actor, action, module,
  target, and timestamp for security-sensitive events; the schema
  enforces immutability at the model layer (update/delete operations on
  audit records raise an error), supporting non-repudiation and
  post-incident investigation.
- **Startup secret validation** — the server refuses to start if
  `JWT_SECRET` or `ENCRYPTION_KEY` is missing or fails a minimum-strength
  check (`server/config/env.js`), reducing the risk of weak or
  placeholder cryptographic material protecting this data in any running
  instance.

These controls are evidenced in code today; they are not a claim that all
residual risk to this data is eliminated. See
`docs/iso27001/risk-assessment.md` (to be established — see the
management review template) for a fuller treatment of residual risk.

## 9. This Document Is Not a Legal Compliance Determination

This document describes technical and organizational facts about how
DutyLaunch HRMS processes personal data. It does **not** determine:

- Whether GDPR, India's DPDP Act, CCPA, or any other data protection law
  applies to [ORGANIZATION NAME]'s processing, in which jurisdiction(s),
  or to what extent.
- The lawful basis (e.g. consent, contract, legitimate interest,
  statutory obligation) for any category of processing described above.
- What data-subject-rights procedures (access, correction, erasure,
  portability, objection) are legally required or how they should be
  operationalized.
- Whether a Data Protection Impact Assessment (DPIA), or equivalent, is
  required for any processing activity described here — including,
  specifically, the encrypted storage of government identity document
  numbers and the compensation/payroll data covered above.
- Any notification obligation to a regulator or to affected individuals
  in the event of a data-related incident (see policy 09, Incident
  Response Policy, Section 3 Statement 7, which states the same
  limitation for incident handling).

All of the above require review by [LEGAL COUNSEL] and, where the
organization designates one, [DATA PROTECTION OFFICER], based on
[ORGANIZATION NAME]'s actual operating jurisdiction(s), employee
locations, and business context. Nothing in this document should be
cited as evidence of legal compliance with any specific privacy law.

## 10. Roles & Responsibilities

- **[SECURITY OWNER]:** Owns this document and its alignment with actual
  application behavior as the codebase evolves.
- **[DATA PROTECTION OFFICER] / [LEGAL COUNSEL]:** Own the determinations
  in Section 9; must be consulted before this document is used to support
  any regulatory or contractual representation.
- **Engineering team:** Maintains the technical controls in Section 8 and
  flags any new data category, third-party integration, or access path
  that would change the facts stated in Sections 2–7.
- **HR_ADMIN / SUPER_ADMIN / CTO:** Operational owners of the personal
  data described here in day-to-day use of the application.

## 11. Related Evidence in This Repository

- `server/utils/encryption.js` — AES-256-GCM encryption and masking of
  identity numbers.
- `server/services/storageService.js`, `server/middleware/upload.js` —
  document storage and upload validation.
- `server/utils/roles.js`, `server/middleware/auth.js` — role definitions
  and server-side enforcement.
- `server/models/NotificationAudit.js` — immutable audit log.
- `server/services/emailService.js`, `server/.env.example` — SMTP-based
  transactional email, including the welcome-email temporary-password
  flow.
- `docs/iso27001/02-access-control-policy.md`,
  `docs/iso27001/06-data-retention-and-deletion-policy.md`,
  `docs/iso27001/09-incident-response-policy.md` — governing policies
  cross-referenced above.

## 12. Review Cycle

Reviewed at least annually, and immediately upon any change to the
categories of personal data processed, the role/permission model, or any
new third-party integration. Reviewed by [SECURITY OWNER] and approved by
[APPROVER]. Next scheduled review: [REVIEW DATE].
