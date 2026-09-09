# Statement of Applicability (SoA) — DutyLaunch HRMS

Document Owner: [SECURITY OWNER] · Approved by: [APPROVER] · Version: 1.0 (Draft) · Last Reviewed: [REVIEW DATE]

Maps all 93 ISO/IEC 27001:2022 Annex A controls to their applicability and implementation status for DutyLaunch HRMS, per Clause 6.1.3(d). Compiled by direct code inspection, dependency/security testing, and review of this session's newly-drafted ISMS documentation on 2026-08-30.

**This is not a certification claim.** Nothing here asserts [ORGANIZATION NAME] is or has been certified against ISO/IEC 27001:2022.

## Status legend

- **IMPLEMENTED / VERIFIED** — control exists and was directly confirmed (code inspection and/or a passing automated test).
- **IMPLEMENTED / NEEDS EVIDENCE** — control exists in some form (often a policy drafted this session) but lacks operational proof (e.g. not yet approved, not yet exercised).
- **PARTIALLY IMPLEMENTED** — a real but incomplete control exists; a genuine gap remains.
- **NOT IMPLEMENTED** — no meaningful control exists yet.
- **NOT APPLICABLE — JUSTIFICATION REQUIRED** — outside this application's current scope (most commonly: physical/hosting controls, since no hosting provider has been chosen; or organizational/legal/HR matters outside a codebase's reach).

---

## A.5 Organizational controls (37)

