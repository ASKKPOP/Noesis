/**
 * Phase 40 — Steward → Brain HTTP proxy (D-40-04)
 * Server-side proxy that forwards Steward requests to the local Brain HTTP server.
 * Injects X-Brain-Secret header server-side — never exposed to client bundle (Pitfall 5).
 *
 * Routes:
 *   GET /api/brain/local-ai/models → Brain /local-ai/models
 *   GET /api/brain/local-ai/status → Brain /local-ai/status
 *
 * Env vars (server-side only — no NEXT_PUBLIC_ prefix):
 *   BRAIN_HTTP_URL     — Brain HTTP server URL (default: http://localhost:8090)
 *   BRAIN_HTTP_SECRET  — X-Brain-Secret header value
 */

import { NextRequest, NextResponse } from 'next/server';

const BRAIN_HTTP_URL = process.env.BRAIN_HTTP_URL ?? 'http://localhost:8090';
const BRAIN_HTTP_SECRET = process.env.BRAIN_HTTP_SECRET ?? '';

async function proxyBrain(path: string[]): Promise<NextResponse> {
    const brainUrl = `${BRAIN_HTTP_URL}/${path.join('/')}`;
    try {
        const upstream = await fetch(brainUrl, {
            method: 'GET',
            headers: {
                'X-Brain-Secret': BRAIN_HTTP_SECRET,
            },
        });
        const responseBody = await upstream.text();
        return new NextResponse(responseBody, {
            status: upstream.status,
            headers: {
                'content-type': upstream.headers.get('content-type') ?? 'application/json',
            },
        });
    } catch (err) {
        // Brain offline — return graceful error for Steward to show degraded state
        return NextResponse.json(
            { error: 'brain_unreachable', message: String(err) },
            { status: 503 },
        );
    }
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
    const { path } = await params;
    return proxyBrain(path);
}
