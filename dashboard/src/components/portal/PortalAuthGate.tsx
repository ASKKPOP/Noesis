'use client';

/**
 * PortalAuthGate — the Portal requires login (2026-06-12).
 *
 * Every /portal/* page is gated on a live Grid session
 * (GET /api/v1/portal/auth/me with credentials). Anonymous visitors are
 * redirected to /portal/auth. Only the auth page itself and the legal pages
 * (terms, privacy — which must be readable BEFORE signing up) stay public.
 *
 * The session cookie lives on the Grid API origin, so Edge middleware cannot
 * see it — the check has to happen client-side, before the portal shell
 * renders anything.
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

const PUBLIC_PREFIXES = ['/portal/auth', '/portal/terms', '/portal/privacy'];

function isPublicPath(pathname: string): boolean {
    return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

export default function PortalAuthGate({ children }: { children: ReactNode }) {
    const pathname = usePathname() ?? '/portal';
    const router = useRouter();
    const setUser = useHumanAuthStore((s) => s.setUser);
    const publicPage = isPublicPath(pathname);
    const [allowed, setAllowed] = useState(publicPage);

    useEffect(() => {
        if (publicPage) {
            setAllowed(true);
            return;
        }
        let cancelled = false;
        const gridApiBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
        const toAuth = () =>
            router.replace(`/portal/auth?next=${encodeURIComponent(pathname)}`);
        fetch(`${gridApiBase}/api/v1/portal/auth/me`, { credentials: 'include' })
            .then(async res => {
                if (cancelled) return;
                if (!res.ok) {
                    toAuth();
                    return;
                }
                // Hydrate the client auth store from the authoritative /me body so
                // currentUser survives a reload / direct-nav — not only right after
                // login. Without this the store is null on every fresh load and
                // Profile/PortalHeader render blank for a logged-in user.
                const user = await res.json().catch(() => null);
                if (cancelled) return;
                if (user) setUser(user);
                setAllowed(true);
            })
            .catch(() => {
                if (!cancelled) toAuth();
            });
        return () => {
            cancelled = true;
        };
    }, [pathname, publicPage, router, setUser]);

    if (!allowed) {
        return (
            <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-500">
                <div className="text-center">
                    <div className="mx-auto mb-3 h-8 w-8 animate-pulse rounded-full border border-neutral-700" />
                    <p className="font-mono text-xs tracking-widest">CHECKING SESSION…</p>
                </div>
            </div>
        );
    }
    return <>{children}</>;
}
