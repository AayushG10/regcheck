"""Stage 3 — Triage: assign the final tier/status for a freshly extracted
rule and enforce the confidence gate — anything below 0.85 is forced into
`needs_review` regardless of what the LLM proposed for tier/status, so a
human always approves low-confidence extractions before they run.
"""
from __future__ import annotations

from app.pipeline.state import PipelineState

CONFIDENCE_APPROVAL_THRESHOLD = 0.85


def triage_node(state: PipelineState) -> PipelineState:
    if state.get("error"):
        return state

    extraction = state["extraction_json"]
    confidence = float(extraction.get("confidence", 0.0))
    llm_tier = extraction.get("tier", "evidence")

    if confidence < CONFIDENCE_APPROVAL_THRESHOLD:
        final_status = "needs_review"
    else:
        final_status = "needs_review" if llm_tier == "judgment" else "approved"

    return {**state, "final_tier": llm_tier, "final_status": final_status}


def compute_coverage(rules: list[dict]) -> dict:
    """Coverage % = share of obligations that are fully auto-checkable."""
    total = len(rules)
    if total == 0:
        return {"total": 0, "auto": 0, "evidence": 0, "judgment": 0, "coverage_pct": 0.0}

    auto = sum(1 for r in rules if r["tier"] == "auto")
    evidence = sum(1 for r in rules if r["tier"] == "evidence")
    judgment = sum(1 for r in rules if r["tier"] == "judgment")

    return {
        "total": total,
        "auto": auto,
        "evidence": evidence,
        "judgment": judgment,
        "coverage_pct": round((auto / total) * 100, 1),
    }
