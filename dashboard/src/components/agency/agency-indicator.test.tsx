import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AgencyIndicator } from './agency-indicator';
import { agencyStore } from '@/lib/stores/agency-store';

/**
 * Plan 06-02 Task 2 — AgencyIndicator tests.
 *
 * jsdom (Vitest 4.1) ships with an empty window.localStorage. We install a
 * minimal in-memory polyfill so the indicator can talk to the real
 * agencyStore without mocking.
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
    // Reset the singleton to the SSR default between tests.
    agencyStore.setTier('H1');
});

describe('AgencyIndicator — default render (H1)', () => {
    it('renders the chip with "H1 Observer" on fresh mount', () => {
        render(<AgencyIndicator />);
        expect(screen.getByTestId('agency-chip').textContent).toBe('H1 Observer');
    });

    it('exposes data-testid="agency-indicator" on the wrapper (Playwright hook)', () => {
        render(<AgencyIndicator />);
        expect(screen.getByTestId('agency-indicator')).not.toBeNull();
    });

    it('exposes role="status" with tier info in aria-label', () => {
        render(<AgencyIndicator />);
        const status = screen.getByRole('status');
        const label = status.getAttribute('aria-label') ?? '';
        expect(label).toContain('Current agency tier: H1 Observer');
        expect(label).toContain('Read-only.');
    });

    it('chip carries the neutral color class (no tint) for H1', () => {
        render(<AgencyIndicator />);
        const chip = screen.getByTestId('agency-chip');
        expect(chip.className).toContain('bg-neutral-800');
    });
});

describe('AgencyIndicator — tier reactivity', () => {
    it('updates label to "H4 Driver" when store transitions to H4', () => {
        render(<AgencyIndicator />);
        act(() => {
            agencyStore.setTier('H4');
        });
        expect(screen.getByTestId('agency-chip').textContent).toBe('H4 Driver');
    });

    it('applies the H4 red border class on tier change', () => {
        render(<AgencyIndicator />);
        act(() => {
            agencyStore.setTier('H4');
        });
        const chip = screen.getByTestId('agency-chip');
        expect(chip.className).toContain('border-red-400');
    });

    it('aria-label reflects the elevated tier + state suffix', () => {
        render(<AgencyIndicator />);
        act(() => {
            agencyStore.setTier('H3');
        });
        const status = screen.getByRole('status');
        const label = status.getAttribute('aria-label') ?? '';
        expect(label).toContain('Current agency tier: H3 Partner');
        expect(label).toContain('Elevation active.');
    });

    it('applies the H2 blue border class on tier change', () => {
        render(<AgencyIndicator />);
        act(() => {
            agencyStore.setTier('H2');
        });
        const chip = screen.getByTestId('agency-chip');
        expect(chip.className).toContain('border-blue-400');
    });

    it('applies the H3 amber border class on tier change', () => {
        render(<AgencyIndicator />);
        act(() => {
            agencyStore.setTier('H3');
        });
        const chip = screen.getByTestId('agency-chip');
        expect(chip.className).toContain('border-amber-300');
    });
});

describe('AgencyIndicator — tooltip visibility', () => {
    it('does not render the tooltip on initial mount', () => {
        render(<AgencyIndicator />);
        expect(screen.queryByTestId('tier-tooltip')).toBeNull();
    });

    it('opens the tooltip on chip click', () => {
        render(<AgencyIndicator />);
        act(() => {
            screen.getByRole('button').click();
        });
        expect(screen.getByTestId('tier-tooltip')).not.toBeNull();
    });

    it('closes the tooltip on a second chip click (toggle)', () => {
        render(<AgencyIndicator />);
        act(() => {
            screen.getByRole('button').click();
        });
        expect(screen.queryByTestId('tier-tooltip')).not.toBeNull();
        act(() => {
            screen.getByRole('button').click();
        });
        expect(screen.queryByTestId('tier-tooltip')).toBeNull();
    });
});

describe('AgencyIndicator — focus ring', () => {
    it('chip trigger button has an accent focus ring class', () => {
        render(<AgencyIndicator />);
        const button = screen.getByRole('button');
        expect(button.className).toContain('focus:ring-sky-300');
    });
});
