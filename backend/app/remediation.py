"""
Remediation (pipeline stage 7): turn every FAIL into an actionable work item.

Owner assignment and fix text are template-driven off rule.category — this
keeps remediation deterministic and reviewable, rather than another LLM
call whose wording could drift between runs.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from app.storage.models import CheckResult, RemediationTask, Verdict

_OWNER_BY_CATEGORY = {
    "Client Funds & Securities": "Operations Head",
    "Audit & Governance": "Compliance Officer",
    "Financial Soundness": "Chief Financial Officer",
    "Investor Protection": "Investor Grievance Officer",
    "Cybersecurity & Systems": "CISO / IT Head",
    "Risk Management": "Risk Manager",
}

_FIX_TEMPLATES = {
    "rule-running-account-settlement": "Settle all overdue running-account clients immediately and schedule the next settlement cycle within the 90-day window.",
    "rule-internal-audit-deadline": "File the pending half-yearly internal audit report with the exchange and obtain filing acknowledgment.",
    "rule-networth-minimum": "Infuse additional capital or reduce risk-weighted exposure to bring net worth back above 75% of the required minimum.",
    "rule-complaints-vs-networth": "Escalate and resolve high-value pending complaints to bring aggregate exposure back under the 50% net-worth cap.",
    "rule-monthly-upload-7days": "Upload the pending month's client funds/securities data to the exchange and review the upload SOP to prevent recurrence.",
    "rule-networth-certificate-60days": "Obtain and submit the CA-certified net worth certificate to the exchange without further delay.",
    "rule-system-audit-periodicity": "Engage a CERT-In empanelled auditor to conduct the overdue system audit.",
    "rule-vapt-half-yearly": "Commission a VAPT engagement immediately and remediate any critical findings before the next reporting cycle.",
    "rule-no-further-exposure-debit": "Recall the further exposure extended after day 5 and enforce the debit-balance exposure freeze until cleared.",
}

_PRIORITY_BY_CATEGORY = {
    "Financial Soundness": "high",
    "Risk Management": "high",
    "Investor Protection": "high",
    "Cybersecurity & Systems": "medium",
    "Client Funds & Securities": "medium",
    "Audit & Governance": "medium",
}


def build_remediation_tasks(results: list[CheckResult], as_of_date: Any) -> list[RemediationTask]:
    tasks: list[RemediationTask] = []
    for r in results:
        if r.verdict != Verdict.FAIL:
            continue
        owner = _OWNER_BY_CATEGORY.get(r.category, "Compliance Officer")
        fix = _FIX_TEMPLATES.get(r.rule_id, f"Remediate the breach identified for '{r.rule_title}'.")
        priority = _PRIORITY_BY_CATEGORY.get(r.category, "medium")
        due_offset = {"high": 3, "medium": 7, "low": 14}[priority]
        tasks.append(
            RemediationTask(
                id=f"task-{r.rule_id}",
                rule_id=r.rule_id,
                rule_title=r.rule_title,
                clause_id=r.clause_id,
                citation=r.citation,
                owner=owner,
                fix=fix,
                due_date=as_of_date + timedelta(days=due_offset),
                priority=priority,
            )
        )
    return tasks
