# Technology Stack — Dashboard v1 (Real-Time Activity Stream)

**Project:** Noēsis — Sprint 14 Dashboard
**Milestone:** DASH-01 (WebSocket real-time activity stream from Grid to browser)
**Researched:** 2026-04-17
**Overall confidence:** MEDIUM-HIGH (version pins verified against installed lockfile; ecosystem claims sourced from training data — see "Verification Notes" at bottom)

---

## TL;DR — What To Install

```bash
# In grid/ workspace
npm install @fastify/websocket @fastify/static
```

**That's it.** No new browser-side dependencies. No bundler. No framework. The dashboard v1 is a single `index.html` + `app.js` + `styles.css` served from `grid/public/` by `@fastify/static`, opening a WebSocket back to the same Fastify process with the native browser `WebSocket` API.

**Total new dependencies: 2.** Total new browser runtime dependencies: **0**.

---

## Recommended Stack

### Server Additions (grid/ workspace)

| Package | Target Version | Purpose | Why This Choice |
|---------|---------------|---------|-----------------|
| `@fastify/websocket` | `^11.0.0` | WebSocket endpoint at `/api/v1/audit/stream` | Official Fastify plugin. Wraps `ws` with Fastify's lifecycle (hooks, plugin system, error handling, graceful shutdown). v11 is the major aligned with Fastify 5. |
| `@fastify/static` | `^8.0.0` | Serve `dashboard/v1/` directory as static files | Official Fastify plugin. Handles ETags, range requests, content-type detection. v8 is the major aligned with Fastify 5. |

### Already Installed (no new work)

| Package | Installed Version | Role |
|---------|-------------------|------|
| `fastify` | **5.8.5** (verified in `package-lock.json`) | HTTP server |
| `@fastify/cors` | **10.1.0** (verified) | CORS (useful for future cross-origin Next.js dev) |
| `@fastify/rate-limit` | **10.3.0** (verified) | Protect the WS upgrade endpoint from abuse |
| `ws` | **8.20.0** (verified, transitive via `@libp2p/websockets`) | Underlying WS engine — `@fastify/websocket` pulls its own copy but the version family is proven in this repo |

### Browser Side (grid/public/dashboard/v1/)

**Zero dependencies.** Three files, served statically:

| File | Purpose | Size Target |
|------|---------|-------------|
| `index.html` | Static HTML shell with `<div id="events">` | < 2 KB |
| `app.js` | ~150 lines vanilla JS — `new WebSocket(...)` + DOM append | < 5 KB |
| `styles.css` | Minimal CSS for event list readability | < 2 KB |

**No React, no Next.js, no build step, no npm install in the browser path.** Refresh = redeploy.

### Wire Format

**JSON** over text frames. Not MessagePack. Not protobuf. Rationale below.

---

## Installation Commands

```bash
# From repo root — add to grid/ workspace
cd grid
npm install @fastify/websocket@^11 @fastify/static@^8

# Create v1 dashboard dir
mkdir -p public/dashboard/v1
touch public/dashboard/v1/{index.html,app.js,styles.css}
```

---

## Why Minimal Over Flexible

The question "what minimal stack?" has a strong answer because the problem is small:

- **3 Nous × 1 event/tick ≈ ~3 events/sec peak.** Orders of magnitude below anything that would stress JSON, stress a single-connection WebSocket, or stress DOM rendering.
- **Dashboard is observational, not interactive.** No forms, no state machines, no routing, no auth flows (yet). A framework buys you nothing when the UI is "append div to list."
- **Dashboard/ directory is empty shells.** `dashboard/src/{app,components,lib}/` exist but contain no files — verified via `find`. PROJECT.md claim of "Next.js already scaffolded" is **aspirational**, not actual. Nothing to throw away when we upgrade later.
- **Evidence trumps options.** Shipping a working stream in 1 sprint beats shipping half a Next.js setup in 2 sprints. Next.js is in the roadmap (DASH-02+) — get the server-side stream proven first.

