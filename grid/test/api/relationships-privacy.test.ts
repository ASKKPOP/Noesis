/**
 * Phase 9 Plan 04 Task 3 — Relationship endpoint privacy matrix.
 *
 * T-09-07 gate: asserts EXACT response key-sets for all four relationship
 * endpoints so numeric valence/weight can NEVER leak into H1 or graph responses.
 *
 * Coverage (≥14 test cases across H1/H2/H5/graph):
 *   Test 1  — H1 GET response shape: exact 4-key set, no valence/weight
 *   Test 2  — H1 GET rejects invalid DID → 400
 *   Test 3  — H1 GET on tombstoned DID → 410
 *   Test 4  — H1 top clamp (over-limit, non-integer, negative)
 *   Test 5  — H2 POST response shape: exact 5-key set with numeric valence + weight
 *   Test 6  — H2 POST emits operator.inspected (D-9-13 zero allowlist growth)
 *   Test 7  — H2 POST tier spoof → 400 (T-09-14)
 *   Test 8  — H5 GET events shape: exact 4-key per event
 *   Test 9  — H5 GET unknown edge_key → 404
 *   Test 10 — H5 GET emits operator.inspected
 *   Test 11 — H5 GET tier query-param mismatch → 400
 *   Test 12 — Graph GET response shape: nodes {did,x,y} + edges {did_a,did_b,warmth_bucket,edge_hash}
 *   Test 13 — Graph layout determinism: same DID → same x,y across two calls
 *   Test 14 — Full privacy matrix: no valence+weight in H1/graph; no raw payload in H1/H2/graph
 *
 * Pattern: clone of operator-payload-privacy.test.ts; uses Fastify app.inject
 * to exercise real routes without a network socket.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { RelationshipListener } from '../../src/relationships/listener.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/config.js';
import { edgeHash } from '../../src/relationships/canonical.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

// ─── stable test constants ───────────────────────────────────────────────────

const VALID_OP_ID = 'op:99999999-9999-4999-8999-999999999999';
const DID_A = 'did:noesis:alpha';
const DID_B = 'did:noesis:beta';
const DID_C = 'did:noesis:gamma';
const TOMBSTONE_DID = 'did:noesis:dead';

// ─── fixture helpers ─────────────────────────────────────────────────────────

/** Emit a nous.spoke event with to_did so the listener forms an edge. */
function appendSpoke(audit: AuditChain, fromDid: string, toDid: string, tick = 1): void {
    audit.append('nous.spoke', fromDid, {
        name: fromDid.split(':').pop(),
        channel: 'agora',
        text: 'hello',
        tick,
        to_did: toDid,
    });
}

/** Emit a trade.settled event to create a high-weight edge. */
function appendTradeSettled(audit: AuditChain, proposer: string, counterparty: string, tick = 2): void {
    audit.append('trade.settled', proposer, {
        counterparty,
        amount: 10,
        nonce: 'nonce-1',
        tick,
    });
}

interface TestFixture {
    services: GridServices;
    audit: AuditChain;
    registry: NousRegistry;
    listener: RelationshipListener;
    edgeKey: string;
    app: FastifyInstance;
}

