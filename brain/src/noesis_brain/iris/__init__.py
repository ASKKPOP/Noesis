"""Iris — per-Nous Theory of Mind belief store (Phase 17).

Brain-private; belief content NEVER crosses the wire.
See .planning/research/v2.3/03-theory-of-mind-iris.md for architecture.

Beliefs are append-only: superseded rows get superseded_by FK.
Four audit events anchor lifecycle: iris.belief_revised, iris.context_invoked,
iris.contradiction_detected, iris.prior_seeded (allowlist positions 33–36).
3-keys-not-5: Grid injects nous_did at emit time.
"""
from noesis_brain.iris.store import IrisStore
from noesis_brain.iris.types import Belief, Dimension, DIMENSION_VALUES
from noesis_brain.iris.config import (
    IRIS_ELICIT_COOLDOWN,
    IRIS_CONTRADICTION_THRESHOLD,
    IRIS_BELIEFS_CAP,
    IRIS_CONTEXT_TOP_K,
)

__all__ = [
    "IrisStore",
    "Belief",
    "Dimension",
    "DIMENSION_VALUES",
    "IRIS_ELICIT_COOLDOWN",
    "IRIS_CONTRADICTION_THRESHOLD",
    "IRIS_BELIEFS_CAP",
    "IRIS_CONTEXT_TOP_K",
]
