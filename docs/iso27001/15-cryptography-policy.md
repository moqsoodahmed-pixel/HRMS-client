# Cryptography Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — ISO/IEC 27001:2022 readiness exercise for [ORGANIZATION NAME]. Subordinate to the Information Security Policy (01) and the Data Classification Policy (05). Supports Annex A control 8.24 (Use of cryptography).

## 1. Purpose

This policy defines the cryptographic algorithms, key management practices, and transport-security requirements used to protect data processed by DutyLaunch HRMS, and records where current implementation meets, falls short of, or requires evidence beyond, this policy's requirements.

## 2. Scope

Applies to all cryptographic mechanisms used by the DutyLaunch HRMS backend (`server/`): encryption of data at rest, password hashing, authentication token signing, and transport encryption for data in transit. Does not cover cryptography used by third-party infrastructure (e.g. a hosting provider's disk encryption) except where explicitly noted as evidence required at deployment.

## 3. Policy Statements

### Encryption at rest

1. **Identity documents.** RESTRICTED-tier identity numbers (Aadhaar, PAN, Passport, Driving Licence, Voter ID — see policy 05 §4) are encrypted at rest using AES-256-GCM, implemented in `server/utils/encryption.js`. Each value is encrypted with a randomly generated 16-byte IV and authenticated with a GCM tag; the stored format (`iv:tag:ciphertext`, hex-encoded) is not reused across values, and authentication-tag verification means tampered ciphertext fails to decrypt rather than silently returning corrupted plaintext.
2. **Password storage.** Passwords are never encrypted (reversible) — they are hashed one-way using bcrypt with a cost factor of 12 (`server/controllers/authController.js`). This is deliberate: encryption is used only where the plaintext must later be recoverable (identity documents); hashing is used where it must never be recoverable (passwords).
3. **Uploaded binary documents.** Files uploaded under `server/uploads/` (e.g. scanned bank proofs, certificates) are stored with non-guessable, UUID-based filenames outside the web root (`server/services/storageService.js`) as an access-obscurity control, but are **not currently encrypted at the file level**. This is a gap relative to the RESTRICTED-tier storage requirement in policy 05 §5.4 and is tracked in the Statement of Applicability. Filesystem- or disk-level encryption at the hosting layer (see Statement 9) is a partial compensating control once a hosting provider is selected, but is not a substitute for application-level encryption of the most sensitive uploaded content.

### Authentication token signing

4. Session tokens are JSON Web Tokens (JWTs) signed with a shared secret (`JWT_SECRET`) via the `jsonwebtoken` library's `jwt.sign(...)` call in `server/controllers/authController.js`. **No `algorithm` option is explicitly set on this call**, which means the library's default signing algorithm (HS256, HMAC-SHA256) applies implicitly rather than by explicit policy decision.
5. **Hardening recommendation (not yet implemented):** the signing algorithm should be pinned explicitly (`{ algorithm: 'HS256', expiresIn }`) at both `jwt.sign` and the corresponding `jwt.verify` call, rather than relying on library defaults. Pinning the algorithm on verification is a well-known mitigation against JWT "algorithm confusion" attacks (e.g. a token forged with `alg: none` or an attacker-supplied asymmetric public key mistaken for an HMAC secret) and should be adopted as a low-cost hardening step. This is a recommendation, not a currently implemented control.
6. `JWT_SECRET` must be a high-entropy random value of at least 32 characters (enforced at startup — see Statement 8) and must never be reused as, or derived from, any other application secret (e.g. `ENCRYPTION_KEY`).

### Key management

7. **Keys are sourced exclusively from environment variables.** `JWT_SECRET` and `ENCRYPTION_KEY` are read only from `process.env` at runtime; a repository-wide review during this readiness exercise confirmed no cryptographic key or secret is hardcoded as a fallback value in application source code. The one exception found — a hardcoded fallback JWT secret, compounded by an unrotated literal placeholder value (`your_jwt_secret_key_here`) present in the `.env` file on disk — has been remediated: the fallback was removed, startup validation was added (Statement 8), and the on-disk secret was rotated to a strong random value. This incident is recorded here, and in policy 03 §15, as the reason startup validation exists.
8. **Fail-fast startup validation.** `server/config/env.js` validates, before the server accepts any request, that `JWT_SECRET` is set and at least 32 characters, and that `ENCRYPTION_KEY` is set and exactly 64 hex characters (a 256-bit key). If either check fails, the process logs the specific problem and exits (`process.exit(1)`) rather than starting with a weak or absent key.
9. **No formal key-rotation procedure exists today.** There is currently no documented cadence, procedure, or tooling for rotating `JWT_SECRET` or `ENCRYPTION_KEY` in a running production system (rotating `ENCRYPTION_KEY` in particular requires a re-encryption migration of all existing ciphertext, since `decrypt()` in `server/utils/encryption.js` assumes a single current key). The following is a **PROPOSED**, not-yet-adopted, starting point for [SECURITY OWNER] to formalize:
   - **PROPOSED:** Rotate `JWT_SECRET` at minimum annually, or immediately upon suspected compromise; because there is no session-revocation list (policy 03 §13), rotating `JWT_SECRET` has the useful side effect of invalidating all previously issued tokens at once, and should be considered as an emergency containment action.
   - **PROPOSED:** Rotate `ENCRYPTION_KEY` on a defined cadence (e.g. every 12–24 months) via a versioned-key scheme (e.g. prefixing stored ciphertext with a key identifier) so old ciphertext can still be decrypted with its original key during a migration window — this versioning does not exist today and would require a code change before rotation is operationally safe.
   - **PROPOSED:** Maintain a documented, access-controlled record of when each key was last rotated and by whom, owned by [SECURITY OWNER].
10. Secrets must be provisioned to the running environment (e.g. via the hosting platform's secret manager or environment configuration) and must never be committed to version control. (Version control does not yet exist for this project at all — see policy 01 §8 — so this is a forward-looking requirement to be enforced once a repository exists.)

### Encryption in transit

11. All network transmission of DutyLaunch HRMS traffic — client-to-server API calls and any server-to-third-party calls (e.g. outbound email via `server/services/emailService.js`) — must use TLS. **TLS enforcement is an infrastructure/hosting-layer control, not something implemented in this application's own code** (the Express server does not itself terminate TLS in this codebase's current form). This requirement is therefore marked **EVIDENCE REQUIRED AT DEPLOYMENT**: once [HOSTING PROVIDER] is selected, [SECURITY OWNER] must confirm and document (a) TLS termination in front of the application, (b) a currently-supported TLS version and cipher suite configuration, and (c) that the `secure` cookie flag (already conditionally set for `NODE_ENV === 'production'` in `server/controllers/authController.js`) is effective in that environment — i.e. that the app genuinely sees HTTPS-terminated requests in production, not plaintext HTTP behind a misconfigured proxy.
12. Until the evidence in Statement 11 is obtained, TLS-in-transit must be treated as a planned control, not a verified one, in any Statement of Applicability derived from this document.

## 4. Roles & Responsibilities

- **[SECURITY OWNER]:** Owns this policy; owns formalizing the PROPOSED key-rotation procedure (Statement 9) into an adopted one; owns obtaining and recording the TLS deployment evidence (Statement 11) once hosting is selected.
- **Engineering/Development team:** Maintains `server/utils/encryption.js`, `server/config/env.js`, and `server/controllers/authController.js`; implements the JWT algorithm-pinning hardening (Statement 5) and any key-versioning scheme required to make key rotation (Statement 9) operationally safe.
- **[HOSTING PROVIDER] (once selected):** Responsible for TLS termination and configuration per Statement 11; evidence of this must be obtained and recorded by [SECURITY OWNER], not assumed.

## 5. Related Evidence in This Repository

- `server/utils/encryption.js` — AES-256-GCM implementation for identity-document encryption at rest.
- `server/controllers/authController.js` — bcrypt cost-12 password hashing; `jwt.sign(...)` call with no explicit `algorithm` option (implicit HS256).
- `server/config/env.js` — fail-fast startup validation of `JWT_SECRET` and `ENCRYPTION_KEY`.
- `server/services/storageService.js` — non-guessable filenames for uploaded documents (access-obscurity control; not file-level encryption — see Statement 3 gap).
- `docs/iso27001/03-password-and-authentication-policy.md` §14–16 — the JWT-secret/`.env` remediation history referenced in Statement 7.
- **NONE — gap:** no key-rotation tooling, key-versioning scheme, or documented rotation cadence exists (Statement 9). No TLS-termination configuration exists in this application's own code (Statement 11).

## 6. Exceptions

Any request to use a cryptographic mechanism, key source, or transport configuration outside this policy (e.g. a third-party integration requiring a different signing algorithm) requires written approval from [SECURITY OWNER], documented with justification and a review date, recorded in the exceptions register established under policy 01.

## 7. Enforcement & Compliance

Compliance is evidenced by code review of `server/utils/encryption.js`, `server/config/env.js`, and `server/controllers/authController.js`, and by the startup-time refusal to run with weak or missing keys. Discovery of a hardcoded fallback key, a committed secret, or an unpinned/insecure algorithm change is treated as a security defect to be remediated before release, consistent with the incident recorded in Statement 7.

## 8. Review Cycle

Reviewed at least annually, immediately upon any change to `server/utils/encryption.js` or the JWT signing/verification logic, and immediately once [HOSTING PROVIDER] is selected (to close out the TLS evidence requirement in Statement 11). Next scheduled review: [REVIEW DATE]. The PROPOSED key-rotation procedure (Statement 9) and the JWT algorithm-pinning recommendation (Statement 5) must be tracked to adoption or formal risk-acceptance by [SECURITY OWNER].
