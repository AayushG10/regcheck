"""Stage 2 — Extract: LLM reads the clause and drafts a structured rule.

Uses the Groq "fast" tier by default for extraction drafts (cheap, quick
turnaround suits the iterate-per-clause workflow); callers can request the
OpenRouter "strong" tier for harder clauses. The LLM's output is never
executed directly — it is a *draft* that a human approves (see
triage_node and the /api/rules/{id}/approve endpoint), after which the
deterministic engine (rules/engine.py) is what actually runs it.
"""
from __future__ import annotations

from app.llm.prompts import EXTRACTION_SYSTEM_PROMPT, build_extraction_prompt
from app.llm.provider_router import call_llm, parse_json_response
from app.pipeline.state import PipelineState


def extract_node(state: PipelineState) -> PipelineState:
    if state.get("error"):
        return state

    prompt = build_extraction_prompt(state["clause_title"], state["clause_text"])
    tier = state.get("llm_tier", "fast")

    try:
        response = call_llm(prompt, system=EXTRACTION_SYSTEM_PROMPT, tier=tier)
        parsed = parse_json_response(response.content)
        return {
            **state,
            "extraction_raw": response.content,
            "extraction_json": parsed,
            "provider_used": f"{response.provider}:{response.model}",
        }
    except Exception as exc:  # noqa: BLE001 — surface any LLM/parsing failure to the API layer
        return {**state, "error": str(exc)}
