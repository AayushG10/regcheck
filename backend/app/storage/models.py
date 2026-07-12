"""
Pydantic data models shared across the pipeline, rule engine, and API layer.

Kept deliberately flat and JSON-friendly since the current storage backend
is plain JSON files (see storage/store.py). Swapping to a real database
(or adding Neo4j for obligation-supersession graphs) should only require
changes in storage/store.py — these models are the stable contract.
"""
from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class Tier(str, Enum):
    AUTO = "auto"              # fully deterministic, machine-checkable against broker data
    EVIDENCE = "evidence"      # data-driven but a human must confirm the evidence (e.g. a certificate is genuine)
    JUDGMENT = "judgment"      # qualitative, cannot be reduced to a pass/fail data check


class RuleStatus(str, Enum):
    APPROVED = "approved"          # human has approved the extracted rule for execution
    NEEDS_REVIEW = "needs_review"  # confidence < 0.85, or explicitly flagged


class Verdict(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class ClauseCitation(BaseModel):
    """Points a verdict back to the exact source paragraph — the 'proof'."""
    circular: str
    para: str


class Rule(BaseModel):
    """A structured, machine-checkable obligation extracted from a SEBI clause."""
    id: str
    clause_id: str
    title: str
    description: str
    citation: ClauseCitation
    category: str
    check_type: Optional[str] = None  # None => judgment tier, no deterministic handler
    params: dict[str, Any] = Field(default_factory=dict)
    confidence: float
    tier: Tier
    status: RuleStatus
    amendable: bool = False


class CheckResult(BaseModel):
    """Deterministic engine output for a single rule run against broker data."""
    rule_id: str
    rule_title: str
    clause_id: str
    citation: ClauseCitation
    category: str
    tier: Tier
    verdict: Verdict
    evidence: dict[str, Any] = Field(default_factory=dict)
    explanation: str


class RemediationTask(BaseModel):
    """A FAIL turned into an actionable work item."""
    id: str
    rule_id: str
    rule_title: str
    clause_id: str
    citation: ClauseCitation
    owner: str
    fix: str
    due_date: date
    priority: str  # "high" | "medium" | "low"


class EarlyWarning(BaseModel):
    """An obligation approaching its deadline/periodicity breach."""
    rule_id: str
    rule_title: str
    clause_id: str
    citation: ClauseCitation
    deadline_date: date
    days_remaining: int
    message: str


class ClauseText(BaseModel):
    clause_id: str
    para: str
    title: str
    text: str


class ExtractionResult(BaseModel):
    """Output of the LLM extraction stage before human approval."""
    clause_id: str
    title: str
    description: str
    category: str
    check_type: Optional[str]
    params: dict[str, Any]
    confidence: float
    tier: Tier
    status: RuleStatus
    raw_llm_output: str
    provider_used: str
