"""Bridge journal — append-only, digest-only local audit (Phase 76)."""

from __future__ import annotations

from noesis_brain.bridge import BridgeDeed, BridgeJournal


def _deed(cap: str, verb: str, tick: int, ok: bool = True) -> BridgeDeed:
    return BridgeDeed(capability=cap, verb=verb, tick=tick, ok=ok, digest=f"{verb}@{tick}")


def test_record_and_count() -> None:
    j = BridgeJournal()
    j.record(_deed("notebook", "ingest", 1))
    j.record(_deed("sim_use", "click", 2))
    assert j.count() == 2


def test_recent_is_newest_first() -> None:
    j = BridgeJournal()
    for t in range(5):
        j.record(_deed("notebook", "ingest", t))
    recent = j.recent(limit=3)
    assert [d.tick for d in recent] == [4, 3, 2]


def test_count_by_capability() -> None:
    j = BridgeJournal()
    j.record(_deed("notebook", "ingest", 1))
    j.record(_deed("notebook", "ingest", 2))
    j.record(_deed("sim_use", "type_text", 3))
    assert j.count_by_capability() == {"notebook": 2, "sim_use": 1}


def test_persists_to_dir(tmp_path) -> None:
    j = BridgeJournal(db_path=tmp_path, nous_did="did:noesis:sophia")
    j.record(_deed("supervision", "observe", 7))
    # Reopen from the same directory → same derived file, data survives.
    j2 = BridgeJournal(db_path=tmp_path, nous_did="did:noesis:sophia")
    assert j2.count() == 1
    assert (tmp_path / "bridge_did_noesis_sophia.db").exists()


def test_round_trip_fields() -> None:
    j = BridgeJournal()
    j.record(BridgeDeed(capability="sim_use", verb="key", tick=9, ok=False,
                        digest="key", reason="not_allowed"))
    d = j.recent(1)[0]
    assert d.ok is False and d.reason == "not_allowed" and d.verb == "key"
