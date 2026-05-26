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
 * Phase 36 STUB — Phase 46 (Polis) wires real bill data.
 *
 * VOTE-05 / D-36-15: visitor sees tally totals after 'tallied' status,
 * but NEVER individual ballots or voter_did fields. Response is reconstructed
 * from an explicit PUBLIC_KEYS allowlist — source object is never spread.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

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
    app.get('/api/v1/polis/bills', async (_req, _reply) => {
        const polisStore = services.polisStore;
        if (!polisStore) {
            // PHASE-36 STUB — Phase 46 wires real Polis bill store.
            return { bills: [] };
        }
        const rawBills = polisStore.listBills() as Array<Record<string, unknown>>;
        const bills = rawBills.map(toPublicBill);
        return { bills };
    });

    // GET /api/v1/polis/bills/:id — single bill (visitor view, VOTE-05 filtered)
    app.get<{ Params: { id: string } }>('/api/v1/polis/bills/:id', async (req, reply) => {
        const polisStore = services.polisStore;
        if (!polisStore) {
            // PHASE-36 STUB — Phase 46 wires real Polis bill store.
            return {};
        }
        const raw = polisStore.getBill(req.params.id) as Record<string, unknown> | null;
        if (!raw) {
            reply.code(404);
            return { error: 'bill_not_found' };
        }
        return toPublicBill(raw);
    });
}