The real risk isn't "dashboard is too simple." The real risk is **premature Next.js commitment locking in decisions** (state lib, query client, SSR/CSR boundary, routing) before we know what the data shape wants.

---

## Component Decisions — Rationale

### 1. `@fastify/websocket` vs raw `ws`

**Choose `@fastify/websocket`.**

| Factor | `@fastify/websocket` (v11) | Raw `ws` directly |
|--------|---------------------------|-------------------|
| Fastify 5 integration | Native plugin, uses `app.register()` | Manual HTTP server hook |
| Shares Fastify lifecycle (close, shutdown) | Yes | You wire it |
| Route-style handler (`app.get('/path', { websocket: true }, handler)`) | Yes | No — custom upgrade |
| Adds rate-limit/CORS hooks on upgrade | Reuses existing plugins | Bypasses them |
| Uses `ws` under the hood | Yes (same engine) | Same engine |
| Bundle/runtime cost over raw `ws` | Negligible | — |

**Verdict:** `@fastify/websocket` IS raw `ws` — it's a thin plugin wrapper. The only reason to skip it would be extreme control needs (custom sub-protocols, binary framing surgery) which we don't have. Use the idiomatic path.

**Server sketch (fits directly into existing `grid/src/api/server.ts`):**

```typescript
import websocketPlugin from '@fastify/websocket';

app.register(websocketPlugin, {
    options: { maxPayload: 1048576 }, // 1 MB frame cap
});

app.get('/api/v1/audit/stream', { websocket: true }, (socket, req) => {
    // Replay last N events on connect (optional v1)
    const recent = services.audit.query({ limit: 20 });
    socket.send(JSON.stringify({ type: 'replay', entries: recent }));

    // Subscribe to new entries via AuditChain's existing onTick or a new onEntry hook
    const unsubscribe = services.audit.subscribe((entry) => {
        socket.send(JSON.stringify({ type: 'entry', entry }));
    });

    socket.on('close', unsubscribe);
});
```

**Implementation note:** `AuditChain` in `grid/src/audit/chain.ts` currently exposes `query()` but not a subscription API. The Sprint 14 plan should add a minimal `subscribe(listener)` method following the WorldClock `onTick()` pattern already proven in `grid/src/clock/ticker.ts`. This is a ~10-line change, not a rewrite.

### 2. `@fastify/static` — is it idiomatic on Fastify 5?

**Yes.** It's the canonical Fastify answer for serving a directory. v8 is the Fastify 5 major. One alternative — embedding HTML as a string literal in a route handler — works for one page but doesn't scale to `app.js` + `styles.css` without hand-rolled content-type and caching logic. `@fastify/static` gives you that for free.

**Server sketch:**

```typescript
import fastifyStatic from '@fastify/static';
import path from 'node:path';

app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/dashboard/',
});
// Browser visits http://localhost:3000/dashboard/v1/
```

### 3. JSON vs MessagePack vs plain text

**Choose JSON.**

| Factor | JSON | MessagePack | Plain text (custom) |
|--------|------|-------------|---------------------|
| Browser support | Native `JSON.parse` | Needs `msgpackr` or similar (~15 KB gz) | Custom parser |
| Debuggability | Chrome DevTools WS tab shows it readable | Opaque bytes | Readable but non-standard |
| Payload size at 3 events/sec | ~200–500 B/event — totally fine | ~30% smaller — saves ~100 B/event | — |
| Wire cost at this scale | < 2 KB/sec | < 1.5 KB/sec | Same |
| Existing AuditChain serialization | Already JSON-shaped (verifiable via `audit/trail` REST endpoint) | Would add an encoding step | — |

**Verdict:** At 3 events/sec, MessagePack's size win saves **hundreds of bytes per second**. That's noise. JSON's debuggability is a real daily-productivity win. AuditChain events are already JSON-serializable (they're served as JSON from `/api/v1/audit/trail`). Reuse the same serializer.

Revisit only if (a) tick rate climbs >100 evt/sec or (b) event payloads grow >10 KB each. Neither is on the roadmap.

### 4. Browser-side: vanilla `WebSocket` vs a tiny library

