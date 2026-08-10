"""
Tests for the amendment-detection matcher (app/pipeline/diff.py).

Covers both tiers deliberately: a "citation" match (a rule's paragraph is
explicitly cited in the notice) must still work exactly as before, and the
new "fuzzy" fallback (no citation, keyword-similarity guess) must trigger
on a genuinely on-topic notice while correctly declining on an unrelated
one — the fallback exists specifically because most real SEBI circulars
don't cite one of RegCheck's small set of known paragraphs, but it must
not turn into a rule that matches everything.

Uses a small fake rule set + clause corpus (monkeypatched onto the store)
rather than the real seed data, so this stays isolated from whatever state
the JSON files are in at test time — same reasoning as test_warnings.py's
synthetic Rule objects.
"""
from __future__ import annotations

import app.pipeline.diff as diff_module
from app.pipeline.diff import diff_node
from app.pipeline.state import AmendmentPipelineState

_FAKE_RULES = [
    {
        "id": "rule-vapt-half-yearly",
        "clause_id": "para-18.5.5.8-9",
        "title": "QSB VAPT Half-Yearly (6 Months)",
        "description": "Qualified Stock Brokers must run VAPT at least once every 6 months.",
        "citation": {"circular": "SEBI Master Circular for Stock Brokers", "para": "18.5.5.8-9"},
        "tier": "auto",
    },
    {
        "id": "rule-networth-minimum",
        "clause_id": "para-15.8.1.1-networth",
        "title": "Net Worth ≥ 75% of Requirement",
        "description": "Broker's net worth must be at least 75% of the prescribed minimum.",
        "citation": {"circular": "SEBI Master Circular for Stock Brokers", "para": "15.8.1.1"},
        "tier": "auto",
    },
    {
        "id": "rule-complaints-vs-networth",
        "clause_id": "para-15.8.1.1-complaints",
        "title": "Pending Complaint Value ≤ 50% of Net Worth",
        "description": "Aggregate pending complaint value must not exceed 50% of net worth.",
        "citation": {"circular": "SEBI Master Circular for Stock Brokers", "para": "15.8.1.1"},
        "tier": "auto",
    },
    {
        "id": "rule-grievance-adequacy",
        "clause_id": "para-15.13-illustrative",
        "title": "Grievance Redressal Mechanism Adequacy",
        "description": "Qualitative judgment call, no deterministic check.",
        "citation": {"circular": "SEBI Master Circular for Stock Brokers", "para": "15.13 (illustrative)"},
        "tier": "judgment",
    },
]

_FAKE_CLAUSES = {
    "para-18.5.5.8-9": {
        "clause_id": "para-18.5.5.8-9",
        "title": "VAPT for Qualified Stock Brokers",
        "text": (
            "Qualified Stock Brokers shall conduct Vulnerability Assessment and Penetration Testing "
            "of their applications and infrastructure at least once every six months, and shall "
            "remediate critical vulnerabilities without delay."
        ),
    },
}


def _fake_get_rules():
    return [dict(r) for r in _FAKE_RULES]


def _fake_get_clause(clause_id: str):
    return _FAKE_CLAUSES.get(clause_id)


def _patch_store(monkeypatch):
    monkeypatch.setattr(diff_module.store, "get_rules", _fake_get_rules)
    monkeypatch.setattr(diff_module.store, "get_clause", _fake_get_clause)


def test_citation_match_still_works(monkeypatch):
    """A notice explicitly citing a rule's paragraph matches it directly,
    unaffected by the new fuzzy fallback existing alongside it."""
    _patch_store(monkeypatch)
    state: AmendmentPipelineState = {
        "notice_text": "In partial modification of para 18.5.5.8-9, VAPT periodicity is now quarterly.",
        "llm_tier": "fast",
    }
    result = diff_node(state)
    assert result.get("error") is None
    assert result["matched_rule_id"] == "rule-vapt-half-yearly"
    assert result["match_type"] == "citation"