async function buildFixture(): Promise<TestFixture> {
    const clock = new WorldClock({ tickRateMs: 1_000_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const registry = new NousRegistry();

    // Spawn test Nous
    registry.spawn({ did: DID_A, name: 'Alpha', publicKey: 'pk-a', region: 'agora' }, 'test.grid', 0, 100);
    registry.spawn({ did: DID_B, name: 'Beta', publicKey: 'pk-b', region: 'agora' }, 'test.grid', 0, 100);
    registry.spawn({ did: DID_C, name: 'Gamma', publicKey: 'pk-c', region: 'agora' }, 'test.grid', 0, 100);
    registry.spawn({ did: TOMBSTONE_DID, name: 'Dead', publicKey: 'pk-d', region: 'agora' }, 'test.grid', 0, 100);
    registry.tombstone(TOMBSTONE_DID, 5, space);

    // Create listener — seeded with events before app starts
    const listener = new RelationshipListener(audit, DEFAULT_RELATIONSHIP_CONFIG);

    // Seed events to create ≥2 edges
    appendSpoke(audit, DID_A, DID_B, 1);
    appendSpoke(audit, DID_B, DID_A, 2);
    appendTradeSettled(audit, DID_A, DID_B, 3);  // high-weight edge
    appendSpoke(audit, DID_B, DID_C, 4);

    // Compute edge_key for H5 tests from the A-B edge
    const edgeAB = listener.getEdge(DID_A, DID_B);
    if (!edgeAB) throw new Error('Test setup: A-B edge not created');
    const edgeKey = edgeHash(edgeAB);  // full 64-char hex

    const services: GridServices = {
        clock,
        space,
        logos,
        audit,
        gridName: 'test-grid',
        registry,
        relationships: listener,
        config: { relationship: DEFAULT_RELATIONSHIP_CONFIG },
    };

    const app = buildServer(services);
    await app.ready();

    return { services, audit, registry, listener, edgeKey, app };
}

// ─── test suite ──────────────────────────────────────────────────────────────

describe('Relationship endpoint privacy matrix — T-09-07 gate', () => {
    let fixture: TestFixture;

    beforeEach(async () => {
        fixture = await buildFixture();
    });

    afterEach(async () => {
        await fixture.app.close();
        fixture.services.clock.stop();
    });

    // ── Test 1: H1 GET response shape ────────────────────────────────────────

    it('Test 1: H1 GET response — exact 4-key set, no valence/weight', async () => {
        const res = await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/nous/${DID_A}/relationships?top=5`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body).toHaveProperty('edges');
        expect(Array.isArray(body.edges)).toBe(true);
        expect(body.edges.length).toBeGreaterThan(0);

        for (const edge of body.edges) {
            // EXACT 4-key set — no extras tolerated (T-09-07)
            expect(new Set(Object.keys(edge))).toEqual(
                new Set(['counterparty_did', 'warmth_bucket', 'recency_tick', 'edge_hash']),
            );
            // Warmth bucket must be one of the three valid values
            expect(typeof edge.warmth_bucket).toBe('string');
            expect(['cold', 'warm', 'hot']).toContain(edge.warmth_bucket);
            // Plaintext-leak guards
            expect(edge).not.toHaveProperty('valence');
            expect(edge).not.toHaveProperty('weight');
        }
    });

    // ── Test 2: H1 GET rejects invalid DID ──────────────────────────────────

    it('Test 2: H1 GET rejects invalid DID → 400', async () => {
        const res = await fixture.app.inject({
            method: 'GET',
            url: '/api/v1/nous/not-a-did/relationships',
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_did' });
    });

    // ── Test 3: H1 GET on tombstoned DID → 410 ───────────────────────────────

    it('Test 3: H1 GET on tombstoned DID → 410', async () => {
        const res = await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/nous/${TOMBSTONE_DID}/relationships`,
        });
        expect(res.statusCode).toBe(410);
        const body = res.json();
        expect(body.error).toBe('gone');
        expect(typeof body.deleted_at_tick).toBe('number');
    });

    // ── Test 4: H1 top clamp ─────────────────────────────────────────────────

    it('Test 4: H1 top clamp — over-limit clamped to topNMax', async () => {
        const res = await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/nous/${DID_A}/relationships?top=9999`,
        });
        expect(res.statusCode).toBe(200);
        // Must not return more than topNMax (20) edges
        expect(res.json().edges.length).toBeLessThanOrEqual(DEFAULT_RELATIONSHIP_CONFIG.topNMax);
    });

    it('Test 4b: H1 top clamp — non-integer falls back to topNDefault', async () => {
        const res = await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/nous/${DID_A}/relationships?top=abc`,
        });
        expect(res.statusCode).toBe(200);
        // abc → NaN → fallback to default (5)
        expect(res.json().edges.length).toBeLessThanOrEqual(DEFAULT_RELATIONSHIP_CONFIG.topNDefault);
    });

    it('Test 4c: H1 top clamp — negative falls back to topNDefault', async () => {
        const res = await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/nous/${DID_A}/relationships?top=-1`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().edges.length).toBeLessThanOrEqual(DEFAULT_RELATIONSHIP_CONFIG.topNDefault);
    });

    // ── Test 5: H2 POST response shape ───────────────────────────────────────

    it('Test 5: H2 POST response — exact 5-key set with numeric valence + weight', async () => {
        const res = await fixture.app.inject({
            method: 'POST',
            url: `/api/v1/nous/${DID_A}/relationships/inspect`,
            payload: { tier: 'H2', operator_id: VALID_OP_ID, top: 5 },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body).toHaveProperty('edges');
        expect(body.edges.length).toBeGreaterThan(0);

        for (const edge of body.edges) {
            // EXACT 5-key set (T-09-07)
            expect(new Set(Object.keys(edge))).toEqual(
                new Set(['counterparty_did', 'valence', 'weight', 'recency_tick', 'last_event_hash']),
            );
            expect(typeof edge.valence).toBe('number');
            expect(edge.valence).toBeGreaterThanOrEqual(-1);
            expect(edge.valence).toBeLessThanOrEqual(1);
            expect(typeof edge.weight).toBe('number');
            expect(edge.weight).toBeGreaterThanOrEqual(0);
            expect(edge.weight).toBeLessThanOrEqual(1);
        }
    });

    // ── Test 6: H2 POST emits operator.inspected ─────────────────────────────

    it('Test 6: H2 POST emits exactly one operator.inspected (D-9-13)', async () => {
        const beforeCount = fixture.audit.query({ eventType: 'operator.inspected' }).length;
        await fixture.app.inject({
            method: 'POST',
            url: `/api/v1/nous/${DID_A}/relationships/inspect`,
            payload: { tier: 'H2', operator_id: VALID_OP_ID, top: 5 },
        });
        const entries = fixture.audit.query({ eventType: 'operator.inspected' });
        expect(entries.length).toBe(beforeCount + 1);
        const newest = entries[entries.length - 1];
        expect(newest.payload['tier']).toBe('H2');
        expect(newest.payload['action']).toBe('inspect_relationships');
        expect(newest.payload['target_did']).toBe(DID_A);
    });

    // ── Test 7: H2 POST tier spoof → 400 ─────────────────────────────────────

    it('Test 7: H2 POST tier spoof → 400 tier_mismatch (T-09-14)', async () => {
        const res = await fixture.app.inject({
            method: 'POST',
            url: `/api/v1/nous/${DID_A}/relationships/inspect`,
            payload: { tier: 'H5', operator_id: VALID_OP_ID },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_tier');
    });

    // ── Test 8: H5 GET events shape ──────────────────────────────────────────

    it('Test 8: H5 GET events — exact 4-key per event ({tick,event_type,payload,entry_hash})', async () => {
        const res = await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/operator/relationships/${fixture.edgeKey}/events?tier=H5&operator_id=${VALID_OP_ID}`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body).toHaveProperty('events');
        expect(body).toHaveProperty('edge_key');
        expect(Array.isArray(body.events)).toBe(true);
        expect(body.events.length).toBeGreaterThan(0);

        for (const ev of body.events) {
            expect(new Set(Object.keys(ev))).toEqual(
                new Set(['tick', 'event_type', 'payload', 'entry_hash']),
            );
        }
    });

    // ── Test 9: H5 GET unknown edge_key → 404 ────────────────────────────────

    it('Test 9: H5 GET unknown edge_key → 404', async () => {
        // Full 64-char hex that does not match any existing edge.
        // (Post-ME-02 hardening, shortened keys are rejected with 400 at the
        // regex gate before edge resolution — a 16-char unknown key is no
        // longer the correct fixture for asserting 404 edge_not_found.)
        const unknownKey = '0'.repeat(64);
        const res = await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/operator/relationships/${unknownKey}/events?tier=H5&operator_id=${VALID_OP_ID}`,
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: 'edge_not_found' });
    });

    // ── Test 10: H5 GET emits operator.inspected ─────────────────────────────

    it('Test 10: H5 GET emits exactly one operator.inspected', async () => {
        const beforeCount = fixture.audit.query({ eventType: 'operator.inspected' }).length;
        await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/operator/relationships/${fixture.edgeKey}/events?tier=H5&operator_id=${VALID_OP_ID}`,
        });
        const entries = fixture.audit.query({ eventType: 'operator.inspected' });
        expect(entries.length).toBe(beforeCount + 1);
        const newest = entries[entries.length - 1];
        expect(newest.payload['tier']).toBe('H5');
        expect(newest.payload['action']).toBe('inspect_edge_events');
    });

    // ── Test 11: H5 GET tier query-param mismatch → 400 ─────────────────────

    it('Test 11: H5 GET wrong tier query param → 400 tier_mismatch', async () => {
        const res = await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/operator/relationships/${fixture.edgeKey}/events?tier=H2&operator_id=${VALID_OP_ID}`,
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'tier_mismatch' });
    });

    // ── ME-02 regression: shortened edge_key must not match by prefix ────────
    // (Gap 2 from 09-VERIFICATION.md) — pre-hardening, a 16-char prefix would
    // silently match the first edge whose hash started with those 16 chars,
    // emitting operator.inspected with a wrong target_did. The regex gate is
    // now /^[a-f0-9]{64}$/i and resolution is strict equality on a lowercased
    // input — short keys short-circuit at the validation gate before any edge
    // lookup, operator_id check, or audit emission.

    it('H5 rejects 16-char edge_key prefix with 400 invalid_edge_key (ME-02)', async () => {
        const { app, audit, edgeKey } = fixture;
        const auditLenBefore = audit.all().length;

        const shortKey = edgeKey.slice(0, 16);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/operator/relationships/${shortKey}/events?tier=H5&operator_id=${VALID_OP_ID}`,
        });

        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_edge_key' });

        // No operator.inspected should have been emitted
        const inspectedAfter = audit.all()
            .slice(auditLenBefore)
            .filter(e => e.eventType === 'operator.inspected');
        expect(inspectedAfter).toHaveLength(0);
    });

    it('H5 rejects 63-char edge_key (one short of full hash) with 400 (ME-02)', async () => {
        const { app, audit, edgeKey } = fixture;
        const auditLenBefore = audit.all().length;

        const nearKey = edgeKey.slice(0, 63);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/operator/relationships/${nearKey}/events?tier=H5&operator_id=${VALID_OP_ID}`,
        });

        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_edge_key' });

        const inspectedAfter = audit.all()
            .slice(auditLenBefore)
            .filter(e => e.eventType === 'operator.inspected');
        expect(inspectedAfter).toHaveLength(0);
    });

    it('H5 accepts 64-char full edge_hash and emits operator.inspected with correct target_did (ME-02)', async () => {
        const { app, audit, edgeKey } = fixture;
        const auditLenBefore = audit.all().length;

        expect(edgeKey).toMatch(/^[a-f0-9]{64}$/);

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/operator/relationships/${edgeKey}/events?tier=H5&operator_id=${VALID_OP_ID}`,
        });

        expect(res.statusCode).toBe(200);

        const inspected = audit.all()
            .slice(auditLenBefore)
            .filter(e => e.eventType === 'operator.inspected');
        expect(inspected).toHaveLength(1);

        // Canonical edge enforces did_a < did_b, so for the A-B edge target_did
        // is one of {DID_A, DID_B} and counterparty is the other — they must
        // NEVER be equal (which would indicate a wrong-edge silent match via
        // the old prefix resolver).
        const payload = inspected[0].payload as Record<string, unknown>;
        expect([DID_A, DID_B]).toContain(payload.target_did);
        expect([DID_A, DID_B]).toContain(payload.counterparty_did);
        expect(payload.target_did).not.toBe(payload.counterparty_did);
        expect(payload.tier).toBe('H5');
        expect(payload.action).toBe('inspect_edge_events');
    });

    // ── Test 12: Graph GET response shape ────────────────────────────────────

    it('Test 12: Graph GET — nodes {did,x,y} + edges {did_a,did_b,warmth_bucket,edge_hash}', async () => {
        const res = await fixture.app.inject({
            method: 'GET',
            url: '/api/v1/grid/relationships/graph',
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body).toHaveProperty('nodes');
        expect(body).toHaveProperty('edges');
        expect(Array.isArray(body.nodes)).toBe(true);
        expect(Array.isArray(body.edges)).toBe(true);
        expect(body.nodes.length).toBeGreaterThan(0);
        expect(body.edges.length).toBeGreaterThan(0);

        for (const node of body.nodes) {
            expect(new Set(Object.keys(node))).toEqual(new Set(['did', 'x', 'y']));
            expect(typeof node.x).toBe('number');
            expect(typeof node.y).toBe('number');
        }
        for (const edge of body.edges) {
            expect(new Set(Object.keys(edge))).toEqual(
                new Set(['did_a', 'did_b', 'warmth_bucket', 'edge_hash']),
            );
            // Graph is H1 — no numeric valence/weight (T-09-07)
            expect(edge).not.toHaveProperty('valence');
            expect(edge).not.toHaveProperty('weight');
        }
    });

    // ── Test 13: Graph layout determinism ────────────────────────────────────

    it('Test 13: Graph layout determinism — same DID produces same x,y (OQ-5)', async () => {
        const res1 = await fixture.app.inject({ method: 'GET', url: '/api/v1/grid/relationships/graph' });
        const res2 = await fixture.app.inject({ method: 'GET', url: '/api/v1/grid/relationships/graph' });

        expect(res1.statusCode).toBe(200);
        expect(res2.statusCode).toBe(200);

        const body1 = res1.json();
        const body2 = res2.json();

        // Node arrays must be byte-identical (same DID → same position, every call)
        const sorted1 = body1.nodes.slice().sort((a: { did: string }, b: { did: string }) => a.did.localeCompare(b.did));
        const sorted2 = body2.nodes.slice().sort((a: { did: string }, b: { did: string }) => a.did.localeCompare(b.did));

        expect(JSON.stringify(sorted1)).toBe(JSON.stringify(sorted2));

        // Individual determinism: each DID maps to fixed x,y
        for (const node of body1.nodes) {
            const match = body2.nodes.find((n: { did: string }) => n.did === node.did);
            expect(match).toBeDefined();
            expect(match.x).toBe(node.x);
            expect(match.y).toBe(node.y);
        }
    });

    // ── Test 14: Full privacy matrix ─────────────────────────────────────────

    it('Test 14: Full privacy matrix — valence+weight only in H2; raw payload only in H5', async () => {
        // H1 edges must never have valence or weight
        const h1res = await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/nous/${DID_A}/relationships`,
        });
        for (const e of h1res.json().edges) {
            expect(e).not.toHaveProperty('valence');
            expect(e).not.toHaveProperty('weight');
        }

        // H2 edges have valence + weight (inspector tier)
        const h2res = await fixture.app.inject({
            method: 'POST',
            url: `/api/v1/nous/${DID_A}/relationships/inspect`,
            payload: { tier: 'H2', operator_id: VALID_OP_ID },
        });
        for (const e of h2res.json().edges) {
            expect(e).toHaveProperty('valence');
            expect(e).toHaveProperty('weight');
        }

        // H5 events carry raw payload (sovereign tier)
        const h5res = await fixture.app.inject({
            method: 'GET',
            url: `/api/v1/operator/relationships/${fixture.edgeKey}/events?tier=H5&operator_id=${VALID_OP_ID}`,
        });
        for (const ev of h5res.json().events) {
            expect(ev).toHaveProperty('payload');
        }

        // Graph edges must never have valence or weight
        const graphRes = await fixture.app.inject({
            method: 'GET',
            url: '/api/v1/grid/relationships/graph',
        });
        for (const e of graphRes.json().edges) {
            expect(e).not.toHaveProperty('valence');
            expect(e).not.toHaveProperty('weight');
        }
    });
});
