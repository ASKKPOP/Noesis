"""Iris module configuration constants — Phase 17.

All constants are module-level (locked) — not injectable, not overridable at runtime.
Mirrors brain/src/noesis_brain/hypnos/config.py discipline.
"""
from __future__ import annotations

# Minimum subjective ticks between elicit() calls per (nous_did, target_did) pair.
# Mirrors SLEEP_MIN_INTERVAL = 30 from hypnos/config.py — same pattern.
IRIS_ELICIT_COOLDOWN: int = 20

# Confidence delta threshold for contradiction flag.
# If |existing.confidence - new.confidence| > threshold AND content differs → contradiction.
IRIS_CONTRADICTION_THRESHOLD: float = 0.3

# Maximum active beliefs per (target_did, dimension) pair.
# Eviction by LRU-cap: lowest (confidence * recency_decay) superseded, NEVER deleted.
IRIS_BELIEFS_CAP: int = 10

# Top-K beliefs returned by context_for() per peer.
IRIS_CONTEXT_TOP_K: int = 5
