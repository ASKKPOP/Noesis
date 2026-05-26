/**
 * Phase 36 Wave 0 — Polis bills ballot privacy test.
 *
 * D-36-15 / VOTE-05 invariant: GET /api/v1/polis/bills/:id for an unauthenticated
 * (visitor) request MUST expose tally totals but MUST NOT expose the ballots array
 * or any voter_did fields.
 *
 * // VOTE-05 invariant: ballot privacy preserved even at tally exposure (D-36-15)
 *
 * Tests fail RED until Plan 05 implements polis-bills.ts with the privacy stripping.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';

const GRID_NAME = 'genesis';

// Mock bill with ballots (ballots should be stripped from visitor response)
const mockBill = {
    id: 'bill-1',
    body: 'Proposal to establish a public library fund.',
    tally: { pass: 5, fail: 2, abstain: 1 },
    ballots: [
        { voter_did: 'did:civic:noesis:gen-001', choice: 'pass' },
        { voter_did: 'did:civic:noesis:gen-002', choice: 'fail' },
    ],
};

const mockPolisStore = {
    getBill: (id: string) => (id === 'bill-1' ? mockBill : null),
    listBills: () => [mockBill],
};

function buildTestServer(): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    // polisStore injected via GridServices in Plan 05
    return buildServer({
        clock, space, logos, audit, gridName: GRID_NAME,
        polisStore: mockPolisStore as unknown as never,
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

    it('GET /api/v1/polis/bills/bill-1 (visitor, no bearer) has tally but NO ballots array', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/polis/bills/bill-1',
            // No Authorization header — visitor tier
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);

        // VOTE-05 invariant: ballot privacy preserved even at tally exposure (D-36-15)

        // Tally MUST be present
        expect(body).toHaveProperty('tally');
        expect(body.tally).toHaveProperty('pass');
        expect(body.tally).toHaveProperty('fail');
        expect(body.tally).toHaveProperty('abstain');
        expect(body.tally.pass).toBe(5);
        expect(body.tally.fail).toBe(2);
        expect(body.tally.abstain).toBe(1);

        // Ballots MUST be absent
        expect(body.ballots).toBeUndefined();

        // No voter_did anywhere in the response
        expect(JSON.stringify(body)).not.toMatch(/voter_did|ballots/);
    });
});
