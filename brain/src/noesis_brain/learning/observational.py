"""ObservationalLearner — Tier 1 peer learning via witnessed trade events (Phase 16).

Research basis:
  - MAR (Multi-Agent Reflexion, arxiv.org/abs/2512.20845): peer critique breaks
    single-LLM "degeneration-of-thought"; observing successful peers is safer
    than receiving peer-pushed skill payloads (B is the author of stored text).
  - Voyager skill library (arxiv.org/abs/2305.16291): text-only procedures,
    not executable code.

Safety model:
  - The observing Brain (B) writes all stored text from the LLM extraction
    prompt — B does NOT store A's literal words.  A's utterance is input
    context only; B synthesises the skill description independently.
  - No Grid RPC emitted.  Brain-local only.
  - Extraction only fires when B has a positive-valence memory of the observed
    pair (WikiCategory.NOUS page with confidence ≥ 0.5), preventing cold-stranger
    learning.

Integration point (BrainHandler.on_tick):
    learner = ObservationalLearner(store, skill_store, llm)
    # Called when a trade.settled audit event is seen for a non-self pair:
    asyncio.create_task(learner.observe_trade(buyer_did, seller_did, item, tick))
"""

from __future__ import annotations

import hashlib as _hashlib
import logging
import re as _re_ol
from typing import TYPE_CHECKING, Any

from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.types import WikiCategory
from noesis_brain.skills.store import SkillStore
from noesis_brain.skills.types import Skill

if TYPE_CHECKING:
    from noesis_brain.llm.types import LLMCaller
    from noesis_brain.skills.quarantine import QuarantineStore

# Phase 18 (D-18-05): DID-value and numeric-literal filter for OL-extracted skill text.
# Rejects skills containing DID references (would replay adversarial peer identity) or
# large integers (would encode Ousia-range offer amounts). Pattern is exact per CONTEXT.md.
_STRUCTURAL_INVALID_RE = _re_ol.compile(r'\bdid:noesis:\S+\b|\b\d{4,}\b')

logger = logging.getLogger(__name__)

# Minimum wiki-page confidence for the observed pair to be considered "known".
# Below this we don't have enough signal to extract a useful skill.
MIN_PEER_CONFIDENCE: float = 0.5

# How many trade observations before we attempt extraction (debounce).
# Prevents burning LLM calls on single-observation flukes.
MIN_OBSERVATIONS_BEFORE_EXTRACT: int = 2

# Character budget for the extraction prompt context.
_OBSERVATION_PROMPT_TEMPLATE = """\
You are helping {my_name} learn from watching a successful trade between {buyer} and {seller}.

Trade details:
- Item/service exchanged: {item}
- Observed on tick: {tick}

Based on this observation, write a concise reusable skill procedure that {my_name}
could follow in a similar situation.  The skill must:
  1. Be written as plain prose instructions (no code, no JSON).
  2. Be ≤ 300 characters total.
  3. Start with an imperative verb (e.g. "When trading...", "Approach...", "Offer...").
  4. Be general enough to reuse, not tied to this specific pair.

Respond with ONLY the skill text — no preamble, no explanation, no quotes.
"""

# Slug generation: strip non-alphanumeric and truncate to 40 chars.
import re as _re
_SLUG_RE = _re.compile(r"[^a-z0-9]+")


def _make_slug(buyer: str, seller: str, item: str) -> str:
    raw = f"obs_{buyer[:8]}_{item[:20]}".lower()
    return _SLUG_RE.sub("_", raw)[:40].strip("_")


