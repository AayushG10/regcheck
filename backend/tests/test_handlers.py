"""
Tests for the deterministic rule engine (app/rules/handlers.py).

This is the half of RegCheck that's supposed to be boring and trustworthy —
plain Python comparisons, no LLM. A compliance engine with zero tests over
its own pass/fail logic is the least defensible gap in an otherwise
"auditable" system, so these specifically target the boundary conditions
that decide whether a broker is compliant or not: exactly-on-the-deadline,
one-day-over, and the flags that gate each handler's breach condition.
"""
from __future__ import annotations

import pytest

from app.rules.handlers import (
    days_since_threshold,
    deadline_by_date,
    no_further_exposure_after_days,
    periodicity_check,
    ratio_threshold,
)
from app.storage.models import Verdict


# ---------------------------------------------------------------------
# periodicity_check
# ---------------------------------------------------------------------
def test_periodicity_check_pass_on_exact_boundary():
    params = {"last_event_date_field": "last", "periodicity_days": 90}
    broker = {"as_of_date": "2026-04-01", "last": "2026-01-01"}  # exactly 90 days
    verdict, evidence, _ = periodicity_check(params, broker)
    assert verdict == Verdict.PASS
    assert evidence["days_elapsed"] == 90


def test_periodicity_check_fails_one_day_over_boundary():
    params = {"last_event_date_field": "last", "periodicity_days": 90}
    broker = {"as_of_date": "2026-04-02", "last": "2026-01-01"}  # 91 days
    verdict, _, _ = periodicity_check(params, broker)
    assert verdict == Verdict.FAIL


def test_periodicity_check_by_category_not_applicable_for_unknown_category():
    params = {
        "last_event_date_field": "last",
        "periodicity_days_by_category": {"Category I": 365},
        "category_field": "category",
    }
    broker = {"as_of_date": "2026-04-01", "last": "2026-01-01", "category": "Category IV"}
    verdict, evidence, _ = periodicity_check(params, broker)
    assert verdict == Verdict.NOT_APPLICABLE
    assert evidence["category"] == "Category IV"


def test_periodicity_check_by_category_matches_correct_bucket():
    params = {
        "last_event_date_field": "last",
        "periodicity_days_by_category": {"Category I": 365, "Category II": 730},
        "category_field": "category",
    }
    broker = {"as_of_date": "2027-01-01", "last": "2026-01-01", "category": "Category II"}
    # 366 days elapsed, well within Category II's 730-day window
    verdict, evidence, _ = periodicity_check(params, broker)
    assert verdict == Verdict.PASS
    assert evidence["required_periodicity_days"] == 730


# ---------------------------------------------------------------------
# deadline_by_date
# ---------------------------------------------------------------------
DEADLINE_PARAMS = {
    "filed_date_field": "filed",
    "period_end_field": "period_end",
    "deadlines": [{"period_end_month_day": [3, 31], "due_month_day": [5, 31]}],
}


def test_deadline_by_date_pass_when_filed_exactly_on_due_date():
    broker = {"filed": "2026-05-31", "period_end": "2026-03-31"}
    verdict, evidence, _ = deadline_by_date(DEADLINE_PARAMS, broker)
    assert verdict == Verdict.PASS
    assert evidence["due_date"] == "2026-05-31"


def test_deadline_by_date_fails_one_day_late():
    broker = {"filed": "2026-06-01", "period_end": "2026-03-31"}
    verdict, _, _ = deadline_by_date(DEADLINE_PARAMS, broker)
    assert verdict == Verdict.FAIL


def test_deadline_by_date_not_applicable_for_unmapped_period_end():
    broker = {"filed": "2026-06-01", "period_end": "2026-06-30"}
    verdict, _, _ = deadline_by_date(DEADLINE_PARAMS, broker)
    assert verdict == Verdict.NOT_APPLICABLE


# ---------------------------------------------------------------------
# ratio_threshold
# ---------------------------------------------------------------------
def test_ratio_threshold_pass_at_exact_gte_boundary():
    params = {"numerator_field": "n", "denominator_field": "d", "operator": ">=", "threshold": 0.75}
    broker = {"n": 75, "d": 100}
    verdict, evidence, _ = ratio_threshold(params, broker)
    assert verdict == Verdict.PASS
    assert evidence["ratio"] == 0.75


def test_ratio_threshold_fails_just_under_gte_boundary():
    params = {"numerator_field": "n", "denominator_field": "d", "operator": ">=", "threshold": 0.75}
    broker = {"n": 749, "d": 1000}
    verdict, _, _ = ratio_threshold(params, broker)
    assert verdict == Verdict.FAIL


