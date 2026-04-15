import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/api/server.js';
import { WorldClock } from '../src/clock/ticker.js';
import { SpatialMap } from '../src/space/map.js';
import { LogosEngine } from '../src/logos/engine.js';
import { AuditChain } from '../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

describe('Grid API', () => {
    let app: FastifyInstance;
    let clock: WorldClock;
    let space: SpatialMap;
    let logos: LogosEngine;
    let audit: AuditChain;

    beforeAll(async () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        space = new SpatialMap();
        logos = new LogosEngine();
        audit = new AuditChain();

        // Seed data
        space.addRegion({ id: 'agora', name: 'Agora Central', description: 'Main plaza', regionType: 'public', capacity: 100, properties: {} });
        space.addRegion({ id: 'market', name: 'Market District', description: 'Trading hub', regionType: 'public', capacity: 50, properties: {} });
        space.addConnection({ fromRegion: 'agora', toRegion: 'market', travelCost: 2, bidirectional: true });
        space.placeNous('did:key:sophia', 'agora');

        logos.addLaw({
            id: 'l1',
            title: 'No spam',
            description: 'Limit message frequency',
            ruleLogic: { condition: { type: 'true' }, action: 'warn', sanction_on_violation: 'none' },
            severity: 'info',
            status: 'active',
        });

        audit.append('domain.register', 'did:key:sophia', { name: 'sophia' });
        audit.append('grid.started', 'did:key:admin', { gridName: 'genesis' });

        clock.advance(); // tick 1

        app = buildServer({ clock, space, logos, audit, gridName: 'genesis' });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('GET /health returns ok', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.status).toBe('ok');
        expect(body.timestamp).toBeGreaterThan(0);
    });

    it('GET /api/v1/grid/status returns grid overview', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/status' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.name).toBe('genesis');
        expect(body.tick).toBe(1);
        expect(body.nousCount).toBe(1);
        expect(body.regionCount).toBe(2);
        expect(body.activeLaws).toBe(1);
        expect(body.auditEntries).toBe(2);
    });

    it('GET /api/v1/grid/clock returns clock state', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/clock' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.tick).toBe(1);
        expect(body.tickRateMs).toBeGreaterThan(0);
    });

    it('GET /api/v1/grid/regions lists all regions', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/regions' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.regions).toHaveLength(2);
    });

    it('GET /api/v1/grid/regions/:id returns specific region', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/regions/agora' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.name).toBe('Agora Central');
    });

    it('GET /api/v1/grid/regions/:id returns 404 for unknown', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/regions/nowhere' });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('Region not found');
    });

    it('GET /api/v1/governance/laws lists active laws', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/governance/laws' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.laws).toHaveLength(1);
        expect(body.laws[0].title).toBe('No spam');
    });

    it('GET /api/v1/governance/laws/:id returns specific law', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/governance/laws/l1' });
        expect(res.statusCode).toBe(200);
        expect(res.json().title).toBe('No spam');
    });

    it('GET /api/v1/governance/laws/:id returns 404 for unknown', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/governance/laws/nope' });
        expect(res.statusCode).toBe(404);
    });

    it('GET /api/v1/audit/trail returns entries', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/audit/trail' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.entries).toHaveLength(2);
        expect(body.total).toBe(2);
    });

    it('GET /api/v1/audit/trail filters by type', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/audit/trail?type=domain.register',
        });
        const body = res.json();
        expect(body.entries).toHaveLength(1);
        expect(body.entries[0].eventType).toBe('domain.register');
    });

    it('GET /api/v1/audit/trail paginates', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/audit/trail?limit=1&offset=1',
        });
        const body = res.json();
        expect(body.entries).toHaveLength(1);
        expect(body.entries[0].eventType).toBe('grid.started');
    });

    it('GET /api/v1/audit/verify returns chain integrity', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/audit/verify' });
        expect(res.statusCode).toBe(200);
        expect(res.json().valid).toBe(true);
    });
});
