/**
 * Phase 25b D-25b-12 — tests for POST /api/v1/operator/spawn-system-nous.
 *
 * Test matrix:
 *   Header-auth contract (H5 gate):
 *   - No x-operator-tier header → 401 tier_missing
 *   - Non-numeric tier header → 401 tier_missing
 *   - tier '4' (< 5) → 403 tier_too_low
 *   - tier '5' + invalid x-operator-id → 400 invalid_operator_id
 *
 *   Body validation:
 *   - Missing name → 400 invalid_body
 *   - name too long (> 64 chars) → 400 invalid_body
 *   - personality_seeds empty array → 400 invalid_body
 *   - personality_seeds with non-string entry → 400 invalid_body
 *   - personality_seeds with > 8 entries → 400 invalid_body
 *
 *   Success:
 *   - 200 + nous_did matching ^did:noesis:system:[0-9a-f-]{36}$
 *   - Audit chain shows nous.spawned followed by bios.birth for generated DID
 *   - spawnNous called with correct name and system DID prefix
 *   - No new operator.* event emitted (audit delta is exactly +2: nous.spawned + bios.birth)
 *
 * See: 25b-PLAN-14, D-25b-12, D-25b-NEW-1.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { WorldClock } from '../../src/clock/ticker.js';
import { AuditChain } from '../../src/audit/chain.js';
import { registerSpawnSystemNousRoute } from '../../src/api/operator/spawn-system-nous.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';
import type { SpawnNousDeps } from '../../src/api/operator/spawn-system-nous.js';

const OPERATOR = 'op:11111111-1111-4111-8111-111111111111';
const SYSTEM_DID_REGEX = /^did:noesis:system:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Create a minimal SpawnNousDeps stub that records calls and simulates audit emission. */
function makeSpawnDeps(audit: AuditChain): { deps: SpawnNousDeps; spawnCalls: Array<{ name: string; did: string; region: string }> } {
    const spawnCalls: Array<{ name: string; did: string; region: string }> = [];
    const deps: SpawnNousDeps = {
        spawnNous: (name: string, did: string, _publicKey: string, region: string) => {
            spawnCalls.push({ name, did, region });
            // Simulate the two events GenesisLauncher.spawnNous emits:
            // 1. nous.spawned (actorDid = did), 2. bios.birth (actorDid = did)
            audit.append('nous.spawned', did, { name, region, ndsAddress: `nous://${name}.test` });
            audit.append('bios.birth', did, { did, psyche_hash: 'a'.repeat(64), tick: 0 });
        },
    };
    return { deps, spawnCalls };
}

function buildTestApp(): {
    app: FastifyInstance;
    audit: AuditChain;
    spawnCalls: Array<{ name: string; did: string; region: string }>;
} {
    const audit = new AuditChain();
    const { deps, spawnCalls } = makeSpawnDeps(audit);

    const services: Partial<GridServices> = {
        clock: new WorldClock({ tickRateMs: 1_000_000 }),
        audit,
        gridName: 'test-grid',
    };

    const app = Fastify({ logger: false });
    registerSpawnSystemNousRoute(app, services as GridServices, deps);

    return { app, audit, spawnCalls };
}

describe('25b-14: spawn-system-nous header-auth contract (H5, D-25b-NEW-1)', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 401 tier_missing when x-operator-tier header is absent', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            payload: { name: 'Sophia', personality_seeds: ['curious'] },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 401 tier_missing when x-operator-tier is non-numeric', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: { 'x-operator-tier': 'H5', 'x-operator-id': OPERATOR },
            payload: { name: 'Sophia', personality_seeds: ['curious'] },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 403 tier_too_low when x-operator-tier is 4 (< 5)', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
            payload: { name: 'Sophia', personality_seeds: ['curious'] },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('tier_too_low');
    });

    it('returns 400 invalid_operator_id when x-operator-id header is malformed', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: { 'x-operator-tier': '5', 'x-operator-id': 'not-a-valid-operator-id' },
            payload: { name: 'Sophia', personality_seeds: ['curious'] },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_operator_id');
    });
});

describe('25b-14: spawn-system-nous body validation', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    const H5_HEADERS = { 'x-operator-tier': '5', 'x-operator-id': OPERATOR };

    it('returns 400 invalid_body when name is missing', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: { personality_seeds: ['curious'] },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_body');
    });

    it('returns 400 invalid_body when name is empty string', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: { name: '', personality_seeds: ['curious'] },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_body');
    });

    it('returns 400 invalid_body when name exceeds 64 chars', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: { name: 'x'.repeat(65), personality_seeds: ['curious'] },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_body');
    });

    it('returns 400 invalid_body when personality_seeds is an empty array', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: { name: 'Sophia', personality_seeds: [] },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_body');
    });

    it('returns 400 invalid_body when personality_seeds contains a non-string entry', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: { name: 'Sophia', personality_seeds: ['curious', 42] },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_body');
    });

    it('returns 400 invalid_body when personality_seeds has > 8 entries', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: { name: 'Sophia', personality_seeds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_body');
    });
});

describe('25b-14: spawn-system-nous success path', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    const H5_HEADERS = { 'x-operator-tier': '5', 'x-operator-id': OPERATOR };

    it('returns 200 with nous_did matching did:noesis:system:<uuid> scheme', async () => {
        const { app: testApp, spawnCalls } = buildTestApp();
        app = testApp;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: { name: 'Sophia', personality_seeds: ['curious researcher'] },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.ok).toBe(true);
        expect(body.nous_did).toMatch(SYSTEM_DID_REGEX);
    });

    it('emits exactly nous.spawned + bios.birth for the new DID — no operator.* event', async () => {
        const { app: testApp, audit } = buildTestApp();
        app = testApp;
        await app.ready();

        const beforeLen = audit.all().length;

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: { name: 'Hermes', personality_seeds: ['swift messenger'] },
        });

        expect(res.statusCode).toBe(200);
        const newDid = res.json().nous_did;

        const entries = audit.all().slice(beforeLen);
        expect(entries).toHaveLength(2);

        // First event: nous.spawned
        expect(entries[0].eventType).toBe('nous.spawned');
        expect(entries[0].actorDid).toBe(newDid);

        // Second event: bios.birth (ORDER-LOCKED per launcher.spawnNous contract)
        expect(entries[1].eventType).toBe('bios.birth');
        expect(entries[1].actorDid).toBe(newDid);

        // No operator.* events
        const operatorEvents = entries.filter(e => e.eventType.startsWith('operator.'));
        expect(operatorEvents).toHaveLength(0);
    });

    it('passes the correct name and a system DID prefix to spawnNous', async () => {
        const { app: testApp, spawnCalls } = buildTestApp();
        app = testApp;
        await app.ready();

        await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: { name: 'Themis', personality_seeds: ['just arbiter'] },
        });

        expect(spawnCalls).toHaveLength(1);
        expect(spawnCalls[0].name).toBe('Themis');
        expect(spawnCalls[0].did).toMatch(SYSTEM_DID_REGEX);
    });

    it('accepts name at exactly 64 chars (boundary)', async () => {
        const { app: testApp } = buildTestApp();
        app = testApp;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: { name: 'x'.repeat(64), personality_seeds: ['seed'] },
        });
        expect(res.statusCode).toBe(200);
    });

    it('accepts personality_seeds at exactly 8 entries (boundary)', async () => {
        const { app: testApp } = buildTestApp();
        app = testApp;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/spawn-system-nous',
            headers: H5_HEADERS,
            payload: {
                name: 'Sophia',
                personality_seeds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
            },
        });
        expect(res.statusCode).toBe(200);
    });
});
