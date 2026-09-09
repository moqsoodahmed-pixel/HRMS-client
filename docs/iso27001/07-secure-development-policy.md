# Secure Development Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]

> Status: ISO/IEC 27001:2022 readiness draft for DutyLaunch HRMS. Describes
> secure coding practices actually followed in this codebase today, alongside
> process controls (code review, CI gating) that are **not yet achievable**
> because no version control system is currently initialized for this
> project. This is stated plainly, not implied to exist.

## 1. Purpose

This policy defines secure software development requirements for DutyLaunch
HRMS, supporting ISO/IEC 27001:2022 Annex A control 8.25 (Secure development
life cycle), 8.28 (Secure coding), and 8.29 (Security testing in development
and acceptance).

## 2. Scope

Applies to all code in the DutyLaunch HRMS server (Node/Express) and client
(React/Vite) applications, and to all engineers who write or modify it.

## 3. Policy Statements

### 3.1 Input Validation

1. Every write endpoint must validate and allowlist its input fields using a
   Zod schema before touching the database. This is already the pattern
   across `server/controllers/*.js`.
2. Update endpoints must use a `.partial()` of the corresponding create
   schema so that only explicitly defined fields can be modified — unknown
   or sensitive fields (e.g. role, salary approval flags) cannot be
   mass-assigned via a crafted request body.
3. Any new endpoint accepting user input must follow the same pattern before
   it can be merged/deployed. An endpoint that writes to the database
   without a Zod schema is a policy violation.

### 3.2 Injection Prevention

4. `express-mongo-sanitize` is applied globally in `server/app.js` and
   strips MongoDB operator injection (e.g. `$where`, `$gt` keys) from all
   incoming request data. This must remain enabled for all routes; any route
   that needs to bypass it requires explicit, documented justification and
   [SECURITY OWNER] sign-off.
5. All database access goes through Mongoose models rather than raw
   driver queries with string-built filters, reducing injection surface.
6. All identifiers used to look up a specific record must be validated as
   real MongoDB ObjectIds before use (`assertObjectId` in
   `server/utils/helpers.js`), rather than passed to Mongoose unchecked.

### 3.3 File Upload Handling

7. Uploaded file types must be restricted to an explicit MIME-type allowlist
   (PDF, JPEG, PNG, DOCX, XLSX, legacy XLS, CSV), enforced in
   `server/middleware/upload.js`, with a 10MB limit for documents and 2MB for
   profile photos.
8. Uploaded file content must be verified against its declared MIME type via
   magic-byte/signature check (`server/utils/fileSignature.js`) so a
   mislabeled executable or script cannot be stored and later served back
   under an allowed Content-Type; a mismatch is rejected with
   `INVALID_FILE_TYPE`.
9. Files are received via `multer` memory storage (never written to disk
   under a client-supplied name) and persisted under a generated UUID
   filename with an extracted, validated extension
   (`server/services/storageService.js`), preventing path traversal and
   filename-based attacks.
10. Uploaded files must be stored outside the web root (`server/uploads/`)
    and served only through an authenticated, authorized application route —
    never as static files directly reachable by URL.

### 3.4 Error Handling and Information Disclosure

11. Errors returned to clients must never include stack traces or internal
    error details in production; this is enforced centrally in
    `server/middleware/errorHandler.js`, which returns a generic message to
    the client while logging the full error server-side via
    `console.error`.
12. New error paths must raise through the existing error-handling
    middleware (e.g. via `AppError`) rather than introducing ad hoc
    `res.status().json()` calls that might leak internal detail.

### 3.5 Authentication, Authorization, and Secrets

13. All protected routes must go through the centralized authentication
    middleware (`server/middleware/auth.js`) and role-based authorization
    middleware (`server/middleware/roles.js`) rather than implementing
    ad hoc checks in individual controllers.
14. Passwords must be stored only as bcrypt hashes, never in plaintext or
    reversibly encrypted form.
15. `JWT_SECRET` (minimum 32 characters) and `ENCRYPTION_KEY` (64 hex
    characters / 256-bit) must be validated at process startup
    (`server/config/env.js`); the server must refuse to start if either is
    missing or fails the strength check. No hardcoded fallback secret may
    ever be reintroduced — this was previously a real defect (an insecure
    hardcoded fallback existed, and the on-disk `.env` contained an
    unrotated placeholder value) and has been fixed and rotated as of this
    session.
16. `.env` files must remain excluded from version control via `.gitignore`
    in both `server/` and `client/`. `.env.example` must document required
    variables and generation instructions without ever containing real
    secret values.
17. Secrets must never be logged, including in error logs, audit logs, or
    console output.
