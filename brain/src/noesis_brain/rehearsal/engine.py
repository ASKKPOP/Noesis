"""Parallel rehearsal engine — practise one Skill in many worlds at once.

Pattern: massively-parallel sim training (many copies, one policy, randomized
worlds, a referee that is not the agent). A skill passes only if it succeeds in
EVERY condition bucket, not just on average — a skill that works on Earth but
fails on the Moon has not been learned.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from noesis_brain.skills.types import Skill

DEFAULT_CONCURRENCY = 4
DEFAULT_THRESHOLD = 0.8


@dataclass(frozen=True)
class Episode:
    index: int
    condition: str  # bucket a skill must master on its own (e.g. a Grid environment)
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class EpisodeOutcome:
    episode: Episode
    ok: bool
    detail: str


@dataclass(frozen=True)
class RehearsalReport:
    skill_name: str
    outcomes: list[EpisodeOutcome]
    success_rate: float
    by_condition: dict[str, float]
    passed: bool

    def summary(self) -> dict[str, Any]:
        return {
            "skill": self.skill_name,
            "episodes": len(self.outcomes),
            "success_rate": self.success_rate,
            "by_condition": self.by_condition,
            "passed": self.passed,
            "failures": [o.detail for o in self.outcomes if not o.ok][:10],
        }


RunEpisode = Callable[[Skill, Episode], Awaitable[tuple[bool, str]]]


async def rehearse(
    skill: Skill,
    episodes: list[Episode],
    run_episode: RunEpisode,
    *,
    concurrency: int = DEFAULT_CONCURRENCY,
    threshold: float = DEFAULT_THRESHOLD,
) -> RehearsalReport:
    """Run every episode (at most `concurrency` at a time) and grade the skill."""
    gate = asyncio.Semaphore(max(1, concurrency))

    async def one(ep: Episode) -> EpisodeOutcome:
        async with gate:
            try:
                ok, detail = await run_episode(skill, ep)
            except Exception as exc:  # a crashed episode is a failed episode
                ok, detail = False, f"error:{type(exc).__name__}"
            return EpisodeOutcome(ep, bool(ok), detail)

    outcomes = list(await asyncio.gather(*(one(ep) for ep in episodes)))

    buckets: dict[str, list[bool]] = {}
    for o in outcomes:
        buckets.setdefault(o.episode.condition, []).append(o.ok)
    by_condition = {c: sum(v) / len(v) for c, v in buckets.items()}
    rate = sum(o.ok for o in outcomes) / len(outcomes) if outcomes else 0.0
    passed = bool(outcomes) and rate >= threshold and all(r >= threshold for r in by_condition.values())
    return RehearsalReport(skill.name, outcomes, rate, by_condition, passed)
