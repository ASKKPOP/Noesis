'use client';
/**
 * TabBar — three-tab WAI-ARIA tablist driving `/grid` view selection.
 * Active tab is derived from the `?tab=` querystring for in-page tabs
 * (firehose/economy), kept in sync via `router.replace(...)` so browser
 * back-button does not accumulate a history entry per tab click.
 * The 'culture' tab navigates to `/grid/culture` via `router.push`.
 * Keyboard navigation follows the activate-on-focus pattern.
 *
 * Per UI-SPEC §Interaction Contract:
 *   - `role="tablist"` container, each tab `role="tab"` + `aria-selected`
 *   - ArrowLeft/Right cycles between tabs; Home → first; End → last
 *   - `tabindex=0` on active, `-1` on inactive so Tab enters the tablist
 *     once and keyboard users arrow within it
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useRef, type KeyboardEvent } from 'react';

type Tab = 'firehose' | 'economy' | 'culture';

interface TabDef {
    readonly id: Tab;
    readonly label: string;
    readonly testId: string;
}

const TABS: readonly TabDef[] = [
    { id: 'firehose', label: 'Firehose + Map', testId: 'tab-firehose' },
    { id: 'economy', label: 'Economy', testId: 'tab-economy' },
    { id: 'culture', label: 'Culture', testId: 'tab-culture' },
];

function resolveActive(paramValue: string | null, pathname: string): Tab {
    if (pathname === '/grid/culture') return 'culture';
    return paramValue === 'economy' ? 'economy' : 'firehose';
}

export function TabBar(): React.ReactElement {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const active = resolveActive(searchParams.get('tab'), pathname);
    const refs = useRef<Map<Tab, HTMLButtonElement>>(new Map());

    const activate = useCallback(
        (tab: Tab): void => {
            if (tab === 'culture') {
                router.push('/grid/culture');
                return;
            }
            const params = new URLSearchParams(searchParams.toString());
            if (tab === 'economy') {
                params.set('tab', 'economy');
            } else {
                params.delete('tab');
            }
            router.replace(`?${params.toString()}`);
            // Focus follows activation per the simple 2-tab ARIA pattern.
            refs.current.get(tab)?.focus();
        },
        [router, searchParams],
    );

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
        let nextTab: Tab | null = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const idx = TABS.findIndex((t) => t.id === active);
            const delta = e.key === 'ArrowRight' ? 1 : -1;
            nextTab = TABS[(idx + delta + TABS.length) % TABS.length]!.id;
        } else if (e.key === 'Home') {
            nextTab = TABS[0]!.id;
        } else if (e.key === 'End') {
            nextTab = TABS[TABS.length - 1]!.id;
        }
        if (nextTab !== null) {
            e.preventDefault();
            activate(nextTab);
        }
    };

    return (
        <div
            role="tablist"
            aria-label="Grid views"
            data-testid="tab-bar"
            onKeyDown={onKeyDown}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 40,
                borderBottom: '1px solid var(--rule)',
            }}
        >
            {TABS.map((t) => {
                const isActive = t.id === active;
                return (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        tabIndex={isActive ? 0 : -1}
                        data-testid={t.testId}
                        ref={(el) => {
                            if (el) refs.current.set(t.id, el);
                        }}
                        onClick={() => activate(t.id)}
                        style={{
                            padding: '0 12px',
                            height: '100%',
                            fontSize: 13,
                            fontFamily: 'var(--sans-portal)',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? 'var(--terracotta)' : 'var(--muted)',
                            background: 'transparent',
                            borderTop: 'none',
                            borderLeft: 'none',
                            borderRight: 'none',
                            borderBottomWidth: 2,
                            borderBottomStyle: 'solid',
                            borderBottomColor: isActive ? 'var(--terracotta)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'color 0.15s',
                        }}
                    >
                        {t.label}
                    </button>
                );
            })}
        </div>
    );
}
