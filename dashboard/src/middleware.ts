/**
 * Next.js Edge middleware — route protection.
 *
 * Phase 22 WEB3-03: Protect /portal/* routes. Redirect to /portal/auth
 * if the JWT cookie is absent.
 *
 * Note: The cookie presence check is intentionally lightweight for v2.5.
 * Full JWT signature verification at the Edge would require embedding the
 * public key in the middleware bundle — deferred to a later phase. The
 * Grid's /me endpoint performs full JWT validation on each API call.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'noesis_portal_token';
const AUTH_PATH = '/portal/auth';

export function middleware(request: NextRequest): NextResponse {
    const { pathname } = request.nextUrl;

    // Protect /portal/* but not /portal/auth itself (avoid redirect loop).
    if (pathname.startsWith('/portal') && !pathname.startsWith(AUTH_PATH)) {
        const token = request.cookies.get(COOKIE_NAME);
        if (!token) {
            const authUrl = new URL(AUTH_PATH, request.url);
            return NextResponse.redirect(authUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/portal/:path*'],
};
