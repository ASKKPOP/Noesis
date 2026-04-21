import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AgencyStore, agencyStore, getOperatorId } from './agency-store';
import {
    OPERATOR_ID_REGEX,
    TIER_NAME,
    type HumanAgencyTier,
} from '@/lib/protocol/agency-types';

/**
 * Plan 06-02 Task 1 — AgencyStore + agency-types tests.
 *
 * Contract:
 *   - types mirror grid/src/api/types.ts (SYNC header drift detector)
 *   - store default is 'H1' per D-01
 *   - subscribe/setTier: same-value is a no-op, disposed listeners silent
 *   - localStorage persistence for tier + op:<uuid-v4> operator id
 *   - SSR-safe: window-guarded, returns op:ssr-no-id sentinel
 *   - H5 rejected at hydration time (D-20)
 *
 * jsdom (Vitest 4.1) ships with an empty `window.localStorage` object that
 * lacks Storage methods. We install a minimal in-memory polyfill at the test
 * file level so the store can exercise its real persist/hydrate paths without
 * touching the global test setup (which other tests share).
 */

function installLocalStoragePolyfill(): void {
    const map = new Map<string, string>();
    const storage: Storage = {
        get length() {
            return map.size;
        },
        clear(): void {
            map.clear();
        },
        getItem(key: string): string | null {
            return map.has(key) ? (map.get(key) as string) : null;
        },
        key(index: number): string | null {
            return Array.from(map.keys())[index] ?? null;
        },
        removeItem(key: string): void {
            map.delete(key);
        },
        setItem(key: string, value: string): void {
            map.set(String(key), String(value));
        },
    };
    Object.defineProperty(window, 'localStorage', {
        value: storage,
        configurable: true,
        writable: true,
    });
}

beforeAll(() => {
    installLocalStoragePolyfill();
});

beforeEach(() => {
    window.localStorage.clear();
    // Reset singleton to default between tests so H1 is the baseline.
    agencyStore.setTier('H1');
});

describe('agency-types — types + constants', () => {
    it('exposes the canonical tier name map', () => {
        expect(TIER_NAME.H1).toBe('Observer');
        expect(TIER_NAME.H2).toBe('Reviewer');
        expect(TIER_NAME.H3).toBe('Partner');
        expect(TIER_NAME.H4).toBe('Driver');
        expect(TIER_NAME.H5).toBe('Sovereign');
    });

    it('accepts the five tier literals via the HumanAgencyTier union', () => {
        const tiers: HumanAgencyTier[] = ['H1', 'H2', 'H3', 'H4', 'H5'];
        expect(tiers).toHaveLength(5);
    });

    it('OPERATOR_ID_REGEX accepts a valid op:<uuid-v4>', () => {
        expect(OPERATOR_ID_REGEX.test('op:11111111-1111-4111-8111-111111111111')).toBe(true);
        expect(OPERATOR_ID_REGEX.test('op:aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).toBe(true);
    });

    it('OPERATOR_ID_REGEX rejects DIDs, missing prefix, wrong version nibble', () => {
        expect(OPERATOR_ID_REGEX.test('did:noesis:alpha')).toBe(false);
        expect(OPERATOR_ID_REGEX.test('op:not-a-uuid')).toBe(false);
        // Version nibble must be 4 (v4 UUID)
        expect(OPERATOR_ID_REGEX.test('op:11111111-1111-3111-8111-111111111111')).toBe(false);
        // Variant nibble must be 8/9/a/b
        expect(OPERATOR_ID_REGEX.test('op:11111111-1111-4111-c111-111111111111')).toBe(false);
        expect(OPERATOR_ID_REGEX.test('')).toBe(false);
    });
});

describe('agency-types — SYNC header drift detector', () => {
    it('contains the literal SYNC: grid/src/api/types.ts comment', () => {
        const file = path.resolve(__dirname, '../protocol/agency-types.ts');
        const src = fs.readFileSync(file, 'utf8');
        expect(src).toContain('SYNC: grid/src/api/types.ts');
    });
});

describe('AgencyStore — default tier', () => {
    it('starts at H1 on a fresh instance with empty localStorage', () => {
        const store = new AgencyStore();
        expect(store.getSnapshot()).toBe('H1');
    });
});

describe('AgencyStore — subscribe/setTier', () => {
    it('notifies a listener exactly once on tier change', () => {
        const store = new AgencyStore();
        const listener = vi.fn();
        store.subscribe(listener);
        store.setTier('H3');
        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot()).toBe('H3');
    });

    it('does NOT re-fire listeners when setTier is called with the same value', () => {
        const store = new AgencyStore();
        store.setTier('H3');
        const listener = vi.fn();
        store.subscribe(listener);
        store.setTier('H3');
        expect(listener).not.toHaveBeenCalled();
    });

    it('returns an unsubscribe function that stops notifications', () => {
        const store = new AgencyStore();
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        store.setTier('H2');
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
        store.setTier('H4');
        expect(listener).toHaveBeenCalledTimes(1); // disposed listener silent
    });
});

describe('AgencyStore — localStorage persistence', () => {
    it('persists setTier writes to localStorage under noesis.operator.tier', () => {
        const store = new AgencyStore();
        store.setTier('H4');
        expect(localStorage.getItem('noesis.operator.tier')).toBe('H4');
    });

    it('hydrateFromStorage restores a persisted tier on a new instance', () => {
        localStorage.setItem('noesis.operator.tier', 'H2');
        const store = new AgencyStore();
        expect(store.getSnapshot()).toBe('H1'); // no auto-hydrate on module load
        store.hydrateFromStorage();
        expect(store.getSnapshot()).toBe('H2');
    });

    it('hydrateFromStorage rejects H5 (reserved for Phase 8 — D-20)', () => {
        localStorage.setItem('noesis.operator.tier', 'H5');
        const store = new AgencyStore();
        store.hydrateFromStorage();
        expect(store.getSnapshot()).toBe('H1');
    });

    it('hydrateFromStorage rejects garbage values and keeps the default', () => {
        localStorage.setItem('noesis.operator.tier', 'garbage');
        const store = new AgencyStore();
        store.hydrateFromStorage();
        expect(store.getSnapshot()).toBe('H1');
    });

    it('hydrateFromStorage on empty storage leaves the default intact', () => {
        const store = new AgencyStore();
        store.hydrateFromStorage();
        expect(store.getSnapshot()).toBe('H1');
    });

    it('hydrateFromStorage notifies subscribers when tier actually changes', () => {
        localStorage.setItem('noesis.operator.tier', 'H3');
        const store = new AgencyStore();
        const listener = vi.fn();
        store.subscribe(listener);
        store.hydrateFromStorage();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot()).toBe('H3');
    });
});

