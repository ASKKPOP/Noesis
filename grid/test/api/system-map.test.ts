/**
 * System Map aggregator — GET /api/v1/system/map (public, read-only, aggregate-only).
 *
 * Every status + metric in the response is COMPUTED from live Grid state, never
 * constant. These tests prove:
 *   (a) the endpoint returns 200 with all 4 surfaces + 8 institutions present;
 *   (b) populated mock DB → institutions 'active', brain 'up', portal counts from GROUP BY;
 *   (c) zero-row mock → 'empty' (proves the status is computed, not a literal);
 *   (d) ONE throwing table guards that item to 'down' while the other 11 still compute
 *       and the response is still 200 (per-item isolation guard);
 *   (e) pool absent → DB-backed items 'down'/'db_unavailable' but grid/steward still compute, 200;
 *   (f) SQL discipline: every query is SELECT-only, grid_name is a bound param (not
 *       interpolated), and `status` is backticked where used;
 *   (g) no DID / PII anywhere in the payload — counts + config only.
 *
 * Mock-Pool pattern (no DB) per test/api/portal-manager-registrations.test.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

type MockPool = { query: ReturnType<typeof vi.fn> };

/** Build a clock advanced past the cold-start grace window (tick >= 60) and started
 *  so `running` is true (mirrors a production Grid). A very long tickRateMs keeps
 *  the interval idle for the duration of the test; app.close() stops it. */
function warmRunningClock(): WorldClock {
    const clock = new WorldClock({ tickRateMs: 10_000_000 });
    for (let i = 0; i < 65; i++) clock.advance();
    clock.start();
    return clock;
}

/**
 * Default per-table row dispatch. queryFn inspects the SQL string and returns the
 * matching COUNT/GROUP-BY rows — the makePool idiom from portal-manager tests.
 * `populated` toggles between nonzero and zero counts.
 */
function makeQueryFn(opts: { populated: boolean; throwOn?: RegExp }) {
    const { populated, throwOn } = opts;
    const n = populated ? 3 : 0;
    return (sql: string, _params: unknown[]): [unknown[], unknown] => {
        if (throwOn && throwOn.test(sql)) throw new Error('simulated_query_failure');

        // Portal — GROUP BY status counts.
        if (/human_civic_applications/i.test(sql)) {
            return populated
                ? [[{ status: 'pending', n: 2 }, { status: 'approved', n: 5 }, { status: 'rejected', n: 1 }], undefined]
                : [[], undefined];
        }
        // Brain — total/unowned/active.
        if (/brain_tokens/i.test(sql)) {
            return [[{ total: populated ? 4 : 0, unowned: populated ? 1 : 0, active: populated ? 3 : 0 }], undefined];
        }
        // Registry — civic + nous active counts (two separate SELECTs).
        if (/civic_did_registry/i.test(sql)) return [[{ n }], undefined];
        if (/nous_registry/i.test(sql)) return [[{ n }], undefined];
        // Polis — active + enacted.
        if (/gov_bills/i.test(sql)) return [[{ active: n, enacted: populated ? 1 : 0 }], undefined];
        // Police — complaints + duration-based active sanctions.
        if (/police_complaints/i.test(sql)) return [[{ n }], undefined];
        if (/police_sanctions/i.test(sql)) return [[{ active: n }], undefined];
        // IRS — treasury balance + fee-rate config.
        if (/civic_treasury/i.test(sql)) return [[{ balance_bios: populated ? '123456' : '0' }], undefined];
        if (/grid_config/i.test(sql)) return populated ? [[{ config_value: '0.02' }], undefined] : [[], undefined];
        // Marketplace — listings + escrow.
        if (/marketplace_listings/i.test(sql)) return [[{ n }], undefined];
        if (/marketplace_escrow/i.test(sql)) return [[{ n }], undefined];
        // Library — published + citations.
        if (/library_entries/i.test(sql)) return [[{ published: n, citations: populated ? 9 : 0 }], undefined];
        // Communities — communities + members.
        if (/community_members/i.test(sql)) return [[{ n }], undefined];
        if (/communities/i.test(sql)) return [[{ n }], undefined];
        return [[], undefined];
    };
}

function makePool(queryFn: (sql: string, params: unknown[]) => [unknown[], unknown]): MockPool {
    return {
        query: vi.fn().mockImplementation((sql: string, params: unknown[]) =>
            Promise.resolve(queryFn(sql, params)),
        ),
    };
}

function buildApp(extra: Partial<GridServices> = {}): FastifyInstance {
    return buildServer({
        clock: warmRunningClock(),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        currentTick: () => 65,
        ...extra,
    } as GridServices);
}

