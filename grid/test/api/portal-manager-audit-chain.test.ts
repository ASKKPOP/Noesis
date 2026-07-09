/**
 * Portal Manager v1 — audit-chain viewer READ endpoint tests.
 *
 * GET /api/v1/portal-manager/audit-chain
 *   - SAME two server-trusted gates as the registrations slice: a valid Portal
 *     session cookie is mandatory, and the session DID must be an allowlisted
 *     operator at tier >= 5 (services.operatorAllowlist), else 403 not_operator.
 *     (SECURITY 2026-07-09 — the spoofable x-operator-tier/-id headers are RETIRED.)
 *   - READ-ONLY: reads services.audit.query() + the watchdog snapshot; emits zero
 *     audit events and NEVER calls services.audit.verify().
 *   - PII: each recent entry is projected to EXACTLY { event_type, tick } — no
 *     payload, actor/target DID, or hash. Only civic-relevant prefixes surface.
 *
 * Launcher stub mirrors system-map.test.ts snapLauncher (watchdog snapshot only).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { OperatorGrant } from '../../src/api/preHandlers/operatorAuth.js';
import type { GridServices } from '../../src/api/server.js';
import type { FastifyInstance } from 'fastify';

const OP_ID = 'op:12345678-1234-4234-8234-1234567890ab';
const OPERATOR_DID = 'did:noesis:human:operator-a';
const STRANGER_DID = 'did:noesis:human:0xstranger';

/** The session DID is authorized only via this allowlist (tier >= 5). */
const ALLOW = new Map<string, OperatorGrant>([[OPERATOR_DID, { operatorId: OP_ID, tier: 5 }]]);

async function makePortalCookie(did = OPERATOR_DID): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, eth_address: '0xaabb', grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
}

/** Seed a real AuditChain with a mix of relevant + irrelevant events. */
function seedAudit(): AuditChain {
    const audit = new AuditChain();
    audit.append('portal.registration_submitted', 'did:noesis:human:secretActor', { secretPayload: 'SENSITIVE_TEXT' });
    audit.append('registry.civic_did_issued', 'did:civic:noesis:human:x', { note: 'ALSO_SENSITIVE' });
    audit.append('polis.registration_approved', 'did:civic:noesis:human:y', { z: 1 });
    audit.append('nous.spoke', 'did:noesis:nous:chatterbox', { line: 'IRRELEVANT_LINE' });
    return audit;
}

/** Launcher stub exposing only the watchdog snapshot audit block. */
function launcherStub(auditBlock: unknown): Partial<GridServices> {
    return {
        launcher: {
            healthWatchdog: { snapshot: () => ({ audit: auditBlock }) },
        },
    } as unknown as Partial<GridServices>;
}

function buildApp(over: Partial<GridServices>): FastifyInstance {
    return buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'genesis',
        operatorAllowlist: ALLOW,
        ...over,
    } as GridServices);
}

const HEALTHY_BLOCK = {
    in_memory_length: 4,
    persisted_max_id: 4,
    divergence: 0,
    divergence_threshold: 10,
};

describe('Portal Manager audit-chain — attack-surface gate', () => {
    const PRIOR = process.env.GRID_PORTAL_MANAGER_ENABLED;
    afterAll(() => { process.env.GRID_PORTAL_MANAGER_ENABLED = PRIOR; });

    it('503 portal_manager_disabled when the flag is off', async () => {
        delete process.env.GRID_PORTAL_MANAGER_ENABLED;
        const app = buildApp({ audit: seedAudit(), ...launcherStub(HEALTHY_BLOCK) });
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/audit-chain',
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json().error).toBe('portal_manager_disabled');
        expect(res.json().recent).toBeUndefined();
        await app.close();
    });
});

