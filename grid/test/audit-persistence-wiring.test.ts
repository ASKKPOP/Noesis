/**
 * Phase 31 OBS-01 + OBS-03 wiring regression.
 *
 * - Asserts GenesisLauncher.audit is PersistentAuditChain when deps.audit is supplied,
 *   plain AuditChain otherwise (backwards-compat for >40 existing unit-test call sites).
 * - R-31-01 zero-diff: identical appends produce identical chain.head with vs without DB.
 * - OBS-03: persist failure populates lastPersistError AND emits structured Pino warn.
 *
 * Spy strategy: Pino child loggers share the same warn() reference as the base logger
 * (`child.warn === base.warn` is true — confirmed at implementation time). Therefore
 * `vi.spyOn(logger, 'warn')` intercepts both base and child calls (Option A per plan).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenesisLauncher } from '../src/genesis/launcher.js';
import { AuditChain } from '../src/audit/chain.js';
import { PersistentAuditChain } from '../src/db/persistent-chain.js';
import { logger } from '../src/util/logger.js';
import type { IAuditStore } from '../src/db/types.js';
import type { AuditEntry } from '../src/audit/types.js';
import { TEST_CONFIG } from '../src/genesis/presets.js';

const baseConfig = TEST_CONFIG;

// ── Mock store implementations ─────────────────────────────────────────────────

class OkStore implements IAuditStore {
    public calls: Array<{ gridName: string; entry: AuditEntry }> = [];

    async append(gridName: string, entry: AuditEntry): Promise<void> {
        this.calls.push({ gridName, entry });
    }

    async loadAll(_gridName: string): Promise<AuditEntry[]> {
        return [];
    }
}

class FailStore implements IAuditStore {
    constructor(private readonly errorCode: string = 'ER_LOCK_WAIT_TIMEOUT') {}

    async append(): Promise<void> {
        const err = new Error('simulated DB outage') as Error & { code: string };
        err.code = this.errorCode;
        throw err;
    }

    async loadAll(_gridName: string): Promise<AuditEntry[]> {
        return [];
    }
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('OBS-01 PersistentAuditChain wiring', () => {
    it('uses plain AuditChain when no deps supplied (backwards-compat)', () => {
        const launcher = new GenesisLauncher(baseConfig);
        expect(launcher.audit).toBeInstanceOf(AuditChain);
        // Negative assertion: NOT the persistent subclass.
        expect(launcher.audit instanceof PersistentAuditChain).toBe(false);
    });

    it('uses injected PersistentAuditChain when deps.audit supplied', () => {
        const chain = new PersistentAuditChain(new OkStore(), 'genesis');
        const launcher = new GenesisLauncher(baseConfig, { audit: chain });
        expect(launcher.audit).toBe(chain);
        expect(launcher.audit).toBeInstanceOf(PersistentAuditChain);
    });
});

describe('R-31-01 zero-diff: chain head identical with vs without DB', () => {
    it('produces byte-identical head hash after N identical appends', async () => {
        // Determinism: Date.now() drives entry.createdAt + the hash. Freeze it.
        const FIXED_NOW = 1_700_000_000_000;
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_NOW);

        try {
            const plain = new AuditChain();
            const persistent = new PersistentAuditChain(new OkStore(), 'genesis');

            const events: Array<[string, string, Record<string, unknown>]> = [
                ['nous.spoke',        'did:noesis:alpha',   { tick: 1, message_hash: 'a'.repeat(64) }],
                ['nous.moved',        'did:noesis:beta',    { tick: 2, region: 'agora' }],
                ['trade.proposed',    'did:noesis:gamma',   { tick: 3, counterparty: 'did:noesis:delta', amount: 5, nonce: 'n1' }],
                ['nous.spawned',      'did:noesis:epsilon', { tick: 4, region: 'market' }],
                ['nous.direct_message','did:noesis:zeta',  { tick: 5, message_hash: 'b'.repeat(64) }],
                ['nous.spoke',        'did:noesis:eta',     { tick: 6, message_hash: 'c'.repeat(64) }],
                ['nous.moved',        'did:noesis:theta',   { tick: 7, region: 'council' }],
                ['nous.spoke',        'did:noesis:iota',    { tick: 8, message_hash: 'd'.repeat(64) }],
                ['nous.moved',        'did:noesis:kappa',   { tick: 9, region: 'agora' }],
                ['nous.spoke',        'did:noesis:lambda',  { tick: 10, message_hash: 'e'.repeat(64) }],
            ];

            for (const [t, a, p] of events) {
                plain.append(t, a, p);
                persistent.append(t, a, p);
            }

            // Drain microtasks (the persistent chain fire-and-forget store.append is async).
            await Promise.resolve();

            expect(plain.head).toBe(persistent.head);
            expect(plain.length).toBe(persistent.length);
            expect(plain.length).toBe(10);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('OBS-03 persist failure: structured Pino + lastPersistError', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('records lastPersistError and emits logger.warn with closed shape', async () => {
        // Option A: spy on base logger warn — child.warn === base.warn (Pino prototype sharing).
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const chain = new PersistentAuditChain(new FailStore('ER_LOCK_WAIT_TIMEOUT'), 'genesis');

        expect(chain.lastPersistError).toBeNull();

        chain.append('nous.spoke', 'did:noesis:test', { tick: 1, message_hash: 'f'.repeat(64) });

        // Allow the fire-and-forget .catch() to settle.
        await new Promise<void>((r) => setImmediate(r));

        expect(chain.lastPersistError).not.toBeNull();
        expect(chain.lastPersistError?.code).toBe('ER_LOCK_WAIT_TIMEOUT');
        expect(typeof chain.lastPersistError?.at).toBe('number');

        // Pino warn was called with the closed shape.
        expect(warnSpy).toHaveBeenCalledTimes(1);
        // Pino's first arg is the object, second is the message string.
        const [obj, msg] = warnSpy.mock.calls[0] as [Record<string, unknown>, string];
        expect(obj).toMatchObject({
            event: 'audit_persist_failed',
            event_type: 'nous.spoke',
            error_code: 'ER_LOCK_WAIT_TIMEOUT',
        });
        expect(typeof (obj as { entry_id?: number }).entry_id).toBe('number');
        expect(typeof (obj as { error_message?: string }).error_message).toBe('string');
        expect(msg).toBe('failed to persist audit entry');
    });
});
