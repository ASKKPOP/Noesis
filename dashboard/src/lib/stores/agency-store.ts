/**
 * AgencyStore — framework-agnostic singleton tracking the operator's current
 * Human Agency Scale tier (H1 Observer default; H2/H3/H4 mid-flight during an
 * elevation dialog; H5 explicitly rejected at runtime per D-20).
 *
 * Shape mirrors the Phase-3/4 store contract (subscribe/getSnapshot) so React's
 * useSyncExternalStore can bind to it without any React import here.
 *
 * Persistence:
 *   - localStorage['noesis.operator.tier'] — tier, restored on client-side
 *     hydration via hydrateFromStorage() (called from <AgencyHydrator />)
 *   - localStorage['noesis.operator.id']   — session-scoped op:<uuid-v4>,
 *     lazily allocated by getOperatorId() on first read
 *
 * SSR safety:
 *   - All window.localStorage access is guarded by `typeof window === 'undefined'`.
 *   - getOperatorId() returns the sentinel 'op:ssr-no-id' during SSR.
 *   - Module load does NOT touch localStorage — <AgencyHydrator /> fires
 *     hydrateFromStorage() inside a useEffect so RSC stays pure.
 */

import { OPERATOR_ID_REGEX, type HumanAgencyTier } from '@/lib/protocol/agency-types';

const TIER_STORAGE_KEY = 'noesis.operator.tier';
const OPERATOR_ID_STORAGE_KEY = 'noesis.operator.id';
const SSR_OPERATOR_ID_SENTINEL = 'op:ssr-no-id';

// Hydration whitelist: H5 is explicitly rejected at runtime per D-20 (reserved
// for Phase 8 disabled-affordance only; a tampered localStorage value of 'H5'
// would bypass the elevation-dialog flow entirely).
const HYDRATABLE_TIERS: ReadonlySet<HumanAgencyTier> = new Set<HumanAgencyTier>([
    'H1',
    'H2',
    'H3',
    'H4',
]);

export class AgencyStore {
    private tier: HumanAgencyTier = 'H1';
    private readonly listeners = new Set<() => void>();

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return (): void => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = (): HumanAgencyTier => this.tier;

    setTier(next: HumanAgencyTier): void {
        if (next === this.tier) return; // same-value no-op (tearing-safe per PATTERNS.md S-4)
        this.tier = next;
        this.persist();
        for (const listener of this.listeners) listener();
    }

    hydrateFromStorage(): void {
        if (typeof window === 'undefined') return;
        let raw: string | null = null;
        try {
            raw = window.localStorage.getItem(TIER_STORAGE_KEY);
        } catch {
            return;
        }
        if (raw === null) return;
        if (!HYDRATABLE_TIERS.has(raw as HumanAgencyTier)) return;
        const next = raw as HumanAgencyTier;
        if (next === this.tier) return;
        this.tier = next;
        for (const listener of this.listeners) listener();
    }

    private persist(): void {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(TIER_STORAGE_KEY, this.tier);
        } catch {
            /* quota exceeded or storage unavailable — tier stays in memory */
        }
    }
}

/**
 * Convenience singleton for the common case where the whole app shares one
 * agency tier. Tests construct fresh AgencyStore instances to avoid cross-test
 * leakage.
 */
export const agencyStore = new AgencyStore();

/**
 * getOperatorId — synchronous accessor for the session-scoped `op:<uuid-v4>`.
 *
 * Generates via crypto.randomUUID() on first call (available in all evergreen
 * browsers and Node 19+) and persists to localStorage under
 * 'noesis.operator.id'. Subsequent calls return the SAME value.
 *
 * Malformed pre-existing values (wrong prefix, non-v4 UUID, trailing garbage)
 * are replaced with a fresh UUID — the regex is the single source of validity.
 *
 * SSR sentinel: returns 'op:ssr-no-id' when window is undefined. Call sites
 * must avoid using getOperatorId() during SSR; this sentinel exists only so
 * tests and accidental SSR reads do not crash.
 */
export function getOperatorId(): string {
    if (typeof window === 'undefined') return SSR_OPERATOR_ID_SENTINEL;
    let existing: string | null = null;
    try {
        existing = window.localStorage.getItem(OPERATOR_ID_STORAGE_KEY);
    } catch {
        existing = null;
    }
    if (existing !== null && OPERATOR_ID_REGEX.test(existing)) return existing;
    const fresh = `op:${crypto.randomUUID()}`;
    try {
        window.localStorage.setItem(OPERATOR_ID_STORAGE_KEY, fresh);
    } catch {
        /* quota exceeded — return the freshly generated id anyway */
    }
    return fresh;
}
