'use client';
/**
 * AgencyHydrator — SSR-pure bridge that calls agencyStore.hydrateFromStorage()
 * exactly once after client mount. Per D-01 the store must not auto-hydrate
 * at import time (that would execute localStorage during Next.js RSC
 * rendering and break the SSR snapshot lock to 'H1').
 *
 * Mounted from the root layout alongside <AgencyIndicator />. Returns null —
 * no DOM output, pure side-effect component.
 *
 * Plan 06-06: Also installs the Playwright SC#4 test hook
 * `window.__testTriggerH4Force` when NEXT_PUBLIC_E2E_TESTHOOKS is set. The
 * hook fires a raw H4 POST against the mock grid so Playwright's
 * `page.route` interceptor can assert tier-at-confirm-time invariants
 * without wiring a real UI button (no Phase 6 dashboard surface uses
 * `useElevatedAction` yet — that lands with Phase 7 peer-dialogue UI).
 */

import { useEffect } from 'react';
import { agencyStore } from '@/lib/stores/agency-store';

export function AgencyHydrator(): null {
    useEffect(() => {
        agencyStore.hydrateFromStorage();

        // Playwright-only test hook (Plan 06-06 / SC#4). Guarded by the
        // E2E test-hook env flag; dead-code eliminated in production builds.
        if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_E2E_TESTHOOKS === '1') {
            interface TestHook { __testTriggerH4Force?: () => void }
            (window as unknown as TestHook).__testTriggerH4Force = (): void => {
                const origin = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://127.0.0.1:8080';
                void fetch(
                    `${origin}/api/v1/operator/nous/did:noesis:alice/telos/force`,
                    {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            tier: 'H4',
                            operator_id: 'op:00000000-0000-4000-8000-000000000000',
                            new_telos: { active_goals: [] },
                        }),
                    },
                ).catch(() => {
                    // Swallow — test harness only inspects request body,
                    // not response; network errors in dev are acceptable.
                });
            };
        }
    }, []);
    return null;
}
