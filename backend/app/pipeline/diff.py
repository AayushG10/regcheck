"""Stage: Diff/impact — identifies which existing obligation(s) a new
circular notice affects.

Deliberately deterministic, not an LLM call: matching a paragraph
reference that's explicitly printed in the notice text against the
paragraph citations already on our rules is a plain string search, not
something that benefits from — or should risk — an LLM's judgment. The
LLM only gets involved in the next stage, proposing *what* the amended
parameters should be.
"""
from __future__ import annotations

from app.pipeline.state import AmendmentPipelineState
from app.storage.store import store


def diff_node(state: AmendmentPipelineState) -> AmendmentPipelineState:
    if state.get("error"):
        return state

    notice_text = state["notice_text"]
    rules = store.get_rules()

    matched = None
    for rule in rules:
        para = rule["citation"]["para"]
        if para and para in notice_text:
            matched = rule
            break

    if matched is None:
        return {
            **state,
            "error": (
                "Could not match this notice to any existing obligation — "
                "no paragraph reference in the text corresponds to a rule RegCheck has extracted."
            ),
        }

    return {
        **state,
        "matched_rule_id": matched["id"],
        "matched_clause_id": matched["clause_id"],
    }
