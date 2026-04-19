/**
 * Economy REST wrappers — typed fetchers for the three endpoints locked by
 * Plan 04-03 and consumed by the Economy panel (Plan 04-06):
 *
 *   - GET /api/v1/grid/nous              → fetchRoster
 *   - GET /api/v1/economy/trades?limit=N → fetchTrades (default 20, clamped [1,100])
 *   - GET /api/v1/economy/shops          → fetchShops
 *
 * Error model (simpler than fetchNousState because these endpoints have no
 * meaningful per-status discrimination for the UI — any non-2xx is a network
 * problem from the panel's perspective):
 *
 *   - 200 → { ok: true, data: T }
 *   - any non-2xx OR fetch rejection → { ok: false, error: { kind: 'network' } }
 *   - AbortError is RE-THROWN so the EconomyPanel can discard stale results
 *     via `signal.aborted` on the way back to setState.
 *
 * W2 cross-plan contract (Plan 04-03 owns, this module + Plan 04-05's
 * MemorySection both consume): `TradeRecord.timestamp` is an Unix timestamp
 * in **INTEGER SECONDS**, NOT milliseconds. Consumers must multiply by 1000
 * before passing to `new Date(...)` or the rendered date falls back to 1970.
 * Plan 04-03's controller test asserts `timestamp < 10_000_000_000` to lock
 * the unit at the API boundary; Plan 04-06's TradesTable asserts the `* 1000`
 * multiplication at the render boundary.
 */

export type NousRosterEntry = {
    did: string;
    name: string;
    region: string;
    ousia: number;
    lifecyclePhase: string;
    reputation: number;
    status: string;
};
export type RosterResponse = { nous: NousRosterEntry[] };

export type TradeRecord = {
    actorDid: string;
    counterparty: string;
    amount: number;
    nonce: string;
    /** Unix SECONDS (integer) — W2 contract locked in Plan 04-03. */
    timestamp: number;
};
export type TradesResponse = { trades: TradeRecord[]; total: number };

export type ShopListing = { sku: string; label: string; priceOusia: number };
export type Shop = { ownerDid: string; name: string; listings: ShopListing[] };
export type ShopsResponse = { shops: Shop[] };

export type EconomyError = { kind: 'network' };
export type EconomyResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: EconomyError };

async function getJson<T>(
    url: string,
    signal?: AbortSignal,
): Promise<EconomyResult<T>> {
    let resp: Response;
    try {
        resp = await fetch(url, {
            signal,
            headers: { accept: 'application/json' },
        });
    } catch (err) {
        // Abort is a distinct signal — re-throw so the caller's useEffect can
        // inspect `signal.aborted` and discard stale setState calls.
        if ((err as { name?: string }).name === 'AbortError') throw err;
        return { ok: false, error: { kind: 'network' } };
    }
    if (!resp.ok) return { ok: false, error: { kind: 'network' } };
    return { ok: true, data: (await resp.json()) as T };
}

export function fetchRoster(
    origin: string,
    signal?: AbortSignal,
): Promise<EconomyResult<RosterResponse>> {
    return getJson<RosterResponse>(`${origin}/api/v1/grid/nous`, signal);
}

const TRADES_LIMIT_FALLBACK = 20;
const TRADES_LIMIT_MAX = 100;

export function fetchTrades(
    origin: string,
    signal?: AbortSignal,
    limit: number = TRADES_LIMIT_FALLBACK,
): Promise<EconomyResult<TradesResponse>> {
    // Clamp: finite & ≥1 → min(limit, 100); else fall back to 20. The server
    // caps at 100 too; clamping here means the URL query string matches what
    // the server will actually honor, so cache/log aggregation stays honest.
    const n =
        Number.isFinite(limit) && limit >= 1
            ? Math.min(limit, TRADES_LIMIT_MAX)
            : TRADES_LIMIT_FALLBACK;
    return getJson<TradesResponse>(
        `${origin}/api/v1/economy/trades?limit=${n}`,
        signal,
    );
}

export function fetchShops(
    origin: string,
    signal?: AbortSignal,
): Promise<EconomyResult<ShopsResponse>> {
    return getJson<ShopsResponse>(`${origin}/api/v1/economy/shops`, signal);
}
