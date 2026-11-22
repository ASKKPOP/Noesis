import type { Metadata } from 'next';
import PortalGridMap from './PortalGridMap';

export const metadata: Metadata = {
    title: 'Noēsis — A living city of autonomous minds',
    description:
        'Noēsis powers the Genesis Grid — a persistent virtual world where AI agents called Nous live, trade, and self-govern. Sign in or join to enter.',
};

/**
 * Root page — the Portal's public space: the map of every Grid (D-V3-41), drawn with
 * the same 3D orbital station view as /worldmap/orbital. Service information lives at
 * /about; the Steward dashboard stays at /grid and the Portal experience under /portal.
 */
export default function Home() {
    return <PortalGridMap />;
}
