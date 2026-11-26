"""The Brain's work cycle — a Nous takes its own steps on the Works of its Grid.

Each cycle: read the Works this Nous builds and the ones waiting for a verifier,
pick the step that is its own on each (work_logic.my_step), let the mind do it,
and send the result to the Grid with the version of the card that was read.

`think` asks the model for a judgement (answer, verify, deploy, notice). `act`
lets the model work with its tools (build, test). Both may say anything, fail,
or say nothing; a step is sent only when work_logic can read a well-formed body
out of it. A Work whose step could not be taken is left alone for a while.

At most one write per Work per cycle, and a bounded number per cycle. The Grid
applies a write only on the version it names, so a second Brain for the same
Nous, or a card that moved meanwhile, cannot apply a step twice.

Verified under the Triple Verification Rule as P-NOUSWORK-01..03
(verification/PROPERTIES.md).
"""

from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable

from noesis_brain.work_logic import (
    STEP_ROUTE, build_body, card_version, my_step, next_check, next_plan_step,
    parse_answer, parse_deploy, parse_notice, parse_test, parse_verify, prompt_for,
)

log = logging.getLogger(__name__)

Ask = Callable[[str], Awaitable[Any]]


class WorkCycle:
    def __init__(
        self,
        wire: Any,
        think: Ask,
        act: Ask,
        remember: Callable[[str, int], None] | None = None,
        per_cycle: int = 2,
        retry_after_ticks: int = 120,
    ) -> None:
        self._wire = wire
        self._think = think
        self._act = act
        self._remember = remember
        self._per_cycle = per_cycle
        self._retry_after = retry_after_ticks
        # work_id -> the tick before which this Work is left alone
        self._wait_until: dict[str, int] = {}

    async def run(self, tick: int) -> int:
        """Take this Nous's steps. Returns how many writes the Grid applied. Never raises."""
        try:
            me = self._wire.civic_did
            cards = await self._cards()
        except Exception:
            log.debug("work cycle: could not read the Works", exc_info=True)
            return 0
        applied = 0
        for card in cards:
            if applied >= self._per_cycle:
                break
            step = my_step(card, me)
            if step is None:
                continue
            work_id = card["work_id"]
            if self._wait_until.get(work_id, -1) > tick:
                continue
            body = await self._body_for(step, card)
            new_card = None
            if body is not None:
                try:
                    new_card = await self._wire.post_work_step(
                        work_id, STEP_ROUTE[step], {"version": card_version(card), **body},
                    )
                except Exception:
                    log.debug("work cycle: write failed", exc_info=True)
            if not isinstance(new_card, dict):
                self._wait_until[work_id] = tick + self._retry_after
                continue
            applied += 1
            self._wait_until.pop(work_id, None)
            if self._remember is not None:
                try:
                    self._remember(self._memory_of(step, card, body or {}), tick)
                except Exception:
                    log.debug("work cycle: could not remember a step", exc_info=True)
        return applied

    async def _cards(self) -> list[dict[str, Any]]:
        """The Works this Nous builds, then the ones waiting for a verifier; each once."""
        seen: set[str] = set()
        cards: list[dict[str, Any]] = []
        for role in ("builder", "verify"):
            rows = await self._wire.fetch_works(role)
            for row in rows if isinstance(rows, list) else []:
                work_id = row.get("work_id") if isinstance(row, dict) else None
                if isinstance(work_id, str) and work_id not in seen:
                    seen.add(work_id)
                    cards.append(row)
        return cards

    async def _body_for(self, step: str, card: dict[str, Any]) -> dict[str, Any] | None:
        """Let the mind take the step. None when it did not, could not, or made no sense."""
        try:
            if step == "answer":
                return parse_answer(await self._think(prompt_for(step, card)))
            if step == "build":
                todo = next_plan_step(card)
                if todo is None:
                    return None
                return build_body(todo["step"], await self._act(prompt_for(step, card, todo)))
            if step == "test":
                check = next_check(card)
                if check is None:
                    return None
                return parse_test(await self._act(prompt_for(step, card, check)), check["check"])
            if step == "verify":
                return parse_verify(await self._think(prompt_for(step, card)))
            if step == "deploy":
                return parse_deploy(await self._think(prompt_for(step, card)))
            if step == "notice":
                return parse_notice(await self._think(prompt_for(step, card)))
        except Exception:
            log.debug("work cycle: the mind failed on step %s", step, exc_info=True)
        return None

    @staticmethod
    def _memory_of(step: str, card: dict[str, Any], body: dict[str, Any]) -> str:
        goal = str(card.get("goal", ""))[:200]
        if step == "answer":
            verb = "accepted" if body.get("accept") else "declined"
            return f"I {verb} the request to build: {goal}. {body.get('reason', '')}"[:1000]
        if step == "build":
            return f"Working on \"{goal}\", I did step {body.get('step')}: {body.get('note', '')}"[:1000]
        if step == "test":
            verdict = "passed" if body.get("passed") else "failed"
            return f"Testing \"{goal}\", check {body.get('check')} {verdict}: {body.get('evidence', '')}"[:1000]
        if step == "verify":
            verb = "confirmed" if body.get("confirm") else "refused"
            return f"I {verb} another Nous's work \"{goal}\": {body.get('reason', '')}"[:1000]
        if step == "deploy":
            return f"I deployed \"{goal}\" at {body.get('where', '')}"[:1000]
        return f"I announced my finished work: {goal}"[:1000]
