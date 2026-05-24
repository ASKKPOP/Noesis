/**
 * PortalShell route-change sidebar close tests — Plan 24-05 (PORTAL-05).
 *
 * Verifies the useEffect([pathname]) closes the sidebar whenever the
 * user navigates to a new route. Complements the prop-threading tests in
 * __tests__/PortalShell.test.tsx by exercising the actual state transition.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { PortalShell } from './PortalShell';

// ── Module mocks ─────────────────────────────────────────────────────────────

// Mutable pathname — rerender will re-read this via the mock
let currentPathname = '/portal';

vi.mock('next/navigation', () => ({
    usePathname: () => currentPathname,
}));

// Capture props passed to PortalSidebar so we can inspect isOpen
let lastSidebarIsOpen: boolean | undefined;
let lastOnMenuOpen: (() => void) | undefined;

vi.mock('./PortalSidebar', () => ({
    PortalSidebar: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
        lastSidebarIsOpen = isOpen;
        return <div data-testid="sidebar" data-open={String(isOpen)} />;
    },
}));

vi.mock('./PortalHeader', () => ({
    PortalHeader: ({ onMenuOpen }: { onMenuOpen: () => void }) => {
        lastOnMenuOpen = onMenuOpen;
        return <button data-testid="hamburger" onClick={onMenuOpen} />;
    },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PortalShell — sidebar closes on route change (PORTAL-05)', () => {
    beforeEach(() => {
        currentPathname = '/portal';
        lastSidebarIsOpen = undefined;
        lastOnMenuOpen = undefined;
    });

    it('starts with sidebar closed (menuOpen = false)', () => {
        const { getByTestId } = render(<PortalShell><div /></PortalShell>);
        expect(getByTestId('sidebar').getAttribute('data-open')).toBe('false');
    });

    it('opens sidebar when hamburger is clicked', () => {
        const { getByTestId } = render(<PortalShell><div /></PortalShell>);
        act(() => { getByTestId('hamburger').click(); });
        expect(getByTestId('sidebar').getAttribute('data-open')).toBe('true');
    });

    it('closes sidebar when pathname changes (route-change effect)', () => {
        currentPathname = '/portal';
        const { getByTestId, rerender } = render(<PortalShell><div /></PortalShell>);

        // Open the sidebar
        act(() => { getByTestId('hamburger').click(); });
        expect(getByTestId('sidebar').getAttribute('data-open')).toBe('true');

        // Simulate route change — update the mock value then rerender
        currentPathname = '/portal/profile';
        rerender(<PortalShell><div /></PortalShell>);

        expect(getByTestId('sidebar').getAttribute('data-open')).toBe('false');
    });

    it('renders children directly on /portal/auth path (shell bypassed)', () => {
        currentPathname = '/portal/auth';
        const { queryByTestId, container } = render(
            <PortalShell><div data-testid="auth-child" /></PortalShell>
        );
        // No sidebar or header on auth path
        expect(queryByTestId('sidebar')).toBeNull();
        expect(queryByTestId('hamburger')).toBeNull();
        expect(container.querySelector('[data-testid="auth-child"]')).not.toBeNull();
    });
});
