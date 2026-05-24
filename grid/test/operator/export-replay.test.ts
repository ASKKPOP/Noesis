/**
 * Regression tests for registerReplayExportRoute — header-auth contract (D-25b-NEW-1).
 *
 * Phase 25b Wave-0 migration: export-replay.ts migrated from body-trust to header-trust auth.
 *
 * Tests verify:
 *   - No headers → 401 tier_missing
 *   - Header x-operator-tier:'4' → 403 tier_too_low
 *   - Header x-operator-tier:'5', bad x-operator-id → 400 invalid_operator_id
 *   - Header x-operator-tier:'5' + valid x-operator-id + body {tier:'H1', ...} → 200 (body tier ignored)
 *   - operator.exported audit entry has operator_id === header value (NOT body value)
 *
 * Analog: grid/test/operator/cognitive-snapshot.test.ts (header-auth assertion pattern).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { registerReplayExportRoute } from '../../src/api/operator/export-replay.js';
import type { GridServices } from '../../src/api/server.js';

// Valid operator IDs (op:<uuid-v4> format)
const VALID_OPERATOR_ID = 'op:12345678-1234-4abc-89ab-123456789012';
const ATTACKER_OPERATOR_ID = 'op:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const VALID_HEADERS = {
    'x-operator-tier': '5',
    'x-operator-id': VALID_OPERATOR_ID,
};

// A fake 64-hex tarball hash for mock output (inline — used in vi.mock factories below)
const FAKE_TARBALL_HASH = 'a'.repeat(64);

// Mock buildExportTarball so tests don't need real tarball infrastructure.
// NOTE: vi.mock is hoisted to top of file, so factory must NOT reference module-level consts.
vi.mock('../../src/export/tarball-builder.js', () => ({
    buildExportTarball: vi.fn().mockResolvedValue({
        bytes: Buffer.from('fake-tarball'),
        hash: 'a'.repeat(64),
    }),
}));

// Mock createManifest
vi.mock('../../src/export/manifest.js', () => ({
    createManifest: vi.fn().mockReturnValue({
        format_version: 1,
        grid_name: 'test-grid',
        start_tick: 1,
        end_tick: 2,
        entry_count: 1,
        chain_tail_hash: 'a'.repeat(64),
        created_at: 0,
    }),
}));

// Mock ReplayGrid
vi.mock('../../src/replay/replay-grid.js', () => ({
    ReplayGrid: vi.fn().mockImplementation(() => ({})),
}));

// Mock buildStateAtTick
vi.mock('../../src/replay/state-builder.js', () => ({
    buildStateAtTick: vi.fn().mockReturnValue({}),
}));

function buildTestApp(services: Partial<GridServices> & { audit: AuditChain }) {
    const app = Fastify({ logger: false });
    registerReplayExportRoute(app, services as GridServices);
    return app;
}

function makeAuditWithEntries(audit: AuditChain) {
    // Seed some entries so slices can be non-empty
    audit.append('nous.spoke', 'did:noesis:agent001', { tick: 1 });
    audit.append('nous.spoke', 'did:noesis:agent001', { tick: 2 });
    return audit;
}

describe('POST /api/v1/operator/replay/export — header-auth (D-25b-NEW-1)', () => {
    let audit: AuditChain;
    let baseServices: Partial<GridServices> & { audit: AuditChain };

    beforeEach(() => {
        audit = new AuditChain();
        makeAuditWithEntries(audit);
        baseServices = {
            audit,
            gridName: 'test-grid',
        } as unknown as Partial<GridServices> & { audit: AuditChain };
    });

    describe('Tier header gate (H5)', () => {
        it('returns 401 tier_missing when no headers are provided', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                // No headers — body claims H5 but must be ignored
                payload: { tier: 'H5', operator_id: VALID_OPERATOR_ID, start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(401);
            expect(JSON.parse(resp.body).error).toBe('tier_missing');
        });

        it('returns 401 tier_missing when x-operator-tier header is non-numeric', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: { 'x-operator-tier': 'H5', 'x-operator-id': VALID_OPERATOR_ID },
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(401);
            expect(JSON.parse(resp.body).error).toBe('tier_missing');
        });

        it('returns 403 tier_too_low when x-operator-tier header is 4', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: { 'x-operator-tier': '4', 'x-operator-id': VALID_OPERATOR_ID },
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(403);
            expect(JSON.parse(resp.body).error).toBe('tier_too_low');
        });

        it('returns 403 tier_too_low when x-operator-tier header is 1', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: { 'x-operator-tier': '1', 'x-operator-id': VALID_OPERATOR_ID },
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(403);
            expect(JSON.parse(resp.body).error).toBe('tier_too_low');
        });
    });

    describe('Operator-id header gate', () => {
        it('returns 400 invalid_operator_id when x-operator-id header is missing', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: { 'x-operator-tier': '5' },
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
        });

        it('returns 400 invalid_operator_id when x-operator-id is invalid format (op:steward:default)', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: { 'x-operator-tier': '5', 'x-operator-id': 'op:steward:default' },
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
        });

        it('returns 400 invalid_operator_id when x-operator-id is a plain string', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: { 'x-operator-tier': '5', 'x-operator-id': 'not-an-op-id' },
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(400);
            expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
        });
    });

    describe('Body tier ignored (D-25b-NEW-1 body-trust rejection)', () => {
        it('returns 200 when valid headers provided even if body contains wrong tier', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: VALID_HEADERS,
                // Body claims H1 tier — must be silently ignored
                payload: { tier: 'H1', start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(200);
        });

        it('returns 200 when valid headers provided even if body omits tier entirely', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: VALID_HEADERS,
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(200);
        });
    });

    describe('operator.exported audit emit — operator_id sources from header', () => {
        it('emits operator.exported with operator_id from header, not body (T-25b-06-02)', async () => {
            const headerOpId = VALID_OPERATOR_ID;
            const bodyOpId = ATTACKER_OPERATOR_ID;
            const priorLength = audit.length;

            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: {
                    'x-operator-tier': '5',
                    'x-operator-id': headerOpId,
                },
                // Attacker tries to claim a different operator_id via body
                payload: { operator_id: bodyOpId, start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(200);

            const newEntries = audit.query({ eventType: 'operator.exported' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(1);

            const entry = newEntries[0];
            // Must use header operator_id, NOT body operator_id
            expect((entry.payload as { operator_id: string }).operator_id).toBe(headerOpId);
            expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
            // actorDid on the audit entry must also be the header value
            expect(entry.actorDid).toBe(headerOpId);
        });

        it('emits operator.exported only on success path (not on 403 tier_too_low)', async () => {
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: { 'x-operator-tier': '4', 'x-operator-id': VALID_OPERATOR_ID },
                payload: { start_tick: 1, end_tick: 2 },
            });
            const newEntries = audit.query({ eventType: 'operator.exported' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(0);
        });

        it('emits operator.exported only on success path (not on 401 tier_missing)', async () => {
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                // No tier header
                payload: { start_tick: 1, end_tick: 2 },
            });
            const newEntries = audit.query({ eventType: 'operator.exported' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(0);
        });

        it('emits operator.exported with tier H5 in audit payload', async () => {
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: VALID_HEADERS,
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(200);

            const newEntries = audit.query({ eventType: 'operator.exported' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(1);
            expect((newEntries[0].payload as { tier: string }).tier).toBe('H5');
        });
    });

    describe('Response headers on success', () => {
        it('returns X-Tarball-Hash header on 200', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: VALID_HEADERS,
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(200);
            expect(resp.headers['x-tarball-hash']).toBe(FAKE_TARBALL_HASH);
        });

        it('returns Content-Type application/octet-stream on 200', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                headers: VALID_HEADERS,
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(200);
            expect(resp.headers['content-type']).toContain('application/octet-stream');
        });
    });
});
