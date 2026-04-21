/**
 * Broadcast Allowlist — sovereignty enforcement boundary.
 *
 * Rationale (PHILOSOPHY.md §1, §4, §7): Nous have sovereign intelligence,
 * sovereign memory, and are observed without being controlled. That means
 * LLM prompts, wiki contents, reflections, raw thoughts, and emotion
 * deltas MUST NEVER leave the Grid process via any broadcast channel.
 *
 * This module is consulted by the Phase 2 WsHub BEFORE forwarding any
 * AuditChain entry to WebSocket clients. It enforces two invariants:
 *
 *   1. Default-deny: only explicitly-listed event types are broadcast.
 *      Any new event type added to the chain stays server-side by default.
 *
 *   2. Payload lint: even within an allowlisted event type, the payload
 *      must not contain keys that match known "inner life" field names.
 *      If it does, that's a bug at the producer — the sanitization must
 *      happen at the NousRunner boundary, not here. This module is the
 *      last line of defense, not the first.
 *
 * See: PITFALLS.md §C2 (critical pitfall — privacy leak).
 */

/** Locked allowlist (v1 + Phase 5 + Phase 6 + Phase 7) — exactly these 17 event types.
 *  v1 (Phase 1, per 01-CONTEXT.md): 10 events.
 *  Phase 5 (REV-02): +1 'trade.reviewed' — externally observable reviewer verdict;
 *  payload shape D-03, 3 keys on pass / 5 keys on fail, all privacy-clean (see D-12 test).
 *  Phase 6 (AGENCY-02, AGENCY-03): +5 operator.* events (D-10 tuple order locked).
 *  Phase 7 (DIALOG-02): +1 'telos.refined' at position 17 — Nous-initiated
 *  hash-only refinement after peer dialogue. Tuple ORDER is locked; any
 *  reorder fails grid/test/audit/allowlist-seventeen.test.ts.
 */
const ALLOWLIST_MEMBERS: readonly string[] = [
    'nous.spawned',
    'nous.moved',
    'nous.spoke',
    'nous.direct_message', // metadata only — payload must not contain message body
    'trade.proposed',
    'trade.reviewed',      // Phase 5 (REV-02)
    'trade.settled',
    'law.triggered',
    'tick',
    'grid.started',
    'grid.stopped',
    // Phase 6 (AGENCY-02, AGENCY-03) — operator agency events.
    // Shared payload contract: { tier, action, operator_id, target_did? }
    // All five emitted from grid/src/api/operator/* handlers after
    // appendOperatorEvent() validates tier-required invariant (D-13).
    'operator.inspected',      // H2 Reviewer — memory query
    'operator.paused',         // H3 Partner  — WorldClock.pause()
    'operator.resumed',        // H3 Partner  — WorldClock.resume()
    'operator.law_changed',    // H3 Partner  — LogosEngine add/amend/repeal
    'operator.telos_forced',   // H4 Driver   — hash-only diff, no goal contents
    // Phase 7 (DIALOG-02) — Nous-initiated telos refinement after peer dialogue.
    // Payload shape: { did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id }
    // Emitted ONLY via appendTelosRefined() (grid/src/audit/append-telos-refined.ts).
    'telos.refined',
] as const;

/**
 * Frozen read-only set. Consumers MUST NOT mutate this at runtime.
 * Dynamic allowlist toggling is deferred to Phase 4+ per 01-CONTEXT.md.
 *
 * Note: `Object.freeze` alone does NOT prevent `Set.prototype.add/delete/clear`
 * (they mutate internal slots, not properties). We override those three methods
 * to throw TypeError, then freeze the object so the overrides themselves cannot
 * be reassigned. Together this enforces immutability both at the type-system
 * level (ReadonlySet<string>) and at runtime.
 */
function buildFrozenAllowlist(members: readonly string[]): ReadonlySet<string> {
    const set = new Set(members);
    const throwFrozen = (): never => {
        throw new TypeError('ALLOWLIST is frozen; cannot mutate at runtime');
    };
    Object.defineProperty(set, 'add', { value: throwFrozen, writable: false, configurable: false });
    Object.defineProperty(set, 'delete', { value: throwFrozen, writable: false, configurable: false });
    Object.defineProperty(set, 'clear', { value: throwFrozen, writable: false, configurable: false });
    return Object.freeze(set) as ReadonlySet<string>;
}

export const ALLOWLIST: ReadonlySet<string> = buildFrozenAllowlist(ALLOWLIST_MEMBERS);

/** Default-deny membership check. */
export function isAllowlisted(eventType: string): boolean {
    return ALLOWLIST.has(eventType);
}

/**
 * Case-insensitive regex matching forbidden key substrings. Any payload
 * key that matches ANYWHERE (e.g., `user_prompt`, `Prompting`) is rejected.
 */
export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta/i;

export interface PrivacyCheckResult {
    ok: boolean;
    /** Dotted key path (e.g. "meta.prompt" or "thought") identifying the first violation; undefined when ok=true. */
    offendingPath?: string;
    /** The matched forbidden keyword from FORBIDDEN_KEY_PATTERN; undefined when ok=true. */
    offendingKeyword?: string;
}

/**
 * Recursively walks `payload` (objects and arrays). Returns the FIRST
 * key-path whose key matches FORBIDDEN_KEY_PATTERN (case-insensitive).
 * This is intended for dev-mode assertion and for test suites enforcing
 * the sovereignty invariant at the AuditChain producer boundary.
 */
export function payloadPrivacyCheck(payload: unknown): PrivacyCheckResult {
    return walk(payload, '') ?? { ok: true };
}

function walk(node: unknown, path: string): PrivacyCheckResult | null {
    if (node === null || typeof node !== 'object') return null;

    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
            const childPath = path === '' ? String(i) : `${path}.${i}`;
            const r = walk(node[i], childPath);
            if (r) return r;
        }
        return null;
    }

    for (const key of Object.keys(node as Record<string, unknown>)) {
        const match = key.match(FORBIDDEN_KEY_PATTERN);
        const childPath = path === '' ? key : `${path}.${key}`;
        if (match) {
            return {
                ok: false,
                offendingPath: childPath,
                offendingKeyword: match[0].toLowerCase(),
            };
        }
        const r = walk((node as Record<string, unknown>)[key], childPath);
        if (r) return r;
    }
    return null;
}
