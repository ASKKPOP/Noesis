/**
 * Phase 48 (CIVLIB-03) — Sole-producer for library.curator_elected.
 *
 * Emitted (once per curator) when the Government enacts a curation-council election.
 * Curator DID hashed (HEX64). actorDid = curator_did_hash. Closed 3-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type LibraryCuratorElectedPayload, LIBRARY_CURATOR_ELECTED_KEYS } from '../library/types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendLibraryCuratorElected(audit: AuditChain, payload: LibraryCuratorElectedPayload): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendLibraryCuratorElected: payload must be a plain object`);
    }
    // 2. curator_did_hash (HEX64).
    if (typeof payload.curator_did_hash !== 'string' || !HEX64_RE.test(payload.curator_did_hash)) {
        throw new TypeError(`appendLibraryCuratorElected: curator_did_hash must match HEX64, got ${JSON.stringify(payload.curator_did_hash)}`);
    }
    // 3. term_start_tick / term_end_tick non-negative integers, end > start.
    if (!Number.isInteger(payload.term_start_tick) || payload.term_start_tick < 0) {
        throw new TypeError(`appendLibraryCuratorElected: term_start_tick must be non-negative integer, got ${JSON.stringify(payload.term_start_tick)}`);
    }
    if (!Number.isInteger(payload.term_end_tick) || payload.term_end_tick <= payload.term_start_tick) {
        throw new TypeError(`appendLibraryCuratorElected: term_end_tick must be an integer > term_start_tick, got ${JSON.stringify(payload.term_end_tick)}`);
    }
    // 4. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== LIBRARY_CURATOR_ELECTED_KEYS.length
        || !actualKeys.every((k, i) => k === LIBRARY_CURATOR_ELECTED_KEYS[i])) {
        throw new TypeError(`appendLibraryCuratorElected: closed-tuple violation — expected ${JSON.stringify(LIBRARY_CURATOR_ELECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 5. Explicit reconstruction — no spread.
    const cleanPayload = {
        curator_did_hash: payload.curator_did_hash,
        term_end_tick: payload.term_end_tick,
        term_start_tick: payload.term_start_tick,
    };
    // 6. Privacy gate + audit.append. actorDid = curator_did_hash.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendLibraryCuratorElected: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('library.curator_elected', payload.curator_did_hash, cleanPayload);
}
