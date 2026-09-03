# Business Continuity Policy

**Document Owner:** [SECURITY OWNER]
**Approved by:** [APPROVER]
**Version:** 1.0 (Draft)
**Last Reviewed:** [REVIEW DATE]
**Status:** Draft — ISO/IEC 27001:2022 readiness exercise for [ORGANIZATION NAME]. Subordinate to the Information Security Policy (01). Supports Annex A control 5.29/5.30 (Information security during disruption / ICT readiness for business continuity).

## 1. Purpose

This policy establishes governance for maintaining the availability of DutyLaunch HRMS — objectives, decision-making authority, roles, and review cadence — in the event of a disruption. It is a **governance document**: it does not itself contain step-by-step recovery procedures. Detailed procedures are maintained in `docs/business-continuity.md` and `docs/disaster-recovery.md`, referenced throughout this policy, and this policy must not be read as duplicating them.

## 2. Scope

Applies to the availability of the DutyLaunch HRMS application (frontend, backend API, and database), and to the organizational response to any event that disrupts that availability — infrastructure failure, data loss, hosting-provider outage, or a security incident with availability impact.

## 3. Current State — Read This Before Relying on This Policy

`docs/business-continuity.md` (business-level continuity plan: critical functions, communication plan, manual fallback options, continuity roles) and `docs/disaster-recovery.md` (technical recovery plan: failure scenarios and step-by-step restore procedures, post-recovery verification) exist in this repository and hold the detailed procedures this policy governs — this policy does not repeat their content.

**However, both plans are honest that they describe target process, not demonstrated capability.** As both documents state plainly: this application runs as a single Node.js process against a single standalone local MongoDB instance with no redundancy at any layer; **no automated backup mechanism exists** for the database or for `server/uploads/` (the companion `docs/backup-and-recovery.md` and policy 10 track this as a gap, not a completed control); **no restore has ever been tested**, because no backup exists to restore from; no production hosting provider has been selected (`[HOSTING PROVIDER]` placeholder in use); and no incident-commander/on-call role has been assigned. Until a backup mechanism is implemented and a restore has been executed and verified successfully at least once, both plans are correct to describe the current recoverability of this system, in a total-loss scenario, as "not recoverable, only manually reconstructable." This policy's governance framework is therefore ahead of the operational capability it governs, deliberately, so that intent and accountability are recorded while the capability itself is still being built. Implementing an actual backup mechanism (policy 10) and executing a first successful restore test are tracked as priority items in the Statement of Applicability.

## 4. Policy Statements

### Continuity objectives

1. [ORGANIZATION NAME] intends to maintain the availability of DutyLaunch HRMS to authorized users at a level consistent with its operational importance to HR, payroll, and compliance functions. Specific, numeric continuity objectives (Recovery Time Objective / Recovery Point Objective) have **not yet been formally defined or adopted**. The following are offered purely as **PROPOSED, illustrative examples** for [SECURITY OWNER] to evaluate, adjust, and formally adopt — they are not current commitments:
   - **PROPOSED RTO (Recovery Time Objective):** 24 hours for full application restoration following a total infrastructure loss.
   - **PROPOSED RPO (Recovery Point Objective):** 24 hours of acceptable data loss, implying at least a daily backup cadence once a backup mechanism exists.
   - These figures are placeholders for discussion, not adopted targets. [SECURITY OWNER] must set actual RTO/RPO based on a documented business-impact assessment before they are relied upon.
2. Continuity planning must address, at minimum: loss of the hosting environment, loss/corruption of the MongoDB database, loss of uploaded-document storage (`server/uploads/` or its production equivalent), and loss of key personnel with operational knowledge of the system.

### Governance and authority

