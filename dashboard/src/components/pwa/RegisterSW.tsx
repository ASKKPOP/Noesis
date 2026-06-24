'use client';

/** O3 Forest — register the service worker so the Portal is an installable,
 * offline-capable PWA. No-op where service workers are unavailable. */
import { useEffect } from 'react';

export function RegisterSW(): null {
    useEffect(() => {
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
        }
    }, []);
    return null;
}

export default RegisterSW;
