/**
 * Polis bills route — Phase 36 VIS-01 / D-36-15 + VOTE-05.
 *
 * ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts
 *
 * // VOTE-05 invariant: ballots array MUST NOT appear in visitor response (D-36-15).
 * // Reconstruct from PUBLIC_KEYS allowlist.
 *
 * GET /api/v1/polis/bills          → {bills: PolisBill[]}
 * GET /api/v1/polis/bills/:id      → PolisBill (single)
 *
 * QA fix (ISSUE-002): the Phase 36 stub (services.polisStore) was never wired
 * anywhere — this route always returned {bills: []}, even with real bills in
 * gov_bills. Now reads from the real Phase 46 GovBillStore (services.govStore,
 * mirroring gov.ts's resolveStore), same as every other Polis/gov route.
 *
 * VOTE-05 / D-36-15: visitor sees tally totals after 'tallied' status,
 * but NEVER individual ballots or voter_did fields. Response is reconstructed
 * from an explicit PUBLIC_KEYS allowlist — source object is never spread.
 */

import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { MySqlGovBillStore, type GovBillStore, type BillRow, type BillStatus } from '../../gov/gov-bill-store.js';

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/** Prefer an injected store (tests); otherwise build a MySQL-backed one — mirrors gov.ts. */
function resolveStore(services: GridServices): GovBillStore | null {
    if (services.govStore) return services.govStore;
    if (services.pool) return new MySqlGovBillStore(services.pool, services.gridName);
    return null;
}

/** BillStatus (drafted/cosponsored/in_session/enacted/rejected/withdrawn) has no 1:1
 *  mapping to the visitor-facing session_status enum — approximate the pipeline stage. */
function toSessionStatus(status: BillStatus): PolisBill['session_status'] {
    switch (status) {
        case 'drafted':
        case 'cosponsored': return 'drafting';
        case 'in_session': return 'debate';
        default: return 'tallied'; // enacted, rejected, withdrawn — session has closed
    }
}

function billRowToRaw(bill: BillRow): Record<string, unknown> {
    return {
        id: bill.bill_id,
        title: bill.title,
        body_summary: bill.body_text.slice(0, 280),
        sponsor_civic_did_hash: sha256Hex(bill.author_civic_did),
        cosponsors_count: bill.cosponsor_count,
        session_status: toSessionStatus(bill.status),
    };
}

/**
 * Visitor-visible bill shape.
 * 9 PUBLIC_KEYS: id, title, body_summary, sponsor_civic_did_hash, sponsor_display_name,
 * cosponsors_count, session_status, scheduled_open_tick, tally.
 */
export interface PolisBill {
    id: string;
    title: string;
    body_summary: string;
    sponsor_civic_did_hash: string;
    sponsor_display_name: string;
    cosponsors_count: number;
    session_status: 'drafting' | 'debate' | 'voted' | 'tallied';
    scheduled_open_tick?: number;
    tally?: { pass: number; fail: number; abstain: number };
}

/**
 * The 9 PUBLIC_KEYS fields that may appear in the visitor response.
 * Response is reconstructed from ONLY these keys — no spread from source.
 * This is the primary VOTE-05 enforcement mechanism.
 */
const PUBLIC_KEYS = [
    'id',
    'title',
    'body_summary',
    'sponsor_civic_did_hash',
    'sponsor_display_name',
    'cosponsors_count',
    'session_status',
    'scheduled_open_tick',
    'tally',
] as const;

type PublicKey = (typeof PUBLIC_KEYS)[number];

/**
 * Reconstruct a visitor-safe bill from a raw source object.
 * Explicitly picks only PUBLIC_KEYS — any extra fields (including ballots,
 * voter_did, or any ballot-related field) are structurally excluded.
 */
function toPublicBill(raw: Record<string, unknown>): PolisBill {
    const bill = {} as Record<PublicKey, unknown>;
    for (const key of PUBLIC_KEYS) {
        if (key in raw) {
            bill[key] = raw[key];
        }
    }
    return bill as unknown as PolisBill;
}

export function registerPolisBillsRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    // GET /api/v1/polis/bills — list all bills (visitor view, VOTE-05 filtered)
    app.get('/api/v1/polis/bills', async (_req, reply) => {
        const store = resolveStore(services);
        if (!store) return reply.code(503).send({ error: 'polis_unavailable' });
        const rawBills = await store.listBills();
        const bills = rawBills.map(b => toPublicBill(billRowToRaw(b)));
        return { bills };
    });

    // GET /api/v1/polis/bills/:id — single bill (visitor view, VOTE-05 filtered)
    app.get<{ Params: { id: string } }>('/api/v1/polis/bills/:id', async (req, reply) => {
        const store = resolveStore(services);
        if (!store) return reply.code(503).send({ error: 'polis_unavailable' });
        const bill = await store.getBill(req.params.id);
        if (!bill) {
            reply.code(404);
            return { error: 'bill_not_found' };
        }
        return toPublicBill(billRowToRaw(bill));
    });
}
