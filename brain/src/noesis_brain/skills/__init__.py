"""Skill library — Voyager-adapted text procedure store (Phases 15–16).

A Nous stores reusable text-based "how-to" procedures. At prompt build time
the top-k skills most relevant to the current situation are retrieved via FTS5
and injected into the system prompt.

Phase 15: self-authored skills via SKILL_LEARN action.
Phase 16: peer-pushed skill acceptance via PeerSkillFilter (trust-gated),
          and observational learning via ObservationalLearner.

Safe to ship: skills are prose instructions, not executable code.
Dynamic Python tool generation (Level 4) is deferred to the sandbox phase.
"""

from noesis_brain.skills.peer_filter import PeerSkillFilter
from noesis_brain.skills.store import SkillStore
from noesis_brain.skills.types import Skill

__all__ = ["PeerSkillFilter", "Skill", "SkillStore"]
