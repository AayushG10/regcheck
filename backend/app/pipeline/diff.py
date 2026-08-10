"""Stage: Diff/impact — identifies which existing obligation(s) a new
circular notice affects.

Two tiers, deliberately kept apart rather than blended into one score:

1. "citation" match — a paragraph reference explicitly printed in the
   notice text is matched against the paragraph citations already on our
   rules. Plain string search, not an LLM call — matching an explicit
   citation is not a judgment call. A single paragraph can carry several
   distinct obligations (para 15.8.1.1 covers a net-worth ratio, a
   complaint-value ratio, and a certificate deadline as three separate
   rules), so a shared citation only narrows the field to *candidates*;
   which one the notice is actually about is decided by a keyword-overlap
   score between the notice text and each candidate's own text — still
   deterministic, just not "first match in list order wins".

2. "fuzzy" match — used ONLY when no rule's paragraph is cited at all
   (most real SEBI circulars, since they cover dozens of topics RegCheck
   has no rule for). Falls back to the same keyword-overlap scoring across
   every rule, gated by a real minimum-overlap threshold and a domain
   stopword list (see _DOMAIN_NOISE) so generic words that appear in
   nearly every SEBI circular ("broker", "securities", "circular" itself)
   can't manufacture a false match on their own. This is explicitly a
   guess RegCheck doesn't make anywhere else in the codebase — the
   API/UI must always label a "fuzzy" result as lower-confidence and
   distinct from a real citation match, never presented identically.

The LLM never enters this stage either way — it only gets involved in the
next one, proposing *what* the amended parameters should be, on whichever
rule this stage matched.
"""
from __future__ import annotations

import re

from app.pipeline.state import AmendmentPipelineState
from app.storage.store import store

# Generic English words that would otherwise dominate the overlap score
# without saying anything about which obligation is meant.
_STOPWORDS = {
    "a", "an", "and", "any", "are", "as", "at", "be", "been", "by", "for",
    "from", "has", "have", "in", "into", "is", "it", "its", "may", "must",
    "no", "not", "of", "on", "or", "shall", "should", "that", "the", "this",
    "to", "was", "were", "will", "with", "within", "than", "such",
}

# Domain-generic words: not grammatical stopwords, but so common across
# *every* SEBI circular in this corpus (any circular addressed to brokers
# will say "broker", "securities", "circular", etc.) that letting them count
# toward a fuzzy-match score would make almost any circular "match"
# something. Excluded only from the fuzzy fallback's score, not from
# citation-tier disambiguation, where the field is already narrowed to
# candidates sharing a real paragraph citation and these words are less
# likely to be the sole signal.
_DOMAIN_NOISE = {
    "sebi", "circular", "circulars", "stock", "broker", "brokers",
    "securities", "regulation", "regulations", "master", "framework",
    "requirement", "requirements", "provision", "provisions", "compliance",
    "applicable", "market", "intermediary", "intermediaries", "notified",
    "notification", "issued", "dated", "date", "effective", "para", "clause",
}

# Minimum number of distinct, non-noise overlapping keywords required before
# a fuzzy match is trusted at all. Raised twice after live polling against
# SEBI's actual feed turned up real false positives that an initial guess
# didn't anticipate:
#   - score 3: a circular extending an unrelated PaRRVA enrolment deadline
#     matched "Internal Audit Filed by Nov 30 / May 31" on nothing but
#     "received", "exchange", "september".
#   - score 8: a circular about the GARUDA AIF placement-memorandum filing
#     mechanism matched "Net Worth Certificate Within 60 Days" on nothing but
#     shared SEBI-filing boilerplate -- "certificate", "certified", "days",
#     "submitted", "confirmed" -- words that are genuine signal for that rule
#     but are also just how every SEBI circular describes any deadline, not
#     evidence of a real topical match.
# A genuine topical match clears this bar with a wide margin -- a crafted
# VAPT notice scores 15 against the VAPT rule (next-best real rule: 2), and a
# real "technical glitches in electronic trading systems" circular scored 9
# against the system-audit-periodicity rule -- while every false positive
# found by live polling topped out at 8. Set above that observed ceiling.
_FUZZY_MIN_SCORE = 9

# Minimum score gap the winner must hold over the runner-up (see is_ambiguous
# below) — chosen from a live-polling false positive that cleared the score
# threshold (13) but was really just generic filing boilerplate clustering
# close to four other rules (11, 11, 10, 10, a gap of only 2).
_FUZZY_MARGIN = 4


def _keywords(text: str, *, exclude_noise: bool = False) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    excluded = _STOPWORDS | _DOMAIN_NOISE if exclude_noise else _STOPWORDS
    return {w for w in words if w not in excluded and len(w) > 2}


