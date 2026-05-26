// D-36-16 three-tier visitor model. Phase 36 dashboard ships anonymous/human_visitor branches; civic_member upgrade requires per-Grid DID check (Phase 56).

import { cookies } from 'next/headers';

export type VisitorTier = 'anonymous' | 'human_visitor' | 'civic_member';

/**
 * Server-side visitor tier resolution from session cookie.
 *
 * Reads the `noesis_portal_token` cookie. If absent → anonymous.
 * If present and non-empty → human_visitor (Phase 36 simplified check).
 * civic_member upgrade requires per-Grid Civic-DID verification — wired in Phase 56.
 *
 * Phase 36 does NOT call jwtVerify because the Grid public key resolution is not
 * yet available in the dashboard. The presence of any non-empty cookie value is
 * treated as a valid human_visitor session. Real verification lands in Phase 56.
 */
export async function resolveVisitorTier(): Promise<{ tier: VisitorTier; displayName?: string }> {
    const cookieStore = await cookies();
    const token = cookieStore.get('noesis_portal_token');

    if (!token || !token.value) {
        return { tier: 'anonymous' };
    }

    // Phase 36 stub: any non-empty cookie = human_visitor.
    // Phase 56 will call jwtVerify against Grid public key and upgrade to civic_member
    // if the payload contains a valid Civic-DID for this Grid.
    return { tier: 'human_visitor', displayName: 'visitor' };
}
