/**
 * Steward operator proxy — /api/operator/[...path]
 *
 * SECURITY 2026-07-09: the Grid's operator routes no longer trust the spoofable
 * x-operator-tier / x-operator-id headers. Operator identity + tier are derived
 * server-side from an authenticated Portal session whose DID is on the Grid's
 * GRID_OPERATOR_DIDS allowlist. This proxy therefore authenticates to the Grid as
 * the operator (server-only credentials) to obtain a fresh Portal-session cookie
 * and forwards THAT cookie — never a header.
 *
 * Why login-on-demand (not a static token): the Grid signs Portal sessions with an
 * in-process key that rotates on every Grid restart, so a pre-minted token would
 * break. We cache the session token and re-authenticate on a 401.
 *
 * Deploy requirements:
 *   - STEWARD_OPERATOR_EMAIL / STEWARD_OPERATOR_PASSWORD — a Grid Portal account whose
 *     DID is listed in the Grid's GRID_OPERATOR_DIDS allowlist (server-only env).
 *   - Without them, the proxy forwards no session → the Grid returns 401/403 (the
 *     console surfaces an auth error rather than silently "working").
 *
 * NOTE: verify end-to-end against a running Grid before relying on it in prod —
 * confirm the signin endpoint path + allowlist membership resolve the operator.
 */

import { NextRequest, NextResponse } from 'next/server';

const GRID_ORIGIN = process.env.GRID_ORIGIN ?? process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
const OPERATOR_EMAIL = process.env.STEWARD_OPERATOR_EMAIL ?? '';
const OPERATOR_PASSWORD = process.env.STEWARD_OPERATOR_PASSWORD ?? '';
const COOKIE_NAME = 'noesis_portal_token';

/** Cached operator Portal-session token (server-only; rotates with the Grid's key). */
let cachedToken: string | null = null;

/** Authenticate as the operator against the Grid and extract the session token. */
async function fetchOperatorToken(): Promise<string | null> {
    if (!OPERATOR_EMAIL || !OPERATOR_PASSWORD) return null;
    let res: Response;
    try {
        res = await fetch(`${GRID_ORIGIN}/api/v1/portal/auth/email/signin`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: OPERATOR_EMAIL, password: OPERATOR_PASSWORD }),
        });
    } catch {
        return null;
    }
    if (!res.ok) return null;
    const setCookie = res.headers.get('set-cookie') ?? '';
    const m = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    return m ? m[1] : null;
}

async function operatorToken(force = false): Promise<string | null> {
    if (!force && cachedToken) return cachedToken;
    cachedToken = await fetchOperatorToken();
    return cachedToken;
}

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
    const gridUrl = `${GRID_ORIGIN}/api/v1/operator/${path.join('/')}`;
    const contentType = req.headers.get('content-type');
    const body = req.method === 'POST' ? await req.text() : undefined;

    async function forward(token: string | null): Promise<Response> {
        const headers: Record<string, string> = {};
        if (token) headers['cookie'] = `${COOKIE_NAME}=${token}`;
        if (contentType) headers['content-type'] = contentType;
        return fetch(gridUrl, { method: req.method, headers, body });
    }

    let upstream = await forward(await operatorToken());
    // Session rotated/expired (Grid restart or TTL) → re-authenticate once.
    if (upstream.status === 401 && OPERATOR_EMAIL && OPERATOR_PASSWORD) {
        upstream = await forward(await operatorToken(true));
    }

    const responseBody = await upstream.text();
    return new NextResponse(responseBody, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
    const { path } = await params;
    return proxy(req, path);
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
    const { path } = await params;
    return proxy(req, path);
}
