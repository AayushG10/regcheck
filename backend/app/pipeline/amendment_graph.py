"""LangGraph wiring for the amendment-detection loop: monitor -> diff -> propose.

This is the piece that makes RegCheck's "agentic" claim real rather than
"an LLM call triggered by a button." The extraction graph
(pipeline/graph.py) turns clause text into a rule once; this graph closes
the loop — it watches for a *change* to a rule that already exists, works
out which obligation is affected, and drafts the amendment, all before a
human ever has to re-read the new circular themselves. The human still
approves the result (via api/routes.py::commit_amendment) before it's
allowed to run — same discipline as the extraction pipeline.
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.pipeline.diff import diff_node
from app.pipeline.monitor import monitor_node
from app.pipeline.propose import propose_node
from app.pipeline.state import AmendmentPipelineState


def build_amendment_graph():
    graph = StateGraph(AmendmentPipelineState)
    graph.add_node("monitor", monitor_node)
    graph.add_node("diff", diff_node)
    graph.add_node("propose", propose_node)

    graph.set_entry_point("monitor")
    graph.add_edge("monitor", "diff")
    graph.add_edge("diff", "propose")
    graph.add_edge("propose", END)

    return graph.compile()


_compiled_amendment_graph = build_amendment_graph()


def run_amendment_pipeline(notice_text: str, llm_tier: str = "fast") -> AmendmentPipelineState:
    initial_state: AmendmentPipelineState = {"notice_text": notice_text, "llm_tier": llm_tier}
    return _compiled_amendment_graph.invoke(initial_state)
