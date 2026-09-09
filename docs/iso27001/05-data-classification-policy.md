# Data Classification Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]

> Status: ISO/IEC 27001:2022 readiness draft for DutyLaunch HRMS. This document
> describes a classification scheme being introduced for the first time — no
> such scheme currently exists in the repository or in any operating
> procedure. It does not assert certification.

## 1. Purpose

This policy defines how information handled by DutyLaunch HRMS is classified
by sensitivity, and the minimum handling requirements (storage, transmission,
access) that apply to each classification tier. It supports ISO/IEC
27001:2022 Annex A control 5.12 (Classification of information) and 5.13
(Labelling of information).

## 2. Scope

Applies to all data created, processed, or stored by DutyLaunch HRMS,
including data in the MongoDB database, files under `server/uploads/`,
application logs, audit logs, and backups (where they exist). Applies to all
personnel, contractors, and system components with access to this data.

## 3. Classification Tiers

| Tier | Definition |
|---|---|
| **PUBLIC** | Information intended for unrestricted external disclosure. Disclosure carries no risk to the organization or individuals. |
| **INTERNAL** | Information intended for use within the organization. Not intended for external release, but disclosure would cause limited harm. |
| **CONFIDENTIAL** | Sensitive information whose unauthorized disclosure could cause material harm to the organization, an employee, or a business relationship. Access is restricted to roles with a defined need. |
| **RESTRICTED** | The most sensitive information: data that could enable identity theft, financial fraud, or serious harm to an individual if disclosed. Access is restricted to the smallest possible set of roles, and access events must be auditable. |

Tiers are cumulative in strictness: a RESTRICTED handling requirement is at
least as strict as CONFIDENTIAL, which is at least as strict as INTERNAL.

## 4. Classification of Data Actually Held by This System

| Data category | Tier | Notes / Evidence |
|---|---|---|
| Employee identity documents (Aadhaar, PAN, Passport, Driving Licence, Voter ID) | **RESTRICTED** | Encrypted at rest with AES-256-GCM (`server/utils/encryption.js`). Plaintext is returned only via an explicit, audited "reveal" action; all other reads return a masked value (`maskIdentityNumber`). |
| Authentication credentials (password hashes) | **RESTRICTED** | Stored as bcrypt hashes, never plaintext. |
| Compensation/salary structures and payslips | **RESTRICTED** | Financial data; disclosure risk to individuals and to internal pay equity. |
| Uploaded employee documents (bank details, address proof, offer letters, certificates) | **RESTRICTED** | Stored under `server/uploads/`, outside the web root, referenced by DB record with a generated UUID filename (`server/services/storageService.js`) — not guessable or directly browsable. |
| Employee personal data (name, DOB, gender, blood group, nationality, contact info) | **CONFIDENTIAL** | Personal data requiring HR/manager-level access controls; not RESTRICTED-tier on its own but sensitive enough to require access limitation. |
| Audit logs (actor, action, module, target, timestamp) | **CONFIDENTIAL** | Contains a record of who accessed/changed what, including access to RESTRICTED data. Append-only at the application layer — no delete route exists. |
| Leave records, attendance records | **INTERNAL** | Operational HR data used by managers and HR for day-to-day decisions; disclosure within the organization is expected but external disclosure is not. |
| Employee directory information (name, title, department, work contact) for internal display | **INTERNAL** | Intended for use by other employees/managers within the system. |
| Published company policies, announcements | **INTERNAL** or **PUBLIC** | Classify per document at time of publishing; default to INTERNAL unless a document is explicitly designated for external release. |
| Document lifecycle status (MISSING / UNDER_REVIEW / VERIFIED / REJECTED, `documentStatus`) | **INTERNAL** | Workflow metadata; not sensitive on its own, but access to it should still follow role-based restriction (`server/controllers/employeeController.js`, `server/controllers/documentController.js`, `server/utils/documentRequirements.js`). |

Any data category not listed here must be classified by the [SECURITY OWNER]
before it is introduced into the system, defaulting to CONFIDENTIAL until
classified.

## 5. Handling Requirements per Tier