**Choose vanilla `WebSocket` + ~30 lines of reconnect logic.**

| Option | Size | Maintenance | Verdict |
|--------|------|-------------|---------|
| Native `WebSocket` API | 0 KB | Built into every browser since forever | ✓ Start here |
| Hand-rolled reconnect (exponential backoff) | ~30 lines | You own it — no surprises | ✓ Include inline in `app.js` |
| `reconnecting-websocket` (joewalnes) | ~3 KB min | **Stale** — last meaningful release ~2019, tiny maintenance. Works but unloved. | ✗ Unnecessary |
| `partysocket` (PartyKit) | ~5 KB min | Active, TypeScript-first, modern successor to reconnecting-websocket | → Consider at Phase 3 if React dashboard needs it |
| `socket.io` | ~40 KB min | Adds server-side protocol — we don't need rooms/fallbacks | ✗ Overkill |

**Inline reconnect pattern (add to `app.js`, no dependency):**

```javascript
function connect() {
  const ws = new WebSocket(`ws://${location.host}/api/v1/audit/stream`);
  ws.onmessage = (ev) => render(JSON.parse(ev.data));
  ws.onclose = () => setTimeout(connect, Math.min(30000, backoff *= 2));
  ws.onopen = () => { backoff = 1000; };
}
let backoff = 1000;
connect();
```

That's it. No dependency. No build. No bundler. Readable by anyone who has ever seen a WebSocket.

---

## Explicit "Do NOT Add Yet" List

For Sprint 14 (DASH-01), explicitly DEFER:

| Package | Defer Until | Why |
|---------|-------------|-----|
| `next` | DASH-03 or Phase 3 | No routing/SSR/layout needs yet. One page, one stream. |
| `react` / `react-dom` | DASH-03 or Phase 3 | Nothing to compose. Adding React for a `<ul>` is negative-value. |
| `@tanstack/react-query` | Phase 3 (when REST polling complements WS) | WS push is the source of truth for v1; no cache to invalidate. |
| `zustand` / `jotai` / any state lib | Phase 3 | In-memory JS array is sufficient for <1000 events. Trim on overflow. |
| `tailwindcss` | Phase 3 or when Next.js lands | Plain CSS for 3 selectors is not worth a postcss pipeline. |
| `msgpackr` / `@msgpack/msgpack` | Probably never | See "JSON vs MessagePack" above. |
| `socket.io` / `socket.io-client` | Probably never | We don't need namespaces, rooms, or long-poll fallback. |
| `reconnecting-websocket` | Skip — go straight to `partysocket` if/when needed | Legacy; abandoned in effect. |
| `@fastify/sse` / server-sent events libs | Phase 3 if we want one-way only | WS is bidirectional and already chosen. SSE would be a lateral move, not a win. |
| Any testing-specific browser framework (Playwright, Cypress) for v1 | Phase 3 | Manual refresh + WS logs in DevTools is enough for initial validation. Grid already has vitest for the server side. |

---

## Integration With Existing Fastify 5 Server

The current `buildServer()` in `grid/src/api/server.ts` is a plain function returning a `FastifyInstance`. Adding WS + static is additive — **zero changes to existing routes**:

```typescript
// grid/src/api/server.ts — sketch of the addition
import websocketPlugin from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'node:path';

