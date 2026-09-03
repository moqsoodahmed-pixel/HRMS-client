# Management Review Template — ISO/IEC 27001:2022 Clause 9.3

> **This is a blank template, not a completed review.** No management
> review of the ISMS has yet been conducted for [ORGANIZATION NAME]. Any
> example, illustrative, or placeholder text below is there only to show
> how a field should be filled in — it must not be read, quoted, or cited
> as an actual completed review, a real management decision, or evidence
> that a review meeting has occurred. Every bracketed field must be
> completed at the time of a real review meeting, and a completed copy
> should be saved as a new, dated file (e.g.
> `docs/iso27001/management-review-2026-Q1.md`) rather than overwriting
> this template.

**Template Owner:** [SECURITY OWNER]
**Template Version:** 1.0

---

## Review Meeting Details

| Field | Entry |
|---|---|
| Organization | [ORGANIZATION NAME] |
| Review date | [REVIEW DATE] |
| Chaired by | [APPROVER] |
| ISMS owner present | [SECURITY OWNER] |
| Other attendees | ______________________________ |
| Review period covered (since last review, or since ISMS scope was set) | From: __________  To: __________ |

---

## 1. Status of Actions from Previous Management Reviews

*Clause 9.3(a) — Review must consider the status of actions from previous
reviews. Since this is the first review, this section will be empty on
first use; leave it explicitly marked as such rather than deleting it.*

| Action item (from previous review) | Owner | Due date | Status (Open / In Progress / Closed) | Notes |
|---|---|---|---|---|
| *(No previous management review has been conducted — this table has no prior entries as of the first review.)* | | | | |

---

## 2. Changes in External and Internal Issues Relevant to the ISMS

*Clause 9.3(b) — e.g. new legal/regulatory developments, changes to the
organization's structure, new technology adopted, changes in stakeholder
expectations, changes to the threat landscape.*

| Area | Change identified | Impact on ISMS | Owner |
|---|---|---|---|
| Legal/regulatory | | | [LEGAL COUNSEL] |
| Organizational (structure, headcount, roles) | | | [SECURITY OWNER] |
| Technology/architecture | | | [SECURITY OWNER] |
| Threat landscape | | | [SECURITY OWNER] |
| Interested-party expectations (customers, employees, regulators) | | | [SECURITY OWNER] |

---

## 3. Information on ISMS Performance

*Clause 9.3(c) — nonconformities and corrective actions, monitoring and
measurement results, audit results, and fulfilment of information
security objectives.*

### 3.1 Nonconformities and Corrective Actions

| Nonconformity | Source (internal audit / incident / self-identified) | Corrective action | Owner | Status |
|---|---|---|---|---|
| | | | | |

### 3.2 Monitoring and Measurement Results

Reference the security objectives defined per policy 01
(Information Security Policy), Section covering measurable objectives
(e.g. incident response time, access review completion, patch/
vulnerability remediation). As of this template's first use, no
objectives have yet been formally tracked with numeric targets — record
actual results here once objectives are defined and measured.

| Objective | Target | Actual result this period | Met? (Y/N) |
|---|---|---|---|
| | | | |

### 3.3 Audit Results

The first available inputs to this section, as of the initial review
cycle, are:

- **`docs/iso27001/internal-audit-report.md`** — the internal audit
  report (to be produced as the first internal ISMS audit; if not yet
  produced at the time of a given review, state that explicitly here
  rather than leaving this blank without explanation).
- **`server/scripts/smoke-test.cjs`** (143 assertions) and
  **`server/scripts/smoke-test-business-rules.cjs`** (75 assertions,
  including dedicated security checks) — the two automated regression
  suites that serve as a recurring, code-level control-verification
  input, distinct from a formal management-system audit but relevant as
  monitoring evidence.

