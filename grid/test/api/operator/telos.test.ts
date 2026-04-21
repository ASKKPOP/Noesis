/**
 * Phase 6 Plan 05 Task 2 — POST /api/v1/operator/nous/:did/telos/force.
 *
 * AGENCY-02 H4 Driver + AGENCY-03. D-19 HASH-ONLY INVARIANT:
 * operator.telos_forced payload is the closed tuple
 *   {tier: 'H4', action: 'force_telos', operator_id, target_did,
 *    telos_hash_before, telos_hash_after}
 * — plaintext Telos (goal descriptions, priorities, progress) NEVER appears
 * in the audit payload.
 *
 * Error ladder: 400 (malformed) → 404 (unknown Nous) → 503 (Brain down),
 * no 500s. 503 and 400/404 do NOT emit audit events.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer, type InspectorRunner } from '../../../src/api/server.js';
import { WorldClock } from '../../../src/clock/ticker.js';
import { SpatialMap } from '../../../src/space/map.js';
import { LogosEngine } from '../../../src/logos/engine.js';
import { AuditChain } from '../../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

const VALID_OP_ID = 'op:11111111-1111-4111-8111-111111111111';
const VALID_DID = 'did:noesis:sophia';

const HASH_BEFORE = 'a'.repeat(64); // 64-hex SHA-256 shape
const HASH_AFTER = 'b'.repeat(64);

interface MockRunner extends InspectorRunner {
    lastCall?: Record<string, unknown>;
    forceError?: Error;
    overrideResult?: { telos_hash_before: string; telos_hash_after: string };
}

function makeRunner(
    opts: {
        connected?: boolean;
        forceError?: Error;
        overrideResult?: { telos_hash_before: string; telos_hash_after: string };
    } = {},
): MockRunner {
    const runner: MockRunner = {
        connected: opts.connected ?? true,
        async getState() {
            return {};
        },
        async forceTelos(newTelos: Record<string, unknown>) {
            if (opts.forceError) throw opts.forceError;
            runner.lastCall = newTelos;
            return opts.overrideResult ?? {
                telos_hash_before: HASH_BEFORE,
                telos_hash_after: HASH_AFTER,
            };
        },
    };
    return runner;
}

interface SeededServices {
    clock: WorldClock;
    space: SpatialMap;
    logos: LogosEngine;
    audit: AuditChain;
    gridName: string;
    getRunner: (did: string) => InspectorRunner | undefined;
    runners: Map<string, MockRunner>;
}

function seedServices(runners: Map<string, MockRunner>): SeededServices {
    return {
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'test-grid',
        runners,
        getRunner: (did) => runners.get(did),
    };
}

describe('Operator telos force — AGENCY-02 H4 + D-19 hash-only', () => {
    let services: SeededServices;
    let app: FastifyInstance;

    beforeEach(async () => {
        const runners = new Map<string, MockRunner>();
        runners.set(VALID_DID, makeRunner());
        services = seedServices(runners);
        app = buildServer(services);
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        services.clock.stop();
    });

    it('Test 1: happy path — returns hashes, emits one operator.telos_forced with hash-only payload', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/telos/force`,
            payload: {
                tier: 'H4',
                operator_id: VALID_OP_ID,
                new_telos: { short_term: ['find balance'] },
            },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({
            ok: true,
            telos_hash_before: HASH_BEFORE,
            telos_hash_after: HASH_AFTER,
        });

        const entries = services.audit.query({ eventType: 'operator.telos_forced' });
        expect(entries.length).toBe(1);
        expect(entries[0].payload).toEqual({
            tier: 'H4',
            action: 'force_telos',
            operator_id: VALID_OP_ID,
            target_did: VALID_DID,
            telos_hash_before: HASH_BEFORE,
            telos_hash_after: HASH_AFTER,
        });
    });

    it('Test 2: payload is a closed tuple — structural assertion on key set', async () => {
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/telos/force`,
            payload: {
                tier: 'H4',
                operator_id: VALID_OP_ID,
                new_telos: { short_term: ['find balance'] },
            },
        });
        const entries = services.audit.query({ eventType: 'operator.telos_forced' });
        // D-19 enforcement: ANY extra key here is a regression. Goal contents
        // MUST NOT leak into the audit chain.
        expect(Object.keys(entries[0].payload).sort()).toEqual([
            'action',
            'operator_id',
            'target_did',
            'telos_hash_after',
            'telos_hash_before',
            'tier',
        ]);
    });

    it('Test 3: payload contains NO goal descriptions — plaintext Telos leak guard', async () => {
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/telos/force`,
            payload: {
                tier: 'H4',
                operator_id: VALID_OP_ID,
                new_telos: {
                    short_term: ['secret goal should never appear in audit'],
                    long_term: ['another secret'],
                },
            },
        });
        const entries = services.audit.query({ eventType: 'operator.telos_forced' });
        const serialised = JSON.stringify(entries[0].payload);
        expect(serialised).not.toContain('secret goal should never appear in audit');
        expect(serialised).not.toContain('another secret');
        expect(serialised).not.toContain('short_term');
        expect(serialised).not.toContain('long_term');
    });

    it('Test 4: invalid tier → 400 invalid_tier, no audit event', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/telos/force`,
            payload: {
                tier: 'H2',
                operator_id: VALID_OP_ID,
                new_telos: {},
            },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_tier' });
        expect(services.audit.query({ eventType: 'operator.telos_forced' }).length).toBe(0);
    });

    it('Test 5: invalid operator_id → 400 invalid_operator_id, no audit event', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/telos/force`,
            payload: {
                tier: 'H4',
                operator_id: 'not-a-uuid',
                new_telos: {},
            },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_operator_id' });
        expect(services.audit.query({ eventType: 'operator.telos_forced' }).length).toBe(0);
    });

    it('Test 6: invalid DID → 400 invalid_did, no audit event', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/garbage-did/telos/force',
            payload: { tier: 'H4', operator_id: VALID_OP_ID, new_telos: {} },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_did' });
        expect(services.audit.query({ eventType: 'operator.telos_forced' }).length).toBe(0);
    });

    it('Test 7: missing new_telos → 400 invalid_new_telos', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/telos/force`,
            payload: { tier: 'H4', operator_id: VALID_OP_ID },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_new_telos' });
        expect(services.audit.query({ eventType: 'operator.telos_forced' }).length).toBe(0);
    });

    it('Test 8: array-shaped new_telos → 400 invalid_new_telos', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/telos/force`,
            payload: {
                tier: 'H4',
                operator_id: VALID_OP_ID,
                new_telos: ['not-an-object'],
            },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_new_telos' });
    });

    it('Test 9: unknown Nous → 404 unknown_nous, no audit event', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/did:noesis:nobody/telos/force',
            payload: { tier: 'H4', operator_id: VALID_OP_ID, new_telos: {} },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: 'unknown_nous' });
        expect(services.audit.query({ eventType: 'operator.telos_forced' }).length).toBe(0);
    });

    it('Test 10: brain disconnected → 503 brain_unavailable, NO audit event', async () => {
        const runners = new Map<string, MockRunner>();
        runners.set(VALID_DID, makeRunner({ connected: false }));
        await app.close();
        services.clock.stop();
        services = seedServices(runners);
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/telos/force`,
            payload: { tier: 'H4', operator_id: VALID_OP_ID, new_telos: {} },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ error: 'brain_unavailable' });
        expect(services.audit.query({ eventType: 'operator.telos_forced' }).length).toBe(0);
    });

    it('Test 11: brain RPC throws → 503 brain_unavailable, NO audit event', async () => {
        const runners = new Map<string, MockRunner>();
        runners.set(
            VALID_DID,
            makeRunner({ forceError: new Error('socket timeout') }),
        );
        await app.close();
        services.clock.stop();
        services = seedServices(runners);
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/telos/force`,
            payload: { tier: 'H4', operator_id: VALID_OP_ID, new_telos: {} },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ error: 'brain_unavailable' });
        expect(services.audit.query({ eventType: 'operator.telos_forced' }).length).toBe(0);
    });

    it('Test 12: brain returns non-hex64 hash → 503 brain_unavailable (contract drift guard)', async () => {
        const runners = new Map<string, MockRunner>();
        runners.set(
            VALID_DID,
            makeRunner({
                overrideResult: {
                    telos_hash_before: 'not-a-hash',
                    telos_hash_after: 'also-bogus',
                },
            }),
        );
        await app.close();
        services.clock.stop();
        services = seedServices(runners);
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/telos/force`,
            payload: { tier: 'H4', operator_id: VALID_OP_ID, new_telos: {} },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ error: 'brain_unavailable' });
        // Malformed hash MUST NOT enter the audit chain — this is the
        // runtime backstop for the D-19 hash-format contract.
        expect(services.audit.query({ eventType: 'operator.telos_forced' }).length).toBe(0);
    });
});
