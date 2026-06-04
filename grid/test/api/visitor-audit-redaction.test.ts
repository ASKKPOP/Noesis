/**
 * Phase 36 Wave 0 — visitor audit trail redaction test.
 *
 * Asserts:
 * - GET /api/v1/audit/trail WITHOUT bearer returns entries whose actor_did
 *   has been replaced with family prefix (e.g. 'nous' for 'nous.spoke').
 * - Same endpoint WITH valid civic-DID bearer returns the full actor_did.
 *
 * VIS-01: Audit trail accessible to visitors but with DID redaction.
 *
 * Tests fail RED until Plan 02/03 implements visitor-tier redaction on the
 * audit trail route.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

const GRID_NAME = 'genesis';
const CIVIC_DID = 'did:civic:noesis:gen-001';

function buildTestServer(audit: AuditChain): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    return buildServer({ clock, space, logos, audit, gridName: GRID_NAME });
}

describe('visitor audit trail — actor_did redaction by tier', () => {
    let app: FastifyInstance;
    let audit: AuditChain;

    beforeAll(async () => {
        audit = new AuditChain();
        // Seed a canonical audit entry
        audit.append('nous.spoke', CIVIC_DID, { channel: 'agora', tick: 1 });
        app = buildTestServer(audit);
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('unauthenticated request receives family prefix (nous), NOT full actor_did', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/audit/trail',
            // No Authorization header — visitor tier
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        const entries: unknown[] = body.entries ?? body;
        expect(Array.isArray(entries)).toBe(true);

        const hasFullDid = entries.some(
            (e: unknown) => typeof (e as Record<string, unknown>).actor_did === 'string'
                && (e as Record<string, unknown>).actor_did === CIVIC_DID,
        );
        expect(hasFullDid).toBe(false);

        // At least one entry shows the family prefix 'nous'
        const hasPrefix = entries.some(
            (e: unknown) => typeof (e as Record<string, unknown>).actor_did === 'string'
                && (e as Record<string, unknown>).actor_did === 'nous',
        );
        expect(hasPrefix).toBe(true);
    });

    it('civic-DID bearer request receives full actor_did', async () => {
        // tryDid (preHandlers/tryDid.ts step 1b) resolves an ES256 JWT whose `sub` is a
        // valid DID to the civic_member tier, which makes the trail return un-redacted
        // (full) actor_did. Mint a real token signed with the Grid keypair.
        const { SignJWT } = await import('jose');
        const { keyPairPromise } = await import('../../src/api/portal/auth.js');
        const { privateKey } = await keyPairPromise;
        const token = await new SignJWT({})
            .setProtectedHeader({ alg: 'ES256' })
            .setSubject(CIVIC_DID)
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(privateKey);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/audit/trail',
            headers: {
                authorization: `Bearer ${token}`,
            },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        const entries: unknown[] = body.entries ?? body;
        expect(Array.isArray(entries)).toBe(true);

        const hasFullDid = entries.some(
            (e: unknown) => typeof (e as Record<string, unknown>).actor_did === 'string'
                && (e as Record<string, unknown>).actor_did === CIVIC_DID,
        );
        expect(hasFullDid).toBe(true);
    });
});
