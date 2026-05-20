'use client';

import type { ReactNode } from 'react';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';

/** Full portal shell — editorial theme wrapping sidebar + header + content. */
export function PortalShell({ children }: { children: ReactNode }) {
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
