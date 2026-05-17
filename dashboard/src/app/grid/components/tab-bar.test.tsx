import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar } from './tab-bar';

/**
 * Plan 04-04 Task 4 — TabBar tests.
 *
 * TabBar is a two-tab accessible tablist (Firehose + Map · Economy) with
 * keyboard navigation (Arrow keys, Home, End) and URL query-param sync
 * (`?tab=economy`). Uses next/navigation mocks so we can assert against
 * router.replace calls without a Next runtime.
 */

// Mutable mocks the test body rewrites per-case.
const mockReplace = vi.fn();
const mockPush = vi.fn();
let mockSearchParamsStr = '';
let mockPathname = '/grid';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, push: mockPush }),
    useSearchParams: () => new URLSearchParams(mockSearchParamsStr),
    usePathname: () => mockPathname,
}));

beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockSearchParamsStr = '';
    mockPathname = '/grid';
});

describe('TabBar — structure and a11y', () => {
    it('renders a tablist with exactly three tabs', () => {
        render(<TabBar />);
        const tablist = screen.getByRole('tablist');
        expect(tablist).not.toBeNull();
        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(3);
        expect(screen.getByTestId('tab-firehose')).not.toBeNull();
        expect(screen.getByTestId('tab-economy')).not.toBeNull();
        expect(screen.getByTestId('tab-culture')).not.toBeNull();
    });
});

describe('TabBar — initial active tab from URL', () => {
    it('defaults to firehose when no ?tab param is present', () => {
        render(<TabBar />);
        expect(screen.getByTestId('tab-firehose').getAttribute('aria-selected')).toBe('true');
        expect(screen.getByTestId('tab-economy').getAttribute('aria-selected')).toBe('false');
    });

    it('reads ?tab=economy and marks the economy tab selected', () => {
        mockSearchParamsStr = 'tab=economy';
        render(<TabBar />);
        expect(screen.getByTestId('tab-economy').getAttribute('aria-selected')).toBe('true');
        expect(screen.getByTestId('tab-firehose').getAttribute('aria-selected')).toBe('false');
    });
});

describe('TabBar — click behaviour', () => {
    it('clicking Economy calls router.replace with ?tab=economy', () => {
        render(<TabBar />);
        fireEvent.click(screen.getByTestId('tab-economy'));
        expect(mockReplace).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith('?tab=economy');
    });

    it('clicking Firehose from economy removes the tab param', () => {
        mockSearchParamsStr = 'tab=economy';
        render(<TabBar />);
        fireEvent.click(screen.getByTestId('tab-firehose'));
        expect(mockReplace).toHaveBeenCalledTimes(1);
        // Empty-string querystring = no params = default firehose view
        expect(mockReplace).toHaveBeenCalledWith('?');
    });

    it('clicking Culture calls router.push with /grid/culture', () => {
        render(<TabBar />);
        fireEvent.click(screen.getByTestId('tab-culture'));
        expect(mockPush).toHaveBeenCalledTimes(1);
        expect(mockPush).toHaveBeenCalledWith('/grid/culture');
        expect(mockReplace).not.toHaveBeenCalled();
    });
});

describe('TabBar — keyboard navigation', () => {
    it('ArrowRight on firehose activates economy', () => {
        render(<TabBar />);
        const tablist = screen.getByRole('tablist');
        fireEvent.keyDown(tablist, { key: 'ArrowRight' });
        expect(mockReplace).toHaveBeenCalledWith('?tab=economy');
    });

    it('Home key activates the first tab regardless of current', () => {
        mockSearchParamsStr = 'tab=economy';
        render(<TabBar />);
        const tablist = screen.getByRole('tablist');
        fireEvent.keyDown(tablist, { key: 'Home' });
        expect(mockReplace).toHaveBeenCalledWith('?');
    });

    it('End key activates the last tab (Culture)', () => {
        render(<TabBar />);
        const tablist = screen.getByRole('tablist');
        fireEvent.keyDown(tablist, { key: 'End' });
        expect(mockPush).toHaveBeenCalledWith('/grid/culture');
    });
});
