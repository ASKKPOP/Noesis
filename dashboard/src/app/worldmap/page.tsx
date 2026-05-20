/**
 * /worldmap — Noēsis Cyber Grid, full-screen isometric city view.
 * 22×22 tile grid with 7 district types, animated packets, matrix rain,
 * pan/zoom, night mode toggle, and district detail panels.
 */

import dynamic from 'next/dynamic';

const CyberWorldMap = dynamic(
    () => import('@/components/worldmap/CyberWorldMap'),
    { ssr: false },
);

export default function WorldmapPage(): React.ReactElement {
    return <CyberWorldMap />;
}
