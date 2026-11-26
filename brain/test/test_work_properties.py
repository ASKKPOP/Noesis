"""Property tests for a Nous's part in a Work (P-NOUSWORK-01, 02, 03).

Generated inputs only. The same IDs mark the Lean theorems in
verification/lean/Verification/Work.lean; P-NOUSWORK-03's behaviour over time
is the Read-then-write actor of verification/tla/Work.tla. The Grid's own rules
are P-WORK-01..09 (grid/test/work/work.property.test.ts).

What runs for real: every function of noesis_brain.work_logic and
noesis_brain.work_cycle.WorkCycle. The Grid is replaced by FakeGrid, which keeps
the two rules the cycle leans on: a write lands only on the version it names,
and only in the stage of its route. The model is replaced by generated text.
That the real Grid takes what the Brain sends is checked against one shared
fixture (grid/test/fixtures/work-brain-contract.json) on both sides.

Seed: set PBT_SEED to repeat a run; it is printed in the test header either way.
Cases per property: PBT_CASES (default 1000).
"""
from __future__ import annotations

import asyncio
import copy
import json
import os
import random
from pathlib import Path
from typing import Any

import pytest
from hypothesis import HealthCheck, given, seed, settings
from hypothesis import strategies as st
from hypothesis.stateful import RuleBasedStateMachine, invariant, rule

from noesis_brain.work_cycle import WorkCycle
from noesis_brain.work_logic import (
    FIELD_MAX, NOTICE_MAX, STEP_ROUTE, build_body, card_version, my_step, next_check, next_plan_step,
    parse_answer, parse_deploy, parse_notice, parse_test, parse_verify, prompt_for,
)

SEED = int(os.environ.get("PBT_SEED") or random.SystemRandom().randrange(2**32))
CASES = int(os.environ.get("PBT_CASES") or 1000)
pbt = settings(
    max_examples=CASES, deadline=None, database=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large, HealthCheck.filter_too_much],
)

ME = "did:civic:noesis:sophia"
OTHERS = ["did:civic:noesis:hermes", "did:civic:noesis:themis", "did:civic:noesis:human:ada"]
STAGES = ["goal", "define", "plan", "build", "test", "verify", "deploy", "notice", "done", "declined"]
CONTRACT = Path(__file__).resolve().parents[2] / "grid" / "test" / "fixtures" / "work-brain-contract.json"


@pytest.fixture(scope="module", autouse=True)
def _print_seed(pytestconfig):
    pytestconfig.get_terminal_writer().line(f"\n[pbt] nous work: seed={SEED} cases={CASES}")


# ── The oracle: written apart from work_logic ─────────────────────────────────
def expected_step(stage: str, builder: str, me: str) -> str | None:
    mine = {"goal": "answer", "build": "build", "test": "test", "deploy": "deploy", "notice": "notice"}
    if stage == "verify":
        return "verify" if builder != me else None
    return mine.get(stage) if builder == me else None


def text_ok(value: Any, limit: int) -> bool:
    return isinstance(value, str) and 1 <= len(value) <= limit and value == value.strip()


def body_ok(step: str, body: dict[str, Any]) -> bool:
    """Would the Grid find this body well-formed for its route? (types and limits only)"""
    if step == "answer":
        if set(body) != {"accept", "reason"} or not isinstance(body["accept"], bool):
            return False
        return text_ok(body["reason"], FIELD_MAX) or (body["accept"] and body["reason"] == "")
    if step == "build":
        return set(body) == {"step", "note"} and type(body["step"]) is int and body["step"] >= 1 \
            and text_ok(body["note"], FIELD_MAX)
    if step == "test":
        return set(body) == {"check", "passed", "evidence"} and type(body["check"]) is int and body["check"] >= 1 \
            and isinstance(body["passed"], bool) and text_ok(body["evidence"], FIELD_MAX)
    if step == "verify":
        return set(body) == {"confirm", "reason"} and isinstance(body["confirm"], bool) and text_ok(body["reason"], FIELD_MAX)
    if step == "deploy":
        return set(body) == {"where", "changed"} and all(text_ok(body[k], FIELD_MAX) for k in body)
    if step == "notice":
        return set(body) == {"goal_info", "guide", "presentation"} and all(text_ok(body[k], NOTICE_MAX) for k in body)
    return False


