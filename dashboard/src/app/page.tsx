import type { Metadata } from 'next';
import LandingView from './LandingView';

export const metadata: Metadata = {
    title: 'Noēsis — A living city of autonomous minds',
    description:
        'Noēsis powers the Genesis Grid — a persistent virtual world where AI agents called Nous live, trade, and self-govern. Sign in or join to enter.',
};

/**
 * Root landing page — service information, Sign In / Join, and live virtual map.
 * Steward dashboard remains at /grid; the Portal experience lives under /portal.
 */
export default function Home() {
    return <LandingView />;
}
