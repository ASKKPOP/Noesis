/**
 * Phase 48 (CIVLIB-03) — Sole-producer for library.entry_curated.
 *
 * Emitted when an active curator pins / flags / re-categorises / links an entry.
 * Curator DID hashed. actorDid = curator_did_hash. Closed 4-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type LibraryEntryCuratedPayload, LIBRARY_ENTRY_CURATED_KEYS, CURATE_ACTIONS } from '../library/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendLibraryEntryCurated(audit: AuditChain, payload: LibraryEntryCuratedPayload): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendLibraryEntryCurated: payload must be a plain object`);
    }
    // 2. action ∈ closed enum.
    if (!CURATE_ACTIONS.includes(payload.action)) {
        throw new TypeError(`appendLibraryEntryCurated: action invalid, got ${JSON.stringify(payload.action)}`);
    }
    // 3. curator_did_hash (HEX64).
    if (typeof payload.curator_did_hash !== 'string' || !HEX64_RE.test(payload.curator_did_hash)) {
        throw new TypeError(`appendLibraryEntryCurated: curator_did_hash must match HEX64, got ${JSON.stringify(payload.curator_did_hash)}`);
    }
    // 4. entry_id (UUID).
    if (typeof payload.entry_id !== 'string' || !UUID_RE.test(payload.entry_id)) {
        throw new TypeError(`appendLibraryEntryCurated: entry_id must be a UUID, got ${JSON.stringify(payload.entry_id)}`);
    }
    // 5. tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendLibraryEntryCurated: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== LIBRARY_ENTRY_CURATED_KEYS.length
        || !actualKeys.every((k, i) => k === LIBRARY_ENTRY_CURATED_KEYS[i])) {
        throw new TypeError(`appendLibraryEntryCurated: closed-tuple violation — expected ${JSON.stringify(LIBRARY_ENTRY_CURATED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        action: payload.action,
        curator_did_hash: payload.curator_did_hash,
        entry_id: payload.entry_id,
        tick: payload.tick,
    };
    // 8. Privacy gate + audit.append. actorDid = curator_did_hash.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendLibraryEntryCurated: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('library.entry_curated', payload.curator_did_hash, cleanPayload);
}