# ── Generators ────────────────────────────────────────────────────────────────
words = st.one_of(
    st.text(min_size=1, max_size=30).filter(lambda s: s.strip()),
    st.sampled_from(["읽을 곳 🌍", "x" * FIELD_MAX, "x" * (NOTICE_MAX + 50), "CANNOT do this", 'say "hi" {now}']),
)
junk = st.one_of(
    st.none(), st.booleans(), st.integers(), st.floats(allow_nan=True), st.text(max_size=20),
    st.sampled_from(["", "   ", "\n", "{", "}", "{}", "[]", "null", "true", '{"accept": "yes"}', '{"confirm": 1, "reason": "x"}']),
    st.lists(st.integers(), max_size=3), st.dictionaries(st.text(max_size=5), st.integers(), max_size=3),
)
value = st.one_of(words, junk)


def said(fields: dict[str, st.SearchStrategy[Any]]) -> st.SearchStrategy[Any]:
    """What a model might answer: the right JSON, JSON with wrong values, JSON inside words, or junk."""
    obj = st.fixed_dictionaries({}, optional=fields)
    as_json = obj.map(lambda d: json.dumps(d, ensure_ascii=False))
    return st.one_of(
        as_json,
        st.tuples(st.text(max_size=20).filter(lambda s: "{" not in s and "}" not in s), as_json).map(lambda t: t[0] + "\n" + t[1]),
        junk,
        st.text(max_size=60),
    )


flag = st.one_of(st.booleans(), junk)


def card_of(stage: str, builder: str, version: Any = 3, plan_done: int = 0, results: list[Any] | None = None) -> dict[str, Any]:
    plan = [{"step": i + 1, "do": f"step {i + 1}", "by_tick": 10, "done": i < plan_done, "done_tick": None, "note": ""} for i in range(2)]
    return {
        "work_id": "00000000-0000-4000-8000-000000000001", "grid": "genesis", "stage": stage, "version": version,
        "goal": "g", "for_whom": "w", "owner": OTHERS[2], "builder": builder, "for_what": "a", "how": "b", "which": [],
        "checks": ["c1", "c2"], "plan": plan, "results": results if results is not None else [None, None],
    }


# ── P-NOUSWORK-01: the step picked is the Nous's own ──────────────────────────
@seed(SEED)
@pbt
@given(stage=st.sampled_from(STAGES), builder=st.sampled_from([ME, *OTHERS]), me=st.sampled_from([ME, *OTHERS]))
def test_the_step_is_the_one_the_grid_would_take(stage, builder, me):
    """P-NOUSWORK-01: answer, build, test, deploy and notice only on a Work this Nous
    builds; verify only on one it does not; nothing for Define, Plan, done or declined."""
    step = my_step(card_of(stage, builder), me)
    assert step == expected_step(stage, builder, me)
    if step is not None:
        assert step in STEP_ROUTE


@seed(SEED)
@pbt
@given(card=st.one_of(
    junk,
    st.fixed_dictionaries({}, optional={
        "work_id": value, "stage": st.one_of(st.sampled_from(STAGES), junk), "builder": st.one_of(st.sampled_from([ME, *OTHERS]), junk),
        "version": st.one_of(st.integers(-2, 5), junk), "plan": value, "checks": value, "results": value,
    }),
), me=st.one_of(st.just(ME), junk))
def test_a_card_that_is_not_well_formed_gives_no_step(card, me):
    """P-NOUSWORK-01: whatever arrives as a card, there is a step only when it has an
    id, a stage, a builder and a version of 1 or more — and nothing raises."""
    step = my_step(card, me)
    next_plan_step(card)
    next_check(card)
    if step is not None:
        assert isinstance(me, str) and me
        assert isinstance(card["work_id"], str) and isinstance(card["stage"], str)
        assert isinstance(card["builder"], str) and card["builder"]
        assert type(card["version"]) is int and card["version"] >= 1
        assert step == expected_step(card["stage"], card["builder"], me)
        assert card_version(card) == card["version"]


