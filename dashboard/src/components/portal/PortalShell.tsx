'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';

/** Full portal shell — editorial theme wrapping sidebar + header + content.
 *  On /portal/auth the shell is bypassed so the auth page renders full-screen. */
export function PortalShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    // Auth page is full-screen — no sidebar or header.
    if (pathname === '/portal/auth') {
        return <>{children}</>;
    }

    return (
        <div className="portal-theme flex h-screen overflow-hidden">
            <PortalSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <PortalHeader />
                <main className="flex-1 overflow-y-auto" style={{ background: 'var(--vellum)' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
