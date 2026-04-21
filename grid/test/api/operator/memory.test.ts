/**
 * Phase 6 Plan 05 Task 2 — POST /api/v1/operator/nous/:did/memory/query.
 *
 * AGENCY-02 H2 Reviewer + AGENCY-03. D-11 payload privacy:
 * operator.inspected payload keys are a closed tuple
 * {tier: 'H2', action: 'inspect', operator_id, target_did} — memory
 * content NEVER appears in the audit payload; it rides back in the HTTP
 * response body only. The Brain side (handler.query_memory) normalises to
 * {timestamp, kind, summary} before it ever crosses the RPC boundary.
 *
 * Error ladder: 400 (malformed) → 404 (unknown Nous) → 503 (Brain down),
 * with no 500s. 503 and 400/404 do NOT emit audit events.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer, type InspectorRunner, type InspectorMemoryEntry } from '../../../src/api/server.js';
import { WorldClock } from '../../../src/clock/ticker.js';
import { SpatialMap } from '../../../src/space/map.js';
import { LogosEngine } from '../../../src/logos/engine.js';
import { AuditChain } from '../../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

const VALID_OP_ID = 'op:11111111-1111-4111-8111-111111111111';
const VALID_DID = 'did:noesis:sophia';

interface MockRunner extends InspectorRunner {
    lastCall?: { query: string; limit?: number };
    forceError?: Error;
}

function makeRunner(
    entries: InspectorMemoryEntry[],
    opts: { connected?: boolean; forceError?: Error } = {},
): MockRunner {
    const runner: MockRunner = {
        connected: opts.connected ?? true,
        async getState() {
            return {};
        },
        async queryMemory(params: { query: string; limit?: number }) {
            if (opts.forceError) throw opts.forceError;
            runner.lastCall = params;
            return { entries };
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

describe('Operator memory query — AGENCY-02 H2 + D-11 privacy', () => {
    let services: SeededServices;
    let app: FastifyInstance;

    beforeEach(async () => {
        const runners = new Map<string, MockRunner>();
        runners.set(
            VALID_DID,
            makeRunner([
                { timestamp: '2026-04-20T00:00:00Z', kind: 'observation', summary: 'saw a merchant' },
                { timestamp: '2026-04-20T00:01:00Z', kind: 'conversation', summary: 'talked with Hermes' },
            ]),
        );
        services = seedServices(runners);
        app = buildServer(services);
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        services.clock.stop();
    });

    it('Test 1: happy path — returns entries, emits exactly one operator.inspected with closed payload', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/memory/query`,
            payload: { tier: 'H2', operator_id: VALID_OP_ID, query: 'merchant' },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.entries).toHaveLength(2);
        expect(body.entries[0]).toEqual({
            timestamp: '2026-04-20T00:00:00Z',
            kind: 'observation',
            summary: 'saw a merchant',
        });

        // Audit payload: closed tuple, NO memory content.
        const entries = services.audit.query({ eventType: 'operator.inspected' });
        expect(entries.length).toBe(1);
        expect(entries[0].payload).toEqual({
            tier: 'H2',
            action: 'inspect',
            operator_id: VALID_OP_ID,
            target_did: VALID_DID,
        });
        // Structural assertion — ANY new key here would be a T-6-06 regression.
        expect(Object.keys(entries[0].payload).sort()).toEqual(
            ['action', 'operator_id', 'target_did', 'tier'],
        );
    });

    it('Test 2: invalid tier → 400 invalid_tier, no audit event', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/memory/query`,
            payload: { tier: 'H3', operator_id: VALID_OP_ID, query: 'x' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_tier' });
        expect(services.audit.query({ eventType: 'operator.inspected' }).length).toBe(0);
    });

    it('Test 3: invalid operator_id → 400 invalid_operator_id, no audit event', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/memory/query`,
            payload: { tier: 'H2', operator_id: 'not-a-uuid', query: 'x' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_operator_id' });
        expect(services.audit.query({ eventType: 'operator.inspected' }).length).toBe(0);
    });

    it('Test 4: invalid DID → 400 invalid_did, no audit event', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/garbage-did/memory/query',
            payload: { tier: 'H2', operator_id: VALID_OP_ID, query: 'x' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_did' });
        expect(services.audit.query({ eventType: 'operator.inspected' }).length).toBe(0);
    });

    it('Test 5: unknown Nous → 404 unknown_nous, no audit event', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/did:noesis:nobody/memory/query',
            payload: { tier: 'H2', operator_id: VALID_OP_ID, query: 'x' },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: 'unknown_nous' });
        expect(services.audit.query({ eventType: 'operator.inspected' }).length).toBe(0);
    });

    it('Test 6: brain disconnected → 503 brain_unavailable, NO audit event', async () => {
        const runners = new Map<string, MockRunner>();
        runners.set(VALID_DID, makeRunner([], { connected: false }));
        await app.close();
        services.clock.stop();
        services = seedServices(runners);
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/memory/query`,
            payload: { tier: 'H2', operator_id: VALID_OP_ID, query: 'x' },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ error: 'brain_unavailable' });
        expect(services.audit.query({ eventType: 'operator.inspected' }).length).toBe(0);
    });

    it('Test 7: brain RPC throws → 503 brain_unavailable, NO audit event', async () => {
        const runners = new Map<string, MockRunner>();
        runners.set(
            VALID_DID,
            makeRunner([], { forceError: new Error('socket timeout') }),
        );
        await app.close();
        services.clock.stop();
        services = seedServices(runners);
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${VALID_DID}/memory/query`,
            payload: { tier: 'H2', operator_id: VALID_OP_ID, query: 'x' },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ error: 'brain_unavailable' });
        // Critical: 503 paths MUST NOT write to the audit chain.
        expect(services.audit.query({ eventType: 'operator.inspected' }).length).toBe(0);
    });
});
