/**
 * Wave 2 GREEN — D-11-17 / D-11-18 tombstone silent-drop tests.
 *
 * Verifies that WhisperRouter silently drops whispers to/from tombstoned DIDs:
 *   - returns false (no 410, no audit event, no log)
 *   - zero calls to audit.append with 'nous.whispered'
 *   - zero console.log / console.error / console.warn calls
 *
 * Also verifies that bios.death AFTER enqueue triggers evictDid GC.
 *
 * DIDs: did:noesis:alice (A), did:noesis:bob (B), did:noesis:carol (C).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { WhisperRouter } from '../../src/whisper/router.js';
import { PendingStore } from '../../src/whisper/pending-store.js';
import { TickRateLimiter } from '../../src/whisper/rate-limit.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { Envelope } from '../../src/whisper/types.js';
import type { WhisperRegistry } from '../../src/whisper/router.js';

const DID_A = 'did:noesis:alice';
const DID_B = 'did:noesis:bob';
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
        envelope_id: 'env-tomb-001',
        ...overrides,
    };
}

describe('WhisperRouter — sender tombstoned', () => {
    let consoleSpy: {
        log: ReturnType<typeof vi.spyOn>;
        error: ReturnType<typeof vi.spyOn>;
        warn: ReturnType<typeof vi.spyOn>;
    };
    let audit: AuditChain;
    let appendSpy: ReturnType<typeof vi.spyOn>;
    let pendingStore: PendingStore;

    beforeEach(() => {
        consoleSpy = {
            log: vi.spyOn(console, 'log').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {}),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        };
        audit = new AuditChain();
        appendSpy = vi.spyOn(audit, 'append');
        pendingStore = new PendingStore(audit);
    });

    afterEach(() => {
        pendingStore.dispose();
        consoleSpy.log.mockRestore();
        consoleSpy.error.mockRestore();
        consoleSpy.warn.mockRestore();
    });

    it('returns false silently when sender is tombstoned', () => {
        const registry: WhisperRegistry = { isTombstoned: vi.fn((did: string) => did === DID_A) };
        const router = new WhisperRouter({
            audit,
            registry,
            rateLimiter: new TickRateLimiter(),
            pendingStore,
        });

        const result = router.route(makeEnvelope(), 1);

        expect(result).toBe(false);
    });

    it('emits zero nous.whispered audit events on sender tombstone', () => {
        const registry: WhisperRegistry = { isTombstoned: vi.fn((did: string) => did === DID_A) };
        const router = new WhisperRouter({
            audit,
            registry,
            rateLimiter: new TickRateLimiter(),
            pendingStore,
        });

        router.route(makeEnvelope(), 1);

        const whisperCalls = appendSpy.mock.calls.filter(
            ([eventType]) => eventType === 'nous.whispered',
        );
        expect(whisperCalls).toHaveLength(0);
    });

    it('emits zero log lines on sender tombstone (no liveness leak per D-11-18)', () => {
        const registry: WhisperRegistry = { isTombstoned: vi.fn((did: string) => did === DID_A) };
        const router = new WhisperRouter({
            audit,
            registry,
            rateLimiter: new TickRateLimiter(),
            pendingStore,
        });

        router.route(makeEnvelope(), 1);

        expect(consoleSpy.log).not.toHaveBeenCalled();
        expect(consoleSpy.error).not.toHaveBeenCalled();
        expect(consoleSpy.warn).not.toHaveBeenCalled();
    });

    it('pending queue unchanged on sender tombstone', () => {
        const registry: WhisperRegistry = { isTombstoned: vi.fn((did: string) => did === DID_A) };
        const router = new WhisperRouter({
            audit,
            registry,
            rateLimiter: new TickRateLimiter(),
            pendingStore,
        });

        router.route(makeEnvelope(), 1);

        expect(pendingStore.countFor(DID_B)).toBe(0);
    });
});

describe('WhisperRouter — recipient tombstoned', () => {
    let consoleSpy: {
        log: ReturnType<typeof vi.spyOn>;
        error: ReturnType<typeof vi.spyOn>;
        warn: ReturnType<typeof vi.spyOn>;
    };
    let audit: AuditChain;
    let appendSpy: ReturnType<typeof vi.spyOn>;
    let pendingStore: PendingStore;

    beforeEach(() => {
        consoleSpy = {
            log: vi.spyOn(console, 'log').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {}),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        };
        audit = new AuditChain();
        appendSpy = vi.spyOn(audit, 'append');
        pendingStore = new PendingStore(audit);
    });

    afterEach(() => {
        pendingStore.dispose();
        consoleSpy.log.mockRestore();
        consoleSpy.error.mockRestore();
        consoleSpy.warn.mockRestore();
    });

    it('returns false silently when recipient is tombstoned', () => {
        const registry: WhisperRegistry = { isTombstoned: vi.fn((did: string) => did === DID_B) };
        const router = new WhisperRouter({
            audit,
            registry,
            rateLimiter: new TickRateLimiter(),
            pendingStore,
        });

        const result = router.route(makeEnvelope(), 1);

        expect(result).toBe(false);
    });

    it('emits zero nous.whispered audit events on recipient tombstone', () => {
        const registry: WhisperRegistry = { isTombstoned: vi.fn((did: string) => did === DID_B) };
        const router = new WhisperRouter({
            audit,
            registry,
            rateLimiter: new TickRateLimiter(),
            pendingStore,
        });

        router.route(makeEnvelope(), 1);

        const whisperCalls = appendSpy.mock.calls.filter(
            ([eventType]) => eventType === 'nous.whispered',
        );
        expect(whisperCalls).toHaveLength(0);
    });

    it('emits zero log lines on recipient tombstone', () => {
        const registry: WhisperRegistry = { isTombstoned: vi.fn((did: string) => did === DID_B) };
        const router = new WhisperRouter({
            audit,
            registry,
            rateLimiter: new TickRateLimiter(),
            pendingStore,
        });

        router.route(makeEnvelope(), 1);

        expect(consoleSpy.log).not.toHaveBeenCalled();
        expect(consoleSpy.error).not.toHaveBeenCalled();
        expect(consoleSpy.warn).not.toHaveBeenCalled();
    });
});

describe('PendingStore — bios.death AFTER enqueue triggers eviction', () => {
    it('bios.death on recipient DID clears queue via evictDid', () => {
        const audit = new AuditChain();
        const pendingStore = new PendingStore(audit);

        // Enqueue directly (bypass router for this unit test)
        pendingStore.enqueue(makeEnvelope({ to_did: DID_B, from_did: DID_A }));
        expect(pendingStore.countFor(DID_B)).toBe(1);

        // Simulate bios.death for recipient (DID_B)
        audit.append('bios.death', DID_B, {
            cause: 'operator_h5',
            did: DID_B,
            final_state_hash: 'b'.repeat(64),
            tick: 5,
        });

        // evictDid should have run via the listener
        expect(pendingStore.drainFor(DID_B)).toHaveLength(0);
        pendingStore.dispose();
    });

    it('bios.death on sender DID scrubs envelopes from_did across all recipient queues', () => {
        const audit = new AuditChain();
        const pendingStore = new PendingStore(audit);

        // Enqueue A→B envelope
        pendingStore.enqueue(makeEnvelope({ to_did: DID_B, from_did: DID_A, envelope_id: 'e1' }));
        expect(pendingStore.countFor(DID_B)).toBe(1);

        // Simulate bios.death for SENDER (DID_A)
        audit.append('bios.death', DID_A, {
            cause: 'starvation',
            did: DID_A,
            final_state_hash: 'c'.repeat(64),
            tick: 10,
        });

        // Cross-recipient sender scrub: envelope from DID_A should be gone from DID_B's queue
        expect(pendingStore.drainFor(DID_B)).toHaveLength(0);
        pendingStore.dispose();
    });
});

describe('WhisperRouter — post-death whisper from healthy A to tombstoned B', () => {
    it('returns false, no audit chain growth, no 410 shape', () => {
        const audit = new AuditChain();
        const initialLength = audit.length;
        const pendingStore = new PendingStore(audit);

        const registry: WhisperRegistry = { isTombstoned: vi.fn((did: string) => did === DID_B) };
        const router = new WhisperRouter({
            audit,
            registry,
            rateLimiter: new TickRateLimiter(),
            pendingStore,
        });

        const result = router.route(makeEnvelope(), 1);

        expect(result).toBe(false);
        // Audit chain has grown by zero entries (no nous.whispered, no bios.death triggered)
        expect(audit.length).toBe(initialLength);
        // Queue for B is empty
        expect(pendingStore.countFor(DID_B)).toBe(0);

        pendingStore.dispose();
    });
});
