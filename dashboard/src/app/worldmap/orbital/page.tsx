'use client';

/**
 * /worldmap/orbital — Noēsis Genesis Core, live orbital station view (D-NH-01/12).
 *
 * ADDITIVE route (D-58-09): the existing /worldmap CyberGrid city view is kept
 * unchanged; this is the canonical orbital Grid view beside it. Renders the
 * OrbitalGenesisMap, which live-fetches GET /api/v1/civic/parcels (embedded
 * 53-parcel seed fallback), shows Earth below, the Government Core monument,
 * ghost-vs-lit modules, occupancy lights, and the NY clock at the display boundary.
 */

import dynamic from 'next/dynamic';

const OrbitalGenesisMap = dynamic(
    () => import('@/components/worldmap/OrbitalGenesisMap'),
    { ssr: false },
);

export default function OrbitalWorldmapPage(): React.ReactElement {
    return (
        <div style={{ height: '100vh', width: '100vw' }}>
            <OrbitalGenesisMap />
        </div>
    );
}