export function buildServer(services: GridServices): FastifyInstance {
    const app = Fastify({ logger: false });

    // NEW: static dashboard
    app.register(fastifyStatic, {
        root: path.join(process.cwd(), 'grid', 'public'),
        prefix: '/dashboard/',
    });

    // NEW: WebSocket
    app.register(websocketPlugin);

    // ... all existing routes unchanged ...

    // NEW: WS route (inside same buildServer for lifecycle hygiene)
    app.register(async (instance) => {
        instance.get('/api/v1/audit/stream', { websocket: true }, (socket) => {
            // subscribe/send as shown above
        });
    });

    return app;
}
```

**Lifecycle:** `@fastify/websocket` registers an `onClose` hook that cleanly terminates all WS connections when Fastify shuts down. The existing Docker stop signal path (from Sprint 13) will drain WS properly with no extra wiring.

**Rate limiting on WS upgrade:** The existing `@fastify/rate-limit` plugin covers the HTTP upgrade request by default. For per-message rate limiting, defer until we see evidence of abuse.

**CORS:** Not needed for v1 — the dashboard is same-origin (Fastify serves both `/dashboard/v1/` and the WS endpoint). When Next.js dev server lands (different origin, port 3001 → 3000), `@fastify/cors` already handles it and `@fastify/websocket` respects origin checks via `verifyClient`.

---

## Upgrade Path: Static HTML → Next.js 14+

The v1 choices are **deliberately upgrade-friendly**. Here's the concrete sequence when Next.js becomes worthwhile (projected Phase 3 or late DASH milestones):

### What survives the upgrade (load-bearing)

1. **Server-side WS endpoint (`/api/v1/audit/stream`)** — unchanged. Next.js becomes just another client.
2. **JSON event schema on the wire** — unchanged. No re-serialization work.
3. **`AuditChain.subscribe()` API** (added in Sprint 14) — unchanged. Powers any number of listeners.
4. **`@fastify/cors` config** — already installed; just add the Next.js dev origin to the allow-list.

### What gets replaced

1. `grid/public/dashboard/v1/` → becomes `dashboard/v2/` Next.js app, or archived as a fallback.
2. `@fastify/static` → optional. Keep it for `/dashboard/v1/` as a "no-JS-framework fallback" or drop it.
3. Vanilla `WebSocket` reconnect inline code → `partysocket` or a React hook wrapper (`usePartySocket`, `use-websocket`, or homegrown).

### Concrete Next.js upgrade steps (Phase 3)

```bash
# 1. Scaffold Next.js 14+ in the existing empty dashboard/ workspace
cd dashboard
npm init -y
npm install next@^14 react@^18 react-dom@^18 typescript @types/react @types/node
# (version ranges: verify current at install time — see "Verification Notes")

# 2. Add one dependency for robust WS client (optional)
npm install partysocket

# 3. In Next.js App Router: app/page.tsx uses useEffect + PartySocket
#    connecting to ws://localhost:3000/api/v1/audit/stream (the SAME endpoint v1 used)

# 4. Development workflow:
#    - Terminal 1: cd grid && npm run dev           (Fastify on :3000)
#    - Terminal 2: cd dashboard && next dev -p 3001 (Next.js on :3001)
#    - Add http://localhost:3001 to @fastify/cors allow-list

# 5. Production deployment:
#    - Option A (simple): next build && next export → static files served by @fastify/static
#    - Option B (proper): next start on :3001, reverse-proxy /api/* and /ws to :3000
```

**Key insight:** Because v1 is "WS endpoint + static HTML" and the WS endpoint is REST-adjacent, Next.js doesn't require any server rewrite. Next.js is purely a client. The Grid stays a Grid.

### What NOT to do during upgrade

- ❌ Don't move WS handling into Next.js API routes. Keep the stream in Fastify where the `AuditChain` lives. Next.js API routes would add a hop for zero benefit.
- ❌ Don't introduce a separate WS gateway service. One Fastify = one source of truth.
- ❌ Don't switch to Socket.IO "because Next.js examples use it." Native WS works; stay native.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Transport | WebSocket (`@fastify/websocket`) | Server-Sent Events (`@fastify/sse` or manual) | SSE is one-way + auto-reconnects natively — tempting — but WS is bidirectional and we'll want inspector-style queries (`subscribe to Nous X's events`) in DASH-03. Pick the superset once. |
| Transport | WebSocket | Long polling | Latency + overhead worse on every axis at this tick rate. |
| Transport | WebSocket | gRPC-web | Adds protobuf toolchain, binary framing, and a proxy layer (Envoy/grpcwebproxy). Overkill for 3 evt/sec JSON. |
| WS server plugin | `@fastify/websocket` | `ws` alone + manual `server.on('upgrade')` | Loses plugin lifecycle, rate-limit/CORS hook reuse. |
| WS server plugin | `@fastify/websocket` | Socket.IO | Adds custom protocol + fallback transports we don't need. |
| Static serving | `@fastify/static` | Nginx/Caddy in front | More moving parts; defer until prod reverse-proxy is designed. |
| Static serving | `@fastify/static` | Inline HTML string in a route | OK for one file, breaks down at 3. |
| Wire format | JSON | MessagePack | See dedicated section — scale doesn't justify it. |
| Browser WS | Native `WebSocket` + inline reconnect | `reconnecting-websocket` | Dependency is stale (~2019). Reconnect is 30 lines. |
| Browser WS | Native `WebSocket` + inline reconnect | `partysocket` | Good choice — but for Phase 3, not v1. Avoid npm install in v1 browser path entirely. |
| UI | Vanilla HTML + DOM append | React/Next.js now | Empty shells only — nothing to preserve. Ship stream first, UI framework when the shape is known. |
| UI | Vanilla HTML + DOM append | htmx + SSE fragments | Genuinely fun alternative, but introduces a new paradigm for the team. Save novelty budget for actual problems. |