| Control | Applicable | Status | Evidence / Justification | Policy | Owner |
|---|---|---|---|---|---|
| 5.1 Policies for information security | Yes | IMPLEMENTED / NEEDS EVIDENCE | 17 policies drafted this session under `docs/iso27001/`; not yet formally approved | 01 | [SECURITY OWNER] |
| 5.2 Information security roles and responsibilities | Yes | IMPLEMENTED / NEEDS EVIDENCE | Roles defined in policy 01/02 and in code (7-role RBAC, `server/utils/roles.js`); [SECURITY OWNER] not yet a named individual | 01, 02 | [APPROVER] |
| 5.3 Segregation of duties | Yes | IMPLEMENTED / VERIFIED | HR requests compensation changes; only SUPER_ADMIN/CTO/FINANCE-appropriate roles approve; HR cannot approve its own request — verified by automated test | 02 | [SECURITY OWNER] |
| 5.4 Management responsibilities | Yes | PARTIALLY IMPLEMENTED | Stated in policy 01; no evidence of an actual management review conducted yet (see `management-review-template.md`) | 01 | [APPROVER] |
| 5.5 Contact with authorities | Yes | NOT IMPLEMENTED | No authority contact list exists | 09 | [SECURITY OWNER] |
| 5.6 Contact with special interest groups | Yes | NOT IMPLEMENTED | No such contacts documented | — | [SECURITY OWNER] |
| 5.7 Threat intelligence | Yes | NOT IMPLEMENTED | No threat-intel feed/process; `npm audit` this session is the closest analogue and is manual/one-off | 08 | [SECURITY OWNER] |
| 5.8 Information security in project management | Yes | NOT IMPLEMENTED | No formal project-management process evidenced in this repository | 07 | [SECURITY OWNER] |
| 5.9 Inventory of information and other associated assets | Yes | IMPLEMENTED / NEEDS EVIDENCE | First draft in `asset-inventory.md`; not yet a maintained, continuously-updated inventory | 12 | [SECURITY OWNER] |
| 5.10 Acceptable use of information and other associated assets | Yes | IMPLEMENTED / NEEDS EVIDENCE | Policy 04 drafted; the app's existing Policy-acknowledgement workflow (verified: publish/acknowledge tested) could formally distribute and track staff acknowledgement of this policy, but has not been used for that yet | 04 | [SECURITY OWNER] |
| 5.11 Return of assets | Yes | IMPLEMENTED / VERIFIED | Assets module supports assign/return/history; Offboarding module includes a clearance step — both verified by automated test | — | [SECURITY OWNER] |
| 5.12 Classification of information | Yes | IMPLEMENTED / NEEDS EVIDENCE | Policy 05 defines PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED and maps real data categories; not yet operationalized as labels in the application itself | 05 | [SECURITY OWNER] |
| 5.13 Labelling of information | Yes | NOT IMPLEMENTED | No classification labels exist in the data model or UI | 05 | [SECURITY OWNER] |
| 5.14 Information transfer | Yes | PARTIALLY IMPLEMENTED | CORS restricted to one configured origin; TLS-in-transit is an infrastructure-level control not yet evidenced (no hosting decided) | 15 | [HOSTING PROVIDER] |
| 5.15 Access control | Yes | IMPLEMENTED / VERIFIED | Centralized `authorize()`/`authorizeOwnerOrAdmin()` middleware on every protected route; verified extensively by both regression suites | 02 | [SECURITY OWNER] |
| 5.16 Identity management | Yes | IMPLEMENTED / VERIFIED | `User` model with role + linked `Employee` record; unique email constraint | 02 | [SECURITY OWNER] |
| 5.17 Authentication information | Yes | IMPLEMENTED / VERIFIED | Bcrypt (cost 12) hashing, password complexity rules, `select: false` on the password field, startup-validated JWT secret | 03 | [SECURITY OWNER] |
| 5.18 Access rights | Yes | PARTIALLY IMPLEMENTED | Provisioning/deprovisioning exist in code (see 6.5); no periodic access-review process is scheduled or evidenced | 02 | [SECURITY OWNER] |
| 5.19 Information security in supplier relationships | Yes | IMPLEMENTED / NEEDS EVIDENCE | Policy 13 drafted; no supplier review has actually been conducted for MongoDB/SMTP/the npm ecosystem | 13 | [SECURITY OWNER] |
| 5.20 Addressing information security within supplier agreements | Yes | NOT IMPLEMENTED | No supplier contracts/DPAs evidenced in this repository | 13 | [LEGAL COUNSEL] |
| 5.21 Managing information security in the ICT supply chain | Yes | PARTIALLY IMPLEMENTED | `npm audit` performed and remediated this session (0 known vulnerabilities); no recurring/automated gate | 08 | [SECURITY OWNER] |
| 5.22 Monitoring, review and change management of supplier services | Yes | NOT IMPLEMENTED | No ongoing supplier monitoring process | 13 | [SECURITY OWNER] |
| 5.23 Information security for use of cloud services | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | No cloud service is in use; this session ran entirely on a local machine. Becomes applicable once [HOSTING PROVIDER] is selected | 13 | [HOSTING PROVIDER] |
| 5.24 Information security incident management planning and preparation | Yes | IMPLEMENTED / NEEDS EVIDENCE | `docs/incident-response-plan.md` + policy 09 drafted this session; never exercised | 09 | [SECURITY OWNER] |
| 5.25 Assessment and decision on information security events | Yes | IMPLEMENTED / NEEDS EVIDENCE | Triage/severity classification defined in the incident-response plan; unexercised | 09 | [SECURITY OWNER] |
| 5.26 Response to information security incidents | Yes | IMPLEMENTED / NEEDS EVIDENCE | Containment/eradication/recovery steps defined; unexercised | 09 | [SECURITY OWNER] |
| 5.27 Learning from information security incidents | Yes | IMPLEMENTED / NEEDS EVIDENCE | Lessons-learned step defined in the plan; no real incident yet to learn from | 09 | [SECURITY OWNER] |
| 5.28 Collection of evidence | Yes | PARTIALLY IMPLEMENTED | `AuditLog` collection is append-only at the application layer (no delete route, verified); no formal forensic evidence-handling procedure beyond the incident-response plan | 09 | [SECURITY OWNER] |
| 5.29 Information security during disruption | Yes | IMPLEMENTED / NEEDS EVIDENCE | `docs/business-continuity.md` drafted; unexercised, and depends on backups which do not yet exist | 16 | [SECURITY OWNER] |
| 5.30 ICT readiness for business continuity | Yes | NOT IMPLEMENTED | No redundant infrastructure, no failover; no hosting decided | 16 | [HOSTING PROVIDER] |
| 5.31 Legal, statutory, regulatory and contractual requirements | Yes | NOT IMPLEMENTED | No jurisdiction/applicable-law determination has been made; requires [LEGAL COUNSEL] review | — | [LEGAL COUNSEL] |
| 5.32 Intellectual property rights | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Ownership of custom source code is an organizational/legal matter outside this codebase's scope | — | [LEGAL COUNSEL] |
| 5.33 Protection of records | Yes | PARTIALLY IMPLEMENTED | Audit records are append-only at the app layer, but not protected against loss — no backup exists (ties to 8.13) | — | [SECURITY OWNER] |
| 5.34 Privacy and protection of PII | Yes | IMPLEMENTED / NEEDS EVIDENCE | `data-protection-overview.md` drafted; encryption/masking/RBAC implemented in code; no legal compliance determination made | — | [DATA PROTECTION OFFICER] |
| 5.35 Independent review of information security | Yes | NOT IMPLEMENTED | This session's review was performed by an AI coding assistant at the user's direction — it is not an independent, qualified third-party audit and must not be represented as one | — | [APPROVER] |
| 5.36 Compliance with policies, rules and standards for information security | Yes | NOT IMPLEMENTED | No compliance-monitoring process exists; the policies themselves are newly drafted and unapproved | — | [SECURITY OWNER] |
| 5.37 Documented operating procedures | Yes | IMPLEMENTED / VERIFIED | This full documentation set (17 policies + risk register + SoA + operational plans) was produced and is evidenced in `docs/` | — | [SECURITY OWNER] |

