"""Stage: Diff/impact — identifies which existing obligation(s) a new
circular notice affects.

Deliberately deterministic, not an LLM call: matching a paragraph
reference that's explicitly printed in the notice text against the
paragraph citations already on our rules is a plain string search, not
something that benefits from — or should risk — an LLM's judgment. The
LLM only gets involved in the next stage, proposing *what* the amended
parameters should be.

A single paragraph citation can carry several distinct obligations —
para 15.8.1.1, for example, covers a net-worth ratio, a complaint-value
ratio, and a net-worth certificate filing deadline as three separate
rules. So a shared para citation only narrows the field to *candidates*;
which candidate the notice is actually about is decided by a plain
keyword-overlap score between the notice text and each candidate's
title/description — still deterministic, just not "first match in list
order wins".
"""
from __future__ import annotations

import re

from app.pipeline.state import AmendmentPipelineState
from app.storage.store import store

# Generic English words that would otherwise dominate the overlap score
# without saying anything about which obligation is meant.
_STOPWORDS = {
    "a", "an", "and", "any", "are", "as", "at", "be", "been", "by", "for",
    "from", "has", "have", "in", "into", "is", "it", "its", "may", "must",
    "no", "not", "of", "on", "or", "shall", "should", "that", "the", "this",
    "to", "was", "were", "will", "with", "within", "than", "such",
}


def _keywords(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


def _score(rule: dict, notice_keywords: set[str]) -> int:
    rule_keywords = _keywords(rule.get("title", "")) | _keywords(rule.get("description", ""))
    return len(rule_keywords & notice_keywords)


def diff_node(state: AmendmentPipelineState) -> AmendmentPipelineState:
    if state.get("error"):
        return state

    notice_text = state["notice_text"]
    rules = store.get_rules()

    candidates = [rule for rule in rules if rule["citation"]["para"] and rule["citation"]["para"] in notice_text]

    if not candidates:
        return {
            **state,
            "error": (
                "Could not match this notice to any existing obligation — "
                "no paragraph reference in the text corresponds to a rule RegCheck has extracted."
            ),
        }

    if len(candidates) == 1:
        matched = candidates[0]
    else:
        # Multiple rules share this paragraph citation — disambiguate by
        # which candidate's title/description the notice text is actually
        # about, not by list order.
        notice_keywords = _keywords(notice_text)
        scored = [(_score(rule, notice_keywords), rule) for rule in candidates]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        best_score, matched = scored[0]

        # If nothing meaningfully distinguishes the candidates (e.g. every
        # candidate scores 0, or there's an exact tie for the top score),
        # fall back to the original stable order rather than silently
        # picking arbitrarily.
        if best_score == 0 or (len(scored) > 1 and scored[1][0] == best_score):
            matched = candidates[0]

    return {
        **state,
        "matched_rule_id": matched["id"],
        "matched_clause_id": matched["clause_id"],
    }
