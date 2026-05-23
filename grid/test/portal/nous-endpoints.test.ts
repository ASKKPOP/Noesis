/**
 * Phase 27 Plan 02 Task 2 — GET /api/v1/portal/nous/:nousId/(skills|lore|norms)
 *
 * Tests the three portal Nous profile endpoints.
 *
 * Test matrix:
 *   - All three routes: 401 without JWT
 *   - GET /skills: returns {skills: SkillEntry[]} with mocked humanPool
 *   - GET /skills: Brain lookup failure falls back to truncated hash display
 *   - GET /lore: returns {entries: LoreEntry[], cursor?} — no body field
 *   - GET /lore: cursor pagination (?cursor=100 → contributed_tick < 100)
 *   - GET /norms: returns {norms: NormEntry[]} with fingerprint, status, etc.
 *   - GET /norms: empty result when no candidates found
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { HumanRegistry } from '../../src/human/HumanRegistry.js';
import { keyPairPromise, COOKIE_NAME } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

async function makeJwt(did = 'did:noesis:human:0xtest'): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xtest', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(privateKey);
}

// Mock humanPool factory — returns rows based on SQL pattern
function makePool(queryFn: (sql: string, params: unknown[]) => [unknown[], unknown]) {
    return {
        query: vi.fn().mockImplementation((sql: string, params: unknown[]) =>
            Promise.resolve(queryFn(sql, params)),
        ),
    };
}

function buildApp(humanPool?: ReturnType<typeof makePool>): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    return buildServer({
        clock,
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        humanRegistry: new HumanRegistry(),
        humanPool,
    });
}

describe('Portal Nous endpoints — auth', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('GET /api/v1/portal/nous/:nousId/skills returns 401 without JWT', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/skills',
        });
        expect(res.statusCode).toBe(401);
    });

    it('GET /api/v1/portal/nous/:nousId/lore returns 401 without JWT', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/lore',
        });
        expect(res.statusCode).toBe(401);
    });

    it('GET /api/v1/portal/nous/:nousId/norms returns 401 without JWT', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/norms',
        });
        expect(res.statusCode).toBe(401);
    });
});

describe('GET /api/v1/portal/nous/:nousId/skills', () => {
    let app: FastifyInstance;
    let validToken: string;
    let pool: ReturnType<typeof makePool>;

    beforeAll(async () => {
        const hash = 'abc123def456abc1';
        pool = makePool(() => [
            [
                {
                    skill_hash: hash,
                    source: 'skill.taught',
                    teacher_did: 'did:noesis:hermes',
                    created_at: 42,
                },
            ],
            [],
        ]);

        // Mock Brain fetch to fail (test fallback)
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('brain offline')));

        app = buildApp(pool);
        await app.ready();
        validToken = await makeJwt();
    });

    afterAll(async () => {
        await app.close();
        vi.unstubAllGlobals();
    });

    it('returns 200 with skills array', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/skills',
            cookies: { [COOKIE_NAME]: validToken },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { skills: unknown[] };
        expect(Array.isArray(body.skills)).toBe(true);
    });

    it('falls back to truncated hash when Brain lookup fails', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/skills',
            cookies: { [COOKIE_NAME]: validToken },
        });
        const body = res.json() as { skills: Array<{ name: string; description: string }> };
        expect(body.skills.length).toBeGreaterThan(0);
        // When Brain is offline, name should be truncated hash + '...'
        const skill = body.skills[0];
        expect(skill).toBeDefined();
        if (skill) {
            expect(skill.name).toMatch(/\.\.\./);
            expect(skill.description).toBe('');
        }
    });
});

describe('GET /api/v1/portal/nous/:nousId/lore', () => {
    let app: FastifyInstance;
    let validToken: string;

    beforeAll(async () => {
        const loreRows = [
            { content_hash: 'hash1', category_tag: 'philosophy', contributed_tick: 50, citation_count: 3 },
            { content_hash: 'hash2', category_tag: 'science', contributed_tick: 30, citation_count: 1 },
        ];

        const pool = makePool(() => [loreRows, []]);
        app = buildApp(pool);
        await app.ready();
        validToken = await makeJwt();
    });

    afterAll(async () => { await app.close(); });

    it('returns 200 with entries array and cursor', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/lore',
            cookies: { [COOKIE_NAME]: validToken },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { entries: unknown[]; cursor: unknown };
        expect(Array.isArray(body.entries)).toBe(true);
        expect('cursor' in body).toBe(true);
    });

    it('entries contain only metadata — no body field', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/lore',
            cookies: { [COOKIE_NAME]: validToken },
        });
        const body = res.json() as { entries: Array<Record<string, unknown>> };
        for (const entry of body.entries) {
            expect(entry).not.toHaveProperty('body');
            expect(entry).toHaveProperty('content_hash');
            expect(entry).toHaveProperty('category_tag');
            expect(entry).toHaveProperty('contributed_tick');
            expect(entry).toHaveProperty('citation_count');
        }
    });

    it('passes cursor to query when ?cursor= provided', async () => {
        const mockQuery = vi.fn().mockResolvedValue([[], []]);
        const pool = { query: mockQuery };
        const appWithPool = buildServer({
            clock: new WorldClock({ tickRateMs: 100_000 }),
            space: new SpatialMap(),
            logos: new LogosEngine(),
            audit: new AuditChain(),
            gridName: 'genesis',
            humanRegistry: new HumanRegistry(),
            humanPool: pool,
        });
        await appWithPool.ready();

        const token = await makeJwt();
        await appWithPool.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/lore?cursor=100',
            cookies: { [COOKIE_NAME]: token },
        });

        // Query should include cursor value (100) in params
        expect(mockQuery).toHaveBeenCalled();
        const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
        expect(params).toContain(100);

        await appWithPool.close();
    });
});

describe('GET /api/v1/portal/nous/:nousId/norms', () => {
    let validToken: string;

    beforeAll(async () => {
        validToken = await makeJwt();
    });

    it('returns {norms: []} when no candidates match', async () => {
        const pool = makePool(() => [[], []]);
        const app = buildApp(pool);
        await app.ready();

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/norms',
            cookies: { [COOKIE_NAME]: validToken },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ norms: [] });
        await app.close();
    });

    it('returns norms with fingerprint and status when candidates exist', async () => {
        // First query (norm_candidates): returns a candidate
        // Second query (norm_registry): no crystallized entry → status is 'candidate'
        let callCount = 0;
        const pool = makePool(() => {
            callCount++;
            if (callCount === 1) {
                return [
                    [{
                        fingerprint: 'abc123',
                        participant_dids: '["did:noesis:sophia","did:noesis:hermes"]',
                        first_seen_tick: 10,
                        last_updated_tick: 50,
                    }],
                    [],
                ];
            }
            // Second call: norm_registry lookup — empty (not crystallized)
            return [[], []];
        });

        const app = buildApp(pool);
        await app.ready();

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/norms',
            cookies: { [COOKIE_NAME]: validToken },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json() as { norms: Array<{
            fingerprint: string;
            status: string;
            tick_start: number;
            tick_end: number;
            participating_count: number;
        }> };
        expect(body.norms.length).toBe(1);
        const norm = body.norms[0];
        expect(norm).toBeDefined();
        if (norm) {
            expect(norm.fingerprint).toBe('abc123');
            expect(norm.status).toBe('candidate');
            expect(norm.tick_start).toBe(10);
            expect(norm.tick_end).toBe(50);
            expect(norm.participating_count).toBe(2); // length of participant_dids array
        }
        await app.close();
    });

    it('marks norm as crystallized when found in norm_registry', async () => {
        let callCount = 0;
        const pool = makePool(() => {
            callCount++;
            if (callCount === 1) {
                return [
                    [{
                        fingerprint: 'def456',
                        participant_dids: '["did:noesis:sophia"]',
                        first_seen_tick: 5,
                        last_updated_tick: 99,
                    }],
                    [],
                ];
            }
            return [
                [{ fingerprint: 'def456', convergence_type: 'emergent', participant_count: 5 }],
                [],
            ];
        });

        const app = buildApp(pool);
        await app.ready();

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/nous/sophia/norms',
            cookies: { [COOKIE_NAME]: validToken },
        });

        const body = res.json() as { norms: Array<{ status: string; convergence_type: string; participating_count: number }> };
        expect(body.norms[0]?.status).toBe('crystallized');
        expect(body.norms[0]?.convergence_type).toBe('emergent');
        expect(body.norms[0]?.participating_count).toBe(5);
        await app.close();
    });
});