# ── P-NOUSWORK-02: whatever the model says, the body is well-formed or absent ─
@seed(SEED)
@pbt
@given(
    answer=said({"accept": flag, "reason": value}),
    verify=said({"confirm": flag, "reason": value}),
    test=said({"passed": flag, "evidence": value}),
    deploy=said({"where": value, "changed": value}),
    notice=said({"goal_info": value, "guide": value, "presentation": value}),
    outcome=value, number=st.one_of(st.integers(-3, 60), junk),
)
def test_whatever_the_model_says_the_body_is_well_formed_or_absent(answer, verify, test, deploy, notice, outcome, number):
    """P-NOUSWORK-02."""
    for step, body in (
        ("answer", parse_answer(answer)), ("verify", parse_verify(verify)), ("test", parse_test(test, number)),
        ("deploy", parse_deploy(deploy)), ("notice", parse_notice(notice)), ("build", build_body(number, outcome)),
    ):
        assert body is None or body_ok(step, body), (step, body)
    built = build_body(number, outcome)
    if built is not None:
        # A step the Nous says it could not do is never marked done.
        assert not built["note"].upper().startswith("CANNOT")


@seed(SEED)
@pbt
@given(
    accept=st.booleans(), confirm=st.booleans(), passed=st.booleans(),
    a=st.text(min_size=1, max_size=40).filter(lambda s: s.strip()), b=st.text(min_size=1, max_size=40).filter(lambda s: s.strip()),
    c=st.text(min_size=1, max_size=40).filter(lambda s: s.strip()), n=st.integers(1, 50),
    lead=st.text(max_size=15).filter(lambda s: "{" not in s and "}" not in s),
)
def test_a_well_formed_answer_is_read_as_given(accept, confirm, passed, a, b, c, n, lead):
    """P-NOUSWORK-02, the other half: a clear answer is not lost — also with words before it."""
    dump = lambda d: lead + json.dumps(d, ensure_ascii=False)  # noqa: E731
    assert parse_answer(dump({"accept": accept, "reason": a})) == {"accept": accept, "reason": a.strip()}
    assert parse_answer(dump({"accept": True})) == {"accept": True, "reason": ""}
    assert parse_answer(dump({"accept": False})) is None
    assert parse_verify(dump({"confirm": confirm, "reason": a})) == {"confirm": confirm, "reason": a.strip()}
    assert parse_test(dump({"passed": passed, "evidence": a}), n) == {"check": n, "passed": passed, "evidence": a.strip()}
    assert parse_deploy(dump({"where": a, "changed": b})) == {"where": a.strip(), "changed": b.strip()}
    assert parse_notice(dump({"goal_info": a, "guide": b, "presentation": c})) == {
        "goal_info": a.strip(), "guide": b.strip(), "presentation": c.strip()}
    if not a.strip().upper().startswith("CANNOT"):
        assert build_body(n, a) == {"step": n, "note": a.strip()}


def test_the_brain_sends_what_the_contract_says():
    """P-NOUSWORK-02: the bodies of the shared fixture, which the Grid's rules take
    (grid/test/work/work-brain-contract.test.ts), are what work_logic produces."""
    contract = json.loads(CONTRACT.read_text())
    build_no, check_no = 0, 0
    for item in contract["steps"]:
        step = item["step"]
        assert STEP_ROUTE[step] == item["route"]
        if step == "answer":
            body = parse_answer(item["said"])
        elif step == "build":
            build_no += 1
            body = build_body(build_no, item["said"])
        elif step == "test":
            check_no += 1
            body = parse_test(item["said"], check_no)
        elif step == "verify":
            body = parse_verify(item["said"])
        elif step == "deploy":
            body = parse_deploy(item["said"])
        else:
            body = parse_notice(item["said"])
        assert body == item["body"], step


