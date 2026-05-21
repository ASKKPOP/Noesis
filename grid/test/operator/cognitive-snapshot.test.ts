/**
 * Integration tests for registerCognitiveSnapshotRoute.
 *
 * Tests the full H3+ proxy route: header-derived tier validation (GAP-25a-1),
 * header-derived operator_id, DID validation, tombstone check, runner lookup,
 * Brain HTTP proxy, creed_violation_count merge, and operator.inspected emission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { registerCognitiveSnapshotRoute } from '../../src/api/operator/cognitive-snapshot.js';
import type { GridServices } from '../../src/api/server.js';
import type { NousRegistry } from '../../src/registry/registry.js';
import {
    BrainUnreachableError,
} from '../../src/api/operator/brain-http-errors.js';

const DID = 'did:noesis:agent001';
// Valid operator_id: must match OPERATOR_ID_REGEX = /^op:[uuid-v4]$/i
const VALID_OPERATOR_ID = 'op:12345678-1234-4abc-89ab-123456789012';
const VALID_HEADERS = {
    'x-operator-tier': '3',
    'x-operator-id': VALID_OPERATOR_ID,
};

const VALID_BRAIN_BODY = {
    drive_levels: {
        hunger: 0.1,
        curiosity: 0.5,
        safety: 0.9,
        boredom: 0.2,
        loneliness: 0.3,
    },
    last_sleep_tick: 42,
    reflexion_count: 7,
    rule_count: 3,
    skill_titles_topk: ['planning', 'dialogue'],
};

function makeBrainFetch(status: number, body: unknown): typeof fetch {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as unknown as typeof fetch;
}

function makeThrowingBrainFetch(err: Error): typeof fetch {
    return vi.fn().mockRejectedValue(err) as unknown as typeof fetch;
}

function makeRegistry(opts: { exists?: boolean; tombstoned?: boolean } = {}): NousRegistry {
    const record = opts.exists === false
        ? undefined
        : opts.tombstoned
            ? { did: DID, status: 'deleted' as const, deletedAtTick: 5 }
            : { did: DID, status: 'active' as const };
    return {
        get: vi.fn().mockReturnValue(record),
        active: vi.fn().mockReturnValue([]),
    } as unknown as NousRegistry;
}

function buildTestApp(
    services: Partial<GridServices> & { audit: AuditChain },
) {
    const app = Fastify({ logger: false });
    registerCognitiveSnapshotRoute(app, services as GridServices);
    return app;
}

describe('POST /api/v1/operator/nous/:did/cognitive-snapshot', () => {
    let audit: AuditChain;
    let baseServices: Partial<GridServices> & { audit: AuditChain };

    beforeEach(() => {
        audit = new AuditChain();
        baseServices = {
            audit,
            registry: makeRegistry({ exists: true }),
            getRunner: vi.fn().mockReturnValue({ connected: true }),
            brainFetch: makeBrainFetch(200, VALID_BRAIN_BODY),
            brainBaseUrl: 'http://brain:8090',
        } as unknown as Partial<GridServices> & { audit: AuditChain };
    });

    it('GAP-25a-1: rejects body-supplied tier when headers are missing (returns 401 tier_missing)', async () => {
        const app = buildTestApp(baseServices);
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
            // No headers — body claims H3 but must be ignored
            payload: { tier: 'H3', operator_id: VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(401);
        expect(JSON.parse(resp.body).error).toBe('tier_missing');
    });

    it('returns 403 tier_too_low when x-operator-tier header is below 3', async () => {
        const app = buildTestApp(baseServices);
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
            headers: { 'x-operator-tier': '2', 'x-operator-id': VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('returns 401 tier_missing when x-operator-tier header is non-numeric', async () => {
        const app = buildTestApp(baseServices);
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
            headers: { 'x-operator-tier': 'H3', 'x-operator-id': VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(401);
        expect(JSON.parse(resp.body).error).toBe('tier_missing');
    });

    it('returns 400 invalid_operator_id when x-operator-id is the legacy "op:steward:default" form', async () => {
        const app = buildTestApp(baseServices);
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': 'op:steward:default' },
        });
        expect(resp.statusCode).toBe(400);
        expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
    });

    it('returns 400 invalid_operator_id when x-operator-id header is missing', async () => {
        const app = buildTestApp(baseServices);
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
            headers: { 'x-operator-tier': '3' },
        });
        expect(resp.statusCode).toBe(400);
        expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
    });

    it('returns 400 on invalid DID', async () => {
        const app = buildTestApp(baseServices);
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/not-a-valid-did/cognitive-snapshot',
            headers: VALID_HEADERS,
        });
        expect(resp.statusCode).toBe(400);
        expect(JSON.parse(resp.body).error).toBe('invalid_did');
    });

    it('returns 410 on tombstoned DID', async () => {
        const services = {
            ...baseServices,
            registry: makeRegistry({ exists: true, tombstoned: true }),
        };
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
            headers: VALID_HEADERS,
        });
        expect(resp.statusCode).toBe(410);
        expect(JSON.parse(resp.body).error).toBe('tombstoned');
    });

    it('returns 404 on unknown_nous (no runner)', async () => {
        const services = {
            ...baseServices,
            getRunner: vi.fn().mockReturnValue(undefined),
        };
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
            headers: VALID_HEADERS,
        });
        expect(resp.statusCode).toBe(404);
        expect(JSON.parse(resp.body).error).toBe('unknown_nous');
    });

    it('returns 503 when brainFetch throws BrainUnreachableError', async () => {
        const services = {
            ...baseServices,
            brainFetch: makeThrowingBrainFetch(new BrainUnreachableError(new Error('timeout'))),
        };
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
            headers: VALID_HEADERS,
        });
        expect(resp.statusCode).toBe(503);
        expect(JSON.parse(resp.body).error).toBe('brain_unavailable');
    });

    it('returns 503 when brainFetch returns malformed response (BrainMalformedResponseError)', async () => {
        const malformedBody = { ...VALID_BRAIN_BODY, extra_key: 'unexpected' };
        const services = {
            ...baseServices,
            brainFetch: makeBrainFetch(200, malformedBody),
        };
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
            headers: VALID_HEADERS,
        });
        expect(resp.statusCode).toBe(503);
        expect(JSON.parse(resp.body).error).toBe('brain_unavailable');
    });

    it('returns 200 with merged 6-key response on success', async () => {
        const app = buildTestApp(baseServices);
        const resp = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
            headers: VALID_HEADERS,
        });
        expect(resp.statusCode).toBe(200);
        const body = JSON.parse(resp.body);
        // 5 Brain keys
        expect(body.drive_levels).toBeDefined();
        expect(body.last_sleep_tick).toBe(42);
        expect(body.reflexion_count).toBe(7);
        expect(body.rule_count).toBe(3);
        expect(body.skill_titles_topk).toEqual(['planning', 'dialogue']);
        // 6th Grid-computed key
        expect(typeof body.creed_violation_count).toBe('number');
    });

    describe('operator.inspected emission', () => {
        it('emits operator.inspected ONLY on success', async () => {
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
                headers: VALID_HEADERS,
            });
            expect(resp.statusCode).toBe(200);

            const newEntries = audit.query({ eventType: 'operator.inspected' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(1);
            const entry = newEntries[0];
            expect(entry.payload['tier']).toBe('H3');
            expect(entry.payload['action']).toBe('cognitive_snapshot');
            expect(entry.payload['operator_id']).toBe(VALID_OPERATOR_ID);
            expect(entry.payload['target_did']).toBe(DID);
        });

        it('GAP-25a-1: audit payload.operator_id uses header value, not body value', async () => {
            const headerOpId = 'op:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
            const bodyOpId = 'op:11111111-2222-4333-8444-555555555555';
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
                headers: { 'x-operator-tier': '3', 'x-operator-id': headerOpId },
                payload: { tier: 'H3', operator_id: bodyOpId }, // attacker body — must be ignored
            });
            expect(resp.statusCode).toBe(200);
            const newEntries = audit.query({ eventType: 'operator.inspected' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(1);
            expect((newEntries[0].payload as { operator_id: string }).operator_id).toBe(headerOpId);
            expect((newEntries[0].payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
            expect(newEntries[0].actorDid).toBe(headerOpId);
        });

        it('does NOT emit operator.inspected when brainFetch throws', async () => {
            const priorLength = audit.length;
            const services = {
                ...baseServices,
                brainFetch: makeThrowingBrainFetch(new BrainUnreachableError(new Error('net'))),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
                headers: VALID_HEADERS,
            });
            expect(resp.statusCode).toBe(503);

            const newInspectedEntries = audit.query({ eventType: 'operator.inspected' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newInspectedEntries).toHaveLength(0);
        });

        it('does NOT emit operator.inspected on 404 unknown_nous', async () => {
            const priorLength = audit.length;
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(undefined),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
                headers: VALID_HEADERS,
            });
            expect(resp.statusCode).toBe(404);
            const newEntries = audit.query({ eventType: 'operator.inspected' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(0);
        });
    });

    describe('creed_violation_count merge', () => {
        it('returns creed_violation_count=3 when audit has 3 nous.creed_violation entries for DID', async () => {
            // Seed 3 creed violations for this DID
            audit.append('nous.creed_violation', DID, { rule_id: 'r1' });
            audit.append('nous.creed_violation', DID, { rule_id: 'r2' });
            audit.append('nous.creed_violation', DID, { rule_id: 'r3' });
            // Add a violation for a different DID (should not count)
            audit.append('nous.creed_violation', 'did:noesis:other', { rule_id: 'r4' });

            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
                headers: VALID_HEADERS,
            });
            expect(resp.statusCode).toBe(200);
            expect(JSON.parse(resp.body).creed_violation_count).toBe(3);
        });

        it('returns creed_violation_count=0 when no violations exist', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/cognitive-snapshot`,
                headers: VALID_HEADERS,
            });
            expect(resp.statusCode).toBe(200);
            expect(JSON.parse(resp.body).creed_violation_count).toBe(0);
        });
    });
});
