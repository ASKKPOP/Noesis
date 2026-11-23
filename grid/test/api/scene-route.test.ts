/**
 * GET /api/v1/scene/events — the public scene feed (D-V3-43): public acts only, named
 * only where the record carries the actor's own identity, and never text, amounts,
 * balances, private acts or the owner behind a land event.
 */
import { describe, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { projectSceneEvent, sceneEventsSince, SCENE_PAGE } from '../../src/scene/scene-feed.js';

const SOPHIA = 'did:noesis:sophia';
const HASH = 'a'.repeat(64);

function setup(): { app: FastifyInstance; audit: AuditChain } {
    const audit = new AuditChain();
    const registry = new NousRegistry();
    registry.spawn({ name: 'Sophia', did: SOPHIA, publicKey: 'pk', region: 'agora' }, 'genesis.grid', 0, 500);
    const app = buildServer({ clock: new WorldClock({ tickRateMs: 100_000 }), space: new SpatialMap(), logos: new LogosEngine(), audit, gridName: 'genesis', registry });
    return { app, audit };
}
const get = async (app: FastifyInstance, q = ''): Promise<{ status: number; body: { events: Array<Record<string, unknown>>; cursor: number } }> => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/scene/events${q}` });
    return { status: res.statusCode, body: res.json() };
};

describe('GET /api/v1/scene/events', () => {
    it('shows a move with who, from where and to where', async () => {
        const { app, audit } = setup();
        audit.append('nous.moved', SOPHIA, { name: 'Sophia', fromRegion: 'agora', toRegion: 'market', travelCost: 3, tick: 7 });
        const { body } = await get(app);
        expect(body.events).toHaveLength(1);
        expect(body.events[0]).toMatchObject({ kind: 'moved', actor: { did: SOPHIA, name: 'Sophia' }, from_region: 'agora', region: 'market' });
        expect(JSON.stringify(body)).not.toContain('travelCost');
        await app.close();
    });

    it('shows that a Nous spoke, never what it said', async () => {
        const { app, audit } = setup();
        audit.append('nous.spoke', SOPHIA, { name: 'Sophia', channel: 'agora', text: 'the secret words', tick: 7 });
        const { body } = await get(app);
        expect(body.events[0]).toEqual({ id: 1, at: expect.any(Number), kind: 'spoke', actor: { did: SOPHIA, name: 'Sophia' } });
        expect(JSON.stringify(body)).not.toContain('secret');
        await app.close();
    });

    it('places a land purchase on the map with no owner and no price', async () => {
        const { app, audit } = setup();
        audit.append('zoning.parcel_purchased', HASH, { buyer_civic_did_hash: HASH, parcel_id: 'genesis:business:0003', price_wei: 900, tick: 7, zone_id: 'business' });
        audit.append('zoning.structure_built', HASH, { name_hash: HASH, owner_civic_did_hash: HASH, parcel_id: 'genesis:business:0003', structure_type: 'shop', tick: 8, visibility: 'public' });
        const { body } = await get(app);
        expect(body.events.map((e) => e['kind'])).toEqual(['bought_land', 'built']);
        expect(body.events[0]).toMatchObject({ parcel_id: 'genesis:business:0003', zone_id: 'business' });
        expect(body.events[1]).toMatchObject({ detail: 'shop' });
        // `at` is a wall-clock ms timestamp; its digits contain "900" about once in a hundred runs.
        const text = JSON.stringify(body.events.map((e) => ({ ...e, at: undefined })));
        expect(text).not.toContain(HASH);
        expect(text).not.toContain('900');
        expect(body.events.every((e) => e['actor'] === undefined)).toBe(true);
        await app.close();
    });

    it('never shows private acts, operator acts, amounts or who voted', async () => {
        const { app, audit } = setup();
        audit.append('nous.whispered', SOPHIA, { ciphertext_hash: HASH });
        audit.append('nous.direct_message', SOPHIA, { name: 'Sophia', text: 'hello' });
        audit.append('operator.inspected', 'did:noesis:human:op', { tier: 'H2' });
        audit.append('trade.settled', SOPHIA, { amount_wei: 12345, counterparty: 'did:noesis:hermes' });
        audit.append('ballot.committed', SOPHIA, { proposal_id: 'p1', commit_hash: HASH, voter_did: SOPHIA });
        const { body } = await get(app);
        expect(body.events.map((e) => e['kind'])).toEqual(['traded', 'voted']);
        expect(body.events[0]).toEqual({ id: 4, at: expect.any(Number), kind: 'traded', actor: { did: SOPHIA, name: 'Sophia' } });
        expect(body.events[1]).toEqual({ id: 5, at: expect.any(Number), kind: 'voted' });
        await app.close();
    });

    it('does not show a named act whose actor is not a citizen', async () => {
        const { app, audit } = setup();
        audit.append('nous.moved', 'did:noesis:system:treasury', { toRegion: 'agora' });
        audit.append('nous.moved', 'did:noesis:unknown', { toRegion: 'agora' });
        expect((await get(app)).body.events).toEqual([]);
        await app.close();
    });

    it('continues from a cursor and returns only what came after', async () => {
        const { app, audit } = setup();
        audit.append('nous.spoke', SOPHIA, { text: 'a' });
        const first = await get(app);
        expect(first.body.cursor).toBe(1);
        expect((await get(app, '?since=1')).body).toEqual({ events: [], cursor: 1 });
        audit.append('operator.inspected', 'x', {});
        audit.append('nous.sleep.entered', SOPHIA, { nous_did: SOPHIA });
        const next = await get(app, '?since=1');
        expect(next.body.events.map((e) => e['kind'])).toEqual(['slept']);
        expect(next.body.cursor).toBe(3);
        await app.close();
    });

    it('400 for a cursor that is not a whole number', async () => {
        const { app } = setup();
        expect((await get(app, '?since=abc')).status).toBe(400);
        expect((await get(app, '?since=-1')).status).toBe(400);
        await app.close();
    });
});

describe('scene feed projection', () => {
    it('drops a value that is not from a closed set', () => {
        const event = projectSceneEvent({ id: 1, eventType: 'zoning.structure_built', actorDid: HASH, payload: { parcel_id: 'genesis:business:0001', structure_type: 'a shop with <b>text</b>' }, prevHash: '', eventHash: '', createdAt: 1 }, () => undefined);
        expect(event).toEqual({ id: 1, at: 1, kind: 'built', parcel_id: 'genesis:business:0001' });
    });

    it('pages a long backlog and reports where to continue', () => {
        const entries = Array.from({ length: 250 }, (_, i) => ({ id: i + 1, eventType: 'nous.spoke', actorDid: SOPHIA, payload: {}, prevHash: '', eventHash: '', createdAt: i }));
        const record = { length: entries.length, at: (i: number) => entries[i] };
        const page = sceneEventsSince(record, 10, () => 'Sophia');
        expect(page.events).toHaveLength(SCENE_PAGE);
        expect(page.events[0].id).toBe(11);
        expect(page.cursor).toBe(110);
        const recent = sceneEventsSince(record, null, () => 'Sophia');
        expect(recent.events).toHaveLength(30);
        expect(recent.events.at(-1)?.id).toBe(250);
        expect(recent.cursor).toBe(250);
    });
});
