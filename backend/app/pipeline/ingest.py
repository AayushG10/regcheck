"""Stage 1 — Ingest: pull the clause text for extraction.

For this demo the corpus is a curated seed file (see data/circular_corpus.json)
standing in for a full SEBI circular PDF pull. Swapping in a live fetch/parse
of the actual PDF is a drop-in replacement for this function's body — the
rest of the pipeline only depends on `clause_title` / `clause_text` being
populated in state.
"""
from __future__ import annotations

from app.pipeline.state import PipelineState
from app.storage.store import store


def ingest_node(state: PipelineState) -> PipelineState:
    clause = store.get_clause(state["clause_id"])
    if clause is None:
        return {**state, "error": f"Clause '{state['clause_id']}' not found in corpus."}
    return {**state, "clause_title": clause["title"], "clause_text": clause["text"]}
