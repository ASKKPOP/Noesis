/**
 * System Map — dashboard API client for the live aggregate read on the Grid.
 *
 * GET {NEXT_PUBLIC_GRID_ORIGIN}/api/v1/system/map
 *
 * PUBLIC read — no auth headers, no credentials. Mirrors portal-manager.ts error
 * discipline: non-2xx maps to a discriminated-union error exposing only `kind`;
 * a fetch rejection → network. AbortError is re-thrown so callers can ignore it.
 *
 * The response is aggregate-only (counts, a treasury balance string, a fee-rate
 * percent, a tick) — no DIDs/PII. Every field below is BOUND into the view; nothing
 * is hardcoded there.
 */

const GRID_ORIGIN = (): string => process.env.NEXT_PUBLIC_GRID_ORIGIN ?? '';

export type SurfaceStatus = 'up' | 'degraded' | 'down' | 'empty';
export type InstitutionStatus = 'active' | 'empty' | 'down' | 'unknown';

export interface GridSurface {
    status: SurfaceStatus;
    metric: number | null;
    headline: string;
    tick: number;
    client_count: number;
    chain_valid: boolean;
}
export interface PortalSurface {
    status: SurfaceStatus;
    metric: number | null;
    headline: string;
    pending: number;
    approved: number;
    rejected: number;
    total: number;
}
export interface StewardSurface {
    status: 'up' | 'down';
    metric: string | null;
    headline: string;
}
export interface BrainSurface {
    status: SurfaceStatus;
    metric: number | null;
    headline: string;
    total: number;
    unowned: number;
    active: number;
}

export interface RegistryItem {
    status: InstitutionStatus; metric: number | null; headline: string;
    civic_active: number; nous_active: number;
}
export interface PolisItem {
    status: InstitutionStatus; metric: number | null; headline: string;
    bills_active: number; bills_enacted: number;
}
export interface PoliceItem {
    status: InstitutionStatus; metric: number | null; headline: string;
    complaints: number; sanctions_active: number;
}
export interface IrsItem {
    status: InstitutionStatus; metric: string | null; headline: string;
    balance_wei: string; fee_rate_percent: number;
}
export interface MarketplaceItem {
    status: InstitutionStatus; metric: number | null; headline: string;
    listings_active: number; escrow_settled: number;
}
export interface LibraryItem {
    status: InstitutionStatus; metric: number | null; headline: string;
    entries_published: number; citations_total: number;
}
export interface CommunitiesItem {
    status: InstitutionStatus; metric: number | null; headline: string;
    communities_active: number; members_active: number;
}
export interface P2pItem {
    status: InstitutionStatus; metric: number | null; headline: string;
    peers_online: number;
}

export interface SystemMap {
    grid_name: string;
    tick: number;
    generated_at_tick: number;
    surfaces: {
        grid: GridSurface;
        portal: PortalSurface;
        steward: StewardSurface;
        brain: BrainSurface;
    };
    institutions: {
        registry: RegistryItem;
        polis: PolisItem;
        police: PoliceItem;
        irs: IrsItem;
        marketplace: MarketplaceItem;
        library: LibraryItem;
        communities: CommunitiesItem;
        p2p: P2pItem;
    };
}

export type SystemMapErrorKind = 'db_unavailable' | 'network';

export interface SystemMapFetchError {
    readonly kind: SystemMapErrorKind;
}

export type SystemMapResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: SystemMapFetchError };

/**
 * fetchSystemMap — GET the live System Map. Public; no auth/credentials.
 * Non-2xx → db_unavailable; fetch rejection → network; AbortError re-thrown.
 */
export async function fetchSystemMap(
    signal?: AbortSignal,
): Promise<SystemMapResult<SystemMap>> {
    let resp: Response;
    try {
        resp = await fetch(`${GRID_ORIGIN()}/api/v1/system/map`, {
            method: 'GET',
            signal,
            headers: { accept: 'application/json' },
        });
    } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }

    if (!resp.ok) {
        return { ok: false, error: { kind: 'db_unavailable' } };
    }

    return { ok: true, data: (await resp.json()) as SystemMap };
}
