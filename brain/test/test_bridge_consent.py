"""Consent gate — off-by-default + per-capability grants (Phase 76)."""

from __future__ import annotations

from noesis_brain.bridge import BridgeCapability, ConsentGate


def test_empty_config_denies_everything() -> None:
    gate = ConsentGate({})
    assert gate.enabled is False
    for cap in BridgeCapability:
        assert gate.allows(cap) is False


def test_none_config_denies_everything() -> None:
    gate = ConsentGate(None)
    assert gate.allows(BridgeCapability.NOTEBOOK) is False


def test_enabled_but_no_grants_denies() -> None:
    gate = ConsentGate({"enabled": True, "grants": []})
    assert gate.allows(BridgeCapability.SIM_USE) is False


def test_grant_requires_enabled() -> None:
    # A grant with the master switch off is still denied.
    gate = ConsentGate({"enabled": False, "grants": ["notebook"]})
    assert gate.allows(BridgeCapability.NOTEBOOK) is False


def test_per_capability_grant() -> None:
    gate = ConsentGate({"enabled": True, "grants": ["notebook", "supervision"]})
    assert gate.allows(BridgeCapability.NOTEBOOK) is True
    assert gate.allows(BridgeCapability.SUPERVISION) is True
    assert gate.allows(BridgeCapability.SIM_USE) is False


def test_unknown_grant_ignored() -> None:
    gate = ConsentGate({"enabled": True, "grants": ["notebook", "hack_the_planet"]})
    assert gate.allows(BridgeCapability.NOTEBOOK) is True
    assert "hack_the_planet" not in gate.grants


def test_allows_accepts_string_or_enum() -> None:
    gate = ConsentGate({"enabled": True, "grants": ["sim_use"]})
    assert gate.allows("sim_use") is True
    assert gate.allows(BridgeCapability.SIM_USE) is True


def test_sim_use_live_defaults_false() -> None:
    gate = ConsentGate({"enabled": True, "grants": ["sim_use"]})
    assert gate.sim_use_live is False
    armed = ConsentGate({"enabled": True, "grants": ["sim_use"], "sim_use_live": True})
    assert armed.sim_use_live is True


def test_notebook_dir_expanded() -> None:
    gate = ConsentGate({"enabled": True, "grants": ["notebook"], "notebook_dir": "~/nb"})
    assert gate.notebook_dir is not None
    assert "~" not in str(gate.notebook_dir)
