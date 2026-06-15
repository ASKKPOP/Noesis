/**
 * Groups & Holdings · Phase 1 / D-GROUP-01 — Sole-producer for group.founded.
 *
 * Closed 4-key payload (keys ALPHABETICAL): {domain, group_id, kind, tick}.
 * actorDid = group_id (the founding is attributed to the Group anchor, mirroring
 *   parcel-attributed events that use parcel_id as actor — #83).
 *
 * Privacy: no plaintext display name, charter, or member DID crosses the boundary —
 *   only the id, the domain enum, the kind enum, and the tick. No FORBIDDEN_KEY_PATTERN key.
 *
 * Mirrors append-skill-blueprint-executed: closed-tuple Object.keys().sort() check,
 *   explicit no-spread reconstruction, payloadPrivacyCheck gate, single audit.append.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

/** Group id: `{grid}:group:{name}` (name = lowercase slug). */
const GROUP_ID_RE = /^[a-z0-9_-]+:group:[a-z]+$/;
const DOMAINS = ['biotech', 'defense', 'energy', 'physical_ai', 'quantum'] as const;
const KINDS = ['business', 'nonprofit'] as const;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface GroupFoundedPayload {
    readonly domain: string;    // GroupDomain
    readonly group_id: string;  // GROUP_ID_RE
    readonly kind: string;      // GroupKind
    readonly tick: number;      // non-negative integer
}

const EXPECTED_KEYS = ['domain', 'group_id', 'kind', 'tick'] as const;

export function appendGroupFounded(audit: AuditChain, payload: GroupFoundedPayload): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGroupFounded: payload must be a plain object`);
    }
    // 2. Enum: domain.
    if (typeof payload.domain !== 'string' || !(DOMAINS as readonly string[]).includes(payload.domain)) {
        throw new TypeError(`appendGroupFounded: domain must be one of ${JSON.stringify(DOMAINS)}, got ${JSON.stringify(payload.domain)}`);
    }
    // 3. Regex: group_id.
    if (typeof payload.group_id !== 'string' || !GROUP_ID_RE.test(payload.group_id)) {
        throw new TypeError(`appendGroupFounded: group_id must match GROUP_ID_RE, got ${JSON.stringify(payload.group_id)}`);
    }
    // 4. Enum: kind.
    if (typeof payload.kind !== 'string' || !(KINDS as readonly string[]).includes(payload.kind)) {
        throw new TypeError(`appendGroupFounded: kind must be one of ${JSON.stringify(KINDS)}, got ${JSON.stringify(payload.kind)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendGroupFounded: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendGroupFounded: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        domain: payload.domain,
        group_id: payload.group_id,
        kind: payload.kind,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGroupFounded: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = group_id.
    return audit.append('group.founded', payload.group_id, cleanPayload);
}
