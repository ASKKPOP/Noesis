/**
 * Phase 31 OBS-02 (D-31-C1..C4). AuditReconcile unit tests.
 *
 * Mocks (no real MySQL): a FakeDb that returns pre-programmed rows,
 * a CapturingStore that records every append call for assertion.
 *
 * Spy strategy: same as audit-persistence-wiring.test.ts — Pino child loggers
 * share the prototype warn/info/error reference with the base logger, so
 * vi.spyOn(logger, 'warn') intercepts calls from the child logger inside
 * audit-reconcile.ts without any source-file modification (Option A).
 */
import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';
import { AuditReconcile, REPLAY_BATCH_CAP, DIVERGENCE_WARN_THRESHOLD } from '../src/db/audit-reconcile.js';
import { logger } from '../src/util/logger.js';
import type { IAuditStore } from '../src/db/types.js';
import type { DatabaseConnection } from '../src/db/connection.js';
import type { AuditEntry } from '../src/audit/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

class FakeDb {
    public maxId: number = 0;
    public throwOnExecute: (Error & { code?: string }) | null = null;

    async query<T = unknown>(_sql: string, _params: unknown[]): Promise<T[]> {
        if (this.throwOnExecute) throw this.throwOnExecute;
        return [{ max_id: this.maxId } as unknown as T];
    }

    async execute(_sql: string, _params: unknown[]): Promise<void> {
        if (this.throwOnExecute) throw this.throwOnExecute;
    }

    getPool(): never {
        throw new Error('not used in tests');
    }
}

class CapturingStore implements IAuditStore {
    public appends: AuditEntry[] = [];
    public failIds: Set<number> = new Set();

    async append(_grid: string, entry: AuditEntry): Promise<void> {
        if (this.failIds.has(entry.id ?? -1)) {
            const err = Object.assign(new Error(`simulated fail id=${entry.id}`), {
                code: 'ER_LOCK_WAIT_TIMEOUT',
            });
            throw err;
        }
        this.appends.push(entry);
    }

    async loadAll(): Promise<AuditEntry[]> {
        return [];
    }
}

/**
 * Build a chain with N entries (ids 1..N). Uses real AuditChain.append so
 * hashes are genuine and id assignment follows the actual implementation.
 */
function fillChain(n: number): AuditChain {
    const chain = new AuditChain();
    for (let i = 1; i <= n; i++) {
        chain.append('nous.spoke', `did:noesis:n${i}`, {
            tick: i,
            message_hash: i.toString().padStart(64, '0'),
        });
    }
    return chain;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuditReconcile constants (D-31-C1/C2)', () => {
    it('REPLAY_BATCH_CAP is 500 and DIVERGENCE_WARN_THRESHOLD is 10', () => {
        expect(REPLAY_BATCH_CAP).toBe(500);
        expect(DIVERGENCE_WARN_THRESHOLD).toBe(10);
    });
});

describe('AuditReconcile getters — initial state', () => {
    it('reports zero/null before first run', () => {
        const r = new AuditReconcile(
            new AuditChain(),
            new CapturingStore(),
            new FakeDb() as unknown as DatabaseConnection,
            'genesis',
        );
        expect(r.lastReconcileAt).toBe(0);
        expect(r.persistedMaxId).toBeNull();
        expect(r.lastPersistError).toBeNull();
    });
});

describe('AuditReconcile.run() — happy path no divergence', () => {
    it('emits info heartbeat with divergence 0 and no store.append calls', async () => {
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        try {
            const chain = fillChain(5);
            const store = new CapturingStore();
            const db = new FakeDb();
            db.maxId = 5;

            const r = new AuditReconcile(chain, store, db as unknown as DatabaseConnection, 'genesis');
            await r.run();

            expect(store.appends).toHaveLength(0);
            expect(r.persistedMaxId).toBe(5);
            expect(r.lastReconcileAt).toBeGreaterThan(0);

            const lastCall = infoSpy.mock.calls.at(-1);
            expect(lastCall?.[0]).toMatchObject({
                event: 'audit_reconcile_ok',
                divergence: 0,
                replayed: 0,
                remaining: 0,
            });
        } finally {
            vi.restoreAllMocks();
        }
    });
});

describe('AuditReconcile.run() — replay batch cap (R-31-02 / D-31-C2)', () => {
    it('replays exactly 500 entries when divergence is 1000', async () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            const chain = fillChain(1000);
            const store = new CapturingStore();
            const db = new FakeDb();
            db.maxId = 0;

            const r = new AuditReconcile(chain, store, db as unknown as DatabaseConnection, 'genesis');
            await r.run();

            // Cap at 500 — exactly REPLAY_BATCH_CAP appends
            expect(store.appends).toHaveLength(500);
            // First replayed entry has id=1 (entries where id > 0)
            expect(store.appends[0].id).toBe(1);
            expect(store.appends[499].id).toBe(500);

            // divergence 1000 > DIVERGENCE_WARN_THRESHOLD 10 → warn
            const lastCall = warnSpy.mock.calls.at(-1);
            expect(lastCall?.[0]).toMatchObject({
                event: 'audit_reconcile_replay',
                divergence: 1000,
                replayed: 500,
                remaining: 500,
            });
        } finally {
            vi.restoreAllMocks();
        }
    });
});

