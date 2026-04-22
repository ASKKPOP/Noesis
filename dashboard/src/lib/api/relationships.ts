/**
 * relationships — typed REST wrappers around the Grid's tier-graded
 * relationship endpoints (Phase 9, D-9-06).
 *
 * Error model (mirrors introspect.ts pattern, T-04-22):
 *   - 400 → invalid_did | self_loop
 *   - 403 → tier_insufficient
 *   - 404 → unknown_nous | edge_not_found
 *   - any other non-2xx or fetch rejection → network
 *   - AbortError is re-thrown so callers can distinguish stale-cancel from failure.
 *
 * Raw server error strings are NEVER rendered (T-04-22, T-09-25). All errors
 * are mapped to the RelationshipsFetchError discriminated union.
 */

// ---------------------------------------------------------------------------
// Response shapes (per 09-04-SUMMARY.md endpoint contract)
// ---------------------------------------------------------------------------

export interface RelationshipsH1Response {
    did: string;
    edges: Array<{
        counterparty_did: string;
        warmth_bucket: 'cold' | 'warm' | 'hot';
        recency_tick: number;
        edge_hash: string;
    }>;
    observed_at_tick: number;
    top_n: number;
}

export interface RelationshipsH2Response {
    did: string;
    edges: Array<{
        counterparty_did: string;
        valence: number;
        weight: number;
        recency_tick: number;
        last_event_hash: string;
        warmth_bucket?: 'cold' | 'warm' | 'hot';
        edge_hash?: string;
    }>;
    observed_at_tick: number;
    top_n: number;
}

export interface EdgeEventsResponse {
    edge_key: string;
    events: Array<{
        tick: number;
        type: 'nous.spoke' | 'trade.settled' | 'trade.reviewed' | 'telos.refined';
        payload: Record<string, unknown>;
    }>;
}

export interface GraphResponse {
    nodes: Array<{ did: string; x: number; y: number }>;
    edges: Array<{
        source_did: string;
        target_did: string;
        warmth_bucket: 'cold' | 'warm' | 'hot';
    }>;
    observed_at_tick: number;
}

// ---------------------------------------------------------------------------
// Error discriminated union (T-09-25 — raw server strings never escape)
// ---------------------------------------------------------------------------

export type RelationshipsFetchError =
    | { kind: 'invalid_did'; status: 400 }
    | { kind: 'unknown_nous'; status: 404 }
    | { kind: 'edge_not_found'; status: 404 }
    | { kind: 'self_loop'; status: 400 }
    | { kind: 'tier_insufficient'; status: 403 }
    | { kind: 'network'; status: 0 };

// Map HTTP status codes to error kinds for JSON error body parsing.
function statusToKind(
    status: number,
    body: { error?: string },
): RelationshipsFetchError {
    if (status === 400) {
        return body.error === 'self_loop'
            ? { kind: 'self_loop', status: 400 }
            : { kind: 'invalid_did', status: 400 };
    }
    if (status === 403) return { kind: 'tier_insufficient', status: 403 };
    if (status === 404) {
        return body.error === 'edge_not_found'
            ? { kind: 'edge_not_found', status: 404 }
            : { kind: 'unknown_nous', status: 404 };
    }
    return { kind: 'network', status: 0 };
}

const GRID_ORIGIN = (): string =>
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GRID_ORIGIN) ?? '';

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * H1 — GET /api/v1/nous/:did/relationships
 * Returns top-N partners with warmth bucket labels only (no numeric values).
 */
export async function fetchRelationshipsH1(
    did: string,
    signal?: AbortSignal,
): Promise<RelationshipsH1Response> {
    let resp: Response;
    try {
        resp = await fetch(
            `${GRID_ORIGIN()}/api/v1/nous/${encodeURIComponent(did)}/relationships`,
            { signal, headers: { accept: 'application/json' } },
        );
    } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
        throw Object.assign(new Error('network'), { fetchError: { kind: 'network', status: 0 } as RelationshipsFetchError });
    }

    if (!resp.ok) {
        let body: { error?: string } = {};
        try { body = (await resp.json()) as { error?: string }; } catch { /* ignore */ }
        const fe = statusToKind(resp.status, body);
        throw Object.assign(new Error(fe.kind), { fetchError: fe });
    }

    return (await resp.json()) as RelationshipsH1Response;
}

/**
 * H2 — POST /api/v1/nous/:did/relationships/inspect
 * Returns numeric valence/weight per edge (Reviewer tier).
 */
export async function fetchRelationshipsH2(
    did: string,
    tier: 'H2',
    signal?: AbortSignal,
): Promise<RelationshipsH2Response> {
    let resp: Response;
    try {
        resp = await fetch(
            `${GRID_ORIGIN()}/api/v1/nous/${encodeURIComponent(did)}/relationships/inspect`,
            {
                method: 'POST',
                signal,
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({ tier }),
            },
        );
    } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
        throw Object.assign(new Error('network'), { fetchError: { kind: 'network', status: 0 } as RelationshipsFetchError });
    }

    if (!resp.ok) {
        let body: { error?: string } = {};
        try { body = (await resp.json()) as { error?: string }; } catch { /* ignore */ }
        const fe = statusToKind(resp.status, body);
        throw Object.assign(new Error(fe.kind), { fetchError: fe });
    }

    return (await resp.json()) as RelationshipsH2Response;
}

/**
 * H5 — GET /api/v1/operator/relationships/:edge_key/events?tier=H5&operator_id=...
 * Returns raw audit-chain dialogue turns for one edge (D-9-06 canonical GET route).
 */
export async function fetchEdgeEvents(
    edgeKey: string,
    operatorId: string,
    signal?: AbortSignal,
): Promise<EdgeEventsResponse> {
    let resp: Response;
    const params = new URLSearchParams({ tier: 'H5', operator_id: operatorId });
    try {
        resp = await fetch(
            `${GRID_ORIGIN()}/api/v1/operator/relationships/${encodeURIComponent(edgeKey)}/events?${params.toString()}`,
            { signal, headers: { accept: 'application/json' } },
        );
    } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
        throw Object.assign(new Error('network'), { fetchError: { kind: 'network', status: 0 } as RelationshipsFetchError });
    }

    if (!resp.ok) {
        let body: { error?: string } = {};
        try { body = (await resp.json()) as { error?: string }; } catch { /* ignore */ }
        const fe = statusToKind(resp.status, body);
        throw Object.assign(new Error(fe.kind), { fetchError: fe });
    }

    return (await resp.json()) as EdgeEventsResponse;
}

/**
 * Graph — GET /api/v1/grid/relationships/graph
 * Returns full grid topology with server-computed {x, y} positions.
 */
export async function fetchGraph(signal?: AbortSignal): Promise<GraphResponse> {
    let resp: Response;
    try {
        resp = await fetch(
            `${GRID_ORIGIN()}/api/v1/grid/relationships/graph`,
            { signal, headers: { accept: 'application/json' } },
        );
    } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
        throw Object.assign(new Error('network'), { fetchError: { kind: 'network', status: 0 } as RelationshipsFetchError });
    }

    if (!resp.ok) {
        let body: { error?: string } = {};
        try { body = (await resp.json()) as { error?: string }; } catch { /* ignore */ }
        const fe = statusToKind(resp.status, body);
        throw Object.assign(new Error(fe.kind), { fetchError: fe });
    }

    return (await resp.json()) as GraphResponse;
}
