'use client';

/**
 * /worldmap/orbital — Noēsis Genesis Core, live orbital station view (D-NH-01/12).
 *
 * ADDITIVE route (D-58-09): the existing /worldmap CyberGrid city view is kept
 * unchanged; this is the canonical orbital Grid view beside it. Renders the
 * OrbitalGenesisMap, which live-fetches GET /api/v1/civic/parcels (embedded
 * 53-parcel seed fallback), shows Earth below, the Government Core monument,
 * ghost-vs-lit modules, occupancy lights, and the NY clock at the display boundary.
 *
 * Phase 60 added the commerce overlay (shop badge / roles / board / IOUs) and
 * Phase 61 the construction overlay (blueprint library / build panel / co-build
 * DAG board) + the workshop teach-here indicator — both ADDITIVE inside the map.
 */

import dynamic from 'next/dynamic';

// "Our world map": the rich 3D Three.js orbital station as a native React
// component, rendering the SAME live parcel feed the Nous act on (seed fallback).
const OrbitalStation3D = dynamic(
    () => import('@/components/worldmap/OrbitalStation3D'),
    { ssr: false },
);

export default function OrbitalWorldmapPage(): React.ReactElement {
    return (
        <div style={{ height: '100vh', width: '100vw' }}>
            <OrbitalStation3D />
        </div>
    );
}