describe('AuditReconcile.run() — divergence threshold log level (D-31-C1)', () => {
    it('logs at info when divergence <= DIVERGENCE_WARN_THRESHOLD (10)', async () => {
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            // chain 12 entries, DB has 5 → divergence = 7 → below threshold → info
            const chain = fillChain(12);
            const store = new CapturingStore();
            const db = new FakeDb();
            db.maxId = 5;

            const r = new AuditReconcile(chain, store, db as unknown as DatabaseConnection, 'genesis');
            await r.run();

            // divergence=7 is <= 10, so final log must be info (not warn)
            expect(infoSpy).toHaveBeenCalled();
            // Confirm no warn was emitted for the heartbeat (only possible warn would be per-entry failures)
            const heartbeatWarnCalls = warnSpy.mock.calls.filter(c =>
                (c[0] as { event?: string })?.event === 'audit_reconcile_replay' ||
                (c[0] as { event?: string })?.event === 'audit_reconcile_ok'
            );
            expect(heartbeatWarnCalls).toHaveLength(0);
        } finally {
            vi.restoreAllMocks();
        }
    });

    it('logs at warn when divergence > DIVERGENCE_WARN_THRESHOLD (10)', async () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            // chain 20 entries, DB has 5 → divergence = 15 → above threshold → warn
            const chain = fillChain(20);
            const store = new CapturingStore();
            const db = new FakeDb();
            db.maxId = 5;

            const r = new AuditReconcile(chain, store, db as unknown as DatabaseConnection, 'genesis');
            await r.run();

            // divergence=15 > 10 → heartbeat must be warn
            expect(warnSpy).toHaveBeenCalled();
            const lastCall = warnSpy.mock.calls.at(-1);
            expect(lastCall?.[0]).toMatchObject({ divergence: 15 });
        } finally {
            vi.restoreAllMocks();
        }
    });
});

describe('AuditReconcile.run() — per-entry failure recovery', () => {
    it('continues replay after one entry fails and records lastPersistError', async () => {
        vi.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            const chain = fillChain(3);
            const store = new CapturingStore();
            store.failIds.add(2); // entry with id=2 will throw

            const db = new FakeDb();
            db.maxId = 0;

            const r = new AuditReconcile(chain, store, db as unknown as DatabaseConnection, 'genesis');
            await r.run();

            // Entries 1 and 3 persisted; entry 2 threw but did not abort the batch
            expect(store.appends.map(e => e.id)).toEqual([1, 3]);
            expect(r.lastPersistError?.code).toBe('ER_LOCK_WAIT_TIMEOUT');
        } finally {
            vi.restoreAllMocks();
        }
    });
});

describe('AuditReconcile.run() — outer catch (defense-in-depth)', () => {
    it('does not throw when db.query() rejects; logs error and updates lastReconcileAt', async () => {
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        try {
            const chain = fillChain(3);
            const store = new CapturingStore();
            const db = new FakeDb();
            db.throwOnExecute = Object.assign(new Error('mysql down'), { code: 'ECONNREFUSED' });

            const r = new AuditReconcile(chain, store, db as unknown as DatabaseConnection, 'genesis');

            // Must resolve, never throw
            await expect(r.run()).resolves.toBeUndefined();

            expect(r.lastReconcileAt).toBeGreaterThan(0);
            expect(r.lastPersistError?.code).toBe('ECONNREFUSED');
            expect(errorSpy).toHaveBeenCalled();
            const lastCall = errorSpy.mock.calls.at(-1);
            expect(lastCall?.[0]).toMatchObject({ event: 'audit_reconcile_failed' });
        } finally {
            vi.restoreAllMocks();
        }
    });
});

describe('AuditReconcile.run() — idempotency across cycles (INSERT IGNORE)', () => {
    it('second run is a no-op after first run catches up', async () => {
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        try {
            const chain = fillChain(5);
            const store = new CapturingStore();
            const db = new FakeDb();
            db.maxId = 0;

            const r = new AuditReconcile(chain, store, db as unknown as DatabaseConnection, 'genesis');
            await r.run();
            // First run replays all 5 entries
            expect(store.appends).toHaveLength(5);

            // Simulate DB now reflecting the replayed state
            db.maxId = 5;
            await r.run();
            // Second run: divergence=0, no new appends
            expect(store.appends).toHaveLength(5);
        } finally {
            vi.restoreAllMocks();
        }
    });
});
