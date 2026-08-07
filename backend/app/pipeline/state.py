"""Shared state passed between LangGraph nodes for the extraction pipeline
(stages 1-3: ingest -> extract -> triage)."""
from __future__ import annotations

from typing import Any, TypedDict


class PipelineState(TypedDict, total=False):
    clause_id: str
    clause_title: str
    clause_text: str
    llm_tier: str  # "fast" (Groq) or "strong" (OpenRouter)

    extraction_raw: str
    extraction_json: dict[str, Any]
    provider_used: str

    final_tier: str
    final_status: str
    error: str | None


class AmendmentPipelineState(TypedDict, total=False):
    """State for the amendment-detection pipeline (monitor -> diff -> propose):
    given a new SEBI circular notice, find the obligation it affects and draft
    the parameter change — see pipeline/amendment_graph.py."""
    notice_text: str
    llm_tier: str  # "fast" (Groq) or "strong" (OpenRouter)

    matched_rule_id: str
    matched_clause_id: str

    proposal_raw: str
    proposal_json: dict[str, Any]
    provider_used: str

    error: str | None
