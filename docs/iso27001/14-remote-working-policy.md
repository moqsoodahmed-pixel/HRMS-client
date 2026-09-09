# Remote Working Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — ISO/IEC 27001:2022 readiness exercise for [ORGANIZATION NAME]. Subordinate to the Information Security Policy (01). Supports Annex A control 6.7 (Remote working).

## 1. Purpose

This policy sets the minimum security expectations for personnel who access the DutyLaunch HRMS application, or any data it processes, from a location other than a controlled [ORGANIZATION NAME] office — including home working, travel, and client-site access. It is an organizational/behavioral policy: DutyLaunch HRMS has no device-management, VPN, or network-location enforcement built into its code, so remote-working risk here is managed by people and process, not by the application.

## 2. Scope

Applies to all personnel — employees, managers, HR/finance/audit staff, and SUPER_ADMIN/CTO account holders — who access DutyLaunch HRMS from any location outside a controlled office environment, on any device (company-issued or personal). Applies regardless of employment type (`employmentType` on the Employee model includes FULL_TIME, PART_TIME, CONTRACT, INTERN, CONSULTANT).

## 3. Policy Statements

### Application-level context

1. **`workLocation` is descriptive, not enforcing.** The Employee model carries a free-text `workLocation` field. It records where an employee is expected to work for HR reference; it has no bearing on authentication, access control, or session behavior. No feature in this codebase currently restricts login by network location, IP range, device posture, or geography — see Statement 11 (gap) below.
2. **No VPN, MDM, or device-management integration exists.** DutyLaunch HRMS does not issue, manage, or attest to the security posture of any device used to access it. All device-level controls in this policy are organizational requirements enforced through training, agreement, and manual oversight, not technical controls in `server/` or `client/`.

### Device security baseline

3. Any device (company-issued or personal, "BYOD") used to access DutyLaunch HRMS must, at minimum:
   - Be protected by a device-level password, PIN, or biometric lock.
   - Auto-lock after a period of inactivity (recommended: 5 minutes or less).
   - Run a currently supported, patched operating system, with automatic security updates enabled where possible.
   - Run up-to-date anti-malware protection where the platform supports it.
   - Never be left unlocked and unattended in a public or shared space.
4. Company-issued devices, where [ORGANIZATION NAME] provides them, must not have their security configuration (disk encryption, screen-lock, patching) disabled or bypassed by the user.
5. Use of personal ("BYOD") devices to access DutyLaunch HRMS is permitted only where the device meets Statement 3's baseline. [SECURITY OWNER] may restrict BYOD access to CONFIDENTIAL/RESTRICTED-tier data (see policy 05) pending a formal risk assessment.

### Network and physical environment

6. Remote access to DutyLaunch HRMS should be performed only over a trusted, password-protected home or personal network. Use of open/unsecured public Wi-Fi (e.g. cafés, airports) for accessing RESTRICTED-tier data (policy 05 §4) — such as identity documents or compensation records — is discouraged; if unavoidable, a reputable VPN or mobile hotspot with WPA2/WPA3 encryption should be used instead. [ORGANIZATION NAME] does not currently operate or mandate a corporate VPN — this is an infrastructure gap, tracked in the Statement of Applicability.
7. Screens must be locked (not merely minimized) whenever the user steps away from the device, and positioned to avoid casual observation ("shoulder surfing") of CONFIDENTIAL/RESTRICTED data by household members, co-working-space neighbors, or passers-by.
8. Printed material containing employee personal data, identity documents, or compensation information must not be produced at a remote location unless it can be stored securely and destroyed (e.g. cross-cut shredded) when no longer needed. Printing of RESTRICTED-tier data at an uncontrolled remote location is discouraged.

### Data handling while working remotely

