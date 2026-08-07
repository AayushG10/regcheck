"""Stage: Propose — the LLM drafts the amended rule parameters.

This is the only LLM call in the amendment loop, and — same discipline as
the extraction stage — its output is a *draft*. It never becomes a live
rule until a human approves it (see api/routes.py::commit_amendment,
which enforces the maker-checker gate before calling
store.create_rule_version).
"""
from __future__ import annotations

from app.llm.prompts import AMENDMENT_PROPOSAL_SYSTEM_PROMPT, build_amendment_proposal_prompt
from app.llm.provider_router import call_llm, parse_json_response
from app.pipeline.state import AmendmentPipelineState
from app.storage.store import store


def propose_node(state: AmendmentPipelineState) -> AmendmentPipelineState:
    if state.get("error"):
        return state

    rule = store.get_rule(state["matched_rule_id"])
    if rule is None:
        return {**state, "error": f"Matched rule '{state['matched_rule_id']}' no longer exists."}

    prompt = build_amendment_proposal_prompt(rule["title"], rule["params"], state["notice_text"])
    tier = state.get("llm_tier", "fast")

    try:
        response = call_llm(prompt, system=AMENDMENT_PROPOSAL_SYSTEM_PROMPT, tier=tier)
        parsed = parse_json_response(response.content)
        return {
            **state,
            "proposal_raw": response.content,
            "proposal_json": parsed,
            "provider_used": f"{response.provider}:{response.model}",
        }
    except Exception as exc:  # noqa: BLE001 — surface any LLM/parsing failure to the API layer
        return {**state, "error": str(exc)}