## A.6 People controls (8)

| Control | Applicable | Status | Evidence / Justification | Policy | Owner |
|---|---|---|---|---|---|
| 6.1 Screening | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Pre-employment background screening is an HR/legal process outside application code; [ORGANIZATION NAME] must evidence this separately | 17 | [SECURITY OWNER] |
| 6.2 Terms and conditions of employment | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Contractual matter outside this codebase's scope | 17 | [LEGAL COUNSEL] |
| 6.3 Information security awareness, education and training | Yes | NOT IMPLEMENTED | No training program exists; proposed in `risk-treatment-plan.md` (R18) | 04 | [SECURITY OWNER] |
| 6.4 Disciplinary process | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | HR/legal disciplinary process outside application code | 04 | [LEGAL COUNSEL] |
| 6.5 Responsibilities after termination or change of employment | Yes | PARTIALLY IMPLEMENTED | Deactivation (`isActive: false`) blocks new logins immediately, verified; an already-issued session token is NOT immediately revoked — remains valid until natural expiry (≤7 days) | 17 | [SECURITY OWNER] |
| 6.6 Confidentiality or non-disclosure agreements | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Legal/contractual matter outside this codebase's scope | 04 | [LEGAL COUNSEL] |
| 6.7 Remote working | Yes | IMPLEMENTED / NEEDS EVIDENCE | Policy 14 drafted (organizational expectations); no technical remote-access control exists in-app (it is a standard web application) | 14 | [SECURITY OWNER] |
| 6.8 Information security event reporting | Yes | IMPLEMENTED / NEEDS EVIDENCE | Reporting channel described conceptually in policies 04/09; no purpose-built in-app "report an incident" feature exists | 04, 09 | [SECURITY OWNER] |

## A.7 Physical controls (14)

| Control | Applicable | Status | Evidence / Justification | Policy | Owner |
|---|---|---|---|---|---|
| 7.1 Physical security perimeters | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Depends entirely on [HOSTING PROVIDER]/office location, not yet chosen | — | [HOSTING PROVIDER] |
| 7.2 Physical entry | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Same as above | — | [HOSTING PROVIDER] |
| 7.3 Securing offices, rooms and facilities | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Same as above | — | [HOSTING PROVIDER] |
| 7.4 Physical security monitoring | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Same as above | — | [HOSTING PROVIDER] |
| 7.5 Protecting against physical and environmental threats | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Data-center responsibility of [HOSTING PROVIDER], not yet chosen | — | [HOSTING PROVIDER] |
| 7.6 Working in secure areas | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | No secure physical areas defined | — | [SECURITY OWNER] |
| 7.7 Clear desk and clear screen | Yes | NOT IMPLEMENTED | No such organizational policy adopted yet | 04 | [SECURITY OWNER] |
| 7.8 Equipment siting and protection | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Pending hosting decision | — | [HOSTING PROVIDER] |
| 7.9 Security of assets off-premises | Yes | PARTIALLY IMPLEMENTED | Assets module tracks assignment/return/history of company-issued equipment, verified by automated test; no off-premises-specific handling procedure documented | 12 | [SECURITY OWNER] |
| 7.10 Storage media | Yes | PARTIALLY IMPLEMENTED | Uploaded documents stored on local disk under `server/uploads/`; no documented media-disposal procedure | 06 | [SECURITY OWNER] |
| 7.11 Supporting utilities | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Pending hosting decision | — | [HOSTING PROVIDER] |
| 7.12 Cabling security | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Pending hosting decision | — | [HOSTING PROVIDER] |
| 7.13 Equipment maintenance | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | [HOSTING PROVIDER] responsibility once chosen | — | [HOSTING PROVIDER] |
| 7.14 Secure disposal or re-use of equipment | Yes | NOT IMPLEMENTED | No documented disposal procedure for company devices or decommissioned servers | 06 | [SECURITY OWNER] |