def _rule_text_pool(rule: dict) -> str:
    """The richest text available for a rule: its own title/description
    plus, if we can find it, the original clause text it was extracted
    from — which uses SEBI's own wording (e.g. "vulnerabilities",
    "infrastructure") more often than the short extracted description
    does, and is a meaningfully better signal for fuzzy matching."""
    parts = [rule.get("title", ""), rule.get("description", "")]
    clause = store.get_clause(rule.get("clause_id", ""))
    if clause:
        parts.append(clause.get("text", ""))
    return " ".join(parts)


def _score(rule: dict, notice_keywords: set[str], *, exclude_noise: bool = False) -> int:
    rule_keywords = _keywords(_rule_text_pool(rule), exclude_noise=exclude_noise)
    return len(rule_keywords & notice_keywords)


def _para_cited_in(para: str, notice_text: str) -> bool:
    """Whether `para` (e.g. "15.10" or "18.5.5.8-9") is actually cited in the
    notice text as its own paragraph reference, not merely a substring of a
    longer one — plain `para in notice_text` would let a notice citing
    "15.10.1" false-positive match a rule cited "15.10". A citation is
    bounded on both sides by anything that isn't a digit/dot/hyphen
    (whitespace, punctuation, string edges)."""
    if not para:
        return False
    pattern = r"(?<![\w.-])" + re.escape(para) + r"(?![\w.-])"
    return re.search(pattern, notice_text) is not None


def diff_node(state: AmendmentPipelineState) -> AmendmentPipelineState:
    if state.get("error"):
        return state

    notice_text = state["notice_text"]
    rules = store.get_rules()
    checkable_rules = [r for r in rules if r.get("tier") != "judgment"]

    candidates = [rule for rule in checkable_rules if _para_cited_in(rule["citation"]["para"], notice_text)]

    if candidates:
        if len(candidates) == 1:
            matched = candidates[0]
        else:
            # Multiple rules share this paragraph citation — disambiguate by
            # which candidate's own text the notice is actually about, not
            # by list order.
            notice_keywords = _keywords(notice_text)
            scored = [(_score(rule, notice_keywords), rule) for rule in candidates]
            scored.sort(key=lambda pair: pair[0], reverse=True)
            best_score, matched = scored[0]

            # If nothing meaningfully distinguishes the candidates (e.g.
            # every candidate scores 0, or there's an exact tie for the top
            # score), fall back to the original stable order rather than
            # silently picking arbitrarily.
            if best_score == 0 or (len(scored) > 1 and scored[1][0] == best_score):
                matched = candidates[0]

        return {
            **state,
            "matched_rule_id": matched["id"],
            "matched_clause_id": matched["clause_id"],
            "match_type": "citation",
        }

    # No rule's paragraph is cited anywhere in the notice — fall back to a
    # deliberately conservative keyword-similarity guess across every rule,
    # gated by _FUZZY_MIN_SCORE so a handful of incidental word overlaps
    # can't manufacture a match on an unrelated circular.
    notice_keywords = _keywords(notice_text, exclude_noise=True)
    fuzzy_scored = sorted(
        ((_score(rule, notice_keywords, exclude_noise=True), rule) for rule in checkable_rules),
        key=lambda pair: pair[0],
        reverse=True,
    )
    best_score, best_rule = fuzzy_scored[0] if fuzzy_scored else (0, None)
    runner_up_score = fuzzy_scored[1][0] if len(fuzzy_scored) > 1 else -1

    # An exact tie is the obvious ambiguous case, but live polling turned up
    # a subtler one: a circular written in generic SEBI filing/deadline
    # boilerplate ("account", "balance", "days", "period") scores close to
    # several unrelated rules at once (e.g. 13/11/11/10/10) rather than
    # standing out from one. That clustering — not a single tied top score —
    # is itself the signal that no rule is genuinely what the notice is
    # about, so require the winner to clear the runner-up by a real margin,
    # not just avoid an exact tie.
    is_ambiguous = runner_up_score >= best_score - _FUZZY_MARGIN
    if best_rule is not None and best_score >= _FUZZY_MIN_SCORE and not is_ambiguous:
        return {
            **state,
            "matched_rule_id": best_rule["id"],
            "matched_clause_id": best_rule["clause_id"],
            "match_type": "fuzzy",
            "match_score": best_score,
        }

    return {
        **state,
        "error": (
            "Could not match this notice to any existing obligation — no paragraph reference in the "
            "text corresponds to a rule RegCheck has extracted, and keyword similarity to every rule "
            f"was too weak to trust (best overlap: {best_score} keyword(s), need {_FUZZY_MIN_SCORE}+)."
        ),
    }
