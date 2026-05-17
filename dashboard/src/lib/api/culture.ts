/**
 * culture — typed REST wrappers around the Grid's culture endpoints
 * (Phase 21, D-21-03).
 *
 * Error model follows the same pattern as relationships.ts (T-04-22):
 *   - Non-2xx HTTP → throws with fetchError: { kind: 'http', status }
 *   - Network failure → throws with fetchError: { kind: 'network', status: 0 }
 *   - AbortError is re-thrown so SWR can distinguish stale-cancel from failure.
 *
 * T-21-03-01: NEXT_PUBLIC_GRID_ORIGIN is intentionally public (Grid server origin,
 *   not a secret). Pattern established Phase 9.
 * T-21-03-02: LoreCitation type cast validates structure at compile time; runtime
 *   fields are Grid-sole-produced (citing_did DID, content_hash hex, tick number).
 */

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface SkillLineageResponse {
    nodes: Array<{ id: string; label: string; type: 'nous' | 'skill'; x: number; y: number }>;
    edges: Array<{ source: string; target: string; tick: number; type: 'taught' | 'inferred' }>;
}

export interface NormRecord {
    norm_id: string;
    fingerprint: string;
    crystallized_tick: number;
    participant_count: number;
    convergence_type: 'emergent' | 'coincidental';
    evidence_tick_range: [number, number];
}

export interface NormsResponse {
    norms: NormRecord[];
}

export interface LoreEntry {
    contributor_did: string;
    tick: number;
    content_hash: string;
    category_tag: string;
    citation_count: number;
}

export interface LoreEntriesResponse {
    entries: LoreEntry[];
    total: number;
}

export interface LoreCitation {
    citing_did: string;
    content_hash: string;
    tick: number;
}

export interface LoreCitationsResponse {
    entries: LoreCitation[];
}

/** Combined type used by useLoreGraph (composed in the hook, not fetched directly). */
export interface LoreGraphData {
    loreEntries: LoreEntry[];
    loreCitations: LoreCitation[];
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const GRID_ORIGIN = (): string =>
    process.env.NEXT_PUBLIC_GRID_ORIGIN ?? '';

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/grid/culture/skills/lineage
 * Returns skill lineage graph with nodes and directed edges.
 */
export async function fetchSkillLineage(signal?: AbortSignal): Promise<SkillLineageResponse> {
    let resp: Response;
    try {
        resp = await fetch(
            `${GRID_ORIGIN()}/api/v1/grid/culture/skills/lineage`,
            { signal, headers: { accept: 'application/json' } },
        );
    } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
        throw Object.assign(new Error('network'), { fetchError: { kind: 'network', status: 0 } });
    }
    if (!resp.ok) {
        let body: { error?: string } = {};
        try { body = (await resp.json()) as { error?: string }; } catch { /* ignore */ }
        throw Object.assign(new Error(body.error ?? `HTTP ${resp.status}`), {
            fetchError: { kind: 'http', status: resp.status },
        });
    }
    return (await resp.json()) as SkillLineageResponse;
}

/**
 * GET /api/v1/grid/norms
 * Returns list of crystallized norms.
 */
export async function fetchNorms(signal?: AbortSignal): Promise<NormsResponse> {
    let resp: Response;
    try {
        resp = await fetch(
            `${GRID_ORIGIN()}/api/v1/grid/norms`,
            { signal, headers: { accept: 'application/json' } },
        );
    } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
        throw Object.assign(new Error('network'), { fetchError: { kind: 'network', status: 0 } });
    }
    if (!resp.ok) {
        let body: { error?: string } = {};
        try { body = (await resp.json()) as { error?: string }; } catch { /* ignore */ }
        throw Object.assign(new Error(body.error ?? `HTTP ${resp.status}`), {
            fetchError: { kind: 'http', status: resp.status },
        });
    }
    return (await resp.json()) as NormsResponse;
}

/**
 * GET /api/v1/grid/lore
 * Returns lore entry list with total count.
 */
export async function fetchLoreEntries(signal?: AbortSignal): Promise<LoreEntriesResponse> {
    let resp: Response;
    try {
        resp = await fetch(
            `${GRID_ORIGIN()}/api/v1/grid/lore`,
            { signal, headers: { accept: 'application/json' } },
        );
    } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
        throw Object.assign(new Error('network'), { fetchError: { kind: 'network', status: 0 } });
    }
    if (!resp.ok) {
        let body: { error?: string } = {};
        try { body = (await resp.json()) as { error?: string }; } catch { /* ignore */ }
        throw Object.assign(new Error(body.error ?? `HTTP ${resp.status}`), {
            fetchError: { kind: 'http', status: resp.status },
        });
    }
    return (await resp.json()) as LoreEntriesResponse;
}

/**
 * GET /api/v1/audit/trail?type=lore.cited
 * Returns audit entries for lore.cited events; each entry's payload is a LoreCitation.
 * The audit trail endpoint returns { entries: AuditEntry[], total: number }.
 * We extract the payload from each entry and return { entries: LoreCitation[] }.
 */
export async function fetchLoreCitations(signal?: AbortSignal): Promise<LoreCitationsResponse> {
    let resp: Response;
    try {
        resp = await fetch(
            `${GRID_ORIGIN()}/api/v1/audit/trail?type=lore.cited`,
            { signal, headers: { accept: 'application/json' } },
        );
    } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
        throw Object.assign(new Error('network'), { fetchError: { kind: 'network', status: 0 } });
    }
    if (!resp.ok) {
        let body: { error?: string } = {};
        try { body = (await resp.json()) as { error?: string }; } catch { /* ignore */ }
        throw Object.assign(new Error(body.error ?? `HTTP ${resp.status}`), {
            fetchError: { kind: 'http', status: resp.status },
        });
    }
    const raw = (await resp.json()) as { entries: Array<{ payload: LoreCitation }> };
    return { entries: raw.entries.map((e) => e.payload) };
}