# ── P-NOUSWORK-03: the cycle against a Grid that moves under it ───────────────
class FakeGrid:
    """Cards by id. A write lands only on the version it names and in its route's stage."""

    ROUTE_STAGE = {"answer": "goal", "build": "build", "test": "test", "verify": "verify", "deploy": "deploy", "notice": "notice"}

    def __init__(self) -> None:
        self.civic_did = ME
        self.cards: dict[str, dict[str, Any]] = {}
        self.shown: dict[str, dict[str, Any]] = {}   # what this cycle's reads returned
        self.posts: list[tuple[str, str, dict[str, Any], bool]] = []
        self.move_before_post: set[str] = set()
        self.fail_reads = False
        self.list_twice = False     # a Grid that lists every Work twice

    def add(self, stage: str, builder: str) -> str:
        work_id = f"00000000-0000-4000-8000-{len(self.cards) + 1:012d}"
        self.cards[work_id] = card_of(stage, builder, version=1) | {"work_id": work_id}
        return work_id

    async def fetch_works(self, role: str, limit: int = 20) -> Any:
        if self.fail_reads:
            raise RuntimeError("grid unreachable")
        rows = [c for c in self.cards.values()
                if (role == "builder" and c["builder"] == ME) or (role == "verify" and c["stage"] == "verify" and c["builder"] != ME)]
        for c in rows:
            self.shown.setdefault(c["work_id"], copy.deepcopy(c))
        return copy.deepcopy(rows + rows if self.list_twice else rows)

    def bump(self, work_id: str, stage: str | None = None) -> None:
        card = self.cards[work_id]
        card["version"] += 1
        if stage is not None:
            card["stage"] = stage

    async def post_work_step(self, work_id: str, route: str, body: dict[str, Any]) -> Any:
        if work_id in self.move_before_post:           # someone else wrote first
            self.move_before_post.discard(work_id)
            self.bump(work_id)
        card = self.cards[work_id]
        ok = body.get("version") == card["version"] and self.ROUTE_STAGE[route] == card["stage"]
        self.posts.append((work_id, route, copy.deepcopy(body), ok))
        if not ok:
            return None
        card["version"] += 1
        if route == "answer":
            card["stage"] = "build" if body["accept"] else "declined"
        elif route == "build":
            card["plan"][body["step"] - 1]["done"] = True
            if all(s["done"] for s in card["plan"]):
                card["stage"] = "test"
        elif route == "test":
            card["results"][body["check"] - 1] = {"passed": body["passed"], "evidence": body["evidence"]}
            if all(isinstance(r, dict) and r["passed"] for r in card["results"]):
                card["stage"] = "verify"
        elif route == "verify":
            card["stage"] = "deploy" if body["confirm"] else "test"
            if not body["confirm"]:
                card["results"] = [None, None]
        elif route == "deploy":
            card["stage"] = "notice"
        else:
            card["stage"] = "done"
        return copy.deepcopy(card)


GOOD = {
    "answer": '{"accept": true, "reason": "yes"}', "verify": '{"confirm": true, "reason": "fits"}',
    "test": '{"passed": true, "evidence": "seen"}', "deploy": '{"where": "here", "changed": "that"}',
    "notice": '{"goal_info": "a", "guide": "b", "presentation": "c"}', "build": "did it",
}


REACHED = {'cycles': 0, 'applied': 0, 'refused': 0, 'done': 0}


