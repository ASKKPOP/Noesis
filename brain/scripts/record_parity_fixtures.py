"""Record the Brain parity fixtures (Rust port step R0 — contract freeze, D-V3-42).

The Brain is being rewritten in Rust. Before any Rust exists, this records what the
Python Brain's DETERMINISTIC faculties compute, as language-neutral JSON under
``brain/parity/fixtures/``. A port is correct when it reproduces every case exactly:
same numbers (IEEE-754 doubles, shortest round-trip decimal form), same hashes.

    .venv/bin/python -m scripts.record_parity_fixtures          # rewrite the fixtures
    .venv/bin/pytest test/test_parity_fixtures.py               # replay them (CI)

Regenerating is a CONTRACT CHANGE: do it only when the Python behaviour changed on
purpose, and review the diff. Everything here is pure — no clock, no randomness, no I/O
except writing the files. The LLM loops, the RPC surface and P2P are NOT covered here
(see ``parity/README.md``).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from noesis_brain.ananke import config as ananke_config
from noesis_brain.ananke import drives
from noesis_brain.ananke.types import DRIVE_NAMES, DriveLevel, DriveState
from noesis_brain.bios import config as bios_config
from noesis_brain.bios import needs
from noesis_brain.bios.types import NEED_NAMES, NeedState
from noesis_brain.chronos import types as chronos_types
from noesis_brain.chronos.subjective_time import (
    compute_multiplier,
    recency_score_by_tick,
    score_with_chronos,
)
from noesis_brain.memory.types import Memory, MemoryType
from noesis_brain.state_hash import _sha256_canonical
from noesis_brain.telos.hashing import compute_active_telos_hash
from noesis_brain.telos.types import Goal, GoalStatus, GoalType
from noesis_brain.thymos import tracker as thymos_tracker
from noesis_brain.thymos.tracker import ThymosTracker
from noesis_brain.thymos.types import Emotion

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "parity" / "fixtures"
FIXTURE_VERSION = 1

TRAJECTORY_TICKS = 8000   # long enough for every drive and need to cross both thresholds
SAMPLE_EVERY = 400
LEVELS = (DriveLevel.LOW, DriveLevel.MED, DriveLevel.HIGH)


def _enum_keys(d: dict) -> dict[str, Any]:
    return {k.value: (v.value if hasattr(v, "value") else v) for k, v in d.items()}


# ── bios ────────────────────────────────────────────────────────────────────

def _bios_trajectory(start: NeedState) -> dict[str, Any]:
    state = start
    samples, crossings = [], []
    for tick in range(1, TRAJECTORY_TICKS + 1):
        state, crossed = needs.step(state, tick)
        for c in crossed:
            crossings.append({"tick": tick, "need": c.need.value, "level": c.level.value, "direction": c.direction.value})
        if tick % SAMPLE_EVERY == 0:
            samples.append({"tick": tick, "values": _enum_keys(state.values), "levels": _enum_keys(state.levels)})
    return {"samples": samples, "crossings": crossings, "terminal": needs.is_terminal(state)}


def bios_fixture() -> dict[str, Any]:
    initial = needs.initial_state()
    low = NeedState(values={n: 0.05 for n in NEED_NAMES}, levels={n: DriveLevel.LOW for n in NEED_NAMES})
    near_death = NeedState(values={n: 0.9995 for n in NEED_NAMES}, levels={n: DriveLevel.HIGH for n in NEED_NAMES})
    grid = [0.0, 0.3, 0.3099, 0.31, 0.3101, 0.33, 0.3499, 0.35, 0.3501, 0.5, 0.6399, 0.64, 0.6401, 0.66, 0.6799, 0.68, 0.6801, 1.0]
    return {
        "constants": {
            "need_order": [n.value for n in NEED_NAMES],
            "baselines": _enum_keys(bios_config.NEED_BASELINES),
            "rise_rates": _enum_keys(bios_config.NEED_RISE_RATES),
            "threshold_low": bios_config.THRESHOLD_LOW,
            "threshold_high": bios_config.THRESHOLD_HIGH,
            "hysteresis_band": bios_config.HYSTERESIS_BAND,
            "tau": bios_config.TAU,
            "decay_factor": bios_config.DECAY_FACTOR,
            "need_to_drive": _enum_keys(bios_config.NEED_TO_DRIVE),
        },
        "bucket": [
            {"value": v, "prev_level": lv.value, "level": needs.bucket(v, lv).value}
            for v in grid for lv in LEVELS
        ],
        "initial_state": {"values": _enum_keys(initial.values), "levels": _enum_keys(initial.levels)},
        "trajectories": [
            {"name": "from_initial_state", "start": {"values": _enum_keys(initial.values), "levels": _enum_keys(initial.levels)}, **_bios_trajectory(initial)},
            {"name": "from_below_baseline", "start": {"values": _enum_keys(low.values), "levels": _enum_keys(low.levels)}, **_bios_trajectory(low)},
            {"name": "to_starvation", "start": {"values": _enum_keys(near_death.values), "levels": _enum_keys(near_death.levels)}, **_bios_trajectory(near_death)},
        ],
    }


# ── ananke ──────────────────────────────────────────────────────────────────

def _ananke_trajectory(start: DriveState, seed: int) -> dict[str, Any]:
    state = start
    samples, crossings = [], []
    for tick in range(1, TRAJECTORY_TICKS + 1):
        state, crossed = drives.detect_crossing(drives.step(state, seed, tick))
        for c in crossed:
            crossings.append({"tick": tick, "drive": c.drive.value, "level": c.level.value, "direction": c.direction.value})
        if tick % SAMPLE_EVERY == 0:
            samples.append({"tick": tick, "values": _enum_keys(state.values), "levels": _enum_keys(state.levels)})
    return {"seed": seed, "samples": samples, "crossings": crossings}


def ananke_fixture() -> dict[str, Any]:
    initial = drives.initial_state()
    low = DriveState(values={d: 0.02 for d in DRIVE_NAMES}, levels={d: DriveLevel.LOW for d in DRIVE_NAMES})
    grid = [0.0, 0.2, 0.3099, 0.3101, 0.33, 0.3499, 0.3501, 0.4, 0.5, 0.6399, 0.6401, 0.66, 0.6799, 0.6801, 0.9, 1.0]
    return {
        "constants": {
            "drive_order": [d.value for d in DRIVE_NAMES],
            "baselines": _enum_keys(ananke_config.DRIVE_BASELINES),
            "rise_rates": _enum_keys(ananke_config.DRIVE_RISE_RATES),
            "threshold_low": ananke_config.THRESHOLD_LOW,
            "threshold_high": ananke_config.THRESHOLD_HIGH,
            "hysteresis_band": ananke_config.HYSTERESIS_BAND,
            "tau": ananke_config.TAU,
            "decay_factor": ananke_config.DECAY_FACTOR,
        },
        "bucket": [
            {"value": v, "prev_level": lv.value, "level": drives.bucket(v, lv).value}
            for v in grid for lv in LEVELS
        ],
        "initial_state": {"values": _enum_keys(initial.values), "levels": _enum_keys(initial.levels)},
        "trajectories": [
            {"name": "from_initial_state_seed_0", "start": {"values": _enum_keys(initial.values), "levels": _enum_keys(initial.levels)}, **_ananke_trajectory(initial, 0)},
            # The update is seed-independent today; a second seed pins that as part of the contract.
            {"name": "from_initial_state_seed_7", "start": {"values": _enum_keys(initial.values), "levels": _enum_keys(initial.levels)}, **_ananke_trajectory(initial, 7)},
            {"name": "from_below_baseline", "start": {"values": _enum_keys(low.values), "levels": _enum_keys(low.levels)}, **_ananke_trajectory(low, 0)},
        ],
    }


# ── chronos ─────────────────────────────────────────────────────────────────

def chronos_fixture() -> dict[str, Any]:
    def mem(tick: int) -> Memory:
        return Memory(memory_type=MemoryType.OBSERVATION, content="", tick=tick)

    recency_cases = [(0, 0, 0.99), (10, 10, 0.99), (0, 1, 0.99), (0, 100, 0.99), (40, 1000, 0.99), (0, 5000, 0.99), (500, 100, 0.99), (0, 250, 0.995), (0, 30, 0.9)]
    multipliers = [0.25, 0.7, 1.0, 1.7, 4.0]
    return {
        "constants": {
            "multiplier_min": chronos_types.SUBJECTIVE_MULT_MIN,
            "multiplier_max": chronos_types.SUBJECTIVE_MULT_MAX,
            "curiosity_boost": _enum_keys(chronos_types.CURIOSITY_BOOST),
            "boredom_penalty": _enum_keys(chronos_types.BOREDOM_PENALTY),
        },
        "compute_multiplier": [
            {"curiosity_level": c.value, "boredom_level": b.value, "multiplier": compute_multiplier(c, b)}
            for c in LEVELS for b in LEVELS
        ],
        "recency_score_by_tick": [
            {"memory_tick": mt, "current_tick": ct, "decay_rate": dr, "score": recency_score_by_tick(mem(mt), ct, dr)}
            for mt, ct, dr in recency_cases
        ],
        "score_with_chronos": [
            {"memory_tick": mt, "current_tick": ct, "decay_rate": dr, "multiplier": m, "score": score_with_chronos(mem(mt), ct, m, dr)}
            for mt, ct, dr in recency_cases[:6] for m in multipliers
        ],
    }


# ── telos + canonical hashing ───────────────────────────────────────────────

def hashing_fixture() -> dict[str, Any]:
    goal_sets: list[tuple[str, list[Goal]]] = [
        ("empty", []),
        ("one_active", [Goal("learn the market", GoalType("short_term"))]),
        ("mixed_statuses", [
            Goal("earn a living", GoalType("long_term"), priority=0.9, progress=0.25),
            Goal("finished thing", GoalType("short_term"), status=GoalStatus.COMPLETED, progress=1.0),
            Goal("given up", GoalType("short_term"), status=GoalStatus.ABANDONED),
            Goal("blocked for now", GoalType("medium_term"), status=GoalStatus.BLOCKED, priority=0.4),
            Goal("write lore", GoalType("medium_term"), priority=0.1, progress=0.3333333333333333),
        ]),
        ("non_ascii_and_order", [
            Goal("νόησις — know thyself", GoalType("long_term"), priority=1.0),
            Goal("서로 돕기", GoalType("short_term"), priority=0.0, progress=0.5),
            Goal('quote " and \\ backslash', GoalType("short_term")),
        ]),
        ("not_hashed_fields_ignored", [Goal("same goal", GoalType("short_term"), last_advanced_tick=991)]),
        ("not_hashed_fields_ignored_twin", [Goal("same goal", GoalType("short_term"), last_advanced_tick=3)]),
    ]
    canonical_inputs: list[tuple[str, Any]] = [
        ("empty_object", {}),
        ("key_order", {"b": 1, "a": 2, "c": {"z": True, "y": None}}),
        ("floats", {"half": 0.5, "third": 1 / 3, "tiny": 1e-07, "big": 1e21, "int_like": 2.0, "neg_zero": -0.0}),
        ("non_ascii_kept_raw", {"name": "Σοφία", "note": "한글 ✓", "quote": 'a"b\\c', "control": "tab\tnewline\n"}),
        ("nested_lists", {"values": ["b", "a", ["x", 1, 2.5]], "emotions": {"joy": 0.4, "anger": 0.0}}),
    ]
    return {
        "telos_goal_types": [g.value for g in GoalType],
        "telos_goal_statuses": [s.value for s in GoalStatus],
        "active_telos_hash": [
            {
                "name": name,
                "goals": [
                    {"description": g.description, "goal_type": g.goal_type.value, "status": g.status.value,
                     "priority": g.priority, "progress": g.progress, "last_advanced_tick": g.last_advanced_tick}
                    for g in goals
                ],
                "hash": compute_active_telos_hash(goals),
            }
            for name, goals in goal_sets
        ],
        # state_hash._sha256_canonical: sha256 over JSON with sorted keys, no whitespace,
        # non-ASCII emitted raw (UTF-8), floats in shortest round-trip form.
        "sha256_canonical": [
            {"name": name, "input": obj,
             "canonical_json": json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False),
             "hash": _sha256_canonical(obj)}
            for name, obj in canonical_inputs
        ],
    }


# ── thymos ──────────────────────────────────────────────────────────────────

def _thymos_run(intensity_setting: str, script: list[dict[str, Any]], triggers: dict[str, list[str]]) -> dict[str, Any]:
    t = ThymosTracker({"baseline_mood": "calm", "emotional_intensity": intensity_setting, "triggers": triggers})
    steps = []
    for op in script:
        out: dict[str, Any] = {"op": op}
        if op["do"] == "feel":
            t.feel(Emotion(op["emotion"]), op["intensity"], op.get("trigger", ""))
        elif op["do"] == "decay":
            for _ in range(op.get("times", 1)):
                t.decay()
        elif op["do"] == "apply_triggers":
            out["matched"] = [[e.value, trig] for e, trig in t.apply_triggers(op["text"], op.get("base_intensity", 0.4))]
        out["intensities"] = {e.value: s.intensity for e, s in t.mood.emotions.items()}
        out["dominant"] = t.mood.dominant_emotion().emotion.value
        out["mood"] = t.mood.current_mood()
        steps.append(out)
    return {"emotional_intensity": intensity_setting, "triggers": triggers, "steps": steps}


def thymos_fixture() -> dict[str, Any]:
    triggers = {"joy": ["trade", "friend"], "fear": ["police", "fine"], "curiosity": ["library"], "not_an_emotion": ["x"]}
    script = [
        {"do": "feel", "emotion": "joy", "intensity": 0.3, "trigger": "a good trade"},
        {"do": "feel", "emotion": "joy", "intensity": 0.45},
        {"do": "decay"},
        {"do": "feel", "emotion": "fear", "intensity": 0.9},
        {"do": "feel", "emotion": "fear", "intensity": 0.9},
        {"do": "decay", "times": 3},
        {"do": "apply_triggers", "text": "A Friend told me the POLICE issued a fine near the library."},
        {"do": "apply_triggers", "text": "nothing of note", "base_intensity": 0.7},
        {"do": "decay", "times": 30},
    ]
    return {
        "constants": {
            "emotion_order": [e.value for e in Emotion],
            "decay_rate": thymos_tracker.DECAY_RATE,
            "intensity_multiplier": dict(thymos_tracker.INTENSITY_MULTIPLIER),
        },
        "runs": [_thymos_run(setting, script, triggers) for setting in ("low", "medium", "high")],
    }


FIXTURES = {
    "bios": bios_fixture,
    "ananke": ananke_fixture,
    "chronos": chronos_fixture,
    "hashing": hashing_fixture,
    "thymos": thymos_fixture,
}


def build(name: str) -> dict[str, Any]:
    """The fixture as the Python Brain computes it right now."""
    return {"fixture": name, "version": FIXTURE_VERSION, **FIXTURES[name]()}


def serialize(fixture: dict[str, Any]) -> str:
    return json.dumps(fixture, indent=1, ensure_ascii=False, sort_keys=False) + "\n"


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    for name in FIXTURES:
        path = FIXTURE_DIR / f"{name}.json"
        path.write_text(serialize(build(name)), encoding="utf-8")
        print(f"wrote {path.relative_to(FIXTURE_DIR.parent.parent)}")


if __name__ == "__main__":
    main()
