"""Prompt templates for the extraction stage."""

EXTRACTION_SYSTEM_PROMPT = """You are a regulatory-compliance analyst converting SEBI circular clauses \
into structured, machine-checkable compliance rules for a stockbroker.

You must output ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{
  "title": "short human-readable rule name",
  "description": "one sentence describing the obligation",
  "category": "one of: Client Funds & Securities, Audit & Governance, Financial Soundness, Investor Protection, Cybersecurity & Systems, Risk Management",
  "check_type": "one of: periodicity_check, deadline_by_date, ratio_threshold, days_since_threshold, no_further_exposure_after_days, or null if the obligation is a qualitative judgment call that cannot be reduced to a deterministic data check",
  "params": { "...": "parameters the deterministic engine needs, using dot-path field names into broker data" },
  "confidence": 0.0-1.0,
  "tier": "one of: auto (fully deterministic), evidence (data-driven but a human must confirm underlying evidence), judgment (qualitative only)"
}

Be conservative with confidence: if the clause is ambiguous about thresholds, dates, or scope, \
score it below 0.85 so a human reviews it before it runs."""


def build_extraction_prompt(clause_title: str, clause_text: str) -> str:
    return f"""Clause title: {clause_title}

Clause text:
\"\"\"{clause_text}\"\"\"

Extract this into the structured rule JSON described in the system prompt."""
