# Data Retention and Deletion Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]

> Status: ISO/IEC 27001:2022 readiness draft for DutyLaunch HRMS. This
> document describes an intended retention approach. It does **not** describe
> anything currently automated in the codebase — as stated plainly in
> Section 5, no retention or deletion automation exists today, and every
> retention period below is a placeholder pending legal review. This
> document does not assert compliance with any specific data protection law.

## 1. Purpose

This policy defines how long each category of data handled by DutyLaunch
HRMS should be retained, and how it should be deleted or anonymized when no
longer required, in support of ISO/IEC 27001:2022 Annex A control 5.33
(Protection of records) and the data minimization principles referenced
generally by privacy regulation (which requires jurisdiction-specific legal
review — see Section 8).

## 2. Scope

Applies to all data categories stored by DutyLaunch HRMS: employee personal
data, identity documents, uploaded employee documents, compensation/payslip
data, leave and attendance records, audit logs, and authentication
credentials. Applies regardless of whether the data sits in MongoDB, in
`server/uploads/`, or in application logs.

## 3. Guiding Principles

1. Data should be retained only as long as there is a legitimate business or
   legal reason to do so.
2. Retention periods for data tied to statutory obligations (tax, labour
   law, employment records) must be set by [LEGAL COUNSEL] for the
   organization's actual operating jurisdiction(s) — no such period is
   invented in this document.
3. Deletion should be irreversible for data that has passed its retention
   period, except where a legal hold requires preservation.
4. Where deletion is not immediately technically feasible, the gap must be
   documented (see Section 5) rather than silently ignored.

## 4. Retention by Data Category

| Data category | Proposed retention trigger | Retention period | Deletion/disposal approach |
|---|---|---|---|
| Employee personal data (name, DOB, gender, blood group, nationality, contact info) | Employment end date | [RETENTION PERIOD] — subject to [LEGAL COUNSEL] review | Hard delete or anonymize employee record after retention period lapses, unless under legal hold. |
| Identity documents (Aadhaar, PAN, Passport, Driving Licence, Voter ID) | Employment end date, or document superseded | [RETENTION PERIOD] — subject to [LEGAL COUNSEL] review (identity documents often carry specific statutory minimums that must not be guessed) | Delete encrypted value and any decrypted cache; no plaintext copies should exist outside `server/utils/encryption.js` decryption at time of authorized use. |
| Uploaded employee documents (offer letters, certificates, bank details, address proof) | Employment end date, or document superseded/rejected | [RETENTION PERIOD] — subject to [LEGAL COUNSEL] review | Delete file from `server/uploads/` and its DB record together, so no orphaned file or dangling reference remains. |
| Compensation/salary structures and payslips | Employment end date, or statutory payroll record requirement | [RETENTION PERIOD] — subject to [LEGAL COUNSEL] review (payroll records are commonly subject to a specific statutory minimum) | Archive or delete per legal guidance; payslips may need longer retention than general personal data. |
| Leave records, attendance records | Employment end date | [RETENTION PERIOD] — subject to [LEGAL COUNSEL] review | Delete or anonymize after retention period; may be aggregated/anonymized for historical reporting instead of raw deletion if a business need exists. |
| Audit logs | Creation date (append-only) | [RETENTION PERIOD] — subject to [LEGAL COUNSEL] review, balancing investigative/audit value against storage/privacy minimization | No delete route currently exists at the application layer (by design, to prevent tampering). A retention/archival job (e.g. move logs older than [RETENTION PERIOD] to cold storage, then purge) would need to be built — see Section 5. |
| Authentication credentials (bcrypt password hashes) | Account deactivation | Deleted when the account record is deleted; not retained independently | Deleted as part of user account deletion. |
| Rejected/superseded document uploads (`documentStatus` = REJECTED, or replaced by a newer VERIFIED upload) | Immediately upon replacement, or per short grace period | [RETENTION PERIOD] — proposed short period to allow dispute/appeal, subject to [SECURITY OWNER] decision | Delete superseded file and record once the grace period lapses; today these are not automatically cleaned up (see gap below). |

