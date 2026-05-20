/**
 * Grid layout — wraps all /grid routes in the editorial portal-theme so
 * CSS design tokens (--ink, --parchment, --terracotta, etc.) resolve correctly.
 */

import type { ReactNode } from 'react';

export default function GridLayout({ children }: { children: ReactNode }) {
    return (
        <div className="portal-theme" style={{ minHeight: '100vh', background: 'var(--vellum)' }}>
            {children}
        </div>
    );
}
