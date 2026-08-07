"""
Amendment loop (pipeline stage 8).

When SEBI tightens/loosens a rule (e.g. VAPT periodicity 6mo -> 3mo), we
don't want to touch the LLM at all — the whole point is that a structured
rule, once extracted, can be re-parameterized and re-run deterministically.

This module clones the amended rule into the *full* rule set and re-runs the
entire scorecard through the same engine used for the live report — not just
the single amended rule — because a real amendment's blast radius is "does
anything on our compliance status change," not just the one clause SEBI
edited. It returns both a single-rule before/after (for the UI's focused
flip animation) and a scorecard-level diff (for the "what actually changed"
summary).
"""
from __future__ import annotations

from typing import Any

from app.rules.engine import run_all_rules, run_rule
from app.storage.models import CheckResult, Rule


def _index_by_rule_id(results: list[CheckResult]) -> dict[str, CheckResult]:
    return {r.rule_id: r for r in results}


def simulate_amendment(
    rule: Rule, all_rules: list[Rule], broker: dict[str, Any], param_overrides: dict[str, Any]
) -> dict[str, Any]:
    # --- focused single-rule before/after (drives the flip animation) -----
    before_result = run_rule(rule, broker)

    amended_params = {**rule.params, **param_overrides}
    amended_rule = rule.model_copy(update={"params": amended_params})
    after_result = run_rule(amended_rule, broker)

    # --- scorecard-level diff: re-run *everything* with the amendment applied
    before_scorecard = run_all_rules(all_rules, broker)

    amended_rule_set = [amended_rule if r.id == rule.id else r for r in all_rules]
    after_scorecard = run_all_rules(amended_rule_set, broker)

    before_by_id = _index_by_rule_id(before_scorecard)
    after_by_id = _index_by_rule_id(after_scorecard)

    changed = [
        {
            "rule_id": rid,
            "rule_title": after_by_id[rid].rule_title,
            "before_verdict": before_by_id[rid].verdict,
            "after_verdict": after_by_id[rid].verdict,
        }
        for rid in before_by_id
        if before_by_id[rid].verdict != after_by_id[rid].verdict
    ]

    before_passed = sum(1 for r in before_scorecard if r.verdict.value == "PASS")
    after_passed = sum(1 for r in after_scorecard if r.verdict.value == "PASS")

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
        "scorecard_diff": {
            "total_checked": len(before_scorecard),
            "before_passed": before_passed,
            "after_passed": after_passed,
            "changed_count": len(changed),
            "unchanged_count": len(before_scorecard) - len(changed),
            "changed": changed,
        },
    }
