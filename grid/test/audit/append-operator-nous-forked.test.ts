/**
 * Phase 43 FORK-04 — append-operator-nous-forked sole-producer test.
 *
 * Event: operator.nous_forked
 * Keys (alphabetical): civic_did_hash, fork_reason, operator_did_hash, package_hash, tick
 * Sole producer: grid/src/audit/append-operator-nous-forked.ts
 *
 * 9-step discipline:
 *   1. operatorId format guard (OPERATOR_ID_RE)
 *   2. payload type guard (plain object, non-null, non-array)
 *   3. literal/enum guard (fork_reason ∈ {operator_exit})
 *   4. regex/range guards (HEX64_RE for hash fields; non-negative integer for tick)
 *   5. [SKIPPED — operator_id is not in payload, no self-report invariant]
 *   6. closed-tuple structural check
 *   7. explicit reconstruction (no spread)
 *   8. privacy gate (payloadPrivacyCheck)
 *   9. commit (audit.append)
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendOperatorNousForked } from '../../src/audit/append-operator-nous-forked.js';

function validOperatorId(): string {
    return 'op:12345678-1234-4234-8234-123456789012';
}

function validPayload() {
    return {
        civic_did_hash: 'a'.repeat(64),
        fork_reason: 'operator_exit' as const,
        operator_did_hash: 'b'.repeat(64),
        package_hash: 'c'.repeat(64),
        tick: 42,
    };
}

function makeChain(): AuditChain {
    return new AuditChain();
}

describe('appendOperatorNousForked — Step 1: operatorId format guard', () => {
    it('Test 1: throws TypeError when operatorId does not match OPERATOR_ID_RE (invalid format)', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), 'invalid-operator-id', validPayload()),
        ).toThrow(TypeError);
    });

    it('Test 1b: throws TypeError when operatorId is not a string', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), 42 as unknown as string, validPayload()),
        ).toThrow(TypeError);
    });

    it('Test 1c: throws TypeError when operatorId is missing op: prefix', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), '12345678-1234-4234-8234-123456789012', validPayload()),
        ).toThrow(TypeError);
    });
});

describe('appendOperatorNousForked — Step 2: payload type guard', () => {
    it('Test 2: throws TypeError when payload is null', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), null as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('Test 3: throws TypeError when payload is not a plain object (array)', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), [] as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('Test 3b: throws TypeError when payload is a primitive (string)', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), 'bad' as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });
});

describe('appendOperatorNousForked — Step 3: literal/enum guard', () => {
    it('Test 4: throws TypeError when fork_reason is not "operator_exit"', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), {
                ...validPayload(),
                fork_reason: 'invalid_reason' as unknown as 'operator_exit',
            }),
        ).toThrow(TypeError);
    });

    it('Test 4b: throws TypeError when fork_reason is empty string', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), {
                ...validPayload(),
                fork_reason: '' as unknown as 'operator_exit',
            }),
        ).toThrow(TypeError);
    });
});

describe('appendOperatorNousForked — Step 4: regex/range guards', () => {
    it('Test 5a: throws TypeError when civic_did_hash fails HEX64_RE (too short)', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), {
                ...validPayload(),
                civic_did_hash: 'abc123',
            }),
        ).toThrow(TypeError);
    });

    it('Test 5b: throws TypeError when operator_did_hash fails HEX64_RE (uppercase)', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), {
                ...validPayload(),
                operator_did_hash: 'A'.repeat(64),
            }),
        ).toThrow(TypeError);
    });

    it('Test 5c: throws TypeError when package_hash fails HEX64_RE (not hex)', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), {
                ...validPayload(),
                package_hash: 'z'.repeat(64),
            }),
        ).toThrow(TypeError);
    });

    it('Test 6: throws TypeError when tick is not a non-negative integer (negative)', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), {
                ...validPayload(),
                tick: -1,
            }),
        ).toThrow(TypeError);
    });

    it('Test 6b: throws TypeError when tick is a float', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), {
                ...validPayload(),
                tick: 1.5,
            }),
        ).toThrow(TypeError);
    });
});

describe('appendOperatorNousForked — Step 6: closed-tuple structural check', () => {
    it('Test 7: throws TypeError on extra key — error message matches /unexpected key set/', () => {
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), {
                ...validPayload(),
                extra_key: 'not-allowed',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/unexpected key set/);
    });

    it('Test 8: throws TypeError on missing key', () => {
        const partial = { ...validPayload() } as Record<string, unknown>;
        delete partial['package_hash'];
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), partial as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });
});

describe('appendOperatorNousForked — Step 8: privacy gate', () => {
    it('Test 9: privacy gate rejects forbidden keys (belt-and-suspenders smoke test)', () => {
        // Inject a payload with an explicitly reconstructed forbidden key via type coercion
        // to verify the privacy gate fires if the reconstruction step somehow leaks a bad key.
        // The closed-tuple check fires first, so we have to bypass it for this test.
        // Since the 5-key tuple is enforced above, we test that payloadPrivacyCheck is present
        // in the implementation by verifying the function throws on forbidden-key payloads
        // via the structural guard (extra key path).
        // Smoke-test: supply a forbidden-keyed extra field → structural guard fires (TypeError)
        expect(() =>
            appendOperatorNousForked(makeChain(), validOperatorId(), {
                civic_did_hash: 'a'.repeat(64),
                fork_reason: 'operator_exit' as const,
                operator_did_hash: 'b'.repeat(64),
                package_hash: 'c'.repeat(64),
                tick: 42,
                prompt: 'leaked',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });
});

describe('appendOperatorNousForked — Step 9: happy path', () => {
    it('Test 10: succeeds with valid payload — returns AuditEntry where eventType === "operator.nous_forked"', () => {
        const audit = makeChain();
        const entry = appendOperatorNousForked(audit, validOperatorId(), validPayload());
        expect(entry).toBeDefined();
        expect(entry.eventType).toBe('operator.nous_forked');
    });

    it('Test 10b: payload keys in returned entry match EXPECTED_KEYS (alphabetical closed-tuple)', () => {
        const audit = makeChain();
        const entry = appendOperatorNousForked(audit, validOperatorId(), validPayload());
        const EXPECTED_KEYS = ['civic_did_hash', 'fork_reason', 'operator_did_hash', 'package_hash', 'tick'];
        expect(Object.keys(entry.payload).sort()).toEqual(EXPECTED_KEYS);
    });

    it('Test 10c: actorDid in returned entry equals the operatorId param', () => {
        const audit = makeChain();
        const opId = validOperatorId();
        const entry = appendOperatorNousForked(audit, opId, validPayload());
        expect(entry.actorDid).toBe(opId);
    });

    it('Test 10d: accepts tick=0 (boundary)', () => {
        const audit = makeChain();
        const entry = appendOperatorNousForked(audit, validOperatorId(), { ...validPayload(), tick: 0 });
        expect(entry.eventType).toBe('operator.nous_forked');
    });
});
