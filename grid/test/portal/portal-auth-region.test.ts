/**
 * Task 2 tests — JWT issuance carries region + created_at; /me returns 4 fields.
 *
 * Phase 24 PORTAL-04.
 *
 * Strategy: build the Fastify server, craft a JWT directly using the same
 * keyPairPromise that auth.ts uses, then call GET /me via inject.
 * This avoids a full SIWE round-trip while still testing the real /me handler.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SignJWT, jwtVerify } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { HumanRegistry } from '../../src/human/HumanRegistry.js';
import { keyPairPromise, COOKIE_NAME } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let clock: WorldClock;

beforeAll(async () => {
    clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const humanRegistry = new HumanRegistry();

    app = buildServer({ clock, space, logos, audit, gridName: 'genesis', humanRegistry });
    await app.ready();
});

afterAll(async () => {
    await app.close();
    clock.stop();
});

async function makeJwt(payload: Record<string, unknown>): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(privateKey);
}

describe('GET /api/v1/portal/auth/me — region + created_at fields', () => {
    it('returns 4-field response: did, eth_address, region, created_at', async () => {
        const token = await makeJwt({
            did: 'did:noesis:human:0xabcdef1234567890abcdef1234567890abcdef12',
            eth_address: '0xabcdef1234567890abcdef1234567890abcdef12',
            grid_name: 'genesis',
            region: 'agora',
            created_at: new Date().toISOString(),
        });

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: token },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body).toHaveProperty('did');
        expect(body).toHaveProperty('eth_address');
        expect(body).toHaveProperty('region');
        expect(body).toHaveProperty('created_at');
    });

    it('returns region from JWT payload', async () => {
        const token = await makeJwt({
            did: 'did:noesis:human:0xabcdef1234567890abcdef1234567890abcdef12',
            eth_address: '0xabcdef1234567890abcdef1234567890abcdef12',
            grid_name: 'genesis',
            region: 'market',
            created_at: new Date().toISOString(),
        });

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: token },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().region).toBe('market');
    });

    it('returns region null for old tokens without a region claim (WR-04)', async () => {
        // Old-style JWT without region or created_at fields. Per WR-04, /me does NOT
        // assume 'agora' for pre-migration tokens — region is null when the claim is absent.
        // (New signups DO default to agora at issuance per D-03/D-07.)
        const token = await makeJwt({
            did: 'did:noesis:human:0xabcdef1234567890abcdef1234567890abcdef12',
            eth_address: '0xabcdef1234567890abcdef1234567890abcdef12',
            grid_name: 'genesis',
        });

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: token },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().region).toBe(null);
    });

    it('falls back to null for old tokens without created_at', async () => {
        const token = await makeJwt({
            did: 'did:noesis:human:0xabcdef1234567890abcdef1234567890abcdef12',
            eth_address: '0xabcdef1234567890abcdef1234567890abcdef12',
            grid_name: 'genesis',
        });

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: token },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().created_at).toBeNull();
    });
});

describe('JWT payload — region and created_at fields', () => {
    it('JWT payload from keyPairPromise can carry region field', async () => {
        const createdAt = new Date().toISOString();
        const token = await makeJwt({
            did: 'did:noesis:human:0xabcdef1234567890abcdef1234567890abcdef12',
            eth_address: '0xabcdef1234567890abcdef1234567890abcdef12',
            grid_name: 'genesis',
            region: 'agora',
            created_at: createdAt,
        });

        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);

        expect(payload['region']).toBe('agora');
        expect(payload['created_at']).toBe(createdAt);
    });
});
