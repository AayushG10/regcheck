"""
JSON-file-backed storage for RegCheck.

This module is the *only* place that knows the data lives in flat JSON
files. Every other module (rule engine, pipeline, API routes) talks to
`Store`, not to files directly. That means swapping this for SQLite, or
adding Neo4j for obligation-supersession graphs (rule v2 "supersedes"
rule v1), is a change confined to this file.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

CIRCULAR_CORPUS_PATH = DATA_DIR / "circular_corpus.json"
RULES_SEED_PATH = DATA_DIR / "rules.seed.json"
RULES_LIVE_PATH = DATA_DIR / "rules.live.json"  # working copy, mutated by extraction/amendment
BROKER_PROFILE_PATH = DATA_DIR / "broker_profile.json"

_lock = threading.Lock()


def _read_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)


class Store:
    """Thin repository over the JSON data files."""

    def __init__(self) -> None:
        # Seed the "live" rules file from the seed file on first boot so
        # extraction/amendment operations never mutate the original seed.
        if not RULES_LIVE_PATH.exists():
            with _lock:
                if not RULES_LIVE_PATH.exists():
                    _write_json(RULES_LIVE_PATH, _read_json(RULES_SEED_PATH))

    # -- circular corpus (read-only ingest source) --------------------
    def get_circular_corpus(self) -> dict[str, Any]:
        return _read_json(CIRCULAR_CORPUS_PATH)

    def get_clause(self, clause_id: str) -> dict[str, Any] | None:
        corpus = self.get_circular_corpus()
        for clause in corpus["clauses"]:
            if clause["clause_id"] == clause_id:
                return clause
        return None

    # -- rules (mutable: extraction appends, amendment overrides) -----
    def get_rules(self) -> list[dict[str, Any]]:
        with _lock:
            return _read_json(RULES_LIVE_PATH)

    def get_rule(self, rule_id: str) -> dict[str, Any] | None:
        for rule in self.get_rules():
            if rule["id"] == rule_id:
                return rule
        return None

    def upsert_rule(self, rule: dict[str, Any]) -> None:
        with _lock:
            rules = _read_json(RULES_LIVE_PATH)
            for i, r in enumerate(rules):
                if r["id"] == rule["id"]:
                    rules[i] = rule
                    break
            else:
                rules.append(rule)
            _write_json(RULES_LIVE_PATH, rules)

    def reset_rules_to_seed(self) -> None:
        with _lock:
            _write_json(RULES_LIVE_PATH, _read_json(RULES_SEED_PATH))

    # -- broker data (read-only for the demo) --------------------------
    def get_broker_profile(self) -> dict[str, Any]:
        return _read_json(BROKER_PROFILE_PATH)


store = Store()
