/**
 * Plan 25a-04 Task 1: GET /api/v1/humans/:did and GET /api/v1/humans/:did/history
 *
 * Contract:
 *   400 — invalid DID (fails HUMAN_DID_RE)
 *   404 — unknown human (not in HumanRegistry)
 *   200 — profile with all expected fields
 *   200 — history with 4 arrays
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { HumanRegistry } from '../../src/human/HumanRegistry.js';
import type { FastifyInstance } from 'fastify';

const GRID_NAME = 'genesis';
const HUMAN_DID = 'did:noesis:human:0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const OTHER_DID = 'did:noesis:human:0x1111111111111111111111111111111111111111';
const NOUS_DID  = 'did:noesis:nous01';

function spawnNous(
    registry: NousRegistry,
    did: string,
    name: string,
    humanOwner?: string,
): void {
    registry.spawn(
        { did, name, publicKey: 'pk', region: 'agora', humanOwner },
        GRID_NAME,
        0,
        100,
    );
}

function buildTestServer(
    humanRegistry: HumanRegistry,
    audit: AuditChain,
    nousRegistry?: NousRegistry,
): { app: FastifyInstance } {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();

    const app = buildServer({
        clock,
        space,
        logos,
        audit,
        gridName: GRID_NAME,
        registry: nousRegistry,
        humanRegistry,
    });

    return { app };
}

describe('GET /api/v1/humans/:did — 400 on invalid DID', () => {
    let app: FastifyInstance;

    beforeAll(() => {
        const audit = new AuditChain();
        const humanRegistry = new HumanRegistry();
        ({ app } = buildTestServer(humanRegistry, audit));
        return app.ready();
    });

    afterAll(async () => { try { await app?.close(); } catch { /* swallow ws cleanup */ } });

    it('returns 400 for non-DID string', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/humans/not-a-did',
        });
        expect(res.statusCode).toBe(400);
        const body = res.json<{ error: string }>();
        expect(body.error).toBe('invalid_did');
    });
});

describe('GET /api/v1/humans/:did — 404 on unknown human', () => {
    let app: FastifyInstance;

    beforeAll(() => {
        const audit = new AuditChain();
        const humanRegistry = new HumanRegistry();
        ({ app } = buildTestServer(humanRegistry, audit));
        return app.ready();
    });

    afterAll(async () => { try { await app?.close(); } catch { /* swallow ws cleanup */ } });

    it('returns 404 for DID not in registry', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}`,
        });
        expect(res.statusCode).toBe(404);
        const body = res.json<{ error: string }>();
        expect(body.error).toBe('unknown_human');
    });
});

describe('GET /api/v1/humans/:did — 200 profile', () => {
    let app: FastifyInstance;
    let audit: AuditChain;
    let humanRegistry: HumanRegistry;
    let nousRegistry: NousRegistry;

    beforeAll(() => {
        audit = new AuditChain();
        humanRegistry = new HumanRegistry();
        nousRegistry = new NousRegistry();

        // Register human
        humanRegistry.createHuman({
            eth_address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            grid_name: GRID_NAME,
            region: 'agora',
        });

        // 2 Nous with humanOwner === HUMAN_DID
        spawnNous(nousRegistry, NOUS_DID, 'Alpha', HUMAN_DID);
        spawnNous(nousRegistry, 'did:noesis:nous02', 'Beta', HUMAN_DID);
        // 1 Nous with a different owner
        spawnNous(nousRegistry, 'did:noesis:nous03', 'Gamma', OTHER_DID);

        // Audit entries for last_active
        audit.append('portal.auth.login', HUMAN_DID, { tick: 1 });
        audit.append('portal.auth.login', HUMAN_DID, { tick: 2 });
        audit.append('portal.auth.login', HUMAN_DID, { tick: 3 });

        // 2 human.transferred where payload.human_did === HUMAN_DID
        audit.append('human.transferred', 'did:noesis:operator', {
            human_did: HUMAN_DID,
            asset: 'wei',
            grid_name: GRID_NAME,
        });
        audit.append('human.transferred', 'did:noesis:operator', {
            human_did: HUMAN_DID,
            asset: 'wei',
            grid_name: GRID_NAME,
        });
        // 1 for OTHER_DID — must NOT count
        audit.append('human.transferred', 'did:noesis:operator', {
            human_did: OTHER_DID,
            asset: 'wei',
            grid_name: GRID_NAME,
        });

        ({ app } = buildTestServer(humanRegistry, audit, nousRegistry));
        return app.ready();
    });

    afterAll(async () => { try { await app?.close(); } catch { /* swallow ws cleanup */ } });

    it('returns 200 with all profile fields', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<Record<string, unknown>>();
        expect(body.did).toBe(HUMAN_DID);
        expect(body.eth_address).toBe('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
        expect(body.grid_name).toBe(GRID_NAME);
        expect(body.region).toBe('agora');
        expect(body.created_at).toBeDefined();
    });

    it('transfer_count === 2 (only entries matching this human_did)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ transfer_count: number }>();
        expect(body.transfer_count).toBe(2);
    });

    it('nous_count === 2 (Nous with humanOwner === HUMAN_DID)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ nous_count: number }>();
        expect(body.nous_count).toBe(2);
    });

    it('last_active is a positive number (most recent audit entry for this DID)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ last_active: number | null }>();
        expect(body.last_active).toBeTypeOf('number');
        expect(body.last_active).toBeGreaterThan(0);
    });

    it('email is NOT in the response (PII exclusion T-25a-04-02)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}`,
        });
        const body = res.json<Record<string, unknown>>();
        expect(body).not.toHaveProperty('email');
    });
});

