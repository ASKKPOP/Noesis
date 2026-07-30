"""Bridge registry + builder — only granted providers register (Phase 76)."""

from __future__ import annotations

from noesis_brain.bridge import (
    BridgeCapability,
    BridgeJournal,
    BridgeRegistry,
    ConsentGate,
    build_registry,
)


def test_ungranted_provider_not_registered() -> None:
    reg = build_registry({"enabled": False}, nous_did="did:noesis:x")
    for cap in BridgeCapability:
        assert reg.get(cap) is None
        assert reg.has(cap) is False


def test_granted_notebook_registers_but_unavailable_without_dir() -> None:
    # notebook granted but no notebook_dir → provider registers yet is unavailable.
    reg = build_registry({"enabled": True, "grants": ["notebook"]}, nous_did="did:noesis:x")
    # granted+registered shows in snapshot, but get() returns None (not available).
    snap = reg.snapshot()
    assert snap["capabilities"]["notebook"]["granted"] is True
    assert snap["capabilities"]["notebook"]["registered"] is True
    assert reg.get(BridgeCapability.NOTEBOOK) is None  # no dir → unavailable


def test_granted_sim_use_available() -> None:
    reg = build_registry({"enabled": True, "grants": ["sim_use"]}, nous_did="did:noesis:x")
    # sim-use is always available (dry-run is a legitimate capability).
    assert reg.has(BridgeCapability.SIM_USE) is True


def test_snapshot_shape() -> None:
    reg = build_registry({"enabled": True, "grants": ["sim_use"]}, nous_did="did:noesis:x")
    snap = reg.snapshot()
    assert set(snap["capabilities"]) == {"notebook", "supervision", "sim_use"}
    assert snap["gate"]["enabled"] is True
    assert snap["journal_count"] == 0


def test_record_routes_to_journal() -> None:
    from noesis_brain.bridge import BridgeDeed

    gate = ConsentGate({"enabled": True, "grants": ["sim_use"]})
    reg = BridgeRegistry(gate, BridgeJournal())
    reg.record(BridgeDeed(capability="sim_use", verb="click", tick=1, ok=True))
    assert reg.journal.count() == 1