def test_ratio_threshold_pass_at_exact_lte_boundary():
    params = {"numerator_field": "n", "denominator_field": "d", "operator": "<=", "threshold": 0.5}
    broker = {"n": 50, "d": 100}
    verdict, _, _ = ratio_threshold(params, broker)
    assert verdict == Verdict.PASS


def test_ratio_threshold_fails_just_over_lte_boundary():
    params = {"numerator_field": "n", "denominator_field": "d", "operator": "<=", "threshold": 0.5}
    broker = {"n": 501, "d": 1000}
    verdict, _, _ = ratio_threshold(params, broker)
    assert verdict == Verdict.FAIL


def test_ratio_threshold_handles_zero_denominator_without_crashing():
    params = {"numerator_field": "n", "denominator_field": "d", "operator": ">=", "threshold": 0.5}
    broker = {"n": 10, "d": 0}
    verdict, evidence, _ = ratio_threshold(params, broker)
    assert verdict == Verdict.FAIL
    assert evidence["ratio"] == 0.0


# ---------------------------------------------------------------------
# days_since_threshold
# ---------------------------------------------------------------------
def test_days_since_threshold_pass_at_exact_boundary():
    params = {"date_field": "event", "reference_field": "ref", "max_days": 60}
    broker = {"ref": "2026-01-01", "event": "2026-03-02"}  # exactly 60 days later
    verdict, evidence, _ = days_since_threshold(params, broker)
    assert verdict == Verdict.PASS
    assert evidence["days_taken"] == 60


def test_days_since_threshold_fails_one_day_over_boundary():
    params = {"date_field": "event", "reference_field": "ref", "max_days": 60}
    broker = {"ref": "2026-01-01", "event": "2026-03-03"}  # 61 days
    verdict, _, _ = days_since_threshold(params, broker)
    assert verdict == Verdict.FAIL


def test_days_since_threshold_fails_when_event_precedes_reference():
    params = {"date_field": "event", "reference_field": "ref", "max_days": 60}
    broker = {"ref": "2026-03-01", "event": "2026-02-01"}  # negative days_taken
    verdict, evidence, _ = days_since_threshold(params, broker)
    assert verdict == Verdict.FAIL
    assert evidence["days_taken"] < 0


# ---------------------------------------------------------------------
# no_further_exposure_after_days
# ---------------------------------------------------------------------
EXPOSURE_PARAMS = {
    "debit_arose_date_field": "arose",
    "cleared_field": "cleared",
    "further_exposure_date_field": "exposure_date",
    "trading_days_threshold": 5,
}


def test_no_further_exposure_pass_at_exact_threshold_boundary():
    # exposure given exactly on the deadline (arose + threshold), not
    # strictly after it -> not yet a breach
    broker = {"arose": "2026-01-01", "cleared": False, "exposure_date": "2026-01-06"}
    verdict, evidence, _ = no_further_exposure_after_days(EXPOSURE_PARAMS, broker)
    assert evidence["deadline_date"] == "2026-01-06"
    assert verdict == Verdict.PASS


def test_no_further_exposure_fails_one_day_past_threshold_when_exposed_and_uncleared():
    broker = {"arose": "2026-01-01", "cleared": False, "exposure_date": "2026-01-07"}
    verdict, evidence, _ = no_further_exposure_after_days(EXPOSURE_PARAMS, broker)
    assert evidence["deadline_date"] == "2026-01-06"
    assert verdict == Verdict.FAIL


def test_no_further_exposure_pass_when_balance_cleared_despite_overdue():
    broker = {"arose": "2026-01-01", "cleared": True, "exposure_date": "2026-01-10"}
    verdict, _, _ = no_further_exposure_after_days(EXPOSURE_PARAMS, broker)
    assert verdict == Verdict.PASS


def test_no_further_exposure_pass_when_no_further_exposure_was_given():
    # No exposure_date field on record at all -> no further exposure given
    broker = {"arose": "2026-01-01", "cleared": False}
    verdict, evidence, _ = no_further_exposure_after_days(EXPOSURE_PARAMS, broker)
    assert evidence["further_exposure_given"] is False
    assert verdict == Verdict.PASS


def test_no_further_exposure_computes_from_real_exposure_date_not_a_boolean_label():
    # Regression: the handler must derive breach status from the actual
    # further_exposure_date field, not trust a separately pre-labeled
    # boolean that could disagree with it.
    broker = {"arose": "2026-06-20", "cleared": False, "exposure_date": "2026-06-29"}
    verdict, evidence, _ = no_further_exposure_after_days(EXPOSURE_PARAMS, broker)
    assert evidence["deadline_date"] == "2026-06-25"
    assert verdict == Verdict.FAIL


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
