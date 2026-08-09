"""
Extraction-time schema validation for LLM-drafted rule params.

The LLM only ever *drafts* a rule's `params` (dot-path field names into the
broker data blob) — a human approves before it can run (see
pipeline/triage.py, api/routes.py::extract_rule). But nothing previously
checked whether those drafted dot-paths actually resolve against the real
broker-data schema (backend/data/broker_profile.json) before asking a human
to sign off on them. A human reviewer has no way to eyeball whether
"financial_year_end_date" should really be "net_worth.financial_year_end_date"
without cross-referencing the raw broker JSON themselves.

This module is a second line of defense alongside the crash-proofing in
rules/engine.py::run_rule — that guard means a bad draft can never crash the
app even if approved anyway, but a reviewer should still be warned *before*
approving, not just find out from a FAIL after the fact.
"""
from __future__ import annotations

from typing import Any

from app.rules.handlers import field_exists

# Which of a check_type's params are dot-path field references that must
# resolve against the broker data blob for the rule to be runnable.
# `further_exposure_date_field` is deliberately excluded: it is legitimately
# absent from broker data when no further exposure was ever given (see
# handlers.py::_get_optional), so its absence is not a schema error.
REQUIRED_FIELD_PARAMS: dict[str, list[str]] = {
    "periodicity_check": ["last_event_date_field"],
    "deadline_by_date": ["filed_date_field", "period_end_field"],
    "ratio_threshold": ["numerator_field", "denominator_field"],
    "days_since_threshold": ["date_field", "reference_field"],
    "no_further_exposure_after_days": ["debit_arose_date_field", "cleared_field"],
}


def unresolved_dot_paths(check_type: str | None, params: dict[str, Any], broker: dict[str, Any]) -> list[str]:
    """Returns the drafted dot-path field names (if any) that don't resolve
    against the given broker data blob. Empty list means the draft's field
    references are all schema-valid (says nothing about whether the *values*
    the fields resolve to are semantically correct — that's still a human's
    job)."""
    if not check_type:
        return []

    unresolved: list[str] = []
    field_keys = list(REQUIRED_FIELD_PARAMS.get(check_type, []))
    if check_type == "periodicity_check" and "category_field" in params:
        field_keys.append("category_field")

    for key in field_keys:
        path = params.get(key)
        if not path:
            continue  # a missing param entirely is a different problem than a bad path
        if not field_exists(broker, path):
            unresolved.append(path)

    return unresolved
