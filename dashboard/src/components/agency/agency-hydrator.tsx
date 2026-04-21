'use client';
/**
 * AgencyHydrator — SSR-pure bridge that calls agencyStore.hydrateFromStorage()
 * exactly once after client mount. Per D-01 the store must not auto-hydrate
 * at import time (that would execute localStorage during Next.js RSC
 * rendering and break the SSR snapshot lock to 'H1').
 *
 * Mounted from the root layout alongside <AgencyIndicator />. Returns null —
 * no DOM output, pure side-effect component.
 */

import { useEffect } from 'react';
import { agencyStore } from '@/lib/stores/agency-store';

export function AgencyHydrator(): null {
    useEffect(() => {
        agencyStore.hydrateFromStorage();
    }, []);
    return null;
}
