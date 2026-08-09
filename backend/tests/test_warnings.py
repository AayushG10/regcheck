"""
Tests for the early-warning "next due" calculation (app/warnings.py).

Regression coverage for the days_since_threshold cadence bug: this
check_type is shared by the monthly upload rule (cadence_days=30) and the
annual net-worth-certificate rule (cadence_days=365). A single hardcoded
30-day assumption for "next occurrence" would put the certificate rule's
next-due date off by roughly 11 months whenever it PASSes — masked in the
real seed data because that rule currently FAILs, so it's built here with a
hypothetical PASSing scenario instead of mutating seed data.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.storage.models import CheckResult, ClauseCitation, Rule, RuleStatus, Tier, Verdict
from app.warnings import scan_for_warnings

CITATION = ClauseCitation(circular="SEBI Master Circular for Stock Brokers", para="15.8.1.1")


def _certificate_rule() -> Rule:
    return Rule(
        id="rule-networth-certificate-60days",
        clause_id="para-15.8.1.1-certificate",
        title="Net Worth Certificate Within 60 Days",
        description="...",
        citation=CITATION,
        category="Financial Soundness",
        check_type="days_since_threshold",
        params={
            "date_field": "net_worth.certificate_submission_date",
            "reference_field": "net_worth.financial_year_end_date",
            "max_days": 60,
            "cadence_days": 365,
        },
        confidence=0.82,
        tier=Tier.EVIDENCE,
        status=RuleStatus.APPROVED,
        effective_from=date(2026, 4, 1),
    )


def _monthly_upload_rule() -> Rule:
    return Rule(
        id="rule-monthly-upload-7days",
        clause_id="para-15.9.1.4",
        title="Monthly Fund/Securities Upload Within 7 Days",
        description="...",
        citation=CITATION,
        category="Client Funds & Securities",
        check_type="days_since_threshold",
        params={
            "date_field": "monthly_upload.last_upload_date",
            "reference_field": "monthly_upload.period_end_date",
            "max_days": 7,
            "cadence_days": 30,
        },
        confidence=0.94,
        tier=Tier.AUTO,
        status=RuleStatus.APPROVED,
        effective_from=date(2026, 4, 1),
    )


def _passing_result(rule: Rule, reference_date: str, event_date: str) -> CheckResult:
    days_taken = (date.fromisoformat(event_date) - date.fromisoformat(reference_date)).days
    return CheckResult(
        rule_id=rule.id,
        rule_title=rule.title,
        rule_version=rule.version,
        clause_id=rule.clause_id,
        citation=rule.citation,
        category=rule.category,
        tier=rule.tier,
        verdict=Verdict.PASS,
        evidence={
            "reference_date": reference_date,
            "event_date": event_date,
            "days_taken": days_taken,
            "max_days": rule.params["max_days"],
        },
        explanation="ok",
    )


def test_annual_certificate_next_due_is_one_year_out_not_one_month():
    # Regression: a hardcoded "+30 days" would compute next_due as
    # reference + 90 days (2026-06-29) instead of the correct reference +
    # 425 days (~2027-05-30) — off by roughly 11 months.
    rule = _certificate_rule()
    result = _passing_result(rule, reference_date="2026-03-31", event_date="2026-04-15")
    # Picked close enough to the (correct) ~year-out deadline to fall inside
    # scan_for_warnings' WARNING_WINDOW_DAYS — a hardcoded +30-day
    # computation would have already put the (wrong) deadline in the past
    # relative to this as_of date, and dropped the warning entirely.
    as_of = date(2026, 11, 20)

    warnings = scan_for_warnings([result], as_of, {rule.id: rule})

    assert len(warnings) == 1
    expected_next_due = date(2026, 3, 31) + timedelta(days=365 + 60)
    assert warnings[0].deadline_date == expected_next_due
    # Sanity: this must be ~a year out, not ~a month out.
    assert (expected_next_due - as_of).days > 150


def test_monthly_upload_next_due_is_about_a_month_out():
    rule = _monthly_upload_rule()
    result = _passing_result(rule, reference_date="2026-06-30", event_date="2026-07-03")
    as_of = date(2026, 7, 5)

    warnings = scan_for_warnings([result], as_of, {rule.id: rule})

    assert len(warnings) == 1
    expected_next_due = date(2026, 6, 30) + timedelta(days=30 + 7)
    assert warnings[0].deadline_date == expected_next_due
    assert (expected_next_due - as_of).days < 60


def test_days_since_threshold_falls_back_to_monthly_when_cadence_missing():
    # Rules drafted/edited before cadence_days existed shouldn't silently
    # drop their warning — fall back to the previous (monthly) behaviour.
    rule = _monthly_upload_rule()
    rule.params.pop("cadence_days")
    result = _passing_result(rule, reference_date="2026-06-30", event_date="2026-07-03")
    as_of = date(2026, 7, 5)

    warnings = scan_for_warnings([result], as_of, {rule.id: rule})

    assert len(warnings) == 1
    assert warnings[0].deadline_date == date(2026, 6, 30) + timedelta(days=30 + 7)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
