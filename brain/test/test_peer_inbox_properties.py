"""Property tests for the Brain's peer inbox (P-DM-01, P-DM-02, P-DM-04, P-DM-06, P-DM-09).

Generated inputs only. The same IDs mark the TLA+ invariants in
verification/tla/PeerMessages.tla and the Lean theorems in
verification/lean/Verification/PeerMessages.lean. The Grid side of the same
properties (and P-DM-03, P-DM-05, which are the Grid's alone) runs in
grid/test/integration/peer-messages.property.test.ts.

What runs for real: peer_inbox.parse_peer_message, peer_inbox.parse_system_notice,
BrainHandler._run_peer_inbox_cycle and BrainHandler.on_message. The Grid's inbox is replaced by FakeGrid, which keeps the
rule "a row is claimed once, and only by the Nous it is addressed to".

Seed: set PBT_SEED to repeat a run; it is printed in the test header either way.
Cases per property: PBT_CASES (default 1000).
"""
from __future__ import annotations

import asyncio
import os
import random
from typing import Any

import pytest
from hypothesis import HealthCheck, given, seed, settings
from hypothesis import strategies as st
from hypothesis.stateful import RuleBasedStateMachine, invariant, rule

from noesis_brain.peer_inbox import (
    PEER_MESSAGE_MAX_CHARS, SYSTEM_NOTICE_MAX_CHARS, message_id, parse_peer_message, parse_system_notice,
)

from test.peer_inbox_support import FakeGrid, make_handler

SEED = int(os.environ.get("PBT_SEED") or random.SystemRandom().randrange(2**32))
CASES = int(os.environ.get("PBT_CASES") or 1000)

pbt = settings(
    max_examples=CASES, deadline=None, database=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large],
)


@pytest.fixture(scope="module", autouse=True)
def _print_seed(pytestconfig):
    pytestconfig.get_terminal_writer().line(f"\n[pbt] peer inbox: seed={SEED} cases={CASES}")


NOUS = ["did:noesis:a", "did:noesis:b", "did:noesis:c"]


# ── generators ───────────────────────────────────────────────────────────────
@st.composite
def _mostly(draw, good, bad, n: int = 4):
    """`good` n times in n+1 — hostile values stay present without drowning the valid ones."""
    return draw(good) if draw(st.integers(0, n)) else draw(bad)


junk = st.one_of(
    st.none(), st.integers(), st.booleans(), st.floats(allow_nan=True), st.text(max_size=6),
    st.lists(st.integers(), max_size=2), st.dictionaries(st.text(max_size=3), st.integers(), max_size=2),
)
# Texts: one character, the limit, one over it, unicode, the Brain's own payload
# prefixes with good and broken payloads, free text; the empty string is in `junk`.
texts = st.one_of(
    st.text(min_size=1, max_size=40),
    st.sampled_from([
        "x", "x" * PEER_MESSAGE_MAX_CHARS, "x" * (PEER_MESSAGE_MAX_CHARS + 1), "안녕 🌍",
        '__skill_share:{"name": "s", "description": "d", "instructions": "do", "triggers": []}',
        "__skill_share:{not json", "__skill_share:[1, 2]", "__lore_response:ab:aGk=", "__lore_response:zz",
        "__lore_response:ab:%%%", "__lore_request:ab", "__lore_request:",
    ]),
)
dids = _mostly(st.sampled_from(NOUS), st.one_of(st.text(max_size=12), junk))
kinds = _mostly(st.just("direct_message"), st.one_of(st.sampled_from(["absent_escalation_notice", "note", "DIRECT_MESSAGE"]), junk))
bodies = _mostly(
    st.fixed_dictionaries(
        {"kind": kinds, "sender_did": dids, "text": _mostly(texts, junk, 6)},
        optional={"sender_name": _mostly(st.text(max_size=8), junk), "channel": _mostly(st.just("direct"), junk), "tick": st.integers()},
    ),
    junk, 8,
)
ids = _mostly(st.integers(1, 50), st.one_of(st.sampled_from([0, -1, True, False, 1.0, "7", None]), junk), 6)
SYSTEM = "did:civic:noesis:system"
PEER_SENDER = "did:civic:noesis:x"
# What the Grid itself writes (escalation-check.ts): a kind and a `message` string.
# Hostile variants: no message, an empty one, junk, and one that is also shaped like a direct message.
notice_bodies = _mostly(
    st.fixed_dictionaries(
        {"kind": _mostly(st.sampled_from(["absent_escalation_notice", "direct_message"]), junk), "message": _mostly(texts, junk, 6)},
        optional={"escalated_at_tick": st.integers(), "sender_did": dids, "text": _mostly(texts, junk, 6)},
    ),
    junk, 8,
)
senders = st.one_of(st.just(SYSTEM), st.just(PEER_SENDER), st.sampled_from(["did:civic:noesis:System", SYSTEM + " ", ""]), junk)
rows = _mostly(
    st.fixed_dictionaries({"message": st.one_of(bodies, notice_bodies)}, optional={"id": ids, "sender_civic_did": senders}),
    junk, 8,
)