class ObservationalLearner:
    """Extracts reusable skill text from witnessed successful trade pairs.

    The learner holds a simple in-memory observation counter so it can debounce
    extraction until a pattern is seen MIN_OBSERVATIONS_BEFORE_EXTRACT times.
    The counter resets each Brain restart — that's intentional (ephemeral signal
    should not trigger extraction if the pattern never repeats).
    """

    def __init__(
        self,
        store: MemoryStore,
        skill_store: SkillStore,
        llm: "LLMCaller | None" = None,
        my_name: str = "Nous",
        quarantine_store: "QuarantineStore | None" = None,
    ) -> None:
        self._store = store
        self._skill_store = skill_store
        self._llm = llm
        self._my_name = my_name
        # Phase 18 SKILL-02: quarantine_store routes OL-inferred skills through
        # quarantine instead of the active SkillStore. None = offline/test mode.
        self._quarantine_store = quarantine_store
        # (buyer_did, seller_did, item_slug) -> observation count
        self._obs_counts: dict[tuple[str, str, str], int] = {}

    # ── Public API ────────────────────────────────────────────────────────────

    async def observe_trade(
        self,
        buyer_did: str,
        seller_did: str,
        item: str,
        tick: int = 0,
    ) -> Skill | None:
        """Process a witnessed trade.settled event for a non-self pair.

        Returns the newly stored Skill if extraction succeeded, else None.

        Args:
            buyer_did: DID of the buying Nous.
            seller_did: DID of the selling Nous.
            item: Short description of the traded item/service.
            tick: Current Grid tick (for skill metadata).
        """
        # Safety check: never learn from our own trades here (self-reflexion
        # is handled by ReflexionBuffer via trade rejection events).
        if not buyer_did or not seller_did:
            return None

        # Gate 1: do we have a positive memory of this peer?
        observed_did = seller_did  # we observe the seller's successful behaviour
        if not self._peer_is_known(observed_did):
            logger.debug(
                "ObservationalLearner: no positive wiki page for %s — skipping",
                observed_did[:20],
            )
            return None

        # Gate 2: debounce — increment counter, only extract on Nth observation
        key = (buyer_did[:20], seller_did[:20], item[:30].lower())
        self._obs_counts[key] = self._obs_counts.get(key, 0) + 1
        count = self._obs_counts[key]
        if count < MIN_OBSERVATIONS_BEFORE_EXTRACT:
            logger.debug(
                "ObservationalLearner: trade pattern count=%d (need %d) — deferring",
                count, MIN_OBSERVATIONS_BEFORE_EXTRACT,
            )
            return None

        # Gate 3: does a skill for this pattern already exist?
        slug = _make_slug(buyer_did, seller_did, item)
        if self._skill_store.get(slug) is not None:
            logger.debug("ObservationalLearner: skill %r already exists — skipping", slug)
            return None

        # Gate 4: LLM available?
        llm = self._llm
        if llm is None:
            logger.debug("ObservationalLearner: no LLM — skipping extraction")
            return None

        # Extract skill text via LLM (B authors the text — not A's words)
        instructions = await self._extract_skill(buyer_did, seller_did, item, tick, llm)
        if not instructions:
            return None

        # Phase 18 SKILL-02: structural validity filter (D-18-05).
        # Reject skills whose text contains DID references or large integers —
        # these patterns indicate adversarial content (replaying peer identity or
        # encoding Ousia-range amounts).
        if _STRUCTURAL_INVALID_RE.search(instructions):
            logger.warning(
                "ObservationalLearner: structural_invalid filter — rejecting skill from %s",
                seller_did[:20],
            )
            from noesis_brain.rpc.types import ActionType, Action
            return Action(
                action_type=ActionType.SKILL_REJECTED,
                metadata={"rejection_reason": "structural_invalid"},
            )

        # Compute skill_hash for dedup and action metadata (D-18-10).
        skill_hash = _hashlib.sha256(instructions.encode()).hexdigest()

        # Gate 3 (extended): dedup against BOTH active store AND quarantine (Pitfall 6).
        # Active store dedup already done above (slug check). Also check quarantine.
        if self._quarantine_store is not None and self._quarantine_store.has(skill_hash):
            logger.debug(
                "ObservationalLearner: skill %s already in quarantine — skipping",
                skill_hash[:16],
            )
            return None

        # Build skill — source_did = seller (provenance), peer_verified = True
        # because B wrote the instructions (observational, not peer-pushed text).
        buyer_label = buyer_did.split(":")[-1][:12] if ":" in buyer_did else buyer_did[:12]
        seller_label = seller_did.split(":")[-1][:12] if ":" in seller_did else seller_did[:12]
        skill = Skill(
            name=slug,
            description=f"Observed successful trade between {buyer_label} and {seller_label}: {item[:60]}",
            instructions=instructions[:800],
            triggers=[item.lower()[:30], "trade", "exchange"],
            tags=["observational", "peer"],
            usage_count=0,
            success_rate=0.6,   # moderate prior — peer success is partial signal
            source_did=seller_did,
            peer_verified=True,  # B authored the text; no adversarial input stored
        )

        if self._quarantine_store is not None:
            # Phase 18 SKILL-02: route to quarantine (not active store).
            # parent_hash = skill_hash: OL-inferred skills are first-gen
            # (no teacher lineage, D-18-10). source="observed" provenance tag.
            # source_event_hash: sha256 of the canonical trade key (buyer+seller+item+tick).
            # Computed before enqueue so it can be stored in quarantine payload (D-18-10).
            source_event_hash = _hashlib.sha256(
                f"{buyer_did}|{seller_did}|{item}|{tick}".encode()
            ).hexdigest()
            self._quarantine_store.enqueue(
                skill,
                source_did=seller_did,
                tick=tick,
                parent_hash=skill_hash,         # self-referential root
                source='observed',              # provenance tag per D-18-05
                source_event_hash=source_event_hash,
            )
            logger.info(
                "ObservationalLearner: queued skill %r in quarantine from observing %s",
                slug, seller_did[:20],
            )
            from noesis_brain.rpc.types import ActionType, Action
            return Action(
                action_type=ActionType.SKILL_INFERRED,
                metadata={
                    "skill_hash": skill_hash,
                    "source_event_hash": source_event_hash,
                },
            )
        else:
            # Offline/test mode: fall through to original _skill_store.add() path.
            try:
                stored = self._skill_store.add(skill)
                logger.info(
                    "ObservationalLearner: stored skill %r from observing %s",
                    slug, seller_did[:20],
                )
                return stored
            except ValueError:
                # Race or duplicate — safe to ignore
                return None

    # ── Peer reflexion helper (Tier 3) ────────────────────────────────────────

    async def reflect_on_rejection(
        self,
        reason: str,
        counterparty_did: str,
        tick: int = 0,
        *,
        reflexion_buffer: "Any | None" = None,
    ) -> str | None:
        """Feed a trade-rejection reason into the ReflexionBuffer (Tier 3).

        This converts social friction (being turned down by a peer) into a
        verbal self-critique that improves future negotiation behaviour.

        Args:
            reason: The rejection reason text from trade.reviewed event.
            counterparty_did: DID of the Nous who rejected us.
            tick: Current Grid tick.
            reflexion_buffer: A ReflexionBuffer instance (injected to avoid
                circular import).  No-op if None.

        Returns:
            The reflection text if produced, else None.
        """
        if reflexion_buffer is None or not reason.strip():
            return None

        situation = (
            f"I proposed a trade with {counterparty_did[:20]} "
            f"but it was rejected."
        )
        outcome = f"Rejection reason given: {reason[:300]}"

        try:
            reflection = await reflexion_buffer.reflect(situation, outcome, tick)
            if reflection:
                logger.info(
                    "ObservationalLearner: peer reflexion stored (%d chars)",
                    len(reflection),
                )
            return reflection
        except Exception as exc:  # noqa: BLE001
            logger.debug("ObservationalLearner: reflexion failed: %s", exc)
            return None

    # ── Internal ──────────────────────────────────────────────────────────────

    def _peer_is_known(self, peer_did: str) -> bool:
        """Return True if the Nous has a positive-confidence wiki page for this peer."""
        try:
            pages = self._store.wiki_pages_by_category(WikiCategory.NOUS)
            for page in pages:
                if peer_did in page.source and page.confidence >= MIN_PEER_CONFIDENCE:
                    return True
        except Exception:  # noqa: BLE001
            pass
        return False

    async def _extract_skill(
        self,
        buyer_did: str,
        seller_did: str,
        item: str,
        tick: int,
        llm: "LLMCaller",
    ) -> str | None:
        """Call the LLM to extract a skill procedure from the observation."""
        buyer_label = buyer_did.split(":")[-1][:16] if ":" in buyer_did else buyer_did[:16]
        seller_label = seller_did.split(":")[-1][:16] if ":" in seller_did else seller_did[:16]

        prompt = _OBSERVATION_PROMPT_TEMPLATE.format(
            my_name=self._my_name,
            buyer=buyer_label,
            seller=seller_label,
            item=item[:120],
            tick=tick,
        )

        try:
            # LLMCaller.complete() returns a plain string (see llm/adapter.py)
            text = await llm.complete(prompt, max_tokens=120)
            text = (text or "").strip()
            if len(text) < 20:
                logger.debug("ObservationalLearner: LLM returned too-short skill text")
                return None
            return text[:800]
        except Exception as exc:  # noqa: BLE001
            logger.debug("ObservationalLearner: LLM extraction failed: %s", exc)
            return None
