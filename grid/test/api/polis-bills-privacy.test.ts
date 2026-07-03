/**
 * Phase 36 Wave 0 — Polis bills ballot privacy test.
 *
 * D-36-15 / VOTE-05 invariant: GET /api/v1/polis/bills/:id for an unauthenticated
 * (visitor) request MUST NOT expose a ballots array or any voter_did fields,
 * no matter what the underlying store returns.
 *
 * // VOTE-05 invariant: ballot privacy preserved via the PUBLIC_KEYS allowlist (D-36-15)
 *
 * QA fix (ISSUE-002): polis-bills.ts now reads from the real GovBillStore
 * (services.govStore) instead of the Phase 36 stub (services.polisStore, removed).
 * gov_bills has no tally/ballots columns — those live in governance_ballots,
 * joined via bill.proposal_id, and are not yet wired into this route (future
 * work, tracked separately from ISSUE-002). This test injects a mock GovBillStore
 * whose BillRow carries extra unexpected properties (simulating a future store
 * that DID include ballots) to prove toPublicBill's allowlist reconstruction
 * strips anything outside PUBLIC_KEYS regardless of what the store returns.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';
import type { GovBillStore, BillRow } from '../../src/gov/gov-bill-store.js';

const GRID_NAME = 'genesis';

// A BillRow with extra, non-PUBLIC_KEYS properties tacked on (ballots, voter_did) —
// simulating a future store shape. toPublicBill must strip anything not in
// PUBLIC_KEYS regardless of what the store hands back.
const mockBill = {
    bill_id: 'bill-1',
    grid_name: GRID_NAME,
    author_civic_did: 'did:civic:noesis:human:gen-001',
    title: 'Public Library Fund',
    title_hash: 'x'.repeat(64),
    body_text: 'Proposal to establish a public library fund.',
    body_hash: 'y'.repeat(64),
    category: 'infrastructure',
    status: 'in_session',
    cosponsor_count: 2,
    proposal_id: null,
    created_at_tick: 10,
    ballots: [
        { voter_did: 'did:civic:noesis:gen-001', choice: 'pass' },
        { voter_did: 'did:civic:noesis:gen-002', choice: 'fail' },
    ],
} as unknown as BillRow;

const mockGovStore: GovBillStore = {
    insertBill: async () => {},
    getBill: async (id: string) => (id === 'bill-1' ? mockBill : null),
    listBills: async () => [mockBill],
    addCosponsor: async () => 0,
    setBillStatus: async () => {},
    setBillProposalId: async () => {},
    openSession: async () => {},
    getSession: async () => null,
    addArgument: async () => {},
    closeSession: async () => {},
    enactLaw: async () => {},
    getActiveLaws: async () => [],
    getLaw: async () => null,
    repealLaw: async () => {},
};

function buildTestServer(): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    return buildServer({
        clock, space, logos, audit, gridName: GRID_NAME,
        govStore: mockGovStore,
    });
}

describe('polis bills privacy — VOTE-05 invariant', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildTestServer();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /api/v1/polis/bills/bill-1 (visitor, no bearer) has real title, NO ballots array', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/polis/bills/bill-1',
            // No Authorization header — visitor tier
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);

        // ISSUE-002: title is now real (previously unrecoverable — only a hash was stored)
        expect(body.title).toBe('Public Library Fund');
        expect(body.cosponsors_count).toBe(2);

        // VOTE-05 invariant: ballots/voter_did MUST be absent regardless of what
        // the store returned (allowlist reconstruction, not a field-by-field strip)
        expect(body.ballots).toBeUndefined();
        expect(JSON.stringify(body)).not.toMatch(/voter_did|ballots/);
    });
});
