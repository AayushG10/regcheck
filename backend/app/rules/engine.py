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

    if rule.status != RuleStatus.APPROVED:
        # Same approval gate run_all_rules enforces — guarded here too so
        # every caller of run_rule (e.g. the amendment simulator/commit
        # path, which calls it directly rather than through
        # run_all_rules) can't execute or commit an unapproved draft.
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
            explanation="This rule has not been approved yet — it is pending human review and cannot be run.",
        )

    handler = HANDLERS.get(rule.check_type)
    if handler is None:
        raise ValueError(f"No handler registered for check_type '{rule.check_type}'")

    try:
        verdict, evidence, explanation = handler(rule.params, broker)
    except KeyError as exc:
        # A handler's dot-path field lookup (see handlers.py::_get) failed —
        # almost always because an approved rule's `params` reference a
        # field name that doesn't exist in the real broker-data schema
        # (e.g. a bad LLM-drafted extraction that got approved anyway).
        # This must not crash the caller: /api/report, /api/checks/run,
        # /api/warnings, and /api/remediation all depend on run_all_rules
        # completing for every other rule, so one misconfigured rule
        # degrades to a single FAIL with a clear explanation instead of
        # taking the whole dashboard down with an unhandled 500.
        # exc.args[0] is the plain message _get raised with — str(exc)
        # would re-wrap it in quotes via KeyError's repr-based __str__.
        message = exc.args[0] if exc.args else str(exc)
        return CheckResult(
            rule_id=rule.id,
            rule_title=rule.title,
            rule_version=rule.version,
            clause_id=rule.clause_id,
            citation=rule.citation,
            category=rule.category,
            tier=rule.tier,
            verdict=Verdict.FAIL,
            evidence={"error": message},
            explanation=(
                f"{message} — this rule's params may be misconfigured (a drafted field "
                "name that doesn't match the broker data schema). Re-extract or manually "
                "fix this rule's params, then re-approve."
            ),
        )

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
