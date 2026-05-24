/**
 * Phase 25b SANCTION-04 (D-25b-09) — tests for POST /api/v1/operator/nous/:did/force-sleep.
 *
 * Test matrix:
 *   Header-auth contract (mirrors mute-broadcast.test.ts):
 *   - No x-operator-tier header → 401 tier_missing
 *   - Non-numeric tier header → 401 tier_missing
 *   - tier '2' (< 3) → 403 tier_too_low
 *   - tier '3' + invalid x-operator-id → 400 invalid_operator_id
 *   - Invalid DID shape → 400 invalid_did
 *   - Tombstoned DID → 410 gone
 *   - No runner for DID → 404 unknown_nous
 *   - Success: 200 ok + operator.forced_sleep in audit
 *   - Audit ordering: operator.forced_sleep IMMEDIATELY precedes nous.sleep.entered
 *   - Reason discipline: sanction_reasons gets plaintext; audit has reason_hash only
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { registerForceSleepRoute } from '../../src/api/operator/force-sleep.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';
import { createHash } from 'node:crypto';

const OPERATOR = 'op:11111111-1111-4111-8111-111111111111';
const TARGET_DID = 'did:noesis:alpha';

function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

function spawnAlpha(registry: NousRegistry): void {
    registry.spawn(
        { did: TARGET_DID, name: 'Alpha', publicKey: 'pk', region: 'agora' },
        'test.grid',
        0,
        100,
    );
}

function buildTestApp(opts: {
    spawnAlpha?: boolean;
    withRunner?: boolean;
    tombstoned?: boolean;
    sleepTrigger?: () => void | Promise<void>;
    sanctionReasonStore?: GridServices['sanctionReasonStore'];
}): { app: FastifyInstance; audit: AuditChain; registry: NousRegistry; insertCalls: Array<Record<string, unknown>> } {
    const audit = new AuditChain();
    const registry = new NousRegistry();
    const insertCalls: Array<Record<string, unknown>> = [];

    if (opts.spawnAlpha !== false) {
        spawnAlpha(registry);
    }
    if (opts.tombstoned) {
        // tombstone by spawning then tombstoning
        const space = new SpatialMap();
        registry.tombstone(TARGET_DID, 1, space);
    }

    const runner = opts.withRunner === false
        ? undefined
        : {
            connected: true,
            muteFlag: false,
            triggerSleep: opts.sleepTrigger ?? vi.fn().mockResolvedValue(undefined),
            getState: async () => ({}),
        };

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
    registerForceSleepRoute(app, services as GridServices);

    return { app, audit, registry, insertCalls };
}

describe('POST /api/v1/operator/nous/:did/force-sleep — header-auth contract', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 401 tier_missing when x-operator-tier header is absent', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
            payload: { tier: 'H3', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 401 tier_missing when x-operator-tier is non-numeric (e.g. "H3")', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
            headers: { 'x-operator-tier': 'H3', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 403 tier_too_low when x-operator-tier is 2 (< 3)', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
            headers: { 'x-operator-tier': '2', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('tier_too_low');
    });

    it('returns 400 invalid_operator_id when x-operator-id header is badly formatted', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': 'not-an-op-id' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_operator_id');
    });

    it('returns 400 invalid_did when DID URL param is malformed', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/not-a-did/force-sleep',
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_did');
    });

    it('returns 410 gone when DID is tombstoned', async () => {
        ({ app } = buildTestApp({ tombstoned: true }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(410);
        expect(res.json().error).toBe('gone');
    });

    it('returns 404 unknown_nous when no runner exists for DID', async () => {
        ({ app } = buildTestApp({ withRunner: false }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('unknown_nous');
    });
});

describe('POST /api/v1/operator/nous/:did/force-sleep — success path', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 200 ok on valid H3 request', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
            payload: { reason: 'scheduled maintenance' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);
    });

    it('emits operator.forced_sleep with correct payload on success', async () => {
        let audit: AuditChain;
        ({ app, audit } = buildTestApp({}));
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
            payload: { reason: 'test reason' },
        });

        const entries = audit.query({ eventType: 'operator.forced_sleep' });
        expect(entries).toHaveLength(1);
        const payload = entries[0].payload as Record<string, unknown>;
        expect(payload.tier).toBe('H3');
        expect(payload.action).toBe('force_sleep');
        expect(payload.operator_id).toBe(OPERATOR);
        expect(payload.target_did).toBe(TARGET_DID);
        expect(payload.reason_hash).toBe(sha256('test reason'));
        // Reason plaintext must NOT appear in audit payload
        expect(JSON.stringify(payload)).not.toContain('test reason');
    });

    it('does NOT emit audit events on error paths', async () => {
        let audit: AuditChain;
        ({ app, audit } = buildTestApp({}));
        await app.ready();

        // Trigger 401
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
        });

        expect(audit.query({ eventType: 'operator.forced_sleep' })).toHaveLength(0);
    });
});

describe('POST /api/v1/operator/nous/:did/force-sleep — audit ordering', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('operator.forced_sleep immediately precedes nous.sleep.entered in audit chain', async () => {
        let audit: AuditChain;

        // sleepTrigger mock that emits nous.sleep.entered after being called
        // (simulates the Hypnos machinery responding to the trigger)
        let auditRef!: AuditChain;
        const sleepTrigger = async () => {
            // The sleep machinery (Hypnos) would emit nous.sleep.entered
            auditRef.append('nous.sleep.entered', TARGET_DID, {
                nous_did: TARGET_DID,
                tick: 0,
                ltm_snapshot_hash: 'a'.repeat(64),
            });
        };

        ({ app, audit } = buildTestApp({ sleepTrigger }));
        auditRef = audit;
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
            payload: { reason: 'ordering test' },
        });

        const entries = audit.all();
        const forcedIdx = entries.findIndex(e => e.eventType === 'operator.forced_sleep');
        const sleepIdx = entries.findIndex(e => e.eventType === 'nous.sleep.entered');

        expect(forcedIdx, 'operator.forced_sleep must be emitted').toBeGreaterThanOrEqual(0);
        expect(sleepIdx, 'nous.sleep.entered must be emitted').toBeGreaterThanOrEqual(0);

        // operator.forced_sleep must precede nous.sleep.entered (cause before effect)
        expect(forcedIdx).toBeLessThan(sleepIdx);

        // They must be adjacent (operator.forced_sleep immediately before nous.sleep.entered)
        expect(sleepIdx).toBe(forcedIdx + 1);
    });
});

describe('POST /api/v1/operator/nous/:did/force-sleep — reason discipline', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('reason plaintext goes to sanction_reasons; audit payload has only reason_hash', async () => {
        let audit: AuditChain;
        let insertCalls: Array<Record<string, unknown>>;

        ({ app, audit, insertCalls } = buildTestApp({}));
        await app.ready();

        const reason = 'operator forced sleep reason';
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/force-sleep`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
            payload: { reason },
        });

        // Audit payload must not contain plaintext
        const forcedSleep = audit.query({ eventType: 'operator.forced_sleep' });
        expect(forcedSleep).toHaveLength(1);
        expect(JSON.stringify(forcedSleep[0].payload)).not.toContain(reason);
        expect((forcedSleep[0].payload as Record<string, unknown>).reason_hash).toBe(sha256(reason));

        // sanction_reasons must have been called with plaintext
        expect(insertCalls).toHaveLength(1);
        expect(insertCalls[0]?.plaintext).toBe(reason);
        expect(insertCalls[0]?.reason_hash).toBe(sha256(reason));
        expect(insertCalls[0]?.event_type).toBe('operator.forced_sleep');
    });
});
