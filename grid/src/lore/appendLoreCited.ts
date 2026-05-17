/**
 * appendLoreCited — Phase 20 sole producer for lore.cited (pos 43).
 *
 * Closed-tuple: {citing_did, content_hash, tick} — 3 keys (D-20-12).
 * 3-keys-not-5: Brain sends {content_hash} (1 key); Grid injects citing_did + tick.
 *
 * Validation: 9 steps (no step 6 enum check — only 3 fields with no domain enum).
 *   1. actorDid DID_RE
 *   2. citing_did DID_RE
 *   3. Self-report: citing_did === actorDid
 *   4. tick non-negative integer
 *   5. content_hash HEX64_RE (64-char hex)
 *   6. Closed-tuple: Object.keys(payload).sort() === LORE_CITED_KEYS
 *   7. Explicit reconstruction (prototype-pollution defense)
 *   8. payloadPrivacyCheck
 *   9. audit.append (sole emit line)
 */
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { LORE_CITED_KEYS, type LoreCitedPayload } from './types.js';
import { DID_RE, HEX64_RE } from './appendLoreContributed.js';

/** Canonical event type string — imported by listeners to avoid literal duplication. */
export const LORE_CITED_EVENT = 'lore.cited' as const;

export function appendLoreCited(
    audit: AuditChain,
    actorDid: string,
    payload: LoreCitedPayload,
): AuditEntry {
    // 1. actorDid format
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendLoreCited: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`);
    }
    // 2. citing_did format
    if (typeof payload?.citing_did !== 'string' || !DID_RE.test(payload.citing_did)) {
        throw new TypeError(`appendLoreCited: invalid citing_did ${JSON.stringify(payload?.citing_did)}`);
    }
    // 3. Self-report invariant
    if (payload.citing_did !== actorDid) {
        throw new TypeError(`appendLoreCited: self-report violation — citing_did ${payload.citing_did} !== actorDid ${actorDid}`);
    }
    // 4. tick non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendLoreCited: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. content_hash 64-char lowercase hex
    if (typeof payload.content_hash !== 'string' || !HEX64_RE.test(payload.content_hash)) {
        throw new TypeError(`appendLoreCited: invalid content_hash — must be 64-char lowercase hex`);
    }
    // 6. Closed-tuple enforcement
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== LORE_CITED_KEYS.length ||
        !actualKeys.every((k, i) => k === LORE_CITED_KEYS[i])
    ) {
        throw new TypeError(
            `appendLoreCited: closed-tuple violation — expected ${JSON.stringify(LORE_CITED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 7. Explicit reconstruction (prototype-pollution defense)
    const cleanPayload: LoreCitedPayload = {
        citing_did: payload.citing_did,
        content_hash: payload.content_hash,
        tick: payload.tick,
    };
    // 8. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendLoreCited: payload privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit to chain (sole producer)
    return audit.append('lore.cited', actorDid, cleanPayload);
}
