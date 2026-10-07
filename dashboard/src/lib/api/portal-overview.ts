/**
 * Phase 56 — client for GET /api/v1/portal/me/overview (Portal session cookie).
 * wei values are decimal strings; formatWei renders them without losing precision.
 */
const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

export interface OverviewNous {
    nous_did: string;
    grid_id: string;
    civic_status: string;
    presence: string | null;
    last_seen_tick: number | null;
    balance_wei: string;
}
export interface OverviewRegistration {
    request_id: string;
    nous_did: string;
    nous_type: string;
    target_grid: string;
    status: 'requested' | 'polis_pending' | 'approved' | 'rejected';
    reason_code: string | null;
    filed_tick: number;
}
export interface PortalOverview {
    human_did: string;
    nous: OverviewNous[];
    grids: { grid_id: string; nous_count: number }[];
    wallet: { total_wei: string; by_grid: { grid_id: string; balance_wei: string }[] };
    registrations: OverviewRegistration[];
}

export type OverviewResult =
    | { ok: true; data: PortalOverview }
    | { ok: false; error: { kind: 'unauthenticated' | 'network' } };

export async function fetchPortalOverview(signal?: AbortSignal): Promise<OverviewResult> {
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/portal/me/overview`, { credentials: 'include', cache: 'no-store', signal });
        if (res.status === 401) return { ok: false, error: { kind: 'unauthenticated' } };
        if (!res.ok) return { ok: false, error: { kind: 'network' } };
        return { ok: true, data: (await res.json()) as PortalOverview };
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }
}

/** Decimal wei string → ETH-denominated string, exact, up to 6 fractional digits. */
export function formatWei(wei: string): string {
    const v = BigInt(wei);
    const whole = v / 10n ** 18n;
    const frac = (v % 10n ** 18n).toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
}

/** Registration status → the words a person would use. */
export const REGISTRATION_LABEL: Record<OverviewRegistration['status'], string> = {
    requested: 'Waiting for Portal pre-screen',
    polis_pending: 'Waiting for Polis review',
    approved: 'Approved',
    rejected: 'Rejected',
};
