"""
Extraction accuracy eval — a real, measured alternative to hand-waving a
confidence number.

Ground truth is the human-approved `check_type` and `tier` for each of the
10 real clauses in the corpus, taken from data/rules.seed.json (those
values are exactly what a compliance reviewer signed off on during this
project's build — see README/ARCHITECTURE for that process). This script
re-runs the actual extraction pipeline (a real Groq call per clause, same
code path as POST /api/extract) and scores its output against that ground
truth: per-class precision/recall/F1 on check_type classification, plus
raw accuracy on tier assignment.

Run from backend/, with GROQ_API_KEY set in .env:
    python scripts/eval_extraction.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.pipeline.graph import run_extraction_pipeline  # noqa: E402
from app.storage.store import store  # noqa: E402

RESULTS_PATH = Path(__file__).resolve().parent.parent / "data" / "eval_results.json"

# Groq's free tier rate-limits aggressively; a fixed 0.5s gap wasn't enough once
# other extraction traffic (the dashboard's "Re-extract via LLM" button, the
# agentic amendment demo) had already used part of the per-minute quota. Space
# requests out further and retry once with backoff on a 429 rather than just
# dropping the clause from the eval.
REQUEST_DELAY_SECONDS = 3.0
RETRY_DELAY_SECONDS = 20.0


def load_ground_truth() -> dict[str, dict]:
    """One ground-truth row per clause, keyed by clause_id — sourced from
    the seed rules, which are the human-approved extraction for each."""
    seed_rules = json.loads((Path(__file__).resolve().parent.parent / "data" / "rules.seed.json").read_text())
    return {r["clause_id"]: {"check_type": r["check_type"], "tier": r["tier"], "rule_title": r["title"]} for r in seed_rules}


def precision_recall_f1(rows: list[dict]) -> dict[str, dict[str, float]]:
    """Macro per-class precision/recall/F1 over check_type, including the
    None class (judgment-tier clauses with no deterministic handler)."""
    labels = sorted({r["truth_check_type"] for r in rows} | {r["pred_check_type"] for r in rows}, key=lambda x: x or "")
    per_class = {}
    for label in labels:
        tp = sum(1 for r in rows if r["pred_check_type"] == label and r["truth_check_type"] == label)
        fp = sum(1 for r in rows if r["pred_check_type"] == label and r["truth_check_type"] != label)
        fn = sum(1 for r in rows if r["pred_check_type"] != label and r["truth_check_type"] == label)
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        per_class[str(label)] = {"precision": precision, "recall": recall, "f1": f1, "support": tp + fn}
    return per_class


def main() -> None:
    ground_truth = load_ground_truth()
    corpus = store.get_circular_corpus()
    rows = []

    print(f"Running extraction against {len(ground_truth)} clauses via Groq (fast tier)...\n")

    for i, clause in enumerate(corpus["clauses"]):
        clause_id = clause["clause_id"]
        truth = ground_truth.get(clause_id)
        if truth is None:
            continue

        if i > 0:
            time.sleep(REQUEST_DELAY_SECONDS)

        result = run_extraction_pipeline(clause_id, llm_tier="fast")
        if result.get("error") and "429" in str(result["error"]):
            print(f"  … {clause_id}: rate limited, backing off {RETRY_DELAY_SECONDS:.0f}s and retrying once")
            time.sleep(RETRY_DELAY_SECONDS)
            result = run_extraction_pipeline(clause_id, llm_tier="fast")
        if result.get("error"):
            print(f"  ✗ {clause_id}: extraction failed — {result['error']}")
            continue

        extraction = result["extraction_json"]
        pred_check_type = extraction.get("check_type")
        pred_tier = result["final_tier"]

        row = {
            "clause_id": clause_id,
            "rule_title": truth["rule_title"],
            "truth_check_type": truth["check_type"],
            "pred_check_type": pred_check_type,
            "check_type_match": pred_check_type == truth["check_type"],
            "truth_tier": truth["tier"],
            "pred_tier": pred_tier,
            "tier_match": pred_tier == truth["tier"],
            "confidence": extraction.get("confidence"),
        }
        rows.append(row)

        mark = "✓" if row["check_type_match"] else "✗"
        print(f"  {mark} {clause_id:35s} truth={str(truth['check_type']):28s} pred={pred_check_type}")

    if not rows:
        print("\nNo rows scored — check GROQ_API_KEY is set in backend/.env.")
        return

    if len(rows) < len(ground_truth):
        print(
            f"\n⚠ Only {len(rows)}/{len(ground_truth)} clauses scored (the rest were rate-limited "
            "twice in a row). Results below are real but partial — re-run in a minute for the full set."
        )

    check_type_accuracy = sum(r["check_type_match"] for r in rows) / len(rows)
    tier_accuracy = sum(r["tier_match"] for r in rows) / len(rows)
    per_class = precision_recall_f1(rows)

    macro_precision = sum(c["precision"] for c in per_class.values()) / len(per_class)
    macro_recall = sum(c["recall"] for c in per_class.values()) / len(per_class)
    macro_f1 = sum(c["f1"] for c in per_class.values()) / len(per_class)

    print("\n" + "=" * 60)
    print(f"check_type accuracy : {check_type_accuracy:.1%}  ({sum(r['check_type_match'] for r in rows)}/{len(rows)})")
    print(f"tier accuracy        : {tier_accuracy:.1%}  ({sum(r['tier_match'] for r in rows)}/{len(rows)})")
    print(f"macro precision      : {macro_precision:.1%}")
    print(f"macro recall         : {macro_recall:.1%}")
    print(f"macro F1             : {macro_f1:.1%}")
    print("=" * 60)
    print("\nPer-class (check_type):")
    for label, m in per_class.items():
        print(f"  {label:28s} P={m['precision']:.0%}  R={m['recall']:.0%}  F1={m['f1']:.0%}  (n={m['support']})")

    RESULTS_PATH.write_text(
        json.dumps(
            {
                "check_type_accuracy": check_type_accuracy,
                "tier_accuracy": tier_accuracy,
                "macro_precision": macro_precision,
                "macro_recall": macro_recall,
                "macro_f1": macro_f1,
                "per_class": per_class,
                "rows": rows,
            },
            indent=2,
        )
    )
    print(f"\nFull results written to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
