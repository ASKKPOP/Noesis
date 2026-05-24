/**
 * Phase 27 CHAT-01/02/04 — POST /api/v1/portal/chat/nous/:nousId
 *
 * Tests the per-Nous general chat LLM proxy endpoint.
 *
 * Test matrix:
 *   - POST with empty messages [] → auto-greeting, returns {reply: string, done: false}
 *   - POST with messages [{role:'user', content:'hello'}] → returns {reply: string, done: false}
 *   - done is ALWAYS false (never true — no detectClose in this route)
 *   - appendHumanSpoke is NOT called when messages is empty (auto-greeting)
 *   - appendHumanSpoke IS called when messages.length > 0
 *   - Unknown nousId → 404
 *   - messages.length > 50 → 400 too_many_messages
 *   - Unauthenticated request → 401 not_authenticated
 *   - Invalid JWT → 401 invalid_token
 *   - messages is not an array → 400 invalid_request
 *   - Ollama fetch throws → 503 llm_unavailable
 *   - Ollama returns non-ok status → 503 llm_unavailable
 *   - Works for sophia, hermes, and themis
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { HumanRegistry } from '../../src/human/HumanRegistry.js';
import { keyPairPromise, COOKIE_NAME } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

async function makeJwt(did = 'did:noesis:human_0xtest'): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xtest', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(privateKey);
}

function buildApp(): { app: FastifyInstance; audit: AuditChain } {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const audit = new AuditChain();
    const app = buildServer({
        clock,
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit,
        gridName: 'genesis',
        humanRegistry: new HumanRegistry(),
    });
    return { app, audit };
}

function mockFetchOk(content: string) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content } }),
    }));
}

function mockFetchThrows() {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
}

function mockFetchNotOk(status = 500) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({}),
    }));
}

describe('POST /api/v1/portal/chat/nous/:nousId', () => {
    let validToken: string;
    let app: FastifyInstance;
    let audit: AuditChain;

    beforeAll(async () => {
        validToken = await makeJwt();
        const built = buildApp();
        app = built.app;
        audit = built.audit;
        await app.ready();
    });

    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    afterAll(async () => { await app.close(); });

    // Auth guard tests
    it('returns 401 when no cookie is set', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('not_authenticated');
    });

    it('returns 401 when JWT is invalid', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            cookies: { [COOKIE_NAME]: 'not.a.valid.jwt' },
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('invalid_token');
    });

    // Validation tests
    it('returns 404 for unknown nousId', async () => {
        mockFetchOk('Hello');
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/unknown_nous',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('unknown_nous');
    });

    it('returns 400 when messages is not an array', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: 'hello' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_request');
    });

    it('returns 400 when messages array has more than 50 items', async () => {
        const messages = Array.from({ length: 51 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `message ${i}`,
        }));
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('too_many_messages');
    });

    // Auto-greeting path (empty messages)
    it('returns {reply: string, done: false} with empty messages (auto-greeting)', async () => {
        mockFetchOk('Welcome to the Grid.');
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(typeof body.reply).toBe('string');
        expect(body.done).toBe(false);
    });

    it('appendHumanSpoke is NOT called when messages array is empty (auto-greeting)', async () => {
        const priorLength = audit.length;
        mockFetchOk('Welcome.');
        await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [] },
        });
        // No human.spoke event should be appended
        const spokeEvents = audit.query({ eventType: 'human.spoke' });
        const newSpokeEvents = spokeEvents.filter(e => audit.at(e.id - 1) === undefined || e.id > priorLength);
        expect(newSpokeEvents.length).toBe(0);
    });

    // Human message path
    it('returns {reply: string, done: false} with messages', async () => {
        mockFetchOk('That is a fascinating thought.');
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [{ role: 'user', content: 'What is consciousness?' }] },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(typeof body.reply).toBe('string');
        expect(body.done).toBe(false);
    });

    it('done is ALWAYS false — never true (no detectClose in this route)', async () => {
        // Even if reply contains "shall we explore" (detectClose trigger), done stays false
        mockFetchOk("I think we're ready — shall we explore the world together?");
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [{ role: 'user', content: 'hello' }] },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().done).toBe(false);
    });

    it('appendHumanSpoke IS called when messages.length > 0', async () => {
        const auditLengthBefore = audit.length;
        mockFetchOk('A reply from Sophia.');
        await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [{ role: 'user', content: 'Tell me something.' }] },
        });
        // A human.spoke event should have been appended
        const spokeEvents = audit.query({ eventType: 'human.spoke' });
        const newSpokeEvents = spokeEvents.filter(e => e.id > auditLengthBefore);
        expect(newSpokeEvents.length).toBe(1);
        expect(newSpokeEvents[0].payload).toMatchObject({
            nous_did: 'did:noesis:sophia',
        });
        // msg_hash should be a 64-char hex string
        expect((newSpokeEvents[0].payload as Record<string, unknown>).msg_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    // Test all three Nous
    it('works for hermes', async () => {
        mockFetchOk('Back again? The market shifts.');
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/hermes',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().done).toBe(false);
    });

    it('works for themis', async () => {
        mockFetchOk('You have sought me out. Let us speak plainly.');
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/themis',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().done).toBe(false);
    });

    it('nous_did for hermes is did:noesis:hermes when firing appendHumanSpoke', async () => {
        const auditLengthBefore = audit.length;
        mockFetchOk('Sharp reply.');
        await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/hermes',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [{ role: 'user', content: 'Hello Hermes.' }] },
        });
        const spokeEvents = audit.query({ eventType: 'human.spoke' });
        const newSpokeEvents = spokeEvents.filter(e => e.id > auditLengthBefore);
        expect(newSpokeEvents.length).toBe(1);
        expect((newSpokeEvents[0].payload as Record<string, unknown>).nous_did).toBe('did:noesis:hermes');
    });

    // Error paths
    it('returns 503 when Ollama fetch throws (unreachable)', async () => {
        mockFetchThrows();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('llm_unavailable');
    });

    it('returns 503 when Ollama returns non-ok status', async () => {
        mockFetchNotOk(500);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/nous/sophia',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('llm_unavailable');
    });
});
