/**
 * Wave 2 GREEN — WHISPER-03 / WHISPER-05 WhisperRouter orchestration tests.
 *
 * Verifies the locked 5-step side-effect order, silent-drop semantics,
 * and PendingStore round-trip.
 *
 * DIDs from project pattern: did:noesis:alice, did:noesis:bob, did:noesis:carol.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WhisperRouter } from '../../src/whisper/router.js';
import { PendingStore } from '../../src/whisper/pending-store.js';
import { TickRateLimiter } from '../../src/whisper/rate-limit.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { Envelope } from '../../src/whisper/types.js';
import type { WhisperRegistry } from '../../src/whisper/router.js';

const DID_A = 'did:noesis:alice';
const DID_B = 'did:noesis:bob';
const DID_C = 'did:noesis:carol';
const VALID_HASH = 'a'.repeat(64);

function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
    return {
        version: 1,
        from_did: DID_A,
        to_did: DID_B,
        tick: 1,
        nonce_b64: 'A'.repeat(32),
        ephemeral_pub_b64: 'B'.repeat(44),
        ciphertext_b64: 'C'.repeat(44),
        ciphertext_hash: VALID_HASH,
        envelope_id: 'env-001',
        ...overrides,
    };
}

function makeRegistry(tombstoned: string[] = []): WhisperRegistry {
    return { isTombstoned: vi.fn((did: string) => tombstoned.includes(did)) };
}

describe('WhisperRouter — happy path (locked side-effect order)', () => {
    it('returns true and fires all 5 steps in locked order', () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');
        const registry = makeRegistry();
        const rateLimiter = new TickRateLimiter({ rateBudget: 10, rateWindowTicks: 100, envelopeVersion: 1 });
        const tryConsumeSpy = vi.spyOn(rateLimiter, 'tryConsume');
        const pendingStore = new PendingStore(audit);
        const enqueueSpy = vi.spyOn(pendingStore, 'enqueue');

        const router = new WhisperRouter({ audit, registry, rateLimiter, pendingStore });
        const env = makeEnvelope();
        const result = router.route(env, 1);

        expect(result).toBe(true);

        // appendNousWhispered calls audit.append; pendingStore.enqueue follows
        expect(appendSpy).toHaveBeenCalledTimes(1);
        expect(appendSpy).toHaveBeenCalledWith('nous.whispered', DID_A, {
            ciphertext_hash: VALID_HASH,
            from_did: DID_A,
            tick: 1,
            to_did: DID_B,
        });
        expect(enqueueSpy).toHaveBeenCalledTimes(1);
        expect(enqueueSpy).toHaveBeenCalledWith(env);

        // Verify audit.append came BEFORE enqueue via invocation order
        const appendOrder = appendSpy.mock.invocationCallOrder[0];
        const enqueueOrder = enqueueSpy.mock.invocationCallOrder[0];
        expect(appendOrder).toBeLessThan(enqueueOrder);

        // registry.isTombstoned called before rateLimiter.tryConsume
        const tombstoneOrder = (registry.isTombstoned as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
        expect(tombstoneOrder).toBeLessThan(appendOrder);

        // rateLimiter.tryConsume called before audit.append
        const consumeOrder = tryConsumeSpy.mock.invocationCallOrder[0];
        expect(consumeOrder).toBeLessThan(appendOrder);

        pendingStore.dispose();
    });
});

describe('WhisperRouter — rate-limit silent drop', () => {
    it('returns false; audit.append and pendingStore.enqueue NOT called', () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');
        const registry = makeRegistry();
        // Exhausted limiter: rateBudget=0 means always false
        const rateLimiter = new TickRateLimiter({ rateBudget: 0, rateWindowTicks: 100, envelopeVersion: 1 });
        const pendingStore = new PendingStore(audit);
        const enqueueSpy = vi.spyOn(pendingStore, 'enqueue');

        const router = new WhisperRouter({ audit, registry, rateLimiter, pendingStore });
        const result = router.route(makeEnvelope(), 1);

        expect(result).toBe(false);
        expect(appendSpy).not.toHaveBeenCalledWith('nous.whispered', expect.anything(), expect.anything());
        expect(enqueueSpy).not.toHaveBeenCalled();

        pendingStore.dispose();
    });
});

describe('WhisperRouter — validation failure (bad DID)', () => {
    it('throws on bad from_did; no downstream calls', () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');
        const registry = makeRegistry();
        const rateLimiter = new TickRateLimiter();
        const tryConsumeSpy = vi.spyOn(rateLimiter, 'tryConsume');
        const pendingStore = new PendingStore(audit);
        const enqueueSpy = vi.spyOn(pendingStore, 'enqueue');

        const router = new WhisperRouter({ audit, registry, rateLimiter, pendingStore });
        const env = makeEnvelope({ from_did: 'not-a-did' });

        expect(() => router.route(env, 1)).toThrow(/invalid from_did/);
        expect(appendSpy).not.toHaveBeenCalled();
        expect(tryConsumeSpy).not.toHaveBeenCalled();
        expect(enqueueSpy).not.toHaveBeenCalled();
        expect((registry.isTombstoned as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();

        pendingStore.dispose();
    });

    it('throws on bad to_did; no downstream calls', () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');
        const registry = makeRegistry();
        const rateLimiter = new TickRateLimiter();
        const pendingStore = new PendingStore(audit);
        const enqueueSpy = vi.spyOn(pendingStore, 'enqueue');

        const router = new WhisperRouter({ audit, registry, rateLimiter, pendingStore });
        const env = makeEnvelope({ to_did: 'bad-did' });

        expect(() => router.route(env, 1)).toThrow(/invalid to_did/);
        expect(appendSpy).not.toHaveBeenCalled();
        expect(enqueueSpy).not.toHaveBeenCalled();

        pendingStore.dispose();
    });
});

describe('WhisperRouter + PendingStore round-trip', () => {
    let audit: AuditChain;
    let pendingStore: PendingStore;
    let router: WhisperRouter;

    beforeEach(() => {
        audit = new AuditChain();
        const registry = makeRegistry();
        const rateLimiter = new TickRateLimiter();
        pendingStore = new PendingStore(audit);
        router = new WhisperRouter({ audit, registry, rateLimiter, pendingStore });
    });

    it('routes 3 envelopes; drainFor returns all 3', () => {
        const env1 = makeEnvelope({ envelope_id: 'e1', ciphertext_hash: 'a'.repeat(64) });
        const env2 = makeEnvelope({ envelope_id: 'e2', ciphertext_hash: 'b'.repeat(64) });
        const env3 = makeEnvelope({ envelope_id: 'e3', ciphertext_hash: 'c'.repeat(64) });

        expect(router.route(env1, 1)).toBe(true);
        expect(router.route(env2, 2)).toBe(true);
        expect(router.route(env3, 3)).toBe(true);

        const drained = pendingStore.drainFor(DID_B);
        expect(drained).toHaveLength(3);
    });

    it('ackDelete removes exactly the acknowledged envelope', () => {
        const env1 = makeEnvelope({ envelope_id: 'e1', ciphertext_hash: 'a'.repeat(64) });
        const env2 = makeEnvelope({ envelope_id: 'e2', ciphertext_hash: 'b'.repeat(64) });
        const env3 = makeEnvelope({ envelope_id: 'e3', ciphertext_hash: 'c'.repeat(64) });

        router.route(env1, 1);
        router.route(env2, 2);
        router.route(env3, 3);

        const deleted = pendingStore.ackDelete(DID_B, new Set(['e2']));
        expect(deleted).toBe(1);

        const remaining = pendingStore.drainFor(DID_B);
        expect(remaining).toHaveLength(2);
        expect(remaining.map(e => e.envelope_id)).not.toContain('e2');
    });

    it('size() and countFor() reflect queue state', () => {
        const env1 = makeEnvelope({ envelope_id: 'e1', to_did: DID_B, from_did: DID_A, ciphertext_hash: 'a'.repeat(64) });
        const env2 = makeEnvelope({ envelope_id: 'e2', to_did: DID_C, from_did: DID_A, ciphertext_hash: 'b'.repeat(64) });

        router.route(env1, 1);
        router.route(env2, 2);

        expect(pendingStore.size()).toBe(2);
        expect(pendingStore.countFor(DID_B)).toBe(1);
        expect(pendingStore.countFor(DID_C)).toBe(1);
    });
});