---

## Sources & Verification Notes

### Directly verified (HIGH confidence — checked in this repo)

- Fastify **5.8.5** installed — `package-lock.json` line 4860
- `@fastify/cors` **10.1.0** installed — line 951
- `@fastify/rate-limit` **10.3.0** installed — line 1061
- `ws` **8.20.0** installed transitively — line 8994
- `dashboard/src/{app,components,lib}/` are empty directories — verified via `find` (no files returned)
- `grid/src/api/server.ts` exposes `buildServer(services)` returning `FastifyInstance` — direct read
- `grid/src/audit/chain.ts` already referenced; `onTick()` pattern lives in `grid/src/clock/ticker.ts` per milestone context

### Inferred from training data (MEDIUM confidence — verify at install time)

- `@fastify/websocket` **v11.x** is the Fastify 5-compatible major line. v10 was Fastify 4.
- `@fastify/static` **v8.x** is the Fastify 5-compatible major line. v7 was Fastify 4.
- `partysocket` is the modern successor to `reconnecting-websocket`; maintained by PartyKit/Cloudflare.
- Socket.IO ships at ~40 KB minified + its own protocol (not plain WebSocket-compatible).

**Verification gap:** No network access (WebSearch, WebFetch, and `npm view` all denied in this sandbox). The Fastify 5-aligned major versions for `@fastify/websocket` and `@fastify/static` should be confirmed with `npm view @fastify/websocket peerDependencies` / `npm view @fastify/static peerDependencies` before the install commits. The `^11` and `^8` ranges above are the best-known values as of training data cutoff (January 2026); if npm says otherwise at install time, trust npm.

### What the downstream consumer (roadmap/implementation) must verify

1. Run `npm view @fastify/websocket@latest version peerDependencies` — confirm it still lists `fastify: 5.x`.
2. Run `npm view @fastify/static@latest version peerDependencies` — same.
3. If either plugin has had a new major since April 2026 that bumps Fastify's peer to 6.x, pin to the last 5.x-compatible release instead.
4. After install, run `grid/`'s existing vitest suite — none of the new plugins should affect existing tests.

### Confidence summary

| Claim | Level | Source |
|-------|-------|--------|
| Fastify 5 is the installed version | HIGH | Lockfile line 4860 |
| `@fastify/websocket` is idiomatic for WS on Fastify | HIGH | Official Fastify org plugin, widely used |
| `@fastify/static` is idiomatic for static files on Fastify | HIGH | Official Fastify org plugin |
| Exact version ranges `^11` and `^8` are Fastify-5-aligned | MEDIUM | Training data; verify at install |
| JSON beats MessagePack at this scale | HIGH | Arithmetic — 3 evt/sec × 300 B = trivial |
| `reconnecting-websocket` is effectively abandoned | MEDIUM | Training-data recollection of repo activity — not critical; the conclusion (write 30 lines inline) holds regardless |
| Upgrade path to Next.js preserves server code | HIGH | Architectural — WS endpoint is transport-agnostic |
