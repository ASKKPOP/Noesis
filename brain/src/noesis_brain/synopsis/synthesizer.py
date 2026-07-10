"""Synopsis synthesizer — deterministic "seeing-together" of many sources.

Takes the notes a Nous already holds on a topic and consolidates them into one
digest: it splits each source into candidate points, deduplicates them, ranks by
how often they recur across sources (the recurring idea is the salient one), and
emits the top points plus an outline. The Open-Notebook idea — turn many sources
into one understanding — but *in-world* and **deterministic** (no LLM, no
wall-clock, no randomness): the same sources always yield the same synopsis.
"""

from __future__ import annotations

import re

from noesis_brain.synopsis.types import SourceNote, Synopsis

# A candidate point must be at least this long to count (drops "ok.", "yes").
MIN_POINT_LEN = 12
# Cap the digest so it stays a summary, not a dump.
MAX_POINTS = 7

_SENTENCE_SPLIT = re.compile(r"[.!?\n]+")


class Synthesizer:
    """Consolidates source notes into a Synopsis. Stateless + deterministic."""

    def synthesize(self, topic: str, sources: list[SourceNote], tick: int) -> Synopsis:
        # display text keyed by a normalized form; count = cross-source recurrence.
        display: dict[str, str] = {}
        counts: dict[str, int] = {}
        order: list[str] = []

        for src in sources:
            seen_here: set[str] = set()
            for raw in self._points(src.content):
                key = " ".join(raw.lower().split())
                if key in seen_here:
                    continue
                seen_here.add(key)
                if key not in counts:
                    display[key] = raw
                    counts[key] = 0
                    order.append(key)
                counts[key] += 1

        index = {k: i for i, k in enumerate(order)}
        ranked = sorted(order, key=lambda k: (-counts[k], -len(display[k]), index[k]))
        key_points = tuple(display[k] for k in ranked[:MAX_POINTS])

        outline_lines = [f"# {topic}", ""]
        outline_lines += [f"{i + 1}. {p}" for i, p in enumerate(key_points)]
        outline = "\n".join(outline_lines)

        return Synopsis(
            topic=topic,
            key_points=key_points,
            source_titles=tuple(s.title for s in sources),
            outline=outline,
            created_tick=tick,
        )

    def _points(self, content: str) -> list[str]:
        out: list[str] = []
        for frag in _SENTENCE_SPLIT.split(content or ""):
            frag = frag.strip()
            if len(frag) >= MIN_POINT_LEN:
                out.append(frag if frag.endswith((".", "!", "?")) else frag + ".")
        return out
