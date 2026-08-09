"""All REST endpoints for RegCheck. Kept in one router for a hackathon-sized
codebase; split by prefix if this grows further."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.pipeline.amendment_graph import run_amendment_pipeline
from app.pipeline.graph import run_extraction_pipeline
from app.pipeline.triage import compute_coverage
from app.remediation import build_remediation_tasks
from app.rules.amendment import simulate_amendment
from app.rules.engine import run_all_rules
from app.storage.models import CheckRun
from app.storage.models import Rule
from app.storage.models import RuleStatus
from app.storage.store import store
from app.warnings import scan_for_warnings

router = APIRouter(prefix="/api")

# Bumped whenever rules/handlers.py's check logic changes in a way that could
# alter historical verdicts — recorded on every persisted CheckRun so an old
# run can be told apart from one produced by different engine logic.
ENGINE_VERSION = "1.0.0"


def _load_rules() -> list[Rule]:
    return [Rule(**r) for r in store.get_rules()]


def _as_of_date():
    return datetime.strptime(store.get_broker_profile()["as_of_date"], "%Y-%m-%d").date()


def _run_scorecard() -> dict:
    """Shared compute for /api/report and /api/checks/run — pure, no persistence."""
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


@router.get("/rules/{rule_id}/history")
def get_rule_history(rule_id: str) -> list[dict]:
    """Prior, closed-out versions of this rule — the current version is in
    GET /api/rules/{rule_id}; this is everything it superseded."""
    return store.get_rule_history(rule_id)


class ApproveRequest(BaseModel):
    status: str = "approved"
    approved_by: str = "Priya Sharma, Compliance Officer"


@router.post("/rules/{rule_id}/approve")
def approve_rule(rule_id: str, body: ApproveRequest) -> dict:
    rule = store.get_rule(rule_id)
    if rule is None:
        raise HTTPException(404, f"Rule '{rule_id}' not found")

    # Maker-checker: whoever (or whatever) drafted the rule cannot also be
    # the one who approves it — standard practice in financial compliance,
    # and the whole point of the human-approval gate at the Extract stage.
    if body.status == "approved" and body.approved_by == rule.get("drafted_by"):
        raise HTTPException(422, "The drafter of a rule cannot also approve it (maker-checker).")

    rule["status"] = body.status
    if body.status == "approved":
        rule["approved_by"] = body.approved_by
        rule["approved_at"] = datetime.now().isoformat()
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
    """Runs the LLM extraction pipeline for a clause and persists the result
    as a fresh pending draft on the matching rule (status forced to
    needs_review, regardless of confidence) — this covers both first-time
    extraction and "Re-extract via LLM" from Rules Explorer. Either way the
    new draft goes through the same human-approval gate as any other rule;
    it never silently overwrites an already-approved rule's live params."""
    result = run_extraction_pipeline(body.clause_id, body.llm_tier)

    if result.get("error"):
        raise HTTPException(422, result["error"])

    extraction = result["extraction_json"]

    existing = next((r for r in store.get_rules() if r["clause_id"] == body.clause_id), None)
    persisted_rule_id: str | None = None
    if existing is not None:
        updated = dict(existing)
        updated["title"] = extraction.get("title", existing["title"])
        updated["description"] = extraction.get("description", existing["description"])
        updated["category"] = extraction.get("category", existing["category"])
        updated["check_type"] = extraction.get("check_type", existing.get("check_type"))
        updated["params"] = extraction.get("params", existing.get("params", {}))
        updated["confidence"] = extraction.get("confidence", existing.get("confidence"))
        updated["tier"] = extraction.get("tier", existing.get("tier"))
        # An explicit, human-triggered re-draft always needs a fresh human
        # sign-off — even a high-confidence extraction doesn't get to skip
        # the approval gate here, unlike the first-time triage_node path.
        updated["status"] = RuleStatus.NEEDS_REVIEW.value
        updated["drafted_by"] = "LLM extraction pipeline"
        updated["approved_by"] = None
        updated["approved_at"] = None
        store.upsert_rule(updated)
        persisted_rule_id = updated["id"]

    return {
        "clause_id": body.clause_id,
        "extraction": extraction,
        "final_tier": result["final_tier"],
        "final_status": RuleStatus.NEEDS_REVIEW.value,
        "provider_used": result["provider_used"],
        "raw_llm_output": result["extraction_raw"],
        "persisted_rule_id": persisted_rule_id,
    }


