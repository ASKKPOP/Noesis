'use client';

/**
 * /nous — real-time Nous agent monitor.
 * Renders a full-screen isometric city canvas connected to the local
 * Noesis backend (ws://localhost:8080) with a live event-stream sidebar.
 */

import dynamic from 'next/dynamic';

const NousMonitor = dynamic(
    () => import('@/components/nous/NousMonitor'),
    { ssr: false },
);

export default function NousPage(): React.ReactElement {
    return <NousMonitor />;
}
