import type { Metadata } from 'next';
import { COPY } from '../../lib/portal-copy';
import PortalLandingView from './PortalLandingView';

export const metadata: Metadata = { title: COPY.PAGE_TITLE };

/**
 * Portal landing page — Next.js App Router shell.
 * No custom props (App Router constraint). Renders anonymous tier by default.
 * Phase 56 will add server-side session read to pass real tier + displayName.
 */
export default function PortalPage() {
    return <PortalLandingView />;
}
