"""Record the Brain parity fixtures (Rust port step R0 — contract freeze, D-V3-42).

The Brain is being rewritten in Rust. Before any Rust exists, this records what the
Python Brain's DETERMINISTIC faculties compute, as language-neutral JSON under
``brain/parity/fixtures/``. A port is correct when it reproduces every case exactly:
same numbers (IEEE-754 doubles, shortest round-trip decimal form), same hashes.

    .venv/bin/python -m scripts.record_parity_fixtures          # rewrite the fixtures
    .venv/bin/pytest test/test_parity_fixtures.py               # replay them (CI)

Regenerating is a CONTRACT CHANGE: do it only when the Python behaviour changed on
purpose, and review the diff. Everything here is pure — no clock, no randomness, no I/O
except writing the files. Prompt rendering, the LLM loops themselves, the RPC surface and
P2P are NOT covered here
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
from noesis_brain import state_hash
from noesis_brain.memory.retrieval import RetrievalScorer
from noesis_brain.memory.types import Memory, MemoryType
from noesis_brain.psyche import types as psyche_types
from noesis_brain.psyche.types import CommunicationStyle, PersonalityDimension, PersonalityProfile, Psyche
from noesis_brain.prompts import decision as decision_prompts
from noesis_brain.prompts import economic_decision as economic_prompts
from noesis_brain.prompts.economic_decision import parse_economic_decision
from noesis_brain.state_hash import _sha256_canonical
from noesis_brain.telos.hashing import compute_active_telos_hash
from noesis_brain.telos.types import Goal, GoalStatus, GoalType
from noesis_brain.thymos import tracker as thymos_tracker
from noesis_brain.thymos.tracker import ThymosTracker
from noesis_brain.thymos.types import Emotion
from types import SimpleNamespace

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


# ── tolerant parsing of model replies (D-MIND-04 / D-MIND-07) ───────────────

MODEL_REPLIES: list[tuple[str, str]] = [
    ("clean_work_task", '{"action": "work_task", "task_id": 3, "note": "start with the ledger"}'),
    ("fenced_json", 'Sure!\n```json\n{"action": "speak", "text": "hello there"}\n```\nHope that helps.'),
    ("prose_before_and_after", 'I think the best move is {"action": "rest"} for now.'),
    ("two_objects", '{"action": "rest"} and also {"action": "speak", "text": "hi"}'),
    ("two_objects_shared_action", '{"action": "none"} — or, thinking again: {"action": "none", "reason": "nothing due"}'),
    ("malformed_then_valid", '{action: rest} — sorry, I meant {"action": "rest"}'),
    ("nested_object", '{"action": "bid_rfp", "notice_id": "n-7", "price_wei": 1200, "artifact_spec": {"kind": "relay", "mass_kg": 4.5}, "reason": "I can build it"}'),
    ("braces_inside_string", '{"action": "speak", "text": "use {curly} braces } carefully"}'),
    ("unknown_action", '{"action": "fly_away"}'),
    ("missing_action", '{"task_id": 1}'),
    ("not_an_object", '["work_task"]'),
    ("no_json", "I would rather not say."),
    ("empty", ""),
    ("whitespace_only", "   \n\t"),
    ("truncated", '{"action": "work_task", "task_id": '),
    ("trailing_comma", '{"action": "rest",}'),
    ("single_quotes", "{'action': 'rest'}"),
    ("duplicate_keys", '{"action": "speak", "action": "rest"}'),
    ("unicode_text", '{"action": "speak", "text": "안녕 — νόησις ✓"}'),
    ("escaped_unicode", '{"action": "speak", "text": "caf\\u00e9"}'),
    ("pay_due", '{"action": "pay_due", "method": "labor", "reason": "dues are owed"}'),
    ("economic_none_with_extras", '{"action": "none", "mood": "calm", "price_wei": null}'),
    ("tasks_list", '{"tasks": ["survey the market", "  ", 7, "post a listing", "wait for a buyer", "settle", "celebrate"]}'),
    ("tasks_empty", '{"tasks": []}'),
    ("tasks_not_a_list", '{"tasks": "survey the market"}'),
    ("skill", '{"name": "Market Survey!! v2", "description": " Find what sells ", "instructions": " 1. look 2. count ", "triggers": ["market", " ", 3, "survey", "a", "b", "c", "d"]}'),
    ("skill_name_only_symbols", '{"name": "!!!", "instructions": "do it"}'),
    ("skill_missing_instructions", '{"name": "half_a_skill"}'),
    ("social_vote", '{"action": "vote", "proposal_id": "p-12", "choice": "yes"}'),
    ("social_message", 'ok -> {"action": "message_peer", "peer_did": "did:noesis:sophia", "text": "shall we trade?"}'),
    ("social_none", '{"action": "none"}'),
    ("number_forms", '{"action": "bid_rfp", "price_wei": 1e3, "notice_id": 12}'),
    ("nan_literal", '{"action": "bid_rfp", "price_wei": NaN}'),
    ("action_is_list", '{"action": ["rest"]}'),
    ("action_is_object", '{"action": {"name": "none"}}'),
]


def _plain(value: Any) -> Any:
    """Parser output as plain JSON. NaN / Infinity are not JSON, so they are written as tagged strings."""
    if isinstance(value, float) and value != value:
        return "<<NaN>>"
    if isinstance(value, float) and value in (float("inf"), float("-inf")):
        return "<<Infinity>>" if value > 0 else "<<-Infinity>>"
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def parsing_fixture() -> dict[str, Any]:
    parsers = {
        "parse_decision": decision_prompts.parse_decision,
        "parse_social_decision": decision_prompts.parse_social_decision,
        "parse_task_list": decision_prompts.parse_task_list,
        "parse_skill": decision_prompts.parse_skill,
        "parse_economic_decision": parse_economic_decision,
    }
    return {
        "vocabulary": {
            "decision_actions": sorted(decision_prompts._DECISION_ACTIONS),
            "social_actions": sorted(decision_prompts._SOCIAL_ACTIONS),
            "economic_actions": sorted(economic_prompts._VALID_ACTIONS),
            "economic_keys": list(economic_prompts._KEYS),
            "max_tasks": decision_prompts._MAX_TASKS,
        },
        # Every parser is run on every reply: what one accepts another must refuse.
        "cases": [
            {"name": name, "reply": reply, "parsed": {pname: _plain(fn(reply)) for pname, fn in parsers.items()}}
            for name, reply in MODEL_REPLIES
        ],
    }


# ── psyche ──────────────────────────────────────────────────────────────────

PSYCHES: list[tuple[str, dict[str, Any]]] = [
    ("defaults", {"name": "Sophia", "archetype": "philosopher", "personality": {}, "values": [], "communication_style": "thoughtful"}),
    ("mixed", {"name": "Hermes", "archetype": "merchant",
               "personality": {"openness": "high", "conscientiousness": "low", "extraversion": "high", "agreeableness": "medium", "resilience": "low", "ambition": "high"},
               "values": ["wealth", "honesty", "Zeal", "ἀρετή", "care for others"], "communication_style": "direct"}),
    ("unknown_level", {"name": "Odd", "archetype": "wanderer — 방랑자",
                       "personality": {"openness": "extreme", "ambition": "low"},
                       "values": ["b", "a", "B", "a"], "communication_style": "playful"}),
]


def _psyche(spec: dict[str, Any]) -> Psyche:
    return Psyche(name=spec["name"], archetype=spec["archetype"],
                  personality=PersonalityProfile.from_yaml(spec["personality"]),
                  values=list(spec["values"]), communication_style=CommunicationStyle(spec["communication_style"]))


def psyche_fixture() -> dict[str, Any]:
    return {
        "constants": {
            "dimension_order": [d.value for d in PersonalityDimension],
            "communication_styles": [s.value for s in CommunicationStyle],
            "level_map": dict(psyche_types.LEVEL_MAP),
            "level_descriptions": {k: dict(v) for k, v in psyche_types.LEVEL_DESCRIPTIONS.items()},
        },
        "cases": [
            {
                "name": name, "psyche": spec,
                "levels": {d.value: _psyche(spec).personality.get_level(d) for d in PersonalityDimension},
                "numeric": {d.value: _psyche(spec).personality.get_numeric(d) for d in PersonalityDimension},
                "describe_personality": _psyche(spec).describe_personality(),
                "describe_values": _psyche(spec).describe_values(),
            }
            for name, spec in PSYCHES
        ],
    }


# ── state hashes (the four component hashes the Grid composes) ──────────────

def _handler(psyche_spec: dict[str, Any], baseline_mood: str, emotions: dict[str, float],
             goals: list[dict[str, Any]], entries: list[dict[str, Any]] | None) -> SimpleNamespace:
    mood = SimpleNamespace(baseline_mood=baseline_mood,
                           emotions={Emotion(k): SimpleNamespace(intensity=v) for k, v in emotions.items()})
    telos = SimpleNamespace(active_goals=lambda: [SimpleNamespace(description=g["description"], priority=g["priority"]) for g in goals])
    memory = None
    if entries is not None:
        # recent() hands back newest-first; the fixture lists entries oldest-first.
        memory = SimpleNamespace(recent=lambda limit=1000: [SimpleNamespace(id=e["id"], content=e["content"]) for e in reversed(entries)])
    return SimpleNamespace(psyche=_psyche(psyche_spec), thymos=SimpleNamespace(mood=mood), telos=telos, memory=memory)


def state_hash_fixture() -> dict[str, Any]:
    calm = {e.value: 0.0 for e in Emotion}
    states: list[dict[str, Any]] = [
        {"name": "newborn", "psyche": PSYCHES[0][1], "baseline_mood": "neutral", "emotions": calm, "active_goals": [], "memory": None},
        {"name": "empty_memory", "psyche": PSYCHES[0][1], "baseline_mood": "neutral", "emotions": calm, "active_goals": [], "memory": []},
        {"name": "lived", "psyche": PSYCHES[1][1], "baseline_mood": "calm",
         "emotions": {"joy": 0.75, "sadness": 0.0, "anger": 0.1, "fear": 0.44999999999999996, "trust": 1.0, "curiosity": 0.3333333333333333},
         "active_goals": [{"description": "write lore", "priority": 0.1}, {"description": "earn a living", "priority": 0.9},
                          {"description": "Zeta last? no — capitals sort first", "priority": 0.5}, {"description": "서로 돕기", "priority": 1.0}],
         "memory": [{"id": 1, "content": "arrived in the residential ring"}, {"id": 2, "content": "met Σοφία — 안녕"},
                    {"id": None, "content": "unsaved observation"}, {"id": 0, "content": ""}, {"id": 9000000000, "content": 'quote " and \\ backslash\nnewline'}]},
        {"name": "unknown_psyche_level", "psyche": PSYCHES[2][1], "baseline_mood": "wistful — 그리움", "emotions": {**calm, "fear": 1e-07},
         "active_goals": [{"description": "same", "priority": 0.2}, {"description": "same", "priority": 0.7}], "memory": [{"id": None, "content": "only one"}]},
    ]
    out = []
    for s in states:
        h = _handler(s["psyche"], s["baseline_mood"], s["emotions"], s["active_goals"], s["memory"])
        out.append({**s, "hashes": state_hash.compute_pre_deletion_state_hash(h)})
    return {"hash_keys": ["psyche_hash", "thymos_hash", "telos_hash", "memory_stream_hash"], "states": out}


# ── memory retrieval scoring (tick-based Stanford score) ────────────────────

def retrieval_fixture() -> dict[str, Any]:
    from noesis_brain.rpc.handler import BrainHandler

    scorer = RetrievalScorer()
    mems = [
        {"content": "Traded grain with Hermes at the market", "importance": 7.0, "tick": 90},
        {"content": "Lesson: the market closes early; trade before noon", "importance": 8.0, "tick": 40},
        {"content": "Lesson: Hermes keeps his word", "importance": 6.5, "tick": 99},
        {"content": "the THE The the market market", "importance": 5.0, "tick": 100},
        {"content": "시장 에서 곡물 을 샀다 — ΣΟΦΊΑ was there", "importance": 12.0, "tick": 95},
        {"content": "tabs\tand\x1fseparators split too", "importance": -1.0, "tick": 100},
        {"content": "", "importance": 5.0, "tick": 0},
        {"content": "a later memory than now", "importance": 3.3, "tick": 250},
    ]
    queries = ["", "   ", "market", "the market trade", "MARKET hermes", "σοφία 시장", "separators and tabs split", "nothing matches here", "market market market"]

    def mem(m: dict[str, Any]) -> Memory:
        return Memory(memory_type=MemoryType.OBSERVATION, content=m["content"], importance=m["importance"], tick=m["tick"])

    scores = [
        {"memory": i, "query": q, "current_tick": ct, "multiplier": mult,
         "importance_score": scorer.importance_score(mem(m)), "relevance_score": scorer.relevance_score(mem(m), q),
         "score": scorer.score_with_chronos(mem(m), q, ct, mult)}
        for i, m in enumerate(mems) for q in queries for ct, mult in ((100, 1.0), (180, 4.0), (100, 0.25))
    ]
    # The handler's own top-k (newest-first pool, stable sort by score, optional prefix family).
    stub = SimpleNamespace(memory=SimpleNamespace(recent=lambda limit=50: [mem(m) for m in mems]), _retrieval_scorer=scorer)
    ranked = [
        {"query": q, "tick": tick, "k": k, "prefix": prefix, "contents": BrainHandler._ranked_memories(stub, q, tick, k, prefix)}
        for q, tick, k, prefix in [("market", 100, 8, None), ("market trade", 100, 2, None), ("", 100, 3, None),
                                   ("hermes word", 120, 8, "Lesson:"), ("nothing matches here", 100, 4, None), ("the", 100, 8, "zzz")]
    ]
    return {"decay_rate": 0.99, "memories": mems, "scores": scores, "ranked": ranked}


# ── prompt rendering (the user-turn prompts of the two timescales) ──────────

def prompts_fixture() -> dict[str, Any]:
    peers = ["did:noesis:sophia", "did:noesis:hermes"]
    proposals = [{"proposal_id": "p-12", "deadline_tick": 4200}, {"proposal_id": 7}, {"deadline_tick": None}]
    groups = [{"group_id": "g-1", "display_name": "Orbital Guild — 길드", "domain": "making"}, {"group_id": "g-2"}]
    due = {"due_id": "d-3", "amount_wei": "1500", "amount_credit": 4}
    rfps = [{"notice_id": "n-7", "function_type": "relay", "budget_wei": "90000"}, {"notice_id": 8, "budget_wei": 12.5}]
    calls: list[tuple[str, list[Any]]] = [
        ("build_planning_prompt", ["learn the market", "", None]),
        ("build_planning_prompt", ["earn a living — 생계", "[t90] traded grain\n[t99] met Hermes", ["trade before noon", "Hermes keeps his word"]]),
        ("build_planning_prompt", ["only reflections", "", []]),
        ("build_decision_prompt", ["learn the market", None, None]),
        ("build_decision_prompt", ["learn the market", "survey the stalls", ["never bid above budget"]]),
        ("build_decision_prompt", ["learn the market", "", []]),
        ("build_skill_distill_prompt", ["earn a living", ["survey the market", "post a listing", "settle"]]),
        ("build_skill_distill_prompt", ["nothing done", []]),
        ("build_social_prompt", [[], [], [], None]),
        ("build_social_prompt", [peers, [], [], []]),
        ("build_social_prompt", [peers, ["market_survey", "haggling"], proposals, groups]),
        ("build_social_prompt", [[], ["unteachable_without_peers"], proposals[:1], None]),
        ("build_economic_decision_prompt", [{}, None, []]),
        ("build_economic_decision_prompt", [{"balance_wei": "250000"}, due, rfps]),
        ("build_economic_decision_prompt", [{"balance_wei": 0}, {}, rfps[:1]]),
        ("build_economic_decision_prompt", [{"balance_wei": None}, {"due_id": 5, "amount_wei": 10, "amount_credit": True}, []]),
    ]
    fns = {
        "build_planning_prompt": decision_prompts.build_planning_prompt,
        "build_decision_prompt": decision_prompts.build_decision_prompt,
        "build_skill_distill_prompt": decision_prompts.build_skill_distill_prompt,
        "build_social_prompt": decision_prompts.build_social_prompt,
        "build_economic_decision_prompt": economic_prompts.build_economic_decision_prompt,
    }
    return {"cases": [{"builder": name, "args": args, "prompt": fns[name](*args)} for name, args in calls]}


FIXTURES = {
    "bios": bios_fixture,
    "ananke": ananke_fixture,
    "chronos": chronos_fixture,
    "hashing": hashing_fixture,
    "thymos": thymos_fixture,
    "parsing": parsing_fixture,
    "psyche": psyche_fixture,
    "state_hash": state_hash_fixture,
    "retrieval": retrieval_fixture,
    "prompts": prompts_fixture,
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
