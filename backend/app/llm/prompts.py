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


AMENDMENT_PROPOSAL_SYSTEM_PROMPT = """You are a regulatory-compliance analyst. A stockbroker's RegCheck \
system already has a structured, machine-checkable rule for a SEBI obligation. A new SEBI circular \
notice has just been issued that amends this specific obligation. Your job is to propose the updated \
rule parameters — you do NOT decide compliance, you only draft the change for a human to approve.

You must output ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{
  "params": { "...": "the FULL updated params object — copy every existing key, changing only the ones the notice actually amends" },
  "confidence": 0.0-1.0,
  "rationale": "one sentence explaining what changed and why, citing the notice"
}

Only change parameter VALUES that the notice text explicitly specifies (e.g. a new number of days, a new \
threshold percentage). Never change param key names or the rule's check_type. If the notice is ambiguous \
about the exact new value, keep your confidence below 0.85 so a human reviews it before it's applied."""


def build_amendment_proposal_prompt(rule_title: str, current_params: dict, notice_text: str) -> str:
    import json

    return f"""Existing rule: {rule_title}

Current params (JSON):
{json.dumps(current_params, indent=2)}

New SEBI circular notice:
\"\"\"{notice_text}\"\"\"

Propose the updated params JSON described in the system prompt."""
