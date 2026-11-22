/**
 * D-V3-41 — the Grid's creator switches it public ⇄ private after creation.
 * H5 only; one audit event per real change; saved so it survives a restart.
 */
import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { GridRegistry, type GridRecord } from '../../src/registry/grid-registry.js';
import { registerGridVisibilityRoute, savedGridVisibility } from '../../src/api/operator/grid-visibility.js';
import { lookupPolicy } from '../../src/api/policy.js';
import { MIGRATIONS } from '../../src/db/schema.js';
import type { GridServices } from '../../src/api/server.js';

const OP = 'op:henry';

function setup(opts: { tier?: number; withPool?: boolean; visibility?: 'public' | 'private' } = {}) {
    const audit = new AuditChain();
    const registry = new GridRegistry();
    registry.register({ gridId: 'genesis', name: 'Genesis', gridDomain: 'genesis.noesis', polisName: 'Genesis Polis', description: '', status: 'active', environment: {} as GridRecord['environment'], visibility: opts.visibility ?? 'public' });
    const saved = new Map<string, string>();
    const pool = {
        async query(sql: string, params: unknown[]) {
            if (sql.includes('INSERT INTO grid_visibility')) { saved.set(String(params[0]), String(params[1])); return [{}, {}]; }
            if (sql.includes('FROM grid_visibility')) { const v = saved.get(String(params[0])); return [v ? [{ visibility: v }] : [], {}]; }
            throw new Error(`unexpected SQL: ${sql}`);
        },
    };
    const app: FastifyInstance = Fastify();
    app.addHook('preHandler', async (req) => {
        (req as unknown as { didContext: unknown }).didContext = opts.tier === 0 ? undefined : { operatorTier: opts.tier ?? 5, operatorId: OP };
    });
    registerGridVisibilityRoute(app, { audit, gridName: 'Genesis', gridRegistry: registry, currentTick: () => 42, ...(opts.withPool === false ? {} : { pool }) } as unknown as GridServices);
    const post = (visibility: unknown) => app.inject({ method: 'POST', url: '/api/v1/operator/grid/visibility', payload: { visibility } });
    return { app, audit, registry, pool, saved, post };
}

describe('POST /api/v1/operator/grid/visibility', () => {
    it('is behind the server-trusted operator gate', () => {
        expect(lookupPolicy('POST', '/api/v1/operator/grid/visibility')).toBe('operator_only');
    });

    it('makes a public Grid private: registry, saved row and one audit event', async () => {
        const { post, registry, saved, audit } = setup();
        const res = await post('private');
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ ok: true, grid_id: 'genesis', visibility: 'private', changed: true });
        expect(registry.get('genesis')?.visibility).toBe('private');
        expect(saved.get('Genesis')).toBe('private');
        const events = audit.query({ eventType: 'operator.grid_visibility_changed' });
        expect(events).toHaveLength(1);
        expect(events[0].payload).toEqual({ tier: 'H5', action: 'grid_visibility', operator_id: OP, grid_id: 'genesis', visibility: 'private' });
    });

    it('and back to public', async () => {
        const { post, registry } = setup({ visibility: 'private' });
        expect((await post('public')).json()).toMatchObject({ visibility: 'public', changed: true });
        expect(registry.get('genesis')?.visibility).toBe('public');
    });

    it('records nothing when the Grid already has that visibility', async () => {
        const { post, audit, saved } = setup();
        expect((await post('public')).json()).toMatchObject({ changed: false });
        expect(audit.length).toBe(0);
        expect(saved.size).toBe(0);
    });

    it('refuses anyone below H5, and a caller with no operator context', async () => {
        for (const tier of [4, 3, 1, 0]) {
            const { post, registry, audit } = setup({ tier });
            const res = await post('private');
            expect(res.statusCode, `tier ${tier}`).toBe(403);
            expect(registry.get('genesis')?.visibility).toBe('public');
            expect(audit.length).toBe(0);
        }
    });

    it('refuses a value that is not public or private', async () => {
        for (const v of ['hidden', '', 1, null, undefined]) {
            expect((await setup().post(v)).statusCode).toBe(400);
        }
    });

    it('still works without a database, holding until the Grid stops', async () => {
        const { post, registry } = setup({ withPool: false });
        expect((await post('private')).statusCode).toBe(200);
        expect(registry.get('genesis')?.visibility).toBe('private');
    });

    it('a saved choice is read back at boot; none saved leaves the launch default', async () => {
        const { post, pool } = setup();
        expect(await savedGridVisibility(pool, 'Genesis')).toBeUndefined();
        await post('private');
        expect(await savedGridVisibility(pool, 'Genesis')).toBe('private');
    });
});

describe('Migration v78 — grid_visibility', () => {
    const m = MIGRATIONS.find((x) => x.version === 78);
    it('creates one row per Grid, backfills nothing, and is reversible', () => {
        expect(m?.name).toBe('create_grid_visibility');
        expect(m?.up).toMatch(/CREATE TABLE IF NOT EXISTS grid_visibility/);
        expect(m?.up).toMatch(/PRIMARY KEY \(grid_name\)/);
        expect(m?.up).not.toMatch(/INSERT/i);
        expect(m?.down).toMatch(/DROP TABLE IF EXISTS grid_visibility/);
    });
    it('v78 is the latest migration and versions remain sequential', () => {
        const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version);
        expect(sorted[sorted.length - 1].version).toBe(78);
        sorted.forEach((x, i) => expect(x.version).toBe(i + 1));
    });
});
