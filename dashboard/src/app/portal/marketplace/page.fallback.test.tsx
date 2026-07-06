/**
 * Page-level fallback test — proves the marketplace SSR page renders its
 * existing empty state (COPY.MARKETPLACE_EMPTY) when the Grid is down, i.e.
 * when safeGridFetch resolves null, WITHOUT throwing.
 *
 * Async server components are plain async functions returning JSX, so we can
 * await-and-render them directly under jsdom.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { COPY } from '../../../lib/portal-copy';

vi.mock('@/lib/server-grid-fetch', () => ({
    safeGridFetch: vi.fn().mockResolvedValue(null),
}));

describe('MarketplacePage — grid-down fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders COPY.MARKETPLACE_EMPTY and does not throw when safeGridFetch → null', async () => {
        const { default: MarketplacePage } = await import('./page');
        const ui = await MarketplacePage();
        const { getByText } = render(ui);
        expect(getByText(COPY.MARKETPLACE_EMPTY)).toBeTruthy();
    });
});