3. **Activation authority.** Only [SECURITY OWNER], or [APPROVER] in [SECURITY OWNER]'s absence, may formally declare a business continuity event and activate the procedures in `docs/business-continuity.md` / `docs/disaster-recovery.md`. Both documents name a proposed "Incident Commander" coordination role that has not yet been assigned to a named individual — until it is, [SECURITY OWNER] (or [APPROVER] in their absence) fills that coordination function directly, per both plans' explicit acknowledgment of this gap.
4. **Detailed procedures live outside this document.** Step-by-step recovery procedures, restore runbooks, contact trees, and system-specific recovery sequencing belong in `docs/business-continuity.md` (organizational continuity: critical-function impact ranking, communication plan, manual fallback options, continuity roles) and `docs/disaster-recovery.md` (technical recovery: per-scenario restore procedures — database corruption, server compromise, accidental mass deletion, ransomware, hosting-provider infrastructure loss — plus mandatory post-recovery verification against the two automated smoke-test suites). This governance policy sets the objectives and authority those plans must operate under; it must not be read as a substitute for them, and any conflict between this policy and the detailed plans on a procedural point should be resolved in favor of the detailed plans, escalated to [SECURITY OWNER] if the conflict is material.
5. Any future backup mechanism introduced for DutyLaunch HRMS (database and uploaded-document storage) must itself be evidenced — backup existence, backup encryption at rest (consistent with policy 15's RESTRICTED-data requirements, since backups will contain the same identity documents and compensation data as the live system), and a periodically tested restore procedure. An untested backup is not evidence of a working continuity control.

### Roles in a continuity event

6. [SECURITY OWNER] is accountable for the overall continuity response and for deciding when normal operations have been restored, per `docs/disaster-recovery.md` §4's verification bar (which requires both automated smoke-test suites to pass at 100% against the recovered environment, not merely that the process starts).
7. The Engineering/Development team, together with the [DATABASE ADMINISTRATOR] role named in `docs/disaster-recovery.md`, is responsible for executing the technical recovery steps documented there once a backup mechanism exists to restore from.
8. HR_ADMIN and [APPROVER] are responsible for organizational communication to affected personnel during a disruption, per the communication plan and cadence in `docs/business-continuity.md` §4.

### Testing and review

9. Once a backup mechanism is implemented (policy 10 / `docs/backup-and-recovery.md`), the restore procedure documented in `docs/disaster-recovery.md` must be tested at a cadence set by [SECURITY OWNER] (**PROPOSED, per `docs/business-continuity.md` §7:** at minimum annually, combined where possible into a single BC/DR exercise), with results recorded and any gap found remediated before the next review. As of this draft, **no such test has ever been performed**, because no backup yet exists to restore from.
10. This governance policy, and the plans it references, must be reviewed whenever the application's architecture, hosting arrangement, or data model changes materially, and at the cadence in Section 9 below.

## 5. Roles & Responsibilities

- **[SECURITY OWNER]:** Owns this policy and activation authority (Statement 3); accountable for prioritizing the backup mechanism (policy 10) that both `docs/business-continuity.md` and `docs/disaster-recovery.md` are written to depend on, and for assigning the still-vacant Incident Commander / on-call and [DATABASE ADMINISTRATOR] roles those plans name.
- **[APPROVER]:** Continuity/recovery activation authority in [SECURITY OWNER]'s absence; authorizes business-impact decisions during an event (e.g. manual payroll fallback) per `docs/business-continuity.md` §3; approves this policy and material revisions.
- **Engineering/Development team:** Executes the technical procedures in `docs/disaster-recovery.md`; responsible for implementing and testing an actual backup mechanism once prioritized under policy 10.
- **HR_ADMIN:** Responsible for organizational communication during any disruption, per Statement 8 and `docs/business-continuity.md` §4.

## 6. Related Evidence in This Repository

- `docs/business-continuity.md` — the detailed business-level continuity plan this policy governs (critical-function impact table, proposed RTO/RPO, continuity roles, communication plan, manual fallback options, exercise schedule).
- `docs/disaster-recovery.md` — the detailed technical recovery plan this policy governs (per-scenario procedures, general recovery sequence, mandatory post-recovery verification, evidence preservation, post-recovery review process).
- `docs/iso27001/10-backup-and-recovery-policy.md` and `docs/backup-and-recovery.md` — the backup mechanism, retention, and restore-testing requirements both plans above are written to depend on.
- `docs/iso27001/01-information-security-policy.md` §8 — acknowledges "no backups" and "no external monitoring" as known technical gaps at the ISMS level.
- `docs/iso27001/15-cryptography-policy.md` — encryption requirements that apply to any future backup of RESTRICTED-tier data.
- `server/scripts/smoke-test.cjs` (143 assertions) and `server/scripts/smoke-test-business-rules.cjs` (75 assertions) — the automated pass/fail bar `docs/disaster-recovery.md` §4 requires against any restored environment.
- **NONE — gap:** no automated backup mechanism exists for the MongoDB database or `server/uploads/`. No restore procedure has ever been tested, because none exists to test. No production hosting provider has been selected. No Incident Commander/on-call or [DATABASE ADMINISTRATOR] role has been assigned to a named individual.

## 7. Exceptions

Any interim, ad hoc continuity or recovery action taken outside the documented procedures in `docs/business-continuity.md` / `docs/disaster-recovery.md` (e.g. because a real event occurs before a backup mechanism exists, forcing manual reconstruction rather than restore) must be documented after the fact by [SECURITY OWNER], including what was done and why, and fed back into those plans as a lesson learned, consistent with their own post-recovery review requirements. A written exception is otherwise required for any deliberate deviation from those documented procedures, with justification and a review date, recorded in the exceptions register established under policy 01.

## 8. Enforcement & Compliance

Compliance is evidenced by (a) the existence and currency of `docs/business-continuity.md` and `docs/disaster-recovery.md`, (b) adherence to the activation-authority rule in Statement 3 during any real event, and (c) once a backup mechanism exists, a documented, dated record of the most recent restore test and its outcome against `docs/disaster-recovery.md` §4's verification bar. Compliance with the underlying capability (backups, tested restores) is governed and assessed separately under policy 10.

## 9. Review Cycle

Reviewed at least annually, and immediately upon a material revision to `docs/business-continuity.md` / `docs/disaster-recovery.md`, selection of [HOSTING PROVIDER], implementation of a backup mechanism, or any real continuity/recovery event (each of which should trigger a re-issue of this policy and, per Statement 9, feed lessons learned back into the detailed plans). Next scheduled review: [REVIEW DATE]. Until the backup mechanism and restore-testing gaps in Section 3 are closed, this policy must be treated as a statement of intended governance over documented plans, not evidence of demonstrated business continuity capability.
