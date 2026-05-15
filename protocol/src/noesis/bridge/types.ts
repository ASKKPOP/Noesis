/**
 * Bridge types — JSON-RPC communication between protocol and brain.
 */

export interface RPCRequest {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, unknown>;
    id?: number | string;
}

export interface RPCResponse {
    jsonrpc: '2.0';
    id?: number | string | null;
    result?: unknown;
    error?: RPCError;
}

export interface RPCError {
    code: number;
    message: string;
    data?: unknown;
}

export interface BrainAction {
    /** Action type string — MUST match ActionType enum values in brain/src/noesis_brain/rpc/types.py exactly. */
    action_type:
        | 'speak'
        | 'direct_message'
        | 'move'
        | 'trade_request'
        | 'noop'
        // Phase 7: Nous-initiated telos refinement after peer dialogue.
        | 'telos_refined'
        // Phase 10a: Ananke drive threshold crossing (Grid injects nous_did + tick).
        | 'drive_crossed'
        // Phase 10b: Bios starvation death signal.
        | 'bios_death'
        // Phase 12: Governance voting lifecycle.
        | 'propose'
        | 'vote_commit'
        | 'vote_reveal'
        // Phase 17 — D-17-10: Iris Theory of Mind lifecycle events (forwarded to Grid).
        | 'iris_belief_revised'
        | 'iris_context_invoked'
        | 'iris_contradiction_detected'
        | 'iris_prior_seeded';
    channel: string;
    text: string;
    metadata: Record<string, unknown>;
}

export interface MessageParams {
    sender_name: string;
    sender_did: string;
    channel: string;
    text: string;
}

export interface TickParams {
    tick: number;
    epoch: number;
}

export interface EventParams {
    event_type: string;
    data: Record<string, unknown>;
}

/**
 * Phase 6 AGENCY-02: Normalized memory entry shape (H2 Reviewer query).
 *
 * Mirrors BrainHandler._normalise_memory_entry on the Python side. Full memory
 * contents (importance, source_did, location, tick) are deliberately dropped
 * at the RPC boundary — the operator sees only the human-readable summary plus
 * the bare metadata needed to locate the event in time.
 *
 * The broader invariant: full memory stays in Brain (PHILOSOPHY §1 sovereignty).
 */
export interface MemoryEntry {
    /** ISO-8601 timestamp string. */
    timestamp: string;
    /** Memory kind: 'observation' | 'conversation' | 'event' | 'reflection'. */
    kind: string;
    /** Truncated content — no raw thoughts, no reflections, no prompts. */
    summary: string;
}

/**
 * Phase 6 AGENCY-02: Normalized memory entry shape (H2 Reviewer query).
 *
 * Mirrors BrainHandler._normalise_memory_entry on the Python side. Full memory
 * contents (importance, source_did, location, tick) are deliberately dropped
 * at the RPC boundary — the operator sees only the human-readable summary plus
 * the bare metadata needed to locate the event in time.
 *
 * The broader invariant: full memory stays in Brain (PHILOSOPHY §1 sovereignty).
 */
export interface MemoryEntry {
    /** ISO-8601 timestamp string. */
    timestamp: string;
    /** Memory kind: 'observation' | 'conversation' | 'event' | 'reflection'. */
    kind: string;
    /** Truncated content — no raw thoughts, no reflections, no prompts. */
    summary: string;
}
