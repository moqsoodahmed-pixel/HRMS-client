# Password and Authentication Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — ISO/IEC 27001:2022 readiness exercise for [ORGANIZATION NAME]. Subordinate to the Information Security Policy (01) and referenced by the Access Control Policy (02).

## 1. Purpose

This policy defines how identity is verified for access to the DutyLaunch HRMS application: password requirements, credential storage, session/token management, account lockout, and multi-factor authentication posture.

## 2. Scope

Applies to all authentication paths in the DutyLaunch HRMS backend (`server/`), including login, password reset, and password change, for all seven roles defined in policy 02.

## 3. Policy Statements

### Authentication mechanism

1. Authentication is performed via email and password. There is no support for social login, SSO, or API-key authentication at this time.
2. Login failures return a generic "Invalid email or password" message. The application does not indicate whether the failure was due to an unknown email or an incorrect password, mitigating user-enumeration risk.
3. Both successful (`LOGIN`) and failed (`LOGIN_FAILED`) authentication events are written to the append-only audit log.

### Password requirements

4. Passwords must be a minimum of 8 characters and contain at least one uppercase letter, one lowercase letter, one digit, and one special character. This is enforced via Zod schema validation in `server/controllers/authController.js`, applied consistently to both password reset and password change flows.
5. Formal periodic password rotation (e.g. forced expiry every N days) is **not currently implemented or required** by this policy. Current industry guidance (e.g. NIST 800-63B) favors complexity/breach-monitoring over mandatory rotation; [SECURITY OWNER] should revisit this stance if a specific regulatory or contractual obligation requires rotation.

### Credential storage

6. Passwords are hashed using bcrypt with a cost factor of 12. Plaintext passwords are never stored or logged.
7. The `password` field on the User model is defined with `select: false`, meaning it is never returned by default Mongoose queries. It must be explicitly opted into with `.select('+password')`, and only the login and change-password code paths do so. This reduces the risk of accidental password-hash disclosure through an unrelated query or API response.

### Account lockout

8. After 5 consecutive failed login attempts, an account is locked for 30 minutes. This limits the effectiveness of online password-guessing attacks against a single account.
9. Login is additionally protected by a dedicated rate limiter on `/api/auth/login` (15-minute window), in addition to the application's global API rate limiter, to constrain distributed or scripted login attempts.

### Password reset

10. Password reset uses an emailed, time-limited token with a 1-hour expiry. Reset tokens are single-purpose and must not be reusable after expiry or after a successful reset.

### Session and token management

11. Successful authentication issues a JSON Web Token (JWT) stored in an httpOnly cookie (`sameSite: 'lax'`, `secure: true` in production). Because the cookie is httpOnly, the token is not accessible to client-side JavaScript, reducing exposure to XSS-based token theft.
12. Default session/token expiry is 30 minutes; a user may opt into a 7-day expiry via "remember me". Shorter default expiry reduces the exposure window if a session is compromised; the longer opt-in expiry is a deliberate usability/security trade-off that should be periodically reassessed by [SECURITY OWNER].
13. There is currently no server-side session revocation list (e.g. to force-invalidate a JWT before its natural expiry, such as on password change or administrative lockout). **Gap:** this should be evaluated and tracked in the Statement of Applicability, particularly given the 7-day "remember me" window.

### Secret management

14. `JWT_SECRET` (required to be at least 32 random characters) and `ENCRYPTION_KEY` (64 hex characters / 256-bit) are validated at process startup by `server/config/env.js`. The server refuses to start if either secret is missing or fails the strength check.
15. This fail-fast validation was introduced to remediate a previously identified weakness: the application formerly contained an insecure hardcoded fallback JWT secret in code, and — separately and more critically — the `.env` file on disk contained the literal, unrotated placeholder value `your_jwt_secret_key_here`. Both issues have been fixed and the secret has been rotated. This history is recorded here as an example of the kind of configuration drift this control is designed to prevent going forward.
16. Secrets (`JWT_SECRET`, `ENCRYPTION_KEY`, database credentials, seed-account passwords) must never be committed to version control or hardcoded as fallback values in source code. **Note:** version control itself is not yet in place for this project at all — see policy on Change Management / Secure Development for that gap — so this statement is a forward-looking control to be enforced once a repository and code review process exist.

### Multi-factor authentication

17. **Multi-factor authentication (MFA) is not currently implemented.** This is a genuine gap, not a partially-implemented control. Given that `SUPER_ADMIN` and `CTO` accounts carry elevated effective permissions (policy 02), MFA for privileged accounts at minimum should be prioritized in the risk treatment plan and tracked in the Statement of Applicability. Until implemented, compensating controls are: bcrypt cost-12 hashing, account lockout, login rate limiting, and audit logging of login/login-failed events.

## 4. Roles & Responsibilities

- **[SECURITY OWNER]:** Owns this policy, the secret-rotation process, and prioritization of the MFA gap.
- **Engineering/Development team:** Maintains `server/config/env.js`, `server/controllers/authController.js`, and the bcrypt/JWT implementation; ensures no fallback secrets are ever reintroduced.
- **All users:** Responsible for choosing a compliant password and not sharing credentials (see policy 04 §3).
- **HR_ADMIN / SUPER_ADMIN / CTO:** Responsible for ensuring seed/demonstration credentials (`SEED_ADMIN_PASSWORD`, `SEED_EMPLOYEE_PASSWORD`) are never used in a production environment.

## 5. Related Evidence in This Repository

- `server/controllers/authController.js` — password complexity (Zod schema), login, password reset, and password change logic.
- `server/config/env.js` — fail-fast startup validation of `JWT_SECRET` and `ENCRYPTION_KEY`.
- `server/models/User.js` (or equivalent User model) — `password` field with `select: false`; bcrypt cost-12 hashing.
- Account lockout and rate-limiting middleware applied to `/api/auth/login`.
- `AuditLog` collection — records of `LOGIN` and `LOGIN_FAILED` events.
- `server/scripts/smoke-test-business-rules.cjs` — includes password/security-header/forged-cookie/file-signature checks added this session.
- `server/seed/seed.js` — non-production seed accounts and passwords.

## 6. Exceptions

Any deviation (e.g. a service account with a non-expiring token, or an exemption from lockout) requires written approval from [SECURITY OWNER], documented with justification and a review date.

## 7. Enforcement & Compliance

Compliance is evidenced by `server/scripts/smoke-test-business-rules.cjs` (currently 100% passing, including password/session/lockout-adjacent checks) and by the startup-time refusal to run with weak or missing secrets. Any reintroduction of a hardcoded fallback secret, or discovery of a plaintext secret committed to a file, is treated as a critical security incident under policy 09.

## 8. Review Cycle

Reviewed at least annually and immediately upon any authentication-related incident, secret rotation, or change to `server/config/env.js` / `server/controllers/authController.js`. Next scheduled review: [REVIEW DATE]. The MFA gap (Statement 17) and session-revocation gap (Statement 13) must be re-assessed at each review until closed or formally risk-accepted.
