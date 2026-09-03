# Evidence Index — DutyLaunch HRMS ISO/IEC 27001:2022 Readiness

Document Owner: [SECURITY OWNER] · Approved by: [APPROVER] · Version: 1.0 (Draft) · Last Reviewed: [REVIEW DATE]

Maps ISMS requirements to the actual evidence available for them as of 2026-08-30. Where no evidence exists, this index says so explicitly — **EVIDENCE REQUIRED — NOT YET AVAILABLE** — rather than leaving the row blank or implying evidence exists.

## 1. Source-code evidence

| Requirement | Evidence | Location |
|---|---|---|
| RBAC / centralized authorization | `authorize()`, `authorizeOwnerOrAdmin()` middleware | `server/middleware/auth.js` |
| Elevated-role model (CTO = SUPER_ADMIN-equivalent, not name/email hardcoded) | `ELEVATED_ROLES` array, `isElevated()` helper | `server/utils/roles.js` |
| Password hashing | bcrypt, cost factor 12 | `server/controllers/authController.js` |
| Password field protected from default queries | `select: false` on `password` (fixed this session) | `server/models/User.js` |
| Session/token secret validation (fail-closed) | `validateEnv()`, called at process startup (added this session) | `server/config/env.js`, `server/server.js` |
| Encryption of identity documents at rest | AES-256-GCM, key from `ENCRYPTION_KEY` | `server/utils/encryption.js` |
| Mandatory-document / employee-activation gate | Server-side block on ACTIVE transition while documents incomplete | `server/controllers/employeeController.js`, `server/utils/documentRequirements.js` |
| File-upload MIME allowlist + size limits | `fileFilter`, `limits.fileSize` | `server/middleware/upload.js` |
| File-upload content-signature verification (added this session) | `matchesDeclaredType()` | `server/utils/fileSignature.js` |
| Safe file storage (no path traversal, UUID filenames) | `storageService.upload()` | `server/services/storageService.js` |
| NoSQL injection protection | `express-mongo-sanitize` applied globally | `server/app.js` |
| Input validation / mass-assignment protection | Zod schemas, `.partial()` on update schemas | `server/controllers/*.js` |
| Generic error responses (no stack-trace leakage) | `errorHandler` | `server/middleware/errorHandler.js` |
| Audit logging (append-only at app layer) | `AuditLog` model + write helper | `server/models/NotificationAudit.js`, `server/services/auditService.js` |
| Rate limiting (global + auth-specific) | `express-rate-limit` | `server/app.js`, `server/routes/auth.js` |
| Security headers / CORS | `helmet()`, restricted `cors()` origin | `server/app.js` |

## 2. Test-file and test-result evidence

| Requirement | Test file | Result as of 2026-08-30 |
|---|---|---|
| Full module regression (auth, employees, attendance, leave, payroll, documents, identity, policies, announcements, assets, onboarding/offboarding, reports, audit, notifications) | `server/scripts/smoke-test.cjs` | **143/143 passed**, 0 failed (re-verified on a fresh server restart after every code change this session) |
| CTO elevated permissions, compensation-approval workflow, mandatory-document enforcement, security hardening checks | `server/scripts/smoke-test-business-rules.cjs` | **75/75 passed**, 0 failed (grew from 35 → 68 → 75 across this and the prior session as functionality and security tests were added) |
| Cross-employee document/leave/payroll access denial (IDOR) | Both suites, multiple assertions | PASS — verified live |
| Password field never returned | `smoke-test-business-rules.cjs` — "auth/me does not return the password field", "login response does not return the password field" | PASS |
| Security headers present | `smoke-test-business-rules.cjs` — "responses set X-Content-Type-Options: nosniff", "X-Powered-By header is not leaked" | PASS |
| Forged/tampered session rejected | `smoke-test-business-rules.cjs` — "a forged/tampered auth cookie is rejected" | PASS |
| Spoofed file-type upload rejected | `smoke-test-business-rules.cjs` — "a file whose content does not match its declared MIME type is rejected" | PASS |
| Frontend build | `cd client && npm run build` (vite 6.4.3) | **SUCCESS**, 0 errors |
| Dependency vulnerability scan | `npm audit` (server and client) | **0 known vulnerabilities** on both, as of 2026-08-30 (after remediating 1 high-severity server CVE and 4 client CVEs — see `internal-audit-report.md` F9) |
| Fail-closed startup validation | Direct check: `validateEnv()` invoked with `JWT_SECRET=''` | Confirmed: process exits with `❌ Refusing to start: unsafe security configuration` |

## 3. Configuration evidence

