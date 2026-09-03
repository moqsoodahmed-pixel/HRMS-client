# Supplier Security Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — prepared as part of an ISO/IEC 27001:2022 readiness exercise. [ORGANIZATION NAME] is **not** currently ISO/IEC 27001 certified.

## 1. Purpose

This policy defines how [ORGANIZATION NAME] assesses and manages information-security risk arising from third-party suppliers and dependencies used by the DutyLaunch HRMS application — both those in use today and any adopted in future.

## 2. IMPORTANT — Current State

**No formal third-party or supplier risk-assessment process exists today.** None of the suppliers/dependencies listed in Section 3 have undergone a documented vendor security review, and no due-diligence checklist, questionnaire, or contractual security-review process has been applied to any of them. This policy describes the target process; it does not claim any current supplier has been assessed under it.

## 3. Suppliers/Dependencies Currently in Use

1. **MongoDB** — the application's database. In this environment, verified running self-hosted/local only; no managed database provider or production hosting arrangement has been selected. No formal security review has been performed.
2. **SMTP email provider (Gmail SMTP)** — configured via environment variables (`server/services/emailService.js`) and used for password-reset and welcome emails. Notably, email sending **fails soft**: if SMTP is unreachable or not configured, the send is logged (`console.warn`/`console.error`) and the triggering request still succeeds — email delivery is a convenience, not a dependency the application's core functions rely on. No formal security review of this provider has been performed.
3. **The open-source npm dependency supply chain** — approximately 227 server packages and approximately 210 client packages, per `npm audit` metadata as of this session. `npm audit` reports 0 known vulnerabilities on both server and client after this session's dependency upgrades. This is a point-in-time result, not an ongoing guarantee, and covers known-vulnerability scanning only — it is not a substitute for reviewing what a given package actually does, who maintains it, or its update cadence.

No formal vendor security review has been performed for any of the above. This is the current, honest state and must be reflected in the Statement of Applicability referenced in policy 01.

## 4. Policy Statements

1. **Any future infrastructure/hosting/SaaS vendor requires due diligence before adoption.** At minimum, before selecting [HOSTING PROVIDER] or any equivalent production infrastructure/SaaS vendor, [SECURITY OWNER] must confirm: the vendor's data-handling practices for the classification of data it would touch (per policy 05), its own security posture (e.g. published certifications, incident history where available), and its data residency/jurisdiction, flagged for [LEGAL COUNSEL] review where relevant.
2. **A Data Processing Agreement (or equivalent contractual security terms) is required wherever a supplier handles personal data on [ORGANIZATION NAME]'s behalf.** This applies today, in principle, to the SMTP provider (which receives employee email addresses and message content for password-reset/welcome emails) and would apply to any future hosting provider handling the database or uploaded documents. No such agreement is currently in place for the SMTP provider; this is a gap to close, not an assumed-satisfied requirement. The specific terms required are a matter for [LEGAL COUNSEL], not this policy.
3. **Dependency supply-chain risk is managed through automated scanning, not manual review of every package.** `npm audit` (or equivalent) must be run before any dependency upgrade is merged and treated as a release gate for known-vulnerability regressions; this does not by itself constitute a vendor security review of any individual maintainer or package publisher.
4. **A supplier that fails soft must not silently mask a security-relevant failure.** The SMTP provider's fail-soft behavior is an accepted application-resilience design (loss of email must not block HR workflows) but must not be extended, without explicit review, to suppliers whose failure could mask a security control — e.g. a future authentication or logging dependency should not be allowed to fail silently in the same way without [SECURITY OWNER] sign-off.
5. **Supplier access to production data must be minimized and reviewed.** Where a supplier requires credentials (e.g. an SMTP username/password, a database connection string), those credentials must be treated per policy 03/policy 06 requirements (not committed to version control, rotated on suspected compromise) and scoped to the minimum access the supplier's function requires.
6. **Ongoing supplier review is PROPOSED — not yet adopted as a running process.** Proposed cadence, pending [SECURITY OWNER] adoption: re-review of each active supplier (Section 3) not less than [RETENTION PERIOD], and immediately upon any material change to what data a supplier can access, or upon a disclosed vulnerability/breach at the supplier.
7. **New suppliers are added to the asset inventory.** Any new third-party service or vendor adopted must be recorded in `docs/iso27001/asset-inventory.md` (per policy 12) with an owner and the classification of data it will handle, at the time it is adopted — not retroactively.
8. **This policy does not assert compliance with any specific supplier-risk regulatory framework.** Whether a given supplier arrangement satisfies a jurisdiction-specific legal requirement is a matter for [LEGAL COUNSEL].

## 5. Roles & Responsibilities

- **[SECURITY OWNER]:** Owns this policy and the (currently not-yet-adopted) supplier review process; decides when it becomes a standing, scheduled activity.
- **[LEGAL COUNSEL]:** Advises on Data Processing Agreement terms and jurisdiction-specific supplier obligations.
- **Engineering/Development team:** Runs dependency vulnerability scanning (`npm audit`) as part of the change process; flags any new third-party integration to [SECURITY OWNER] before it goes live.
- **[APPROVER]:** Approves adoption of any new production infrastructure/hosting/SaaS vendor.

## 6. Related Evidence in This Repository

- `server/services/emailService.js` — SMTP integration with documented fail-soft behavior (`SMTP_CONFIGURED` check; `console.warn`/`console.error` on failure; the triggering request is never blocked).
- `server/package.json`, `client/package.json` — the dependency manifests behind the npm supply-chain risk described in Section 3.
- `npm audit` output (server and client, this session) — 0 known vulnerabilities at time of writing; a point-in-time scan result, not a standing guarantee.
- MongoDB connection configuration (environment-variable-based, per `server/config/env.js`) — the database dependency described in Section 3, currently self-hosted/local with no production hosting decision made.
- Formal vendor security-review process/checklist: **NONE — gap.**
- Data Processing Agreement with the SMTP provider or any other supplier: **NONE — gap.**
- `docs/iso27001/asset-inventory.md` — where new suppliers must be recorded per Section 4 statement 7.

## 7. Exceptions

Adopting a new supplier without completing the due-diligence steps in Section 4 (e.g. under time pressure) requires written approval from [SECURITY OWNER], with a documented justification, a defined remediation timeline to complete the review retroactively, and a review date, recorded per policy 01 §10.

## 8. Enforcement & Compliance

Compliance is assessed by confirming (a) every supplier in Section 3 is recorded in the asset inventory with a classification, (b) `npm audit` is run as part of the change process, and (c) any new supplier adoption is reviewed rather than assumed safe by default. Persistent non-compliance is escalated to [SECURITY OWNER].

## 9. Review Cycle

This policy is reviewed at least annually, whenever a new supplier is adopted or an existing one materially changes what data it can access, and immediately upon any disclosed vulnerability or breach affecting a supplier listed in Section 3. Next scheduled review: [REVIEW DATE].
