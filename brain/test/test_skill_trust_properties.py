"""Property tests for whom a Brain trusts to teach it a skill (P-SKILLTRUST-01..03).

Generated inputs only. The same IDs mark the TLA+ invariants in
verification/tla/SkillTrust.tla and the Lean theorems in
verification/lean/Verification/SkillTrust.lean; this file is the leg that runs
the real code.

What runs for real: social_logic.hot_ties and skill_trust_weight, PeerSkillFilter,
QuarantineStore (on SQLite), BrainHandler._run_peer_inbox_cycle, on_message and the
quarantine sweep in on_tick. The Grid (inbox and ties route) is replaced by FakeGrid.

Seed: set PBT_SEED to repeat a run; it is printed in the test header either way.
Cases per property: PBT_CASES (default 1000).
"""
from __future__ import annotations

import asyncio
import json
import math
import os
import random
import tempfile
from typing import Any
from unittest.mock import AsyncMock

import pytest
from hypothesis import HealthCheck, given, seed, settings
from hypothesis import strategies as st
from hypothesis.stateful import RuleBasedStateMachine, invariant, rule

from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.rpc.types import ActionType
from noesis_brain.skills.peer_filter import MAX_SKILLS_PER_SOURCE, TRUST_THRESHOLD_SKILL
from noesis_brain.skills.quarantine import QUARANTINE_TICKS
from noesis_brain.social_logic import HOT_TIE_WEIGHT, hot_ties, skill_trust_weight

from test.peer_inbox_support import FakeGrid, make_handler

SEED = int(os.environ.get("PBT_SEED") or random.SystemRandom().randrange(2**32))
CASES = int(os.environ.get("PBT_CASES") or 1000)
SELF = "did:noesis:hermes"

pbt = settings(
    max_examples=CASES, deadline=None, database=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large],
)


@pytest.fixture(scope="module", autouse=True)
def _print_seed(pytestconfig):
    pytestconfig.get_terminal_writer().line(f"\n[pbt] skill trust: seed={SEED} cases={CASES}")


# ── generators ───────────────────────────────────────────────────────────────
# A small pool makes one DID in several ties, and the mind itself as a tie, common;
# junk stands for a hostile or broken Grid answer.
POOL = [SELF] + [f"did:noesis:n{i}" for i in range(4)]


@st.composite
def _mostly(draw, good, bad, n: int = 4):
    """`good` n times in n+1 — hostile values stay present without drowning the valid ones."""
    return draw(good) if draw(st.integers(0, n)) else draw(bad)


junk = st.one_of(
    st.none(), st.integers(), st.booleans(), st.floats(allow_nan=True), st.text(max_size=6),
    st.lists(st.integers(), max_size=2),
)
dids = _mostly(st.sampled_from(POOL), st.text(max_size=12))
buckets = _mostly(st.sampled_from(["hot", "warm", "cold"]), st.one_of(junk, st.sampled_from(["HOT", "hot ", "Hot"])))
tie_st = _mostly(
    st.fixed_dictionaries({"counterparty_did": _mostly(dids, junk), "warmth_bucket": buckets}),
    st.one_of(
        st.fixed_dictionaries({"warmth_bucket": buckets}),
        st.fixed_dictionaries({"counterparty_did": dids}),
        junk,
    ),
)
ties_st = _mostly(st.lists(tie_st, max_size=6), junk)
weight_values = st.one_of(
    st.sampled_from([0.0, 0.34999, TRUST_THRESHOLD_SKILL, 0.35001, 1.0, -1.0,
                     float("inf"), float("-inf"), float("nan")]),
    st.floats(allow_nan=True, allow_infinity=True),
    junk,
)
weights_st = st.one_of(st.just({}), st.dictionaries(dids, weight_values, max_size=4))


