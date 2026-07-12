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