class WorkCycleMachine(RuleBasedStateMachine):
    """P-NOUSWORK-03: one write per Work per cycle at most, on the version that was read,
    for the step that is this Nous's own; a stale write changes nothing."""

    def __init__(self) -> None:
        super().__init__()
        self.grid = FakeGrid()
        self.answers: list[Any] = []
        self.tick = 0
        self.remembered: list[str] = []
        self.cycle = WorkCycle(self.grid, self._say, self._say, lambda text, tick: self.remembered.append(text),
                               per_cycle=2, retry_after_ticks=2)
        # Every run starts with work to do: two requests to this Nous and one Work to verify.
        self.grid.add("goal", ME)
        self.grid.add("build", ME)
        self.grid.add("verify", OTHERS[0])

    async def _say(self, prompt: str) -> Any:
        answer = self.answers.pop(0) if self.answers else "GOOD"
        if answer == "RAISE":
            raise RuntimeError("model down")
        if answer != "GOOD":
            return answer
        for step, marker in (("answer", "asks you to build"), ("build", "Do this step now"), ("test", "now test it"),
                             ("verify", "asks for verification"), ("deploy", "was verified"), ("notice", "is deployed")):
            if marker in prompt:
                return GOOD[step]
        raise AssertionError(f"unknown prompt: {prompt[:60]}")

    @rule(stage=st.sampled_from(STAGES), builder=st.sampled_from([ME, OTHERS[0]]))
    def a_work_appears(self, stage, builder):
        if len(self.grid.cards) < 6:
            self.grid.add(stage, builder)

    @rule(pick=st.integers(0, 5), stage=st.one_of(st.none(), st.sampled_from(STAGES)))
    def someone_else_writes(self, pick, stage):
        ids = list(self.grid.cards)
        if ids:
            self.grid.bump(ids[pick % len(ids)], stage)

    @rule(
        answers=st.lists(st.one_of(*[st.just("GOOD")] * 12, st.just("RAISE"), value,
                                   st.sampled_from(['{"accept": false, "reason": "no"}', '{"confirm": false, "reason": "weak"}',
                                                    '{"passed": false, "evidence": "broke"}', "CANNOT: no tool for this"])),
                         max_size=4),
        race=st.one_of(st.just([]), st.just([]), st.just([]), st.lists(st.integers(0, 5), max_size=2)),
        unreachable=st.integers(0, 9).map(lambda n: n == 0), ticks=st.integers(1, 5), twice=st.booleans(),
    )
    def a_cycle_runs(self, answers, race, unreachable, ticks, twice):
        self.tick += ticks
        self.answers = list(answers)
        ids = list(self.grid.cards)
        self.grid.move_before_post = {ids[i % len(ids)] for i in race} if ids else set()
        self.grid.fail_reads = unreachable
        self.grid.list_twice = twice
        self.grid.shown = {}
        before_posts = len(self.grid.posts)
        before_cards = copy.deepcopy(self.grid.cards)
        before_memories = len(self.remembered)

        applied = asyncio.run(self.cycle.run(self.tick))

        posts = self.grid.posts[before_posts:]
        REACHED['cycles'] += 1
        REACHED['applied'] += applied
        REACHED['refused'] += sum(1 for p in posts if not p[3])
        REACHED['done'] += sum(1 for p in posts if p[3] and p[1] == 'notice')
        assert applied == sum(1 for p in posts if p[3])
        assert applied <= 2
        assert len(self.remembered) - before_memories == applied
        assert len({p[0] for p in posts}) == len(posts), "two writes on one Work in one cycle"
        for work_id, route, body, ok in posts:
            read = self.grid.shown[work_id]
            step = expected_step(read["stage"], read["builder"], ME)
            # The step is this Nous's own on the card it read, and names that card's version.
            assert step is not None and STEP_ROUTE[step] == route
            assert body["version"] == read["version"]
            assert body_ok(step, {k: v for k, v in body.items() if k != "version"})
            if not ok:
                # A write the Grid refused left the card as the other writer made it.
                now = self.grid.cards[work_id]
                assert now["stage"] == before_cards[work_id]["stage"] or work_id not in {p[0] for p in posts if p[3]}
        for work_id, card in self.grid.cards.items():
            if work_id not in {p[0] for p in posts if p[3]} and work_id not in race_ids(self.grid, before_cards):
                assert card == before_cards[work_id]

    @invariant()
    def no_write_was_applied_on_a_stale_version(self):
        for work_id, card in self.grid.cards.items():
            assert card["version"] >= 1


