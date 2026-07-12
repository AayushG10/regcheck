"""
Early-warning scan (pipeline stage 6): flag obligations that currently
PASS but are close to breaching their next deadline/periodicity window
(e.g. "VAPT certificate due in 8 days"). Pure Python over the same
evidence the rule engine already computed — no LLM involved.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from app.storage.models import CheckResult, EarlyWarning, Verdict

WARNING_WINDOW_DAYS = 21


def _parse(d: str) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date()


def scan_for_warnings(results: list[CheckResult], as_of_date: date) -> list[EarlyWarning]:
    warnings: list[EarlyWarning] = []

    for r in results:
        if r.verdict != Verdict.PASS:
            continue  # already failing -> that's remediation's job, not an early warning

        evidence = r.evidence
        next_due: date | None = None

        if "required_periodicity_days" in evidence and "last_event_date" in evidence:
            last_event = _parse(evidence["last_event_date"])
            next_due = last_event + timedelta(days=evidence["required_periodicity_days"])
        elif "due_date" in evidence:
            next_due = _parse(evidence["due_date"])
        elif "max_days" in evidence and "reference_date" in evidence:
            # e.g. monthly upload: next occurrence is a month after the current reference
            reference = _parse(evidence["reference_date"])
            next_due = reference + timedelta(days=30 + evidence["max_days"])

        if next_due is None:
            continue

        days_remaining = (next_due - as_of_date).days
        if 0 <= days_remaining <= WARNING_WINDOW_DAYS:
            warnings.append(
                EarlyWarning(
                    rule_id=r.rule_id,
                    rule_title=r.rule_title,
                    clause_id=r.clause_id,
                    citation=r.citation,
                    deadline_date=next_due,
                    days_remaining=days_remaining,
                    message=f"'{r.rule_title}' is due again in {days_remaining} day(s) (by {next_due}).",
                )
            )

    return sorted(warnings, key=lambda w: w.days_remaining)
