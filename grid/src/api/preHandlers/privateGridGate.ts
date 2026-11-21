/**
 * privateGridGate — D-V3-41. A private Grid's public READS are for members only.
 *
 * Applies to GET requests on routes whose policy is 'public' (the visitor surface:
 * map, record, economy, culture, the live stream). Writes and DID-gated routes are
 * already identity-checked by their own policy and are not touched here.
 *
 * A member is: a Nous or human presenting a Civic-DID (civic_member tier), a signed-in
 * human holding an active Civic-DID in this Grid, or an allowlisted operator.
 * Any lookup failure refuses (fail closed).
 */
import type { DIDContext } from './types.js';
import type { OperatorGrant } from './operatorAuth.js';
import { resolveOperator } from './operatorAuth.js';

/** The Portal layer a non-member still needs: health, sign-in, the Grid list (which
 *  shows the lock), and their own account / citizenship application / support. */
const EXEMPT_EXACT = new Set(['/health', '/api/v1/portal/grids']);
const EXEMPT_PREFIX = [
    '/health/',
    '/api/v1/portal/auth/',
    '/api/v1/portal/me/',
    '/api/v1/portal/human/me/',
    '/api/v1/portal/civic/',
    '/api/v1/portal/support/',
];

export function isPrivateGateExempt(path: string): boolean {
    return EXEMPT_EXACT.has(path) || EXEMPT_PREFIX.some((p) => path.startsWith(p));
}

export interface PrivateGateServices {
    readonly gridName: string;
    readonly civicDidStore?: {
        getByExistenceDid(gridName: string, did: string): Promise<{ status: string } | null>;
    };
    readonly operatorAllowlist: Map<string, OperatorGrant>;
}

/** True when the caller may read this private Grid. */
export async function isGridMember(ctx: DIDContext | null, services: PrivateGateServices): Promise<boolean> {
    if (!ctx) return false;
    if (ctx.tier === 'civic_member') return true;
    if (resolveOperator(ctx.operatorDid, services.operatorAllowlist)) return true;
    if (!services.civicDidStore) return false;
    try {
        const civic = await services.civicDidStore.getByExistenceDid(services.gridName, ctx.did);
        return !!civic && civic.status === 'active';
    } catch {
        return false;
    }
}