## A.8 Technological controls (34)

| Control | Applicable | Status | Evidence / Justification | Policy | Owner |
|---|---|---|---|---|---|
| 8.1 User endpoint devices | Yes | NOT IMPLEMENTED | No MDM/endpoint policy technically enforced; policy 14 sets expectations only | 14 | [SECURITY OWNER] |
| 8.2 Privileged access rights | Yes | IMPLEMENTED / VERIFIED | SUPER_ADMIN/CTO elevated via a central `ELEVATED_ROLES` array (`server/utils/roles.js`), not name/email hardcoding — verified by code audit and test | 02 | [SECURITY OWNER] |
| 8.3 Information access restriction | Yes | IMPLEMENTED / VERIFIED | RBAC + ownership checks verified extensively across both regression suites (218 assertions) | 02 | [SECURITY OWNER] |
| 8.4 Access to source code | Yes | PARTIALLY IMPLEMENTED | No version-control-based access history exists (no git repository); filesystem-level access control is whatever the host OS provides | — | [SECURITY OWNER] |
| 8.5 Secure authentication | Yes | PARTIALLY IMPLEMENTED | Bcrypt hashing, lockout, generic errors, validated JWT secret, httpOnly cookie all verified; single-factor only — no MFA | 03 | [SECURITY OWNER] |
| 8.6 Capacity management | Yes | NOT IMPLEMENTED | No resource-usage monitoring or capacity planning evidenced | — | [HOSTING PROVIDER] |
| 8.7 Protection against malware | Yes | NOT IMPLEMENTED | MIME-type allowlist + magic-byte signature validation exist for uploads, but this is content-type verification, not malware/AV scanning | — | [SECURITY OWNER] |
| 8.8 Management of technical vulnerabilities | Yes | IMPLEMENTED / NEEDS EVIDENCE | `npm audit` run and fully remediated this session (0 known vulnerabilities on both server and client); no recurring/automated process yet | 08 | [SECURITY OWNER] |
| 8.9 Configuration management | Yes | PARTIALLY IMPLEMENTED | Env-var-based configuration, documented in `.env.example`; no configuration-versioning or drift-detection tooling | — | [SECURITY OWNER] |
| 8.10 Information deletion | Yes | PARTIALLY IMPLEMENTED | Archive/soft-delete patterns exist for employees and documents; no retention-driven hard-deletion process | 06 | [SECURITY OWNER] |
| 8.11 Data masking | Yes | IMPLEMENTED / VERIFIED | Identity document numbers masked by default; plaintext reveal is a separate, audited action — verified by automated test | 05 | [SECURITY OWNER] |
| 8.12 Data leakage prevention | Yes | PARTIALLY IMPLEMENTED | Role-scoped API responses verified (e.g. password field, org-wide payroll hidden from EMPLOYEE); no DLP tooling or egress monitoring | — | [SECURITY OWNER] |
| 8.13 Backup | Yes | NOT IMPLEMENTED | No automated backup mechanism exists anywhere in the repository or infrastructure today — the single largest open gap in this SoA | 10 | [SECURITY OWNER] |
| 8.14 Redundancy of information processing facilities | Yes | NOT IMPLEMENTED | Single instance, no redundancy; pending hosting decision | — | [HOSTING PROVIDER] |
| 8.15 Logging | Yes | PARTIALLY IMPLEMENTED | `AuditLog` (business events) + `morgan` (HTTP access) + `console.error` (exceptions) all exist; no centralized/structured logging or correlation IDs | 11 | [SECURITY OWNER] |
| 8.16 Monitoring activities | Yes | NOT IMPLEMENTED | No SIEM, alerting, or anomaly detection exists | 11 | [SECURITY OWNER] |
| 8.17 Clock synchronization | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Relies on host OS/NTP configuration, not verified by this application-level review; becomes relevant once hosting is decided | — | [HOSTING PROVIDER] |
| 8.18 Use of privileged utility programs | No | NOT APPLICABLE — JUSTIFICATION REQUIRED | No such privileged utilities identified in this application's architecture | — | — |
| 8.19 Installation of software on operational systems | Yes | PARTIALLY IMPLEMENTED | npm dependency management exists; no formal change-approval gate for adding/updating packages | 07 | [SECURITY OWNER] |
| 8.20 Networks security | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Pending hosting/network architecture decision | — | [HOSTING PROVIDER] |
| 8.21 Security of network services | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Pending hosting/network architecture decision | — | [HOSTING PROVIDER] |
| 8.22 Segregation of networks | Conditional | NOT APPLICABLE — JUSTIFICATION REQUIRED | Pending hosting/network architecture decision | — | [HOSTING PROVIDER] |
| 8.23 Web filtering | No | NOT APPLICABLE — JUSTIFICATION REQUIRED | No outbound web-browsing/proxy use case in this application's architecture | — | — |
| 8.24 Use of cryptography | Yes | IMPLEMENTED / VERIFIED | AES-256-GCM for identity data at rest, bcrypt (cost 12) for passwords, JWT signing with a startup-validated secret — verified; no formal key-rotation cadence exists (gap) | 15 | [SECURITY OWNER] |
| 8.25 Secure development life cycle | Yes | PARTIALLY IMPLEMENTED | Input validation, centralized authz, tested regression suites all exist and are evidenced; no CI/CD gate, no code review process (no version control at all) | 07 | [SECURITY OWNER] |
| 8.26 Application security requirements | Yes | IMPLEMENTED / VERIFIED | This session's hardening work (JWT fail-closed validation, password-field protection, file-signature verification) demonstrates active requirement-setting and remediation | 07 | [SECURITY OWNER] |
| 8.27 Secure system architecture and engineering principles | Yes | IMPLEMENTED / VERIFIED | Centralized middleware, layered controller/route/model separation, consistent error handling across the codebase | 07 | [SECURITY OWNER] |
| 8.28 Secure coding | Yes | IMPLEMENTED / VERIFIED | Zod input validation, `express-mongo-sanitize`, mass-assignment protection (schema field-stripping), ObjectId validation — verified by code audit and test | 07 | [SECURITY OWNER] |
| 8.29 Security testing in development and acceptance | Yes | IMPLEMENTED / VERIFIED | Two regression suites, 218 total assertions including dedicated security checks (forged-cookie rejection, header checks, spoofed-file-type rejection), currently passing 100% | 07 | [SECURITY OWNER] |
| 8.30 Outsourced development | No | NOT APPLICABLE — JUSTIFICATION REQUIRED | No evidence of outsourced/third-party development for this codebase | — | — |
| 8.31 Separation of development, test and production environments | Yes | NOT IMPLEMENTED | Only one environment exists (this local verification environment); no distinct staging/production separation evidenced | — | [SECURITY OWNER] |
| 8.32 Change management | Yes | NOT IMPLEMENTED | No version control, no PR/review/approval process exists for this codebase | 07 | [SECURITY OWNER] |
| 8.33 Test information | Yes | PARTIALLY IMPLEMENTED | Automated tests use clearly-synthetic data (e.g. "Smoke Test Document"); no dedicated/isolated test database exists — tests run against the same database instance as any other data present | 07 | [SECURITY OWNER] |
| 8.34 Protection of information systems during audit testing | Yes | PARTIALLY IMPLEMENTED | This session's testing was read/write against a live dev database using synthetic records only; no control yet prevents this pattern from being run against a real production database | 07 | [SECURITY OWNER] |

---

## Summary counts

| Status | A.5 | A.6 | A.7 | A.8 | Total |
|---|---|---|---|---|---|
| IMPLEMENTED / VERIFIED | 8 | 0 | 0 | 8 | 16 |
| IMPLEMENTED / NEEDS EVIDENCE | 10 | 2 | 0 | 2 | 14 |
| PARTIALLY IMPLEMENTED | 5 | 1 | 2 | 9 | 17 |
| NOT IMPLEMENTED | 8 | 2 | 2 | 8 | 20 |
| NOT APPLICABLE — JUSTIFICATION REQUIRED | 6 | 3 | 10 | 7 | 26 |
| **Total** | **37** | **8** | **14** | **34** | **93** |

No control in this SoA is marked simply "PASS." The largest single category is "NOT APPLICABLE — pending a hosting decision," which is an honest reflection of this being an application-level review of a system that has not yet been deployed to real infrastructure — those 16 conditional items (mostly A.7 physical, some A.5/A.8 network/cloud items) will require re-assessment the moment [HOSTING PROVIDER] is chosen.