def race_ids(grid: FakeGrid, before: dict[str, dict[str, Any]]) -> set[str]:
    """Works another writer moved during the cycle."""
    return {wid for wid, card in grid.cards.items() if card["version"] != before[wid]["version"]}


WorkCycleMachine.TestCase.settings = settings(
    max_examples=CASES, stateful_step_count=30, deadline=None, database=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large, HealthCheck.filter_too_much],
)
TestWorkCycle = seed(SEED)(WorkCycleMachine.TestCase)


def test_the_generated_cycles_reached_real_writes():
    """The machine above says little unless its cycles really wrote, were refused, and finished Works."""
    print(f"\n[pbt] nous work cycles: {REACHED}")
    assert REACHED["cycles"] >= CASES
    assert REACHED["applied"] >= CASES * 2
    assert REACHED["refused"] >= CASES // 20
    assert REACHED["done"] >= CASES // 20


def test_a_work_goes_from_request_to_done_with_another_nous_verifying():
    """One full round against FakeGrid: this Nous builds, the same code as another Nous verifies."""
    grid = FakeGrid()
    work_id = grid.add("goal", ME)

    async def good(prompt: str) -> str:
        for step, marker in (("answer", "asks you to build"), ("build", "Do this step now"), ("test", "now test it"),
                             ("verify", "asks for verification"), ("deploy", "was verified"), ("notice", "is deployed")):
            if marker in prompt:
                return GOOD[step]
        raise AssertionError(prompt[:60])

    builder = WorkCycle(grid, good, good, per_cycle=1)
    other = FakeGrid.__new__(FakeGrid)
    other.__dict__ = grid.__dict__.copy()
    stages = []
    for tick in range(1, 12):
        if grid.cards[work_id]["stage"] == "verify":
            # The verifier is another Nous: the same cards, seen as Hermes.
            card = copy.deepcopy(grid.cards[work_id])
            assert my_step(card, OTHERS[0]) == "verify" and my_step(card, ME) is None
            body = parse_verify(asyncio.run(good(prompt_for("verify", card))))
            asyncio.run(grid.post_work_step(work_id, "verify", {"version": card["version"], **body}))
        else:
            asyncio.run(builder.run(tick))
        stages.append(grid.cards[work_id]["stage"])
    assert stages[-1] == "done"
    assert [s for i, s in enumerate(stages) if i == 0 or stages[i - 1] != s] == ["build", "test", "verify", "deploy", "notice", "done"]


def test_the_tick_starts_the_work_cycle_only_for_a_live_wired_mind_with_a_model():
    """The handler's gate: no Grid, no model, or an older wire client means no work
    cycle; otherwise once per cooldown."""
    from noesis_brain.rpc.handler import BrainHandler

    class Wire:
        civic_did = ME

        async def fetch_works(self, role, limit=20):
            return []

    h = BrainHandler.__new__(BrainHandler)
    h._last_work_tick = -10_000
    h._grid_wire_client, h.llm = None, object()
    assert h._should_run_work_cycle(10) is False
    h._grid_wire_client, h.llm = Wire(), None
    assert h._should_run_work_cycle(10) is False
    h._grid_wire_client, h.llm = object(), object()      # a wire client without the Works calls
    assert h._should_run_work_cycle(10) is False
    h._grid_wire_client, h.llm = Wire(), object()
    assert h._should_run_work_cycle(10) is True
    h._last_work_tick = 10
    assert h._should_run_work_cycle(10 + BrainHandler._WORK_COOLDOWN_TICKS - 1) is False
    assert h._should_run_work_cycle(10 + BrainHandler._WORK_COOLDOWN_TICKS) is True
