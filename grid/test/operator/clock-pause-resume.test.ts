/**
 * Regression tests for the Phase 25b-01 header-auth migration of
 * POST /api/v1/operator/clock/pause and /resume.
 *
 * These tests pin the header-auth contract introduced by D-25b-NEW-1:
 *   - Body-only requests (no x-operator-tier header) → 401 tier_missing
 *   - Non-numeric tier header → 401 tier_missing
 *   - Tier header below 3 → 403 tier_too_low
 *   - Missing/invalid x-operator-id header → 400 invalid_operator_id
 *   - Valid headers + body claiming wrong tier → 200 (body tier ignored)
 *   - Audit payload.operator_id sourced from header, never from body
 *
 * Structure mirrors grid/test/operator/cognitive-snapshot.test.ts (the
 * 25a-07 canonical analog).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { registerClockOperatorRoutes } from '../../src/api/operator/clock-pause-resume.js';
import type { GridServices } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';

const VALID_OPERATOR_ID = 'op:12345678-1234-4abc-89ab-123456789012';
const VALID_HEADERS = {
    'x-operator-tier': '3',
    'x-operator-id': VALID_OPERATOR_ID,
};

function buildTestApp(services: Partial<GridServices> & { audit: AuditChain; clock: WorldClock }) {
    const app = Fastify({ logger: false });
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

    it('returns 401 tier_missing when no headers supplied (body-only with tier+operator_id)', async () => {
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            // No x-operator-tier or x-operator-id headers
            // Body claims H5 with a valid operator_id — must be completely ignored
            payload: { tier: 'H5', operator_id: VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(401);
        expect(JSON.parse(resp.body).error).toBe('tier_missing');
    });

    it('returns 401 tier_missing when x-operator-tier header is non-numeric (e.g. "abc")', async () => {
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            headers: { 'x-operator-tier': 'abc', 'x-operator-id': VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(401);
        expect(JSON.parse(resp.body).error).toBe('tier_missing');
    });

    it('returns 403 tier_too_low when x-operator-tier header is "2"', async () => {
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            headers: { 'x-operator-tier': '2', 'x-operator-id': VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('returns 400 invalid_operator_id when x-operator-id header is missing', async () => {
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            headers: { 'x-operator-tier': '3' },
        });
        expect(resp.statusCode).toBe(400);
        expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
    });

    it('returns 400 invalid_operator_id when x-operator-id header has invalid format', async () => {
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            headers: { 'x-operator-tier': '3', 'x-operator-id': 'op:steward:default' },
        });
        expect(resp.statusCode).toBe(400);
        expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
    });

    it('returns 200 with valid headers even when body claims wrong tier; audit sources operator_id from header', async () => {
        const headerOpId = 'op:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
        const bodyOpId = 'op:11111111-2222-4333-8444-555555555555';
        const priorLength = (services.audit as AuditChain).length;

        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            headers: { 'x-operator-tier': '3', 'x-operator-id': headerOpId },
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
        // tier is always H3 (resolved from header gate), not body's H1
        expect(entry.payload['tier']).toBe('H3');
        // operator_id in payload sourced from x-operator-id header, not body
        expect((entry.payload as { operator_id: string }).operator_id).toBe(headerOpId);
        expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
        // actorDid also uses the header operator_id
        expect(entry.actorDid).toBe(headerOpId);
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

    it('returns 401 tier_missing when no headers supplied (body-only with tier+operator_id)', async () => {
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/resume',
            payload: { tier: 'H5', operator_id: VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(401);
        expect(JSON.parse(resp.body).error).toBe('tier_missing');
    });

    it('returns 401 tier_missing when x-operator-tier header is non-numeric (e.g. "H3")', async () => {
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/resume',
            headers: { 'x-operator-tier': 'H3', 'x-operator-id': VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(401);
        expect(JSON.parse(resp.body).error).toBe('tier_missing');
    });

    it('returns 403 tier_too_low when x-operator-tier header is "2"', async () => {
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/resume',
            headers: { 'x-operator-tier': '2', 'x-operator-id': VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('returns 400 invalid_operator_id when x-operator-id header is missing', async () => {
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/resume',
            headers: { 'x-operator-tier': '3' },
        });
        expect(resp.statusCode).toBe(400);
        expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
    });

    it('returns 400 invalid_operator_id when x-operator-id header has invalid format', async () => {
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/resume',
            headers: { 'x-operator-tier': '3', 'x-operator-id': 'not-a-uuid' },
        });
        expect(resp.statusCode).toBe(400);
        expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
    });

    it('returns 200 with valid headers even when body claims wrong tier; audit sources operator_id from header', async () => {
        // Pre-seed a pause so resume emits
        services.clock.start();
        services.clock.pause();

        const headerOpId = 'op:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
        const bodyOpId = 'op:11111111-2222-4333-8444-555555555555';
        const priorLength = (services.audit as AuditChain).length;

        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/resume',
            headers: { 'x-operator-tier': '3', 'x-operator-id': headerOpId },
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
        expect((entry.payload as { operator_id: string }).operator_id).toBe(headerOpId);
        expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
        expect(entry.actorDid).toBe(headerOpId);
    });
});
