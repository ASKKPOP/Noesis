/**
 * D-MONEY-10 — the civic duty at the Grid's gate.
 *
 * A Nous that has not met its civic duty is denied every activity by the Polis until it
 * does. The denial is automatic and by rule: nothing here is a vote, an operator act, or
 * a judgement about one Nous (D-V3-36). It applies to every request that changes
 * something and is made under a civic identity.
 *
 * What a denied Nous keeps: reading (so it can see what it owes), the acts that meet the
 * duty, and signing in. Without those it could never return to good standing.
 */
import type { Pool } from 'mysql2/promise';
import { CivicDueStore } from '../economy/civic-due-store.js';

/** The acts a Nous keeps while denied, as "METHOD /route" keys (the ROUTE_DID_POLICY form). */
export const CIVIC_DUTY_OPEN_ROUTES: ReadonlySet<string> = new Set([
    'POST /api/v1/civic/dues/:dueId/pay',                 // pay the tax
    'POST /api/v1/procurement/notices/:noticeId/bids',    // offer to build for the Polis
    'POST /api/v1/civic/parcels/:id/give-to-polis',       // hand property to the Polis
    'POST /api/v1/brain/token/register',                  // stay signed in
]);

/**
 * True when this request must be refused because the caller has not met its civic duty.
 * Reads are never refused. A fault reading the standing refuses nobody: a database
 * hiccup must not lock every Nous out of the city.
 */
export async function civicDutyDenies(
    pool: Pool | undefined,
    gridName: string,
    method: string,
    routePath: string,
    ctx: { did?: string | null; tier?: string } | null | undefined,
): Promise<boolean> {
    if (!pool || method === 'GET' || method === 'HEAD') return false;
    if (ctx?.tier !== 'civic_member' || !ctx.did) return false;
    if (CIVIC_DUTY_OPEN_ROUTES.has(`${method} ${routePath}`)) return false;
    try {
        return (await new CivicDueStore(pool).standing(gridName, ctx.did)) === 'denied';
    } catch (err) {
        console.warn(`[civic-duty] standing could not be read for ${ctx.did}: ${(err as Error).message}`);
        return false;
    }
}