## 5. Current Gap: No Automated Retention or Deletion Exists

This is stated plainly and without qualification:

- **There is no automated purge, archival, or deletion job anywhere in this
  codebase today.** Data is retained indefinitely by default once created.
- Audit logs accumulate with no age-based archival or purge mechanism.
- Documents superseded by a re-upload, or belonging to terminated employees,
  are not automatically removed from `server/uploads/` or the database.
- Expired or invalidated sessions/tokens are not subject to any scheduled
  cleanup beyond their own expiry check at request time (JWT expiry is
  enforced at verification time, but no housekeeping job removes stale
  session-related records if any exist).
- No jurisdiction-specific statutory retention periods have been researched
  or encoded anywhere in the application.

Indefinite retention by default is itself a risk that must be treated as a
genuine finding, not a neutral default: it increases the impact of any future
data breach, increases storage of RESTRICTED data beyond business need, and
is very likely inconsistent with data minimization requirements under most
privacy frameworks. This gap should be tracked in the Statement of
Applicability and prioritized based on legal review of actual retention
obligations.

## 6. What Closing This Gap Would Require

1. [LEGAL COUNSEL] to determine actual statutory and contractual retention
   obligations for each data category in the organization's operating
   jurisdiction(s), replacing every [RETENTION PERIOD] placeholder above
   with a real value.
2. A scheduled job (e.g. a cron-triggered script or scheduled task) that:
   - Identifies employee/document/audit-log records past their retention
     period.
   - Deletes or anonymizes them, including their associated files under
     `server/uploads/`.
   - Logs the deletion action itself (who/what triggered it, what was
     deleted, when) for auditability.
3. A documented legal-hold process to suspend deletion for records under
   litigation, investigation, or regulatory inquiry.
4. Verification that deletion actually removes encrypted values and any
   decrypted in-memory or logged copies, not just the database pointer to a
   file.

## 7. Roles & Responsibilities

- **[SECURITY OWNER]:** Owns this policy, tracks the automation gap in the
  Statement of Applicability, prioritizes remediation.
- **[LEGAL COUNSEL]:** Determines actual retention periods per jurisdiction
  and data category; must be consulted before any [RETENTION PERIOD]
  placeholder is replaced with a real number.
- **Engineering team:** Implements retention/deletion automation once
  periods are legally confirmed.
- **[APPROVER]:** Approves this policy and any retention periods once
  determined.

## 8. Legal and Regulatory Note

This document intentionally does not claim compliance with GDPR, CCPA, DPDP,
or any other specific data protection law. Determining applicable law and
statutory retention minimums requires jurisdiction-specific legal review by
[LEGAL COUNSEL] before this policy can be considered complete or
operational.

## 9. Related Evidence in This Repository

- `server/services/storageService.js` — file storage/deletion primitives
  (`upload`, `download`, `delete`) that a retention job would need to call;
  no scheduled caller currently exists.
- `server/utils/documentRequirements.js`,
  `server/controllers/documentController.js` — document lifecycle status
  (MISSING / UNDER_REVIEW / VERIFIED / REJECTED) that a retention job would
  key off of.
- Audit log collection — append-only, no delete route (confirms Section 5's
  statement that audit logs currently have no purge mechanism).

## 10. Exceptions

Any decision to retain specific data beyond its eventual approved period
(e.g. for an active legal matter) requires written justification and
approval from [LEGAL COUNSEL] and the [SECURITY OWNER], recorded with a
review date.

## 11. Enforcement & Compliance

Once retention periods and automation are in place, non-compliance with
scheduled deletion (e.g. manually restoring deleted RESTRICTED data without
authorization) is subject to the organization's disciplinary process.

## 12. Review Cycle

This policy is reviewed at least annually, and immediately upon completion
of the legal review described in Section 8, by the [SECURITY OWNER] and
[LEGAL COUNSEL], and approved by the [APPROVER].
