/**
 * /grid — server component.
 *
 * This file deliberately stays a server component (no 'use client'). Its only
 * job is to:
 *   1. Read `NEXT_PUBLIC_GRID_ORIGIN` at request time so the client never has
 *      to guess where the Grid lives.
 *   2. Best-effort fetch the initial region list so Plan 06's <RegionMap/>
 *      has seed data before the WebSocket subscription brings presence online.
 *      If the Grid is down on first visit the page still renders — the client
 *      reconnect loop + refill module cover the recovery path.
 *   3. Hand everything to <GridClient /> which boots the WsClient + stores.
 *
 * No auth tokens are rendered here; if a developer eventually wires bearer
 * auth for the Grid, that token should come from an http-only cookie read
 * on the server, not leaked through the props of the client shell.
 */

import React, { Suspense } from 'react';
import { GridClient } from './grid-client';
import { safeGridFetch } from '@/lib/server-grid-fetch';
import type { Region, RegionConnection } from '@/lib/protocol/region-types';

interface RegionsResponse {
    readonly regions: readonly Region[];
    readonly connections: readonly RegionConnection[];
}

async function fetchRegions(origin: string): Promise<RegionsResponse> {
    const body = await safeGridFetch<RegionsResponse>(
        `${origin}/api/v1/grid/regions`,
        { cache: 'no-store' },
    );
    if (!body || !Array.isArray(body.regions) || !Array.isArray(body.connections)) {
        throw new Error('Grid regions response malformed');
    }
    return body;
}

export default async function GridPage(): Promise<React.ReactElement> {
    const origin = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
    let initial: RegionsResponse | null = null;
    let initialError: string | null = null;
    try {
        initial = await fetchRegions(origin);
    } catch (err) {
        initialError = err instanceof Error ? err.message : 'Unknown fetch error';
    }
    return (
        <Suspense>
            <GridClient
                origin={origin}
                initialRegions={initial}
                initialError={initialError}
            />
        </Suspense>
    );
}
