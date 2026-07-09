/**
 * Regression: ISSUE-007 — Civic-DID registration path trapped the user on onboarding.
 * Found by /qa on 2026-07-09.
 * Report: .gstack/qa-reports/qa-report-authenticated-writesurfaces-2026-07-09.md
 *
 * A human who registers a Civic-DID via /apply/genesis never gets `onboarding_goal`
 * set (that column is only written by the onboarding wizard's PATCH). Before the fix,
 * GET /me derived `onboarded` solely from `onboarding_goal IS NOT NULL`, so a citizen
 * with an active Civic-DID but no goal returned `onboarded: false` — and PortalShell
 * bounced them back to /portal/onboard forever.
 *
 * Fix (grid/src/api/portal/auth.ts): an active Civic-DID also satisfies `onboarded`
 * (completing the Portal→Polis pipeline IS onboarding, D-V3-33).
 *
 * Codepath: GET /me → onboarding_goal query (null) → civicDidStore.getByExistenceDid
 * returns an active record → onboarded must be true.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { HumanRegistry } from '../../src/human/HumanRegistry.js';
import { keyPairPromise, COOKIE_NAME } from '../../src/api/portal/auth.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';
import type { CivicDidStore } from '../../src/civic-registry/civic-did-store.js';
import type { CivicDidRecord } from '../../src/civic-registry/index.js';

const TEST_DID = 'did:noesis:human:email:issue007-aaaa-bbbb-cccc-ddddeeeeffff';
const TEST_CIVIC_DID = 'did:civic:noesis:human:issue007-1111-2222-3333-444455556666';

async function makeJwt(did = TEST_DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis', region: 'agora' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(privateKey);
}

/** humanPool mock — always returns onboarding_goal = null (the trap precondition). */
function makeNullGoalPool(): GridServices['humanPool'] {
    return {
        async query(_sql: string, _values?: unknown[]) {
            return [[{ onboarding_goal: null }], []];
        },
    };
}

/**
 * civicDidStore mock — getByExistenceDid returns an active record (or null).
 * Only .status and .civicDid are read by GET /me; cast avoids the full record shape.
 */
function makeCivicStore(active: boolean): CivicDidStore {
    return {
        async getByExistenceDid(_gridName: string, _existenceDid: string): Promise<CivicDidRecord | null> {
            if (!active) return null;
            return { status: 'active', civicDid: TEST_CIVIC_DID } as unknown as CivicDidRecord;
        },
    } as unknown as CivicDidStore;
}

describe('GET /me — ISSUE-007: active Civic-DID satisfies onboarded even when goal is null', () => {
    let app: FastifyInstance;
    let token: string;

    beforeAll(async () => {
        token = await makeJwt();
        app = buildServer({
            clock: new WorldClock({ tickRateMs: 100_000 }),
            space: new SpatialMap(),
            logos: new LogosEngine(),
            audit: new AuditChain(),
            gridName: 'genesis',
            humanRegistry: new HumanRegistry(),
            humanPool: makeNullGoalPool(),
            civicDidStore: makeCivicStore(true),
        });
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('returns onboarded: true when the human holds an active Civic-DID (goal null)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().civic_did).toBe(TEST_CIVIC_DID);
        expect(res.json().onboarded).toBe(true);
    });
});

describe('GET /me — ISSUE-007 scope: no Civic-DID + null goal still returns onboarded: false', () => {
    let app: FastifyInstance;
    let token: string;

    beforeAll(async () => {
        token = await makeJwt();
        app = buildServer({
            clock: new WorldClock({ tickRateMs: 100_000 }),
            space: new SpatialMap(),
            logos: new LogosEngine(),
            audit: new AuditChain(),
            gridName: 'genesis',
            humanRegistry: new HumanRegistry(),
            humanPool: makeNullGoalPool(),
            civicDidStore: makeCivicStore(false),
        });
        await app.ready();
    });

    afterAll(async () => { await app.close(); });

    it('returns onboarded: false when there is no active Civic-DID and no goal', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal/auth/me',
            cookies: { [COOKIE_NAME]: token },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().civic_did).toBeNull();
        expect(res.json().onboarded).toBe(false);
    });
});
