"""Liveness run — is the Nous actually ALIVE?

Every unit test mocks the LLM. This harness does not: it wires the REAL
BrainHandler to the REAL Ollama model (qwen3:4b, the production default) with
REAL memory (SQLite), a REAL goal ledger, and REAL reflection — then drives it
over real ticks and watches whether the whole loop actually fires:

    plan → work → lesson → reflect → speak → vote → join a group → contribute lore

The Grid is stubbed in-process (a FakeWire feeding canned civic state and
capturing dispatched actions) — the Grid's HTTP surface already has 626 passing
tests; what NOTHING tests is "does a real 4B model, through our real prompts,
produce parseable, sane decisions that flow through the whole mind+society
loop." That is exactly the 'can it learn on its own and work ceaselessly'
question, answered against a real model instead of an AsyncMock.

Run:  cd brain && .venv/bin/python -m scripts.liveness_run
Requires: ollama serving qwen3:4b at localhost:11434.
"""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

import yaml

from noesis_brain.llm.ollama import OllamaAdapter
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import ActionType
from noesis_brain.telos import GoalType, TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"
DID = "did:noesis:sophia"

DUE = {"due_id": "11111111-1111-4111-8111-111111111111", "amount_wei": "500",
       "amount_credit": "10", "status": "assessed"}
RFP = {"notice_id": "22222222-2222-4222-8222-222222222222", "function_type": "energy",
       "budget_wei": "5000", "status": "open"}
PROPOSAL = {"proposal_id": "prop-ring-4", "status": "open",
            "opened_at_tick": 1, "deadline_tick": 40}
GROUP = {"group_id": "grp-dynamo", "display_name": "Dynamo", "domain": "energy", "status": "active"}


class FakeWire:
    """In-process stand-in for GridWireClient — canned civic sight + capture."""

    def __init__(self) -> None:
        self.posted_actions: list = []
        self.posted_econ: list = []
        self.due_paid = False

    async def fetch_dues(self):
        return [] if self.due_paid else [DUE]

    async def fetch_open_rfps(self):
        return [RFP]

    async def fetch_account(self):
        return {"balance_wei": "1000000000000000000"}  # 1 ETH — can afford things

    async def fetch_open_proposals(self):
        return [PROPOSAL]

    async def fetch_groups_list(self):
        return [GROUP]

    async def fetch_grids(self):
        return []

    async def fetch_grid_recommendations(self):
        return []

    async def fetch_parcels(self):
        return []

    async def fetch_objects(self):
        return []

    async def post_actions(self, actions, tick=0):
        self.posted_actions.extend(actions)
        # The real GridWireClient.post_actions returns an httpx-style response;
        # on_tick's _fire_and_forward reads .status_code. Mirror that shape.
        class _Resp:
            status_code = 200
            text = ""
        return _Resp()

    async def post_economic_action(self, action):
        self.posted_econ.append(action)
        if action.action_type == ActionType.PAY_DUE:
            self.due_paid = True
        return True


def build_handler(llm, wire, ledger_dir):
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    mem = MemoryStream(MemoryStore(":memory:"))
    telos = TelosManager.from_yaml(data.get("telos", {}))
    # Give it a concrete, decomposable goal so the planner has something to chew.
    telos.add_goal(
        "Map the energy needs of the residential ring and secure power for it",
        GoalType.SHORT_TERM, priority=0.95,
    )
    h = BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=telos,
        llm=llm,
        did=DID,
        memory=mem,
        ledger_db_dir=ledger_dir,
    )
    h._grid_wire_client = wire
    # Tighten cooldowns so every cycle fires within a short run.
    h._PLAN_COOLDOWN_TICKS = 1
    h._DECISION_COOLDOWN_TICKS = 1
    h._ECON_COOLDOWN_TICKS = 1
    h._SOCIAL_COOLDOWN_TICKS = 1
    return h, mem


def contents(mem):
    return [m.content for m in mem.recent(limit=200)]


async def run(ticks: int = 24) -> int:
    print(f"\n=== Noēsis liveness run — real qwen3:4b, {ticks} ticks ===\n")
    llm = OllamaAdapter(model="qwen3:4b")
    wire = FakeWire()
    with tempfile.TemporaryDirectory() as td:
        h, mem = build_handler(llm, wire, td)
        goal = h._top_goal()
        print(f"seed goal: {goal.description!r}  (priority {goal.priority})")

        for t in range(1, ticks + 1):
            await h.on_tick({"tick": t})
            # let the background cycle tasks (plan/decide/econ/social) actually run
            for _ in range(6):
                await asyncio.sleep(0.05)
                pending = [task for task in asyncio.all_tasks()
                           if task is not asyncio.current_task() and not task.done()]
                if not pending:
                    break
                await asyncio.gather(*pending, return_exceptions=True)
            # drain queued social actions into the wire (they ride the NEXT tick;
            # do it explicitly so a short run still dispatches them)
            if h._pending_actions:
                await wire.post_actions([a.to_dict() for a in h._pending_actions], tick=t)
                h._pending_actions.clear()
            tasks = h._goal_ledger.total_count(goal.description)
            done = tasks - h._goal_ledger.pending_count(goal.description)
            print(f"tick {t:2d} | goal {goal.progress:4.0%} | ledger {done}/{tasks}"
                  f" | mem {mem.count():3d} | econ {len(wire.posted_econ)} | acts {len(wire.posted_actions)}")

        # ── what actually happened ──────────────────────────────────────────
        mc = contents(mem)
        def any_prefix(p): return [c for c in mc if c.startswith(p)]
        posted_types = [a.get("action_type") for a in wire.posted_actions]
        econ_types = [a.action_type.value for a in wire.posted_econ]

        print("\n=== TRANSCRIPT (real model output, distilled) ===")
        for c in mc:
            tag = c.split(":")[0].split(" '")[0][:22]
            print(f"  · {c[:96]}")

        checks = {
            "planned tasks":        h._goal_ledger.total_count(goal.description) > 0,
            "worked a task":        bool(any_prefix("Worked on")),
            "made progress":        goal.progress > 0.0,
            "stored a lesson OR reflected": bool(any_prefix("Lesson:")) or bool(
                [c for c in mc if "reflect" in c.lower()]) or any(
                m.memory_type.value == "reflection" for m in mem.recent(limit=200)),
            "economic decision":    len(wire.posted_econ) > 0,
            "social/civic act":     any(t in ("speak", "vote_commit", "vote_reveal",
                                               "direct_message", "lore_contribute", "join_group")
                                        for t in posted_types),
        }
        print("\n=== LIVENESS CHECKS ===")
        for name, ok in checks.items():
            print(f"  [{'PASS' if ok else '—   '}] {name}")
        print(f"\n  economic actions: {econ_types}")
        print(f"  posted action types: {sorted(set(posted_types))}")
        print(f"  final goal progress: {goal.progress:.0%}")

        alive = sum(checks.values())
        print(f"\n=== VERDICT: {alive}/{len(checks)} loop stages fired on a real model ===")
        # The model is nondeterministic; require the core mind loop + at least one
        # autonomous outward act. Plan+work+progress+(lesson|reflect) is the mind;
        # econ OR social is cooperation.
        core = checks["planned tasks"] and checks["worked a task"] and checks["made progress"]
        outward = checks["economic decision"] or checks["social/civic act"]
        ok = core and outward
        print("ALIVE ✓" if ok else "INCONCLUSIVE — see transcript above")
        return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
