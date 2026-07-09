/**
 * Regression tests for POST /api/v1/operator/clock/pause and /resume.
 *
 * SECURITY 2026-07-09: operator tier/identity now come from the server-trusted
 * operator_only gate (req.didContext.operatorTier/operatorId), simulated here by
 * withOperatorContext. The pure header-gate cases (tier_missing / invalid_operator_id)
 * moved to grid/test/api/operator-gate.test.ts. This file keeps the per-route min-tier
 * gate + the audit contract:
 *   - operator tier below 3 → 403 tier_too_low
 *   - operator context + body claiming wrong tier → 200 (body tier ignored)
 *   - Audit payload.operator_id sourced from operator context, never from body
 *
 * Structure mirrors grid/test/operator/cognitive-snapshot.test.ts (the
 * 25a-07 canonical analog).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { registerClockOperatorRoutes } from '../../src/api/operator/clock-pause-resume.js';
import { withOperatorContext, TEST_OPERATOR_ID } from '../helpers/operator-session.js';
import type { GridServices } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';

function buildTestApp(
    services: Partial<GridServices> & { audit: AuditChain; clock: WorldClock },
    opts?: { tier?: number },
) {
    const app = Fastify({ logger: false });
    // Simulate the operator_only gate (server-trusted identity/tier).
    withOperatorContext(app, opts?.tier !== undefined ? { tier: opts.tier } : undefined);
    registerClockOperatorRoutes(app, services as GridServices);
    return app;
}

function seedServices(): Partial<GridServices> & { audit: AuditChain; clock: WorldClock } {
    return {
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'test-grid',
    } as unknown as Partial<GridServices> & { audit: AuditChain; clock: WorldClock };
}

// ─── /clock/pause header-auth contract ───────────────────────────────────────

describe('POST /api/v1/operator/clock/pause — header-auth contract (25b-01)', () => {
    let services: Partial<GridServices> & { audit: AuditChain; clock: WorldClock };
    let app: ReturnType<typeof buildTestApp>;

    beforeEach(async () => {
        services = seedServices();
        services.clock.start(); // running clock so pause is meaningful
        app = buildTestApp(services);
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        services.clock.stop();
    });

    it('returns 403 tier_too_low when operator tier is 2 (< 3)', async () => {
        await app.close();
        app = buildTestApp(services, { tier: 2 });
        await app.ready();
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('returns 200 with valid operator context even when body claims wrong tier; audit sources operator_id from context', async () => {
        const bodyOpId = 'op:11111111-2222-4333-8444-555555555555';
        const priorLength = (services.audit as AuditChain).length;

        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            // body tries to override tier and operator_id — must be fully ignored
            payload: { tier: 'H1', operator_id: bodyOpId },
        });
        expect(resp.statusCode).toBe(200);

        const audit = services.audit as AuditChain;
        const newEntries = audit.query({ eventType: 'operator.paused' }).filter(
            (e) => e.id > priorLength,
        );
        expect(newEntries).toHaveLength(1);
        const entry = newEntries[0];
        // tier is always H3 (resolved from the min-tier gate), not body's H1
        expect(entry.payload['tier']).toBe('H3');
        // operator_id in payload sourced from operator context, not body
        expect((entry.payload as { operator_id: string }).operator_id).toBe(TEST_OPERATOR_ID);
        expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
        // actorDid also uses the context operator_id
        expect(entry.actorDid).toBe(TEST_OPERATOR_ID);
    });
});

// ─── /clock/resume header-auth contract ──────────────────────────────────────

describe('POST /api/v1/operator/clock/resume — header-auth contract (25b-01)', () => {
    let services: Partial<GridServices> & { audit: AuditChain; clock: WorldClock };
    let app: ReturnType<typeof buildTestApp>;

    beforeEach(async () => {
        services = seedServices();
        app = buildTestApp(services);
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        services.clock.stop();
    });

    it('returns 403 tier_too_low when operator tier is 2 (< 3)', async () => {
        await app.close();
        app = buildTestApp(services, { tier: 2 });
        await app.ready();
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/resume',
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('returns 200 with valid operator context even when body claims wrong tier; audit sources operator_id from context', async () => {
        // Pre-seed a pause so resume emits
        services.clock.start();
        services.clock.pause();

        const bodyOpId = 'op:11111111-2222-4333-8444-555555555555';
        const priorLength = (services.audit as AuditChain).length;

        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/resume',
            payload: { tier: 'H1', operator_id: bodyOpId },
        });
        expect(resp.statusCode).toBe(200);

        const audit = services.audit as AuditChain;
        const newEntries = audit.query({ eventType: 'operator.resumed' }).filter(
            (e) => e.id > priorLength,
        );
        expect(newEntries).toHaveLength(1);
        const entry = newEntries[0];
        expect(entry.payload['tier']).toBe('H3');
        expect((entry.payload as { operator_id: string }).operator_id).toBe(TEST_OPERATOR_ID);
        expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
        expect(entry.actorDid).toBe(TEST_OPERATOR_ID);
    });
});
