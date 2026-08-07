"""All REST endpoints for RegCheck. Kept in one router for a hackathon-sized
codebase; split by prefix if this grows further."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.pipeline.graph import run_extraction_pipeline
from app.pipeline.triage import compute_coverage
from app.remediation import build_remediation_tasks
from app.rules.amendment import simulate_amendment
from app.rules.engine import run_all_rules
from app.storage.models import Rule
from app.storage.store import store
from app.warnings import scan_for_warnings

router = APIRouter(prefix="/api")


def _load_rules() -> list[Rule]:
    return [Rule(**r) for r in store.get_rules()]


def _as_of_date():
    return datetime.strptime(store.get_broker_profile()["as_of_date"], "%Y-%m-%d").date()


# ---------------------------------------------------------------------
# Corpus & rules
# ---------------------------------------------------------------------
@router.get("/clauses")
def list_clauses() -> dict[str, Any]:
    return store.get_circular_corpus()


@router.get("/rules")
def list_rules() -> list[dict]:
    return store.get_rules()


@router.get("/rules/{rule_id}")
def get_rule(rule_id: str) -> dict:
    rule = store.get_rule(rule_id)
    if rule is None:
        raise HTTPException(404, f"Rule '{rule_id}' not found")
    return rule


class ApproveRequest(BaseModel):
    status: str = "approved"


@router.post("/rules/{rule_id}/approve")
def approve_rule(rule_id: str, body: ApproveRequest) -> dict:
    rule = store.get_rule(rule_id)
    if rule is None:
        raise HTTPException(404, f"Rule '{rule_id}' not found")
    rule["status"] = body.status
    store.upsert_rule(rule)
    return rule


# ---------------------------------------------------------------------
# Extraction (stages 1-3, via LangGraph)
# ---------------------------------------------------------------------
class ExtractRequest(BaseModel):
    clause_id: str
    llm_tier: str = "fast"  # "fast" -> Groq, "strong" -> OpenRouter


@router.post("/extract")
def extract_rule(body: ExtractRequest) -> dict:
    result = run_extraction_pipeline(body.clause_id, body.llm_tier)

    if result.get("error"):
        raise HTTPException(422, result["error"])

    extraction = result["extraction_json"]
    return {
        "clause_id": body.clause_id,
        "extraction": extraction,
        "final_tier": result["final_tier"],
        "final_status": result["final_status"],
        "provider_used": result["provider_used"],
        "raw_llm_output": result["extraction_raw"],
    }


# ---------------------------------------------------------------------
# Rule engine / report (stage 4-5)
# ---------------------------------------------------------------------
@router.post("/checks/run")
@router.get("/report")
def run_checks() -> dict:
    rules = _load_rules()
    broker = store.get_broker_profile()
    results = run_all_rules(rules, broker)

    passed = sum(1 for r in results if r.verdict.value == "PASS")
    failed = sum(1 for r in results if r.verdict.value == "FAIL")

    return {
        "broker_name": broker["broker_name"],
        "as_of_date": broker["as_of_date"],
        "total_checked": len(results),
        "passed": passed,
        "failed": failed,
        "results": [r.model_dump() for r in results],
    }


# ---------------------------------------------------------------------
# Coverage (stage 3 output)
# ---------------------------------------------------------------------
@router.get("/coverage")
def get_coverage() -> dict:
    rules = store.get_rules()
    return compute_coverage(rules)


# ---------------------------------------------------------------------
# Early warnings (stage 6)
# ---------------------------------------------------------------------
@router.get("/warnings")
def get_warnings() -> list[dict]:
    rules = _load_rules()
    broker = store.get_broker_profile()
    results = run_all_rules(rules, broker)
    warnings = scan_for_warnings(results, _as_of_date())
    return [w.model_dump() for w in warnings]


# ---------------------------------------------------------------------
# Remediation (stage 7)
# ---------------------------------------------------------------------
@router.get("/remediation")
def get_remediation() -> list[dict]:
    rules = _load_rules()
    broker = store.get_broker_profile()
    results = run_all_rules(rules, broker)
    tasks = build_remediation_tasks(results, _as_of_date())
    return [t.model_dump() for t in tasks]


# ---------------------------------------------------------------------
# Amendment simulator (stage 8) — the demo centerpiece
# ---------------------------------------------------------------------
class AmendmentRequest(BaseModel):
    rule_id: str
    param_overrides: dict[str, Any]


@router.post("/amendment/simulate")
def simulate_amendment_endpoint(body: AmendmentRequest) -> dict:
    rule_data = store.get_rule(body.rule_id)
    if rule_data is None:
        raise HTTPException(404, f"Rule '{body.rule_id}' not found")
    rule = Rule(**rule_data)
    all_rules = _load_rules()
    broker = store.get_broker_profile()
    return simulate_amendment(rule, all_rules, broker, body.param_overrides)


# ---------------------------------------------------------------------
# Broker data (for UI display / debugging)
# ---------------------------------------------------------------------
@router.get("/broker")
def get_broker() -> dict:
    return store.get_broker_profile()


# ---------------------------------------------------------------------
# Demo reset — restores rules.live.json to the seed state. Exists so one
# judge/user's Approve clicks or amendment edits don't persist for the
# next person driving the same running demo.
# ---------------------------------------------------------------------
@router.post("/reset")
def reset_demo() -> dict:
    store.reset_rules_to_seed()
    return {"status": "reset"}