9. **No unencrypted local copies of RESTRICTED data.** Identity documents, compensation data, or any other RESTRICTED-tier data (policy 05 §4) accessed through DutyLaunch HRMS must not be downloaded, exported, or copied to local device storage, personal cloud storage (e.g. personal Google Drive/Dropbox), or removable media, in a form that is not encrypted at rest. Where a legitimate export is required, the data must be handled per policy 05 §5.4 (RESTRICTED transmission/access rules) and deleted from local storage once its purpose is served.
10. Screenshots, screen recordings, or photographs of RESTRICTED or CONFIDENTIAL data displayed by the application must not be taken or stored outside the application except where a specific, authorized business process requires it.
11. **Gap — no technical enforcement of these data-handling rules exists.** DutyLaunch HRMS has no data-loss-prevention (DLP), export-blocking, watermarking, or device-attestation control. Compliance with Statements 9–10 currently depends entirely on personnel adherence and is a control gap to be tracked in the Statement of Applicability; browser-level masking of identity numbers (policy 05 §4/§6) is a partial mitigating control but does not prevent a determined user from capturing revealed data.

### Connectivity and incident handling

12. A lost, stolen, or compromised device that has been used to access DutyLaunch HRMS must be reported to [SECURITY OWNER] immediately, following the incident reporting obligation in policy 04 §4. Because there is no server-side session revocation mechanism (see policy 03 §13 and policy 17 §Gap), a compromised device with an active, unexpired session token is a genuine residual risk until the token naturally expires (≤ 30 minutes by default, ≤ 7 days with "remember me").
13. Users should prefer the default (30-minute) session over "remember me" when working from a shared, unmanaged, or higher-risk remote environment, given the session-revocation gap noted above.

## 4. Roles & Responsibilities

- **[SECURITY OWNER]:** Owns this policy; determines whether/when a corporate VPN, MDM, or device-attestation control should be introduced; maintains the associated Statement of Applicability entries.
- **All personnel:** Responsible for meeting the device and network baseline in Statements 3–8 and for the data-handling discipline in Statements 9–10 whenever working remotely.
- **HR_ADMIN:** Communicates this policy to new hires as part of onboarding (policy 17) and to existing staff on policy update.
- **Engineering/Development team:** Not directly responsible for enforcement of this policy (it has no code-level control point today) but should flag to [SECURITY OWNER] any future feature (e.g. bulk export, offline mode) that would materially change remote-data-handling risk.

## 5. Related Evidence in This Repository

- `server/models/Employee.js` — free-text `workLocation` field (descriptive only, no enforcement logic tied to it).
- `docs/iso27001/05-data-classification-policy.md` — classification tiers and handling requirements this policy's data-handling rules depend on.
- `docs/iso27001/03-password-and-authentication-policy.md` §13 and `docs/iso27001/17-employee-onboarding-offboarding-policy.md` — the session-revocation gap referenced in Statement 12.
- **NONE — gap:** no VPN, MDM, device-management, DLP, or network-location/IP-based access restriction exists anywhere in `server/` or `client/`. This policy is entirely organizational/procedural as a result.

## 6. Exceptions

Any request to access DutyLaunch HRMS from a device or network that does not meet this policy's baseline (e.g. an unmanaged personal device with no lock screen) requires written approval from [SECURITY OWNER], with a documented business justification, compensating controls, and a review date, recorded in the exceptions register established under policy 01.

## 7. Enforcement & Compliance

Because this policy has no technical enforcement point in the application, compliance relies on personnel attestation, manager oversight, and the general disciplinary provisions of policy 04. Any incident traced to non-compliance with this policy (e.g. a device compromise leading to unauthorized data access) is handled under the incident management process referenced in policy 01/09 and may result in disciplinary action per policy 04 §Enforcement.

## 8. Review Cycle

Reviewed at least annually, and immediately upon any decision to introduce a corporate VPN, MDM/device-management solution, or DLP control, or upon any remote-work-related security incident. Next scheduled review: [REVIEW DATE]. The gaps identified in Statements 6 and 11 must be re-assessed at each review until closed or formally risk-accepted by [SECURITY OWNER].
