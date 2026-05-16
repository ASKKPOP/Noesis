// Sole producer for norm.crystallized (position 41 in ALLOWLIST_MEMBERS).
// Only this file may call audit.append('norm.crystallized', ...) — enforced by
// grid/test/norms/norm-producer-boundary.test.ts grep gate.

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { NORM_CRYSTALLIZED_KEYS, VALID_CONVERGENCE_TYPES, type NormCrystallizedPayload } from './types.js';

const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
const CHAR6_RE = /^[0-9a-f]{6}$/;
const NORM_THRESHOLD = 3; // minimum participating_count; injected from NormConfig at call site

export function appendNormCrystallized(
    audit: AuditChain,
    actorDid: string,
    payload: NormCrystallizedPayload,
    normThreshold = NORM_THRESHOLD,
): AuditEntry {
    // 1. actorDid DID_RE
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendNormCrystallized: actorDid fails DID_RE — got ${JSON.stringify(actorDid)}`);
    }
    // 2. System-actor gate (replaces self-report invariant — norm events use Grid system DID)
    if (actorDid !== 'did:noesis:grid') {
        throw new TypeError(`appendNormCrystallized: actorDid must be 'did:noesis:grid' — got ${JSON.stringify(actorDid)}`);
    }
    // 3. tick non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendNormCrystallized: tick must be a non-negative integer — got ${payload.tick}`);
    }
    // 4. fingerprint CHAR6_RE
    if (!CHAR6_RE.test(payload.fingerprint)) {
        throw new TypeError(`appendNormCrystallized: fingerprint fails CHAR6_RE — got ${JSON.stringify(payload.fingerprint)}`);
    }
    // 5. participating_count >= threshold
    if (!Number.isInteger(payload.participating_count) || payload.participating_count < normThreshold) {
        throw new TypeError(`appendNormCrystallized: participating_count must be >= ${normThreshold} — got ${payload.participating_count}`);
    }
    // 5b. evidence_tick_range validation
    if (
        !Array.isArray(payload.evidence_tick_range) ||
        payload.evidence_tick_range.length !== 2 ||
        !Number.isInteger(payload.evidence_tick_range[0]) ||
        !Number.isInteger(payload.evidence_tick_range[1]) ||
        payload.evidence_tick_range[0] > payload.evidence_tick_range[1]
    ) {
        throw new TypeError('appendNormCrystallized: invalid evidence_tick_range — must be [firstTick, lastTick] with first <= last');
    }
    // 6. convergence_type enum
    if (!VALID_CONVERGENCE_TYPES.has(payload.convergence_type as 'emergent' | 'coincidental')) {
        throw new TypeError(`appendNormCrystallized: convergence_type must be 'emergent' or 'coincidental' — got ${JSON.stringify(payload.convergence_type)}`);
    }
    // 7. Closed-tuple: Object.keys().sort() === NORM_CRYSTALLIZED_KEYS
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== NORM_CRYSTALLIZED_KEYS.length ||
        !actualKeys.every((k, i) => k === NORM_CRYSTALLIZED_KEYS[i])
    ) {
        throw new TypeError(
            `appendNormCrystallized: closed-tuple violation — expected keys ${JSON.stringify(NORM_CRYSTALLIZED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 8. Explicit reconstruction (prototype-pollution defense)
    const cleanPayload = {
        convergence_type: payload.convergence_type,
        evidence_tick_range: [payload.evidence_tick_range[0], payload.evidence_tick_range[1]] as [number, number],
        fingerprint: payload.fingerprint,
        participating_count: payload.participating_count,
        tick: payload.tick,
    };
    // 9. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendNormCrystallized: payload privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Emit
    return audit.append('norm.crystallized', actorDid, cleanPayload);
}
