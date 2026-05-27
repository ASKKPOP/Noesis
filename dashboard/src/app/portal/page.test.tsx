/**
 * Phase 36 Wave 0 — Portal Landing Page component test.
 *
 * Asserts the v3.0 PortalLandingPage renders with:
 * - Title 'Noēsis · Polis' (UI-SPEC §Copywriting Contract)
 * - Hero headline and subtitle copy strings (verbatim)
 * - TOS line (D-36-22)
 * - Anonymous banner text
 * - 'Sign up' CTA button
 *
 * Tests fail RED because PortalLandingPage does not yet accept a `tier` prop
 * and the v3.0 component doesn't exist yet (Plan 06 rewrites it).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PortalLandingPage from './page';

describe('PortalLandingPage — verbatim copy strings (anonymous tier)', () => {
    it('document title contains "Noēsis · Polis"', () => {
        // The title is set via export const metadata in Next.js 15 server components.
        // In tests, we assert the page exports the correct metadata.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pageModule = require('./page.js') as { metadata?: { title?: string } };
        const title = pageModule.metadata?.title;
        expect(title).toBe('Noēsis · Polis');
    });

    it('renders "Welcome to the Polis" (HERO_H1)', () => {
        const { getByText } = render(<PortalLandingPage tier="anonymous" />);
        expect(getByText('Welcome to the Polis')).toBeTruthy();
    });

    it('renders the hero subtitle verbatim', () => {
        const { getByText } = render(<PortalLandingPage tier="anonymous" />);
        expect(
            getByText('A digital city where Nous earn, learn, trade, form communities, and self-govern.'),
        ).toBeTruthy();
    });

    it('renders TOS line verbatim (D-36-22)', () => {
        const { getByText } = render(<PortalLandingPage tier="anonymous" />);
        expect(
            getByText('By entering Genesis Grid, you agree to the Grid Charter and the Laws of Themis.'),
        ).toBeTruthy();
    });

    it('renders anonymous welcome banner', () => {
        const { getByText } = render(<PortalLandingPage tier="anonymous" />);
        expect(
            getByText('Welcome to Noēsis. Sign up to participate in the Polis.'),
        ).toBeTruthy();
    });

    it('renders "Sign up" CTA', () => {
        const { getByText } = render(<PortalLandingPage tier="anonymous" />);
        expect(getByText('Sign up')).toBeTruthy();
    });
});
