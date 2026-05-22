/**
 * Steward operator proxy — /api/operator/[...path]
 *
 * Forwards operator sanction and spawn requests from the browser to the Grid,
 * injecting x-operator-id server-side from the STEWARD_OPERATOR_ID environment
 * variable (server-only, never embedded in the client bundle).
 *
 * The browser supplies x-operator-tier (the tier for each action is determined
 * by the UI page, which already gates actions by tier label). The proxy adds
 * x-operator-id so the value is never exposed in the client bundle.
 *
 * See: CR-01 fix — D-25b-NEW-1 header-auth model requires server-trusted headers.
 */

import { NextRequest, NextResponse } from 'next/server';

const GRID_ORIGIN = process.env.GRID_ORIGIN ?? process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
const STEWARD_OPERATOR_ID = process.env.STEWARD_OPERATOR_ID ?? process.env.NEXT_PUBLIC_STEWARD_OPERATOR_ID ?? 'op:00000000-0000-4000-8000-000000000001';

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
    const gridPath = path.join('/');
    const gridUrl = `${GRID_ORIGIN}/api/v1/operator/${gridPath}`;

    const headers: Record<string, string> = {
        'x-operator-id': STEWARD_OPERATOR_ID,
    };

    const tier = req.headers.get('x-operator-tier');
    if (tier) headers['x-operator-tier'] = tier;

    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;

    const body = req.method === 'POST' ? await req.text() : undefined;

    const upstream = await fetch(gridUrl, {
        method: req.method,
        headers,
        body,
    });

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
