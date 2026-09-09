# Asset Inventory — DutyLaunch HRMS

Document Owner: [SECURITY OWNER] · Approved by: [APPROVER] · Version: 1.0 (Draft) · Last Reviewed: [REVIEW DATE]

**Status:** This inventory was compiled by direct inspection of the repository and its running environment on 2026-08-30. It is a first draft, not a maintained CMDB — there is no tooling in this repository that keeps it automatically up to date. Treat every "Location" and "Owner" field below as accurate only as of the review date, and re-verify before relying on it for a real audit.

This inventory supports [ORGANIZATION NAME]'s asset-management obligations under `12-asset-management-policy.md` and feeds the risk register (`risk-assessment.md`) and the Statement of Applicability.

Classification tiers (defined fully in `05-data-classification-policy.md`): **PUBLIC**, **INTERNAL**, **CONFIDENTIAL**, **RESTRICTED**.

---

## 1. Information assets

| # | Asset | Description | Classification | Location | Owner | Lifecycle notes |
|---|-------|-------------|-----------------|----------|-------|------------------|
| A1 | Employee identity data | Name, DOB, gender, blood group, nationality, contact details | CONFIDENTIAL | MongoDB `employees` collection | [SECURITY OWNER] | Created at onboarding; retention undefined — see `06-data-retention-and-deletion-policy.md` |
| A2 | Government identity document numbers | Aadhaar/PAN/Passport/Driving Licence/Voter ID | RESTRICTED | MongoDB `identitydocuments`-equivalent collection, AES-256-GCM encrypted (`server/utils/encryption.js`) | [SECURITY OWNER] | Encrypted at rest; plaintext only via audited "reveal" action |
| A3 | Employee uploaded documents | Offer letters, certificates, bank proof, address proof, etc. | RESTRICTED | `server/uploads/documents/<employeeId>/<uuid>.<ext>` on the application host's local disk | [SECURITY OWNER] | Referenced by `EmployeeDocument` DB records; not committed to version control (`.gitignore`) |
| A4 | Profile photos | Employee-uploaded profile images | INTERNAL | `server/uploads/photos/` | [SECURITY OWNER] | — |
| A5 | Authentication credentials | Bcrypt password hashes, account lock state | RESTRICTED | MongoDB `users` collection (`password` field, `select: false`) | [SECURITY OWNER] | Never returned by default queries (fixed this session) |
| A6 | Compensation / salary data | Salary structures, compensation-change requests, payslips (PDF) | RESTRICTED | MongoDB `salarystructures`, `compensationrequests`, `payslips` collections | [SECURITY OWNER] | Payslip PDFs generated on demand via `pdfkit`, not stored long-term as files |
| A7 | Leave and attendance records | Leave requests/balances, daily attendance/check-in records | CONFIDENTIAL | MongoDB `leaverequests`, `leavebalances`, `attendances` collections | [SECURITY OWNER] | — |
| A8 | Audit log | Append-only record of security-sensitive actions (actor, action, module, target, timestamp) | CONFIDENTIAL | MongoDB `auditlogs` collection | [SECURITY OWNER] | No delete route exists at the application layer (verified by automated test) |
| A9 | Policies, announcements, assets register | Company policy documents, announcements, IT asset-tracking records | INTERNAL / PUBLIC (published items) | MongoDB `policies`, `announcements`, `assets` collections | [SECURITY OWNER] | Draft policies are INTERNAL until published |
| A10 | Notification records | In-app notification history | INTERNAL | MongoDB `notifications` collection | [SECURITY OWNER] | — |

## 2. Application / software assets

| # | Asset | Description | Classification | Location | Owner |
|---|-------|-------------|-----------------|----------|-------|
| A11 | DutyLaunch HRMS backend source | Node.js/Express API, ~227 npm dependencies | CONFIDENTIAL | `server/` | [SECURITY OWNER] |
| A12 | DutyLaunch HRMS frontend source | React/Vite SPA, ~210 npm dependencies | CONFIDENTIAL | `client/` | [SECURITY OWNER] |
| A13 | Automated regression suites | `smoke-test.cjs` (143 assertions), `smoke-test-business-rules.cjs` (75 assertions) | INTERNAL | `server/scripts/` | [SECURITY OWNER] |
| A14 | Seed / demonstration data generator | Creates demo accounts across all 7 roles with documented seed passwords | CONFIDENTIAL (contains credential material) | `server/seed/seed.js` | [SECURITY OWNER] |
| A15 | This ISMS documentation set | Policies, risk register, SoA, evidence index, this inventory | INTERNAL | `docs/`, `docs/iso27001/` | [SECURITY OWNER] |

