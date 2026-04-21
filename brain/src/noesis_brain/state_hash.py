"""
state_hash — component-hash helpers for AGENCY-05 pre-deletion forensics.

The Brain computes 4 component hashes over the Nous's persistent state:
    - psyche_hash:        personality profile + archetype + values + style
    - thymos_hash:        current emotional state (all emotion intensities)
    - telos_hash:         active goals (sorted by description, deterministic)
    - memory_stream_hash: ordered memory entries (stable id + content digest)

The Brain does NOT compose a 5th "pre_deletion_state_hash" — that
authority lives in Grid (D-03). A compromised Brain returning 4 forged
component hashes still cannot forge a consistent composed hash because
the composition algorithm lives outside its trust boundary.

Functions take a BrainHandler instance (the Brain's single source of truth
for all subsystem state). The handler exposes .psyche, .thymos, .telos,
and .memory which are the canonical field owners.

See: 08-CONTEXT D-03, D-05, D-07, D-10.
"""
from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from noesis_brain.rpc.handler import BrainHandler


def _sha256_canonical(obj: Any) -> str:
    """SHA-256 over canonical JSON (sort_keys=True, no whitespace)."""
    canonical = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def hash_psyche(handler: "BrainHandler") -> str:
    """Hash of the Nous's identity-level Psyche fields.

    Covers: personality profile (all 6 dimensions), archetype, values,
    communication_style. These fields rarely change — the hash captures
    the Nous's identity at deletion time.
    """
    psyche = handler.psyche
    profile = psyche.personality
    return _sha256_canonical({
        "archetype": psyche.archetype,
        "communication_style": psyche.communication_style.value
            if hasattr(psyche.communication_style, "value")
            else str(psyche.communication_style),
        "personality": {
            "agreeableness": profile.agreeableness,
            "ambition": profile.ambition,
            "conscientiousness": profile.conscientiousness,
            "extraversion": profile.extraversion,
            "openness": profile.openness,
            "resilience": profile.resilience,
        },
        "values": sorted(psyche.values),
    })


def hash_thymos(handler: "BrainHandler") -> str:
    """Hash of the Nous's current affective state.

    Covers: all 6 emotion intensities (sorted by emotion name for
    determinism regardless of dict insertion order).
    """
    thymos = handler.thymos
    emotions: dict[str, float] = {}
    for emotion, state in thymos.mood.emotions.items():
        name = emotion.value if hasattr(emotion, "value") else str(emotion)
        emotions[name] = float(state.intensity)
    return _sha256_canonical({
        "baseline_mood": thymos.mood.baseline_mood,
        "emotions": emotions,
    })


def hash_telos(handler: "BrainHandler") -> str:
    """Hash of the active-goals set, sorted by description for determinism.

    Covers: all active goals (description + priority). Sorting by
    description provides a stable order independent of insertion order.
    """
    goals = sorted(
        (
            {
                "description": g.description,
                "priority": float(getattr(g, "priority", 0.0)),
            }
            for g in handler.telos.active_goals()
        ),
        key=lambda g: g["description"],
    )
    return _sha256_canonical({"active_goals": goals})


def hash_memory_stream(handler: "BrainHandler") -> str:
    """Hash of the memory-stream entries.

    If memory is None (Brain running without persistence), returns the
    hash of an empty entries list — a valid sentinel value. Each entry
    contributes its database id (if set) or index + a content digest.
    Entries are ordered oldest-first (as returned by .recent()).
    """
    if handler.memory is None:
        return _sha256_canonical({"entries": []})

    try:
        # recent() returns newest-first; reverse for oldest-first ordering
        recent = handler.memory.recent(limit=1000)
        entries_ordered = list(reversed(recent))
    except Exception:
        entries_ordered = []

    entries = []
    for idx, entry in enumerate(entries_ordered):
        # Use db id if set, else fall back to index-based stable id
        if isinstance(entry, dict):
            content = str(entry.get("content") or "")
            entry_id = entry.get("id") or idx
        else:
            content = str(getattr(entry, "content", ""))
            entry_id = getattr(entry, "id", None)
            if entry_id is None:
                entry_id = idx
        entries.append({
            "id": entry_id,
            "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        })

    return _sha256_canonical({"entries": entries})


def compute_pre_deletion_state_hash(handler: "BrainHandler") -> dict[str, str]:
    """
    Return the 4-key component-hash tuple that Grid's combineStateHash()
    will compose into pre_deletion_state_hash.

    Returns:
        dict with EXACTLY 4 keys: psyche_hash, thymos_hash, telos_hash,
        memory_stream_hash — each a 64-hex SHA-256 digest.

    The Brain MUST NOT add a 5th "state_hash" or "pre_deletion_state_hash"
    key — Grid is the sole authority on composition (D-03). Returning 5
    keys would fail the contract test in test_state_hash.py.
    """
    return {
        "psyche_hash":        hash_psyche(handler),
        "thymos_hash":        hash_thymos(handler),
        "telos_hash":         hash_telos(handler),
        "memory_stream_hash": hash_memory_stream(handler),
    }
