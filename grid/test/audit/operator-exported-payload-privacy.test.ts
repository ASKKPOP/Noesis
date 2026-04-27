/**
 * RED tests for operator.exported payload privacy (REPLAY-02 / T-13-01-02).
 *
 * These tests encode the acceptance criteria for Wave 3 (Plan 13-04).
 * They MUST fail until grid/src/audit/append-operator-exported.ts is created.
 *
 * Threat mitigation: T-13-01-02 — "Information Disclosure via operator.exported payload".
 * 6 forbidden keys × 2 cases (flat + nested) = 12 rejection cases.
 * Mirrors the D-12 pattern from Phase 12 governance privacy matrix.
 *
 * Decision D-13-09: closed-tuple payload
 * {tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}
 * No other keys permitted. Forbidden key check happens at the producer
 * boundary (appendOperatorExported throws TypeError on violation).
 */

import { describe, it, expect } from 'vitest';
// RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts
import { appendOperatorExported } from '../../src/audit/append-operator-exported.js';
import { AuditChain } from '../../src/audit/chain.js';

// D-13-09: forbidden keys in the operator.exported payload
export const EXPORT_FORBIDDEN_KEYS = [
    'body',
    'entries',
    'text',
    'chain_data',
    'plaintext',
    'manifest_body',
] as const;

/** A valid operator_id in op:<uuid-v4> format for tests. */
const VALID_OPERATOR_ID = 'op:12345678-1234-4123-a123-123456789012';

/** A valid tarball hash — 64 hex chars. */
const VALID_TARBALL_HASH = 'a'.repeat(64);

/** Base valid payload satisfying the closed 6-key tuple (D-13-09). */
const VALID_BASE = {
    tier: 'H5' as const,
    operator_id: VALID_OPERATOR_ID,
    start_tick: 0,
    end_tick: 50,
    tarball_hash: VALID_TARBALL_HASH,
    requested_at: 1714435200,
};

function freshChain(): AuditChain {
    return new AuditChain();
}

describe('appendOperatorExported — payload privacy matrix', () => {
    // Happy path: the exact 6-key payload must be accepted
    it('accepts the exact 6-key payload (happy path)', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, { ...VALID_BASE }),
        ).not.toThrow();
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    // For each forbidden key, emit flat + nested rejection tests
    // Flat case: forbidden key at top level
    it('rejects flat "body" at producer boundary', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                body: 'leaked content',
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects nested "body" under operator_id object', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                operator_id: { body: 'leaked' } as unknown as string,
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects flat "entries" at producer boundary', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                entries: ['entry1', 'entry2'],
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects nested "entries" under operator_id object', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                operator_id: { entries: ['e1'] } as unknown as string,
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects flat "text" at producer boundary', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                text: 'leaked text',
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects nested "text" under operator_id object', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                operator_id: { text: 'hidden' } as unknown as string,
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects flat "chain_data" at producer boundary', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                chain_data: { secret: true },
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects nested "chain_data" under operator_id object', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                operator_id: { chain_data: 'raw' } as unknown as string,
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects flat "plaintext" at producer boundary', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                plaintext: 'audit content',
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects nested "plaintext" under operator_id object', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                operator_id: { plaintext: 'raw' } as unknown as string,
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects flat "manifest_body" at producer boundary', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                manifest_body: 'full manifest',
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts

    it('rejects nested "manifest_body" under operator_id object', () => {
        const chain = freshChain();
        expect(() =>
            appendOperatorExported(chain, VALID_OPERATOR_ID, {
                ...VALID_BASE,
                operator_id: { manifest_body: 'data' } as unknown as string,
            } as never),
        ).toThrow(TypeError);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts
});
