"""RPC types — request/response/action definitions."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ActionType(str, Enum):
    """Actions the brain can tell the protocol layer to execute."""

    SPEAK = "speak"  # Send message to Agora channel
    DIRECT_MESSAGE = "direct_message"  # Send DM to specific Nous
    MOVE = "move"  # Move to a different region
    TRADE_REQUEST = "trade_request"  # Send trade offer
    TELOS_REFINED = "telos_refined"  # Phase 7 DIALOG-02 — Nous-initiated refinement after peer dialogue
    DRIVE_CROSSED = "drive_crossed"  # Phase 10a DRIVE-03 — Ananke threshold crossing; Grid dispatcher converts to ananke.drive_crossed audit event. Metadata shape: {drive, level, direction} (3 keys; Grid injects did and tick).
    BIOS_DEATH = "bios_death"  # Phase 10b BIOS-04 — starvation death signal; Grid plan 10b-05 emits bios.death audit event. Metadata shape: {cause, final_state_hash} (Grid injects did and tick).
    NOOP = "noop"  # Do nothing this cycle
    # Phase 12 Wave 3 — D-12-07 / VOTE-05: collective-law governance actions.
    # String values MUST match the Grid NousRunner switch cases exactly.
    PROPOSE = "propose"         # Open a proposal. Metadata: {body_text, deadline_tick, quorum_pct?, supermajority_pct?}
    VOTE_COMMIT = "vote_commit"  # Blind ballot commit. Metadata: {proposal_id, commit_hash}
    VOTE_REVEAL = "vote_reveal"  # Reveal nonce+choice. Metadata: {proposal_id, choice, nonce}
    # Phase 15 — Brain-internal only; NEVER forwarded to the Grid.
    # Rate-limited to max 1 each per on_tick() call.
    SKILL_LEARN = "skill_learn"  # Store a reusable text procedure. Metadata: {name, description, instructions, triggers}
    RULE_STORE = "rule_store"    # Store a strategic behavioral rule (SCOPE). Metadata: {content, confidence, source}
    # Phase 16 — Brain-internal only; travels as metadata inside DIRECT_MESSAGE payload.
    # Peer skill sharing (trust-gated). Metadata: {name, description, instructions, triggers, source_did}
    # The receiving BrainHandler strips the __skill_share prefix and routes to PeerSkillFilter.
    SKILL_SHARE = "skill_share"  # Peer-pushed skill offer. Metadata: {name, description, instructions, triggers, source_did}
    # Phase 16 — D-16-07: Hypnos sleep boundary events.
    # String values MUST match the Grid NousRunner switch cases exactly.
    # Both forwarded to Grid (unlike SKILL_LEARN/RULE_STORE/SKILL_SHARE which are Brain-internal).
    # 3-keys-not-5: Brain metadata carries 1 key {ltm_snapshot_hash};
    # Grid injects nous_did and tick at emit time.
    SLEEP_ENTERED = "sleep_entered"    # metadata: {ltm_snapshot_hash} (1 key)
    SLEEP_COMPLETED = "sleep_completed"  # metadata: {ltm_snapshot_hash} (1 key)
    # Phase 17 — D-17-06: Iris Theory of Mind lifecycle events.
    # String values MUST match the Grid NousRunner switch cases exactly.
    # All 4 are forwarded to the Grid (unlike SKILL_LEARN/RULE_STORE/SKILL_SHARE which are Brain-internal).
    # 3-keys-not-5: Brain metadata carries 1–3 keys; Grid injects nous_did and tick at emit time.
    IRIS_BELIEF_REVISED = "iris_belief_revised"              # Metadata: {target_did, belief_hash, dimension} (3 keys)
    IRIS_CONTEXT_INVOKED = "iris_context_invoked"            # Metadata: {belief_count} (1 key)
    IRIS_CONTRADICTION_DETECTED = "iris_contradiction_detected"  # Metadata: {target_did, contradiction_hash} (2 keys)
    IRIS_PRIOR_SEEDED = "iris_prior_seeded"                  # Metadata: {target_did, seed_event_hash} (2 keys)
    # Phase 18 — D-18-09: Grid-forwarded skill lifecycle events.
    # String values MUST match the Grid NousRunner switch cases exactly.
    # 3-keys-not-5: Brain metadata carries 1-3 keys; Grid injects learner_did and tick at emit time.
    SKILL_TAUGHT   = "skill_taught"    # Metadata: {skill_hash, teacher_did, parent_hash} (3 keys)
    SKILL_INFERRED = "skill_inferred"  # Metadata: {skill_hash, source_event_hash} (2 keys)
    SKILL_REJECTED = "skill_rejected"  # Metadata: {rejection_reason} (1 key); reason ∈ {low_trust, structural_invalid, quota_exceeded}
    # Phase 20 — Lore Commons.
    # String values MUST match the Grid NousRunner switch cases exactly (case-sensitive).
    # LORE_CONTRIBUTE and LORE_CITED are Grid-forwarded (sole-producer emitters).
    # LORE_DISCOVER, LORE_REQUEST, LORE_RESPONSE are Brain-internal only.
    LORE_CONTRIBUTE = "lore_contribute"  # Grid-forwarded. Brain metadata: {content_hash, category_tag} (2 keys; Grid injects contributor_did + tick -> 4-key payload)
    LORE_CITED      = "lore_cited"       # Grid-forwarded. Brain metadata: {content_hash} (1 key; Grid injects citing_did + tick -> 3-key payload)
    LORE_DISCOVER   = "lore_discover"    # Brain-internal; triggers background poll via asyncio.create_task; never forwarded to Grid
    LORE_REQUEST    = "lore_request"     # Brain-internal; becomes __lore_request:{hash} whisper text
    LORE_RESPONSE   = "lore_response"    # Brain-internal; decoded from __lore_response:{hash}:{base64} whisper


# JSON-RPC error codes
ERR_PARSE = -32700
ERR_INVALID_REQUEST = -32600
ERR_METHOD_NOT_FOUND = -32601
ERR_INVALID_PARAMS = -32602
ERR_INTERNAL = -32603
ERR_BRAIN_NOT_READY = -1
ERR_LLM_UNAVAILABLE = -2


@dataclass
class RPCRequest:
    """JSON-RPC 2.0 request."""

    method: str
    params: dict[str, Any] = field(default_factory=dict)
    id: int | str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"jsonrpc": "2.0", "method": self.method}
        if self.params:
            d["params"] = self.params
        if self.id is not None:
            d["id"] = self.id
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RPCRequest:
        return cls(
            method=data.get("method", ""),
            params=data.get("params", {}),
            id=data.get("id"),
        )


@dataclass
class RPCError:
    """JSON-RPC 2.0 error."""

    code: int
    message: str
    data: Any = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.data is not None:
            d["data"] = self.data
        return d


@dataclass
class RPCResponse:
    """JSON-RPC 2.0 response."""

    id: int | str | None = None
    result: Any = None
    error: RPCError | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"jsonrpc": "2.0", "id": self.id}
        if self.error:
            d["error"] = self.error.to_dict()
        else:
            d["result"] = self.result
        return d


@dataclass
class Action:
    """An action produced by the brain for the protocol layer to execute."""

    action_type: ActionType
    channel: str = ""  # Agora channel or target DID
    text: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "action_type": self.action_type.value,
            "channel": self.channel,
            "text": self.text,
            "metadata": self.metadata,
        }
