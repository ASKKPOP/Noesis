/**
 * Phase 25b SANCTION-03 (D-25b-09) — tests for POST /api/v1/operator/nous/:did/quarantine.
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
 *   - Success: 200 ok + quarantineFlag === true + operator.quarantined in audit
 *   - Reason discipline: sanction_reasons gets plaintext; audit has reason_hash only
 *   - Peer-discovery filter: quarantined Nous excluded from inRegion; non-quarantined returned
 *   - Operator visibility: quarantined Nous still returned by active() and all()
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { registerQuarantineRoute } from '../../src/api/operator/quarantine.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';
import { createHash } from 'node:crypto';

const OPERATOR = 'op:11111111-1111-4111-8111-111111111111';
const TARGET_DID = 'did:noesis:alpha';
const BETA_DID = 'did:noesis:beta';
const GAMMA_DID = 'did:noesis:gamma';

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

function makeRunner(): { connected: boolean; muteFlag: boolean } {
    return { connected: true, muteFlag: false };
}

function buildTestApp(opts: {
    spawnAlpha?: boolean;
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
        spawnAlpha(registry);
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
    registerQuarantineRoute(app, services as GridServices);

    return { app, audit, registry, runner, insertCalls };
}

describe('POST /api/v1/operator/nous/:did/quarantine — header-auth contract', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 401 tier_missing when x-operator-tier header is absent', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            payload: { tier: 'H4', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 401 tier_missing when x-operator-tier is non-numeric (e.g. "H4")', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': 'H4', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 403 tier_too_low when x-operator-tier is 3 (< 4)', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('tier_too_low');
    });

    it('returns 400 invalid_operator_id when x-operator-id header is badly formatted', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': 'not-an-op-id' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_operator_id');
    });

    it('returns 400 invalid_did when DID URL param is malformed', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/nous/not-a-did/quarantine',
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_did');
    });

    it('returns 410 gone when DID is tombstoned', async () => {
        ({ app } = buildTestApp({ tombstoned: true }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(410);
        expect(res.json().error).toBe('gone');
    });

    it('returns 404 unknown_nous when no runner exists for DID', async () => {
        ({ app } = buildTestApp({ withRunner: false }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('unknown_nous');
    });
});

describe('POST /api/v1/operator/nous/:did/quarantine — success path', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 200 ok on valid H4 request', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { reason: 'test reason' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);
    });

    it('sets quarantineFlag = true on the registry record after successful quarantine', async () => {
        let registry: NousRegistry;
        ({ app, registry } = buildTestApp({}));
        await app.ready();

        const recordBefore = registry.get(TARGET_DID);
        expect((recordBefore as Record<string, unknown>)?.quarantineFlag).toBeFalsy();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
        });

        const recordAfter = registry.get(TARGET_DID);
        expect((recordAfter as Record<string, unknown>)?.quarantineFlag).toBe(true);
    });

    it('emits operator.quarantined with correct H4 payload on success', async () => {
        let audit: AuditChain;
        ({ app, audit } = buildTestApp({}));
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { reason: 'policy violation' },
        });

        const entries = audit.query({ eventType: 'operator.quarantined' });
        expect(entries).toHaveLength(1);
        const payload = entries[0].payload as Record<string, unknown>;
        expect(payload.tier).toBe('H4');
        expect(payload.action).toBe('quarantine');
        expect(payload.operator_id).toBe(OPERATOR);
        expect(payload.target_did).toBe(TARGET_DID);
        expect(payload.reason_hash).toBe(sha256('policy violation'));
        // Reason plaintext must NOT appear in audit payload
        expect(JSON.stringify(payload)).not.toContain('policy violation');
    });

    it('does NOT emit audit events on error paths (sole-producer invariant)', async () => {
        let audit: AuditChain;
        ({ app, audit } = buildTestApp({}));
        await app.ready();

        // Trigger 401
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
        });

        expect(audit.query({ eventType: 'operator.quarantined' })).toHaveLength(0);
    });
});

describe('POST /api/v1/operator/nous/:did/quarantine — reason discipline', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('reason plaintext goes to sanction_reasons; audit payload has only reason_hash', async () => {
        let audit: AuditChain;
        let insertCalls: Array<Record<string, unknown>>;

        ({ app, audit, insertCalls } = buildTestApp({}));
        await app.ready();

        const reason = 'detailed quarantine reason for logging';
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { reason },
        });

        // Audit payload must not contain plaintext
        const quarantined = audit.query({ eventType: 'operator.quarantined' });
        expect(quarantined).toHaveLength(1);
        expect(JSON.stringify(quarantined[0].payload)).not.toContain(reason);
        expect((quarantined[0].payload as Record<string, unknown>).reason_hash).toBe(sha256(reason));

        // sanction_reasons must have been called with plaintext
        expect(insertCalls).toHaveLength(1);
        expect(insertCalls[0]?.plaintext).toBe(reason);
        expect(insertCalls[0]?.reason_hash).toBe(sha256(reason));
        expect(insertCalls[0]?.event_type).toBe('operator.quarantined');
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
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
        });

        const quarantined = audit.query({ eventType: 'operator.quarantined' });
        expect((quarantined[0].payload as Record<string, unknown>).reason_hash).toBe(sha256(''));
        expect(insertCalls[0]?.plaintext).toBe('');
    });
});

describe('POST /api/v1/operator/nous/:did/quarantine — peer-discovery filter (D-25b-NEW-3)', () => {
    it('quarantined Nous excluded from inRegion (peer-discovery); non-quarantined control Nous returned', async () => {
        const registry = new NousRegistry();

        // Spawn Alpha (to be quarantined) and Gamma (control — not quarantined), both in agora
        registry.spawn(
            { did: TARGET_DID, name: 'Alpha', publicKey: 'pk', region: 'agora' },
            'test.grid', 0, 100,
        );
        registry.spawn(
            { did: GAMMA_DID, name: 'Gamma', publicKey: 'pk2', region: 'agora' },
            'test.grid', 0, 100,
        );

        // Control: both appear in peer-discovery before quarantine
        const before = registry.inRegion('agora');
        expect(before.some(r => r.did === TARGET_DID)).toBe(true);
        expect(before.some(r => r.did === GAMMA_DID)).toBe(true);

        // Set quarantineFlag on Alpha
        const alpha = registry.get(TARGET_DID)!;
        (alpha as unknown as { quarantineFlag: boolean }).quarantineFlag = true;

        // After quarantine: Alpha excluded, Gamma still visible
        const after = registry.inRegion('agora');
        expect(after.some(r => r.did === TARGET_DID)).toBe(false);
        expect(after.some(r => r.did === GAMMA_DID)).toBe(true);
    });

    it('quarantined Nous is still returned by active() (operator visibility preserved)', async () => {
        const registry = new NousRegistry();

        registry.spawn(
            { did: TARGET_DID, name: 'Alpha', publicKey: 'pk', region: 'agora' },
            'test.grid', 0, 100,
        );
        registry.spawn(
            { did: BETA_DID, name: 'Beta', publicKey: 'pk2', region: 'agora' },
            'test.grid', 0, 100,
        );

        // Quarantine Alpha
        const alpha = registry.get(TARGET_DID)!;
        (alpha as unknown as { quarantineFlag: boolean }).quarantineFlag = true;

        // Peer-discovery excludes Alpha
        expect(registry.inRegion('agora').some(r => r.did === TARGET_DID)).toBe(false);

        // Operator-side: active() still returns Alpha
        expect(registry.active().some(r => r.did === TARGET_DID)).toBe(true);
        // all() still returns Alpha
        expect(registry.all().some(r => r.did === TARGET_DID)).toBe(true);
    });

    it('full route: after quarantine route fires, inRegion excludes the quarantined Nous', async () => {
        const audit = new AuditChain();
        const registry = new NousRegistry();
        const insertCalls: Array<Record<string, unknown>> = [];

        // Spawn Alpha (quarantine target) and Gamma (control) in same region
        registry.spawn(
            { did: TARGET_DID, name: 'Alpha', publicKey: 'pk', region: 'agora' },
            'test.grid', 0, 100,
        );
        registry.spawn(
            { did: GAMMA_DID, name: 'Gamma', publicKey: 'pk2', region: 'agora' },
            'test.grid', 0, 100,
        );

        const runner = makeRunner();
        const services: Partial<GridServices> = {
            clock: new WorldClock({ tickRateMs: 1_000_000 }),
            space: new SpatialMap(),
            logos: new LogosEngine(),
            audit,
            gridName: 'test-grid',
            registry,
            sanctionReasonStore: { insert: async (row: Record<string, unknown>) => { insertCalls.push(row); } },
            getRunner: vi.fn().mockReturnValue(runner),
        };

        const app = Fastify({ logger: false });
        registerQuarantineRoute(app, services as GridServices);
        await app.ready();

        // Before quarantine: both in peer-discovery
        expect(registry.inRegion('agora').map(r => r.did)).toContain(TARGET_DID);
        expect(registry.inRegion('agora').map(r => r.did)).toContain(GAMMA_DID);

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${TARGET_DID}/quarantine`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(200);

        // After quarantine: Alpha hidden from peers, Gamma still visible
        expect(registry.inRegion('agora').map(r => r.did)).not.toContain(TARGET_DID);
        expect(registry.inRegion('agora').map(r => r.did)).toContain(GAMMA_DID);

        // Operator visibility preserved
        expect(registry.active().map(r => r.did)).toContain(TARGET_DID);

        await app.close();
    });
});