# ---------------------------------------------------------------------
# Rule engine / report (stage 4-5)
# ---------------------------------------------------------------------
@router.get("/report")
def get_report() -> dict:
    """Live recompute of the current scorecard — this is what the dashboard
    (Scorecard, Warnings, Remediation) polls on every view, including a user
    who never touches Run History or clicks "Run now".

    Also persists a CheckRun into the audit trail, so simply viewing the
    dashboard leaves a record. De-duplicated by as_of_date: since the
    scorecard is recomputed live off the same broker snapshot on every poll,
    we only persist once per as_of_date (i.e. once per distinct underlying
    state) rather than spamming a new run on every page load/refresh — use
    POST /api/checks/run to force an explicit, always-persisted run."""
    scorecard = _run_scorecard()
    _persist_run_if_new_as_of_date(scorecard)
    return scorecard


def _result_signature(results: list[dict]) -> tuple:
    """Order-independent fingerprint of a scorecard's verdicts, used to tell
    whether two runs actually represent the same compliance state."""
    return tuple(sorted((r["rule_id"], r["rule_version"], r["verdict"]) for r in results))


def _persist_run_if_new_as_of_date(scorecard: dict) -> None:
    existing_runs = store.get_check_runs()  # newest first
    most_recent = existing_runs[0] if existing_runs else None
    if (
        most_recent is not None
        and most_recent["as_of_date"] == scorecard["as_of_date"]
        and _result_signature(most_recent["results"]) == _result_signature(scorecard["results"])
    ):
        # Same underlying state as the last persisted run for this date —
        # don't spam a new run on every dashboard poll/refresh. But if the
        # live results actually changed (e.g. a rule was approved or
        # amended since the last run), that's a real change in compliance
        # state and must get its own audit-trail entry even though
        # as_of_date didn't move.
        return

    run = CheckRun(
        run_id=str(uuid.uuid4()),
        run_at=datetime.now(),
        as_of_date=scorecard["as_of_date"],
        engine_version=ENGINE_VERSION,
        broker_name=scorecard["broker_name"],
        total_checked=scorecard["total_checked"],
        passed=scorecard["passed"],
        failed=scorecard["failed"],
        results=scorecard["results"],
    )
    store.save_check_run(run.model_dump(mode="json"))


@router.post("/checks/run")
def run_checks() -> dict:
    """Runs the scorecard AND persists it as an immutable CheckRun — this is
    the audit trail: every past run stays retrievable with the exact rule
    versions and evidence that produced it, even after rules are later
    amended."""
    scorecard = _run_scorecard()
    run = CheckRun(
        run_id=str(uuid.uuid4()),
        run_at=datetime.now(),
        as_of_date=scorecard["as_of_date"],
        engine_version=ENGINE_VERSION,
        broker_name=scorecard["broker_name"],
        total_checked=scorecard["total_checked"],
        passed=scorecard["passed"],
        failed=scorecard["failed"],
        results=scorecard["results"],
    )
    store.save_check_run(run.model_dump(mode="json"))
    return run.model_dump(mode="json")


# ---------------------------------------------------------------------
# Run history (the audit trail itself)
# ---------------------------------------------------------------------
@router.get("/runs")
def list_check_runs() -> list[dict]:
    """Summaries only (no per-rule results) — keeps the list view light.
    Fetch a run's full detail via GET /api/runs/{run_id}."""
    runs = store.get_check_runs()
    return [{k: v for k, v in run.items() if k != "results"} for run in runs]


@router.get("/runs/{run_id}")
def get_check_run(run_id: str) -> dict:
    run = store.get_check_run(run_id)
    if run is None:
        raise HTTPException(404, f"Run '{run_id}' not found")
    return run


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
    rules_by_id = {r.id: r for r in rules}
    warnings = scan_for_warnings(results, _as_of_date(), rules_by_id)
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