def is_notice(body: Any, sender: Any) -> bool:
    """Written out apart from the code under test: a notice from the Grid itself."""
    return (
        type(sender) is str and sender == SYSTEM
        and type(body) is dict and type(body.get("message")) is str and body["message"] != ""
    )


def well_formed(body: Any, to: str) -> bool:
    """Written out apart from the code under test: a direct message from another Nous."""
    if type(body) is not dict or body.get("kind") != "direct_message":
        return False
    text, sender = body.get("text"), body.get("sender_did")
    return (
        type(text) is str and 1 <= len(text) <= PEER_MESSAGE_MAX_CHARS
        and type(sender) is str and sender != "" and sender != to
    )


def good_id(row: Any) -> bool:
    return type(row) is dict and type(row.get("id")) is int and row["id"] > 0


# ── the parser ───────────────────────────────────────────────────────────────
@seed(SEED)
@pbt
@given(row=rows, me=st.sampled_from(NOUS))
def test_p_dm_04_only_a_well_formed_direct_message_from_another_nous_is_accepted(row, me):
    """P-DM-04 (Brain side): whatever the inbox holds, parse returns a message only for a
    well-formed direct-message envelope from another Nous, and returns it unchanged."""
    parsed = parse_peer_message(row, me)
    expected = good_id(row) and well_formed(row.get("message"), me)
    assert (parsed is not None) == expected
    assert (message_id(row) is not None) == good_id(row)
    if parsed is not None:
        body = row["message"]
        assert parsed.message_id == row["id"]
        assert parsed.text == body["text"] and parsed.sender_did == body["sender_did"]
        assert parsed.sender_did != me
        assert isinstance(parsed.sender_name, str) and parsed.sender_name
        assert isinstance(parsed.channel, str) and parsed.channel


@seed(SEED)
@pbt
@given(row=rows)
def test_p_dm_09_only_a_row_from_the_grid_itself_with_a_text_is_a_notice(row):
    """P-DM-09 (Brain side): a row is a system notice only if the Grid's system sender
    wrote it and it carries a text; the text is kept, cut to the memory limit."""
    notice = parse_system_notice(row)
    expected = good_id(row) and is_notice(row.get("message"), row.get("sender_civic_did"))
    assert (notice is not None) == expected
    if notice is not None:
        assert notice.message_id == row["id"]
        assert notice.text == row["message"]["message"][:SYSTEM_NOTICE_MAX_CHARS]
        assert isinstance(notice.kind, str) and notice.kind


# ── over time ────────────────────────────────────────────────────────────────
# Brain processes: one per Nous, and a second one for the first Nous.
PROC_OWNER = [0, 1, 2, 0]
HANDLERS = [make_handler(NOUS[o]) for o in PROC_OWNER]