**Gap:** none of A11–A13 are under version control — there is no git repository initialized for this project (verified: `git status` reports "not a git repository"). This is itself a tracked finding; see `internal-audit-report.md` (Finding relating to A.8.32).

## 3. Configuration / secret assets

| # | Asset | Description | Classification | Location | Owner |
|---|-------|-------------|-----------------|----------|-------|
| A16 | `JWT_SECRET` | Session-token signing key (≥32 random chars, validated at startup) | RESTRICTED | `server/.env` (gitignored); required by `server/config/env.js` | [SECURITY OWNER] |
| A17 | `ENCRYPTION_KEY` | AES-256-GCM key protecting identity-document numbers at rest | RESTRICTED | `server/.env` (gitignored); required by `server/config/env.js` | [SECURITY OWNER] |
| A18 | SMTP credentials | Outbound-mail account used for password-reset/welcome/payslip notifications | RESTRICTED | `server/.env` (`SMTP_USER`/`SMTP_PASSWORD`) | [SECURITY OWNER] |
| A19 | Seed account passwords | `SEED_ADMIN_PASSWORD` / `SEED_EMPLOYEE_PASSWORD` — demo credentials only | CONFIDENTIAL | `server/.env`, documented (without real values) in `server/.env.example` | [SECURITY OWNER] |

**Note:** `.env` is excluded from version control in both `server/.gitignore` and `client/.gitignore`. `.env.example` documents required variables and, for `JWT_SECRET`/`ENCRYPTION_KEY`, includes the correct generation command — but carries no real secret values.

## 4. Infrastructure assets

| # | Asset | Description | Classification | Location | Owner |
|---|-------|-------------|-----------------|----------|-------|
| A20 | MongoDB database instance | Primary data store for all application state | RESTRICTED | Local Windows service (`MongoDB Server`) in this verification environment; production location is **[HOSTING PROVIDER]** — not yet decided | [SECURITY OWNER] / [HOSTING PROVIDER] |
| A21 | Application server / compute | Runs the Node.js process | CONFIDENTIAL | Local Windows machine in this verification environment; production location is **[HOSTING PROVIDER]** — not yet decided | [HOSTING PROVIDER] |
| A22 | File storage for uploads | Local disk under `UPLOAD_DIR` (`server/uploads/`) | RESTRICTED | Same host as A21 today; no object-storage/redundant location configured | [HOSTING PROVIDER] |
| A23 | Domain / DNS | Public hostname for the deployed application | — | Not yet provisioned | **EVIDENCE REQUIRED** — no domain has been evidenced in this repository |
| A24 | SMTP provider | Third-party outbound-mail service (Gmail SMTP configured by default host/port) | — | External to this repository | [HOSTING PROVIDER] / supplier record — see `13-supplier-security-policy.md` |
| A25 | Backups | Any backup copy of A20/A22/A16/A17 | — | **NOT IMPLEMENTED** — no backup mechanism exists today | See `docs/backup-and-recovery.md` |
| A26 | CI/CD pipeline | Automated build/test/deploy pipeline | — | **NOT IMPLEMENTED** — no `.github/workflows` or equivalent exists | See `secure-development-lifecycle.md` |
| A27 | Source-control repository | Git history, PR review trail, branch protection | — | **NOT IMPLEMENTED** — this working directory is not a git repository | See `internal-audit-report.md` |

## 5. People / role assets (access holders, not personal data records)

| # | Asset | Description |
|---|-------|--------------|
| A28 | SUPER_ADMIN / CTO accounts | Full platform administrative access (CTO carries the same effective permissions via `ELEVATED_ROLES`, not name/email hardcoding) |
| A29 | HR_ADMIN accounts | HR operational access (employee records, documents, leave, onboarding/offboarding) |
| A30 | FINANCE accounts | Payroll/compensation-approval access |
| A31 | MANAGER accounts | Team-scoped visibility (own reports only) |
| A32 | EMPLOYEE accounts | Self-service access only |
| A33 | AUDITOR accounts | Read-only access to the audit log and reports |

Provisioning/deprovisioning of A28–A33 is governed by `17-employee-onboarding-offboarding-policy.md` and `02-access-control-policy.md`.

---

## Review cycle

This inventory should be reviewed whenever a new asset class is introduced (e.g. a new third-party integration, a new hosting provider is chosen, CI/CD is implemented) and at minimum every [REVIEW DATE]-defined cycle thereafter.