| Requirement | Evidence |
|---|---|
| Secrets excluded from version control | `server/.gitignore`, `client/.gitignore` both list `.env` |
| Required environment variables documented without real values | `server/.env.example` |
| Rate-limit configuration | `server/app.js` (global), `server/routes/auth.js` (login-specific) |

## 4. Policy evidence

All 17 policies exist as first drafts under `docs/iso27001/01-…` through `docs/iso27001/17-…`. **EVIDENCE REQUIRED — NOT YET AVAILABLE:** formal approval/sign-off by [APPROVER], staff acknowledgement records, or any completed policy review cycle. These are drafts awaiting governance action, not yet operational policies.

## 5. Procedure evidence

| Document | Status |
|---|---|
| `docs/backup-and-recovery.md` | Drafted this session. **EVIDENCE REQUIRED — NOT YET AVAILABLE:** an actual backup has never been taken; the procedure has never been executed. |
| `docs/business-continuity.md` | Drafted this session. **EVIDENCE REQUIRED — NOT YET AVAILABLE:** no continuity exercise has been run. |
| `docs/disaster-recovery.md` | Drafted this session. **EVIDENCE REQUIRED — NOT YET AVAILABLE:** no DR test/restore has ever been performed. |
| `docs/incident-response-plan.md` | Drafted this session. **EVIDENCE REQUIRED — NOT YET AVAILABLE:** no real or simulated incident has been run through this plan. |
| `docs/iso27001/secure-development-lifecycle.md` | Drafted this session, partially evidenced by the two real regression suites and the `npm audit` remediation performed live in this engagement. |

## 6. Risk-record evidence

| Document | Status |
|---|---|
| `docs/iso27001/risk-assessment.md` | 20 risks assessed with inherent/residual scoring, evidence-cited per row. First version — not yet reviewed by [ORGANIZATION NAME] stakeholders beyond this technical pass. |
| `docs/iso27001/risk-treatment-plan.md` | 12 prioritized treatment actions, 5 already completed this session with evidence, 7 open with proposed (not committed) target dates. |

## 7. Audit-log example evidence

Live-verified during this session (via automated test, not fabricated): `DOCUMENT_REQUIREMENTS_COMPLETED`, `DOCUMENT_VERIFIED`, `DOCUMENT_REJECTED` were each confirmed present in the audit log by direct API query (`GET /api/audit?action=...`) against real records created during the test run. Login/login-failed, compensation-approval, and policy-publish audit entries were similarly exercised by the broader smoke-test suite (143 assertions), though not every individual action type was queried back by a dedicated assertion — see `internal-audit-report.md` F14 for the corresponding limitation.

## 8. Access-control / security-test evidence

Covered comprehensively under Section 2 above — this is the same evidence, not a separate body of proof. Specifically relevant rows: cross-employee IDOR denial, password-field non-exposure, forged-session rejection, spoofed-file-type rejection, and the extensive role-based authorization assertions in both suites (e.g. "EMPLOYEE cannot approve a leave request," "HR_ADMIN cannot approve their own compensation request," "FINANCE cannot approve a compensation request").

## 9. Deployment evidence

**EVIDENCE REQUIRED — NOT YET AVAILABLE.** No production deployment exists. This session verified the application running locally only (Windows, local MongoDB service, `node server.js`). No hosting provider, domain, TLS certificate, or CI/CD pipeline has been evidenced.

## 10. Backup-test evidence

**EVIDENCE REQUIRED — NOT YET AVAILABLE.** See Section 5 — no backup has ever been taken, so none has ever been restored or tested.

## 11. Incident-exercise evidence

**EVIDENCE REQUIRED — NOT YET AVAILABLE.** No tabletop exercise or real incident has been run through `docs/incident-response-plan.md`.

## 12. Training evidence

**EVIDENCE REQUIRED — NOT YET AVAILABLE.** No security-awareness training program exists yet (tracked as risk R18 / SoA control 6.3).

## 13. Review / approval evidence

**EVIDENCE REQUIRED — NOT YET AVAILABLE.** No management review (see `management-review-template.md` — a blank template) has yet been conducted. No policy in `docs/iso27001/` has a real approval signature; all carry the `[APPROVER]` placeholder.

---

## Summary

Of the 13 evidence categories above, **5 have complete, verifiable evidence today** (source code, test results, configuration, risk records, access-control/security tests), **3 have partial evidence** (policy/procedure drafts exist but lack approval or exercise), and **5 have no evidence yet and are explicitly marked EVIDENCE REQUIRED** (deployment, backup-test, incident-exercise, training, review/approval). This distribution is the honest starting point for [ORGANIZATION NAME]'s certification-readiness journey, not a finished state.