18. Identity numbers and other RESTRICTED-tier data must be encrypted at
    rest with AES-256-GCM (`server/utils/encryption.js`) and returned to
    clients masked by default, with plaintext exposed only through an
    explicit, audited reveal action — never returned in bulk list responses.

### 3.6 Code Review

19. **Current state: not achievable.** No git repository or version control
    system is currently initialized for this project. There is no commit
    history, no pull-request mechanism, no reviewer sign-off trail, and no
    branch protection. This means the standard control "no code is merged
    without independent review" cannot presently be enforced or evidenced.
20. Once version control is initialized, this policy requires: all changes
    made via a branch and pull/merge request; at least one independent
    reviewer approval before merge to the main branch; branch protection
    preventing direct pushes to main; and a retained review history as
    audit evidence.

### 3.7 Dependency Management

21. Dependencies must be kept free of known vulnerabilities as reported by
    `npm audit` on both `server` and `client`. As of this session, both
    report 0 known vulnerabilities, following upgrades of vite (5→6.4.3),
    react-router-dom (6→7.18.3), and nodemailer (6→9.0.6), each of which
    previously carried known CVEs.
22. **Current state: no automated gate.** This session's `npm audit` run was
    a manual, one-off check. There is no CI/CD pipeline, and therefore no
    automated dependency-vulnerability scanning gate that runs on every
    change or on a schedule. Until a pipeline exists, `npm audit` must be run
    manually before any release and its output reviewed by the
    [SECURITY OWNER] or their delegate.
23. New dependencies must be reviewed for maintenance status and known
    vulnerabilities before being added.

### 3.8 Testing

24. Automated API-level regression suites must pass before any change is
    considered complete: `server/scripts/smoke-test.cjs` (143 assertions)
    and `server/scripts/smoke-test-business-rules.cjs` (75 assertions,
    including dedicated security checks). Both currently pass 100% and were
    re-run after every change made this session.
25. Security-relevant behavior changes (e.g. to upload validation, auth, or
    encryption) must have a corresponding assertion added to one of these
    suites where practical.
26. **Current state: no SAST/DAST/secrets-scanning tooling.** Static
    application security testing, dynamic testing, and automated
    secrets-scanning are not wired into any pipeline, because no pipeline
    exists. This is a gap to be closed once CI/CD is established (see
    Section 6 of the Vulnerability Management Policy).

## 4. Roles & Responsibilities

- **Engineering team:** Follows the coding requirements in Section 3;
  responsible for running `npm audit` and the smoke-test suites before
  release until automation exists.
- **[SECURITY OWNER]:** Maintains this policy, tracks the code-review and
  CI/CD gaps in the Statement of Applicability, prioritizes remediation.
- **[APPROVER]:** Approves this policy and any exception to it.

## 5. Related Evidence in This Repository

- `server/controllers/*.js` — Zod validation on write endpoints, `.partial()`
  schemas on update endpoints.
- `server/app.js` — global `express-mongo-sanitize` application.
- `server/utils/helpers.js` (`assertObjectId`) — ObjectId validation before
  DB lookup.
- `server/middleware/upload.js` — MIME allowlist, file size limits, memory
  storage.
- `server/utils/fileSignature.js` — magic-byte verification against
  declared MIME type.
- `server/services/storageService.js` — UUID-based filenames, storage
  outside the web root.
- `server/middleware/errorHandler.js` — no stack traces to clients in
  production; server-side logging via `console.error`.
- `server/middleware/auth.js`, `server/middleware/roles.js` — centralized
  authentication and authorization.
- `server/config/env.js` — startup validation of `JWT_SECRET` and
  `ENCRYPTION_KEY`.
- `server/utils/encryption.js` — AES-256-GCM encryption and masking of
  identity numbers.
- `.gitignore` (in `server/` and `client/`), `.env.example` — secrets
  excluded from version control, with documented but non-real example
  values.
- `server/scripts/smoke-test.cjs`, `server/scripts/smoke-test-business-rules.cjs`
  — automated regression/security assertion suites.

## 6. Exceptions

Any deviation from Section 3 (e.g. bypassing `express-mongo-sanitize` for a
specific route, adding a dependency with a known low-severity advisory)
requires written justification and approval from the [SECURITY OWNER],
recorded with a review date.

## 7. Enforcement & Compliance

Code that does not meet Section 3 requirements should not be deployed. Until
a formal review gate exists (Section 3.6), the [SECURITY OWNER] or a
delegated reviewer must manually confirm compliance before any release.

## 8. Review Cycle

This policy is reviewed at least annually, and immediately upon
initialization of version control or a CI/CD pipeline (at which point
Sections 3.6, 3.7, and 3.8's gap statements must be updated to reflect the
new state), by the [SECURITY OWNER] and approved by the [APPROVER].
