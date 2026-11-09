"""Physics rehearsal domain — design an orbital object that does a job and obeys law.

Worlds are the Grid's REAL environments (Earth-orbit, Moon, Mars, … fetched from
GET /api/v1/physics/environments); each episode also randomizes the job the design
must do (load carried, power drawn, heat produced, mass). The referee is the Grid's
server-side physics gate (POST /api/v1/physics/check), never the Nous itself.
"""
from __future__ import annotations

import json
import random
from typing import Any, Awaitable, Callable

from noesis_brain.llm.types import GenerateOptions
from noesis_brain.rehearsal.engine import Episode
from noesis_brain.skills.types import Skill

# Randomization ranges for the job each episode demands (domain randomization).
REQUIREMENT_RANGES: dict[str, tuple[float, float]] = {
    "load_N": (50.0, 5000.0),
    "consumption_W": (10.0, 2000.0),
    "dissipated_W": (5.0, 1000.0),
    "mass_kg": (100.0, 20000.0),
}

SPEC_FIELDS = (
    "mass_kg", "massIn_kg", "massOut_kg", "energyIn_J", "energyOut_J",
    "load_N", "yield_N", "dissipated_W", "radiated_W",
    "generation_W", "consumption_W", "altitude_km",
)

PhysicsCheck = Callable[[dict[str, Any], str], Awaitable[dict[str, Any] | None]]


def make_physics_episodes(
    environments: list[dict[str, Any]], n: int, rng: random.Random
) -> list[Episode]:
    """n episodes, environments round-robin (every world is tested), jobs randomized."""
    envs = [e for e in environments if isinstance(e, dict) and e.get("name")]
    if not envs:
        return []
    episodes: list[Episode] = []
    for i in range(n):
        env = envs[i % len(envs)]
        params: dict[str, Any] = {
            k: round(rng.uniform(lo, hi), 1) for k, (lo, hi) in REQUIREMENT_RANGES.items()
        }
        params["min_stable_altitude_km"] = env.get("min_stable_altitude_km", 0)
        episodes.append(Episode(index=i, condition=str(env["name"]), params=params))
    return episodes


def _prompt(skill: Skill, ep: Episode) -> str:
    p = ep.params
    return (
        f"You are rehearsing a skill: {skill.name}\n"
        f"Skill instructions: {skill.instructions}\n\n"
        f"World: {ep.condition} (lowest stable orbit {p['min_stable_altitude_km']} km).\n"
        f"Design an orbital object that must carry load_N >= {p['load_N']}, "
        f"draw consumption_W >= {p['consumption_W']}, produce dissipated_W >= {p['dissipated_W']} "
        f"of heat, and have mass_kg >= {p['mass_kg']}.\n"
        f"Reply with ONLY a JSON object with these numeric keys: {', '.join(SPEC_FIELDS)}."
    )


class PhysicsEpisodeRunner:
    """Callable(skill, episode) -> (ok, detail) for the rehearsal engine."""

    def __init__(self, llm: Any, check: PhysicsCheck) -> None:
        self.llm = llm
        self._check = check

    async def __call__(self, skill: Skill, ep: Episode) -> tuple[bool, str]:
        resp = await self.llm.generate(
            _prompt(skill, ep),
            GenerateOptions(temperature=0.7, max_tokens=400, json_mode=True, purpose="rehearsal_physics"),
        )
        try:
            spec = json.loads(resp.text)
        except (json.JSONDecodeError, TypeError):
            return False, "bad_json"
        if not isinstance(spec, dict):
            return False, "bad_json"

        for key in ("load_N", "consumption_W", "dissipated_W", "mass_kg"):
            val = spec.get(key)
            if not isinstance(val, (int, float)) or val < ep.params[key]:
                return False, f"unmet:{key}"

        verdict = await self._check(spec, ep.condition)
        if not isinstance(verdict, dict):
            return False, "referee_unavailable"
        if verdict.get("ok") is True:
            return True, "lawful"
        return False, "violations:" + ",".join(verdict.get("violations") or [])
