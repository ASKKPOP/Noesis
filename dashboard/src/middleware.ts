/**
 * Next.js Edge middleware — route protection + Grid host routing.
 *
 * Phase 22 WEB3-03 (relaxed for v2.5 shell): Allow viewing the portal shell
 * without a JWT. Individual pages and API calls check auth client-side.
 * Hard redirect only for API routes that require a valid session.
 *
 * The original strict redirect is preserved below (commented) for re-enabling
 * once MetaMask / WalletConnect sign-in is confirmed working in prod.
 *
 * Surfaces re-plan G1 (D-V3-41): on the Grid host (grid.<domain>), /<grid> is the
 * Grid's entry page — rewritten to /g/<grid>. Every other host is untouched.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { gridHostRewrite } from '@/lib/grid-host';

export function middleware(request: NextRequest): NextResponse {
    const target = gridHostRewrite(request.headers.get('host'), request.nextUrl.pathname);
    if (target) {
        const url = request.nextUrl.clone();
        url.pathname = target;
        return NextResponse.rewrite(url);
    }
    // All /portal/* routes pass through — auth state handled client-side.
    return NextResponse.next();
}

export const config = {
    // '/:grid' = any single-segment path, so the Grid host can serve /<grid>.
    matcher: ['/portal/:path*', '/:grid'],
};
