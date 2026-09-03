# Secure Development Lifecycle (SDLC)

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]

> Status: ISO/IEC 27001:2022 readiness draft for DutyLaunch HRMS. This
> document describes the lifecycle as it actually operates today —
> practice by practice — and states plainly, without softening, which
> stages are genuine current process and which are not yet achievable.
> [ORGANIZATION NAME] is **not** currently ISO/IEC 27001 certified. This
> document supports Annex A controls 8.25 (Secure development life cycle),
> 8.26 (Application security requirements), 8.28 (Secure coding), 8.29
> (Security testing in development and acceptance), and 8.32 (Change
> management), and should be read alongside policy 07 (Secure Development
> Policy), which governs the coding-level requirements this document's
> lifecycle stages depend on.

## 1. Purpose

This document describes the phases of the software development lifecycle
for DutyLaunch HRMS — from requirements through release — and states, for
each phase, what is genuinely practiced today, what evidence exists, and
what gap remains open. It is written to be read by an auditor alongside
the actual repository, not as an aspirational process description.

## 2. Scope

Applies to all development activity on the DutyLaunch HRMS server
(`server/`, Node/Express/MongoDB) and client (`client/`, React/Vite)
codebases, performed by any engineer working on this project.

## 3. Lifecycle Phases

### 3.1 Requirements Phase

Security requirements for a change are currently derived informally —
from the role model (`server/utils/roles.js`), the data classification
already in place for identity documents and compensation data (policy 05),
and direct review of what a new endpoint or field exposes. There is no
formal, documented security-requirements checklist or template that a
feature must pass through before development begins.

**Gap:** No formalized security-requirements-gathering step (e.g. a
security-requirements checklist attached to each feature or ticket)
exists. **Recommendation:** Once a ticketing/PR workflow exists (Section
3.3), attach a short security-requirements checklist (data classification
touched, new roles/permissions required, new external inputs, new
third-party calls) to the pull-request template.

### 3.2 Threat Modeling

**Current state: no formal, documented threat-modeling exercise has been
performed for this application.** There is no data-flow diagram, no
STRIDE/attack-tree analysis, and no maintained threat register.

That said, this session's own security-hardening work is evidence of *ad
hoc* threat identification and remediation, even though it was not
produced through a named methodology:

- Identification that a hardcoded JWT-secret fallback and an unrotated
  placeholder encryption key were viable authentication-bypass /
  data-exposure vectors, remediated with a fail-fast startup check
  (`server/config/env.js`).
- Identification that a password field could be inadvertently exposed via
  a query projection, remediated at the access-control layer.
- Identification that a spoofed `Content-Type` on a file upload could
  bypass the MIME allowlist, remediated with a magic-byte signature check
  (`server/utils/fileSignature.js`).

**Recommendation:** Conduct and document a formal threat-modeling pass
(even a lightweight STRIDE walkthrough of the authentication, file-upload,
and identity-document-reveal flows would materially close this gap),
and repeat it whenever a new significant data flow or trust boundary is
introduced.

### 3.3 Code Review

**Current state: not achievable.** No git repository or version control
system is currently initialized for this project. There is consequently
no commit history, no pull-request mechanism, no independent-reviewer
sign-off, and no branch protection. The standard control "no code is
merged without independent review" cannot presently be enforced or
evidenced, because there is no merge event to gate.

**Recommendation:** Initialize version control as a prerequisite to any
further SDLC maturity. Once in place: require all changes via
branch + pull/merge request, at least one independent reviewer approval
before merge to the main branch, branch protection preventing direct
pushes to main, and retained review history as audit evidence. This is
the single highest-leverage gap to close, because several of the other
gaps in this document (CI/CD, automated testing gates, dependency
scanning gates) are structurally dependent on version control existing
first.

### 3.4 Dependency Management

Dependencies are checked today via `npm audit` run manually against both
`server/` and `client/`. As of this session, both report **0 known
vulnerabilities**, following upgrades of vite (5.4.21 → 6.4.3),
react-router-dom (6.30.6 → 7.18.3), and nodemailer (6.10.1 → 9.0.6), each
of which previously carried known CVEs. This is a real, evidenced current
process — not aspirational — but it is manual and one-off, run by whoever
is working on the code at the time, rather than gated automatically.

**Gap:** No CI/CD pipeline exists, so there is no automated
dependency-vulnerability scanning gate that runs on every change or on a
schedule; `npm audit` will not be re-run unless someone remembers to run
it. **Recommendation:** Once CI/CD exists (Section 3.7), add `npm audit`
(or an equivalent SCA tool) as an automated pipeline step that fails the
build on new high/critical findings, on every pull request and on a
recurring schedule (e.g. weekly) to catch newly disclosed CVEs in
unchanged dependencies.

### 3.5 Security Testing

Two automated, API-level regression suites currently exist and run
against a live server + MongoDB instance:

- `server/scripts/smoke-test.cjs` — 143 assertions covering the full
  module surface (auth, employees, leave, compensation, documents,
  notifications, audit, etc.).
- `server/scripts/smoke-test-business-rules.cjs` — 75 assertions targeting
  business-rule and security-specific behavior: CTO elevated-permission
  enforcement, the compensation request/approval workflow, mandatory
  -document-before-ACTIVE enforcement, forged-cookie rejection, presence
  of security headers, non-exposure of the password field in API
  responses, and rejection of a spoofed file type.

