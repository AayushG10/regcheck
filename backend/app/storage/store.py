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
from datetime import date, datetime
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

CIRCULAR_CORPUS_PATH = DATA_DIR / "circular_corpus.json"
RULES_SEED_PATH = DATA_DIR / "rules.seed.json"
RULES_LIVE_PATH = DATA_DIR / "rules.live.json"  # working copy, mutated by extraction/amendment
RULES_HISTORY_PATH = DATA_DIR / "rules.history.json"  # append-only: closed-out prior rule versions
CHECK_RUNS_PATH = DATA_DIR / "check_runs.json"  # append-only: persisted scorecard snapshots
BROKER_PROFILE_PATH = DATA_DIR / "broker_profile.json"
SEEN_CIRCULARS_PATH = DATA_DIR / "seen_circulars.json"  # links already processed by real SEBI polling

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
        if not RULES_HISTORY_PATH.exists():
            with _lock:
                if not RULES_HISTORY_PATH.exists():
                    _write_json(RULES_HISTORY_PATH, [])
        if not CHECK_RUNS_PATH.exists():
            with _lock:
                if not CHECK_RUNS_PATH.exists():
                    _write_json(CHECK_RUNS_PATH, [])
        if not SEEN_CIRCULARS_PATH.exists():
            with _lock:
                if not SEEN_CIRCULARS_PATH.exists():
                    _write_json(SEEN_CIRCULARS_PATH, [])

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
            _write_json(RULES_HISTORY_PATH, [])
            _write_json(CHECK_RUNS_PATH, [])
            _write_json(SEEN_CIRCULARS_PATH, [])

    # -- rule versioning (the audit trail's foundation) -------------------
    def get_rule_history(self, rule_id: str | None = None) -> list[dict[str, Any]]:
        """Closed-out prior versions of a rule (or all rules if rule_id is None),
        oldest first. The currently active version lives in rules.live.json,
        not here — this is only the archive of superseded versions."""
        with _lock:
            history = _read_json(RULES_HISTORY_PATH)
        if rule_id is not None:
            history = [r for r in history if r["id"] == rule_id]
        return history

    def create_rule_version(
        self,
        rule_id: str,
        param_updates: dict[str, Any],
        approved_by: str,
        effective_date: date | None = None,
        drafted_by: str = "Agentic amendment loop",
    ) -> dict[str, Any]:
        """Amends a rule by creating a new version rather than mutating the
        current one in place: the old version is closed out (effective_to
        set) and archived to rules.history.json, and a new version with the
        updated params becomes the active row in rules.live.json. A run
        persisted before this call stays judged against the old version
        forever — that's the point."""
        effective_date = effective_date or date.today()
        with _lock:
            rules = _read_json(RULES_LIVE_PATH)
            for i, r in enumerate(rules):
                if r["id"] == rule_id:
                    old_version = dict(r)
                    old_version["effective_to"] = effective_date.isoformat()

                    new_version = dict(r)
                    new_version["params"] = {**r["params"], **param_updates}
                    new_version["version"] = r["version"] + 1
                    new_version["effective_from"] = effective_date.isoformat()
                    new_version["effective_to"] = None
                    new_version["supersedes"] = f"{r['id']}@v{r['version']}"
                    new_version["drafted_by"] = drafted_by
                    new_version["status"] = "approved"
                    new_version["approved_by"] = approved_by
                    new_version["approved_at"] = datetime.now().isoformat()

                    rules[i] = new_version
                    history = _read_json(RULES_HISTORY_PATH)
                    history.append(old_version)
                    _write_json(RULES_HISTORY_PATH, history)
                    _write_json(RULES_LIVE_PATH, rules)
                    return new_version
            raise KeyError(f"Rule '{rule_id}' not found")

    # -- check runs (the audit trail itself) -------------------------------
    def save_check_run(self, run: dict[str, Any]) -> None:
        with _lock:
            runs = _read_json(CHECK_RUNS_PATH)
            runs.append(run)
            _write_json(CHECK_RUNS_PATH, runs)

    def get_check_runs(self) -> list[dict[str, Any]]:
        with _lock:
            runs = _read_json(CHECK_RUNS_PATH)
        return sorted(runs, key=lambda r: r["run_at"], reverse=True)

    def get_check_run(self, run_id: str) -> dict[str, Any] | None:
        for run in self.get_check_runs():
            if run["run_id"] == run_id:
                return run
        return None

    # -- broker data (read-only for the demo) --------------------------
    def get_broker_profile(self) -> dict[str, Any]:
        return _read_json(BROKER_PROFILE_PATH)

    # -- real SEBI circular polling: which links have already been processed --
    def get_seen_circular_links(self) -> list[str]:
        with _lock:
            return _read_json(SEEN_CIRCULARS_PATH)

    def mark_circular_seen(self, link: str) -> None:
        with _lock:
            seen = _read_json(SEEN_CIRCULARS_PATH)
            if link not in seen:
                seen.append(link)
                _write_json(SEEN_CIRCULARS_PATH, seen)


store = Store()