class PeerInboxMachine(RuleBasedStateMachine):
    """Random sequences of the TLA+ actions seen from the Brain: messages arrive
    (Send, already through the Grid's checks or not), Brains run their inbox cycle
    (Poll + Claim), sometimes on a stale or foreign snapshot, sometimes with the
    claim refused or its answer lost (Crash: the message is claimed and never handled).
    The Grid itself also writes notices into the same inboxes (Notify)."""

    def __init__(self) -> None:
        super().__init__()
        self.loop = asyncio.new_event_loop()
        self.grid = FakeGrid()
        self.wires = [self.grid.wire(NOUS[o]) for o in PROC_OWNER]
        self.sent: dict[int, tuple[str, Any]] = {}       # id → (to, body as sent), rows a Nous sent
        self.notices: dict[int, tuple[str, Any]] = {}    # id → (to, body as sent), rows the Grid sent
        self.handed: list[tuple[int, int]] = []          # (process, id) per on_message call
        self.remembered: list[tuple[int, int]] = []      # (process, id) per notice written to memory
        self.lost: set[int] = set()                      # claimed, answer lost
        self.snapshots: list[list[Any]] = []
        self.tick = 0
        self._n = 0
        for p, h in enumerate(HANDLERS):
            h._grid_wire_client = self.wires[p]
            h.on_message = self._spy(p, type(h).on_message.__get__(h))
            h.memory.record_event = self._memory_spy(p)

    def _memory_spy(self, p: int):
        def record_event(content: str = "", **_: Any) -> None:
            # Every generated notice text starts with "<id>#".
            if content.startswith("The Grid sent me a notice"):
                self.remembered.append((p, int(content.split('): "', 1)[1].split("#", 1)[0])))
        return record_event

    def _spy(self, p: int, inner):
        async def spy(params: dict[str, Any]):
            # Every generated text ends in "#<id>", so a call names its message.
            self.handed.append((p, int(str(params["text"]).rsplit("#", 1)[1])))
            return await inner(params)
        return spy

    def teardown(self) -> None:
        # P-DM-06: once every Brain keeps running its cycle, every message that is a
        # direct message from another Nous, and was not lost to a crash, has been handed over.
        for p in range(len(NOUS)):
            for _ in range(200):
                if not self.grid.pending(NOUS[PROC_OWNER[p]]):
                    break
                self._cycle(p)
        self.check()
        handed_ids = {mid for _, mid in self.handed}
        for mid, (to, body) in self.sent.items():
            assert (mid in handed_ids) == (well_formed(body, to) and mid not in self.lost)
        # P-DM-09: every notice with a text was written to memory, unless its claim was lost to a crash.
        remembered_ids = {mid for _, mid in self.remembered}
        for mid, (to, body) in self.notices.items():
            if is_notice(body, SYSTEM):
                assert (mid in remembered_ids) == (mid not in self.lost), f"P-DM-09: notice {mid} dropped unread"
            else:
                assert (mid in handed_ids) == (well_formed(body, to) and mid not in self.lost)
        assert all(r["state"] == "delivered" for r in self.grid.rows)
        self.loop.close()

    def _cycle(self, p: int) -> None:
        self.tick += 1
        self.loop.run_until_complete(HANDLERS[p]._run_peer_inbox_cycle(self.tick))

    @rule(to=st.integers(0, len(NOUS) - 1), body=bodies)
    def send(self, to, body):
        mid = self.grid._next_id
        if type(body) is dict and type(body.get("text")) is str and body["text"]:
            body = {**body, "text": body["text"][: PEER_MESSAGE_MAX_CHARS - 8] + f"#{mid}"}
        self.grid.enqueue(NOUS[to], body)
        self.sent[mid] = (NOUS[to], body if type(body) is not dict else dict(body))

    @rule(to=st.integers(0, len(NOUS) - 1), body=notice_bodies)
    def notify(self, to, body):
        """The Grid itself writes a row into a Nous's inbox."""
        mid = self.grid._next_id
        if type(body) is dict and type(body.get("message")) is str and body["message"]:
            body = {**body, "message": f"{mid}#" + body["message"][: PEER_MESSAGE_MAX_CHARS]}
        if type(body) is dict and type(body.get("text")) is str and body["text"]:
            body = {**body, "text": body["text"][: PEER_MESSAGE_MAX_CHARS - 8] + f"#{mid}"}
        self.grid.enqueue(NOUS[to], body, sender=SYSTEM)
        self.notices[mid] = (NOUS[to], body if type(body) is not dict else dict(body))

    @rule(p=st.integers(0, len(PROC_OWNER) - 1))
    def cycle(self, p):
        self._cycle(p)

    @rule(p=st.integers(0, len(PROC_OWNER) - 1))
    def snapshot(self, p):
        """A read whose answer is used later (two cycles in flight, a slow network)."""
        self.snapshots.append(self.grid.pending(NOUS[PROC_OWNER[p]]))

    @rule(p=st.integers(0, len(PROC_OWNER) - 1), pick=st.integers(0, 30), extra=st.lists(rows, max_size=3))
    def cycle_on_stale_or_foreign_read(self, p, pick, extra):
        """The read returns an old answer — possibly another Nous's — plus junk rows."""
        old = self.snapshots[pick % len(self.snapshots)] if self.snapshots else []
        # Junk rows get ids no real message has: a read that pairs a real id with
        # an invented body would be a lying Grid, which is outside these properties.
        extra = [
            {**r, "id": r["id"] + 10_000} if good_id(r) else r
            for r in extra
        ]
        self.wires[p].fetch_override = [*old, *extra]
        self._cycle(p)

    @rule(p=st.integers(0, len(PROC_OWNER) - 1), mode=st.sampled_from(["refuse", "lost"]))
    def cycle_with_failing_claim(self, p, mode):
        before = {r["id"] for r in self.grid.rows if r["state"] == "pending"}
        self.wires[p].claim_mode = mode
        try:
            self._cycle(p)
        finally:
            self.wires[p].claim_mode = "ok"
        self.lost |= before - {r["id"] for r in self.grid.rows if r["state"] == "pending"}

    @invariant()
    def check(self):
        seen: set[int] = set()
        for p, mid in self.handed:
            assert mid not in seen, f"P-DM-01: message {mid} handed twice"
            seen.add(mid)
            to, body = self.sent[mid] if mid in self.sent else self.notices[mid]
            assert NOUS[PROC_OWNER[p]] == to, f"P-DM-02: message {mid} for {to} handed to process {p}"
            assert well_formed(body, to), f"P-DM-04: message {mid} is not a direct message from another Nous"
            assert mid in self.sent or not is_notice(body, SYSTEM), f"P-DM-09: notice {mid} handed to on_message"
            assert mid not in self.lost
        noted: set[int] = set()
        for p, mid in self.remembered:
            assert mid not in noted, f"P-DM-09: notice {mid} remembered twice"
            noted.add(mid)
            to, body = self.notices[mid]
            assert NOUS[PROC_OWNER[p]] == to, f"P-DM-09: notice {mid} for {to} remembered by process {p}"
            assert is_notice(body, SYSTEM) and mid not in self.lost


PeerInboxMachine.TestCase.settings = settings(
    max_examples=CASES, stateful_step_count=30, deadline=None, database=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.data_too_large, HealthCheck.filter_too_much],
)
test_p_dm_01_02_04_06_09_peer_inbox_over_time = seed(SEED)(PeerInboxMachine.TestCase)
