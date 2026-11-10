import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { GRID_ENVIRONMENTS } from '../../src/registry/grid-environments.js';
import type { FastifyInstance } from 'fastify';

const GOOD = {
    mass_kg: 1000, massIn_kg: 1000, massOut_kg: 900, energyIn_J: 5000, energyOut_J: 4000,
    load_N: 100, yield_N: 300, dissipated_W: 50, radiated_W: 80,
    generation_W: 200, consumption_W: 150, altitude_km: 420,
};

describe('physics rehearsal routes (read-only, no audit)', () => {
    let app: FastifyInstance;
    let audit: AuditChain;
    beforeAll(() => {
        audit = new AuditChain();
        app = buildServer({
            clock: new WorldClock({ tickRateMs: 100_000 }),
            space: new SpatialMap(), logos: new LogosEngine(), audit, gridName: 'genesis',
        });
    });
    afterAll(async () => { await app.close(); });

    it('lists the real Grid environments', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/physics/environments' });
        expect(res.statusCode).toBe(200);
        const names = res.json().environments.map((e: { name: string }) => e.name);
        expect(names.sort()).toEqual(Object.keys(GRID_ENVIRONMENTS).sort());
        const moon = res.json().environments.find((e: { name: string }) => e.name === 'Moon');
        expect(moon.min_stable_altitude_km).toBe(GRID_ENVIRONMENTS['Moon'].min_stable_altitude_km);
    });

    it('passes a lawful spec', async () => {
        const res = await app.inject({ method: 'POST', url: '/api/v1/physics/check', payload: { spec: GOOD, env: 'Earth-orbit' } });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ ok: true, violations: [], env: 'Earth-orbit' });
    });

    it('rejects a spec that breaks structural law, using the requested body', async () => {
        const res = await app.inject({ method: 'POST', url: '/api/v1/physics/check',
            payload: { spec: { ...GOOD, load_N: 500, altitude_km: 50 }, env: 'Moon' } });
        const body = res.json();
        expect(body.ok).toBe(false);
        expect(body.violations).toContain('structural');
        expect(body.violations).not.toContain('orbital'); // 50 km is above the Moon floor (15 km)
        expect(body.env).toBe('Moon');
    });

    it('400s on a missing spec and writes nothing to the audit chain', async () => {
        const before = audit.length;
        const res = await app.inject({ method: 'POST', url: '/api/v1/physics/check', payload: { env: 'Mars' } });
        expect(res.statusCode).toBe(400);
        expect(audit.length).toBe(before);
        const bad = await app.inject({ method: 'POST', url: '/api/v1/physics/check', payload: { spec: GOOD, env: 'Pluto' } });
        expect(bad.statusCode).toBe(400);
    });
});
