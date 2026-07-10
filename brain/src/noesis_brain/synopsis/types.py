"""Synopsis types — source notes and synthesized research digests."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceNote:
    """One input to synthesis — a note the Nous already holds (a memory, a wiki page)."""

    title: str
    content: str
    source: str = ""


@dataclass(frozen=True)
class Synopsis:
    """A synthesized digest of several sources on one topic (the 'notebook' page).

    Deterministic and immutable: `key_points` and `source_titles` are tuples so a
    Synopsis is hashable/comparable (contract tests rely on equality).
    """

    topic: str
    key_points: tuple[str, ...]
    source_titles: tuple[str, ...]
    outline: str
    created_tick: int
