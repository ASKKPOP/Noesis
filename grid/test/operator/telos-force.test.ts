/**
 * Regression tests for registerTelosForceRoute — header-auth contract (D-25b-NEW-1).
 *
 * Tests pin the H4 header-trust auth model:
 *   - Body-supplied tier is IGNORED; only x-operator-tier header is trusted.
 *   - operator_id sourced from x-operator-id header, never from body.
 *   - Tier gate: < 4 → 403 tier_too_low.
 *   - Telos body field (new_telos) still parsed correctly.
 *   - Audit emit operator_id sources from header.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { registerTelosForceRoute } from '../../src/api/operator/telos-force.js';
import type { GridServices } from '../../src/api/server.js';
import type { NousRegistry } from '../../src/registry/registry.js';

const DID = 'did:noesis:agent001';
// Valid operator_id: must match OPERATOR_ID_REGEX = /^op:[uuid-v4]$/i
const VALID_OPERATOR_ID = 'op:12345678-1234-4abc-89ab-123456789012';
const VALID_HEADERS = {
    'x-operator-tier': '4',
    'x-operator-id': VALID_OPERATOR_ID,
};

const VALID_NEW_TELOS = {
    goals: ['Achieve understanding'],
    priorities: ['curiosity'],
};

const TELOS_HASH_BEFORE = 'a'.repeat(64);
const TELOS_HASH_AFTER = 'b'.repeat(64);

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

function makeRunner(opts: {
    connected?: boolean;
    hasForceTelos?: boolean;
    telosResult?: { telos_hash_before: string; telos_hash_after: string };
    telosError?: Error;
} = {}) {
    const {
        connected = true,
        hasForceTelos = true,
        telosResult = { telos_hash_before: TELOS_HASH_BEFORE, telos_hash_after: TELOS_HASH_AFTER },
        telosError,
    } = opts;

    const runner: Record<string, unknown> = { connected };
    if (hasForceTelos) {
        if (telosError) {
            runner.forceTelos = vi.fn().mockRejectedValue(telosError);
        } else {
            runner.forceTelos = vi.fn().mockResolvedValue(telosResult);
        }
    }
    return runner;
}

function buildTestApp(
    services: Partial<GridServices> & { audit: AuditChain },
) {
    const app = Fastify({ logger: false });
    registerTelosForceRoute(app, services as GridServices);
    return app;
}

describe('POST /api/v1/operator/nous/:did/telos/force', () => {
    let audit: AuditChain;
    let baseServices: Partial<GridServices> & { audit: AuditChain };

    beforeEach(() => {
        audit = new AuditChain();
        baseServices = {
            audit,
            registry: makeRegistry({ exists: true }),
            getRunner: vi.fn().mockReturnValue(makeRunner()),
        } as unknown as Partial<GridServices> & { audit: AuditChain };
    });

    describe('Header-auth gate (D-25b-NEW-1)', () => {
        it('rejects body-supplied tier when headers are missing (returns 401 tier_missing)', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                // No headers — body claims H5 but must be ignored
                payload: { tier: 'H5', operator_id: VALID_OPERATOR_ID, new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(401);
            expect(JSON.parse(resp.body).error).toBe('tier_missing');
        });

        it('returns 403 tier_too_low when x-operator-tier header is 3 (below H4 threshold)', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: { 'x-operator-tier': '3', 'x-operator-id': VALID_OPERATOR_ID },
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(403);
            expect(JSON.parse(resp.body).error).toBe('tier_too_low');
        });

        it('returns 403 tier_too_low for tier 1', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: { 'x-operator-tier': '1', 'x-operator-id': VALID_OPERATOR_ID },
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(403);
            expect(JSON.parse(resp.body).error).toBe('tier_too_low');
        });

        it('returns 401 tier_missing when x-operator-tier header is non-numeric', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: { 'x-operator-tier': 'H4', 'x-operator-id': VALID_OPERATOR_ID },
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(401);
            expect(JSON.parse(resp.body).error).toBe('tier_missing');
        });

        it('returns 400 invalid_operator_id when x-operator-id is the legacy "op:steward:default" form', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: { 'x-operator-tier': '4', 'x-operator-id': 'op:steward:default' },
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
        });

        it('returns 400 invalid_operator_id when x-operator-id header is missing', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: { 'x-operator-tier': '4' },
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
        });
    });

    describe('H4+ passes through to telos body validation', () => {
        it('succeeds with tier 4 header — body tier field ignored, telos body accepted', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                // body contains a body-tier claim (H1) which must be ignored; new_telos accepted
                payload: { tier: 'H1', operator_id: 'op:fake-fake-fake-fake-fake', new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(200);
            const body = JSON.parse(resp.body);
            expect(body.ok).toBe(true);
            expect(body.telos_hash_before).toBe(TELOS_HASH_BEFORE);
            expect(body.telos_hash_after).toBe(TELOS_HASH_AFTER);
        });

        it('succeeds with tier 5 header (H5 operator forcing telos)', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: { 'x-operator-tier': '5', 'x-operator-id': VALID_OPERATOR_ID },
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(200);
        });
    });

    describe('DID validation', () => {
        it('returns 400 on invalid DID', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/nous/not-a-valid-did/telos/force',
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
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
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(410);
            expect(JSON.parse(resp.body).error).toBe('gone');
        });
    });

    describe('Telos body validation', () => {
        it('returns 400 invalid_new_telos when new_telos is missing', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: {},
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_new_telos');
        });

        it('returns 400 invalid_new_telos when new_telos is a string', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: 'invalid' },
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_new_telos');
        });

        it('returns 400 invalid_new_telos when new_telos is an array', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: ['goal1', 'goal2'] },
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_new_telos');
        });
    });

    describe('Runner lookup', () => {
        it('returns 404 on unknown_nous (no runner)', async () => {
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(undefined),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(404);
            expect(JSON.parse(resp.body).error).toBe('unknown_nous');
        });

        it('returns 503 when runner.connected is false', async () => {
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(makeRunner({ connected: false })),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(503);
            expect(JSON.parse(resp.body).error).toBe('brain_unavailable');
        });

        it('returns 503 when runner has no forceTelos function', async () => {
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(makeRunner({ hasForceTelos: false })),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(503);
            expect(JSON.parse(resp.body).error).toBe('brain_unavailable');
        });

        it('returns 503 when forceTelos RPC throws', async () => {
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(makeRunner({ telosError: new Error('timeout') })),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(503);
            expect(JSON.parse(resp.body).error).toBe('brain_unavailable');
        });
    });

    describe('Hash validation', () => {
        it('returns 503 when forceTelos returns non-hex64 telos_hash_before', async () => {
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(makeRunner({
                    telosResult: { telos_hash_before: 'not-a-hash', telos_hash_after: TELOS_HASH_AFTER },
                })),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(503);
            expect(JSON.parse(resp.body).error).toBe('brain_unavailable');
        });

        it('returns 503 when forceTelos returns non-hex64 telos_hash_after', async () => {
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(makeRunner({
                    telosResult: { telos_hash_before: TELOS_HASH_BEFORE, telos_hash_after: 'short' },
                })),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(503);
            expect(JSON.parse(resp.body).error).toBe('brain_unavailable');
        });
    });

    describe('Audit emission (operator_id from header, D-25b-NEW-1)', () => {
        it('emits operator.telos_forced ONLY on success', async () => {
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(200);

            const newEntries = audit.query({ eventType: 'operator.telos_forced' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(1);
            const entry = newEntries[0];
            expect(entry.payload['tier']).toBe('H4');
            expect(entry.payload['action']).toBe('force_telos');
            expect(entry.payload['operator_id']).toBe(VALID_OPERATOR_ID);
            expect(entry.payload['target_did']).toBe(DID);
            expect(entry.payload['telos_hash_before']).toBe(TELOS_HASH_BEFORE);
            expect(entry.payload['telos_hash_after']).toBe(TELOS_HASH_AFTER);
        });

        it('audit payload.operator_id uses header value, not body value', async () => {
            const headerOpId = 'op:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
            const bodyOpId = 'op:11111111-2222-4333-8444-555555555555';
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: { 'x-operator-tier': '4', 'x-operator-id': headerOpId },
                payload: { tier: 'H4', operator_id: bodyOpId, new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(200);
            const newEntries = audit.query({ eventType: 'operator.telos_forced' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(1);
            expect((newEntries[0].payload as { operator_id: string }).operator_id).toBe(headerOpId);
            expect((newEntries[0].payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
            expect(newEntries[0].actorDid).toBe(headerOpId);
        });

        it('does NOT emit operator.telos_forced on 404 unknown_nous', async () => {
            const priorLength = audit.length;
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(undefined),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(404);
            const newEntries = audit.query({ eventType: 'operator.telos_forced' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(0);
        });

        it('does NOT emit operator.telos_forced when forceTelos throws', async () => {
            const priorLength = audit.length;
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(makeRunner({ telosError: new Error('brain down') })),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/telos/force`,
                headers: VALID_HEADERS,
                payload: { new_telos: VALID_NEW_TELOS },
            });
            expect(resp.statusCode).toBe(503);
            const newEntries = audit.query({ eventType: 'operator.telos_forced' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(0);
        });
    });
});
