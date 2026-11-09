"""Parallel skill rehearsal — a candidate Skill is practised in many randomized
worlds at once and refereed by the Grid's real physics gate; only a skill that
succeeds across the whole spread is kept (Boston Dynamics sim pattern, §4b of
.planning/research/atlas-world-model-simulator.md).
"""
import asyncio
import json
import random
from unittest.mock import AsyncMock, MagicMock

import pytest

from noesis_brain.llm.types import LLMResponse
from noesis_brain.rehearsal import (
    Episode,
    PhysicsEpisodeRunner,
    make_physics_episodes,
    rehearse,
)
from noesis_brain.skills.types import Skill

ENVS = [
    {"name": "Earth-orbit", "min_stable_altitude_km": 160},
    {"name": "Moon", "min_stable_altitude_km": 15},
    {"name": "Mars", "min_stable_altitude_km": 100},
]
SKILL = Skill(
    name="design_power_module",
    description="Design an orbital power module that obeys physics",
    instructions="Give yield 3x load, generation 1.5x consumption, radiate 2x heat, orbit above floor.",
)


def _ep(i, cond="Earth-orbit"):
    return Episode(index=i, condition=cond, params={})


# ── engine ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_runs_every_episode_with_bounded_parallelism():
    in_flight = 0
    peak = 0

    async def run(skill, ep):
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await asyncio.sleep(0.01)
        in_flight -= 1
        return True, "ok"

    report = await rehearse(SKILL, [_ep(i) for i in range(10)], run, concurrency=3)
    assert len(report.outcomes) == 10
    assert peak == 3  # really parallel, never more than the cap
    assert report.success_rate == 1.0 and report.passed


@pytest.mark.asyncio
async def test_must_succeed_across_every_condition_not_just_on_average():
    # 9/10 overall, but Moon fails 1 of 2 → below threshold in that world.
    eps = [_ep(i, "Earth-orbit") for i in range(8)] + [_ep(8, "Moon"), _ep(9, "Moon")]

    async def run(skill, ep):
        return (ep.index != 9), "x"

    report = await rehearse(SKILL, eps, run, threshold=0.8)
    assert report.success_rate == 0.9
    assert report.by_condition == {"Earth-orbit": 1.0, "Moon": 0.5}
    assert report.passed is False


@pytest.mark.asyncio
async def test_an_episode_that_raises_counts_as_failure():
    async def run(skill, ep):
        raise RuntimeError("boom")

    report = await rehearse(SKILL, [_ep(0)], run)
    assert report.outcomes[0].ok is False
    assert report.outcomes[0].detail == "error:RuntimeError"
    assert report.passed is False


@pytest.mark.asyncio
async def test_no_episodes_never_passes():
    async def run(skill, ep):
        return True, ""

    report = await rehearse(SKILL, [], run)
    assert report.passed is False and report.success_rate == 0.0


# ── randomized worlds ──────────────────────────────────────────────────────

def test_episodes_cover_every_real_environment_and_vary_requirements():
    eps = make_physics_episodes(ENVS, 9, random.Random(7))
    assert len(eps) == 9
    assert {e.condition for e in eps} == {"Earth-orbit", "Moon", "Mars"}
    loads = {e.params["load_N"] for e in eps}
    assert len(loads) > 1  # domain randomization, not one fixed world
    moon = next(e for e in eps if e.condition == "Moon")
    assert moon.params["min_stable_altitude_km"] == 15  # floor comes from the Grid env
    # deterministic for a seed (reproducible rehearsals)
    again = make_physics_episodes(ENVS, 9, random.Random(7))
    assert [e.params for e in again] == [e.params for e in eps]


# ── physics runner (real referee seam) ─────────────────────────────────────

def _spec_for(p, **over):
    s = {
        "mass_kg": p["mass_kg"], "massIn_kg": p["mass_kg"], "massOut_kg": p["mass_kg"],
        "energyIn_J": 1000, "energyOut_J": 900,
        "load_N": p["load_N"], "yield_N": p["load_N"] * 3,
        "dissipated_W": p["dissipated_W"], "radiated_W": p["dissipated_W"] * 2,
        "generation_W": p["consumption_W"] * 2, "consumption_W": p["consumption_W"],
        "altitude_km": p["min_stable_altitude_km"] + 200,
    }
    s.update(over)
    return s


def _llm(text):
    llm = MagicMock()
    llm.generate = AsyncMock(return_value=LLMResponse(text=text, model="m", provider="mock", usage={}))
    return llm


@pytest.mark.asyncio
async def test_runner_passes_only_when_the_grid_referee_says_lawful():
    ep = make_physics_episodes(ENVS, 1, random.Random(1))[0]
    spec = _spec_for(ep.params)
    check = AsyncMock(return_value={"ok": True, "violations": [], "env": ep.condition})
    runner = PhysicsEpisodeRunner(_llm(json.dumps(spec)), check)

    ok, detail = await runner(SKILL, ep)
    assert ok is True
    check.assert_awaited_once_with(spec, ep.condition)
    prompt = runner.llm.generate.call_args[0][0]
    assert SKILL.instructions in prompt and ep.condition in prompt


