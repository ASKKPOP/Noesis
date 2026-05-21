/**
 * Integration tests for GET /api/v1/audit/drift-alerts REST endpoint.
 *
 * Verified invariants:
 *  1. Non-allowlisted entry → response includes DriftAlert with correct fields
 *  2. Repeat call → same response (non-destructive peek)
 *  3. No drift entries → {alerts: []}
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServerWithHub } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

describe('GET /api/v1/audit/drift-alerts', () => {
    let app: FastifyInstance;
    let audit: AuditChain;
    let clock: WorldClock;

    beforeEach(async () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        audit = new AuditChain();
        const built = buildServerWithHub({ clock, space, logos, audit, gridName: 'drift-test' });
        app = built.app;
        await app.ready();
    });

    afterEach(async () => {
        try { await app.close(); } catch { /* swallow */ }
        try { clock.stop(); } catch { /* swallow */ }
    });

    it('returns {alerts: []} when no drift has occurred', async () => {
        // Only append allowlisted events
        audit.append('nous.moved', 'did:noesis:actor', { to: 'r1' });
        const res = await app.inject({ method: 'GET', url: '/api/v1/audit/drift-alerts' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toMatchObject({ alerts: [] });
    });

    it('non-allowlisted entry → response includes DriftAlert with correct fields', async () => {
        const entry = audit.append('invented.bad.event', 'did:noesis:actor', { tick: 99 });
        const res = await app.inject({ method: 'GET', url: '/api/v1/audit/drift-alerts' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.alerts.length).toBe(1);
        const alert = body.alerts[0];
        expect(alert.event_type).toBe('invented.bad.event');
        expect(alert.actor_did).toBe('did:noesis:actor');
        expect(alert.tick).toBe(99);
        expect(alert.detected_at).toBe(entry.createdAt);
    });

    it('repeat call returns same response (non-destructive peek)', async () => {
        audit.append('invented.bad.event', 'did:noesis:actor', { tick: 5 });
        const res1 = await app.inject({ method: 'GET', url: '/api/v1/audit/drift-alerts' });
        const res2 = await app.inject({ method: 'GET', url: '/api/v1/audit/drift-alerts' });
        const body1 = JSON.parse(res1.body);
        const body2 = JSON.parse(res2.body);
        expect(body1.alerts.length).toBe(1);
        expect(body2.alerts.length).toBe(1);
        expect(body1.alerts[0].tick).toBe(body2.alerts[0].tick);
    });
});
