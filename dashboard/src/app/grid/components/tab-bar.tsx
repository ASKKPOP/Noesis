'use client';
/**
 * TabBar — two-tab WAI-ARIA tablist driving `/grid` view selection.
 * Active tab is derived from the `?tab=` querystring, kept in sync via
 * `router.replace(...)` so browser back-button does not accumulate a history
 * entry per tab click (operator is navigating a single dev view, not
 * browsing pages). Keyboard navigation follows the activate-on-focus
 * pattern because 2 tabs makes roving-tabindex + manual activation overkill.
 *
 * Per UI-SPEC §Interaction Contract:
 *   - `role="tablist"` container, each tab `role="tab"` + `aria-selected`
 *   - ArrowLeft/Right cycles between tabs; Home → first; End → last
 *   - `tabindex=0` on active, `-1` on inactive so Tab enters the tablist
 *     once and keyboard users arrow within it
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, type KeyboardEvent } from 'react';

type Tab = 'firehose' | 'economy';

interface TabDef {
    readonly id: Tab;
    readonly label: string;
    readonly testId: string;
}

const TABS: readonly TabDef[] = [
    { id: 'firehose', label: 'Firehose + Map', testId: 'tab-firehose' },
    { id: 'economy', label: 'Economy', testId: 'tab-economy' },
];

function resolveActive(paramValue: string | null): Tab {
    return paramValue === 'economy' ? 'economy' : 'firehose';
}

export function TabBar(): React.ReactElement {
    const router = useRouter();
    const searchParams = useSearchParams();
    const active = resolveActive(searchParams.get('tab'));
    const refs = useRef<Map<Tab, HTMLButtonElement>>(new Map());

    const activate = useCallback(
        (tab: Tab): void => {
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
            className="flex items-center gap-1 h-10 border-b border-neutral-800"
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
                        className={
                            isActive
                                ? 'px-3 h-full text-sm text-neutral-100 border-b-2 border-sky-400 font-medium'
                                : 'px-3 h-full text-sm text-neutral-400 border-b-2 border-transparent hover:text-neutral-200'
                        }
                    >
                        {t.label}
                    </button>
                );
            })}
        </div>
    );
}