/**
 * Minimal in-memory p2p-service stub matching the peerStore.countOnline() surface
 * that GET /api/v1/system/map's P2P institution actually reads (same store GET
 * /api/v1/p2p/peers/:did reads — QA fix: this used to be mocked via presenceService,
 * a different institution's data, before system-map.ts was corrected to read the
 * real p2p peer store).
 */
function p2pServiceStub(onlineCount: number): GridServices['p2pService'] {
    return {
        peerStore: { countOnline: () => onlineCount },
    } as unknown as GridServices['p2pService'];
}

describe('GET /api/v1/system/map — shape + always 200', () => {
    it('returns 200 with all 4 surfaces + 8 institutions present', async () => {
        const app = buildApp({ pool: makePool(makeQueryFn({ populated: true })) as never });
        await app.ready();
        const res = await app.inject({ method: 'GET', url: '/api/v1/system/map' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.grid_name).toBe('genesis');
        expect(typeof body.tick).toBe('number');
        for (const k of ['grid', 'portal', 'steward', 'brain']) {
            expect(body.surfaces[k]).toBeDefined();
            expect(body.surfaces[k].status).toBeTruthy();
        }
        for (const k of ['registry', 'polis', 'police', 'irs', 'marketplace', 'library', 'communities', 'p2p']) {
            expect(body.institutions[k]).toBeDefined();
            expect(body.institutions[k].status).toBeTruthy();
        }
        await app.close();
    });
});

describe('GET /api/v1/system/map — computed status (not constant)', () => {
    it('populated mock → institutions active, brain up, portal counts from GROUP BY', async () => {
        const app = buildApp({
            pool: makePool(makeQueryFn({ populated: true })) as never,
            p2pService: p2pServiceStub(1),
        });
        await app.ready();
        const body = (await app.inject({ method: 'GET', url: '/api/v1/system/map' })).json();

        expect(body.surfaces.grid.status).toBe('up');
        expect(body.surfaces.brain.status).toBe('up');
        expect(body.surfaces.brain.active).toBe(3);
        expect(body.surfaces.portal.pending).toBe(2);
        expect(body.surfaces.portal.approved).toBe(5);
        expect(body.surfaces.portal.rejected).toBe(1);
        expect(body.surfaces.portal.total).toBe(8);
        expect(body.surfaces.steward.status).toBe('up');

        expect(body.institutions.registry.status).toBe('active');
        expect(body.institutions.polis.status).toBe('active');
        expect(body.institutions.police.status).toBe('active');
        expect(body.institutions.irs.status).toBe('active');
        expect(body.institutions.marketplace.status).toBe('active');
        expect(body.institutions.library.status).toBe('active');
        expect(body.institutions.library.entries_published).toBe(3);
        expect(body.institutions.library.citations_total).toBe(9);
        expect(body.institutions.communities.status).toBe('active');
        expect(body.institutions.p2p.status).toBe('active');
        expect(body.institutions.p2p.peers_online).toBe(1); // only the 'awake' record
        await app.close();
    });

    it('zero-row mock → institutions empty, brain empty (proves status is computed)', async () => {
        const app = buildApp({
            pool: makePool(makeQueryFn({ populated: false })) as never,
            p2pService: p2pServiceStub(0),
        });
        await app.ready();
        const body = (await app.inject({ method: 'GET', url: '/api/v1/system/map' })).json();

        expect(body.surfaces.brain.status).toBe('empty');
        expect(body.institutions.registry.status).toBe('empty');
        expect(body.institutions.polis.status).toBe('empty');
        expect(body.institutions.police.status).toBe('empty');
        expect(body.institutions.irs.status).toBe('empty');
        expect(body.institutions.marketplace.status).toBe('empty');
        expect(body.institutions.library.status).toBe('empty');
        expect(body.institutions.communities.status).toBe('empty');
        expect(body.institutions.p2p.status).toBe('empty');
        await app.close();
    });

    it('p2p is unknown when p2pService is absent (guarded)', async () => {
        const app = buildApp({ pool: makePool(makeQueryFn({ populated: true })) as never });
        await app.ready();
        const body = (await app.inject({ method: 'GET', url: '/api/v1/system/map' })).json();
        expect(body.institutions.p2p.status).toBe('unknown');
        expect(body.institutions.p2p.metric).toBeNull();
        await app.close();
    });

    it('grid degraded when audit chain integrity is broken', async () => {
        const audit = new AuditChain();
        // Force verify() to report invalid.
        vi.spyOn(audit, 'verify').mockReturnValue({ valid: false, brokenAt: 0 });
        const app = buildApp({ audit, pool: makePool(makeQueryFn({ populated: true })) as never });
        await app.ready();
        const body = (await app.inject({ method: 'GET', url: '/api/v1/system/map' })).json();
        expect(body.surfaces.grid.status).toBe('degraded');
        expect(body.surfaces.grid.chain_valid).toBe(false);
        // steward derives from grid: not 'down' (grid is degraded, still reachable).
        expect(body.surfaces.steward.status).toBe('up');
        await app.close();
    });
});

describe('GET /api/v1/system/map — per-item guard isolation', () => {
    it('one throwing table → that item down, the other 11 still compute, response 200', async () => {
        const app = buildApp({
            pool: makePool(makeQueryFn({ populated: true, throwOn: /library_entries/i })) as never,
            p2pService: p2pServiceStub(1),
        });
        await app.ready();
        const res = await app.inject({ method: 'GET', url: '/api/v1/system/map' });
        expect(res.statusCode).toBe(200); // whole endpoint still 200
        const body = res.json();
        // The failing item guards to 'down'.
        expect(body.institutions.library.status).toBe('down');
        expect(body.institutions.library.metric).toBeNull();
        // Every other item is still computed normally.
        expect(body.institutions.registry.status).toBe('active');
        expect(body.institutions.polis.status).toBe('active');
        expect(body.surfaces.brain.status).toBe('up');
        expect(body.surfaces.portal.total).toBe(8);
        expect(body.institutions.p2p.status).toBe('active');
        await app.close();
    });
});

describe('GET /api/v1/system/map — db absent', () => {
    it('pool absent → DB-backed items down/db_unavailable, grid + steward still computed, 200', async () => {
        const app = buildApp(); // no pool, no presenceService
        await app.ready();
        const res = await app.inject({ method: 'GET', url: '/api/v1/system/map' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.surfaces.grid.status).toBe('up'); // non-DB signal still works
        expect(body.surfaces.steward.status).toBe('up');
        expect(body.surfaces.portal.status).toBe('down');
        expect(body.surfaces.portal.headline).toBe('db_unavailable');
        expect(body.surfaces.brain.status).toBe('down');
        expect(body.institutions.registry.status).toBe('down');
        expect(body.institutions.registry.headline).toBe('db_unavailable');
        await app.close();
    });
});

describe('GET /api/v1/system/map — SQL discipline', () => {
    it('every query is SELECT-only, binds grid_name as a param, and backticks `status`', async () => {
        const seen: { sql: string; params: unknown[] }[] = [];
        const pool: MockPool = {
            query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
                seen.push({ sql, params });
                return Promise.resolve(makeQueryFn({ populated: true })(sql, params));
            }),
        };
        const app = buildApp({ pool: pool as never, p2pService: p2pServiceStub(0) });
        await app.ready();
        await app.inject({ method: 'GET', url: '/api/v1/system/map' });

        expect(seen.length).toBeGreaterThan(0);
        for (const { sql, params } of seen) {
            // SELECT-only — zero mutations.
            expect(sql).toMatch(/^\s*SELECT/i);
            expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
            // grid_name is bound, never interpolated.
            expect(sql).toContain('grid_name = ?');
            expect(sql).not.toContain("'genesis'");
            expect(params).toContain('genesis');
            // Any query touching the `status` column backticks it.
            if (/\bstatus\b/i.test(sql)) {
                expect(sql).toContain('`status`');
            }
        }
        await app.close();
    });
});

describe('GET /api/v1/system/map — no PII / DIDs', () => {
    it('payload contains no DID, hash, or address — counts + config only', async () => {
        const app = buildApp({
            pool: makePool(makeQueryFn({ populated: true })) as never,
            p2pService: p2pServiceStub(1),
        });
        await app.ready();
        const raw = (await app.inject({ method: 'GET', url: '/api/v1/system/map' })).payload;
        expect(raw).not.toMatch(/did:[a-z]+:noesis/i);
        expect(raw).not.toMatch(/0x[0-9a-f]{6}/i);
        await app.close();
    });

    it('a 200 read appends ZERO entries to the audit chain (read-only)', async () => {
        const audit = new AuditChain();
        const before = audit.length;
        const app = buildApp({ audit, pool: makePool(makeQueryFn({ populated: true })) as never });
        await app.ready();
        await app.inject({ method: 'GET', url: '/api/v1/system/map' });
        expect(audit.length).toBe(before);
        await app.close();
    });
});
