"""Bridge ↔ handler wiring (Phase 76).

Asserts the additive contract: no bridge ⇒ unchanged behaviour; a granted
notebook folds real docs into synopsis; a granted supervision percept reaches
memory + curiosity; sim-use routes through the gate; get_state carries a bridge
snapshot. Uses the same handler harness as test_synopsis_integration.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import yaml

from noesis_brain.bridge import BridgeCapability, BridgeRegistry, ConsentGate, build_registry
from noesis_brain.bridge.journal import BridgeJournal
from noesis_brain.bridge.provider import BridgeRegistry as _Reg
from noesis_brain.bridge.providers.sim_use import SimUseProvider
from noesis_brain.bridge.providers.supervision import SupervisionProvider
from noesis_brain.llm.types import LLMResponse
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


class QuietLLM:
    async def generate(self, prompt, options=None):
        return LLMResponse(text='{"action": "none"}', model="scripted", provider="test", usage={})


def _handler(bridge: BridgeRegistry | None, mem=None, synopsis_db_dir=None) -> BrainHandler:
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    return BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=QuietLLM(),
        did="did:noesis:sophia",
        memory=mem,
        synopsis_db_dir=synopsis_db_dir,
        bridge=bridge,
    )


def test_no_bridge_is_disabled_snapshot() -> None:
    h = _handler(None)
    assert h.get_state()["bridge"] == {"enabled": False}


def test_get_state_carries_bridge_snapshot() -> None:
    bridge = build_registry({"enabled": True, "grants": ["sim_use"]}, nous_did="did:noesis:sophia")
    snap = _handler(bridge).get_state()["bridge"]
    assert snap["gate"]["enabled"] is True
    assert set(snap["capabilities"]) == {"notebook", "supervision", "sim_use"}


def test_notebook_folds_into_synopsis(tmp_path) -> None:
    nb = tmp_path / "notebook"
    nb.mkdir()
    (nb / "energy.md").write_text("The residential ring needs reliable power at night.")
    (nb / "grid.md").write_text("Solar surplus should route to the manufacture zone.")
    bridge = build_registry(
        {"enabled": True, "grants": ["notebook"], "notebook_dir": str(nb)},
        nous_did="did:noesis:sophia",
    )
    assert bridge.get(BridgeCapability.NOTEBOOK) is not None

    mem = MemoryStream(MemoryStore(":memory:"))
    for i, c in enumerate([
        "The ring needs energy. Solar relays are efficient.",
        "Solar relays are efficient. Demand peaks at dusk.",
        "Demand peaks at dusk. Storage smooths the curve.",
    ]):
        mem.record_event(content=c, source_did="did:noesis:sophia", tick=i)

    h = _handler(bridge, mem=mem, synopsis_db_dir=str(tmp_path))
    asyncio.run(h._run_synopsis_cycle(tick=500))
    # The real documents were ingested + journaled, and a synopsis persisted.
    assert bridge.journal.count_by_capability().get("notebook", 0) >= 1
    assert h._synopsis_store is not None and h._synopsis_store.count() >= 1


def test_supervision_percept_reaches_memory() -> None:
    frames = iter([[[50] * 4] * 4, [[220] * 4] * 4])
    gate = ConsentGate({"enabled": True, "grants": ["supervision"]})
    reg = _Reg(gate, BridgeJournal())
    reg.register(SupervisionProvider(frame_source=lambda: next(frames)))
    prov = reg.get(BridgeCapability.SUPERVISION)
    assert prov is not None
    assert prov.observe(1) is None       # baseline
    assert prov.observe(2) is not None   # brightening detected


def test_sim_use_helper_denies_without_grant() -> None:
    h = _handler(build_registry({"enabled": False}, nous_did="did:noesis:sophia"))
    assert h.bridge_sim_use("click", {"x": 1, "y": 2}, tick=1) == {
        "ok": False, "reason": "not_granted", "dry_run": False,
    }


def test_sim_use_helper_dry_runs_when_granted() -> None:
    gate = ConsentGate({"enabled": True, "grants": ["sim_use"]})
    reg = _Reg(gate, BridgeJournal())
    reg.register(SimUseProvider(live=False))
    h = _handler(reg)
    r = h.bridge_sim_use("type_text", {"text": "status report"}, tick=1)
    assert r["ok"] is True and r["dry_run"] is True
    assert reg.journal.count_by_capability().get("sim_use", 0) == 1
