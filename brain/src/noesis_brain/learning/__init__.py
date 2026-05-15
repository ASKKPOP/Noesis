"""Self-modification and peer learning layer (Phases 15–16).

Three proven mechanisms, all operating without LLM weight updates:

1. **ReflexionBuffer** — verbal post-hoc self-critique stored as
   MemoryType.REFLECTION entries and injected into the next prompt.
   Evidence: GPT-4 HumanEval 80% → 91% pass@1 (arxiv.org/abs/2303.11366).

2. **RuleStore** — strategic behavioral guidelines accumulated as
   WikiCategory.SELF_MODEL wiki pages, capped at 10 (SCOPE pattern).
   Evidence: 14.23% → 38.64% task success rate (arxiv.org/abs/2512.15374).

3. **ObservationalLearner** — Tier 1 peer learning (Phase 16).
   Watches trade.settled events for non-self pairs; the Brain (B) uses
   an LLM to author a skill procedure based on A's witnessed success.
   B writes all stored text — no adversarial peer input is stored verbatim.
   Evidence: MAR / multi-agent reflexion (arxiv.org/abs/2512.20845).

All are Brain-local. No Grid RPC involved. No allowlist additions.
"""

from noesis_brain.learning.observational import ObservationalLearner
from noesis_brain.learning.reflexion import ReflexionBuffer
from noesis_brain.learning.rules import RuleStore

__all__ = ["ObservationalLearner", "ReflexionBuffer", "RuleStore"]
