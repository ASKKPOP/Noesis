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

/** Locked allowlist (v1 + Phase 5 + Phase 6 + Phase 7 + Phase 8 + Phase 10a + Phase 10b + Phase 11) — exactly these 22 event types.
 *  v1 (Phase 1, per 01-CONTEXT.md): 10 events.
 *  Phase 5 (REV-02): +1 'trade.reviewed' — externally observable reviewer verdict;
 *  payload shape D-03, 3 keys on pass / 5 keys on fail, all privacy-clean (see D-12 test).
 *  Phase 6 (AGENCY-02, AGENCY-03): +5 operator.* events (D-10 tuple order locked).
 *  Phase 7 (DIALOG-02): +1 'telos.refined' at position 17 — Nous-initiated
 *  hash-only refinement after peer dialogue.
 *  Phase 8 (AGENCY-05): +1 'operator.nous_deleted' at position 18 — H5 Sovereign
 *  Operations, sole operator-initiated tombstone event. Closed 5-key payload:
 *  {tier:'H5', action:'delete', operator_id, target_did, pre_deletion_state_hash}.
 *  Emitted ONLY via appendNousDeleted() (grid/src/audit/append-nous-deleted.ts).
 *  Phase 10a (DRIVE-03): +1 'ananke.drive_crossed' at position 19 — Nous-internal
 *  drive pressure threshold crossings. Closed 5-key payload:
 *  {did, tick, drive, level, direction}. level ∈ {low,med,high};
 *  direction ∈ {rising,falling}. Emitted ONLY via appendAnankeDriveCrossed()
 *  (grid/src/ananke/append-drive-crossed.ts).
 *  Phase 10b (BIOS-02, BIOS-03): +2 bios lifecycle events at positions 20-21.
 *   - 'bios.birth' — Nous spawn boundary. Closed 3-key payload:
 *     {did, psyche_hash, tick}. Emitted ONLY via appendBiosBirth()
 *     (grid/src/bios/appendBiosBirth.ts).
 *   - 'bios.death' — Nous tombstone boundary. Closed 4-key payload:
 *     {cause, did, final_state_hash, tick}. cause ∈ {starvation, operator_h5,
 *     replay_boundary}. Emitted ONLY via appendBiosDeath()
 *     (grid/src/bios/appendBiosDeath.ts).
 *  Chronos is READ-SIDE ONLY per D-10b-11 — no chronos.* wire events.
 *  Phase 11 (WHISPER-04): +1 'nous.whispered' at position 22 — closed 4-tuple
 *   {ciphertext_hash, from_did, tick, to_did}; sole producer
 *   grid/src/whisper/appendNousWhispered.ts (to land in Wave 2).
 *   Per D-11-01 / CONTEXT-11.
 *  Tuple ORDER is locked; any reorder fails broadcast-allowlist.test.ts.
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
    // Phase 8 (AGENCY-05) — H5 Sovereign Operations. Closed 5-key payload:
    // {tier: 'H5', action: 'delete', operator_id, target_did, pre_deletion_state_hash}.
    // Emitted ONLY via appendNousDeleted() (grid/src/audit/append-nous-deleted.ts).
    'operator.nous_deleted',
    // Phase 10a (DRIVE-03) — Ananke drive threshold crossings. Closed 5-key payload:
    // {did, tick, drive, level, direction}. level ∈ {low,med,high}; direction ∈ {rising,falling}.
    // Emitted ONLY via appendAnankeDriveCrossed() (grid/src/ananke/append-drive-crossed.ts).
    'ananke.drive_crossed',
    // Phase 10b (BIOS-02) — Bios birth boundary. Closed 3-key payload:
    // {did, psyche_hash, tick}. Emitted ONLY via appendBiosBirth()
    // (grid/src/bios/appendBiosBirth.ts).
    'bios.birth',
    // Phase 10b (BIOS-03) — Bios death boundary. Closed 4-key payload:
    // {cause, did, final_state_hash, tick}. cause ∈ {starvation, operator_h5, replay_boundary}.
    // Emitted ONLY via appendBiosDeath() (grid/src/bios/appendBiosDeath.ts).
    'bios.death',
    // Phase 11 (WHISPER-04) — Nous↔Nous envelope emission. Closed 4-key payload:
    // {ciphertext_hash, from_did, tick, to_did}. Sole producer
    // grid/src/whisper/appendNousWhispered.ts (lands in Wave 2). Per D-11-01 / CONTEXT-11.
    'nous.whispered',
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
 * Phase 10a (D-10a-07): drive-leaf keys that MUST NOT appear in any broadcast
 * payload. Numeric drive pressures are NEVER permitted across the Brain↔Grid↔
 * Dashboard wire. Only the closed-enum {drive, level, direction} triple crosses.
 */
