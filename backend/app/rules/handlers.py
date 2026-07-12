"""
Deterministic check handlers — the actual "rule engine" logic.

Each handler takes the rule's `params` dict and the broker data blob and
returns (verdict, evidence, explanation). No LLM calls happen anywhere in
this file: this is the auditable, re-runnable half of RegCheck. The LLM
(see llm/provider_router.py) only ever *drafts* the `params` a human then
approves — it never decides PASS/FAIL.

Field lookups use dot-path strings (e.g. "net_worth.current_net_worth_inr")
against the broker data JSON so rules stay data-driven and don't require a
new Python function every time a clause references a slightly different
field.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Callable

from app.storage.models import Verdict


def _get(data: dict[str, Any], dot_path: str) -> Any:
    node: Any = data
    for part in dot_path.split("."):
        if not isinstance(node, dict) or part not in node:
            raise KeyError(f"Field '{dot_path}' not found in broker data (missing '{part}')")
        node = node[part]
    return node


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _as_of(broker: dict[str, Any]) -> date:
    """Synthetic 'today' anchor so results are reproducible for the demo."""
    return _parse_date(broker["as_of_date"])


# ---------------------------------------------------------------------
# check_type: periodicity_check
# "has event X happened at least once every N days?"
# ---------------------------------------------------------------------
def periodicity_check(params: dict[str, Any], broker: dict[str, Any]) -> tuple[Verdict, dict, str]:
    last_event = _parse_date(_get(broker, params["last_event_date_field"]))
    today = _as_of(broker)
    days_elapsed = (today - last_event).days

    if "periodicity_days_by_category" in params:
        category = _get(broker, params["category_field"])
        periodicity_days = params["periodicity_days_by_category"].get(category)
        if periodicity_days is None:
            return Verdict.NOT_APPLICABLE, {"category": category}, f"No periodicity defined for category '{category}'."
    else:
        periodicity_days = params["periodicity_days"]

    verdict = Verdict.PASS if days_elapsed <= periodicity_days else Verdict.FAIL
    evidence = {
        "last_event_date": str(last_event),
        "as_of_date": str(today),
        "days_elapsed": days_elapsed,
        "required_periodicity_days": periodicity_days,
    }
    explanation = (
        f"Last event on {last_event} — {days_elapsed} days ago as of {today}; "
        f"required periodicity is every {periodicity_days} days."
    )
    return verdict, evidence, explanation


# ---------------------------------------------------------------------
# check_type: deadline_by_date
# "was the filing done by the applicable fixed calendar deadline?"
# ---------------------------------------------------------------------
def deadline_by_date(params: dict[str, Any], broker: dict[str, Any]) -> tuple[Verdict, dict, str]:
    filed_date = _parse_date(_get(broker, params["filed_date_field"]))
    period_end = _parse_date(_get(broker, params["period_end_field"]))

    due_date = None
    for entry in params["deadlines"]:
        pe_month, pe_day = entry["period_end_month_day"]
        if period_end.month == pe_month and period_end.day == pe_day:
            due_month, due_day = entry["due_month_day"]
            due_year = period_end.year if due_month >= pe_month else period_end.year + 1
            due_date = date(due_year, due_month, due_day)
            break

    if due_date is None:
        return Verdict.NOT_APPLICABLE, {"period_end": str(period_end)}, "No matching deadline rule for this period end date."

    verdict = Verdict.PASS if filed_date <= due_date else Verdict.FAIL
    evidence = {"period_end": str(period_end), "filed_date": str(filed_date), "due_date": str(due_date)}
    explanation = f"Report for period ending {period_end} was filed on {filed_date}; due date was {due_date}."
    return verdict, evidence, explanation


# ---------------------------------------------------------------------
# check_type: ratio_threshold
# "does numerator/denominator satisfy operator threshold?"
# ---------------------------------------------------------------------
def ratio_threshold(params: dict[str, Any], broker: dict[str, Any]) -> tuple[Verdict, dict, str]:
    numerator = _get(broker, params["numerator_field"])
    denominator = _get(broker, params["denominator_field"])
    ratio = numerator / denominator if denominator else 0.0
    operator = params["operator"]
    threshold = params["threshold"]

    ops: dict[str, Callable[[float, float], bool]] = {
        ">=": lambda a, b: a >= b,
        "<=": lambda a, b: a <= b,
        ">": lambda a, b: a > b,
        "<": lambda a, b: a < b,
    }
    passed = ops[operator](ratio, threshold)
    verdict = Verdict.PASS if passed else Verdict.FAIL
    evidence = {
        "numerator": numerator,
        "denominator": denominator,
        "ratio": round(ratio, 4),
        "operator": operator,
        "threshold": threshold,
    }
    explanation = f"Ratio is {ratio:.2%} ({numerator:,.0f} / {denominator:,.0f}); required {operator} {threshold:.0%}."
    return verdict, evidence, explanation


# ---------------------------------------------------------------------
# check_type: days_since_threshold
# "was the gap between reference_date and date_field within max_days?"
# ---------------------------------------------------------------------
def days_since_threshold(params: dict[str, Any], broker: dict[str, Any]) -> tuple[Verdict, dict, str]:
    event_date = _parse_date(_get(broker, params["date_field"]))
    reference_date = _parse_date(_get(broker, params["reference_field"]))
    max_days = params["max_days"]
    days_taken = (event_date - reference_date).days

    verdict = Verdict.PASS if 0 <= days_taken <= max_days else Verdict.FAIL
    evidence = {
        "reference_date": str(reference_date),
        "event_date": str(event_date),
        "days_taken": days_taken,
        "max_days": max_days,
    }
    explanation = f"Occurred {days_taken} days after {reference_date} (on {event_date}); allowed window is {max_days} days."
    return verdict, evidence, explanation


# ---------------------------------------------------------------------
# check_type: no_further_exposure_after_days
# "did the broker extend further exposure after the cutoff on an
# unresolved debit balance?"
# ---------------------------------------------------------------------
def no_further_exposure_after_days(params: dict[str, Any], broker: dict[str, Any]) -> tuple[Verdict, dict, str]:
    debit_arose = _parse_date(_get(broker, params["debit_arose_date_field"]))
    cleared = _get(broker, params["cleared_field"])
    further_exposure_given = _get(broker, params["further_exposure_given_field"])
    threshold = params["trading_days_threshold"]
    today = _as_of(broker)
    days_open = (today - debit_arose).days

    breach = (not cleared) and (days_open > threshold) and bool(further_exposure_given)
    verdict = Verdict.FAIL if breach else Verdict.PASS
    evidence = {
        "debit_arose_date": str(debit_arose),
        "days_open": days_open,
        "trading_days_threshold": threshold,
        "cleared": cleared,
        "further_exposure_given": further_exposure_given,
    }
    explanation = (
        f"Debit balance open since {debit_arose} ({days_open} days, threshold {threshold}); "
        f"further exposure given: {further_exposure_given}; cleared: {cleared}."
    )
    return verdict, evidence, explanation


HANDLERS: dict[str, Callable[[dict[str, Any], dict[str, Any]], tuple[Verdict, dict, str]]] = {
    "periodicity_check": periodicity_check,
    "deadline_by_date": deadline_by_date,
    "ratio_threshold": ratio_threshold,
    "days_since_threshold": days_since_threshold,
    "no_further_exposure_after_days": no_further_exposure_after_days,
}
