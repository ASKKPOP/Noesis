/**
 * Regression tests for registerMemoryQueryRoute — operator-context auth (Phase 25b Wave 0).
 *
 * SECURITY 2026-07-09: operator identity/tier now come from the server-trusted
 * operator_only gate (req.didContext.operatorTier/operatorId), simulated here by
 * withOperatorContext. Header-gate cases (tier_missing / invalid_operator_id) moved
 * to grid/test/api/operator-gate.test.ts. This file keeps the per-route min-tier gate
 * (H2), body-field validation, and the operator.inspected business logic.
 *
 * Route: POST /api/v1/operator/nous/:did/memory/query
 * Tier gate: H2 (tierNum < 2 → 403 tier_too_low)
 *
 * Analog: grid/test/operator/cognitive-snapshot.test.ts (same pattern)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { registerMemoryQueryRoute } from '../../src/api/operator/memory-query.js';
import { withOperatorContext, TEST_OPERATOR_ID } from '../helpers/operator-session.js';
import type { GridServices } from '../../src/api/server.js';
import type { NousRegistry } from '../../src/registry/registry.js';

const DID = 'did:noesis:agent001';
// Server-trusted operator_id (matches withOperatorContext default TEST_OPERATOR_ID).
const VALID_OPERATOR_ID = TEST_OPERATOR_ID;

const SAMPLE_ENTRIES = [
    { timestamp: '2026-04-20T00:00:00Z', kind: 'observation', summary: 'saw a merchant' },
    { timestamp: '2026-04-20T00:01:00Z', kind: 'conversation', summary: 'talked with Hermes' },
];

function makeQueryMemoryRunner(
    opts: { connected?: boolean; forceError?: Error } = {},
) {
    return {
        connected: opts.connected ?? true,
        getState: vi.fn().mockResolvedValue({}),
        queryMemory: vi.fn().mockImplementation(async () => {
            if (opts.forceError) throw opts.forceError;
            return { entries: SAMPLE_ENTRIES };
        }),
    };
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
    operatorTier?: number,
) {
    const app = Fastify({ logger: false });
    withOperatorContext(app, operatorTier !== undefined ? { tier: operatorTier } : undefined);
    registerMemoryQueryRoute(app, services as GridServices);
    return app;
}

describe('POST /api/v1/operator/nous/:did/memory/query — operator-context auth (25b Wave 0)', () => {
    let audit: AuditChain;
    let baseServices: Partial<GridServices> & { audit: AuditChain };

    beforeEach(() => {
        audit = new AuditChain();
        baseServices = {
            audit,
            registry: makeRegistry({ exists: true }),
            getRunner: vi.fn().mockReturnValue(makeQueryMemoryRunner()),
        } as unknown as Partial<GridServices> & { audit: AuditChain };
    });

    describe('Tier gate', () => {
        it('returns 403 tier_too_low when operator context tier is 1 (below H2 threshold)', async () => {
            const app = buildTestApp(baseServices, 1);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'merchant' },
            });
            expect(resp.statusCode).toBe(403);
            expect(JSON.parse(resp.body).error).toBe('tier_too_low');
        });

        it('accepts operator context tier 2 (H2 threshold)', async () => {
            const app = buildTestApp(baseServices, 2);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'merchant' },
            });
            expect(resp.statusCode).toBe(200);
        });

        it('accepts operator context tier 5 (H5 — higher than minimum)', async () => {
            const app = buildTestApp(baseServices, 5);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'merchant' },
            });
            expect(resp.statusCode).toBe(200);
        });
    });

    describe('Body auth fields ignored — T-25b-05-01', () => {
        it('body tier: H5 with context tier 2 → 200 (body tier IGNORED; no H5 elevation)', async () => {
            const app = buildTestApp(baseServices, 2);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                // Attacker body claims H5 — must be silently ignored
                payload: { tier: 'H5', operator_id: 'op:99999999-9999-4999-8999-999999999999', query: 'merchant' },
            });
            expect(resp.statusCode).toBe(200);
            // Audit payload must use server context tier (H2), not body tier (H5)
            const entries = audit.query({ eventType: 'operator.inspected' });
            expect(entries.length).toBe(1);
            expect(entries[0].payload['tier']).toBe('H2');
            expect(entries[0].payload['operator_id']).toBe(VALID_OPERATOR_ID);
            // Ensure body operator_id is NOT used
            expect(entries[0].payload['operator_id']).not.toBe('op:99999999-9999-4999-8999-999999999999');
        });

        it('GAP-25a-1: audit payload.operator_id uses server context value, not body value', async () => {
            const bodyOpId = 'op:11111111-2222-4333-8444-555555555555';
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { tier: 'H2', operator_id: bodyOpId, query: 'merchant' },
            });
            expect(resp.statusCode).toBe(200);
            const newEntries = audit.query({ eventType: 'operator.inspected' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(1);
            expect((newEntries[0].payload as { operator_id: string }).operator_id).toBe(TEST_OPERATOR_ID);
            expect((newEntries[0].payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
            expect(newEntries[0].actorDid).toBe(TEST_OPERATOR_ID);
        });
    });

    describe('Query body fields', () => {
        it('returns 400 invalid_query when query body field is missing', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: {},
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_query');
        });

        it('returns 400 invalid_limit when limit is non-numeric', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'merchant', limit: 'ten' },
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_limit');
        });

        it('returns 200 with entries on valid query + limit', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'merchant', limit: 10 },
            });
            expect(resp.statusCode).toBe(200);
            const body = JSON.parse(resp.body);
            expect(body.entries).toHaveLength(2);
            expect(body.entries[0].summary).toBe('saw a merchant');
        });
    });

    describe('DID validation', () => {
        it('returns 400 invalid_did on malformed DID in URL param', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/nous/garbage-did/memory/query',
                payload: { query: 'x' },
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_did');
        });

        it('returns 410 gone on tombstoned DID', async () => {
            const services = {
                ...baseServices,
                registry: makeRegistry({ exists: true, tombstoned: true }),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'x' },
            });
            expect(resp.statusCode).toBe(410);
            expect(JSON.parse(resp.body).error).toBe('gone');
        });
    });

    describe('Runner and Brain availability', () => {
        it('returns 404 unknown_nous when no runner registered for DID', async () => {
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(undefined),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'x' },
            });
            expect(resp.statusCode).toBe(404);
            expect(JSON.parse(resp.body).error).toBe('unknown_nous');
        });

        it('returns 503 brain_unavailable when runner.connected is false', async () => {
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(makeQueryMemoryRunner({ connected: false })),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'x' },
            });
            expect(resp.statusCode).toBe(503);
            expect(JSON.parse(resp.body).error).toBe('brain_unavailable');
        });

        it('returns 503 brain_unavailable when queryMemory throws', async () => {
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(
                    makeQueryMemoryRunner({ forceError: new Error('socket timeout') }),
                ),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'x' },
            });
            expect(resp.statusCode).toBe(503);
            expect(JSON.parse(resp.body).error).toBe('brain_unavailable');
        });
    });

    describe('operator.inspected audit emission', () => {
        it('emits operator.inspected ONLY on success path', async () => {
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'merchant' },
            });
            expect(resp.statusCode).toBe(200);
            const newEntries = audit.query({ eventType: 'operator.inspected' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(1);
            const entry = newEntries[0];
            expect(entry.payload['tier']).toBe('H2');
            expect(entry.payload['action']).toBe('inspect');
            expect(entry.payload['operator_id']).toBe(VALID_OPERATOR_ID);
            expect(entry.payload['target_did']).toBe(DID);
            // Structural assertion — closed tuple, exactly 4 keys (T-6-06 / D-25b-05-01)
            expect(Object.keys(entry.payload).sort()).toEqual(
                ['action', 'operator_id', 'target_did', 'tier'],
            );
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
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'x' },
            });
            expect(resp.statusCode).toBe(404);
            const newEntries = audit.query({ eventType: 'operator.inspected' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(0);
        });

        it('does NOT emit operator.inspected on 503 brain_unavailable', async () => {
            const priorLength = audit.length;
            const services = {
                ...baseServices,
                getRunner: vi.fn().mockReturnValue(
                    makeQueryMemoryRunner({ forceError: new Error('net') }),
                ),
            };
            const app = buildTestApp(services);
            const resp = await app.inject({
                method: 'POST',
                url: `/api/v1/operator/nous/${DID}/memory/query`,
                payload: { query: 'x' },
            });
            expect(resp.statusCode).toBe(503);
            const newEntries = audit.query({ eventType: 'operator.inspected' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(0);
        });

        it('does NOT emit operator.inspected on 400 invalid_did', async () => {
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/nous/garbage-did/memory/query',
                payload: { query: 'x' },
            });
            expect(resp.statusCode).toBe(400);
            const newEntries = audit.query({ eventType: 'operator.inspected' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(0);
        });
    });
});
