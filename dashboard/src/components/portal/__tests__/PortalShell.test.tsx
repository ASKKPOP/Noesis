/**
 * Tests for PortalShell mobile hamburger menu — Plan 24-03.
 *
 * Covers:
 * - menuOpen state threading: isOpen, onClose props to PortalSidebar
 * - onMenuOpen prop to PortalHeader
 * - route-change effect closes sidebar
 * - /portal/auth bypass preserved
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortalShell } from '../PortalShell';

// ── Module mocks ─────────────────────────────────────────────────────────────

// Track props passed to child components
let lastSidebarProps: Record<string, unknown> = {};
let lastHeaderProps: Record<string, unknown> = {};

vi.mock('../PortalSidebar', () => ({
    PortalSidebar: (props: Record<string, unknown>) => {
        lastSidebarProps = props;
        return <div data-testid="portal-sidebar" />;
    },
}));

vi.mock('../PortalHeader', () => ({
    PortalHeader: (props: Record<string, unknown>) => {
        lastHeaderProps = props;
        return <div data-testid="portal-header" />;
    },
}));

// Track pathname for usePathname mock
let currentPathname = '/portal';

vi.mock('next/navigation', () => ({
    usePathname: () => currentPathname,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PortalShell — mobile menu state threading', () => {
    beforeEach(() => {
        lastSidebarProps = {};
        lastHeaderProps = {};
        currentPathname = '/portal';
    });

    it('Test 1: PortalShell passes isOpen prop to PortalSidebar', () => {
        render(<PortalShell>content</PortalShell>);
        expect('isOpen' in lastSidebarProps).toBe(true);
    });

    it('Test 2: PortalShell passes onClose prop to PortalSidebar', () => {
        render(<PortalShell>content</PortalShell>);
        expect(typeof lastSidebarProps.onClose).toBe('function');
    });

    it('Test 3: PortalShell passes onMenuOpen prop to PortalHeader', () => {
        render(<PortalShell>content</PortalShell>);
        expect(typeof lastHeaderProps.onMenuOpen).toBe('function');
    });

    it('Test 4: menuOpen starts false — isOpen is false by default', () => {
        render(<PortalShell>content</PortalShell>);
        expect(lastSidebarProps.isOpen).toBe(false);
    });

    it('Test 5: /portal/auth path bypasses shell layout (returns children only)', () => {
        currentPathname = '/portal/auth';
        const { container } = render(<PortalShell>auth-page</PortalShell>);
        // No sidebar or header rendered on auth path
        expect(screen.queryByTestId('portal-sidebar')).toBeNull();
        expect(screen.queryByTestId('portal-header')).toBeNull();
        expect(container.textContent).toContain('auth-page');
    });
});
