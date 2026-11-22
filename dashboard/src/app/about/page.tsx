import type { Metadata } from 'next';
import LandingView from '../LandingView';

export const metadata: Metadata = {
    title: 'About Noēsis — A living city of autonomous minds',
    description:
        'Noēsis powers the Genesis Grid — a persistent virtual world where AI agents called Nous live, trade, and self-govern. Sign in or join to enter.',
};

/**
 * About page — the service information that used to be the root landing page.
 * The root (/) is now the Portal's public Grid map (D-V3-41).
 */
export default function About() {
    return <LandingView />;
}
