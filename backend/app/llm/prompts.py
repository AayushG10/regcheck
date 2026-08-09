"""Prompt templates for the extraction stage.

The check_type definitions and worked example below were tightened after a
real accuracy eval (see backend/scripts/eval_extraction.py,
data/eval_results.json) showed the model consistently confusing
`deadline_by_date` with `days_since_threshold` — both describe "do X within
some time window," but the window anchors differently, and the original
prompt gave the model no way to tell them apart. Re-running the eval after
this change is how to confirm it actually helped, rather than assuming it did.
"""

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

Definitions — read these carefully, two of them are easy to conflate:

- periodicity_check: a recurring event must happen at least once every N days, on a
  ROLLING basis with no fixed calendar anchor (e.g. "VAPT at least once every six
  months"). params: {"last_event_date_field", "periodicity_days"}.
- deadline_by_date: a filing is due by a FIXED CALENDAR DATE tied to a reporting
  period end (e.g. "by November 30 for the half-year ending September 30"). The due
  date is a specific day-of-year, not a day-count. params: {"filed_date_field",
  "period_end_field", "deadlines": [{"period_end_month_day": [m,d], "due_month_day": [m,d]}]}.
- days_since_threshold: an action must happen within N days AFTER a specific triggering
  EVENT (not a fixed calendar date) — the window floats with whenever that event
  occurred (e.g. "within 7 days from the end of every month", "within 60 days from
  financial year end"). The giveaway is the phrase "within N days of/from X" where X
  is itself a recurring or variable event, not one fixed date on the calendar.
  params: {"date_field", "reference_field", "max_days"}.
- ratio_threshold: a numeric ratio between two broker-data figures must satisfy a
  threshold (e.g. "net worth at least 75% of the requirement").
  params: {"numerator_field", "denominator_field", "operator", "threshold"}.
- no_further_exposure_after_days: a specific prohibition kicks in once N days have
  elapsed since a triggering event, rather than a filing deadline.
  params: {"debit_arose_date_field", "cleared_field", "further_exposure_given_field", "trading_days_threshold"}.

Worked example of the deadline_by_date vs days_since_threshold distinction:
- "Internal audit report... shall be submitted by November 30" -> deadline_by_date
  (fixed calendar date, same day-of-year every cycle).
- "...shall upload data... within 7 days from the end of every month" -> days_since_threshold
  (the window's start — month-end — moves every cycle; there is no single fixed date).

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
