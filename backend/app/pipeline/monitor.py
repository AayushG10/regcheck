"""Stage: Monitor — detects that a new/amended SEBI circular exists.

In production this would poll SEBI's circular index (or an ingestion feed)
on a schedule and diff it against the last-seen corpus. For the demo, a
"new circular" is supplied directly as `notice_text` — the entry point of
this graph is deliberately shaped so a real polling monitor is a drop-in
replacement for this function's body without touching diff/propose below it.
"""
from __future__ import annotations

from app.pipeline.state import AmendmentPipelineState


def monitor_node(state: AmendmentPipelineState) -> AmendmentPipelineState:
    notice_text = (state.get("notice_text") or "").strip()
    if not notice_text:
        return {**state, "error": "No circular notice text provided."}
    return state
