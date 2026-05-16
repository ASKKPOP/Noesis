"""Hypnos module configuration constants — Phase 16.

All constants are module-level (locked) — not injectable, not overridable at runtime.
Mirrors brain/src/noesis_brain/iris/config.py discipline.
Wall-clock FORBIDDEN: no wall-clock imports allowed in this module (see T-16-03).
"""
from __future__ import annotations

# Hebbian learning rate: Δw = η × pre × post (binary activation → Δw = η). D-16-04.
HYPNOS_ETA: float = 0.01

# SHY downscale factor: w ← w × σ after each Hebbian pass. D-16-04.
# Geometric bound: max_weight ≈ η / (1 − σ) = 0.01 / 0.05 = 0.2.
HYPNOS_SIGMA: float = 0.95

# Top-K LTM concept nodes injected into system prompt. D-16-04.
HYPNOS_TOP_K: int = 5

# Minimum ticks between sleep cycles. D-16-02.
SLEEP_MIN_INTERVAL: int = 30
