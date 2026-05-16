"""RuleStore — SCOPE-pattern strategic behavioral rule accumulation (Phase 15).

Implements the SCOPE system prompt evolution pattern from arxiv.org/abs/2512.15374:
  θ_t+1 = θ_base ⊕ ℳ_strat

Strategic rules are stored as WikiCategory.SELF_MODEL wiki pages:
  - confidence ≥ 0.7 → injected into every future system prompt
  - cap = 10 strategic rules at once (SCOPE paper recommendation)
  - when cap exceeded: LLM-assisted consolidation (conflict resolution + pruning)

Rules are Brain-internal. No Grid audit event. No allowlist addition.
Rate-limited: max 1 RULE_STORE action per tick (enforced by BrainHandler).
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.types import WikiCategory, WikiPage

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


def compute_norm_fingerprint(rule_text: str) -> str:
    """6-char hex n-gram fingerprint for norm clustering (D-19-03).

    Algorithm: sorted unique word-trigrams from lowercased alphabetic tokens,
    SHA-256 of their joined string, truncated to 6 hex chars.
    Fallback for rules < 3 words: SHA-256 of lowercased words joined by space.
    Deterministic: no wall-clock, no random, no LLM.
    """
    words = re.findall(r'[a-z]+', rule_text.lower())
    trigrams = sorted({' '.join(words[i:i + 3]) for i in range(len(words) - 2)})
    if not trigrams:
        return hashlib.sha256(' '.join(words).encode()).hexdigest()[:6]
    return hashlib.sha256(' '.join(trigrams).encode()).hexdigest()[:6]

RULE_CAP = 10           # SCOPE paper maximum strategic guidelines
MIN_CONFIDENCE = 0.7    # Threshold for prompt injection
MAX_RULE_CHARS = 500    # Hard limit per rule (prevents context dilution)
_RULE_TITLE_PREFIX = "self_model_rule_"


class RuleStore:
    """Manages the Nous's evolved behavioral rules via the wiki_pages table.

    A rule is any short text guideline the Nous has synthesised from experience.
    Example: "When trading with a Nous that has high loneliness, lead with
    empathy before proposing exchange terms."

    Rules live in WikiCategory.SELF_MODEL. High-confidence rules (≥ 0.7) are
    injected into the system prompt at every tick. When the cap is reached,
    the lowest-confidence rule is pruned (simple strategy; LLM-assisted
    consolidation can be added later).
    """

    def __init__(self, store: MemoryStore) -> None:
        self._store = store

    # ── Write ────────────────────────────────────────────────────────────────

    def add(
        self,
        content: str,
        confidence: float = 0.75,
        source: str = "",
    ) -> WikiPage | None:
        """Store a new strategic rule.

        If the rule cap is reached, prunes the lowest-confidence rule first.
        Returns the stored WikiPage, or None if content is invalid.
        """
        content = content.strip()
        if not content:
            return None
        if len(content) > MAX_RULE_CHARS:
            content = content[:MAX_RULE_CHARS].rsplit(" ", 1)[0]  # trim at word boundary
        if confidence < 0.0 or confidence > 1.0:
            confidence = max(0.0, min(1.0, confidence))

        # Prune if at cap
        current = self.active_rules()
        if len(current) >= RULE_CAP:
            self._prune_weakest(current)

        title = self._next_title()
        page = WikiPage(
            title=title,
            category=WikiCategory.SELF_MODEL,
            content=content,
            confidence=confidence,
            source=source or f"self_modification:{datetime.now(timezone.utc).isoformat()}",
        )
        stored = self._store.add_wiki_page(page)
        logger.debug("RuleStore: added rule %r (confidence=%.2f)", title, confidence)
        return stored

    def update_confidence(self, title: str, delta: float) -> None:
        """Nudge a rule's confidence up or down after observing its effect."""
        page = self._store.get_wiki_page(title)
        if not page:
            return
        new_conf = max(0.0, min(1.0, page.confidence + delta))
        self._store.update_wiki_page(title, page.content, confidence=new_conf)

    def remove(self, title: str) -> bool:
        """Delete a rule by its wiki title."""
        return self._store.delete_wiki_page(title)

    # ── Read ─────────────────────────────────────────────────────────────────

    def active_rules(self, min_confidence: float = MIN_CONFIDENCE) -> list[WikiPage]:
        """Return rules that meet the confidence threshold, sorted by confidence desc."""
        all_rules = self._store.wiki_pages_by_category(WikiCategory.SELF_MODEL)
        active = [r for r in all_rules if r.confidence >= min_confidence]
        active.sort(key=lambda r: r.confidence, reverse=True)
        return active[:RULE_CAP]

    def all_rules(self) -> list[WikiPage]:
        """Return all stored rules regardless of confidence."""
        return self._store.wiki_pages_by_category(WikiCategory.SELF_MODEL)

    def rule_texts(self, min_confidence: float = MIN_CONFIDENCE) -> list[str]:
        """Return plain text content of active rules for prompt injection."""
        return [r.content for r in self.active_rules(min_confidence)]

    def count(self) -> int:
        return len(self._store.wiki_pages_by_category(WikiCategory.SELF_MODEL))

    # ── Internal ─────────────────────────────────────────────────────────────

    def _next_title(self) -> str:
        """Generate a unique sequential title for the next rule."""
        existing = self._store.wiki_pages_by_category(WikiCategory.SELF_MODEL)
        return f"{_RULE_TITLE_PREFIX}{len(existing) + 1:04d}"

    def _prune_weakest(self, rules: list[WikiPage]) -> None:
        """Remove the rule with the lowest confidence to make room."""
        if not rules:
            return
        weakest = min(rules, key=lambda r: r.confidence)
        self._store.delete_wiki_page(weakest.title)
        logger.debug(
            "RuleStore: pruned weakest rule %r (confidence=%.2f)",
            weakest.title, weakest.confidence
        )
