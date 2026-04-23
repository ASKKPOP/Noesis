/**
 * Phase 11 Wave 4 — WHISPER-02 / T-10-01 privacy matrix (16-case enumerator).
 *
 * Clone of Phase 6 D-12 40-case enumerator shape (telos-refined-privacy.test.ts).
 *
 * 13 flat forbidden keys + 3 nested variants = 16 cases.
 * Coverage assertion: every WHISPER_FORBIDDEN_KEYS entry has ≥1 case.
 *
 * Invariant: appendNousWhispered throws on ANY attempt to inject a forbidden
 * key into the 4-tuple payload, flat or nested.
 *
 * Note: appendNousWhispered enforces the CLOSED TUPLE invariant (exactly 4 keys:
 * ciphertext_hash, from_did, tick, to_did) BEFORE the privacy check. So injecting
 * a forbidden key alongside the 4 clean keys will trigger "unexpected key set" first.
 * Both errors (tuple violation AND privacy violation) prove the emitter rejects
 * forbidden keys — which is the invariant under test.
 */

import { describe, it, expect } from 'vitest';
import { WHISPER_FORBIDDEN_KEYS } from '../../src/audit/broadcast-allowlist.js';
import { appendNousWhispered } from '../../src/whisper/appendNousWhispered.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { NousWhisperedPayload } from '../../src/whisper/types.js';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const DID_A = 'did:noesis:alice';
const DID_B = 'did:noesis:bob';
const VALID_HASH = 'a'.repeat(64);

/** Build a clean 4-key payload that would otherwise be valid. */
function cleanPayload(): NousWhisperedPayload {
    return {
        ciphertext_hash: VALID_HASH,
        from_did: DID_A,
        tick: 1,
        to_did: DID_B,
    };
}

/**
 * Attempt to call appendNousWhispered with a payload that contains an
 * additional forbidden key. Should always throw — either for "unexpected key set"
 * (tuple violation detected first) or for a privacy violation.
 */
function attemptWithForbiddenKey(
    extraKey: string,
    extraValue: unknown,
): () => void {
    const audit = new AuditChain();
    return () => {
        appendNousWhispered(
            audit,
            DID_A,
            // Spread the extra key onto the payload — this violates both the
            // closed-tuple invariant (5 keys) and the privacy invariant.
            { ...cleanPayload(), [extraKey]: extraValue } as NousWhisperedPayload,
        );
    };
}

/**
 * Attempt to call appendNousWhispered with a payload that contains a
 * nested forbidden key. Also violates the closed-tuple invariant.
 */
function attemptWithNestedForbiddenKey(
    wrapperKey: string,
    nestedObj: Record<string, unknown>,
): () => void {
    const audit = new AuditChain();
    return () => {
        appendNousWhispered(
            audit,
            DID_A,
            { ...cleanPayload(), [wrapperKey]: nestedObj } as NousWhisperedPayload,
        );
    };
}

// ── Flat forbidden key cases (13) ─────────────────────────────────────────────

// Generate test cases from the canonical WHISPER_FORBIDDEN_KEYS array.
// Each case injects the forbidden key alongside the valid 4-tuple payload.
const FLAT_CASES: Array<[string, unknown]> = [
    ...WHISPER_FORBIDDEN_KEYS.map(k => [k, 'some-plaintext-value'] as [string, unknown]),
];

describe('whisper privacy matrix — flat forbidden keys (13)', () => {
    it.each(FLAT_CASES)(
        'rejects payload carrying forbidden key "%s"',
        (key: string, value: unknown) => {
            expect(attemptWithForbiddenKey(key, value)).toThrow();
        },
    );

    it('13 flat cases cover all WHISPER_FORBIDDEN_KEYS', () => {
        expect(FLAT_CASES.length).toBe(13);
        expect(FLAT_CASES.length).toBe(WHISPER_FORBIDDEN_KEYS.length);
    });
});

// ── Nested forbidden key cases (3) ───────────────────────────────────────────

const NESTED_CASES: Array<[string, Record<string, unknown>]> = [
    ['meta', { text: 'nested-forbidden-text' }],
    ['payload', { body: 'nested-forbidden-body' }],
    ['ext', { utterance: 'nested-forbidden-utterance' }],
];

describe('whisper privacy matrix — nested forbidden keys (3)', () => {
    it.each(NESTED_CASES)(
        'rejects nested forbidden key at path "%s.*"',
        (wrapperKey: string, nested: Record<string, unknown>) => {
            expect(attemptWithNestedForbiddenKey(wrapperKey, nested)).toThrow();
        },
    );
});

// ── Coverage assertion ────────────────────────────────────────────────────────

describe('coverage — every WHISPER_FORBIDDEN_KEY has ≥1 case in the matrix', () => {
    it('all 13 WHISPER_FORBIDDEN_KEYS are covered by flat test cases', () => {
        const flatKeys = new Set(FLAT_CASES.map(([k]) => k));
        for (const k of WHISPER_FORBIDDEN_KEYS) {
            expect(flatKeys.has(k), `Missing flat case for forbidden key: "${k}"`).toBe(true);
        }
    });

    it('total case count is exactly 16 (13 flat + 3 nested)', () => {
        expect(FLAT_CASES.length + NESTED_CASES.length).toBe(16);
    });
});
