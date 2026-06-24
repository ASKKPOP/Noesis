/* Noēsis Forest — service worker (O3, MVP).
 * Installable + offline app-shell: network-first for navigations (fresh content
 * when online), cached shell when offline. Chat content itself is served live
 * from the grid; this just keeps the app reachable offline. */
const CACHE = 'forest-v1';
const SHELL = ['/portal'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || req.mode !== 'navigate') return;
    e.respondWith((async () => {
        try {
            const fresh = await fetch(req);
            const c = await caches.open(CACHE);
            c.put(req, fresh.clone());
            return fresh;
        } catch {
            return (await caches.match(req)) || (await caches.match('/portal')) || Response.error();
        }
    })());
});
