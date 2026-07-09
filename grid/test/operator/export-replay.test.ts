/**
 * Regression tests for registerReplayExportRoute — operator-context auth (D-25b-NEW-1).
 *
 * SECURITY 2026-07-09: operator identity/tier now come from the server-trusted
 * operator_only gate (req.didContext.operatorTier/operatorId), simulated here by
 * withOperatorContext. Header-gate cases (tier_missing / invalid_operator_id) moved
 * to grid/test/api/operator-gate.test.ts.
 *
 * Tests verify:
 *   - context tier 4/1 → 403 tier_too_low
 *   - body {tier, operator_id} ignored — server context wins
 *   - operator.exported audit entry has operator_id === server context value (NOT body value)
 *   - operator.exported emitted on success path only
 *
 * Analog: grid/test/operator/cognitive-snapshot.test.ts (operator-context assertion pattern).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { registerReplayExportRoute } from '../../src/api/operator/export-replay.js';
import { withOperatorContext, TEST_OPERATOR_ID } from '../helpers/operator-session.js';
import type { GridServices } from '../../src/api/server.js';

// Server-trusted operator id (op:<uuid-v4> format), matches withOperatorContext default.
const VALID_OPERATOR_ID = TEST_OPERATOR_ID;
const ATTACKER_OPERATOR_ID = 'op:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

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

function buildTestApp(
    services: Partial<GridServices> & { audit: AuditChain },
    operatorTier?: number,
) {
    const app = Fastify({ logger: false });
    withOperatorContext(app, operatorTier !== undefined ? { tier: operatorTier } : undefined);
    registerReplayExportRoute(app, services as GridServices);
    return app;
}

function makeAuditWithEntries(audit: AuditChain) {
    // Seed some entries so slices can be non-empty
    audit.append('nous.spoke', 'did:noesis:agent001', { tick: 1 });
    audit.append('nous.spoke', 'did:noesis:agent001', { tick: 2 });
    return audit;
}

describe('POST /api/v1/operator/replay/export — operator-context auth (D-25b-NEW-1)', () => {
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

    describe('Tier gate (H5)', () => {
        it('returns 403 tier_too_low when operator context tier is 4', async () => {
            const app = buildTestApp(baseServices, 4);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(403);
            expect(JSON.parse(resp.body).error).toBe('tier_too_low');
        });

        it('returns 403 tier_too_low when operator context tier is 1', async () => {
            const app = buildTestApp(baseServices, 1);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(403);
            expect(JSON.parse(resp.body).error).toBe('tier_too_low');
        });
    });

    describe('Body auth fields ignored (D-25b-NEW-1 body-trust rejection)', () => {
        it('returns 200 with server context even if body contains wrong tier', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                // Body claims H1 tier — must be silently ignored
                payload: { tier: 'H1', start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(200);
        });

        it('returns 200 with server context even if body omits tier entirely', async () => {
            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(200);
        });
    });

    describe('operator.exported audit emit — operator_id from server context', () => {
        it('emits operator.exported with operator_id from server context, not body (T-25b-06-02)', async () => {
            const contextOpId = VALID_OPERATOR_ID; // server-trusted (withOperatorContext default)
            const bodyOpId = ATTACKER_OPERATOR_ID;
            const priorLength = audit.length;

            const app = buildTestApp(baseServices);
            const resp = await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                // Attacker tries to claim a different operator_id via body
                payload: { operator_id: bodyOpId, start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(200);

            const newEntries = audit.query({ eventType: 'operator.exported' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(1);

            const entry = newEntries[0];
            // Must use server-context operator_id, NOT body operator_id
            expect((entry.payload as { operator_id: string }).operator_id).toBe(contextOpId);
            expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
            // actorDid on the audit entry must also be the server-context value
            expect(entry.actorDid).toBe(contextOpId);
        });

        it('emits operator.exported only on success path (not on 403 tier_too_low)', async () => {
            const priorLength = audit.length;
            const app = buildTestApp(baseServices, 4);
            await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                payload: { start_tick: 1, end_tick: 2 },
            });
            const newEntries = audit.query({ eventType: 'operator.exported' }).filter(
                (e) => e.id > priorLength,
            );
            expect(newEntries).toHaveLength(0);
        });

        it('emits operator.exported only on success path (not on 400 invalid_start_tick)', async () => {
            const priorLength = audit.length;
            const app = buildTestApp(baseServices);
            await app.inject({
                method: 'POST',
                url: '/api/v1/operator/replay/export',
                // Malformed tick range → 400 before the audit append.
                payload: { start_tick: -1, end_tick: 2 },
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
                payload: { start_tick: 1, end_tick: 2 },
            });
            expect(resp.statusCode).toBe(200);
            expect(resp.headers['content-type']).toContain('application/octet-stream');
        });
    });
});
