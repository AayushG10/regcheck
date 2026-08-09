"""
The deterministic rule engine.

Dispatches each approved, auto/evidence-tier rule to its handler in
handlers.py and packages the result as a CheckResult that always carries
the clause citation — this is what makes every verdict auditable back to
the exact SEBI paragraph.

Judgment-tier rules (check_type is None) are never executed here; they
are surfaced separately by the triage stage as "needs human assessment".
"""
from __future__ import annotations

from typing import Any

from app.rules.handlers import HANDLERS
from app.storage.models import CheckResult, ClauseCitation, Rule, RuleStatus, Tier, Verdict


def run_rule(rule: Rule, broker: dict[str, Any]) -> CheckResult:
    if rule.check_type is None or rule.tier == Tier.JUDGMENT:
        return CheckResult(
            rule_id=rule.id,
            rule_title=rule.title,
            rule_version=rule.version,
            clause_id=rule.clause_id,
            citation=rule.citation,
            category=rule.category,
            tier=rule.tier,
            verdict=Verdict.NOT_APPLICABLE,
            evidence={},
            explanation="This obligation requires human judgment and has no deterministic check.",
        )

    handler = HANDLERS.get(rule.check_type)
    if handler is None:
        raise ValueError(f"No handler registered for check_type '{rule.check_type}'")

    verdict, evidence, explanation = handler(rule.params, broker)
    return CheckResult(
        rule_id=rule.id,
        rule_title=rule.title,
        rule_version=rule.version,
        clause_id=rule.clause_id,
        citation=rule.citation,
        category=rule.category,
        tier=rule.tier,
        verdict=verdict,
        evidence=evidence,
        explanation=explanation,
    )


def run_all_rules(rules: list[Rule], broker: dict[str, Any]) -> list[CheckResult]:
    """Runs every approved rule (auto + evidence tiers) against broker data.
    Judgment-tier and not-yet-approved rules are skipped from execution but
    can still be listed by the triage/coverage endpoints."""
    results = []
    for rule in rules:
        if rule.tier == Tier.JUDGMENT:
            continue
        if rule.status != RuleStatus.APPROVED:
            continue
        results.append(run_rule(rule, broker))
    return results
