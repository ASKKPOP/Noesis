/**
 * appendPortalNotificationDispatched — SOLE producer boundary for `portal.notification_dispatched` audit events.
 *
 * Phase 36 / VIS-05 — sole producer for `portal.notification_dispatched`.
 * PRIVATE QUEUE EVENT — NOT on broadcast allowlist per D-36-19. This event
 * enters the audit chain (via audit.append) but is NOT forwarded to WS
 * subscribers; it is delivered to the operator's Portal notification queue
 * (Plan 05) via REST poll. See
 * `.planning/phases/36-visitor-did-read-write-split/36-VALIDATION.md`
 * Wave 0 Allowlist-Count Decision (count=60, NOT 61).
 *
 * Fires when the Portal dispatches a notification to an operator's personal queue
 * (e.g. "a Nous you follow posted a Library entry").
 *
 * Discipline mirrors appendPortalAuthLogin exactly:
 *   1. Type guard: payload must be a plain non-null non-array object.
 *   2. Non-negative integer guard: dispatched_at_tick.
 *   3. Non-empty string guard: notification_type.
 *   4. Regex guard: operator_did (PORTAL_DID_RE — accepts did:noesis:* and did:civic:*).
 *   5. Closed 3-key payload tuple — extra keys refused.
 *   6. Explicit reconstruction (no spread).
 *   7. payloadPrivacyCheck runs before chain.append.
 *   8. audit.append with canonical event type 'portal.notification_dispatched'.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

/**
 * Portal-layer DID regex: accepts both did:noesis:* (v2.x DIDs) and did:civic:*
 * (v3.0 Civic-DIDs per D-V3-33). Phase 37 will add a canonical CIVIC_DID_RE export;
 * for v3.0 Phase 36, operator_did in Portal notification context uses this local
 * broader regex that covers both DID namespaces.
 *
 * NOTE: DID_RE from append-human-joined.ts only covers did:noesis:* and is NOT
 * imported here because operator_did in Portal context uses Civic-DIDs.
 */
const PORTAL_DID_RE = /^did:(?:noesis|civic):[a-z0-9_:\-]+$/i;

/** Closed 3-key payload for portal.notification_dispatched. */
export interface PortalNotificationDispatchedPayload {
    readonly dispatched_at_tick: number;   // non-negative integer
    readonly notification_type: string;    // non-empty string
    readonly operator_did: string;         // PORTAL_DID_RE — actor field
}

/** The 3 keys a portal.notification_dispatched payload must carry — nothing more, nothing less (alphabetical). */
const EXPECTED_KEYS = ['dispatched_at_tick', 'notification_type', 'operator_did'] as const;

/**
 * Sole producer path for portal.notification_dispatched audit events.
 *
 * @throws TypeError if guards fail, the payload carries an unexpected key,
 *   or payloadPrivacyCheck rejects the payload.
 */
export function appendPortalNotificationDispatched(
    audit: AuditChain,
    payload: PortalNotificationDispatchedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalNotificationDispatched: payload must be a plain object`);
    }

    // 2. Non-negative integer guard: dispatched_at_tick.
    if (!Number.isInteger(payload.dispatched_at_tick) || payload.dispatched_at_tick < 0) {
        throw new TypeError(
            `appendPortalNotificationDispatched: dispatched_at_tick must be a non-negative integer, got ${JSON.stringify(payload.dispatched_at_tick)}`,
        );
    }

    // 3. Non-empty string guard: notification_type.
    if (typeof payload.notification_type !== 'string' || payload.notification_type.length === 0) {
        throw new TypeError(
            `appendPortalNotificationDispatched: notification_type must be a non-empty string, got ${JSON.stringify(payload.notification_type)}`,
        );
    }

    // 4. Regex guard: operator_did (Portal-layer DID — accepts both did:noesis:* and did:civic:*).
    if (typeof payload.operator_did !== 'string' || !PORTAL_DID_RE.test(payload.operator_did)) {
        throw new TypeError(
            `appendPortalNotificationDispatched: operator_did must match PORTAL_DID_RE (did:noesis:... or did:civic:...), got ${JSON.stringify(payload.operator_did)}`,
        );
    }

    // 5. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendPortalNotificationDispatched: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 6. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        dispatched_at_tick: payload.dispatched_at_tick,
        notification_type: payload.notification_type,
        operator_did: payload.operator_did,
    };

    // 7. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPortalNotificationDispatched: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 8. Commit to chain.
    return audit.append('portal.notification_dispatched', payload.operator_did, cleanPayload);
}
