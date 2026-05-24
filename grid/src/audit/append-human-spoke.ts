/**
 * appendHumanSpoke — SOLE producer boundary for `human.spoke` audit events.
 *
 * Phase 27 (CHAT-04): fires when a human sends a message to any Nous via the portal.
 * Plain message text is NEVER stored — only sha256(plaintext) as msg_hash.
 *
 * 8-step discipline (mirrors appendHumanTransferred exactly):
 *   1. Type guard (plain object check).
 *   2. Regex guard: human_did (DID_RE).
 *   3. Regex guard: nous_did (DID_RE).
 *   4. Format guard: msg_hash (HEX64_RE — 64 lowercase hex chars).
 *      CRITICAL: key is 'msg_hash' NOT 'message_hash' — the substring 'message'
 *      matches FORBIDDEN_KEY_PATTERN and would fail payloadPrivacyCheck.
 *   5. Non-negative integer guard: tick.
 *   6. Closed 4-key tuple check (alphabetical).
 *   7. Explicit reconstruction — no spread.
 *   8. payloadPrivacyCheck before chain.append.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

export interface HumanSpokePayload {
    readonly human_did: string;  // DID_RE
    readonly msg_hash: string;   // sha256(plaintext) — 64 lowercase hex chars
    readonly nous_did: string;   // DID_RE
    readonly tick: number;       // non-negative integer
}

// Alphabetical — matches closed-tuple check (step 6)
const EXPECTED_KEYS = ['human_did', 'msg_hash', 'nous_did', 'tick'] as const;

const HEX64_RE = /^[0-9a-f]{64}$/;

export function appendHumanSpoke(
    audit: AuditChain,
    payload: HumanSpokePayload,
): AuditEntry {
    // Step 1: type guard
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('appendHumanSpoke: payload must be a plain object');
    }
    // Step 2: human_did regex
    if (typeof (payload as unknown as Record<string, unknown>).human_did !== 'string'
        || !DID_RE.test((payload as HumanSpokePayload).human_did)) {
        throw new TypeError('appendHumanSpoke: human_did must match DID_RE');
    }
    // Step 3: nous_did regex
    if (typeof (payload as unknown as Record<string, unknown>).nous_did !== 'string'
        || !DID_RE.test((payload as HumanSpokePayload).nous_did)) {
        throw new TypeError('appendHumanSpoke: nous_did must match DID_RE');
    }
    // Step 4: msg_hash format
    if (typeof (payload as unknown as Record<string, unknown>).msg_hash !== 'string'
        || !HEX64_RE.test((payload as HumanSpokePayload).msg_hash)) {
        throw new TypeError('appendHumanSpoke: msg_hash must be 64 lowercase hex chars');
    }
    // Step 5: tick non-negative integer
    const tick = (payload as HumanSpokePayload).tick;
    if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < 0) {
        throw new TypeError('appendHumanSpoke: tick must be a non-negative integer');
    }
    // Step 6: closed-tuple check (alphabetical)
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendHumanSpoke: unexpected key set [${actualKeys.join(', ')}], `
            + `expected [${EXPECTED_KEYS.join(', ')}]`,
        );
    }
    // Step 7: explicit reconstruction — NO spread
    const cleanPayload = {
        human_did: payload.human_did,
        msg_hash: payload.msg_hash,
        nous_did: payload.nous_did,
        tick: payload.tick,
    };
    // Step 8: privacy gate then append
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendHumanSpoke: privacy violation at path "${privacy.offendingPath ?? '?'}"`,
        );
    }
    return audit.append('human.spoke', payload.human_did, cleanPayload);
}
