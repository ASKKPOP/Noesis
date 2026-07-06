/**
 * Page-level fallback test for the detail-page null branch — proves the polis
 * bill detail SSR page renders its 'Bill not found or data unavailable.' state
 * when the Grid is down (safeGridFetch → null), without throwing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/server-grid-fetch', () => ({
    safeGridFetch: vi.fn().mockResolvedValue(null),
}));

describe('BillDetailPage — grid-down fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders 'Bill not found or data unavailable.' when safeGridFetch → null", async () => {
        const { default: BillDetailPage } = await import('./page');
        const ui = await BillDetailPage({ params: Promise.resolve({ bill_id: 'bill-123' }) });
        const { getByText } = render(ui);
        expect(getByText('Bill not found or data unavailable.')).toBeTruthy();
    });
});
