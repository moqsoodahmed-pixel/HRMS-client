# Information Security Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — prepared as part of an ISO/IEC 27001:2022 readiness exercise. [ORGANIZATION NAME] is **not** currently ISO/IEC 27001 certified. This document, and the policy suite it governs, describe the target Information Security Management System (ISMS) and the current state of controls in the DutyLaunch HRMS application, including gaps still to be closed.

## 1. Purpose

This policy establishes [ORGANIZATION NAME]'s commitment to protecting the confidentiality, integrity, and availability of information processed by the DutyLaunch HRMS application, and sets the top-level governance framework under which the supporting ISO/IEC 27001:2022 policy suite operates.

## 2. Management Commitment

[APPROVER], acting on behalf of [ORGANIZATION NAME], has approved this policy and commits the organization to:

1. Establishing, operating, monitoring, and improving an ISMS aligned with ISO/IEC 27001:2022.
2. Providing the resources needed to implement and maintain the controls described in this policy suite.
3. Ensuring information security responsibilities are assigned, understood, and acted upon.
4. Reviewing this policy and its subordinate policies at the cadence defined in Section 9, and whenever a material change occurs to the application, its data, or its hosting arrangement.

This commitment is a governance statement of intent. It does not itself constitute evidence of certification, and readers should not represent it as such.

## 3. Information Security Objectives

[ORGANIZATION NAME] intends to set measurable information security objectives (e.g. covering incident response time, access review completion, patch/vulnerability remediation) as part of ongoing ISMS operation. Specific numeric targets are intentionally not asserted in this document — they are to be defined, owned, and tracked by [SECURITY OWNER] outside this policy text, and reviewed at the cadence in Section 9. Objectives, at minimum, should address:

- Confidentiality of employee personal data and identity documents handled by the HRMS.
- Integrity of HR records (employment status, compensation, leave, documents).
- Availability of the HRMS to authorized users.
- Continual improvement of the control set described across this policy suite, including closure of the known gaps identified in policy 03, 05, 06, 07, and elsewhere.

## 4. Scope of the ISMS

The ISMS described by this policy suite covers:

- **Application:** The DutyLaunch HRMS system — a MERN-stack (MongoDB, Express, React, Node.js) application comprising the frontend (React/Vite client), the backend API (`server/`), and the database.
- **Data:** Employee personal data, identity documents (e.g. Aadhaar/PAN/Passport-equivalent numbers), compensation records, leave records, audit logs, and authentication credentials processed or stored by the application.
- **People:** Employees, managers, HR administrators, finance staff, auditors, and system/platform administrators (SUPER_ADMIN, CTO) who access the application, as defined by the roles in policy 02.
- **Hosting/Infrastructure:** The environment on which the application is deployed. At the time of this document, the application has been verified running locally only; no production hosting provider or infrastructure has been selected. Where this policy references hosting, it uses the placeholder [HOSTING PROVIDER] pending that decision.
- **Organizational scope:** [ORGANIZATION NAME] as the operating entity responsible for the application and its data.

Out of scope: any third-party systems not integrated with the HRMS, and any physical facilities not hosting HRMS infrastructure (to be defined once [HOSTING PROVIDER] is selected).

## 5. Policy Hierarchy

This Information Security Policy is the top-level document in the ISMS policy suite. All other policies in `docs/iso27001/` are subordinate to it and must be read as elaborations of the commitments made here. The current suite (numbered 01–17, expanding as the ISMS matures) includes, among others:

- 02 — Access Control Policy
- 03 — Password and Authentication Policy
- 04 — Acceptable Use Policy
- 05 through 16 — further domain-specific policies (e.g. cryptography, logging and monitoring, incident response, backup and business continuity, supplier/third-party security, physical security, secure development, change management, risk assessment, vulnerability management, data classification, business continuity)
- 17 — Joiner/Mover/Leaver (Identity Lifecycle) Policy, referenced by policy 02 for detailed provisioning/deprovisioning procedures.

Where a subordinate policy conflicts with this document, this document prevails. Where a subordinate policy is silent, this document's principles apply.

## 6. Roles & Responsibilities

- **Information Security Owner ([SECURITY OWNER]):** Owns the ISMS, this policy suite, and the risk treatment plan; coordinates policy reviews; is the point of escalation for security exceptions.
- **Approver ([APPROVER]):** Approves this policy and material revisions to it.
- **Data Protection Officer ([DATA PROTECTION OFFICER]):** Advises on personal data handling; to be appointed/confirmed as part of ISMS maturity — see Section 8.
- **Legal Counsel ([LEGAL COUNSEL]):** Advises on jurisdiction-specific legal and regulatory obligations; see Section 8.
- **All personnel with HRMS access:** Responsible for complying with this policy suite and reporting suspected security incidents per policy 09 (Incident Management/Reporting — referenced; see policy 04 §4 for the reporting obligation as it applies to end users).
- **Engineering/Development team:** Responsible for implementing and maintaining the technical controls referenced as evidence throughout this policy suite, and for remediating identified gaps.

## 7. Legal, Regulatory, and Contractual Context

This policy suite does not assert compliance with any specific data protection law (e.g. GDPR, CCPA, DPDP, or equivalent). Jurisdiction-specific legal and regulatory obligations applicable to [ORGANIZATION NAME] and to the personal data processed by the HRMS have not been assessed here and require review by [LEGAL COUNSEL] before this policy suite is relied upon for compliance purposes.

## 8. Known Gaps at Time of Drafting

This policy suite is deliberately honest about the current state of the ISMS. As of this draft, the following organizational (non-technical) gaps exist and are tracked for closure:

- No Data Protection Officer has been appointed ([DATA PROTECTION OFFICER] placeholder in use).
- No formal risk assessment or Statement of Applicability has yet been completed; policies below reference where one is needed.
- No scheduled cadence for policy review, access review, or management review has yet been set beyond the placeholder [REVIEW DATE].

Technical gaps (e.g. no backups, no version control, no external monitoring) are documented in the relevant subordinate policies and must be tracked in a risk register / Statement of Applicability as the ISMS matures.

## 9. Related Evidence in This Repository

- `server/` — the Node/Express backend implementing the technical controls referenced across this policy suite.
- `client/` (React/Vite) — the frontend consuming the backend API; enforces no security decisions on its own (see policy 02 §4).
- `server/utils/roles.js` — central `ELEVATED_ROLES` definition underpinning the RBAC model in policy 02.
- `server/config/env.js` — fail-fast startup validation of `JWT_SECRET` and `ENCRYPTION_KEY`, referenced in policy 03.
- `server/scripts/smoke-test.cjs` and `server/scripts/smoke-test-business-rules.cjs` — automated regression evidence for the control set described across this policy suite.
- `server/middleware/auth.js` and `server/routes/` — centralized authorization enforcement referenced in policy 02.

## 10. Exceptions

Any deviation from this policy requires written approval from [SECURITY OWNER], documented with a business justification, a risk acceptance statement, and a review date. Exceptions must be recorded in an exceptions register (to be established as part of ISMS operation).

## 11. Enforcement & Compliance

Non-compliance with this policy or its subordinate policies may result in disciplinary action, up to and including termination of access or employment, in accordance with [ORGANIZATION NAME]'s HR policies. Compliance is verified through the audit and testing mechanisms referenced in Section 9, and — once established — through periodic internal or external audit.

## 12. Review Cycle

This policy is reviewed at least annually, and whenever a material change occurs to the application's architecture, data handled, hosting arrangement, or applicable legal/regulatory context. Next scheduled review: [REVIEW DATE].
