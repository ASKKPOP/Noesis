/**
 * Phase 26 ONBOARD-02/06 — POST /api/v1/portal/chat/onboard
 *
 * Tests the Sophia onboarding LLM proxy endpoint.
 *
 * Test matrix:
 *   - No cookie → 401 not_authenticated
 *   - Invalid JWT → 401 invalid_token
 *   - messages is not an array → 400 invalid_request
 *   - messages array has more than 10 items → 400 too_many_messages
 *   - Ollama called with SOPHIA_ONBOARD_SYSTEM_PROMPT as first system message
 *   - Success: returns { reply: string, done: boolean }
 *   - done=true when reply contains "shall we explore"
 *   - done=false when reply does not contain a closing phrase
 *   - Ollama fetch throws → 503 { error: 'llm_unavailable' }
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

async function makeJwt(): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did: 'did:noesis:human:0xtest', eth_address: '0xtest', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(privateKey);
}

function buildApp(): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    return buildServer({
        clock,
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        humanRegistry: new HumanRegistry(),
    });
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

describe('POST /api/v1/portal/chat/onboard', () => {
    let validToken: string;
    let app: FastifyInstance;

    beforeAll(async () => {
        validToken = await makeJwt();
        app = buildApp();
        await app.ready();
    });

    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    afterAll(async () => { await app.close(); });

    it('returns 401 when no cookie is set', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/onboard',
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('not_authenticated');
    });

    it('returns 401 when JWT is invalid', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/onboard',
            cookies: { [COOKIE_NAME]: 'not.a.valid.jwt' },
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('invalid_token');
    });

    it('returns 400 when messages is not an array', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/onboard',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: 'hello' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_request');
    });

    it('returns 400 when messages array has more than 10 items', async () => {
        const messages = Array.from({ length: 11 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `message ${i}`,
        }));
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/onboard',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('too_many_messages');
    });

    it('calls Ollama with SOPHIA_ONBOARD_SYSTEM_PROMPT as first system message', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ message: { content: 'Hello, welcome to the Grid.' } }),
        });
        vi.stubGlobal('fetch', mockFetch);

        await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/onboard',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [{ role: 'user', content: 'hello' }] },
        });

        expect(mockFetch).toHaveBeenCalledOnce();
        const callArgs = mockFetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body.messages[0].role).toBe('system');
        expect(body.messages[0].content).toContain('Sophia');
        expect(body.stream).toBe(false);
    });

    it('returns { reply, done } on success', async () => {
        mockFetchOk('Hello, welcome to the Grid.');
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/onboard',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [{ role: 'user', content: 'hello' }] },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(typeof body.reply).toBe('string');
        expect(typeof body.done).toBe('boolean');
    });

    it('returns done=true when Sophia reply contains "shall we explore"', async () => {
        mockFetchOk('I think we\'re ready — shall we explore the world together?');
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/onboard',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [{ role: 'user', content: 'I want to learn.' }] },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().done).toBe(true);
    });

    it('returns done=false when Sophia reply does not contain a closing phrase', async () => {
        mockFetchOk('Hello, I am Sophia. What brings you here?');
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/onboard',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().done).toBe(false);
    });

    it('returns 503 when Ollama fetch throws (unreachable)', async () => {
        mockFetchThrows();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/portal/chat/onboard',
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
            url: '/api/v1/portal/chat/onboard',
            cookies: { [COOKIE_NAME]: validToken },
            payload: { messages: [] },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('llm_unavailable');
    });
});