def _expected_hot(ties: Any) -> set[str]:
    """The rule in plain words: a tie counts when it is a well-formed entry whose
    bucket is exactly "hot" and whose DID is a string other than the mind itself."""
    out: set[str] = set()
    if not isinstance(ties, list):
        return out
    for t in ties:
        if isinstance(t, dict) and t.get("warmth_bucket") == "hot":
            d = t.get("counterparty_did")
            if isinstance(d, str) and d != SELF:
                out.add(d)
    return out


def _real_weight(w: Any) -> bool:
    return isinstance(w, (int, float)) and not isinstance(w, bool) and math.isfinite(w)


# ── P-SKILLTRUST-01 ──────────────────────────────────────────────────────────
@seed(SEED)
@pbt
@given(weights=weights_st, ties=ties_st, did=dids)
def test_p_skilltrust_01_trusted_only_with_a_held_weight_or_a_hot_tie(weights, ties, did):
    hot = hot_ties(ties, SELF)
    assert hot == _expected_hot(ties)

    weight = skill_trust_weight(weights, hot, did)
    held = weights.get(did)
    held_ok = _real_weight(held) and held >= TRUST_THRESHOLD_SKILL
    assert math.isfinite(weight)
    assert (weight >= TRUST_THRESHOLD_SKILL) == (held_ok or did in _expected_hot(ties))


@seed(SEED)
@pbt
@given(weights=weights_st, ties=ties_st, did=dids)
def test_p_skilltrust_01_warm_cold_and_unknown_ties_add_no_trust(weights, ties, did):
    """Taking every hot tie out of the Grid's answer leaves only the held weight."""
    cooled = [
        {**t, "warmth_bucket": "warm"} if isinstance(t, dict) and t.get("warmth_bucket") == "hot" else t
        for t in ties
    ] if isinstance(ties, list) else ties
    weight = skill_trust_weight(weights, hot_ties(cooled, SELF), did)
    held = weights.get(did)
    assert weight == (float(held) if _real_weight(held) else 0.0)


def test_hot_tie_weight_is_the_grid_hot_floor_and_clears_the_threshold():
    assert HOT_TIE_WEIGHT == 0.60          # grid/src/relationships/config.ts warmthWarmMax
    assert HOT_TIE_WEIGHT >= TRUST_THRESHOLD_SKILL


# ── P-SKILLTRUST-02 ──────────────────────────────────────────────────────────
@seed(SEED)
@pbt
@given(ties=junk, did=dids)
def test_p_skilltrust_02_an_answer_that_is_not_a_list_of_ties_trusts_nobody(ties, did):
    if isinstance(ties, list):
        ties = [t for t in ties if not isinstance(t, dict)]
    hot = hot_ties(ties, SELF)
    assert hot == frozenset()
    assert skill_trust_weight({}, hot, did) == 0.0


# ── P-SKILLTRUST-02, 03: the Brain over time ─────────────────────────────────
PEERS = [f"did:noesis:n{i}" for i in range(3)]
REFRESH = 60   # BrainHandler._HOT_TIES_REFRESH_TICKS


