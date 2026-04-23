/**
 * appendNousWhispered — SOLE producer boundary for `nous.whispered`.
 *
 * Phase 11 WHISPER-03. Structural clone of grid/src/bios/appendBiosBirth.ts
 * (Phase 10b sole-producer template). D-11-01 / T-10-01 / CONTEXT-11.
 *
 * Validation discipline (ordering deliberate):
 *   1. DID regex guard on actorDid — reject malformed before any side effect.
 *   2. DID regex guard on payload.from_did.
 *   3. DID regex guard on payload.to_did.
 *   4. Self-report invariant — payload.from_did MUST equal actorDid (sender attests).
 *   5. Self-whisper guard — from_did !== to_did (no loopback envelope).
 *   6. Tick — non-negative integer.
 *   7. ciphertext_hash — 64-char lowercase hex (HEX64_RE).
 *   8. Closed-tuple — exactly 4 keys, alphabetical sort equality on WHISPERED_KEYS.
 *   9. Explicit object reconstruction (prototype-pollution defense).
 *  10. Privacy gate — payloadPrivacyCheck belt-and-suspenders.
 *      The 4 closed keys are natively clean; the gate is the regression fence.
 *  11. Commit to chain.
 *
 * Any other file in grid/src/ calling audit.append with eventType
 * === 'nous.whispered' fails the producer-boundary invariant test
 * (grid/test/whisper/whisper-producer-boundary.test.ts).
 *
 * Wall-clock free per D-11-13 — tick MUST be supplied by caller (system tick).
 *
 * Phase 11 is the 7th DID_RE entry point per CONTEXT.md carry-forward §6.
 *
 * See: 11-CONTEXT.md D-11-01, D-11-08, D-11-13, D-11-17. T-10-01, T-10-04.
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { WHISPER_FORBIDDEN_KEYS } from '../audit/broadcast-allowlist.js';
import { WHISPERED_KEYS, type NousWhisperedPayload } from './types.js';

/**
 * Whisper-specific privacy check using exact key matching from WHISPER_FORBIDDEN_KEYS.
 *
 * The global payloadPrivacyCheck uses substring matching which false-positives on
 * 'ciphertext_hash' (contains 'text'). Since whisper cleanPayload has exactly
 * 4 known-safe keys, we use exact WHISPER_FORBIDDEN_KEYS matching instead.
 * Per D-11-09: "the whisper-specific plaintext gate uses WHISPER_FORBIDDEN_KEYS
 * directly in the whisper emitter boundary checks."
 */
function whisperPrivacyCheck(payload: Record<string, unknown>): { ok: boolean; offendingKeyword?: string; offendingPath?: string } {
    const forbidden = new Set<string>(WHISPER_FORBIDDEN_KEYS);
    for (const key of Object.keys(payload)) {
        if (forbidden.has(key)) {
            return { ok: false, offendingPath: key, offendingKeyword: key };
        }
        // Recurse into nested objects
        const val = payload[key];
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            const sub = whisperPrivacyCheck(val as Record<string, unknown>);
            if (!sub.ok) return { ok: false, offendingPath: `${key}.${sub.offendingPath}`, offendingKeyword: sub.offendingKeyword };
        }
    }
    return { ok: true };
}

/** DID regex — locked project-wide (Phase 7 D-29). Phase 11 is the 7th entry point. */
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

/** 64-char lowercase hex digest (SHA-256). Matches grid/src/audit/state-hash.ts HEX64_RE. */
export const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * Sole producer path for nous.whispered audit events.
 *
 * @throws TypeError on any validation failure — regex, self-report, self-whisper,
 *   tick shape, ciphertext_hash format, tuple, or privacy regression.
 */
export function appendNousWhispered(
    audit: AuditChain,
    actorDid: string,
    payload: NousWhisperedPayload,
): AuditEntry {
    // 1. DID regex guard on actorDid.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(
            `appendNousWhispered: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`,
        );
    }

    // 2. Closed-tuple — exactly 4 keys, alphabetical. Run BEFORE individual field
    //    checks so a missing/extra key yields "unexpected key set" rather than a
    //    misleading "invalid from_did" or "invalid to_did" diagnostic.
    //    Clones appendBiosBirth.ts ordering discipline.
    const actualKeys = Object.keys(payload).sort();
    const expectedKeys = [...WHISPERED_KEYS].sort();
    if (
        actualKeys.length !== expectedKeys.length ||
        !actualKeys.every((k, i) => k === expectedKeys[i])
    ) {
        throw new TypeError(
            `appendNousWhispered: unexpected key set — expected ${JSON.stringify(expectedKeys)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 3. DID regex guard on payload.from_did.
    if (typeof payload?.from_did !== 'string' || !DID_RE.test(payload.from_did)) {
        throw new TypeError(
            `appendNousWhispered: invalid payload.from_did (DID_RE failed)`,
        );
    }

    // 4. DID regex guard on payload.to_did.
    if (typeof payload?.to_did !== 'string' || !DID_RE.test(payload.to_did)) {
        throw new TypeError(
            `appendNousWhispered: invalid payload.to_did (DID_RE failed)`,
        );
    }

    // 5. Self-report invariant — a Nous cannot send a whisper on someone else's behalf.
    if (payload.from_did !== actorDid) {
        throw new TypeError(
            `appendNousWhispered: payload.from_did must equal actorDid (self-report invariant)`,
        );
    }

    // 6. Self-whisper guard — a Nous cannot whisper to itself.
    if (payload.from_did === payload.to_did) {
        throw new TypeError(
            `appendNousWhispered: self-whisper rejected (from_did === to_did)`,
        );
    }

    // 7. Tick — non-negative integer.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendNousWhispered: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 8. ciphertext_hash — 64-char lowercase hex.
    if (typeof payload.ciphertext_hash !== 'string' || !HEX64_RE.test(payload.ciphertext_hash)) {
        throw new TypeError(
            `appendNousWhispered: invalid ciphertext_hash (expected 64-char lowercase hex)`,
        );
    }

    // 9. Explicit reconstruction — guarantees no prototype pollution / inherited keys.
    //    Insertion order matches alphabetical key order for stable JSON serialization.
    const cleanPayload = {
        ciphertext_hash: payload.ciphertext_hash,
        from_did: payload.from_did,
        tick: payload.tick,
        to_did: payload.to_did,
    };

    // 10. Privacy gate — whisper-specific exact-key check (D-11-09 / WHISPER-03).
    //     Uses WHISPER_FORBIDDEN_KEYS exact matching, NOT the global payloadPrivacyCheck
    //     substring pattern, because 'ciphertext_hash' legitimately contains 'text'
    //     as a substring. Per broadcast-allowlist.ts comment on WHISPER_FORBIDDEN_KEYS.
    const privacy = whisperPrivacyCheck(cleanPayload as unknown as Record<string, unknown>);
    if (!privacy.ok) {
        throw new TypeError(
            `appendNousWhispered: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 11. Commit to the chain (sole producer).
    return audit.append('nous.whispered', actorDid, cleanPayload);
}
