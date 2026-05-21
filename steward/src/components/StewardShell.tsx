'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

function Dot({ color }: { color: string }) {
    return (
        <span
            style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
            }}
        />
    );
}

function NavSection({ title }: { title: string }) {
    return (
        <div
            style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#5a554e',
                padding: '16px 16px 6px',
            }}
        >
            {title}
        </div>
    );
}

function NavItem({ href, label, exact }: { href: string; label: string; exact?: boolean }) {
    const pathname = usePathname();
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/') || (href !== '/' && pathname.startsWith(href));
    const dotColor = active ? '#b8542f' : '#3a3630';
    return (
        <Link href={href} className={`steward-nav-link${active ? ' active' : ''}`}>
            <Dot color={dotColor} />
            {label}
        </Link>
    );
}

interface StewardShellProps {
    title: string;
    breadcrumb: string;
    children: React.ReactNode;
}

export default function StewardShell({ title, breadcrumb, children }: StewardShellProps) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <aside className="steward-sidebar">
                {/* Logo */}
                <div style={{ padding: '24px 16px 20px' }}>
                    <div
                        style={{
                            fontFamily: 'var(--serif)',
                            fontSize: 22,
                            fontWeight: 400,
                            color: '#e8e4dc',
                            letterSpacing: '0.02em',
                            lineHeight: 1,
                        }}
                    >
                        Noēsis
                    </div>
                    <div
                        style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 9,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: '#5a554e',
                            marginTop: 4,
                        }}
                    >
                        Steward Console
                    </div>
                </div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }} />

                {/* Operator section */}
                <NavSection title="Operator" />
                <NavItem href="/" label="Dashboard" exact />
                <NavItem href="/nous" label="Nous Roster" />
                <NavItem href="/economy" label="Economy" />
                <NavItem href="/governance" label="Governance" />
                <NavItem href="/users" label="Users" />
                <NavItem href="/firehose" label="Firehose" />
                <NavItem href="/audit" label="Audit Log" />

                {/* Grid section */}
                <NavSection title="Grid" />
                <NavItem href="/system" label="System" />
                <NavItem href="/map" label="World Map" />

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Version footer */}
                <div
                    style={{
                        padding: '16px',
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        color: '#3a3630',
                        letterSpacing: '0.1em',
                    }}
                >
                    v2.5 · Genesis Grid
                </div>
            </aside>

            {/* Main area */}
            <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Top header */}
                <header
                    style={{
                        height: 52,
                        background: 'var(--parchment)',
                        borderBottom: '1px solid var(--rule)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 32px',
                        position: 'sticky',
                        top: 0,
                        zIndex: 50,
                    }}
                >
                    <span
                        style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 11,
                            letterSpacing: '0.14em',
                            color: 'var(--muted)',
                            textTransform: 'uppercase',
                        }}
                    >
                        {breadcrumb}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span
                            style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 11,
                                color: 'var(--muted)',
                                background: 'var(--vellum)',
                                border: '1px solid var(--rule)',
                                borderRadius: 4,
                                padding: '3px 8px',
                            }}
                        >
                            {GRID_ORIGIN}
                        </span>
                        <span className="badge badge-online">
                            <Dot color="#2d7a2d" />
                            Grid Online
                        </span>
                    </div>
                </header>

                {/* Scrollable content */}
                <main style={{ flex: 1, padding: '32px 32px 48px', overflowY: 'auto' }}>
                    <div
                        style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 10,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--muted)',
                            marginBottom: 6,
                        }}
                    >
                        {breadcrumb}
                    </div>
                    <h1
                        style={{
                            fontFamily: 'var(--serif)',
                            fontSize: 34,
                            fontWeight: 400,
                            color: 'var(--ink)',
                            marginBottom: 28,
                            lineHeight: 1.1,
                        }}
                    >
                        {title}
                    </h1>
                    {children}
                </main>

                {/* Footer */}
                <footer
                    style={{
                        borderTop: '1px solid var(--rule)',
                        padding: '12px 32px',
                        fontFamily: 'var(--mono)',
                        fontSize: 10,
                        color: 'var(--muted)',
                        letterSpacing: '0.08em',
                    }}
                >
                    v2.5 · Steward Console · Genesis Grid
                </footer>
            </div>
        </div>
    );
}
