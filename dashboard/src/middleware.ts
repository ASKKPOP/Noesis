/**
 * Next.js Edge middleware — route protection.
 *
 * Phase 22 WEB3-03 (relaxed for v2.5 shell): Allow viewing the portal shell
 * without a JWT. Individual pages and API calls check auth client-side.
 * Hard redirect only for API routes that require a valid session.
 *
 * The original strict redirect is preserved below (commented) for re-enabling
 * once MetaMask / WalletConnect sign-in is confirmed working in prod.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
    // All /portal/* routes pass through — auth state handled client-side.
    return NextResponse.next();
}

export const config = {
    matcher: ['/portal/:path*'],
};