class SkillTrustMachine(RuleBasedStateMachine):
    """One live-wired Brain. Ties warm and cool on the Grid, the ties read can fail,
    peers teach skills, ticks pass. The model keeps what the Brain last read."""

    def __init__(self) -> None:
        super().__init__()
        self.loop = asyncio.new_event_loop()
        self.tmp = tempfile.TemporaryDirectory()
        self.grid = FakeGrid()
        self.brain = make_handler(SELF, memory=MemoryStore(":memory:"), hypnos_db_dir=self.tmp.name)
        self.wire = self.grid.wire(SELF, "Hermes")
        self.brain._grid_wire_client = self.wire
        self.wire.fetch_relationships = AsyncMock(side_effect=self._answer)
        self.bucket = {p: "cold" for p in PEERS}       # the truth on the Grid
        self.read_fails = False
        self.known_hot: set[str] = set()               # what the Brain last read
        self.last_read = None
        self.tick = 1
        self.n = 0
        self.held: dict[str, int] = {p: 0 for p in PEERS}   # quarantined + active, per teacher
        self.waiting: list[tuple[str, str, int]] = []       # (teacher, instructions, due tick)
        self.active: set[str] = set()                       # instructions that joined the skills
        self.sent: dict[str, str] = {}                      # instructions → teacher
        self.expect_quarantined: set[str] = set()

    async def _answer(self, _did: str) -> Any:
        if self.read_fails:
            raise RuntimeError("grid down")
        return [{"counterparty_did": p, "warmth_bucket": b} for p, b in self.bucket.items()]

    def teardown(self) -> None:
        self.loop.close()
        self.tmp.cleanup()

    def _model_read(self) -> None:
        self.known_hot = set() if self.read_fails else {p for p, b in self.bucket.items() if b == "hot"}
        self.last_read = self.tick

    @rule(peer=st.sampled_from(PEERS), bucket=st.sampled_from(["hot", "hot", "warm", "cold"]))
    def tie_changes(self, peer, bucket):
        self.bucket[peer] = bucket

    @rule(fails=st.booleans())
    def grid_read_breaks_or_heals(self, fails):
        self.read_fails = fails

    @rule(peer=st.sampled_from(PEERS))
    def peer_teaches(self, peer):
        self.n += 1
        text = f"step {self.n}"
        payload = json.dumps({"name": f"s{self.n}", "description": "d", "instructions": text, "triggers": []})
        self.grid.enqueue(SELF, {"kind": "direct_message", "sender_did": peer, "sender_name": "N",
                                 "channel": "direct", "text": "__skill_share:" + payload, "tick": self.tick})
        self.sent[text] = peer
        self.loop.run_until_complete(self.brain._run_peer_inbox_cycle(self.tick))
        self._model_read()                              # a waiting message always forces a read
        if peer in self.known_hot and self.held[peer] < MAX_SKILLS_PER_SOURCE:
            self.held[peer] += 1
            self.waiting.append((peer, text, self.tick + QUARANTINE_TICKS))
            self.expect_quarantined.add(text)

    @rule(step=st.sampled_from([1, 1, 7, REFRESH, QUARANTINE_TICKS]))
    def time_passes(self, step):
        self.tick += step
        self.loop.run_until_complete(self.brain._run_peer_inbox_cycle(self.tick))
        if (self.last_read is None or self.tick - self.last_read >= REFRESH
                or any(due <= self.tick + 1 for _, _, due in self.waiting)):
            self._model_read()
        actions = self.brain._sweep_quarantine({"tick": self.tick})
        due = [w for w in self.waiting if w[2] <= self.tick]
        self.waiting = [w for w in self.waiting if w[2] > self.tick]
        taught = 0
        for peer, text, _ in due:
            self.expect_quarantined.discard(text)
            if peer in self.known_hot:
                self.active.add(text)
                taught += 1
            else:
                self.held[peer] -= 1
        kinds = [a["action_type"] for a in actions]
        assert kinds.count(ActionType.SKILL_TAUGHT.value) == taught
        assert kinds.count(ActionType.SKILL_REJECTED.value) == len(due) - taught

    @invariant()
    def p_skilltrust_03_stores_match_what_the_last_read_allowed(self):
        """P-SKILLTRUST-03 (and P-SKILLTRUST-02, through the model's failed reads): what is
        quarantined and what has joined the skills is exactly what the reads allowed."""
        conn = self.brain.memory._conn
        quarantined = {json.loads(r[0])["instructions"] for r in
                       conn.execute("SELECT payload_json FROM skills_quarantine").fetchall()}
        active = {r[0] for r in conn.execute("SELECT instructions FROM skills").fetchall()}
        assert quarantined == self.expect_quarantined
        assert active == self.active


SkillTrustMachine.TestCase.settings = settings(
    max_examples=CASES, stateful_step_count=30, deadline=None, database=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large],
)
test_p_skilltrust_02_03_stateful = seed(SEED)(SkillTrustMachine.TestCase)