describe('getOperatorId()', () => {
    it('generates a UUID matching OPERATOR_ID_REGEX on first call', () => {
        const id = getOperatorId();
        expect(OPERATOR_ID_REGEX.test(id)).toBe(true);
    });

    it('persists the generated id to localStorage under noesis.operator.id', () => {
        const id = getOperatorId();
        expect(localStorage.getItem('noesis.operator.id')).toBe(id);
    });

    it('returns the SAME value across successive calls (stable)', () => {
        const a = getOperatorId();
        const b = getOperatorId();
        expect(a).toBe(b);
    });

    it('replaces malformed pre-existing values with a fresh UUID', () => {
        localStorage.setItem('noesis.operator.id', 'did:noesis:not-an-op-id');
        const id = getOperatorId();
        expect(id).not.toBe('did:noesis:not-an-op-id');
        expect(OPERATOR_ID_REGEX.test(id)).toBe(true);
        expect(localStorage.getItem('noesis.operator.id')).toBe(id);
    });

    it('replaces values with a valid UUID but wrong prefix', () => {
        localStorage.setItem(
            'noesis.operator.id',
            'nous:11111111-1111-4111-8111-111111111111',
        );
        const id = getOperatorId();
        expect(OPERATOR_ID_REGEX.test(id)).toBe(true);
        expect(id.startsWith('op:')).toBe(true);
    });

    it('accepts a pre-existing valid id and returns it verbatim', () => {
        const existing = 'op:11111111-1111-4111-8111-111111111111';
        localStorage.setItem('noesis.operator.id', existing);
        expect(getOperatorId()).toBe(existing);
    });
});

describe('AgencyStore + getOperatorId — SSR safety', () => {
    const originalWindow = globalThis.window;

    afterEach(() => {
        // Restore window after each SSR-simulated test.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as unknown as { window: unknown }).window = originalWindow;
    });

    it('hydrateFromStorage is a no-op when window is undefined', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as unknown as { window: unknown }).window = undefined;
        const store = new AgencyStore();
        expect(() => store.hydrateFromStorage()).not.toThrow();
        expect(store.getSnapshot()).toBe('H1');
    });

    it('setTier does not throw when window is undefined', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as unknown as { window: unknown }).window = undefined;
        const store = new AgencyStore();
        expect(() => store.setTier('H2')).not.toThrow();
        expect(store.getSnapshot()).toBe('H2'); // in-memory update still works
    });

    it('getOperatorId returns the ssr sentinel when window is undefined', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as unknown as { window: unknown }).window = undefined;
        expect(getOperatorId()).toBe('op:ssr-no-id');
    });
});

describe('agencyStore singleton', () => {
    it('exports a ready-to-use default agencyStore instance', () => {
        expect(agencyStore).toBeInstanceOf(AgencyStore);
    });
});
