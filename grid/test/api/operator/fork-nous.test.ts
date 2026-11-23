/**
 * Phase 43 Plan 02 — fork-nous route tests (43-02-01..43-02-11 + audit failure).
 *
 * Tests for grid/src/api/operator/fork-nous.ts.
 *
 * Auth model: the Portal session of the person who claimed the Nous's Brain
 *   (brain_tokens.operator_did), simulated here by a preHandler that sets didContext.
 * Route: POST /api/v1/operator/fork/:nousDid
 * Download: GET /api/v1/operator/fork/:nousDid/download?token=<one-time-token>
 *
 * Strategy:
 *   - Mock ownsBrain (the brain_tokens claim lookup) to avoid a DB dependency.
 *   - Mock buildForkArchive to return deterministic fake bytes.
 *   - Use Fastify app.inject() for HTTP simulation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { createHash } from 'node:crypto';
import { AuditChain } from '../../../src/audit/chain.js';
import { registerForkNousRoute } from '../../../src/api/operator/fork-nous.js';
import { forkTokenStore } from '../../../src/api/operator/fork-token-store.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../../src/api/server.js';
import { buildForkArchive } from '../../../src/export/fork-archive-builder.js';
import type { CivicDidRecord } from '../../../src/civic-registry/types.js';
import { ownsBrain } from '../../../src/operator/data/operator-brain-store.js';
import type { Pool } from 'mysql2/promise';

vi.mock('../../../src/operator/data/operator-brain-store.js', () => ({ ownsBrain: vi.fn() }));

// ── Mock buildForkArchive to avoid needing real .db files ────────────────────
vi.mock('../../../src/export/fork-archive-builder.js', () => {
    const FAKE_BYTES = Buffer.from('FAKE_TAR_GZ_CONTENT', 'utf8');
    const packageHash = createHash('sha256').update(FAKE_BYTES).digest('hex');
    const manifestExportHash = 'a'.repeat(64);
    return {
        buildForkArchive: vi.fn().mockResolvedValue({
            bytes: FAKE_BYTES,
            manifestExportHash,
            packageHash,
            memoryFiles: ['nous.db'],
        }),
    };
});

// Convenience: get the fake archive bytes/hashes via the mock's resolved value
const FAKE_BYTES = Buffer.from('FAKE_TAR_GZ_CONTENT', 'utf8');
const FAKE_PACKAGE_HASH = createHash('sha256').update(FAKE_BYTES).digest('hex');
const FAKE_EXPORT_HASH = 'a'.repeat(64);

const OWNER_DID = 'did:noesis:human:0xowner';
const OTHER_PERSON_DID = 'did:noesis:human:0xsomeoneelse';
const NOUS_DID = 'did:civic:noesis:test-nous-abc';
const NOUS_EXISTENCE_DID = 'did:noesis:nous:test-nous-abc';
const NOUS_CREDENTIAL = { type: ['VerifiableCredential', 'CivicCredential'], credentialSubject: { id: NOUS_DID } };

type CivicLookup = Pick<NonNullable<GridServices['civicDidStore']>, 'get'>;

function civicStoreWith(record: Partial<CivicDidRecord> | null): CivicLookup {
    return {
        get: async (gridName: string, civicDid: string) =>
            record && civicDid === NOUS_DID
                ? ({ gridName, civicDid, existenceDid: NOUS_EXISTENCE_DID, credentialJson: NOUS_CREDENTIAL,
                     status: 'active', issuedAtTick: 1, ...record } as CivicDidRecord)
                : null,
    };
}

function buildTestApp(opts: {
    sessionDid?: string | null;
    auditChain?: AuditChain;
    civicDidStore?: CivicLookup | null;
    pool?: Pool | null;
} = {}): { app: FastifyInstance; audit: AuditChain } {
    const audit = opts.auditChain ?? new AuditChain();

    vi.mocked(ownsBrain).mockImplementation(async (_pool, _grid, operatorDid, brainDid) =>
        operatorDid === OWNER_DID && brainDid === NOUS_EXISTENCE_DID);

    const services: Partial<GridServices> = {
        audit,
        gridName: 'test-grid',
        currentTick: () => 42,
        ...(opts.pool === null ? {} : { pool: opts.pool ?? ({} as Pool) }),
        ...(opts.civicDidStore === null
            ? {}
            : { civicDidStore: (opts.civicDidStore ?? civicStoreWith({})) as GridServices['civicDidStore'] }),
    };

    const app = Fastify({ logger: false });
    const sessionDid = opts.sessionDid === undefined ? OWNER_DID : opts.sessionDid;
    if (sessionDid !== null) {
        app.addHook('preHandler', async (req) => {
            req.didContext = { did: sessionDid, tier: 'human_visitor', operatorDid: sessionDid };
        });
    }
    registerForkNousRoute(app, services as GridServices);
    return { app, audit };
}

describe('POST /api/v1/operator/fork/:nousDid — only the Brain\'s owner may fork', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        forkTokenStore._clear();
        vi.mocked(buildForkArchive).mockClear();
    });

    afterEach(async () => {
        if (app) await app.close();
    });

    it('43-02-01: returns 200 with download_url + package_hash for the Brain owner (FORK-01)', async () => {
        const { app: a } = buildTestApp();
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}`,
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<{ download_url: string; package_hash: string; manifest_export_hash: string; bytes: number }>();
        expect(body.download_url).toMatch(/\/api\/v1\/operator\/fork\//);
        expect(body.download_url).toMatch(/\?token=/);
        expect(body.package_hash).toBe(FAKE_PACKAGE_HASH);
        expect(body.manifest_export_hash).toBe(FAKE_EXPORT_HASH);
        expect(body.bytes).toBe(FAKE_BYTES.length);
    });

    it('returns 403 operator_scope_required without a Portal session', async () => {
        ({ app } = buildTestApp({ sessionDid: null }));
        await app.ready();
        const res = await app.inject({ method: 'POST', url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}` });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'operator_scope_required' });
    });

    it('43-02-05: returns 403 cross_operator_forbidden when the signed-in person did not claim this Brain (T-43-auth)', async () => {
        ({ app } = buildTestApp({ sessionDid: OTHER_PERSON_DID }));
        await app.ready();
        const res = await app.inject({ method: 'POST', url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}` });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'cross_operator_forbidden' });
        expect(buildForkArchive).not.toHaveBeenCalled();
    });

    it('returns 403 cross_operator_forbidden for a Brain-token session, even the Nous itself', async () => {
        ({ app } = buildTestApp({ sessionDid: NOUS_EXISTENCE_DID }));
        await app.ready();
        const res = await app.inject({ method: 'POST', url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}` });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'cross_operator_forbidden' });
    });

    it('returns 503 db_unavailable when the Grid has no database', async () => {
        ({ app } = buildTestApp({ pool: null }));
        await app.ready();
        const res = await app.inject({ method: 'POST', url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}` });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toMatchObject({ error: 'db_unavailable' });
    });

    it('records the owner as the actor of operator.nous_forked, with their DID hashed in the payload', async () => {
        const audit = new AuditChain();
        ({ app } = buildTestApp({ auditChain: audit }));
        await app.ready();
        const res = await app.inject({ method: 'POST', url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}` });
        expect(res.statusCode).toBe(200);
        const event = audit.all().find((e) => e.eventType === 'operator.nous_forked')!;
        expect(event.actorDid).toBe(OWNER_DID);
        expect((event.payload as { operator_did_hash: string }).operator_did_hash)
            .toBe(createHash('sha256').update(OWNER_DID).digest('hex'));
    });
});

describe('POST /api/v1/operator/fork/:nousDid — audit order discipline (Plan 02)', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        forkTokenStore._clear();
    });

    afterEach(async () => {
        if (app) await app.close();
    });

    it('43-02-06: operator.nous_forked appended BEFORE response sent (T-43-order)', async () => {
        const audit = new AuditChain();
        const { app: a } = buildTestApp({ auditChain: audit });
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}`,
        });

        expect(res.statusCode).toBe(200);
        // Audit entry must exist after the response returns (order enforced)
        const entries = audit.all();
        const forkedEvent = entries.find(e => e.eventType === 'operator.nous_forked');
        expect(forkedEvent, 'operator.nous_forked must be in audit chain').toBeDefined();
    });

    it('43-02-07: package_hash in audit event equals sha256 of full archive bytes (FORK-04)', async () => {
        const audit = new AuditChain();
        const { app: a } = buildTestApp({ auditChain: audit });
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}`,
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<{ package_hash: string }>();

        const entries = audit.all();
        const forkedEvent = entries.find(e => e.eventType === 'operator.nous_forked');
        expect(forkedEvent).toBeDefined();

        const payload = forkedEvent!.payload as { package_hash: string };
        // package_hash in audit must equal the package_hash in the response
        expect(payload.package_hash).toBe(body.package_hash);
        // and must equal sha256(FAKE_BYTES)
        expect(payload.package_hash).toBe(FAKE_PACKAGE_HASH);
    });

    it('audit failure returns 500 audit_emit_failed — no token issued, no bytes sent', async () => {
        // Break the audit chain so appendOperatorNousForked throws
        const faultyAudit = new AuditChain();
        // Override append to throw
        (faultyAudit as AuditChain & { append: typeof faultyAudit.append }).append = () => {
            throw new Error('simulated audit failure');
        };

        const { app: a } = buildTestApp({ auditChain: faultyAudit });
        app = a;
        await app.ready();

        const tokensBefore = forkTokenStore._size();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}`,
        });

        expect(res.statusCode).toBe(500);
        expect(res.json()).toMatchObject({ error: 'audit_emit_failed' });
        // No token must have been stored
        expect(forkTokenStore._size()).toBe(tokensBefore);
    });
});

describe('GET /api/v1/operator/fork/:nousDid/download — one-time token (Plan 02)', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        forkTokenStore._clear();
    });

    afterEach(async () => {
        if (app) await app.close();
    });

    async function getDownloadToken(testApp: FastifyInstance): Promise<string> {
        const res = await testApp.inject({
            method: 'POST',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ download_url: string }>();
        const match = body.download_url.match(/\?token=([a-f0-9]+)$/);
        expect(match).not.toBeNull();
        return match![1];
    }

    it('43-02-08: first GET with valid token returns 200 + archive bytes (T-43-token)', async () => {
        const { app: a } = buildTestApp();
        app = a;
        await app.ready();

        const token = await getDownloadToken(app);

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}/download?token=${token}`,
        });

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toMatch(/gzip|application/);
        expect(res.headers['referrer-policy']).toBe('no-referrer');
        expect(Buffer.from(res.rawPayload)).toEqual(FAKE_BYTES);
    });

    it('43-02-09: second GET with same token returns 404 token_invalid_or_consumed (T-43-token)', async () => {
        const { app: a } = buildTestApp();
        app = a;
        await app.ready();

        const token = await getDownloadToken(app);

        // First consume succeeds
        const first = await app.inject({
            method: 'GET',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}/download?token=${token}`,
        });
        expect(first.statusCode).toBe(200);

        // Second consume must fail
        const second = await app.inject({
            method: 'GET',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}/download?token=${token}`,
        });
        expect(second.statusCode).toBe(404);
        expect(second.json()).toMatchObject({ error: 'token_invalid_or_consumed' });
    });

    it('43-02-10: GET with expired token (>5min TTL) returns 404 (T-43-token)', async () => {
        vi.useFakeTimers();
        const { app: a } = buildTestApp();
        app = a;
        await app.ready();

        // Issue token at t=0
        const token = await getDownloadToken(app);

        // Advance time past 5-minute TTL
        vi.advanceTimersByTime(5 * 60 * 1000 + 1);

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}/download?token=${token}`,
        });

        vi.useRealTimers();
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'token_invalid_or_consumed' });
    });

    it('43-02-11: GET with token bound to a different nousDid returns 404 (T-43-token)', async () => {
        const { app: a } = buildTestApp();
        app = a;
        await app.ready();

        const token = await getDownloadToken(app);

        // Use the token against a different nousDid
        const differentDid = 'did:civic:noesis:different-nous';
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/operator/fork/${encodeURIComponent(differentDid)}/download?token=${token}`,
        });

        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'token_invalid_or_consumed' });
    });
});

describe('POST /api/v1/operator/fork/:nousDid — identity comes from the civic registry', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        forkTokenStore._clear();
        vi.mocked(buildForkArchive).mockClear();
    });

    afterEach(async () => {
        if (app) await app.close();
    });

    it('records the registry existence-DID and credential in the archive, never a placeholder', async () => {
        ({ app } = buildTestApp());
        await app.ready();

        const res = await app.inject({ method: 'POST', url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}` });

        expect(res.statusCode).toBe(200);
        const input = vi.mocked(buildForkArchive).mock.calls[0]![0];
        expect(input.nousExistenceDid).toBe(NOUS_EXISTENCE_DID);
        expect(JSON.parse(input.civicVcJson)).toEqual(NOUS_CREDENTIAL);
    });

    it('returns 404 unknown_nous when the Civic-DID is not in this Grid registry', async () => {
        ({ app } = buildTestApp({ civicDidStore: civicStoreWith(null) }));
        await app.ready();

        const res = await app.inject({ method: 'POST', url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}` });

        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ error: 'unknown_nous' });
        expect(buildForkArchive).not.toHaveBeenCalled();
    });

    it('returns 503 civic_registry_unavailable when no registry is wired', async () => {
        ({ app } = buildTestApp({ civicDidStore: null }));
        await app.ready();

        const res = await app.inject({ method: 'POST', url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}` });

        expect(res.statusCode).toBe(503);
        expect(res.json()).toMatchObject({ error: 'civic_registry_unavailable' });
        expect(buildForkArchive).not.toHaveBeenCalled();
    });
});
