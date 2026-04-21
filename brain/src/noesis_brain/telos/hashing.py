"""Deterministic Telos-hashing utility — Phase 5 REV-01 support (D-05).

Mirrors grid/src/audit/chain.ts:173-183 canonical-serialize-then-SHA-256 pattern.
Phase 7 TelosRegistry will import compute_active_telos_hash directly — keep the
canonical field order stable. ANY change to the canonicalization is a breaking
change for cross-phase hash compatibility (v2.1 zero-diff invariant at Phase 7
will compare Grid-recorded hashes against brain-recomputed hashes).
"""

from __future__ import annotations

import hashlib
import json
from typing import Iterable

from .types import Goal


def compute_active_telos_hash(goals: Iterable[Goal]) -> str:
    """Compute deterministic 64-hex SHA-256 over the proposer's active goals only.

    Hashing input is canonical JSON (sort_keys=True, separators=(",", ":")) over a list
    of dicts containing ONLY the semantic goal fields. Inactive goals are excluded per
    PHILOSOPHY §5 (only the active-goal set constrains trades — completed/abandoned/
    blocked goals no longer shape intent).

    Returns a lowercase 64-character hex digest (matches grid-side regex /^[a-f0-9]{64}$/).
    """
    active_goals = [
        {
            "description": g.description,
            "goal_type": g.goal_type.value,
            "status": g.status.value,
            "priority": g.priority,
            "progress": g.progress,
        }
        for g in goals
        if g.is_active()
    ]
    canonical = json.dumps(active_goals, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
