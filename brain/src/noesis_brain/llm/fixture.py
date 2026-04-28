"""FixtureBrainAdapter — Phase 14 RIG-03.

Replays pre-recorded prompt→response pairs from a JSONL fixture file by template-key
(D-14-04). Strict cache-miss is fatal by default (D-14-05); --permissive opt-in returns
a stub. Refuses network calls when NOESIS_FIXTURE_MODE=1 is set in env (D-14-06).
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

from .base import LLMAdapter
from .types import GenerateOptions, LLMResponse

_STRICT_MISS_TEMPLATE = (
    '[FIXTURE ERROR] No fixture record for key "{key}". '
    'Run with --permissive to use stub.'
)
_PERMISSIVE_STUB_TEXT = "[UNMATCHED FIXTURE]"
_VALID_TIERS = frozenset({"SMALL", "PRIMARY", "LARGE"})


@dataclass(frozen=True)
class _FixtureRecord:
    key: str
    response_text: str
    tokens: int
    tier: str


class FixtureBrainAdapter(LLMAdapter):
    """LLMAdapter that replays JSONL fixture records keyed by GenerateOptions.purpose.

    Args:
        fixture_path: Path to JSONL file. One record per line: {key, response_text, tokens, tier}.
        permissive: If True, cache-miss returns "[UNMATCHED FIXTURE]" instead of raising.
                    D-14-05: this is a MODE SELECTOR, NOT a bypass flag.
        tier: Optional tier expected on calls (SMALL/PRIMARY/LARGE). If set, mismatch is fatal.
    """

    def __init__(
        self,
        fixture_path: str | Path,
        *,
        permissive: bool = False,
        tier: str | None = None,
    ) -> None:
        self._records: dict[str, _FixtureRecord] = {}
        self._permissive = permissive
        self._tier = tier
        path = Path(fixture_path)
        if not path.is_file():
            raise FileNotFoundError(f"Fixture file not found: {path}")
        with path.open("r", encoding="utf-8") as f:
            for line_no, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                raw = json.loads(line)
                rec_tier = raw.get("tier", "PRIMARY")
                if rec_tier not in _VALID_TIERS:
                    raise ValueError(
                        f"Fixture line {line_no}: invalid tier {rec_tier!r}; "
                        f"must be one of {sorted(_VALID_TIERS)}"
                    )
                rec = _FixtureRecord(
                    key=raw["key"],
                    response_text=raw["response_text"],
                    tokens=int(raw.get("tokens", 0)),
                    tier=rec_tier,
                )
                if rec.key in self._records:
                    raise ValueError(
                        f"Fixture line {line_no}: duplicate key {rec.key!r}; "
                        f"each key must be unique within a fixture file"
                    )
                self._records[rec.key] = rec

    @property
    def provider_name(self) -> str:
        return "fixture"

    async def generate(
        self,
        prompt: str,
        options: GenerateOptions | None = None,
    ) -> LLMResponse:
        key = options.purpose if options is not None else ""
        record = self._records.get(key)
        if record is None:
            if self._permissive:
                print(f'[FIXTURE MISS] key="{key}"', file=sys.stderr)
                return LLMResponse(
                    text=_PERMISSIVE_STUB_TEXT,
                    model="fixture",
                    provider="fixture",
                    usage={"prompt_tokens": 0, "completion_tokens": 0},
                )
            raise RuntimeError(_STRICT_MISS_TEMPLATE.format(key=key))
        # Tier mismatch check (fixture authoring error per CONTEXT.md §Specifics)
        if self._tier is not None and record.tier != self._tier:
            raise RuntimeError(
                f"[FIXTURE ERROR] Tier mismatch for key {key!r}: "
                f"adapter expected {self._tier}, fixture record is {record.tier}"
            )
        return LLMResponse(
            text=record.response_text,
            model="fixture",
            provider="fixture",
            usage={"prompt_tokens": 0, "completion_tokens": record.tokens},
        )

    async def list_models(self) -> list[str]:
        return ["fixture"]

    async def is_available(self) -> bool:
        return len(self._records) > 0
