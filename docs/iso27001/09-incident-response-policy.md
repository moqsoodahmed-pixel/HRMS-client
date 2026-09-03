# Incident Response Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — prepared as part of an ISO/IEC 27001:2022 readiness exercise. [ORGANIZATION NAME] is **not** currently ISO/IEC 27001 certified.

## 1. Purpose

This policy establishes governance for how [ORGANIZATION NAME] detects, responds to, communicates about, and learns from information security incidents affecting the DutyLaunch HRMS application. It defines *who is responsible and what principles apply*. It does **not** contain step-by-step response procedures — those live in the operational plan at `docs/incident-response-plan.md`, which this policy governs and requires to exist and be kept current.

## 2. Scope

This policy applies to any suspected or confirmed event that compromises, or risks compromising, the confidentiality, integrity, or availability of HRMS data or systems — including but not limited to: unauthorized access or access attempts, data exposure or leakage (particularly of identity documents or compensation data), account compromise, malware, denial of service, loss of encryption key material, and vulnerabilities discovered in dependencies or application code.

## 3. Policy Statements

1. **A detailed operational incident response plan must exist and be maintained.** The authoritative step-by-step procedure — detection, triage severity levels, containment steps, evidence preservation, eradication, recovery, and communication templates — is maintained at `docs/incident-response-plan.md`. This policy and that plan must be reviewed together; if they diverge, this policy's governance principles prevail and the plan must be updated to match.
2. **Every suspected incident must be reported immediately**, regardless of confidence level, following the reporting channel defined in policy 04 (Acceptable Use Policy) §4 and detailed in the operational plan. Under-reporting due to uncertainty is treated as a process failure, not a personal one.
3. **Escalation authority is explicit.** [SECURITY OWNER] is the default incident commander for any confirmed incident. [SECURITY OWNER] may escalate to [APPROVER] for incidents involving suspected personal data exposure, regulatory exposure, or reputational risk, and must involve [LEGAL COUNSEL] before any external communication is made about a confirmed data-related incident.
4. **Severity and response timing are defined in the operational plan**, not in this policy. This policy requires only that a severity classification scheme exist and be applied consistently; the specific thresholds and target response times are owned by `docs/incident-response-plan.md`.
5. **Containment must not destroy evidence.** Any containment or remediation action taken during an incident must preserve, wherever feasible, the audit trail described in policy 11 (Logging and Monitoring Policy) — including relevant `AuditLog` records (`server/models/NotificationAudit.js`) and server logs — until [SECURITY OWNER] confirms they are no longer needed for investigation.
6. **Communication is need-to-know and centrally coordinated.** During an active incident, only [SECURITY OWNER] (or their designated delegate) may authorize communications to affected employees, [APPROVER], or any external party. Ad hoc communication by individual responders is discouraged to prevent inconsistent or premature disclosure.
7. **No jurisdiction-specific legal notification deadlines are asserted by this policy.** Whether a given incident triggers a legal or regulatory notification obligation (e.g. to a data protection authority or to affected individuals) is a determination for [LEGAL COUNSEL], made case-by-case, and is out of scope for this document.
8. **A post-incident review is mandatory for every confirmed incident**, regardless of severity or whether the operational plan's target timelines were met. The review must produce, at minimum: a timeline of what happened, root cause (or best available explanation), what worked, what did not, and a set of tracked remediation actions with owners.
9. **Remediation actions from post-incident reviews must be tracked to closure.** [SECURITY OWNER] is accountable for ensuring identified action items are not silently dropped; unresolved actions must be visible at each policy review cycle (Section 6).
10. **This policy assumes the operational plan exists.** As of this draft, the referenced plan is being established for the first time. Until it is complete and approved, this policy's requirements (reporting channel, escalation authority, post-incident review) still apply in principle, but the organization should treat the absence of a fully populated `docs/incident-response-plan.md` as an open gap to be tracked in the Statement of Applicability, not as grounds to skip incident handling.

## 4. Roles & Responsibilities

- **[SECURITY OWNER]:** Default incident commander; owns the operational plan (`docs/incident-response-plan.md`); coordinates response; authorizes communications; accountable for post-incident review and remediation tracking.
- **[APPROVER]:** Escalation point for high-severity or reputationally sensitive incidents; approves external communications alongside [LEGAL COUNSEL].
- **[LEGAL COUNSEL]:** Advises on any legal/regulatory notification obligation; must be consulted before external disclosure of a confirmed data-related incident.
- **Engineering/Development team:** Executes technical containment, eradication, and recovery steps as directed by the incident commander; preserves logs and evidence; participates in post-incident review.
- **All personnel with HRMS access:** Responsible for reporting suspected incidents promptly per policy 04 §4, without fear of blame for false positives.

## 5. Related Evidence in This Repository

- `server/models/NotificationAudit.js` — the `AuditLog` collection, a source of forensic evidence during an incident (actor, action, module, target, timestamp for security-sensitive events).
- `server/routes/index.js` (`/audit`, `/audit/filters`, `/audit/:id`) — read-only audit endpoints, restricted to AUDITOR/SUPER_ADMIN/CTO, usable during investigation.
- `server/middleware/errorHandler.js` — server-side `console.error` logging of unhandled exceptions, a secondary evidence source.
- `docs/incident-response-plan.md` — the detailed operational plan this policy governs. **Required to exist; treat as a dependency of this policy, not optional reading.**
- Automated monitoring/alerting/SIEM to *detect* incidents proactively: **NONE — gap.** Detection today depends on manual observation, application errors surfacing to users, or after-the-fact audit log review. See policy 11 §5.

## 6. Exceptions

Any deviation from this policy (e.g. bypassing the reporting channel for a specific class of low-risk event) requires written approval from [SECURITY OWNER], with a documented justification and review date, recorded in the exceptions register described in policy 01 §10.

## 7. Enforcement & Compliance

Failure to report a suspected incident, or unauthorized external communication about a confirmed incident, may result in disciplinary action per [ORGANIZATION NAME]'s HR policies. Compliance with this policy is assessed at each post-incident review and at the policy review cycle below.

## 8. Review Cycle

This policy — and the operational plan it governs — are reviewed at least annually, after every confirmed incident (as part of the mandatory post-incident review), and whenever escalation authority, roles, or reporting channels change. Next scheduled review: [REVIEW DATE].
