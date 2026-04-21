import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import RootLayout from './layout';
import { agencyStore } from '@/lib/stores/agency-store';

/**
 * Plan 06-02 Task 3 — RootLayout tests.
 *
 * RTL renders a full <html><body> tree into jsdom's document. React 19 +
 * Next 15 will log a "cannot render <html> inside a <div>" warning; we
 * suppress it for these tests because the layout's entire job is to return
 * that tree and we want to assert on its structure.
 *
 * The AgencyIndicator inside the layout calls useSyncExternalStore against
 * the real agencyStore, which touches window.localStorage. jsdom ships an
 * empty localStorage (no Storage methods), so we install the same in-memory
 * polyfill used by agency-indicator.test.tsx.
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

let originalError: typeof console.error;

beforeAll(() => {
    installLocalStoragePolyfill();
    // Suppress the React warning about rendering <html> inside a <div>.
    originalError = console.error;
    console.error = (...args: unknown[]): void => {
        const first = args[0];
        if (typeof first === 'string' && first.includes('<html>')) return;
        if (typeof first === 'string' && first.includes('<body>')) return;
        originalError(...(args as Parameters<typeof console.error>));
    };
});

afterEach(() => {
    vi.restoreAllMocks();
});

beforeEach(() => {
    window.localStorage.clear();
    agencyStore.setTier('H1');
});

describe('RootLayout — mount structure', () => {
    it('renders the AgencyIndicator (data-testid="agency-indicator") unconditionally', () => {
        const { baseElement } = render(
            <RootLayout>
                <div data-testid="page-child">page</div>
            </RootLayout>,
        );
        const indicator = baseElement.querySelector('[data-testid="agency-indicator"]');
        expect(indicator).not.toBeNull();
    });

    it('wraps the indicator in a fixed-position top-right overlay (z-50)', () => {
        const { baseElement } = render(
            <RootLayout>
                <div>child</div>
            </RootLayout>,
        );
        const indicator = baseElement.querySelector('[data-testid="agency-indicator"]');
        expect(indicator).not.toBeNull();
        const wrapper = indicator?.parentElement;
        expect(wrapper).not.toBeNull();
        const cls = wrapper?.className ?? '';
        expect(cls).toContain('fixed');
        expect(cls).toContain('right-4');
        expect(cls).toContain('top-4');
        expect(cls).toContain('z-50');
    });

    it('renders the children prop into the body (no displacement by the indicator)', () => {
        const { baseElement } = render(
            <RootLayout>
                <div data-testid="page-child">page-content</div>
            </RootLayout>,
        );
        const child = baseElement.querySelector('[data-testid="page-child"]');
        expect(child).not.toBeNull();
        expect(child?.textContent).toBe('page-content');
    });
});

describe('RootLayout — AgencyHydrator effect', () => {
    it('calls agencyStore.hydrateFromStorage() exactly once on mount', () => {
        const spy = vi.spyOn(agencyStore, 'hydrateFromStorage');
        render(
            <RootLayout>
                <div>child</div>
            </RootLayout>,
        );
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('hydrator reads persisted tier from localStorage and applies it', () => {
        // Seed a persisted tier BEFORE the layout mounts; hydrator should pick it up.
        window.localStorage.setItem('noesis.operator.tier', 'H3');
        render(
            <RootLayout>
                <div>child</div>
            </RootLayout>,
        );
        expect(agencyStore.getSnapshot()).toBe('H3');
    });
});
