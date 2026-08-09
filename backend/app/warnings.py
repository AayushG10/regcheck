"""
Early-warning scan (pipeline stage 6): flag obligations that currently
PASS but are close to breaching their next deadline/periodicity window
(e.g. "VAPT certificate due in 8 days"). Pure Python over the same
evidence the rule engine already computed — no LLM involved.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from app.storage.models import CheckResult, EarlyWarning, Rule, Verdict

# Obligations due within this many days are surfaced at all. The frontend
# further buckets these into "due soon" (<=21 days, matches the original
# early-warning cutoff) vs "further out" — a broker's compliance calendar
# is more useful showing the next ~6-7 months of deadlines than only the
# next three weeks.
WARNING_WINDOW_DAYS = 200


def _parse(d: str) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date()


def _next_deadline_by_date_due(evidence: dict[str, Any], params: dict[str, Any]) -> date | None:
    """Rolls a `deadline_by_date` rule's evidence forward to the *next*
    cycle's due date, given the rule's `deadlines` param (the same
    period_end_month_day / due_month_day pairs the handler itself uses).

    `evidence["due_date"]` is the due date for the period that has already
    passed (the rule is PASS, so it was already filed on time) — reusing it
    as-is would silently report a deadline that's already gone. Instead we
    find the next occurrence, among all configured periods, that falls
    strictly after the period_end already on file, then compute its due
    date with the same month/year rollover logic as the handler.
    """
    deadlines = params.get("deadlines")
    if not deadlines:
        return None

    period_end = _parse(evidence["period_end"])

    next_period_end: date | None = None
    next_entry: dict[str, Any] | None = None
    for entry in deadlines:
        pe_month, pe_day = entry["period_end_month_day"]
        candidate = date(period_end.year, pe_month, pe_day)
        if candidate <= period_end:
            candidate = date(period_end.year + 1, pe_month, pe_day)
        if next_period_end is None or candidate < next_period_end:
            next_period_end = candidate
            next_entry = entry

    if next_period_end is None or next_entry is None:
        return None

    due_month, due_day = next_entry["due_month_day"]
    pe_month = next_entry["period_end_month_day"][0]
    due_year = next_period_end.year if due_month >= pe_month else next_period_end.year + 1
    return date(due_year, due_month, due_day)


def scan_for_warnings(
    results: list[CheckResult],
    as_of_date: date,
    rules_by_id: dict[str, Rule] | None = None,
) -> list[EarlyWarning]:
    warnings: list[EarlyWarning] = []
    rules_by_id = rules_by_id or {}

    for r in results:
        if r.verdict != Verdict.PASS:
            continue  # already failing -> that's remediation's job, not an early warning

        evidence = r.evidence
        next_due: date | None = None

        if "required_periodicity_days" in evidence and "last_event_date" in evidence:
            last_event = _parse(evidence["last_event_date"])
            next_due = last_event + timedelta(days=evidence["required_periodicity_days"])
        elif "due_date" in evidence and "period_end" in evidence:
            # deadline_by_date: `due_date` is the deadline for the period
            # that just passed (already PASS). Compute the *next* cycle's
            # deadline from the rule's own `deadlines` param instead of
            # reusing the stale one.
            rule = rules_by_id.get(r.rule_id)
            next_due = _next_deadline_by_date_due(evidence, rule.params) if rule else None
            if next_due is None:
                # Fallback: no params available, best effort with the
                # already-passed due date (previous behaviour).
                next_due = _parse(evidence["due_date"])
        elif "due_date" in evidence:
            next_due = _parse(evidence["due_date"])
        elif "max_days" in evidence and "reference_date" in evidence:
            # days_since_threshold: e.g. monthly upload (next occurrence is
            # a month after the current reference) or the annual net-worth
            # certificate (next occurrence is a year after). This check_type
            # is shared by rules with different real-world cadences, so the
            # gap to the *next* reference date is read from the rule's own
            # `cadence_days` param rather than a single hardcoded assumption
            # — a monthly-only assumption here would put an annual rule's
            # next-due date off by roughly 11 months.
            rule = rules_by_id.get(r.rule_id)
            cadence_days = rule.params.get("cadence_days") if rule else None
            if cadence_days is None:
                # No cadence declared on the rule (e.g. an older/hand-edited
                # draft) — fall back to the previous monthly assumption
                # rather than silently dropping the warning.
                cadence_days = 30
            reference = _parse(evidence["reference_date"])
            next_due = reference + timedelta(days=cadence_days + evidence["max_days"])

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
