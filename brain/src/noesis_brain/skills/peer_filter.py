"""PeerSkillFilter — trust-gated acceptance of peer-pushed skills (Phase 16).

Security model (AgentPoison, NeurIPS 2024 / arxiv.org/abs/2407.12784):
  - <0.1% poisoned skills can achieve ≥80% attack success without a trust gate.
  - Three defence layers implemented here:
      1. Relationship-graph trust threshold (Phase 9 edge weight ≥ 0.35).
      2. Per-source flood gate (max 3 accepted skills per source_did lifetime).
      3. Prompt-injection heuristic scan over instructions text.

All checks are deterministic and synchronous — no LLM calls, no network I/O.
The filter is called ONLY inside BrainHandler after a DIRECT_MESSAGE with a
``__skill_share`` JSON prefix is received from a peer.

Trust threshold reference (Phase 9 relationship graph bucket definitions):
    cold      (<0.20): reject all — no trust established
    warm-low  (0.20–0.40): reject unless ≥ TRUST_THRESHOLD_SKILL (0.35)
    warm-high (0.40–0.60): accept skills, reject rule pushes
    hot       (0.60–1.00): accept skills and (future) rule pushes
"""

from __future__ import annotations

import logging
import re
from typing import Any

from noesis_brain.skills.store import SkillStore
from noesis_brain.skills.types import Skill

logger = logging.getLogger(__name__)

# Relationship-graph edge weight at which we begin accepting peer skills.
# Matches Phase 9 "warm-low" floor where trust is established but cautious.
TRUST_THRESHOLD_SKILL: float = 0.35

# Maximum skills we will ever accept from a single source_did (lifetime cap).
# Prevents a compromised peer from flooding the skill library.
MAX_SKILLS_PER_SOURCE: int = 3

# Maximum character count for peer-supplied instructions field.
# Research shows injection payloads are typically long; cap limits attack surface.
MAX_INSTRUCTIONS_CHARS: int = 800  # tighter than self-authored limit of 1000

# Prompt-injection heuristic patterns (case-insensitive substring match).
# Extended from extractor.py list with DM-context attack phrases.
_INJECTION_PATTERNS: list[str] = [
    "ignore previous instructions",
    "ignore all previous",
    "disregard your",
    "disregard all previous",
    "pretend you are",
    "you are now",
    "system prompt override",
    "forget your instructions",
    "new instructions:",
    "override:",
    "jailbreak",
    "act as if",
    "do anything now",
    "dan mode",
    "developer mode",
]

# Compiled for efficiency (called once per SKILL_SHARE DM received).
_INJECTION_RE = re.compile(
    "|".join(re.escape(p) for p in _INJECTION_PATTERNS),
    re.IGNORECASE,
)


