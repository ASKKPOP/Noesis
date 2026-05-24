/**
 * Phase 25b SANCTION-01 (D-25b-09) — tests for POST /api/v1/operator/nous/:did/mute.
 *
 * Test matrix:
 *   Header-auth contract:
 *   - No x-operator-tier header → 401 tier_missing
 *   - Non-numeric tier header → 401 tier_missing
 *   - tier '2' (< 3) → 403 tier_too_low
 *   - tier '3' + invalid x-operator-id → 400 invalid_operator_id
 *   - Invalid DID shape → 400 invalid_did
 *   - Tombstoned DID → 410 gone
 *   - No runner for DID → 404 unknown_nous
 *   - Success: 200 ok + runner.muteFlag === true + operator.muted in audit
 *   - Reason discipline: sanction_reasons gets plaintext; audit has reason_hash only
 *   - Runner enforcement: after mute, speak action does NOT emit nous.spoke
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { registerMuteBroadcastRoute } from '../../src/api/operator/mute-broadcast.js';
import { NousRunner } from '../../src/integration/nous-runner.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';
import type { IBrainBridge, BrainAction } from '../../src/integration/types.js';
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

/** Stub runner whose muteFlag can be read back after the route fires. */
function makeRunner(opts: { muteFlag?: boolean } = {}): {
    connected: boolean;
    muteFlag: boolean;
    getState: () => Promise<Record<string, unknown>>;
} {
    return {
        connected: true,
        muteFlag: opts.muteFlag ?? false,
        getState: async () => ({}),
    };
}

function buildTestApp(opts: {
    spawnAlpha?: boolean;
    withRunner?: boolean;
    tombstoned?: boolean;
    runner?: ReturnType<typeof makeRunner>;
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
        spawnAlpha(registry);
    }
    if (opts.tombstoned) {
        const space = new SpatialMap();
        registry.tombstone(TARGET_DID, 1, space);
    }

    const runner = opts.withRunner === false
        ? undefined
        : (opts.runner ?? makeRunner());

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
    registerMuteBroadcastRoute(app, services as GridServices);

    return { app, audit, registry, runner, insertCalls };
}

describe('POST /api/v1/operator/nous/:did/mute — header-auth contract', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 401 tier_missing when x-operator-tier header is absent', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
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
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
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
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
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
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
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
            url: '/api/v1/operator/nous/not-a-did/mute',
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
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
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
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('unknown_nous');
    });
});

describe('POST /api/v1/operator/nous/:did/mute — success path', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 200 ok on valid H3 request', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
            payload: { reason: 'test reason' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);
    });

    it('sets runner.muteFlag = true after successful mute', async () => {
        let runner: ReturnType<typeof makeRunner> | undefined;
        ({ app, runner } = buildTestApp({}));
        await app.ready();

        expect(runner!.muteFlag).toBe(false);

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
        });

        expect(runner!.muteFlag).toBe(true);
    });

    it('emits operator.muted with correct payload on success', async () => {
        let audit: AuditChain;
        ({ app, audit } = buildTestApp({}));
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
            payload: { reason: 'misconduct' },
        });

        const entries = audit.query({ eventType: 'operator.muted' });
        expect(entries).toHaveLength(1);
        const payload = entries[0].payload as Record<string, unknown>;
        expect(payload.tier).toBe('H3');
        expect(payload.action).toBe('mute');
        expect(payload.operator_id).toBe(OPERATOR);
        expect(payload.target_did).toBe(TARGET_DID);
        expect(payload.reason_hash).toBe(sha256('misconduct'));
        // Reason plaintext must NOT appear in audit payload
        expect(JSON.stringify(payload)).not.toContain('misconduct');
    });

    it('does NOT emit audit events on error paths (sole-producer invariant)', async () => {
        let audit: AuditChain;
        ({ app, audit } = buildTestApp({}));
        await app.ready();

        // Trigger 401
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
        });

        expect(audit.query({ eventType: 'operator.muted' })).toHaveLength(0);
    });
});