describe('GET /api/v1/humans/:did/history — 400/404', () => {
    let app: FastifyInstance;

    beforeAll(() => {
        const audit = new AuditChain();
        const humanRegistry = new HumanRegistry();
        ({ app } = buildTestServer(humanRegistry, audit));
        return app.ready();
    });

    afterAll(async () => { try { await app?.close(); } catch { /* swallow ws cleanup */ } });

    it('returns 400 on invalid DID', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/humans/bad-did/history',
        });
        expect(res.statusCode).toBe(400);
        expect(res.json<{ error: string }>().error).toBe('invalid_did');
    });

    it('returns 404 for unknown human', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}/history`,
        });
        expect(res.statusCode).toBe(404);
        expect(res.json<{ error: string }>().error).toBe('unknown_human');
    });
});

describe('GET /api/v1/humans/:did/history — 200 history arrays', () => {
    let app: FastifyInstance;
    let audit: AuditChain;
    let humanRegistry: HumanRegistry;
    let nousRegistry: NousRegistry;

    beforeAll(() => {
        audit = new AuditChain();
        humanRegistry = new HumanRegistry();
        nousRegistry = new NousRegistry();

        humanRegistry.createHuman({
            eth_address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            grid_name: GRID_NAME,
            region: 'agora',
        });

        // Nous owned by HUMAN_DID (for regions_visited)
        spawnNous(nousRegistry, NOUS_DID, 'Alpha', HUMAN_DID);

        // SIWE sessions: 2x login + 1x register
        audit.append('portal.auth.login', HUMAN_DID, { session: 'a', tick: 1 });
        audit.append('portal.auth.login', HUMAN_DID, { session: 'b', tick: 2 });
        audit.append('portal.auth.register', HUMAN_DID, { session: 'c', tick: 3 });

        // Transfers: 1 matching, 1 non-matching
        audit.append('human.transferred', 'did:noesis:op', {
            human_did: HUMAN_DID,
            asset: 'wei',
            grid_name: GRID_NAME,
        });
        audit.append('human.transferred', 'did:noesis:op', {
            human_did: OTHER_DID, // filtered out
            asset: 'wei',
            grid_name: GRID_NAME,
        });

        // Whispers sent from this human
        audit.append('nous.whispered', 'did:noesis:relay', {
            from_did: HUMAN_DID,
            to_did: 'did:noesis:human:0xaaaa000000000000000000000000000000000001',
            ciphertext_hash: 'deadbeef',
        });

        // nous.moved for NOUS_DID (owned by HUMAN_DID)
        audit.append('nous.moved', NOUS_DID, {
            name: 'Alpha',
            fromRegion: 'agora',
            toRegion: 'market',
            travelCost: 5,
            tick: 1,
        });

        ({ app } = buildTestServer(humanRegistry, audit, nousRegistry));
        return app.ready();
    });

    afterAll(async () => { try { await app?.close(); } catch { /* swallow ws cleanup */ } });

    it('siwe_sessions includes login + register events', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}/history`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ siwe_sessions: unknown[] }>();
        expect(body.siwe_sessions).toHaveLength(3);
    });

    it('transfers filters by payload.human_did', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}/history`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ transfers: Array<{ asset: string; grid_name: string }> }>();
        expect(body.transfers).toHaveLength(1);
        expect(body.transfers[0]!.asset).toBe('wei');
        expect(body.transfers[0]!.grid_name).toBe(GRID_NAME);
    });

    it('whispers_sent filters by payload.from_did', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}/history`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ whispers_sent: Array<{ to_did: string; ciphertext_hash: string }> }>();
        expect(body.whispers_sent).toHaveLength(1);
        expect(body.whispers_sent[0]!.ciphertext_hash).toBe('deadbeef');
    });

    it('regions_visited populated from Nous moves owned by this human', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}/history`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ regions_visited: Array<{ region: string }> }>();
        expect(body.regions_visited).toHaveLength(1);
        expect(body.regions_visited[0]!.region).toBe('market');
    });

    it('regions_visited is empty when no Nous owned by human', async () => {
        const audit2 = new AuditChain();
        const hr2 = new HumanRegistry();
        hr2.createHuman({
            eth_address: '0x1111111111111111111111111111111111111111',
            grid_name: GRID_NAME,
        });
        const nr2 = new NousRegistry();
        const { app: app2 } = buildTestServer(hr2, audit2, nr2);
        await app2.ready();

        const res = await app2.inject({
            method: 'GET',
            url: `/api/v1/humans/${OTHER_DID}/history`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ regions_visited: unknown[] }>();
        expect(body.regions_visited).toHaveLength(0);

        await app2.close().catch(() => { /* ws cleanup */ });
    });

    it('each array is sliced to max 20 when 25 source entries', async () => {
        const auditBig = new AuditChain();
        const hrBig = new HumanRegistry();
        hrBig.createHuman({
            eth_address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            grid_name: GRID_NAME,
        });
        for (let i = 0; i < 25; i++) {
            auditBig.append('portal.auth.login', HUMAN_DID, { tick: i });
        }
        const { app: appBig } = buildTestServer(hrBig, auditBig);
        await appBig.ready();

        const res = await appBig.inject({
            method: 'GET',
            url: `/api/v1/humans/${HUMAN_DID}/history`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ siwe_sessions: unknown[] }>();
        expect(body.siwe_sessions).toHaveLength(20);

        await appBig.close().catch(() => { /* ws cleanup */ });
    });
});
