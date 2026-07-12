"""
Amendment loop (pipeline stage 8).

When SEBI tightens/loosens a rule (e.g. VAPT periodicity 6mo -> 3mo), we
don't want to touch the LLM at all — the whole point is that a structured
rule, once extracted, can be re-parameterized and re-run deterministically.
This module clones a rule with an overridden param, re-runs it through the
same engine used for the live report, and returns a before/after diff so
the frontend can animate the verdict flip.
"""
from __future__ import annotations

from typing import Any

from app.rules.engine import run_rule
from app.storage.models import Rule


def simulate_amendment(rule: Rule, broker: dict[str, Any], param_overrides: dict[str, Any]) -> dict[str, Any]:
    before_result = run_rule(rule, broker)

    amended_params = {**rule.params, **param_overrides}
    amended_rule = rule.model_copy(update={"params": amended_params})
    after_result = run_rule(amended_rule, broker)

    return {
        "rule_id": rule.id,
        "rule_title": rule.title,
        "clause_id": rule.clause_id,
        "citation": rule.citation.model_dump(),
        "original_params": rule.params,
        "amended_params": amended_params,
        "before": before_result.model_dump(),
        "after": after_result.model_dump(),
        "flipped": before_result.verdict != after_result.verdict,
    }