describe('Portal Manager audit-chain — production-gated handler', () => {
    const PRIOR = process.env.GRID_PORTAL_MANAGER_ENABLED;
    beforeAll(() => { process.env.GRID_PORTAL_MANAGER_ENABLED = 'true'; });
    afterAll(() => { process.env.GRID_PORTAL_MANAGER_ENABLED = PRIOR; });

    it('401/403 without a session cookie (operatorScope gate)', async () => {
        const app = buildApp({ audit: seedAudit(), ...launcherStub(HEALTHY_BLOCK) });
        await app.ready();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/audit-chain',
            // Spoofed headers alone (no cookie) must NOT pass — they are no longer read.
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
        });
        expect([401, 403]).toContain(res.statusCode);
        expect(res.json().recent).toBeUndefined();
        await app.close();
    });

    it('403 not_operator when the logged-in session DID is not on the allowlist', async () => {
        const app = buildApp({ audit: seedAudit(), ...launcherStub(HEALTHY_BLOCK) });
        await app.ready();
        const cookie = await makePortalCookie(STRANGER_DID);
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/audit-chain',
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('not_operator');
        expect(res.json().recent).toBeUndefined();
        await app.close();
    });

    describe('read shape (session-backed)', () => {
        let app: FastifyInstance;
        let cookie: string;
        beforeAll(async () => {
            app = buildApp({ audit: seedAudit(), ...launcherStub(HEALTHY_BLOCK) });
            await app.ready();
            cookie = await makePortalCookie();
        });
        afterAll(async () => { await app.close(); });

        it('200 returns integrity + recent[]', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/audit-chain',
                cookies: { [COOKIE_NAME]: cookie },
            });
            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body.integrity).toEqual({
                in_memory_length: 4,
                persisted_max_id: 4,
                divergence: 0,
                divergence_threshold: 10,
                healthy: true,
            });
            expect(Array.isArray(body.recent)).toBe(true);
        });

        it('recent contains ONLY the allowed prefixes (nous.spoke filtered out)', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/audit-chain',
                cookies: { [COOKIE_NAME]: cookie },
            });
            const recent = res.json().recent as { event_type: string; tick: number }[];
            const types = recent.map(r => r.event_type);
            expect(types).toContain('portal.registration_submitted');
            expect(types).toContain('registry.civic_did_issued');
            expect(types).toContain('polis.registration_approved');
            expect(types).not.toContain('nous.spoke');
        });

        it('each recent item has EXACTLY keys {event_type, tick} — no payload/actor/hash', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/portal-manager/audit-chain',
                cookies: { [COOKIE_NAME]: cookie },
            });
            for (const item of res.json().recent) {
                expect(Object.keys(item).sort()).toEqual(['event_type', 'tick']);
            }
            // No sensitive payload value or actor DID reaches the wire.
            const raw = res.payload;
            expect(raw).not.toContain('SENSITIVE_TEXT');
            expect(raw).not.toContain('ALSO_SENSITIVE');
            expect(raw).not.toContain('IRRELEVANT_LINE');
            expect(raw).not.toContain('secretActor');
            expect(raw).not.toContain('prevHash');
            expect(raw).not.toContain('eventHash');
        });
    });

    it('healthy = divergence <= threshold (within-threshold → true)', async () => {
        const app = buildApp({
            audit: seedAudit(),
            ...launcherStub({ in_memory_length: 5, persisted_max_id: 5, divergence: 5, divergence_threshold: 10 }),
        });
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/audit-chain',
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(res.json().integrity.healthy).toBe(true);
        await app.close();
    });

    it('healthy = false when divergence over threshold', async () => {
        const app = buildApp({
            audit: seedAudit(),
            ...launcherStub({ in_memory_length: 100, persisted_max_id: 50, divergence: 50, divergence_threshold: 10 }),
        });
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/audit-chain',
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(res.json().integrity.healthy).toBe(false);
        await app.close();
    });

    it('launcher/healthWatchdog absent → integrity.healthy=false, no throw', async () => {
        const app = buildApp({ audit: seedAudit() });
        await app.ready();
        const cookie = await makePortalCookie();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/audit-chain',
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().integrity).toEqual({
            in_memory_length: null,
            persisted_max_id: null,
            divergence: null,
            divergence_threshold: 0,
            healthy: false,
        });
        await app.close();
    });

    it('never calls services.audit.verify()', async () => {
        const audit = seedAudit();
        const verifySpy = vi.spyOn(audit, 'verify');
        const app = buildApp({ audit, ...launcherStub(HEALTHY_BLOCK) });
        await app.ready();
        const cookie = await makePortalCookie();
        await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/audit-chain',
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(verifySpy).not.toHaveBeenCalled();
        await app.close();
    });

    it('a 200 read appends ZERO entries to the audit chain', async () => {
        const audit = seedAudit();
        const before = audit.length;
        const app = buildApp({ audit, ...launcherStub(HEALTHY_BLOCK) });
        await app.ready();
        const cookie = await makePortalCookie();
        await app.inject({
            method: 'GET',
            url: '/api/v1/portal-manager/audit-chain',
            cookies: { [COOKIE_NAME]: cookie },
        });
        expect(audit.length).toBe(before);
        await app.close();
    });
});
