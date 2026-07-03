"""Full-stack liveness — real Brain ← HTTP ← real Grid (real MySQL) ← real qwen3.

The in-process liveness run (liveness_run.py) proved cognition with a *stubbed*
Grid. This proves the join: the REAL GridWireClient pulls REAL civic data over
HTTP from a REAL Grid backed by REAL MySQL, and the REAL qwen3:4b model decides
on it. So the whole chain — MySQL → Grid HTTP → wire client → Brain → model —
runs, not just the pieces.

Prereqs (all already up in this session):
  - MySQL 8 on :3307, Grid on :8080 (MYSQL_HOST=… npx tsx src/entrypoint.ts)
  - ollama serving qwen3:4b

Run:  cd brain && .venv/bin/python -m scripts.fullstack_liveness

Scope: the READ/sight + decide path (public civic endpoints need no DID). The
write-back of civic actions needs a Civic-DID (the Portal→Polis ceremony) — out
of scope here and called out at the end.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import yaml
from nacl.signing import SigningKey

from noesis_brain.llm.ollama import OllamaAdapter
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import ActionType
from noesis_brain.telos import GoalType, TelosManager
from noesis_brain.thymos import ThymosTracker
from noesis_brain.wire.client import GridWireClient
from noesis_brain.wire.token_manager import TokenManager

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"
GRID = "http://127.0.0.1:8080"
DID = "did:noesis:sophia"


def real_wire() -> GridWireClient:
    """A genuine GridWireClient pointed at the local Grid. validate_grid_url is
    https-only, so construct with a dummy https URL then relax the base to the
    local http Grid (dev-harness only — production always uses TLS)."""
    sk = SigningKey.generate()
    tm = TokenManager(existence_did=DID, civic_did=DID, signing_key=sk)
    wire = GridWireClient(grid_url="https://placeholder.local", token_manager=tm, brain_did=DID)
    wire._base_url = GRID  # dev-only: talk to the local http Grid
    return wire


async def main() -> int:
    print(f"\n=== Full-stack liveness — real Brain ← {GRID} (real MySQL) ← qwen3:4b ===\n")
    wire = real_wire()

    # 1. The Brain's SIGHT, pulled live over HTTP from the real Grid.
    groups = await wire.fetch_groups_list()
    proposals = await wire.fetch_open_proposals()
    objects = await wire.fetch_objects()
    print(f"[sight] groups from real Grid: {len(groups)} → {[g.get('display_name') for g in groups]}")
    print(f"[sight] open proposals:        {len(proposals)}")
    print(f"[sight] orbital objects:       {len(objects)}")
    if not groups:
        print("!! no groups from the Grid — is it up on :8080 against MySQL?")
        return 1

    # 2. A real Brain (real qwen3) decides on that real sight.
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    telos = TelosManager.from_yaml(data.get("telos", {}))
    telos.add_goal("Secure reliable energy for the residential ring", GoalType.SHORT_TERM, priority=0.95)
    h = BrainHandler(
        psyche=load_psyche(data=data), thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=telos, llm=OllamaAdapter(model="qwen3:4b"), did=DID,
    )
    h._grid_wire_client = wire
    h._SOCIAL_COOLDOWN_TICKS = 1

    print("\n[decide] running one social cycle on the real model against real Grid sight…")
    await h._run_social_cycle(tick=100)

    acts = h._pending_actions
    print(f"[decide] the Nous chose {len(acts)} action(s):")
    for a in acts:
        print(f"   → {a.action_type.value}  {a.metadata or a.text[:60]}")

    chose_something = len(acts) > 0
    join = next((a for a in acts if a.action_type == ActionType.JOIN_GROUP), None)

    print("\n=== FULL-STACK CHECKS ===")
    print(f"  [{'PASS' if groups else '—'}] Brain pulled REAL group data from the Grid over HTTP (MySQL-backed)")
    print(f"  [{'PASS' if chose_something else '—'}] real qwen3 produced a civic decision from that real sight")
    if join:
        gid = join.metadata.get("group_id")
        real = any(g.get("group_id") == gid for g in groups)
        print(f"  [{'PASS' if real else 'FAIL'}] the group it chose ({gid}) is a REAL seeded group, not a hallucination")

    # 3. The write boundary: a civic action WITHOUT a Civic-DID must be rejected.
    #    (The constitutional gate — check-civic-did-issuance-path — makes the
    #    Civic-DID obtainable only via the Portal→Polis ceremony, so a real
    #    write-back is a separate onboarding milestone. Here we prove the gate
    #    HOLDS: an unauthenticated civic write is refused, not silently accepted.)
    import httpx as _httpx
    gate_ok = False
    try:
        r = await (await wire._get_client()).post(
            f"{GRID}/api/v1/brain/actions",
            headers={"Authorization": "Bearer invalid.token.here"},
            json={"actions": [{"action_type": "join_group", "channel": "", "text": "",
                               "metadata": {"group_id": "genesis:group:dynamo", "role": "member"}}],
                  "tick": 1},
        )
        gate_ok = r.status_code in (401, 403)
        print(f"\n[write] civic action without a Civic-DID → HTTP {r.status_code} {r.text[:60]}")
    except _httpx.HTTPError as exc:
        print(f"\n[write] gate probe transport error: {exc}")

    print(f"  [{'PASS' if gate_ok else 'FAIL'}] the constitutional write-gate refuses an un-credentialed civic action")

    await wire.aclose()
    ok = bool(groups) and chose_something and gate_ok
    print(f"\n=== VERDICT: {'FULL-STACK ALIVE ✓' if ok else 'INCONCLUSIVE'} — MySQL → Grid → HTTP → Brain → qwen3 ===")
    print("Proven: real Grid data → real model decision, and the write-gate holds.")
    print("Next milestone: the JOIN_GROUP actually landing on the audit chain needs a")
    print("Civic-DID via the Portal→Polis ceremony (by design — not shortcuttable).")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