export const DRIVE_FORBIDDEN_KEYS = [
    'hunger',
    'curiosity',
    'safety',
    'boredom',
    'loneliness',
    'drive_value',
] as const;

/**
 * Phase 10b (D-10b-10): bios-leaf keys that MUST NOT appear in any broadcast
 * payload. Numeric bios needs (energy / sustenance buffers, raw need values,
 * raw bios pressures) NEVER cross the wire. Only the closed-enum
 * {did, psyche_hash, tick} (birth) or {cause, did, final_state_hash, tick}
 * (death) crosses. Per CONTEXT.md D-10b-10 — exactly 4 keys. Do NOT add extras.
 */
export const BIOS_FORBIDDEN_KEYS = [
    'energy',
    'sustenance',
    'need_value',
    'bios_value',
] as const;

/**
 * Phase 10b (D-10b-10): chronos-leaf keys that MUST NOT appear in any broadcast
 * payload. Chronos is READ-SIDE ONLY (D-10b-11) — multipliers and subjective
 * tick translations are Brain-internal experience and never traverse the wire.
 * Per CONTEXT.md D-10b-10 — exactly 3 keys. Do NOT add extras.
 */
export const CHRONOS_FORBIDDEN_KEYS = [
    'subjective_multiplier',
    'chronos_multiplier',
    'subjective_tick',
] as const;

/**
 * Phase 11 (WHISPER-04 / D-11-09): whisper-leaf keys that MUST NOT appear in any
 * whisper payload. Plaintext whisper content (message bodies, utterances, offer
 * text, ousia amounts within whispers, raw decrypted data) NEVER crosses the wire.
 * Only the closed-enum {ciphertext_hash, from_did, tick, to_did} 4-tuple crosses.
 * Per D-11-09 — exactly 13 keys. Do NOT add extras.
 *
 * NOTE: offer, amount, ousia, price, value are NOT added to FORBIDDEN_KEY_PATTERN
 * because these keys are legitimately used in trade payloads (trade.proposed,
 * trade.settled). The whisper-specific plaintext gate uses WHISPER_FORBIDDEN_KEYS
 * directly in the whisper emitter boundary checks. The global FORBIDDEN_KEY_PATTERN
 * is extended only with the 8 whisper-only keys that have no legitimate use in
 * any other event payload type (text, body, content, message, utterance,
 * plaintext, decrypted, payload_plain).
 */
export const WHISPER_FORBIDDEN_KEYS = Object.freeze([
    'text',
    'body',
    'content',
    'message',
    'utterance',
    'offer',
    'amount',
    'ousia',
    'price',
    'value',
    'plaintext',
    'decrypted',
    'payload_plain',
] as const);

/**
 * Case-insensitive regex matching forbidden key substrings. Any payload
 * key that matches ANYWHERE (e.g., `user_prompt`, `Prompting`) is rejected.
 *
 * Phase 10a (D-10a-07): extended with the 6 DRIVE_FORBIDDEN_KEYS so numeric
 * drive pressures cannot leak via nested payloads.
 *
 * Phase 10b (D-10b-10): extended with the 4 BIOS_FORBIDDEN_KEYS + 3
 * CHRONOS_FORBIDDEN_KEYS so numeric bios needs and chronos multipliers
 * cannot leak via nested payloads. Prior Phase 6 keywords
 * (prompt|response|wiki|reflection|thought|emotion_delta) preserved verbatim.
 *
 * Phase 11 (D-11-09): extended with 8 whisper-only WHISPER_FORBIDDEN_KEYS
 * (text|body|content|message|utterance|plaintext|decrypted|payload_plain).
 * The 5 trade-compatible keys (offer|amount|ousia|price|value) from
 * WHISPER_FORBIDDEN_KEYS are NOT added here because they appear in legitimate
 * trade payloads — they are enforced only at the whisper emitter boundary.
 */
export const FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value|energy|sustenance|need_value|bios_value|subjective_multiplier|chronos_multiplier|subjective_tick|text|body|content|message|utterance|plaintext|decrypted|payload_plain/i;

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
