# Risk Treatment Plan — DutyLaunch HRMS

Document Owner: [SECURITY OWNER] · Approved by: [APPROVER] · Version: 1.0 (Draft) · Last Reviewed: [REVIEW DATE]

This plan prioritizes treatment of the risks recorded in `risk-assessment.md`, in support of ISO/IEC 27001:2022 Clause 6.1.3 (risk treatment). Target dates below are **PROPOSED** illustrative timeframes, not commitments — [APPROVER] must set real dates during management review (`management-review-template.md`).

## 1. Treatment options used

Each risk is treated by one of: **Modify** (reduce likelihood/impact via a control), **Retain** (accept the residual risk as adequate), **Avoid** (stop the activity), **Share** (transfer, e.g. insurance or a supplier contract). All risks below are treated by **Modify**, except where noted.

## 2. Prioritized treatment actions

| Priority | Risk ID | Action | Type | Target date | Owner | Status |
|----------|---------|--------|------|--------------|-------|--------|
| 1 | R8 | Implement automated MongoDB + uploads-directory backups per `docs/backup-and-recovery.md`; verify a real restore at least once before relying on it | Modify | [TARGET DATE — PROPOSED: within 30 days of hosting decision] | [SECURITY OWNER] | Not started |
| 2 | R9 | Initialize version control (git) for the source tree, excluding `.env` and `server/uploads/` (already covered by existing `.gitignore` patterns); adopt a mandatory code-review step before merge | Modify | [TARGET DATE — PROPOSED: before any further code changes ship] | [SECURITY OWNER] | Not started — organizational decision required (see note below) |
| 3 | R16 | Stand up centralized log shipping and basic alerting (failed-login spikes, 5xx error rate, audit-log write failures) once a hosting provider is chosen | Modify | [TARGET DATE — PROPOSED: within 60 days of production hosting go-live] | [SECURITY OWNER] | Not started |
| 4 | R1 | Evaluate and roll out MFA for SUPER_ADMIN, CTO, and FINANCE roles at minimum | Modify | [TARGET DATE — PROPOSED: next major release] | [SECURITY OWNER] | Not started |
| 5 | R13 | Design and implement session/token revocation (deny-list or `tokenVersion` claim) so deactivating a user immediately invalidates any already-issued session | Modify | [TARGET DATE — PROPOSED: next major release] | [SECURITY OWNER] | Not started |
| 6 | R17 | Exercise the disaster-recovery plan (`docs/disaster-recovery.md`) end-to-end in a non-production environment | Modify | [TARGET DATE — PROPOSED: within 30 days of R8 completion] | [SECURITY OWNER] | Blocked on R8 |
| 7 | R5 | Add malware/antivirus scanning of uploaded files before they are ever served back to another user | Modify | [TARGET DATE — PROPOSED: next major release] | [SECURITY OWNER] | Not started |
| 8 | R18 | Establish a security-awareness training program for all staff, with phishing-simulation exercises | Modify | [TARGET DATE — PROPOSED: [REVIEW DATE] cycle] | [SECURITY OWNER] / [TRAINING PROVIDER] | Not started |
| 9 | R14 | Adopt the supplier-review process in `13-supplier-security-policy.md` for the SMTP provider and any future hosting/SaaS vendor; consider replacing the "temporary password by email" welcome flow with a forced first-login reset link | Modify | [TARGET DATE — PROPOSED: next minor release] | [SECURITY OWNER] | Not started |
| 10 | R15 | Perform a systematic code-level sweep confirming every sensitive-mutation endpoint calls the audit service (today's coverage is verified only for the specific actions the two smoke-test suites exercise) | Modify | [TARGET DATE — PROPOSED: next minor release] | [SECURITY OWNER] | Not started |
| 11 | R2 | Pin the JWT signing algorithm explicitly (`HS256`) rather than relying on the `jsonwebtoken` library default; define a key-rotation cadence for `JWT_SECRET`/`ENCRYPTION_KEY` | Modify | [TARGET DATE — PROPOSED: next minor release] | [SECURITY OWNER] | Not started |
| 12 | R10 | Add `npm audit` (or equivalent) as a recurring/CI-gated check rather than a one-off manual run | Modify | [TARGET DATE — PROPOSED: once CI/CD (R9) exists] | [SECURITY OWNER] | Not started — blocked on R9 |

## 3. Already treated this session (no further action required at this time)

| Risk ID | What was done | Evidence |
|---------|----------------|----------|
| R2 (critical portion) | Removed the insecure `\|\| 'secret'` JWT fallback in both sign and verify calls; added a fail-closed startup validator (`server/config/env.js`) requiring `JWT_SECRET` ≥32 chars and a valid 64-hex-char `ENCRYPTION_KEY`; rotated the actual `.env` value, which had contained the literal unrotated placeholder `your_jwt_secret_key_here` | `server/config/env.js`, `server/middleware/auth.js`, `server/controllers/authController.js`; verified by a fail-closed unit check and full regression (143/143, 75/75) |
| — (defense in depth) | Added `select: false` to the `User.password` field so it is never returned by a default Mongoose query | `server/models/User.js`; verified by regression |
| R5 (partial) | Added file-content magic-byte signature verification against the declared MIME type for both document and photo uploads | `server/utils/fileSignature.js`, wired into `server/controllers/documentController.js` and `server/controllers/employeeController.js`; verified by a new automated test (spoofed-upload rejection) |
| R10 | Upgraded `vite` 5.4.21→6.4.3, `react-router-dom` 6.30.6→7.18.3, `nodemailer` 6.10.1→9.0.6 | `client/package.json`, `server/package.json`; `npm audit` now reports 0 known vulnerabilities on both; full regression re-verified after each upgrade |
| (test reliability, not a security risk) | Fixed a flaky smoke-test date-collision bug (holiday-creation test used only a 27-value date pool, causing real collisions across repeated runs against a persistent database) | `server/scripts/smoke-test.cjs` |

## 4. Note on R9 (version control)

This is deliberately left as an organizational decision rather than something this session executed unilaterally: initializing git, choosing a remote, and deciding what (if anything) from `server/uploads/` or historical `.env` values should ever be considered "safe" to have existed on disk are decisions with real consequences that belong to [SECURITY OWNER] / [APPROVER], not something to be silently done as a side effect of a security review.

## 5. Review cycle

This plan is reviewed at every management review (`management-review-template.md`) and whenever a new High/Critical risk is added to the register.
