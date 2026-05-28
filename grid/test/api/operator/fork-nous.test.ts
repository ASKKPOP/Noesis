/**
 * Phase 43 Plan 02 — fork-nous route tests (43-02-01..43-02-11 + audit failure).
 *
 * Tests for grid/src/api/operator/fork-nous.ts.
 *
 * Auth model: header-trust (x-operator-tier + x-operator-id), H4+ gate.
 * Route: POST /api/v1/operator/fork/:nousDid
 * Download: GET /api/v1/operator/fork/:nousDid/download?token=<one-time-token>
 *
 * Strategy:
 *   - Inject services.checkOperatorOwnsNous stub to avoid DB dependency.
 *   - Mock buildForkArchive to return deterministic fake bytes (avoids needing real .db files).
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

const OPERATOR_ID = 'op:11111111-1111-4111-8111-111111111111';
const OPERATOR_B_ID = 'op:22222222-2222-4222-8222-222222222222';
const NOUS_DID = 'did:civic:noesis:test-nous-abc';

const VALID_HEADERS_H4 = {
    'x-operator-tier': '4',
    'x-operator-id': OPERATOR_ID,
};

function buildTestApp(opts: {
    ownsNous?: (operatorId: string, nousDid: string) => Promise<boolean>;
    auditChain?: AuditChain;
} = {}): { app: FastifyInstance; audit: AuditChain } {
    const audit = opts.auditChain ?? new AuditChain();

    const services: Partial<GridServices> = {
        audit,
        gridName: 'test-grid',
        currentTick: () => 42,
        checkOperatorOwnsNous: opts.ownsNous ?? (async () => true),
    };

    const app = Fastify({ logger: false });
    registerForkNousRoute(app, services as GridServices);
    return { app, audit };
}

describe('POST /api/v1/operator/fork/:nousDid — header-trust auth (Plan 02)', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        forkTokenStore._clear();
    });

    afterEach(async () => {
        if (app) await app.close();
    });

    it('43-02-01: returns 200 with download_url + package_hash on valid H4+ request (FORK-01)', async () => {
        const { app: a } = buildTestApp();
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}`,
            headers: VALID_HEADERS_H4,
        });

        expect(res.statusCode).toBe(200);
        const body = res.json<{ download_url: string; package_hash: string; manifest_export_hash: string; bytes: number }>();
        expect(body.download_url).toMatch(/\/api\/v1\/operator\/fork\//);
        expect(body.download_url).toMatch(/\?token=/);
        expect(body.package_hash).toBe(FAKE_PACKAGE_HASH);
        expect(body.manifest_export_hash).toBe(FAKE_EXPORT_HASH);
        expect(body.bytes).toBe(FAKE_BYTES.length);
    });

    it('43-02-02: returns 401 tier_missing when x-operator-tier header absent', async () => {
        const { app: a } = buildTestApp();
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}`,
            headers: { 'x-operator-id': OPERATOR_ID },
        });

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({ error: 'tier_missing' });
    });

    it('43-02-03: returns 403 tier_too_low when tier < 4', async () => {
        const { app: a } = buildTestApp();
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}`,
            headers: {
                'x-operator-tier': '3',
                'x-operator-id': OPERATOR_ID,
            },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'tier_too_low' });
    });

    it('43-02-04: returns 400 invalid_operator_id when x-operator-id malformed', async () => {
        const { app: a } = buildTestApp();
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}`,
            headers: {
                'x-operator-tier': '4',
                'x-operator-id': 'not-a-valid-operator-id',
            },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_operator_id' });
    });

    it('43-02-05: returns 403 on cross-operator fork attempt (T-43-auth)', async () => {
        // Operator B tries to fork a Nous owned by Operator A — must be rejected.
        const { app: a } = buildTestApp({
            ownsNous: async (operatorId, _nousDid) => {
                // Only OPERATOR_ID owns NOUS_DID; OPERATOR_B_ID does not.
                return operatorId === OPERATOR_ID;
            },
        });
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/fork/${encodeURIComponent(NOUS_DID)}`,
            headers: {
                'x-operator-tier': '4',
                'x-operator-id': OPERATOR_B_ID,
            },
        });

        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'cross_operator_forbidden' });
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
            headers: VALID_HEADERS_H4,
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
            headers: VALID_HEADERS_H4,
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
            headers: VALID_HEADERS_H4,
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
            headers: VALID_HEADERS_H4,
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