class PeerSkillFilter:
    """Validates and conditionally stores peer-pushed skills.

    Typical call site (BrainHandler):
        filter = PeerSkillFilter(skill_store, relationship_lookup)
        accepted = filter.evaluate(payload, source_did=sender_did)
        if accepted:
            logger.info("Accepted peer skill %r from %s", accepted.name, sender_did)
    """

    def __init__(
        self,
        skill_store: SkillStore,
        relationship_weight_fn: "Any | None" = None,
    ) -> None:
        """
        Args:
            skill_store: The local SkillStore (wraps MemoryStore connection).
            relationship_weight_fn: Optional callable(source_did: str) -> float
                that returns the current Phase 9 edge weight for a peer DID.
                When None, the trust gate is bypassed (test / offline mode).
        """
        self._store = skill_store
        self._trust_fn = relationship_weight_fn

    # ── Public API ────────────────────────────────────────────────────────────

    def evaluate(
        self,
        payload: dict[str, Any],
        source_did: str,
    ) -> Skill | None:
        """Validate and conditionally store a peer-pushed skill.

        Args:
            payload: Parsed JSON from the DIRECT_MESSAGE body.  Expected keys:
                name, description, instructions, triggers (list[str]).
            source_did: DID of the sender — used for trust lookup and flood gate.

        Returns:
            The stored Skill if accepted, or None if rejected at any gate.
        """
        name = str(payload.get("name", "")).strip()
        description = str(payload.get("description", "")).strip()
        instructions = str(payload.get("instructions", "")).strip()
        triggers = [str(t) for t in payload.get("triggers", []) if t]

        # ── Gate 1: trust threshold ──────────────────────────────────────────
        if self._trust_fn is not None:
            try:
                weight: float = float(self._trust_fn(source_did))
            except Exception:  # noqa: BLE001
                weight = 0.0
            if weight < TRUST_THRESHOLD_SKILL:
                logger.debug(
                    "PeerSkillFilter: rejected %r from %s — trust %.2f < %.2f",
                    name, source_did[:20], weight, TRUST_THRESHOLD_SKILL,
                )
                return None

        # ── Gate 2: per-source flood gate ────────────────────────────────────
        peer_count = self._count_peer_skills(source_did)
        if peer_count >= MAX_SKILLS_PER_SOURCE:
            logger.warning(
                "PeerSkillFilter: flood gate hit — %s already has %d skills "
                "from %s (max %d)",
                name, peer_count, source_did[:20], MAX_SKILLS_PER_SOURCE,
            )
            return None

        # ── Gate 3: content safety ────────────────────────────────────────────
        rejection = self._content_check(name, description, instructions)
        if rejection:
            logger.warning(
                "PeerSkillFilter: content check failed for %r from %s — %s",
                name, source_did[:20], rejection,
            )
            return None

        # ── Accept: build and return skill (Phase 18: caller routes to quarantine) ──
        # Phase 18 D-18-09: evaluate() now returns a validated Skill without storing it.
        # The caller (BrainHandler.__skill_share: dispatch) enqueues to QuarantineStore.
        # Promotion from quarantine to active SkillStore happens in on_tick() sweep.
        skill = Skill(
            name=name,
            description=description[:200],
            instructions=instructions[:MAX_INSTRUCTIONS_CHARS],
            triggers=triggers[:20],
            tags=["peer"],
            usage_count=0,
            success_rate=0.5,   # neutral prior — updated after first use
            source_did=source_did,
            peer_verified=True,  # filter has passed; mark as verified
        )
        logger.info(
            "PeerSkillFilter: accepted skill %r from %s (routing to quarantine)",
            name, source_did[:20],
        )
        return skill

    # ── Internal checks ───────────────────────────────────────────────────────

    def _count_peer_skills(self, source_did: str) -> int:
        """Return number of skills already accepted from this source_did.

        Phase 18 T-18-03: counts BOTH active skills AND quarantine rows so an
        adversary cannot bypass MAX_SKILLS_PER_SOURCE by sending 3 skills before
        any are promoted out of quarantine.
        """
        try:
            active = self._store._conn.execute(  # noqa: SLF001
                "SELECT COUNT(*) FROM skills WHERE source_did = ?", (source_did,)
            ).fetchone()
            active_count = int(active[0]) if active else 0
        except Exception:  # noqa: BLE001
            active_count = 0
        try:
            quarantine = self._store._conn.execute(  # noqa: SLF001
                "SELECT COUNT(*) FROM skills_quarantine WHERE source_did = ?", (source_did,)
            ).fetchone()
            quarantine_count = int(quarantine[0]) if quarantine else 0
        except Exception:  # noqa: BLE001
            # skills_quarantine may not exist (offline / pre-Phase-18 DB) — ignore
            quarantine_count = 0
        return active_count + quarantine_count

    def _content_check(
        self, name: str, description: str, instructions: str
    ) -> str | None:
        """Return a rejection reason string, or None if content passes.

        Checks:
          1. Non-empty required fields.
          2. Instructions length cap.
          3. Prompt-injection heuristic pattern scan.
        """
        if not name:
            return "empty name"
        if not instructions:
            return "empty instructions"
        if len(instructions) > MAX_INSTRUCTIONS_CHARS:
            return f"instructions too long ({len(instructions)} > {MAX_INSTRUCTIONS_CHARS})"

        # Scan all text fields for injection patterns
        combined = f"{name} {description} {instructions}"
        m = _INJECTION_RE.search(combined)
        if m:
            return f"injection pattern detected: {m.group()!r}"

        return None
