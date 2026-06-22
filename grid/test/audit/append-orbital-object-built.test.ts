/**
 * L3b D-MONEY-08 — appendOrbitalObjectBuilt emitter unit tests.
 * Verifies closed 7-key payload, all guards, and allowlist membership.
 */
import { describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendOrbitalObjectBuilt } from '../../src/audit/append-orbital-object-built.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const HASH = 'd'.repeat(64);
const CONTRACT_ID = '33345678-1234-1234-1234-123456789abc';
const OBJECT_ID = '44445678-1234-1234-1234-123456789abc';

function validPayload() {
    return {
        build_cost_wei: '4000',
        builder_did_hash: HASH,
        contract_id: CONTRACT_ID,
        function_type: 'Energy',
        object_id: OBJECT_ID,
        output_rate: '120',
        tick: 7,
    };
}

describe('appendOrbitalObjectBuilt — emitter', () => {
    it('emits orbital.object_built with a closed 7-key payload', () => {
        const chain = new AuditChain();
        const entry = appendOrbitalObjectBuilt(chain, validPayload());
        expect(entry.eventType).toBe('orbital.object_built');
        expect(entry.actorDid).toBe(HASH);
        expect(entry.payload).toEqual(validPayload());
    });

    it('orbital.object_built is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('orbital.object_built')).toBe(true);
    });

    it('orbital.object_built is at position 117 (index 116)', () => {
        expect(ALLOWLIST_MEMBERS[116]).toBe('orbital.object_built');
    });

    it('rejects bad builder_did_hash (not HEX64)', () => {
        const chain = new AuditChain();
        expect(() => appendOrbitalObjectBuilt(chain, { ...validPayload(), builder_did_hash: 'nothex' }))
            .toThrow(TypeError);
    });

    it('rejects bad contract_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendOrbitalObjectBuilt(chain, { ...validPayload(), contract_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects bad object_id (not UUID)', () => {
        const chain = new AuditChain();
        expect(() => appendOrbitalObjectBuilt(chain, { ...validPayload(), object_id: 'not-a-uuid' }))
            .toThrow(TypeError);
    });

    it('rejects empty function_type', () => {
        const chain = new AuditChain();
        expect(() => appendOrbitalObjectBuilt(chain, { ...validPayload(), function_type: '' }))
            .toThrow(TypeError);
    });

    it('rejects build_cost_wei with non-decimal chars', () => {
        const chain = new AuditChain();
        expect(() => appendOrbitalObjectBuilt(chain, { ...validPayload(), build_cost_wei: '-4000' }))
            .toThrow(TypeError);
    });

    it('rejects output_rate with non-decimal chars', () => {
        const chain = new AuditChain();
        expect(() => appendOrbitalObjectBuilt(chain, { ...validPayload(), output_rate: '-120' }))
            .toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        const chain = new AuditChain();
        expect(() => appendOrbitalObjectBuilt(chain, { ...validPayload(), tick: -1 }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendOrbitalObjectBuilt(chain, { ...validPayload(), extra: 'leak' }))
            .toThrow(TypeError);
    });

    it('refuses a missing key (closed-tuple)', () => {
        const chain = new AuditChain();
        const { build_cost_wei: _omit, ...noCost } = validPayload();
        // @ts-expect-error — intentionally missing key
        expect(() => appendOrbitalObjectBuilt(chain, noCost))
            .toThrow(TypeError);
    });
});