@pytest.mark.asyncio
async def test_runner_fails_on_violation_unmet_requirement_bad_json_or_no_referee():
    ep = make_physics_episodes(ENVS, 1, random.Random(1))[0]
    lawful = AsyncMock(return_value={"ok": True, "violations": []})

    bad = AsyncMock(return_value={"ok": False, "violations": ["structural"]})
    assert await PhysicsEpisodeRunner(_llm(json.dumps(_spec_for(ep.params))), bad)(SKILL, ep) == (False, "violations:structural")

    # a trivially lawful but useless design (carries less load than required) is not a pass
    weak = _spec_for(ep.params, load_N=ep.params["load_N"] / 2)
    assert (await PhysicsEpisodeRunner(_llm(json.dumps(weak)), lawful)(SKILL, ep))[1] == "unmet:load_N"

    assert await PhysicsEpisodeRunner(_llm("not json"), lawful)(SKILL, ep) == (False, "bad_json")

    gone = AsyncMock(return_value=None)
    assert await PhysicsEpisodeRunner(_llm(json.dumps(_spec_for(ep.params))), gone)(SKILL, ep) == (False, "referee_unavailable")


# ── brain.rehearseSkill RPC: rehearse, then keep only a skill that passed ──

def _handler(spec_text, verdict):
    from pathlib import Path
    import yaml
    from noesis_brain.psyche import load_psyche
    from noesis_brain.rpc.handler import BrainHandler
    from noesis_brain.telos import TelosManager
    from noesis_brain.thymos import ThymosTracker

    data = yaml.safe_load(open(Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"))
    h = BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=_llm(spec_text), did="did:noesis:sophia",
    )
    h.memory = MagicMock()
    h._skill_store = MagicMock()
    h._skill_store.get = MagicMock(return_value=None)
    w = MagicMock()
    w.fetch_physics_environments = AsyncMock(return_value=ENVS)
    w.check_physics = AsyncMock(return_value=verdict)
    h._grid_wire_client = w
    return h


PARAMS = {"name": SKILL.name, "description": SKILL.description,
          "instructions": SKILL.instructions, "episodes": 6, "seed": 3}


def _generous_spec():
    # meets every randomized job in REQUIREMENT_RANGES
    return json.dumps({"mass_kg": 30000, "massIn_kg": 30000, "massOut_kg": 30000,
                       "energyIn_J": 10, "energyOut_J": 5, "load_N": 6000, "yield_N": 20000,
                       "dissipated_W": 1500, "radiated_W": 4000, "generation_W": 5000,
                       "consumption_W": 2500, "altitude_km": 500})


@pytest.mark.asyncio
async def test_rpc_promotes_a_skill_that_holds_in_every_world():
    h = _handler(_generous_spec(), {"ok": True, "violations": []})
    res = await h.rehearse_skill(PARAMS)
    assert res["ok"] and res["promoted"] and res["episodes"] == 6
    assert set(res["by_condition"]) == {"Earth-orbit", "Moon", "Mars"}
    assert h._grid_wire_client.check_physics.await_count == 6
    kept = h._skill_store.add.call_args[0][0]
    assert kept.name == SKILL.name and kept.success_rate == 1.0
    assert "rehearsed:physics" in kept.tags and kept.source_did == ""
    h.memory.record_event.assert_called_once()


@pytest.mark.asyncio
async def test_rpc_does_not_keep_a_skill_the_world_rejects():
    h = _handler(_generous_spec(), {"ok": False, "violations": ["thermal"]})
    res = await h.rehearse_skill(PARAMS)
    assert res["ok"] and res["promoted"] is False and res["success_rate"] == 0.0
    h._skill_store.add.assert_not_called()


@pytest.mark.asyncio
async def test_rpc_refuses_without_referee_store_or_valid_skill():
    h = _handler(_generous_spec(), {"ok": True})
    h._grid_wire_client = None
    assert (await h.rehearse_skill(PARAMS))["error"] == "no_grid"

    h = _handler(_generous_spec(), {"ok": True})
    h._grid_wire_client.fetch_physics_environments = AsyncMock(return_value=[])
    assert (await h.rehearse_skill(PARAMS))["error"] == "referee_unavailable"

    h = _handler(_generous_spec(), {"ok": True})
    h._skill_store.get = MagicMock(return_value=SKILL)
    assert (await h.rehearse_skill(PARAMS))["error"] == "skill_exists"

    h = _handler(_generous_spec(), {"ok": True})
    assert (await h.rehearse_skill({**PARAMS, "name": "bad name!"}))["error"] == "invalid_skill"
    assert (await h.rehearse_skill({**PARAMS, "domain": "chess"}))["error"] == "unknown_domain"