Both suites currently pass 100% of assertions and were re-run after every
change made this session. This is genuine, repeatable regression testing
and constitutes real evidence of a testing gate in the SDLC — it is just
not yet an *automated* gate, because it is invoked manually rather than
by a CI system.

**Gap:** No SAST (static application security testing), DAST (dynamic
application security testing), or automated secrets-scanning tool is
wired into anything, because there is no pipeline to wire it into.
**Recommendation:** Once CI/CD exists, run both smoke-test suites as a
required, blocking pipeline step on every pull request before merge is
allowed, and layer in a SAST tool (e.g. a Node/JS-aware static analyzer)
and a secrets-scanning tool (e.g. scanning for committed credentials) as
additional pipeline gates.

### 3.6 Secrets Scanning

**Current state: no tooling exists.** There is no automated scan for
committed secrets (API keys, credentials, private keys) in the codebase
or in commit history — and because no version control exists yet
(Section 3.3), there is no commit history to scan in the first place.
Today, secret hygiene relies entirely on discipline: `.env` files are
excluded via `.gitignore` in both `server/` and `client/`, and
`.env.example` documents required variables without real values. The
`server/config/env.js` startup check (added this session) additionally
guards against a class of secret-related defect — a missing or
weak-strength `JWT_SECRET`/`ENCRYPTION_KEY` at process start — but this is
a runtime guard, not a scan of source or history.

**Recommendation:** Once version control exists, add automated
secrets-scanning (e.g. a pre-commit hook and a CI pipeline step) to catch
accidental credential commits before they enter history.

### 3.7 Release Approval, Change Management, and Rollback

**Current state: no formal process exists.** There is no described
change-approval workflow, no staging environment, and no documented
rollback procedure. A "release" today is: someone runs `node server.js`
locally. There is no separation between a development instance and
anything resembling a production instance, and no record of who approved
a change to go live or when.

**Recommendation:** Define, at minimum: a change-approval step (who signs
off before a change reaches whatever is designated as the live
environment — see policy 07 Section 7 for the current manual
[SECURITY OWNER] sign-off requirement as an interim measure), a staging
environment that mirrors production configuration for pre-release
verification, and a documented rollback procedure (how to revert to the
last known-good state, and how database/schema changes are handled on
rollback, given Mongoose does not version schemas).

### 3.8 Production Deployment

**Current state: no production deployment process is evidenced.** There
is no described hosting target, no deployment automation, no environment
separation (dev/staging/prod), and no documented process for how code
reaches a production environment, because none has been established. The
only currently evidenced way to run this application is a local
`node server.js` invocation against a local or configured MongoDB
instance.

**Recommendation:** Before any production deployment is attempted,
document: the hosting provider ([HOSTING PROVIDER]), environment variable
management for production secrets (distinct from the local `.env` file
pattern), a deployment procedure, and how the fail-fast secret validation
in `server/config/env.js` is satisfied in that environment.

## 4. Vulnerability Management Cross-Reference

Ongoing (post-release) vulnerability management — ongoing dependency
monitoring, triage of newly disclosed CVEs against already-deployed
versions, and remediation SLAs — is governed by the Vulnerability
Management Policy
(`docs/iso27001/08-vulnerability-management-policy.md`). That document
does not yet exist in this repository and should be authored as part of
closing the Section 3.4 gap above; this document's dependency-management
section describes only the pre-release, development-time check.

## 5. Roles & Responsibilities

- **Engineering team:** Follows the coding requirements in policy 07;
  runs `npm audit` and both smoke-test suites manually before any change
  is considered complete, until CI/CD automates this.
- **[SECURITY OWNER]:** Owns this document and the Statement of
  Applicability entries tracking each gap above (threat modeling, code
  review, CI/CD, secrets scanning, release/change management, production
  deployment); prioritizes remediation order.
- **[APPROVER]:** Approves this document and any interim manual sign-off
  process used in place of an automated gate.

## 6. Related Evidence in This Repository

- `server/config/env.js` — startup fail-fast validation of `JWT_SECRET`
  and `ENCRYPTION_KEY`.
- `server/utils/fileSignature.js` — magic-byte file-content verification,
  itself a product of ad hoc threat identification this session.
- `server/scripts/smoke-test.cjs`,
  `server/scripts/smoke-test-business-rules.cjs` — the two real,
  currently-passing regression/security-assertion suites.
- `server/package.json`, `client/package.json` — dependency manifests
  covered by the current manual `npm audit` process.
- `.gitignore`, `.env.example` (in `server/` and `client/`) — the current,
  discipline-based secrets-hygiene baseline in the absence of automated
  scanning.
- `docs/iso27001/07-secure-development-policy.md` — the coding-level
  requirements (input validation, injection prevention, upload handling,
  error handling, authentication/secrets) that this lifecycle document's
  phases are built on top of.

## 7. Review Cycle

This document is reviewed at least annually, and immediately upon any of
the following: initialization of version control, establishment of a
CI/CD pipeline, introduction of a staging environment, or a first
documented production deployment — at which point the corresponding gap
statement above must be updated to reflect the new state, not left
stale. Reviewed by [SECURITY OWNER] and approved by [APPROVER]. Next
scheduled review: [REVIEW DATE].
