'use client';

import type { ReactNode } from 'react';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';

/** Full portal shell — sidebar + header always visible on all /portal/* routes. */
export function PortalShell({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden">
            <PortalSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <PortalHeader />
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
