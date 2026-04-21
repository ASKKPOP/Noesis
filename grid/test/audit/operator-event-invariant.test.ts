/**
 * AGENCY-03 / D-13 regression — tier field required on every operator.* event.
 *
 * This file is the structural proof that Phase 6's tier-required invariant
 * holds at the producer boundary. Enumerates all 5 operator.* event types
 * against 2 failure modes (missing tier, invalid tier value) plus a positive
 * accept case, and confirms the passthrough semantics on non-operator events.
 *
 * See: grid/src/audit/operator-events.ts (the wrapper under test).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import {
    appendOperatorEvent,
    requireTierInPayload,
} from '../../src/audit/operator-events.js';

const OPERATOR_EVENTS = [
    'operator.inspected',
    'operator.paused',
    'operator.resumed',
    'operator.law_changed',
    'operator.telos_forced',
] as const;

const VALID_OP_ID = 'op:00000000-0000-4000-8000-000000000000';
const VALID_ACTOR = 'did:noesis:test';

describe('AGENCY-03 / D-13: tier field required on all operator.* events', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it.each(OPERATOR_EVENTS)('%s rejects payload missing tier', (eventType) => {
        expect(() =>
            appendOperatorEvent(
                chain,
                eventType as `operator.${string}`,
                VALID_ACTOR,
                // @ts-expect-error — tier intentionally omitted for regression coverage
                { action: 'x', operator_id: VALID_OP_ID },
            ),
        ).toThrow(/tier.*invariant|tier.*required|invalid tier/i);
    });

    it.each(OPERATOR_EVENTS)('%s rejects invalid tier value (e.g. H9)', (eventType) => {
        expect(() =>
            appendOperatorEvent(
                chain,
                eventType as `operator.${string}`,
                VALID_ACTOR,
                // @ts-expect-error — H9 is not a valid HumanAgencyTier
                { tier: 'H9', action: 'x', operator_id: VALID_OP_ID },
            ),
        ).toThrow(/tier.*invariant|invalid tier/i);
    });

    it.each(OPERATOR_EVENTS)('%s rejects non-string tier value', (eventType) => {
        expect(() =>
            appendOperatorEvent(
                chain,
                eventType as `operator.${string}`,
                VALID_ACTOR,
                // @ts-expect-error — numeric tier is structurally invalid
                { tier: 3, action: 'x', operator_id: VALID_OP_ID },
            ),
        ).toThrow(/tier.*invariant|invalid tier/i);
    });

    it.each(OPERATOR_EVENTS)('%s accepts well-formed payload with tier H3', (eventType) => {
        expect(() =>
            appendOperatorEvent(
                chain,
                eventType as `operator.${string}`,
                VALID_ACTOR,
                { tier: 'H3', action: 'x', operator_id: VALID_OP_ID },
            ),
        ).not.toThrow();
    });

    it('chain.head advances after a successful appendOperatorEvent', () => {
        const headBefore = chain.head;
        appendOperatorEvent(chain, 'operator.paused', VALID_ACTOR, {
            tier: 'H3',
            action: 'pause',
            operator_id: VALID_OP_ID,
        });
        expect(chain.head).not.toBe(headBefore);
        expect(chain.length).toBe(1);
    });
});

describe('AGENCY-03 / D-13: requireTierInPayload passthrough for non-operator events', () => {
    it('is a no-op passthrough for trade.proposed', () => {
        expect(requireTierInPayload('trade.proposed', { action: 'x' })).toEqual({ ok: true });
    });

    it('is a no-op passthrough for tick', () => {
        expect(requireTierInPayload('tick', {})).toEqual({ ok: true });
    });

    it('is a no-op passthrough for nous.spawned', () => {
        expect(requireTierInPayload('nous.spawned', { did: 'did:noesis:x' })).toEqual({ ok: true });
    });

    it('accepts all 5 valid tier values on any operator.* event', () => {
        for (const tier of ['H1', 'H2', 'H3', 'H4', 'H5'] as const) {
            expect(
                requireTierInPayload('operator.inspected', {
                    tier, action: 'inspect', operator_id: VALID_OP_ID,
                }),
            ).toEqual({ ok: true });
        }
    });

    it('rejects operator.* event with empty-string tier', () => {
        const r = requireTierInPayload('operator.paused', { tier: '', action: 'pause' });
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/AGENCY-03/);
    });
});

describe('AGENCY-03: payload-privacy producer-boundary gate wrapped by appendOperatorEvent', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('rejects operator.telos_forced payload carrying `wiki` key', () => {
        expect(() =>
            appendOperatorEvent(chain, 'operator.telos_forced', VALID_ACTOR, {
                tier: 'H4',
                action: 'force_telos',
                operator_id: VALID_OP_ID,
                // Forbidden key — the privacy gate must trip BEFORE audit.append.
                wiki: 'leak',
            } as never),
        ).toThrow(/privacy|leak/i);
        // Side-effect guarantee: no entry was committed to the chain.
        expect(chain.length).toBe(0);
    });
});
