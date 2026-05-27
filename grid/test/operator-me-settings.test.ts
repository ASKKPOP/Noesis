/**
 * Phase 40 — Operator settings route tests (LOCAL-01, LOCAL-02)
 * Tests GET + PATCH /api/v1/operator/me/settings with LocalAiSettings shape (D-40-02).
 * Tests operator-settings-store unit behavior (getSettings default, updateSettings merge).
 * TDD: RED tests written in Plan 02.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

vi.mock('../src/operator/data/operator-settings-store.js', () => ({
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
}));

import { buildServer } from '../src/api/server.js';
import { WorldClock } from '../src/clock/ticker.js';
import { SpatialMap } from '../src/space/map.js';
import { LogosEngine } from '../src/logos/engine.js';
import { AuditChain } from '../src/audit/chain.js';
import { NousRegistry } from '../src/registry/registry.js';
import { SignJWT } from 'jose';
import { COOKIE_NAME, keyPairPromise } from '../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';
import { getSettings, updateSettings } from '../src/operator/data/operator-settings-store.js';
import type { LocalAiSettings, OperatorSettings } from '../src/operator/data/operator-settings-store.js';

// Use did:portal:noesis:* format — matches ANY_DID_RE used by tryDid cookie path.
const OP_A_DID = 'did:portal:noesis:operator-a';

async function makePortalCookie(did: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

function buildTestApp(): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        registry: new NousRegistry(),
        pool: {} as import('mysql2/promise').Pool,
    });
}

const DEFAULT_LOCAL_AI: LocalAiSettings = {
    small_model: 'qwen3:4b',
    primary_model: 'qwen3:4b',
    large_model: 'qwen3:4b',
    temperature: 0.7,
    max_tokens: 2048,
    _version: 2,
};

const DEFAULT_SETTINGS: OperatorSettings = {
    local_ai: DEFAULT_LOCAL_AI,
    _version: 2,
};

describe('GET /api/v1/operator/me/settings', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildTestApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 200 with LocalAiSettings shape (small_model, primary_model, large_model, temperature, max_tokens, _version: 2)', async () => {
        vi.mocked(getSettings).mockResolvedValue(DEFAULT_SETTINGS);
        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/settings',
            cookies: { [COOKIE_NAME]: cookie },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<OperatorSettings>();
        expect(body._version).toBe(2);
        expect(body.local_ai.small_model).toBe('qwen3:4b');
        expect(body.local_ai.primary_model).toBe('qwen3:4b');
        expect(body.local_ai.large_model).toBe('qwen3:4b');
        expect(body.local_ai.temperature).toBe(0.7);
        expect(body.local_ai.max_tokens).toBe(2048);
        expect(body.local_ai._version).toBe(2);
    });

    it('returns 401 when no Portal session cookie present', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/operator/me/settings',
        });
        expect(res.statusCode).toBe(401);
    });
});

describe('PATCH /api/v1/operator/me/settings', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildTestApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('persists new temperature value and returns updated shape', async () => {
        const updated: OperatorSettings = {
            local_ai: { ...DEFAULT_LOCAL_AI, temperature: 1.0 },
            _version: 2,
        };
        vi.mocked(updateSettings).mockResolvedValue(updated);
        const cookie = await makePortalCookie(OP_A_DID);
        const res = await app.inject({
            method: 'PATCH',
            url: '/api/v1/operator/me/settings',
            cookies: { [COOKIE_NAME]: cookie },
            payload: { local_ai: { temperature: 1.0 } },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<OperatorSettings>();
        expect(body.local_ai.temperature).toBe(1.0);
        expect(body._version).toBe(2);
    });

    it('returns 401 when no Portal session cookie present', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/api/v1/operator/me/settings',
            payload: { local_ai: { temperature: 1.0 } },
        });
        expect(res.statusCode).toBe(401);
    });
});

describe('operator-settings-store (unit)', () => {
    // These tests use vi.importActual to bypass the vi.mock above and test real implementation.
    it('getSettings() returns qwen3:4b defaults when no DB row exists', async () => {
        const real = await vi.importActual<typeof import('../src/operator/data/operator-settings-store.js')>(
            '../src/operator/data/operator-settings-store.js',
        );
        const mockPool = {
            execute: vi.fn().mockResolvedValue([[], []]),
        };
        const result = await real.getSettings(
            mockPool as unknown as import('mysql2/promise').Pool,
            'genesis',
            'did:noesis:human:0xabc',
        );
        expect(result._version).toBe(2);
        expect(result.local_ai.small_model).toBe('qwen3:4b');
        expect(result.local_ai.temperature).toBe(0.7);
        expect(result.local_ai.max_tokens).toBe(2048);
    });

    it('updateSettings() merges patch with current settings and returns new shape', async () => {
        const real = await vi.importActual<typeof import('../src/operator/data/operator-settings-store.js')>(
            '../src/operator/data/operator-settings-store.js',
        );
        const mockPool = {
            execute: vi
                .fn()
                // First call = getSettings SELECT → empty rows → defaults
                .mockResolvedValueOnce([[], []])
                // Second call = INSERT ... ON DUPLICATE KEY UPDATE
                .mockResolvedValueOnce([{ affectedRows: 1 }, []]),
        };
        const result = await real.updateSettings(
            mockPool as unknown as import('mysql2/promise').Pool,
            'genesis',
            'did:noesis:human:0xabc',
            { local_ai: { temperature: 1.5 } as Partial<LocalAiSettings> },
        );
        expect(result.local_ai.temperature).toBe(1.5);
        expect(result.local_ai.small_model).toBe('qwen3:4b'); // merged, not replaced
        expect(result._version).toBe(2);
    });
});
