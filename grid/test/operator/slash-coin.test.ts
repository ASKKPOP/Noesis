/**
 * Phase 25b SANCTION-02 (D-25b-09) — tests for POST /api/v1/operator/nous/:did/slash.
 *
 * Test matrix:
 *   Header-auth contract:
 *   - No x-operator-tier header → 401 tier_missing
 *   - Non-numeric tier header → 401 tier_missing
 *   - tier '3' (< 4) → 403 tier_too_low
 *   - tier '4' + invalid x-operator-id → 400 invalid_operator_id
 *   - Invalid DID shape → 400 invalid_did
 *   - Tombstoned DID → 410 gone
 *   - No runner for DID → 404 unknown_nous
 *   Amount validation:
 *   - amount: 0 → 400 invalid_amount
 *   - amount: -5 → 400 invalid_amount
 *   - amount: 'abc' → 400 invalid_amount
 *   - amount: 1.5 → 400 invalid_amount
 *   - missing amount → 400 invalid_amount
 *   Success:
 *   - balance debited by amount
 *   - debit clamped to 0 when amount exceeds balance (no 409 — slash always completes)
 *   - audit payload contains amount; reason_hash only (no plaintext)
 *   - sanction_reasons inserted with plaintext
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { registerSlashCoinRoute } from '../../src/api/operator/slash-coin.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';
import { createHash } from 'node:crypto';

const OPERATOR = 'op:11111111-1111-4111-8111-111111111111';
const TARGET_DID = 'did:noesis:alpha';

function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

function spawnAlpha(registry: NousRegistry, initialOusia = 100): void {
    registry.spawn(
        { did: TARGET_DID, name: 'Alpha', publicKey: 'pk', region: 'agora' },
        'test.grid',
        0,
        initialOusia,
    );
}

function makeRunner(): { connected: boolean } {
    return { connected: true };
}

function buildTestApp(opts: {
    spawnAlpha?: boolean;
    initialOusia?: number;
    withRunner?: boolean;
    tombstoned?: boolean;
    sanctionReasonStore?: GridServices['sanctionReasonStore'];
}): {
    app: FastifyInstance;
    audit: AuditChain;
    registry: NousRegistry;
    runner: ReturnType<typeof makeRunner> | undefined;
    insertCalls: Array<Record<string, unknown>>;
} {
    const audit = new AuditChain();
    const registry = new NousRegistry();
    const insertCalls: Array<Record<string, unknown>> = [];

    if (opts.spawnAlpha !== false) {
        spawnAlpha(registry, opts.initialOusia ?? 100);
    }
    if (opts.tombstoned) {
        const space = new SpatialMap();
        registry.tombstone(TARGET_DID, 1, space);
    }

    const runner = opts.withRunner === false ? undefined : makeRunner();

    const sanctionReasonStore = opts.sanctionReasonStore ?? {
        insert: async (row: Record<string, unknown>) => {
            insertCalls.push(row);
        },
    };

    const services: Partial<GridServices> = {
        clock: new WorldClock({ tickRateMs: 1_000_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit,
        gridName: 'test-grid',
        registry,
        sanctionReasonStore,
        getRunner: runner ? vi.fn().mockReturnValue(runner) : vi.fn().mockReturnValue(undefined),
    };

    const app = Fastify({ logger: false });
    registerSlashCoinRoute(app, services as GridServices);

    return { app, audit, registry, runner, insertCalls };
}

describe('POST /api/v1/operator/nous/:did/slash — header-auth contract', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 401 tier_missing when x-operator-tier header is absent', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            payload: { amount: 10 },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 401 tier_missing when x-operator-tier is non-numeric (e.g. "H4")', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': 'H4', 'x-operator-id': OPERATOR },
            payload: { amount: 10 },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 403 tier_too_low when x-operator-tier is 3 (< 4)', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
            payload: { amount: 10 },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('tier_too_low');
    });

    it('returns 400 invalid_operator_id when x-operator-id header is badly formatted', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': 'not-an-op-id' },
            payload: { amount: 10 },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_operator_id');
    });
});

describe('POST /api/v1/operator/nous/:did/slash — DID + runner gates', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 400 invalid_did when DID URL param is malformed', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/not-a-did/slash',
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 10 },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_did');
    });

    it('returns 410 gone when DID is tombstoned', async () => {
        ({ app } = buildTestApp({ tombstoned: true }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 10 },
        });
        expect(res.statusCode).toBe(410);
        expect(res.json().error).toBe('gone');
    });

    it('returns 404 unknown_nous when no runner exists for DID', async () => {
        ({ app } = buildTestApp({ withRunner: false }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 10 },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('unknown_nous');
    });
});

describe('POST /api/v1/operator/nous/:did/slash — amount validation', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 400 invalid_amount when amount is 0', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 0 },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_amount');
    });

    it('returns 400 invalid_amount when amount is negative (-5)', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: -5 },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_amount');
    });

    it('returns 400 invalid_amount when amount is a string ("abc")', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 'abc' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_amount');
    });

    it('returns 400 invalid_amount when amount is a float (1.5)', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 1.5 },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_amount');
    });

    it('returns 400 invalid_amount when amount is missing', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { reason: 'no amount' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_amount');
    });
});

describe('POST /api/v1/operator/nous/:did/slash — success path', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 200 ok on valid H4 request with positive integer amount', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 10, reason: 'fraud detected' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);
    });

    it('debits Nous ousia balance by the slash amount', async () => {
        let registry: NousRegistry;
        ({ app, registry } = buildTestApp({ initialOusia: 100 }));
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 30, reason: 'fraud detected' },
        });

        const record = registry.get(TARGET_DID);
        expect(record?.ousia).toBe(70);
    });

    it('clamps balance to 0 when slash amount exceeds current balance', async () => {
        let registry: NousRegistry;
        ({ app, registry } = buildTestApp({ initialOusia: 10 }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 50, reason: 'fraud detected' },
        });
        // Slash always completes — debit to 0 (punitive, no 409)
        expect(res.statusCode).toBe(200);
        const record = registry.get(TARGET_DID);
        expect(record?.ousia).toBe(0);
    });

    it('emits operator.slashed with correct H4 payload including amount', async () => {
        let audit: AuditChain;
        ({ app, audit } = buildTestApp({}));
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 25, reason: 'market manipulation' },
        });

        const entries = audit.query({ eventType: 'operator.slashed' });
        expect(entries).toHaveLength(1);
        const payload = entries[0].payload as Record<string, unknown>;
        expect(payload.tier).toBe('H4');
        expect(payload.action).toBe('slash');
        expect(payload.operator_id).toBe(OPERATOR);
        expect(payload.target_did).toBe(TARGET_DID);
        expect(payload.amount).toBe(25);
        expect(payload.reason_hash).toBe(sha256('market manipulation'));
        // Reason plaintext must NOT appear in audit payload
        expect(JSON.stringify(payload)).not.toContain('market manipulation');
    });

    it('does NOT emit audit events on error paths (sole-producer invariant)', async () => {
        let audit: AuditChain;
        ({ app, audit } = buildTestApp({}));
        await app.ready();

        // Trigger 401
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
        });

        expect(audit.query({ eventType: 'operator.slashed' })).toHaveLength(0);
    });
});

describe('POST /api/v1/operator/nous/:did/slash — reason discipline', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('reason plaintext goes to sanction_reasons; audit payload has only reason_hash', async () => {
        let audit: AuditChain;
        let insertCalls: Array<Record<string, unknown>>;

        ({ app, audit, insertCalls } = buildTestApp({}));
        await app.ready();

        const reason = 'detailed slash reason for logging';
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/slash`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { amount: 10, reason },
        });

        // Audit payload must not contain plaintext
        const slashed = audit.query({ eventType: 'operator.slashed' });
        expect(slashed).toHaveLength(1);
        expect(JSON.stringify(slashed[0].payload)).not.toContain(reason);
        expect((slashed[0].payload as Record<string, unknown>).reason_hash).toBe(sha256(reason));

        // sanction_reasons must have been called with plaintext
        expect(insertCalls).toHaveLength(1);
        expect(insertCalls[0]?.plaintext).toBe(reason);
        expect(insertCalls[0]?.reason_hash).toBe(sha256(reason));
        expect(insertCalls[0]?.event_type).toBe('operator.slashed');
        expect(insertCalls[0]?.target_did).toBe(TARGET_DID);
        expect(insertCalls[0]?.operator_id).toBe(OPERATOR);
    });
});