def test_citation_disambiguates_shared_paragraph(monkeypatch):
    """Two rules share para 15.8.1.1 -- the notice's own wording (about
    complaints, not net worth) must pick the right one, not list order."""
    _patch_store(monkeypatch)
    state: AmendmentPipelineState = {
        "notice_text": (
            "In partial modification of para 15.8.1.1, the pending complaint value threshold "
            "as a percentage of net worth is revised from 50% to 40%."
        ),
        "llm_tier": "fast",
    }
    result = diff_node(state)
    assert result.get("error") is None
    assert result["matched_rule_id"] == "rule-complaints-vs-networth"
    assert result["match_type"] == "citation"


def test_fuzzy_match_triggers_on_genuinely_related_notice(monkeypatch):
    """No paragraph is cited, but the notice is unambiguously about VAPT --
    real wording overlapping the clause text (vulnerabilities, applications,
    infrastructure, penetration testing) should clear the fuzzy threshold."""
    _patch_store(monkeypatch)
    state: AmendmentPipelineState = {
        "notice_text": (
            "Modification in Cyber Security and Cyber Resilience Framework for Stock Brokers. "
            "All Qualified Stock Brokers shall conduct Vulnerability Assessment and Penetration "
            "Testing of their applications and infrastructure, and remediate critical "
            "vulnerabilities identified during such testing without delay."
        ),
        "llm_tier": "fast",
    }
    result = diff_node(state)
    assert result.get("error") is None
    assert result["matched_rule_id"] == "rule-vapt-half-yearly"
    assert result["match_type"] == "fuzzy"
    assert result["match_score"] >= diff_module._FUZZY_MIN_SCORE


def test_fuzzy_match_declines_on_unrelated_notice(monkeypatch):
    """A real-world case that must NOT match: a circular on an entirely
    different topic (securities transmission to legal heirs) shares no
    meaningful vocabulary with any known rule and must honestly report no
    match rather than guessing."""
    _patch_store(monkeypatch)
    state: AmendmentPipelineState = {
        "notice_text": (
            "Simplification and standardisation of the framework for transmission of securities "
            "held in dematerialized mode to legal heirs and nominees upon the death of the "
            "securityholder, including simplified documentation requirements for RTAs."
        ),
        "llm_tier": "fast",
    }
    result = diff_node(state)
    assert result.get("error") is not None
    assert "matched_rule_id" not in result


def test_fuzzy_match_declines_when_scores_cluster_too_closely(monkeypatch):
    """A notice written in generic SEBI filing/deadline boilerplate can clear
    the minimum score against several rules at once without genuinely being
    about any of them -- a real case found by live polling (a circular on an
    unrelated AIF topic scored 13 against a debit-balance exposure rule, but
    11 and 10 against two others purely on shared words like "account",
    "balance", "days", "period"). The margin check must decline this even
    though the top score alone clears _FUZZY_MIN_SCORE."""
    _patch_store(monkeypatch)
    # net-worth-minimum and complaints-vs-networth share almost identical
    # generic vocabulary in this fake corpus, so a notice heavy on their
    # shared words scores close to both -- exactly the clustering case.
    state: AmendmentPipelineState = {
        "notice_text": (
            "Aggregate value net worth prescribed minimum requirement percentage "
            "threshold revised broker complaint pending value assessment."
        ),
        "llm_tier": "fast",
    }
    result = diff_node(state)
    assert result.get("error") is not None
    assert "matched_rule_id" not in result


def test_judgment_tier_rules_are_never_matched(monkeypatch):
    """Judgment-tier obligations have no deterministic check to amend --
    even a notice that happens to share vocabulary with one must not match
    it, citation or fuzzy."""
    _patch_store(monkeypatch)
    state: AmendmentPipelineState = {
        "notice_text": "In partial modification of para 15.13, the grievance redressal mechanism adequacy standard is revised.",
        "llm_tier": "fast",
    }
    result = diff_node(state)
    # The paragraph "15.13" is a substring of "15.13 (illustrative)" but not
    # bounded the same way _para_cited_in expects, and even if it were, the
    # rule is judgment-tier and must be excluded from candidates entirely.
    assert result.get("matched_rule_id") != "rule-grievance-adequacy"
