'use client';

import dynamic from 'next/dynamic';

// WebGL is client-only — same loader as /worldmap/orbital.
const OrbitalStation3D = dynamic(
    () => import('@/components/worldmap/OrbitalStation3D'),
    { ssr: false },
);

export default function PortalGridMap(): React.ReactElement {
    return (
        <div style={{ height: '100vh', width: '100vw' }}>
            <OrbitalStation3D portal />
        </div>
    );
}