| Audit / test source | Date run | Result summary | Findings requiring management attention |
|---|---|---|---|
| Internal ISMS audit (`internal-audit-report.md`) | | | |
| `smoke-test.cjs` | | ___ / 143 passing | |
| `smoke-test-business-rules.cjs` | | ___ / 75 passing | |

---

## 4. Feedback from Interested Parties

*Clause 9.3(c)/(d) — feedback from employees, management, customers,
regulators, or other interested parties regarding information security.*

| Interested party | Feedback received | Date | Response/action taken |
|---|---|---|---|
| | | | |

*(If no feedback has been received in the review period, state that
explicitly: "No feedback received from interested parties during this
period" — do not leave this table silently empty with no explanation.)*

---

## 5. Results of Risk Assessment and Status of the Risk Treatment Plan

*Clause 9.3(c) — reference the current risk assessment and risk treatment
plan.*

- **Risk assessment reference:** `docs/iso27001/risk-assessment.md` (to
  be established — as of this template's authoring, no formal risk
  assessment document yet exists in this repository; note in a real
  review whether it has since been produced).
- **Risk treatment plan reference:** `docs/iso27001/risk-treatment-plan.md`
  (to be established on the same basis).

| Risk ID | Risk description | Current treatment status | Residual risk level | Owner | Next action |
|---|---|---|---|---|---|
| | | | | | |

**Summary of risk posture this period:** ___________________________________

---

## 6. Opportunities for Continual Improvement

*Clause 9.3(e) / Clause 10.2.*

| Opportunity identified | Rationale | Proposed owner | Priority |
|---|---|---|---|
| | | | |

*Known structural gaps carried forward from the SDLC readiness work
(see `docs/iso27001/secure-development-lifecycle.md`) that should be
considered here at the first review include, at minimum: absence of
version control, absence of a CI/CD pipeline, absence of formal threat
modeling, and absence of a documented production deployment/change
-management process. Whether each remains open, and its priority, should
be assessed fresh at each review rather than copied forward unchanged.*

---

## 7. Adequacy of Resources

*Clause 9.3(c)/(f) — whether the ISMS has adequate resources (people,
budget, tooling, time) to operate effectively and improve.*

| Resource area | Adequate? (Y/N) | Gap identified | Owner |
|---|---|---|---|
| Personnel / staffing for security responsibilities | | | [SECURITY OWNER] |
| Budget for security tooling (e.g. future CI/CD, SAST/DAST, secrets scanning) | | | [APPROVER] |
| Time allocated for security work vs. feature delivery | | | [SECURITY OWNER] |
| Training / awareness | | | [SECURITY OWNER] |

---

## 8. Outputs of the Management Review

*Clause 9.3 — outputs must include decisions related to continual
improvement and any changes needed to the ISMS.*

### 8.1 Decisions Related to Continual Improvement

| Decision | Rationale | Owner | Target date |
|---|---|---|---|
| | | | |

### 8.2 Changes Needed to the ISMS

| Change (policy, scope, control, process) | Reason | Owner | Target date |
|---|---|---|---|
| | | | |

### 8.3 Resource Allocation Decisions

| Decision | Owner | Target date |
|---|---|---|
| | | |

---

## Sign-off

| Role | Name | Signature/approval | Date |
|---|---|---|---|
| ISMS Owner | [SECURITY OWNER] | | [REVIEW DATE] |
| Approver | [APPROVER] | | [REVIEW DATE] |

**Next scheduled management review:** [REVIEW DATE]

---

## Related Documents

- `docs/iso27001/01-information-security-policy.md`
- `docs/iso27001/secure-development-lifecycle.md`
- `docs/iso27001/data-protection-overview.md`
- `docs/iso27001/internal-audit-report.md` (to be established)
- `docs/iso27001/risk-assessment.md` (to be established)
- `docs/iso27001/risk-treatment-plan.md` (to be established)
- `server/scripts/smoke-test.cjs`
- `server/scripts/smoke-test-business-rules.cjs`
