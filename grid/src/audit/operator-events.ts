/**
 * Operator-event audit wrapper — Phase 6 producer-boundary invariant (AGENCY-03).
 *
 * Every `operator.*` event MUST pass through `appendOperatorEvent()` instead of
 * `AuditChain.append()` directly. This wrapper enforces two invariants at the
 * producer boundary, BEFORE the event enters the hash-chained log:
 *
 *   1. D-13 tier-required: payload must carry `tier ∈ {H1, H2, H3, H4, H5}`.
 *      A missing, wrong-type, or out-of-enum tier throws TypeError. Without
 *      this, forensic attribution is lost (T-6-02).
 *
 *   2. D-12 payload-privacy: every operator.* payload passes
 *      `payloadPrivacyCheck()` (no `prompt|response|wiki|reflection|thought|
 *      emotion_delta` keys). Mitigates T-6-03 (broadcast privacy leak) and
 *      T-6-07 (Telos plaintext exfiltration). Full Telos/memory contents stay
 *      in Brain per PHILOSOPHY §1 sovereignty.
 *
 * AuditChain itself is NOT modified — the chain stays domain-agnostic; the
 * operator domain owns its invariants. This matches the Phase 5 Reviewer
 * pattern (service at the producer boundary, not in the chain itself).
 *
 * See: .planning/phases/06-operator-agency-foundation-h1-h4/06-CONTEXT.md
 *      D-11 (payload shapes), D-12 (privacy gate), D-13 (tier-required).
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import type { HumanAgencyTier } from '../api/types.js';

const VALID_TIERS: ReadonlySet<HumanAgencyTier> = new Set<HumanAgencyTier>([
    'H1', 'H2', 'H3', 'H4', 'H5',
]);

export interface OperatorEventPayload {
    tier: HumanAgencyTier;
    action: string;
    operator_id: string;
    target_did?: string;
    [key: string]: unknown;
}

export interface TierRequiredCheckResult {
    ok: boolean;
    reason?: string;
}

/**
 * D-13: reject any `operator.*` event whose payload lacks a valid tier field.
 *
 * Non-`operator.*` event types pass through unchanged — this validator is a
 * no-op outside the operator namespace so existing producers (trade, law,
 * nous, tick, grid) are not impacted.
 */
export function requireTierInPayload(
    eventType: string,
    payload: Record<string, unknown>,
): TierRequiredCheckResult {
    if (!eventType.startsWith('operator.')) return { ok: true };
    const tier = payload['tier'];
    if (typeof tier !== 'string' || !VALID_TIERS.has(tier as HumanAgencyTier)) {
        return {
            ok: false,
            reason: `operator.* event '${eventType}' payload missing or invalid tier — AGENCY-03 invariant violated (Phase 6 D-13). Got: ${JSON.stringify(tier)}`,
        };
    }
    return { ok: true };
}

/**
 * Sole sanctioned surface for emitting `operator.*` audit events.
 *
 * Plans 04/05 MUST import this wrapper; any call to `audit.append('operator.*', ...)`
 * outside this file is an AGENCY-03 invariant violation.
 *
 * - Enforces D-13 tier-required invariant (throws TypeError on failure).
 * - Enforces D-12 payload-privacy producer-boundary gate (throws TypeError on
 *   forbidden keys — wiki/reflection/thought/prompt/response/emotion_delta).
 * - Preserves AuditChain zero-diff invariant (no change to AuditChain.append).
 */
export function appendOperatorEvent(
    audit: AuditChain,
    eventType: `operator.${string}`,
    actorDid: string,
    payload: OperatorEventPayload,
    targetDid?: string,
): AuditEntry {
    const tierCheck = requireTierInPayload(eventType, payload as Record<string, unknown>);
    if (!tierCheck.ok) {
        throw new TypeError(tierCheck.reason ?? 'tier required — AGENCY-03 invariant');
    }
    const privacy = payloadPrivacyCheck(payload as Record<string, unknown>);
    if (!privacy.ok) {
        throw new TypeError(
            `operator.* event '${eventType}' privacy leak: key '${privacy.offendingPath}' matches forbidden keyword '${privacy.offendingKeyword}' (AGENCY-03 / T-6-03)`,
        );
    }
    return audit.append(eventType, actorDid, payload as Record<string, unknown>, targetDid);
}