describe('POST /api/v1/operator/nous/:did/mute — reason discipline', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('reason plaintext goes to sanction_reasons; audit payload has only reason_hash', async () => {
        let audit: AuditChain;
        let insertCalls: Array<Record<string, unknown>>;

        ({ app, audit, insertCalls } = buildTestApp({}));
        await app.ready();

        const reason = 'detailed mute reason for logging';
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
            payload: { reason },
        });

        // Audit payload must not contain plaintext
        const muted = audit.query({ eventType: 'operator.muted' });
        expect(muted).toHaveLength(1);
        expect(JSON.stringify(muted[0].payload)).not.toContain(reason);
        expect((muted[0].payload as Record<string, unknown>).reason_hash).toBe(sha256(reason));

        // sanction_reasons must have been called with plaintext
        expect(insertCalls).toHaveLength(1);
        expect(insertCalls[0]?.plaintext).toBe(reason);
        expect(insertCalls[0]?.reason_hash).toBe(sha256(reason));
        expect(insertCalls[0]?.event_type).toBe('operator.muted');
        expect(insertCalls[0]?.target_did).toBe(TARGET_DID);
        expect(insertCalls[0]?.operator_id).toBe(OPERATOR);
    });

    it('uses empty-string reason and SHA-256 of empty when reason is absent', async () => {
        let audit: AuditChain;
        let insertCalls: Array<Record<string, unknown>>;

        ({ app, audit, insertCalls } = buildTestApp({}));
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/mute`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
            // No body.reason
        });

        const muted = audit.query({ eventType: 'operator.muted' });
        expect((muted[0].payload as Record<string, unknown>).reason_hash).toBe(sha256(''));
        expect(insertCalls[0]?.plaintext).toBe('');
    });
});

describe('POST /api/v1/operator/nous/:did/mute — runner enforcement (D-25b-NEW-3)', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('after mute, speak action on NousRunner does NOT emit nous.spoke', async () => {
        const audit = new AuditChain();
        const registry = new NousRegistry();

        spawnAlpha(registry);

        // Create a real NousRunner with a mock bridge that returns a speak action
        const speakAction: BrainAction = {
            action_type: 'speak',
            channel: 'agora',
            text: 'hello world',
            metadata: {},
        };

        const bridge = {
            connected: true,
            sendTick: vi.fn().mockResolvedValue([speakAction]),
            sendMessage: vi.fn().mockResolvedValue([]),
            getState: vi.fn().mockResolvedValue({}),
            queryMemory: vi.fn().mockResolvedValue({ entries: [] }),
            forceTelos: vi.fn().mockResolvedValue({ telos_hash_before: 'a'.repeat(64), telos_hash_after: 'b'.repeat(64) }),
        } satisfies IBrainBridge;

        const space = new SpatialMap();
        const runner = new NousRunner({
            nousDid: TARGET_DID,
            nousName: 'Alpha',
            bridge,
            space,
            audit,
            registry,
            economy: { validateTransfer: () => ({ valid: true }) } as Parameters<typeof NousRunner>[0]['economy'],
        });

        // Control: before mute, speak emits nous.spoke
        await runner.tick(0, 0);
        const beforeMute = audit.query({ eventType: 'nous.spoke' });
        expect(beforeMute).toHaveLength(1);

        // Apply mute
        runner.muteFlag = true;

        // After mute, speak no longer emits nous.spoke
        await runner.tick(1, 0);
        const afterMute = audit.query({ eventType: 'nous.spoke' });
        expect(afterMute).toHaveLength(1);  // still 1 — no new emission
    });

    it('after mute, direct_message action does NOT emit nous.direct_message', async () => {
        const audit = new AuditChain();
        const registry = new NousRegistry();

        spawnAlpha(registry);

        const dmAction: BrainAction = {
            action_type: 'direct_message',
            channel: 'private',
            text: 'secret message',
            metadata: { target_did: 'did:noesis:beta' },
        };

        const bridge = {
            connected: true,
            sendTick: vi.fn().mockResolvedValue([dmAction]),
            sendMessage: vi.fn().mockResolvedValue([]),
            getState: vi.fn().mockResolvedValue({}),
            queryMemory: vi.fn().mockResolvedValue({ entries: [] }),
            forceTelos: vi.fn().mockResolvedValue({ telos_hash_before: 'a'.repeat(64), telos_hash_after: 'b'.repeat(64) }),
        } satisfies IBrainBridge;

        const space = new SpatialMap();
        const runner = new NousRunner({
            nousDid: TARGET_DID,
            nousName: 'Alpha',
            bridge,
            space,
            audit,
            registry,
            economy: { validateTransfer: () => ({ valid: true }) } as Parameters<typeof NousRunner>[0]['economy'],
        });

        // Control: before mute, DM emits nous.direct_message
        await runner.tick(0, 0);
        expect(audit.query({ eventType: 'nous.direct_message' })).toHaveLength(1);

        // Apply mute
        runner.muteFlag = true;

        // After mute, DM is suppressed
        await runner.tick(1, 0);
        expect(audit.query({ eventType: 'nous.direct_message' })).toHaveLength(1);  // still 1
    });
});