class AmendmentCommitRequest(BaseModel):
    rule_id: str
    param_overrides: dict[str, Any]
    approved_by: str = "Priya Sharma, Compliance Officer"
    # Which UI flow produced this commit — recorded as the new version's
    # drafted_by so the audit trail doesn't claim every amendment came from
    # the agentic Circular Monitor when a human drafted it by hand in the
    # Amendment Simulator.
    source: str = "Manual amendment simulator"


@router.post("/amendment/commit")
def commit_amendment(body: AmendmentCommitRequest) -> dict:
    """Actually applies a simulated amendment: creates a new rule version
    (closing out the old one in the history archive) and persists a fresh
    CheckRun against it, so the scorecard's flip is recorded, not just
    previewed."""
    rule_data = store.get_rule(body.rule_id)
    if rule_data is None:
        raise HTTPException(404, f"Rule '{body.rule_id}' not found")

    if body.approved_by == rule_data.get("drafted_by"):
        raise HTTPException(422, "The drafter of a rule cannot also approve its amendment (maker-checker).")

    # Same approval gate run_all_rules/run_rule enforce for execution: a
    # rule that hasn't been approved yet can't be amended either, because
    # create_rule_version below unconditionally flips the new version's
    # status to "approved" as a side effect — without this check, an
    # unapproved draft could be smuggled into "approved" via the amendment
    # flow instead of the real approval flow.
    if rule_data.get("status") != RuleStatus.APPROVED.value:
        raise HTTPException(
            422,
            f"Rule '{body.rule_id}' is not approved yet (status: {rule_data.get('status')}) "
            "— approve it via /api/rules/{rule_id}/approve before amending it.",
        )

    new_version = store.create_rule_version(
        body.rule_id, body.param_overrides, body.approved_by, drafted_by=body.source
    )

    scorecard = _run_scorecard()
    run = CheckRun(
        run_id=str(uuid.uuid4()),
        run_at=datetime.now(),
        as_of_date=scorecard["as_of_date"],
        engine_version=ENGINE_VERSION,
        broker_name=scorecard["broker_name"],
        total_checked=scorecard["total_checked"],
        passed=scorecard["passed"],
        failed=scorecard["failed"],
        results=scorecard["results"],
    )
    store.save_check_run(run.model_dump(mode="json"))

    return {"rule": new_version, "run": run.model_dump(mode="json")}


# ---------------------------------------------------------------------
# Agentic amendment loop — monitor -> diff -> propose -> human gate -> re-run
#
# This is what makes the extraction pipeline's "agent" claim real end to
# end: instead of a human noticing a new SEBI circular and manually
# figuring out which rule it touches, this pipeline does that detection
# and drafts the fix itself. The commit step is the same
# POST /api/amendment/commit used by the manual simulator above — a human
# still approves before anything actually changes.
# ---------------------------------------------------------------------
class AgenticDetectRequest(BaseModel):
    notice_text: str
    llm_tier: str = "fast"  # "fast" -> Groq, "strong" -> OpenRouter


@router.post("/agentic/detect")
def agentic_detect(body: AgenticDetectRequest) -> dict:
    result = run_amendment_pipeline(body.notice_text, body.llm_tier)

    if result.get("error"):
        raise HTTPException(422, result["error"])

    matched_rule = store.get_rule(result["matched_rule_id"])
    return {
        "matched_rule": matched_rule,
        "proposal": result["proposal_json"],
        "provider_used": result["provider_used"],
    }


# ---------------------------------------------------------------------
# Broker data (for UI display / debugging)
# ---------------------------------------------------------------------
@router.get("/broker")
def get_broker() -> dict:
    return store.get_broker_profile()


# ---------------------------------------------------------------------
# Demo reset — restores rules.live.json to the seed state and clears
# rule history / check runs. Exists so one judge/user's Approve clicks or
# amendment edits don't persist for the next person driving the same
# running demo.
# ---------------------------------------------------------------------
@router.post("/reset")
def reset_demo() -> dict:
    store.reset_rules_to_seed()
    return {"status": "reset"}
