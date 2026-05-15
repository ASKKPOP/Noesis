"""Skill types — reusable text procedure records."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class Skill:
    """A single reusable text procedure stored in the skill library.

    Modelled after Voyager's skill library (arxiv.org/abs/2305.16291) and
    EvoAgent's metadata schema (arxiv.org/abs/2604.20133), adapted for
    text-only safety — instructions is prose, never executable code.

    Retrieval: FTS5 BM25 match over name + description + instructions.
    Re-ranking: bm25_rank × log1p(usage_count) × (0.5 + 0.5 × success_rate)

    Phase 16 additive fields:
        source_did: DID of the peer Nous who authored this skill, or ""
                    for self-authored skills.  Empty = full trust;
                    non-empty = must pass PeerSkillFilter before adoption.
        peer_verified: True once PeerSkillFilter has accepted and stored the skill.
                       False for peer-authored skills awaiting first execution.
    """

    name: str                          # Unique slug, e.g. "trade_with_lonely_nous"
    description: str                   # ≤200 chars; FTS5 retrieval key
    instructions: str                  # Prose "how to do this"; injected when retrieved
    triggers: list[str] = field(default_factory=list)   # keyword phrases for fast O(1) match
    tags: list[str] = field(default_factory=list)        # category labels
    usage_count: int = 0
    success_rate: float = 0.0          # 0.0–1.0; updated by caller after each use
    # Phase 16: provenance tracking for trust-gated peer skills
    source_did: str = ""               # DID of peer author; "" = self-authored
    peer_verified: bool = True         # False until PeerSkillFilter has accepted it
    id: int | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_used_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # ── Validation ───────────────────────────────────────────────────────────

    def validate(self) -> None:
        """Raise ValueError if the skill violates size or content constraints."""
        if not self.name or not self.name.replace("_", "").replace("-", "").isalnum():
            raise ValueError(f"Skill name must be alphanumeric+underscore: {self.name!r}")
        if len(self.description) > 200:
            raise ValueError(f"description exceeds 200 chars ({len(self.description)})")
        if len(self.instructions) > 1000:
            raise ValueError(f"instructions exceeds 1000 chars ({len(self.instructions)})")
        if len(self.triggers) > 20:
            raise ValueError("triggers list exceeds 20 entries")

    # ── Serialisation helpers ────────────────────────────────────────────────

    def triggers_json(self) -> str:
        return json.dumps(self.triggers)

    def tags_json(self) -> str:
        return json.dumps(self.tags)

    @classmethod
    def from_row(cls, row: Any) -> "Skill":
        # Phase 16: source_did and peer_verified may be absent in older DBs
        keys = row.keys() if hasattr(row, "keys") else []
        return cls(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            instructions=row["instructions"],
            triggers=json.loads(row["triggers"] or "[]"),
            tags=json.loads(row["tags"] or "[]"),
            usage_count=row["usage_count"],
            success_rate=row["success_rate"],
            source_did=row["source_did"] if "source_did" in keys else "",
            peer_verified=bool(row["peer_verified"]) if "peer_verified" in keys else True,
            created_at=datetime.fromisoformat(row["created_at"]),
            last_used_at=datetime.fromisoformat(row["last_used_at"]),
        )

    def to_prompt_block(self) -> str:
        """Format for injection into the system prompt."""
        return f"**{self.name}**: {self.instructions}"
