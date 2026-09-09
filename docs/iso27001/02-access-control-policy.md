# Access Control Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — ISO/IEC 27001:2022 readiness exercise for [ORGANIZATION NAME]. Subordinate to the Information Security Policy (01).

## 1. Purpose

This policy defines how access to the DutyLaunch HRMS application and its data is granted, restricted, reviewed, and revoked, based on the principle of least privilege and role-based access control (RBAC).

## 2. Scope

Applies to all users, roles, and integrations that authenticate to the DutyLaunch HRMS backend (`server/`) and frontend (`client/`), and to all HR, compensation, leave, document, and audit data the application manages.

## 3. Policy Statements

1. **Role-based access control.** Access is granted exclusively through one of seven defined roles: `SUPER_ADMIN`, `CTO`, `HR_ADMIN`, `FINANCE`, `MANAGER`, `EMPLOYEE`, `AUDITOR`. No user is granted permissions outside of these role definitions.

2. **Least privilege.** Each role is scoped to the minimum set of actions required for its function (e.g. `FINANCE` for compensation workflows, `AUDITOR` for read/audit access, `MANAGER` for direct-report actions). Roles must not be assigned more broadly than operationally necessary.

3. **Server-side enforcement only.** All authorization decisions are enforced server-side via the centralized `authorize(...roles)` and `authorizeOwnerOrAdmin()` middleware (`server/middleware/auth.js`), applied per-route in `server/routes/`. Frontend-only role checks (e.g. hiding a UI element) are a usability convenience, never a security control, and must never be relied upon as the sole gate for a sensitive action.

4. **Elevated roles are centrally defined, not hardcoded.** `SUPER_ADMIN` and `CTO` carry equivalent elevated effective permissions via a single `ELEVATED_ROLES` array (`server/utils/roles.js`) and a corresponding `isElevated()` helper, rather than by hardcoded name, email, or ad hoc checks scattered through the codebase. This centralization is itself a control — it ensures elevated-permission logic has one auditable definition site.

5. **No business rule bypass for elevated roles.** Elevated roles (`SUPER_ADMIN`, `CTO`) are still subject to server-side business-rule enforcement. For example, an employee cannot be transitioned to `ACTIVE` status while required documents are incomplete, and this is enforced in `server/controllers/employeeController.js` regardless of the caller's role — verified for `SUPER_ADMIN` and `CTO` specifically, not only for `HR_ADMIN`.

6. **Ownership-scoped access.** Where an action is legitimately self-service or manager-scoped (e.g. an employee viewing their own record, a manager viewing a direct report's), access is additionally constrained by `authorizeOwnerOrAdmin()` rather than by role alone.

7. **Joiner/Mover/Leaver provisioning.** Granting access on hire, changing access on role/role-change ("mover"), and revoking access on termination ("leaver") is governed in detail by policy 17 (Joiner/Mover/Leaver Policy). This policy establishes the requirement that all three events must result in an access change that is reviewed and recorded; policy 17 defines the procedure.

8. **Authentication is a prerequisite, not a substitute, for authorization.** Identity verification (login, session validity) is governed by policy 03 (Password and Authentication Policy) and is not duplicated here. This policy governs what an authenticated identity is subsequently permitted to do.

9. **Periodic access review is required.** Role assignments must be reviewed on a defined periodic cadence to confirm each user's access remains appropriate to their current role and employment status. **Gap:** no scheduled or evidenced access review process currently exists in this repository or at the organizational level. This is a known gap to be closed as part of ISMS maturity, tracked in the Statement of Applicability, with an owner and cadence assigned by [SECURITY OWNER].

10. **Privileged account handling.** `SUPER_ADMIN` and `CTO` accounts must be:
    - Limited in number to the minimum necessary.
    - Assigned to named individuals, not shared or generic accounts (see policy 04 §3 on account-sharing prohibition).
    - Subject to the same authentication controls as all other accounts (policy 03) — no privileged-account exemption from lockout, password policy, or session expiry exists in the current implementation.
    - Included first in any future periodic access review (Statement 9) given the elevated blast radius of compromise.

11. **Seed/demonstration accounts are non-production.** `server/seed/seed.js` creates demonstration accounts across all roles with documented seed passwords (`SEED_ADMIN_PASSWORD` / `SEED_EMPLOYEE_PASSWORD`). These accounts and passwords must never be present in, or used against, a production deployment. Any production environment must disable or remove seed-account provisioning entirely.

12. **Sensitive-field access via reveal actions.** Actions that expose otherwise-masked sensitive data (e.g. revealing a plaintext identity document number, see policy 05/encryption-related policy) are themselves access-controlled and audit-logged, not merely display-level restrictions.

## 4. Roles & Responsibilities

- **[SECURITY OWNER]:** Owns this policy, the RBAC model's ongoing appropriateness, and the (currently missing) periodic access review process.
- **HR_ADMIN:** Initiates access changes tied to hiring, role changes, and terminations, per policy 17.
- **SUPER_ADMIN / CTO:** Execute privileged account and role-assignment changes; subject to the same scrutiny as any other privileged action under Statement 10.
- **Engineering/Development team:** Maintains `server/middleware/auth.js`, `server/utils/roles.js`, and route-level authorization; ensures no route trusts frontend-only checks.
- **All role-holders:** Must use only the access granted to their role for legitimate work purposes (see policy 04).

## 5. Related Evidence in This Repository

- `server/utils/roles.js` — `ELEVATED_ROLES` array and `isElevated()` helper.
- `server/middleware/auth.js` — `authorize(...roles)` and `authorizeOwnerOrAdmin()` middleware.
- `server/routes/` — per-route application of authorization middleware.
- `server/controllers/employeeController.js` — server-side enforcement of the mandatory-document-before-ACTIVE business rule, independent of caller role.
- `server/seed/seed.js` — demonstration/seed accounts, explicitly non-production.
- `server/scripts/smoke-test-business-rules.cjs` — automated regression coverage of CTO elevated-permission behavior and mandatory-document enforcement (75 assertions, currently 100% passing).

## 6. Exceptions

Any request to grant access outside the defined RBAC model, or to exempt an account from a control in this policy, requires written approval from [SECURITY OWNER] with documented business justification and a review date, recorded in the exceptions register established under policy 01.

## 7. Enforcement & Compliance

Compliance is evidenced by the automated test suites listed above and by code review of `server/middleware/auth.js` and `server/routes/`. Violations (e.g. a new route missing authorization middleware) are treated as security defects and remediated before release. Non-compliance by personnel (e.g. attempting to bypass access controls) is subject to policy 04's enforcement provisions.

## 8. Review Cycle

Reviewed at least annually and upon any change to the role model, `ELEVATED_ROLES` definition, or authorization middleware. Next scheduled review: [REVIEW DATE]. The periodic access review process required by Statement 9 must be established, scheduled, and evidenced before this policy can be considered fully implemented.
