'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

/** Full portal shell — editorial theme wrapping sidebar + header + content.
 *  On /portal/auth the shell is bypassed so the auth page renders full-screen. */
export function PortalShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { currentUser } = useHumanAuthStore();
    const [menuOpen, setMenuOpen] = useState(false);
    // Close sidebar when user navigates to a new route (Pitfall 6)
    useEffect(() => { setMenuOpen(false); }, [pathname]);

    // Auth and onboard pages are full-screen — no sidebar or header.
    if (pathname === '/portal/auth' || pathname === '/portal/onboard') {
        return <>{children}</>;
    }

    // Redirect first-time users to onboarding before any portal page.
    // Only fires when: user is authenticated AND not onboarded AND not already on the onboard page.
    if (currentUser !== null && currentUser.onboarded === false && pathname !== '/portal/onboard') {
        // Use router.replace (not push) — onboarding is required, not voluntary
        router.replace('/portal/onboard');
        return null; // render nothing while redirect is in flight
    }

    return (
        <div className="portal-theme flex h-screen overflow-hidden" style={{ background: 'var(--vellum)' }}>
            <PortalSidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
            <div className="flex flex-1 flex-col overflow-hidden" style={{ minWidth: 0 }}>
                <PortalHeader onMenuOpen={() => setMenuOpen(true)} />
                <main className="flex-1 overflow-y-auto" style={{ background: 'var(--vellum)' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