### 5.1 PUBLIC
- **Storage:** No special controls required.
- **Transmission:** May be sent over any channel, including unencrypted.
- **Access:** No restriction.

### 5.2 INTERNAL
- **Storage:** Must reside within organization-controlled systems (this
  application's database and file storage); not to be copied to personal
  devices or unmanaged cloud storage.
- **Transmission:** Must use TLS in transit for any network transmission
  (application already requires this at the transport layer for its API).
- **Access:** Authenticated users only; enforced via the application's
  authentication middleware (`server/middleware/auth.js`).

### 5.3 CONFIDENTIAL
- **Storage:** As for INTERNAL, plus access must be limited to roles with a
  defined business need (`server/middleware/roles.js`). Audit logs
  themselves must not be exposed to non-privileged roles.
- **Transmission:** TLS in transit is mandatory; the data must never be sent
  by unencrypted email or pasted into general-purpose chat tools.
- **Access:** Role-restricted; access to audit logs should itself be logged
  where technically supported.

### 5.4 RESTRICTED
- **Storage:** Must be encrypted at rest (identity documents already meet
  this via AES-256-GCM in `server/utils/encryption.js`; uploaded documents
  are stored outside the web root with non-guessable filenames as an
  additional control, though file-level encryption at rest for uploaded
  binary documents is not currently implemented — see Statement of
  Applicability). Access must be restricted to the minimum roles required
  (e.g. HR admin only).
- **Transmission:** TLS mandatory; plaintext values (e.g. a "revealed"
  identity number) must never be logged, cached client-side beyond the
  active view, or included in exported reports without explicit
  justification.
- **Access:** Every access to a plaintext RESTRICTED value must be an
  explicit, individually authorized action and must be recorded in the audit
  log with actor, timestamp, and target record. Bulk export of RESTRICTED
  data must be restricted and, where implemented, itself audited.

## 6. Labelling

Where practical, RESTRICTED and CONFIDENTIAL data displayed in the UI should
be visually distinguished (e.g. masked-by-default identity numbers, a
"reveal" action) so users are not misled about sensitivity. This is already
partially implemented for identity numbers; extending equivalent masking to
other RESTRICTED fields (e.g. bank account numbers in uploaded documents) is
a candidate improvement, not yet implemented.

## 7. Roles & Responsibilities

- **[SECURITY OWNER]:** Maintains this classification scheme, approves
  classification of new data categories, reviews classification annually.
- **Engineering team:** Implements technical controls appropriate to the
  classification tier of any data a feature introduces or handles.
- **HR administrators / managers:** Handle data in accordance with its
  classification when working outside the application (e.g. exporting
  reports, discussing employee records).
- **[APPROVER]:** Approves this policy and material changes to it.

## 8. Related Evidence in This Repository

- `server/utils/encryption.js` — AES-256-GCM encryption for identity numbers.
- `server/utils/encryption.js` (`maskIdentityNumber`) — default-masked
  display of RESTRICTED identity data.
- `server/services/storageService.js` — non-guessable UUID filenames for
  uploaded documents, stored outside the web root.
- `server/middleware/auth.js`, `server/middleware/roles.js` — authentication
  and role-based access enforcement.
- `server/controllers/employeeController.js`,
  `server/controllers/documentController.js`,
  `server/utils/documentRequirements.js` — document lifecycle status
  handling.
- Audit log collection (append-only at the application layer, no delete
  route) — supports CONFIDENTIAL handling of access records.

## 9. Exceptions

Any deviation from these handling requirements (e.g. a temporary export of
RESTRICTED data for a legal or audit request) requires written approval from
the [SECURITY OWNER] and must be logged, including scope, justification, and
expiry of any resulting copy.

## 10. Enforcement & Compliance

Violations of this policy (e.g. copying RESTRICTED data to unmanaged
storage, disabling masking in the UI without authorization) are subject to
the organization's disciplinary process. Technical controls should be
preferred over reliance on manual compliance wherever feasible.

## 11. Review Cycle

This policy is reviewed at least annually, and whenever a new category of
data is introduced into DutyLaunch HRMS, by the [SECURITY OWNER] and approved
by the [APPROVER].
