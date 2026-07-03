"""Full mind+society loop integration (CI-safe, deterministic scripted LLM).

The per-cycle unit tests mock one canned LLM reply and call one cycle. NOTHING
covered the whole sequence — plan → work → complete → progress → social — end to
end through real stores. The 2026-07-02 liveness run proved the loop on a real
model but can't run in CI (needs Ollama). This test bridges the gap: a
deterministic LLM that answers correctly *per purpose*, driving real on_tick
over real ticks against real memory + ledger, asserting the loop actually
progresses a goal and acts outward — so the wiring can't silently regress.
"""
import asyncio
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import ActionType
from noesis_brain.telos import GoalType, TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"
PROPOSAL = {"proposal_id": "prop-1", "status": "open", "opened_at_tick": 1, "deadline_tick": 999}


class ScriptedLLM:
    """Deterministic per-purpose LLM — no network, always-valid structured JSON."""
    async def generate(self, prompt, options=None):
        purpose = getattr(options, "purpose", "") if options else ""
        if purpose == "planning":
            text = '{"tasks": ["survey the ring", "estimate the demand"]}'
        elif purpose == "decision":
            text = '{"action": "work_task", "note": "did the work", "completed": true}'
        elif purpose == "social_decision":
            text = '{"action": "vote", "proposal_id": "prop-1", "choice": "yes"}'
        elif purpose == "reflection":
            text = "I am learning steadily. WIKI_UPDATE: Ring Energy"
        elif purpose == "skill_distill":
            text = '{"name": "survey_ring", "description": "how", "instructions": "do it", "triggers": ["ring"]}'
        else:
            text = '{"action": "none"}'
        return LLMResponse(text=text, model="scripted", provider="test", usage={})


class LoopWire:
    def __init__(self):
        self.posted = []
        self.econ = []
    async def fetch_dues(self): return []
    async def fetch_open_rfps(self): return []
    async def fetch_account(self): return {"balance_wei": "0"}
    async def fetch_open_proposals(self): return [PROPOSAL]
    async def fetch_groups_list(self): return []
    async def fetch_grids(self): return []
    async def fetch_grid_recommendations(self): return []
    async def fetch_parcels(self): return []
    async def fetch_objects(self): return []
    async def post_actions(self, actions, tick=0):
        self.posted.extend(actions)
        class R: status_code = 200; text = ""
        return R()
    async def post_economic_action(self, action):
        self.econ.append(action); return True


@pytest.mark.asyncio
async def test_full_loop_progresses_goal_and_acts_outward(tmp_path):
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    mem = MemoryStream(MemoryStore(":memory:"))
    telos = TelosManager.from_yaml(data.get("telos", {}))
    telos.add_goal("Map the energy needs of the residential ring", GoalType.SHORT_TERM, priority=0.95)
    h = BrainHandler(
        psyche=load_psyche(data=data), thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=telos, llm=ScriptedLLM(), did="did:noesis:sophia", memory=mem, ledger_db_dir=str(tmp_path),
    )
    wire = LoopWire()
    h._grid_wire_client = wire
    h._PLAN_COOLDOWN_TICKS = 1
    h._DECISION_COOLDOWN_TICKS = 1
    h._SOCIAL_COOLDOWN_TICKS = 1
    goal = h._top_goal()

    for t in range(1, 12):
        await h.on_tick({"tick": t})
        for _ in range(8):
            pending = [x for x in asyncio.all_tasks()
                       if x is not asyncio.current_task() and not x.done()]
            if not pending:
                break
            await asyncio.gather(*pending, return_exceptions=True)
        if h._pending_actions:
            await wire.post_actions([a.to_dict() for a in h._pending_actions], tick=t)
            h._pending_actions.clear()

    # The mind advanced a real goal to completion...
    assert goal.progress >= 0.99, f"goal did not complete (progress={goal.progress})"
    assert not goal.is_active()                                  # COMPLETED
    contents = [m.content for m in mem.recent(limit=200)]
    assert any(c.startswith("Planned ") for c in contents)
    assert any(c.startswith("Worked on ") for c in contents)
    # ...and the citizen acted outward (cast a ballot via commit-reveal).
    posted_types = {a.get("action_type") for a in wire.posted}
    assert "vote_commit" in posted_types
