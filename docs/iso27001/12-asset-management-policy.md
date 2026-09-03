# Asset Management Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — prepared as part of an ISO/IEC 27001:2022 readiness exercise. [ORGANIZATION NAME] is **not** currently ISO/IEC 27001 certified.

## 1. Purpose

This policy establishes governance requirements for identifying, owning, classifying, and managing the lifecycle of information assets associated with the DutyLaunch HRMS application. It does not itself list individual assets — the authoritative inventory is maintained at `docs/iso27001/asset-inventory.md`, which this policy governs.

## 2. Scope

Covers information assets relevant to the HRMS, including (at a category level — see the inventory for specifics): application code repositories, runtime environments, databases, uploaded document storage, secrets/credentials (`JWT_SECRET`, `ENCRYPTION_KEY`, SMTP credentials, database connection strings), third-party dependencies, and any future infrastructure/hosting assets.

## 3. Policy Statements

1. **An asset inventory must be maintained and kept current.** The authoritative inventory is `docs/iso27001/asset-inventory.md`. Every asset in scope (Section 2) must appear there with, at minimum: a description, an owner, and a classification. This policy sets the *requirement* that the inventory exist and stay accurate; maintaining its contents is an operational responsibility, not a policy-authoring one.
2. **Every asset must have a named owner.** Ownership means accountability for the asset's appropriate classification, access control, and lifecycle handling — it does not necessarily mean the owner personally operates the asset day to day. Where an owner is a role rather than a named individual, the inventory must say so explicitly (e.g. "Engineering/Development team") rather than leaving the field blank.
3. **Asset classification follows policy 05 (Data Classification Policy).** This policy does not define its own classification scheme; every asset recorded in the inventory must be tagged with a classification level as defined there, so that handling requirements (encryption, access restriction, retention) are derived consistently rather than duplicated per-asset.
4. **New assets must be added to the inventory at acquisition, not discovered later.** When a new dependency, credential, environment, or piece of infrastructure is introduced (e.g. a new SaaS integration, a new environment variable holding a secret, a new hosting account), adding it to `docs/iso27001/asset-inventory.md` is part of the definition of "done" for that change, not a follow-up task.
5. **Assets must be reviewed for continued need, and removed or archived from active use when no longer required.** A decommissioned asset (e.g. a retired dependency, an old credential rotated out) must be marked as such in the inventory rather than silently deleted from it, preserving a record of what the system used to depend on.
6. **Disposal of an asset holding sensitive data must not create a residual copy outside inventory visibility.** For example, removing a document-upload feature must account for what happens to already-uploaded files in `server/uploads/`; ad hoc manual deletion outside a documented process is discouraged once a disposal process is defined.
7. **The inventory, not this policy, is the single source of truth for "what do we have."** Any question about a specific asset (what it is, who owns it, how it is classified) should be answered by consulting `docs/iso27001/asset-inventory.md`; this policy is not to be re-purposed as a second, competing list.
8. **Software asset management extends to third-party dependencies.** The npm dependency supply chain (approximately 227 server packages and 210 client packages, per `npm audit` metadata as of this session) is itself a class of asset requiring ownership (Engineering/Development team) and lifecycle handling (vulnerability monitoring via `npm audit`, upgrade decisions); supplier-specific security review of dependencies and other third parties is governed separately by policy 13 (Supplier Security Policy).

## 4. Roles & Responsibilities

- **[SECURITY OWNER]:** Accountable for this policy and for confirming the inventory process is actually followed; escalation point when an asset has no clear owner.
- **Engineering/Development team:** Responsible for adding new technical assets to the inventory at acquisition time, keeping ownership/classification fields accurate, and flagging decommissioned assets.
- **Individual asset owners (as recorded in the inventory):** Responsible for that asset's classification being correct and its handling matching policy 05's requirements for that classification.
- **[APPROVER]:** Approves this policy and any material change to the classification scheme it relies on (jointly with policy 05).

## 5. Related Evidence in This Repository

- `docs/iso27001/asset-inventory.md` — the authoritative asset inventory this policy governs. **Required to exist and stay current; this policy defers all asset-level detail to it.**
- `docs/iso27001/05-*` (Data Classification Policy) — the classification scheme every inventory entry must reference.
- `server/config/env.js` — enumerates the environment-variable-based secrets (`JWT_SECRET`, `ENCRYPTION_KEY`, and others validated at startup) that constitute a category of asset requiring inventory entries and careful ownership.
- `server/package.json` and `client/package.json` — the dependency manifests underlying the npm-package asset category referenced in Section 3 statement 8.
- A formal asset-management tool or CMDB: **NONE — gap.** The inventory is currently a static Markdown document, not a maintained system; this is an acceptable starting point for readiness purposes but should not be mistaken for an automated or continuously reconciled asset register.

## 6. Exceptions

An asset that cannot be added to the inventory promptly (e.g. during rapid prototyping) must be added within a defined grace period agreed with [SECURITY OWNER]; indefinite exclusion from the inventory is not permitted and must be recorded as an exception per policy 01 §10 if it occurs.

## 7. Enforcement & Compliance

Compliance is assessed by periodically sampling recently introduced assets (new dependencies, new environment variables, new integrations) and confirming they appear in `docs/iso27001/asset-inventory.md` with an owner and classification. Persistent gaps are escalated to [SECURITY OWNER].

## 8. Review Cycle

This policy is reviewed at least annually, and whenever the classification scheme in policy 05 changes materially. The underlying inventory is reviewed at a cadence to be set by [SECURITY OWNER], no less often than this policy's own review cycle. Next scheduled review: [REVIEW DATE].
