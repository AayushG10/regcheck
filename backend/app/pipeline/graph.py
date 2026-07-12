"""LangGraph wiring for pipeline stages 1-3: ingest -> extract -> triage.

Stages 4-8 (rule engine, report, warnings, remediation, amendment) are
deliberately plain deterministic Python called directly from the API
layer, not part of this graph — the separation matters: LangGraph/the LLM
only ever touches the *drafting* side of a rule, never the pass/fail
decision.
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.pipeline.extract import extract_node
from app.pipeline.ingest import ingest_node
from app.pipeline.state import PipelineState
from app.pipeline.triage import triage_node


def build_extraction_graph():
    graph = StateGraph(PipelineState)
    graph.add_node("ingest", ingest_node)
    graph.add_node("extract", extract_node)
    graph.add_node("triage", triage_node)

    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "extract")
    graph.add_edge("extract", "triage")
    graph.add_edge("triage", END)

    return graph.compile()


_compiled_graph = build_extraction_graph()


def run_extraction_pipeline(clause_id: str, llm_tier: str = "fast") -> PipelineState:
    initial_state: PipelineState = {"clause_id": clause_id, "llm_tier": llm_tier}
    return _compiled_graph.invoke(initial_state)
