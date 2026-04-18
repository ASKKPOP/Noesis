# Phase 3: Dashboard v1 — Firehose + Heartbeat + Region Map — Research

**Researched:** 2026-04-18
**Domain:** Next.js 15 dashboard consuming a Phase-2 WebSocket firehose from the Grid
**Confidence:** HIGH overall — milestone research already resolved every major stack decision; package versions verified against live npm registry on 2026-04-18; Phase 2 wire contract read directly from committed source.

---

## Summary

Phase 3 scaffolds a new `dashboard/` Next.js 15 workspace that connects to the Phase-2 `/ws/events` endpoint, renders a live firehose, a region-map with live Nous markers, and a tick heartbeat widget. Every protocol decision is already locked: frame shapes (`HelloFrame`, `EventFrame`, `DroppedFrame`, `ByeFrame`) are in `grid/src/api/ws-protocol.ts` [VERIFIED: file read]; server contract is proven by 30 unit + 9 integration tests in Phase 2 [VERIFIED: `.planning/phases/02-wshub-ws-events-endpoint/02-VERIFICATION.md`].

The research task reduces to: (1) pick the Next.js 15 app-router scaffolding shape that works as an npm workspace sibling to `grid/`, (2) pick a WS-client pattern that implements the Phase-2 `sinceId`/`dropped`/REST-refill protocol correctly, (3) pick the lightest-weight state layer that handles a 500-entry ring buffer + region map without re-rendering the world, (4) pick the map rendering approach (SVG hand-roll vs. `@xyflow/react`), and (5) stand up a Vitest + RTL test rig inside the dashboard workspace without polluting the Grid test runner.

**Primary recommendation:** Next.js 15 app-router + TypeScript + Tailwind in a new `dashboard/` workspace on port 3001, consuming `/ws/events` via a hand-rolled `WsClient` class (vanilla `WebSocket` + full-jitter backoff, no `partysocket` dependency — we already own the protocol), `useSyncExternalStore` bound to a single in-memory store (no Zustand for v1), an SVG-based region map (hand-drawn — 3 Nous, ≤ 10 regions makes `@xyflow/react`'s 80 KB bundle overkill), and Vitest + React Testing Library + Playwright for the browser-level "watch a tick" smoke test.

---

## User Constraints (from CONTEXT.md)

CONTEXT.md does not yet exist for Phase 3 (this research precedes it). The constraints below come from the upstream ROADMAP Phase-3 success criteria and from locked research decisions in `.planning/research/SUMMARY.md`.

### Locked Decisions (from SUMMARY.md §1 and ROADMAP Phase 3)

- **Framework:** Next.js 15, app router, TypeScript — not vanilla HTML. `dashboard/` workspace lives as a first-class npm workspace alongside `grid/` and `cli/` [VERIFIED: root `package.json` `workspaces: ["protocol","grid","cli","dashboard"]`].
- **Dev port:** 3001 — Grid stays on its default HTTP port (3000 family), same-origin in dev via `@fastify/cors` allowlist. [CITED: SUMMARY.md §2]
- **Transport:** WebSocket only (`/ws/events`), no SSE. Client-side glob filtering on `entry.eventType`.
- **Reconnect protocol:** Exponential backoff + jitter, track `lastSeenId`, resubscribe with `{type:"subscribe", sinceId: N}`; on `dropped` frame call `GET /api/v1/audit/trail?offset=sinceId`. [VERIFIED: Phase 2 replay semantics, `ws-hub.ts:318-339`]
- **Backpressure policy:** Client treats stream as best-effort; REST is authoritative. [CITED: SUMMARY.md §6 Q2]
- **Privacy:** Server-side allowlist already enforced (Phase 1 + Phase 2); dashboard consumes only allowlisted events. Client must NOT log payloads containing keys matching `/prompt|response|wiki|reflection|thought|emotion_delta/i` if such leak ever occurs — that's a server bug to report, not a client feature to support. [VERIFIED: `broadcast-allowlist.ts:70`]
- **Firehose cap:** 500 entries in DOM, ring-buffered. [CITED: ROADMAP Phase 3 SC#3]
- **Filter UX:** Firehose is filterable by event type (trade / message / movement / law). [CITED: AUDIT-03]
- **Heartbeat:** "Last event N seconds ago" staleness threshold at 2× tick rate. [CITED: ROADMAP Phase 3 SC#6]
- **Non-negotiables (PITFALLS integrity):** Dashboard must not regress Phase-1/Phase-2 integrity. It cannot crash in a way that pressures the server; cannot retry in a tight loop; must handle `bye` frame cleanly. [VERIFIED: PITFALLS.md §"Integrity Non-Negotiables"]

### Claude's Discretion

- **State management library:** Zustand vs. `useSyncExternalStore` + hand-rolled store vs. Jotai vs. plain useState+useRef. Research recommends `useSyncExternalStore` + a single class-based store; see §Architecture Patterns.
- **Map rendering:** Hand-rolled SVG vs. `@xyflow/react` (v12 — formerly `reactflow`). Research recommends SVG for v1 (3 Nous, ≤ 10 regions).
- **Reconnecting WS library:** `partysocket` vs. hand-rolled. Research recommends hand-rolled — we already own the `sinceId` resubscribe and `dropped`→REST-refill protocol that `partysocket` does not model.
- **Virtualization:** `react-window` vs. `@tanstack/react-virtual` vs. none. Research recommends **none** for v1 — 500 DOM nodes with fixed-row layout is cheap; virtualize only if profiling shows jank.
- **Styling:** Tailwind vs. CSS Modules vs. styled-components. Research recommends Tailwind v4 (first-class Next.js 15 support, zero build-config drama).
- **Test framework:** Vitest vs. Jest. Research recommends Vitest (Grid already uses Vitest; shared mental model; 10-20× faster than Jest per Next.js docs [CITED: nextjs.org/docs/app/guides/testing/vitest]).
- **E2E smoke test:** Playwright vs. manual. Research recommends ONE Playwright test ("open browser, connect, see 3 ticks arrive") plus Vitest for everything else.

### Deferred Ideas (OUT OF SCOPE)

Strictly out of scope for Phase 3 per the Phase-3 explicit scope in SUMMARY.md §7:

- **Nous inspector panel (NOUS-01..03)** — Phase 4.
- **Economy panel (ECON-01..03)** — Phase 4.
- **Per-Nous thought trace / memory highlights** — Phase 4+ (D-1, D-3 in FEATURES.md).
- **Multi-tab coordination (`SharedWorker`, `BroadcastChannel`)** — accept 1 WS per tab for v1 per PITFALLS §M2.
- **Docker polish / compose wiring for the dashboard service** — Phase 4 per ROADMAP.
- **Historical replay / scrubber** — v2, never in Sprint 14.
- **Auth / multi-user** — developer tool; `127.0.0.1` bind; `GRID_WS_SECRET` is the only auth surface (already wired in Phase 2).
- **Aggregate KPIs, XP bars, auto-summarization** — explicitly anti-features in FEATURES.md.

---

## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|-------------------------------|------------------|
| ACT-03 | Dashboard displays a scrolling live feed of events with timestamps and Nous attribution | §Standard Stack (firehose panel); §Code Examples (ring buffer + render pattern); §Pitfall M1 (DOM cap) |
| MAP-01 | Dashboard displays the Grid's region graph — nodes are regions, edges are connections | §Architecture Patterns "Region Map" (SVG path); §Standard Stack (map library decision); `GET /api/v1/grid/regions` exists [VERIFIED: `server.ts:69`] |
| MAP-02 | Each region shows which Nous are currently present | §Architecture Patterns "Region presence projection"; reduced from `nous.spawned` + `nous.moved` event stream into a `Map<regionId, Set<nousDid>>` |
| MAP-03 | When a Nous moves, their position updates on the map in real-time | §Code Examples "one-render-cycle movement" — apply the event in the same tick the frame arrives via `flushSync` + CSS transition, no layout animation dep |
| AUDIT-01 | Dashboard has an audit trail view that displays AuditChain events in sequence | Satisfied by firehose on `/grid` route; ACT-03 and AUDIT-01 are the same view |
| AUDIT-02 | Each audit entry shows event type, actor (Nous), timestamp, and relevant data | `AuditEntry` shape [VERIFIED: `grid/src/audit/types.ts:5`] — `eventType`, `actorDid`, `createdAt`, `payload` are all present on every frame |
| AUDIT-03 | Audit trail is filterable by event type (trade, message, movement, law) | §Architecture Patterns "Filter UX" — client-side filter on in-memory ring buffer; allowlist defines filterable types |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| WebSocket connection + reconnect + `sinceId` | Browser (client-side JS) | — | Server is stateless per Phase-2 `WsHub`; all session recovery (lastSeenId tracking, backoff timer, dropped-frame → REST refill) lives in the browser. |
| `dropped` frame → REST refill (GET `/audit/trail`) | Browser (client-side JS) | API / Backend (serves the REST) | Client decides when to refill; server provides the authoritative endpoint that already exists [VERIFIED: `server.ts:100`]. |
| Firehose ring buffer (last 500) | Browser (client-side JS) | — | Bounded memory + DOM cap lives wherever the DOM lives. No server participation. |
| Region-map layout and rendering | Browser (client-side JS — client component) | — | SVG + DOM only; no SSR benefit for live data. Region **graph** (nodes + edges) served by REST `/api/v1/grid/regions`; presence state derived client-side from events. |
| Nous presence projection (which Nous in which region) | Browser (client-side JS) | — | Event stream on browser is source of truth; server does not expose a `/api/v1/regions/presence` snapshot in Phase 3 — we project from `nous.spawned` + `nous.moved` events since connect time, with initial snapshot from `/audit/trail?type=nous.moved&limit=...`. |
| Tick heartbeat / staleness | Browser (client-side JS) | — | Staleness is a client-side timer against arrival time of the last frame; not a server concern. |
| Initial page shell | Frontend Server (Next.js SSR) | — | `/grid` route served statically; all dynamic content is client-component (`'use client'`). SSR exists only to serve the HTML shell. |
| Static assets (HTML, JS, CSS bundle) | CDN / Static (via Next.js) | — | In dev: Next.js dev server on `:3001`. In prod: `next build` + `next start` or static export. Phase 3 stops at "dev works"; Phase 4 handles Docker/prod. |
| Authentication (WS upgrade) | API / Backend | Browser (forwards token) | `GRID_WS_SECRET` env on server; browser reads from Next.js public env (`NEXT_PUBLIC_GRID_WS_SECRET` only if set — and only in localhost dev). |

**Tier-assignment anti-patterns we are explicitly avoiding:**
- ❌ Putting WS subscription logic into a Next.js API route (a server-side proxy to the Grid). No benefit, adds a hop, and the Grid already serves the WS directly same-origin via CORS.
- ❌ Putting presence projection into a server action. Would require the Next.js server to hold its own WS connection and duplicate what each browser does anyway.
- ❌ Fetching `/audit/trail` from a server component. Defeats the live-update contract; the client owns the freshness.

---

## Standard Stack

### Core

Versions verified against npm registry on 2026-04-18.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `^15.2.4` | App router, TypeScript-first framework, static + dynamic rendering | ROADMAP locks Next.js 15. Current stable as of March 2026; Next.js 16 exists (`16.2.4` is latest [VERIFIED: `npm view next version` returned `16.2.4`]) but we pin to **15** per ROADMAP decision. v15.2.4 is the last stable 15.x. [CITED: nextjs.org/blog/next-15] |
| `react` | `^19.2.5` | UI runtime | React 19 is Next.js 15's required runtime. `useSyncExternalStore` is in stable React 18+, so no upgrade risk. [VERIFIED: `npm view react version` → `19.2.5`] |
| `react-dom` | `^19.2.5` | DOM renderer | Paired with React 19. |
| `typescript` | `^5.5.0` | Static types | Matches Grid's `^5.5.0` (root `package.json`). Consistent mental model across workspaces. |
| `@types/react` | `^19.0.0` | Type defs | React 19-aligned. |
| `@types/react-dom` | `^19.0.0` | Type defs | React 19-aligned. |
| `@types/node` | `^20.0.0` | Node types | Matches Grid's Node ≥ 20 engine constraint [VERIFIED: `grid/package.json` `engines.node: ">=20.0.0"`]. |

### Supporting (small, focused additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tailwindcss` | `^4.0.0` | Utility CSS | v4 ships native PostCSS-free Next.js integration. Avoids a `postcss.config.js` tangle. Use for all styling. |
| `@tailwindcss/postcss` | `^4.0.0` | Build integration | Required for Next.js 15 + Tailwind 4 (Next docs canonical setup). |
| `clsx` | `^2.1.0` | Conditional className | 200-byte utility; used by every non-trivial Tailwind-based app. Avoids ad-hoc template-string concatenation. |

### Dev dependencies

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vitest` | `^4.1.0` | Test runner | Grid already uses Vitest 2 [VERIFIED: `grid/package.json`]; dashboard uses Vitest 4 (`@testing-library/react` 16 requires Vitest 1+; latest is `4.1.4` [VERIFIED: `npm view vitest version`]). The two workspaces have independent `vitest.config.ts` — no cross-contamination. |
| `@testing-library/react` | `^16.3.2` | Component testing | Canonical for React component tests; React 19-compatible since v16. [VERIFIED: `npm view @testing-library/react version` → `16.3.2`] |
| `@testing-library/jest-dom` | `^6.6.0` | DOM matchers | `toBeInTheDocument()` etc. |
| `@testing-library/user-event` | `^14.6.0` | User interaction simulation | Filter-by-type UX testing. |
| `jsdom` | `^25.0.0` | Browser env for Vitest | Vitest config `environment: 'jsdom'`. |
| `@vitejs/plugin-react` | `^5.0.0` | JSX transform for Vitest | Standard Vitest+React pair. |
| `@playwright/test` | `^1.50.0` | Browser-level smoke test | ONE test: "dev server + Grid up → page loads → 3 ticks arrive in firehose". Not a component-test replacement. |
| `eslint` | `^9.0.0` | Lint | Matches Grid's major. |
| `eslint-config-next` | `^15.0.0` | Next.js lint rules | Standard scaffold dep. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| Hand-rolled `WsClient` | `partysocket` (^1.1.16) | Active, TypeScript-first reconnecting WS wrapper (5 KB). | **Reject.** Phase 2 protocol needs `sinceId` resubscribe + `dropped`→REST refill, which partysocket does not model. Hand-rolling adds ~80 lines we'd write anyway as a `partysocket` handler. Owning the class makes the state machine testable directly. |
| `useSyncExternalStore` hand-rolled store | `zustand` (^5.0.12) | 1 KB, beloved DX, React 19-ready (v5 uses `useSyncExternalStore` internally). | **Defer.** For v1 with 2-3 stores (events buffer, presence map, heartbeat clock), one class + `useSyncExternalStore` is ~60 lines. Zustand is a reasonable upgrade in Phase 4 if inspector/economy grow the state graph. |
| SVG map | `@xyflow/react` (^12.10.2, formerly `reactflow`) | Drag, zoom, handle interactions, mini-map, ~80 KB gzipped. | **Reject for v1.** 3-10 region nodes, no interactivity beyond hover, no user-editable edges. SVG `<circle>` + `<line>` + CSS transitions beat a 80 KB dep. Revisit in Phase 4 if inspector wants to show edge-weighted trade volume or if regions exceed 25. [CITED: FEATURES.md TS-3 "No physics engine needed"] |
| No virtualization | `@tanstack/react-virtual` (^3.13.24) or `react-window` (^2.x) | 500 DOM rows is below every virtualization threshold I've ever seen cause jank. [CITED: tanstack/virtual discussions #459 — benchmark shows 1M cells work without virtualization-induced jank on modern hardware] | **Reject for v1.** Skip virtualization; revisit iff profiler shows >16 ms render on a scroll. DOM cap + fixed-height rows keeps cost O(1) per frame. |
| Vitest | Jest | Jest is Next.js 14 default; Next.js 15 docs now present Vitest first [CITED: nextjs.org/docs/app/guides/testing/vitest]. Vitest uses Vite transform — 10-20× faster than Jest for Next.js. | **Use Vitest.** Mental-model consistency with Grid. |
| Playwright | Cypress | Both viable. | **Use Playwright** — Next.js docs reference it; better for Chromium-only developer-tool smoke; lighter CI install. |

**Total new dependencies added to the repo:** ~12 runtime + dev deps, all verified current as of 2026-04-18.

### Installation

Verify before committing — a single `npm install` from the repo root writes into `dashboard/`:

```bash
# Version verification (claim-before-install)
npm view next@15 version                      # expect 15.x.y — pin to ^15.2.4 for the 15.2 line
npm view react@latest version                 # expect 19.x
npm view @testing-library/react@latest version # expect ≥ 16.3
npm view vitest@latest version                # expect ≥ 4.1

# Scaffolding (run from repo root)
# Option A — use `create-next-app` to generate dashboard/, then trim:
cd dashboard
npx create-next-app@^15 . \
    --typescript --tailwind --app --src-dir --no-eslint --no-import-alias --use-npm
# Option B — hand-author package.json + tsconfig + app/ skeleton (preferred for
# workspace hygiene; avoids create-next-app's lock-file behavior in a workspace).

# Dev deps
cd dashboard
npm install --save-dev \
    vitest@^4 \
    @testing-library/react@^16 \
    @testing-library/jest-dom@^6 \
    @testing-library/user-event@^14 \
    jsdom@^25 \
    @vitejs/plugin-react@^5 \
    @playwright/test@^1.50 \
    eslint@^9 eslint-config-next@^15

# Runtime deps
npm install --save clsx@^2
```

**Version verification confirmation (npm registry, 2026-04-18):**
- `next@latest` = 16.2.4 → pin Phase 3 to `^15` (Next.js 15 line, ROADMAP-locked) [VERIFIED]
- `react@latest` = 19.2.5 [VERIFIED]
- `@xyflow/react@latest` = 12.10.2 [VERIFIED — but not installed for v1]
- `zustand@latest` = 5.0.12 [VERIFIED — but not installed for v1]
- `partysocket@latest` = 1.1.16 [VERIFIED — but not installed for v1]
- `vitest@latest` = 4.1.4 [VERIFIED]
- `@testing-library/react@latest` = 16.3.2 [VERIFIED]
- `@tanstack/react-virtual@latest` = 3.13.24 [VERIFIED — but not installed for v1]

---

## Architecture Patterns

### System Architecture Diagram

```
 ┌────────────────────────────────────────────────────────────────────┐
 │ Grid (Phase 1 + Phase 2, unchanged)                                │
 │                                                                    │
 │  AuditChain.append ──onAppend──▶ WsHub ──allowlist──▶ ClientConn   │
 │                                                                    │
 │  REST: GET /api/v1/grid/regions, /api/v1/audit/trail?offset=N      │
 │  WS:   GET /ws/events  (hello, event, dropped, bye, ping/pong)     │
 └────────────────────────────┬───────────────────────────────────────┘
                              │ (both WS + REST same-origin,
                              │  or CORS in dev :3001 → :3000)
                              ▼
 ┌────────────────────────────────────────────────────────────────────┐
 │ Browser (Next.js 15 dashboard, port 3001)                          │
 │                                                                    │
 │  WsClient ──onFrame──▶ FirehoseStore  (ring buffer[500])           │
 │  (reconnecting,        │  └──useSyncExternalStore──▶ <Firehose />  │
 │   lastSeenId,          │                                           │
 │   full-jitter          ├──▶ PresenceStore (Map<regionId,Set<did>>) │
 │   backoff,             │       └──useSyncExternalStore──▶ <Map />  │
 │   dropped→REST)        │                                           │
 │                        └──▶ HeartbeatStore (lastTick, lastSeen)    │
 │                                └──useSyncExternalStore──▶ <HB />   │
 │                                                                    │
 │  On `dropped` frame: fetch(/api/v1/audit/trail?offset=sinceId)     │
 │    → push into FirehoseStore + PresenceStore                       │
 │                                                                    │
 │  On `bye` frame: stop auto-reconnect, show "Grid shutting down"    │
 └────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
dashboard/
├── package.json                     # new workspace
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts                 # separate from grid/
├── playwright.config.ts
├── src/
│   ├── app/                         # Next.js 15 app router
│   │   ├── layout.tsx               # root HTML shell (server component)
│   │   ├── page.tsx                 # redirect → /grid
│   │   └── grid/
│   │       ├── page.tsx             # server-shell; renders <GridClient/>
│   │       └── GridClient.tsx       # 'use client' — mounts stores, subscribes
│   ├── components/
│   │   ├── Firehose.tsx             # ring-buffered event list + filter chips
│   │   ├── Heartbeat.tsx            # tick count + staleness indicator
│   │   ├── RegionMap.tsx            # SVG <Map/> with <RegionNode/> + <NousMarker/>
│   │   └── EventTypeFilter.tsx      # checkbox chips: trade/message/movement/law
│   ├── lib/
│   │   ├── ws-client.ts             # WsClient class — reconnect + sinceId
│   │   ├── ws-protocol.ts           # COPY of grid/src/api/ws-protocol.ts types
│   │   ├── audit-types.ts           # COPY of grid/src/audit/types.ts (AuditEntry)
│   │   ├── store-firehose.ts        # FirehoseStore class + useFirehose()
│   │   ├── store-presence.ts        # PresenceStore + usePresence()
│   │   ├── store-heartbeat.ts       # HeartbeatStore + useHeartbeat()
│   │   └── env.ts                   # NEXT_PUBLIC_GRID_ORIGIN (default ws://localhost:3000)
│   └── test/
│       ├── setup.ts                 # @testing-library/jest-dom setup
│       └── mocks/
│           └── mock-websocket.ts    # FakeSocket for WsClient tests
├── test/                            # Playwright tests (Next convention)
│   └── grid-page.spec.ts            # smoke: open page, see 3 ticks
└── public/                          # static assets (Next.js default)
```

**Workspace integration notes:**

- `dashboard/` is already declared in root `workspaces` [VERIFIED: `/package.json`]. `npm install` at the root installs into `dashboard/node_modules` (hoisted where possible).
- Turborepo `turbo.json` already runs `build`, `test`, `lint` across workspaces [VERIFIED: `/turbo.json`]. Add `dashboard/` as a sibling — no root config change needed.
- **DO NOT** share `tsconfig.json` with `grid/` — Next.js requires its own `jsx: "preserve"`, which breaks Grid's NodeNext ESM resolution.
- **DO NOT** import from `grid/src/*` directly. Copy the three small type modules (`ws-protocol.ts`, `audit-types.ts`, `ring-buffer.ts` if needed) into `dashboard/src/lib/`. The alternative (a shared `protocol/` workspace) is a Phase-4+ cleanup — v1 ships with explicit duplication flagged by a `// SYNC WITH grid/src/api/ws-protocol.ts` header comment.

### Pattern 1: WsClient state machine

**What:** A class that owns the single WebSocket instance, implements reconnect with full-jitter exponential backoff, tracks `lastSeenId`, handles `subscribe`/`event`/`dropped`/`bye` frames, and exposes a small event-bus API to the stores.

**When to use:** This is the only production-grade way to implement the Phase-2 protocol correctly. Every other approach either misses `sinceId` resume (`partysocket` alone) or leaks (naïve `new WebSocket` in a `useEffect`).

**Full-jitter backoff formula** [VERIFIED: AWS Architecture Blog "Exponential Backoff And Jitter"]:

```
delay = Math.random() * Math.min(CAP, BASE * 2^attempt)
```

Values (matching PITFALLS M3 "250ms → 30s cap" guidance):

```
BASE = 250 ms
CAP = 30_000 ms
attempt ∈ [0, 10]   // cap attempt count; beyond ~10, delay is already saturated at CAP
```

**Rationale for "full jitter" over "equal jitter":** Full jitter gives the best server-side decorrelation when N tabs all reconnect simultaneously after `docker compose restart grid`. [CITED: aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ — "substantial decrease in client work and server load"]

**Example:**

```typescript
// Source: PITFALLS.md M3 + AWS blog on full-jitter
// src/lib/ws-client.ts
import type { ClientFrame, ServerFrame } from './ws-protocol.js';

export interface WsClientOptions {
    url: string;             // e.g. ws://localhost:3000/ws/events
    token?: string;          // GRID_WS_SECRET when bound to 0.0.0.0
    filters?: string[];      // glob patterns
    onFrame: (f: ServerFrame) => void;
    onStatusChange: (s: 'connecting' | 'open' | 'reconnecting' | 'closed') => void;
}

export class WsClient {
    private socket: WebSocket | null = null;
    private attempt = 0;
    private lastSeenId = 0;
    private shouldReconnect = true;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private opts: WsClientOptions) {}

    start(): void {
        this.shouldReconnect = true;
        this.connect();
    }

    stop(): void {
        this.shouldReconnect = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.socket?.close(1000, 'client stop');
    }

    private connect(): void {
        this.opts.onStatusChange(this.attempt === 0 ? 'connecting' : 'reconnecting');
        const url = this.opts.token ? `${this.opts.url}?token=${encodeURIComponent(this.opts.token)}` : this.opts.url;
        this.socket = new WebSocket(url);
        this.socket.addEventListener('open', () => {
            this.attempt = 0;
            this.opts.onStatusChange('open');
            // Resubscribe with lastSeenId → server replays or tells us to REST-refill
            this.send({ type: 'subscribe', filters: this.opts.filters, sinceId: this.lastSeenId || undefined });
        });
        this.socket.addEventListener('message', (ev) => {
            try {
                const frame = JSON.parse(String(ev.data)) as ServerFrame;
                if (frame.type === 'event' && typeof frame.entry.id === 'number') {
                    this.lastSeenId = Math.max(this.lastSeenId, frame.entry.id);
                }
                if (frame.type === 'bye') {
                    this.shouldReconnect = false; // clean server shutdown — don't hammer
                }
                this.opts.onFrame(frame);
            } catch {
                // malformed frame — log and ignore
            }
        });
        this.socket.addEventListener('close', () => {
            this.opts.onStatusChange('closed');
            if (!this.shouldReconnect) return;
            const delay = Math.random() * Math.min(30_000, 250 * Math.pow(2, this.attempt));
            this.attempt = Math.min(this.attempt + 1, 10);
            this.reconnectTimer = setTimeout(() => this.connect(), delay);
        });
    }

    private send(frame: ClientFrame): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(frame));
        }
    }
}
```

### Pattern 2: Store + `useSyncExternalStore`

**What:** One class per concern (firehose events, region presence, heartbeat). Each holds its state in a plain JS field, notifies a `Set<() => void>` of React subscribers when the field mutates, and exposes a `useX()` hook that binds to `useSyncExternalStore`.

**When to use:** When you have high-frequency updates (hundreds/sec theoretical, realistically ~3/sec) and need to avoid re-rendering the whole world. Each consumer component subscribes to exactly the slice it needs.

**Why this over Zustand for v1:** Two reasons. (1) Zustand is 1 KB but we have 3 stores total and no middleware need. (2) `useSyncExternalStore` is the React 19-native way; Zustand v5 uses it internally anyway [CITED: react.dev/reference/react/useSyncExternalStore]. A thin hand-roll teaches the team exactly what's happening and is trivially testable. Revisit in Phase 4 if we add 5+ stores.

**Example — FirehoseStore (ring buffer + DOM cap):**

```typescript
// Source: React 19 docs + PITFALLS M1 (unbounded DOM growth)
// src/lib/store-firehose.ts
import { useSyncExternalStore } from 'react';
import type { AuditEntry } from './audit-types.js';

const CAPACITY = 500;

export class FirehoseStore {
    private entries: AuditEntry[] = [];               // newest at tail
    private listeners = new Set<() => void>();

    push(entry: AuditEntry): void {
        // Dedupe by id — `sinceId` replays can collide with live frames arriving in parallel
        if (this.entries.length > 0 && entry.id !== undefined) {
            const last = this.entries[this.entries.length - 1];
            if (last?.id === entry.id) return;
        }
        this.entries.push(entry);
        if (this.entries.length > CAPACITY) this.entries.shift();
        this.emit();
    }

    pushBatch(entries: AuditEntry[]): void {
        for (const e of entries) this.push(e);
    }

    getSnapshot = (): readonly AuditEntry[] => this.entries;

    subscribe = (cb: () => void): (() => void) => {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    };

    private emit(): void {
        // Immutable snapshot — useSyncExternalStore requires reference equality to avoid re-render
        this.entries = [...this.entries];
        for (const l of this.listeners) l();
    }
}

export const firehose = new FirehoseStore();

export function useFirehose(): readonly AuditEntry[] {
    return useSyncExternalStore(firehose.subscribe, firehose.getSnapshot, firehose.getSnapshot);
}
```

**Critical detail:** `emit()` MUST create a new array reference. `useSyncExternalStore` uses `Object.is` to decide whether to re-render — mutating in place would be invisible to React. [CITED: react.dev/reference/react/useSyncExternalStore — "getSnapshot should return an immutable snapshot"]

### Pattern 3: Region Map — SVG with CSS-transition movement

**What:** A single `<svg>` with `<circle>` per region (from `GET /api/v1/grid/regions`), `<line>` for connections (region.connections), and one `<g>` per Nous-marker that transitions its `cx/cy` via CSS `transition: transform 200ms` when presence changes.

**When to use:** When region count ≤ ~25 and edges are static (graph shape known at page load). For 3 Nous across ≤ 10 regions, this is 30-50 SVG elements total — trivially performant.

**One-render-cycle movement (MAP-03):**

```typescript
// Source: MDN SVG + React 19 flushSync docs
// src/components/RegionMap.tsx  (excerpted)
'use client';
import { flushSync } from 'react-dom';
import { useEffect } from 'react';
import { usePresence } from '../lib/store-presence.js';

// Each marker has a stable React `key` = did. When presence flips a Nous from
// region A → region B, the marker's computed {cx, cy} changes. CSS `transition`
// on the <g transform="translate(x,y)"> smoothly moves it.
// flushSync ensures the DOM update happens in the same event loop tick as the
// `nous.moved` frame arrival, satisfying "within one render cycle".

const MARKER_TRANSITION = 'transform 250ms cubic-bezier(0.4,0,0.2,1)';

// In the WS message handler (GridClient.tsx):
function onFrame(f: ServerFrame) {
    if (f.type === 'event' && f.entry.eventType === 'nous.moved') {
        flushSync(() => {
            presence.moveNous(f.entry.actorDid, f.entry.payload.toRegion as string);
        });
    }
}
```

**Why `flushSync` here and nowhere else:** React batches state updates by default. For the firehose we WANT batching (prevents re-render storms at 500 evt/sec). For the map we want every `nous.moved` to paint in the same frame — the map has at most 3 markers and ≤ 10 regions, so forcing a sync render costs microseconds. [CITED: react.dev/reference/react-dom/flushSync — "Use for critical integrations" guidance]

### Pattern 4: Heartbeat Staleness

**What:** A store with two fields — `lastTick` (from the most recent `tick` event) and `lastSeen` (wall-clock `Date.now()` at any event arrival) — plus a periodic `setInterval` that forces a re-render every 500ms so the "N seconds ago" label stays fresh.

**Staleness threshold:** 2× tick rate. Tick rate comes from the `tick` event's `payload` (check `grid/src/clock/ticker.ts` — but the planner should confirm the exact payload shape; hypothesis is `{tickMs: number}`). If no tick frames have arrived yet, default to 30_000 ms threshold per PROJECT default tick rate.

**Example:**

```typescript
// src/components/Heartbeat.tsx
'use client';
import { useEffect, useState } from 'react';
import { useHeartbeat } from '../lib/store-heartbeat.js';

export function Heartbeat() {
    const { lastTick, lastSeen, tickMs } = useHeartbeat();
    const [, forceRender] = useState(0);
    useEffect(() => {
        const t = setInterval(() => forceRender((n) => n + 1), 500);
        return () => clearInterval(t);
    }, []);
    const ageMs = lastSeen ? Date.now() - lastSeen : Infinity;
    const threshold = (tickMs ?? 30_000) * 2;
    const isStale = ageMs > threshold;
    return (
        <div className={clsx('heartbeat', isStale && 'text-red-500')}>
            tick #{lastTick ?? '—'} · last event {formatAge(ageMs)}
        </div>
    );
}
```

### Pattern 5: Filter UX (client-side, zero additional state)

**What:** An array of enabled event-type *prefixes* (e.g., `['trade.', 'nous.moved', 'law.', 'nous.spoke', 'nous.direct_message']`). The `<Firehose/>` component filters the ring buffer in-render using `entries.filter(e => prefixes.some(p => e.eventType.startsWith(p)))`.

**When to use:** When filtered set is small (a few hundred entries at most). For v1 this is fine: 500 entries × 10 filter checks = 5000 ops/render; runs in well under 1 ms.

**Why not precompute a separate filtered ring buffer:** More moving parts, more memory, no measurable speedup at this scale. Revisit only if profiling disagrees.

### Anti-Patterns to Avoid

- **Creating the WebSocket inside a React component render.** Must be created once, outside React's reconciliation — either inside a ref (useEffect with empty dep array) or in a module-scope singleton owned by `GridClient.tsx`'s mount effect. [CITED: PITFALLS M3]
- **Appending every event as a fresh DOM node forever.** Use the 500-cap ring buffer. [CITED: PITFALLS M1]
- **Setting React state from inside `ws.onmessage` without batching.** At ~3 evt/sec this is fine, but under a replay surge (`sinceId` resubscribe returning 500 entries) the naïve path re-renders 500 times. Use `pushBatch()` that emits once after the whole batch. [CITED: PITFALLS M4]
- **Retrying on `bye` frame.** Server-initiated `bye` (reason=shutdown) means the operator is explicitly stopping the Grid. Auto-reconnect in a loop hammers a dying server. Respect the frame, show a UI message, require manual reconnect. [CITED: PITFALLS M3]
- **Using `window.location.origin` for the WS URL.** Wrong in dev — dashboard is on `:3001` but WS is on the Grid's port. Use `NEXT_PUBLIC_GRID_ORIGIN` env (default `ws://localhost:3000`). Convert `http://` to `ws://`, `https://` to `wss://`.
- **Rendering region map nodes from events alone.** Region graph (nodes + edges) is stable at page load — fetch once from `GET /api/v1/grid/regions`. Events only update presence, not topology.
- **Using Next.js Server Components for anything dynamic.** Every dynamic panel must be `'use client'`. Mixing RSC data-fetching with live WS state creates tearing — the RSC snapshot is stale before the page renders.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reconnecting WS state machine | A Rube-Goldberg useEffect tree | The `WsClient` class in §Pattern 1 (hand-rolled — but as a class, not scattered hooks) | Keeping it a class makes the state machine testable in isolation without React. |
| Full-jitter backoff | `setTimeout(() => ws = new WebSocket(...), 1000)` style retry | `delay = Math.random() * Math.min(CAP, BASE * 2^attempt)` | Synchronized retry storms on server restart otherwise. [VERIFIED: AWS blog] |
| Ring buffer / DOM cap | `entries.length > 500 && entries.shift()` inline in JSX | A `FirehoseStore.push()` method that enforces capacity before notify | Prevents double-render (mutate + render) and keeps the invariant testable. |
| External store pattern | `useState([])` with append-in-useEffect | `useSyncExternalStore` bound to a plain class | Tearing-safe under concurrent rendering. React 19's canonical answer. |
| SVG marker animation | Manual `requestAnimationFrame` loop | CSS `transition: transform 250ms` on a `<g transform=...>` | Browser does it for free on GPU; no JS per frame. |
| Fetching audit trail | Hand-written `XMLHttpRequest` | Native `fetch` (Next.js 15 auto-polyfills on server + browser) | It's 2026. |
| Rendering a 10-node graph | Installing `@xyflow/react` (80 KB gzipped) | 30 lines of SVG | The library solves drag/zoom/layout/handles we don't need. |
| State management | `zustand`, `jotai`, `redux` for v1 | `useSyncExternalStore` | 3 stores × 60 lines each = 180 LOC. The library would be 180 LOC of wrapper around the same primitive. |
| Virtualization | `react-window`, `@tanstack/react-virtual` | Nothing, until profiling disagrees | 500 fixed-height DOM rows paints in <4 ms on any machine that can run the simulation. |
| WebSocket wrapper | `partysocket`, `reconnecting-websocket` | The `WsClient` class in §Pattern 1 | Neither library implements the `sinceId` resubscribe + `dropped`→REST refill protocol Phase 2 requires. |
| Date formatting | `date-fns`, `luxon` for "N seconds ago" | 10 lines: `Math.round(ageMs/1000) + 's ago'` | Bundle size > problem size. |

**Key insight:** The discipline here is the inverse of typical React advice. The dashboard is a *single-purpose* instrument with a *fixed* feature set (firehose + map + heartbeat). Every library we skip is one less thing that can conflict with React 19, Next.js 15, Tailwind 4, or each other across future upgrades. Ship the minimum; revisit when Phase 4 shows concrete pain.

---

## Runtime State Inventory

**Not applicable — Phase 3 is greenfield.** No renames, no refactors, no migrations. The `dashboard/` workspace is declared but the directory does not exist on disk [VERIFIED: `ls /dashboard` → "No such file or directory"]. Everything is additive.

**Nothing found in any category:**

- Stored data: none — dashboard has no persistent state.
- Live service config: none — no new service; new workspace added to existing Turborepo.
- OS-registered state: none.
- Secrets/env vars: `NEXT_PUBLIC_GRID_ORIGIN` (new, non-secret) + `NEXT_PUBLIC_GRID_WS_SECRET` (new, optional, mirrors the server-side `GRID_WS_SECRET` so client can present the bearer token). Document in `dashboard/.env.example`.
- Build artifacts: none — `next build` output lives under `dashboard/.next/`, already gitignored by default Next.js scaffold.

---

## Common Pitfalls

### Pitfall 1: WS URL built wrong in dev (M5-adjacent)
**What goes wrong:** Browser connects to `ws://localhost:3001/ws/events` (its own port) instead of the Grid's port. Silent failure or 404.
**Why it happens:** Using `location.host` or `window.location.origin` as the WS base.
**How to avoid:** `NEXT_PUBLIC_GRID_ORIGIN` env var; default `http://localhost:3000`; convert protocol scheme client-side (`http→ws`, `https→wss`).
**Warning signs:** Status indicator stuck on "connecting" in dev; nothing in the DevTools Network → WS tab pointing at `:3000`.

### Pitfall 2: CORS on WS upgrade differs from CORS on REST
**What goes wrong:** REST calls from `:3001` to `:3000` fail with CORS, OR WS upgrade succeeds but REST refill fails.
**Why it happens:** `@fastify/cors` already installed on the Grid [VERIFIED: `grid/package.json`], but its dev allowlist may not include `http://localhost:3001`.
**How to avoid:** Phase 3 task must add `http://localhost:3001` to the Grid's CORS allowlist (see `grid/src/api/server.ts` — the planner must verify the current CORS config and add the dev origin). This is a *Grid-side* change that Phase 3 triggers.
**Warning signs:** Red-bordered CORS errors in DevTools Console when the firehose hits `/api/v1/audit/trail?offset=...` on a dropped frame.
**Action:** Planner MUST add a task to update Grid CORS allowlist.

### Pitfall 3: Replay flood on first connect
**What goes wrong:** Page loads, `WsClient.start()` subscribes with `sinceId=0`, server replays up to REPLAY_WINDOW (512) entries [VERIFIED: `ws-hub.ts:61`]. Naïve `store.push` re-renders 512 times.
**Why it happens:** One React render per event is fine for live rate (~3/sec) but catastrophic for replays.
**How to avoid:** `WsClient` buffers events that arrive within a 16 ms window and flushes them in one batch via `store.pushBatch(entries)`. Stores emit exactly one listener notification per batch.
**Warning signs:** First-connect devtools profile shows a >200 ms main-thread stall.

### Pitfall 4: Dropped frame → infinite refill loop
**What goes wrong:** `dropped {sinceId, latestId}` arrives. Client fetches `/audit/trail?offset=sinceId`, but while the REST response is in flight, another `dropped` arrives. Client fires another fetch. Cascade.
**Why it happens:** No in-flight guard.
**How to avoid:** Single in-flight refill per client; subsequent `dropped` frames while refilling just extend the `latestId` target. On completion, check if `lastSeenId < latestId` and refire if so.
**Warning signs:** DevTools Network tab shows N+1 parallel GETs to `/audit/trail`.

### Pitfall 5: Background tab suspension breaks lastSeenId
**What goes wrong:** User backgrounds the tab; Chrome suspends timers; WS drops; reconnect timer doesn't fire until tab reactivates; user comes back 10 min later and sees a gap.
**Why it happens:** Modern browsers throttle background tab timers aggressively. Expected, not a bug.
**How to avoid:** Accept gracefully — on tab re-focus (`document.visibilitychange`), if `readyState !== OPEN`, immediately `connect()` without waiting out the backoff. The `sinceId` + server replay (or REST refill on overflow) handles the gap correctly.
**Warning signs:** User reports "blank firehose after backgrounding" — the fix is the visibilitychange listener.

### Pitfall 6: `nous.moved` arrives before `nous.spawned` (replay ordering)
**What goes wrong:** On replay of an older window, a move event for a Nous references a region that presence hasn't placed the Nous in yet. Null-ref crash.
**Why it happens:** `nous.spawned` might be outside the REPLAY_WINDOW; `nous.moved` made it in.
**How to avoid:** `PresenceStore.moveNous(did, toRegion)` is idempotent and defensive — it adds `did` to `toRegion` without requiring a prior `spawn`. Also: an initial hydration step on page load — `GET /api/v1/grid/regions` already returns region structure; combine with a one-time `GET /api/v1/audit/trail?type=nous.spawned` to seed known DIDs.
**Warning signs:** Console warnings "moving unknown Nous"; markers vanishing.

### Pitfall 7: Filter state lost on reconnect
**What goes wrong:** User unchecks "law" events, reconnect happens, server starts sending all allowlisted types again, law events flood the firehose.
**Why it happens:** Filters live in client state (filter chips component) but the WS subscribe frame uses `filters: []` meaning "all".
**How to avoid:** Either (A) keep filters client-only and apply on render (simplest, recommended — filter is cheap on 500 entries), or (B) translate checkbox state to WS `filters` glob on every subscribe. Go with (A) for v1 — (B) couples UI to server protocol unnecessarily.
**Warning signs:** Filter chips appear to "forget" after a reconnect.

### Pitfall 8: React 19 + Next.js 15 `'use client'` forgotten on a component that uses hooks
**What goes wrong:** Runtime error: "You're importing a Component that needs useEffect. This React Hook only works in a Client Component."
**Why it happens:** Default in app router is Server Component. Every component with state/effects/event handlers must declare `'use client'` at the top of the file (or be imported from one that does).
**How to avoid:** Every file under `src/components/` starts with `'use client';`. Only `src/app/**/layout.tsx` and `src/app/**/page.tsx` are server components (and `page.tsx` for `/grid` just renders `<GridClient/>`, a client component).
**Warning signs:** Dev server error on first load; error message is explicit enough to fix in <30 seconds.

### Pitfall 9: `AuditEntry.id` optional, dashboard assumes present
**What goes wrong:** `AuditEntry.id` is typed `id?: number` [VERIFIED: `grid/src/audit/types.ts:6`]. Client code does arithmetic on it and gets `NaN`.
**Why it happens:** Persistence layer (Phase-1 MySQL restore path) can produce entries without `id` in theory, though Phase-2 `EventFrame` docs assert `entry.id must be present` [CITED: `02-01-PLAN.md <interfaces>` line 73].
**How to avoid:** On every incoming `EventFrame`, validate `typeof entry.id === 'number'`; skip otherwise. The server contract guarantees this for live frames; REST `/audit/trail` may or may not — verify via Zod-lite narrowing or inline guard.
**Warning signs:** `NaN` in lastSeenId; dropped frames triggering full refills repeatedly.

### Pitfall 10: Tailwind 4 + Next.js 15 PostCSS config
**What goes wrong:** Tailwind 4 requires the `@tailwindcss/postcss` package, not the old `tailwindcss` postcss plugin path.
**Why it happens:** Tailwind 4 restructured the PostCSS integration. Old Next.js + Tailwind 3 tutorials point to the wrong config.
**How to avoid:** Follow Next.js 15 + Tailwind 4 canonical setup [CITED: nextjs.org/docs/app/guides/testing/vitest for the sibling Vitest config; Tailwind docs for the plugin].
**Warning signs:** `next dev` starts but no Tailwind classes apply.

---

## Code Examples

### Example 1: Hydrating presence on page load

```typescript
// Source: composition of Phase 2 WS contract + REST endpoint verification
// src/app/grid/GridClient.tsx
'use client';
import { useEffect } from 'react';
import { WsClient } from '../../lib/ws-client.js';
import { firehose } from '../../lib/store-firehose.js';
import { presence } from '../../lib/store-presence.js';
import { heartbeat } from '../../lib/store-heartbeat.js';
import type { Region } from '../../lib/region-types.js';

export function GridClient({ initialRegions }: { initialRegions: Region[] }) {
    useEffect(() => {
        presence.hydrateRegions(initialRegions);
        const client = new WsClient({
            url: (process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:3000').replace(/^http/, 'ws') + '/ws/events',
            token: process.env.NEXT_PUBLIC_GRID_WS_SECRET,
            filters: undefined, // receive all allowlisted types; filter client-side
            onFrame: (f) => {
                if (f.type === 'event') {
                    firehose.push(f.entry);
                    presence.applyEvent(f.entry);
                    heartbeat.applyEvent(f.entry);
                } else if (f.type === 'dropped') {
                    void refillFromRest(f.sinceId, f.latestId);
                } else if (f.type === 'bye') {
                    heartbeat.markShutdown(f.reason);
                }
            },
            onStatusChange: (s) => heartbeat.setStatus(s),
        });
        client.start();
        const onVisible = () => {
            if (document.visibilityState === 'visible') client.start();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            client.stop();
        };
    }, [initialRegions]);
    return <GridLayout />;
}
```

### Example 2: REST refill with in-flight guard

```typescript
// src/lib/refill.ts
let inFlight = false;
let pendingLatest = 0;

export async function refillFromRest(sinceId: number, latestId: number): Promise<void> {
    pendingLatest = Math.max(pendingLatest, latestId);
    if (inFlight) return;
    inFlight = true;
    try {
        while (firehose.getSnapshot().at(-1)?.id ?? 0 < pendingLatest) {
            const offset = (firehose.getSnapshot().at(-1)?.id ?? 0) + 1;
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:3000'}/api/v1/audit/trail?offset=${offset}&limit=200`,
            );
            if (!res.ok) break;
            const { entries } = (await res.json()) as { entries: AuditEntry[] };
            if (entries.length === 0) break;
            firehose.pushBatch(entries);
            for (const e of entries) presence.applyEvent(e);
        }
    } finally {
        inFlight = false;
    }
}
```

### Example 3: Vitest WS mock for WsClient tests

```typescript
// src/test/mocks/mock-websocket.ts
export class FakeWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSED = 3;
    readyState = FakeWebSocket.CONNECTING;
    sent: string[] = [];
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    listeners: Record<string, Array<(e: unknown) => void>> = {};

    constructor(public url: string) {}

    addEventListener(ev: string, cb: (e: unknown) => void): void {
        (this.listeners[ev] ??= []).push(cb);
    }
    send(data: string): void { this.sent.push(data); }
    close(_code?: number): void {
        this.readyState = FakeWebSocket.CLOSED;
        for (const cb of this.listeners['close'] ?? []) cb({} as CloseEvent);
    }

    // Test helpers
    simulateOpen(): void {
        this.readyState = FakeWebSocket.OPEN;
        for (const cb of this.listeners['open'] ?? []) cb({} as Event);
    }
    simulateFrame(obj: unknown): void {
        const data = JSON.stringify(obj);
        for (const cb of this.listeners['message'] ?? []) cb({ data } as MessageEvent);
    }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useState` + `useEffect` for external data | `useSyncExternalStore` | React 18 (2022); canonical in React 19 | Tearing-safe; Zustand v5 uses it internally |
| `create-react-app` + Webpack | Next.js 15 + Turbopack | Oct 2024 (Next 15 stable) | Next.js is the default React application shell |
| `reactflow` | `@xyflow/react` | 2024 rename | Same library, new scope; migration is package rename |
| `tailwindcss` 3.x + `postcss` config | `tailwindcss` 4.x + `@tailwindcss/postcss` | 2025 | Simpler setup; first-class Next.js 15 integration |
| Jest for Next.js | Vitest | 2024-2025; Next.js 15 docs list Vitest first | 10-20× faster test runs |
| `reconnecting-websocket` library | Hand-rolled `WsClient` or `partysocket` | ~2019 abandonment of the library | Reconnect logic is 30-80 lines; bespoke protocols require bespoke handlers |

**Deprecated/outdated — do not use:**
- `reconnecting-websocket` (effectively abandoned per STACK.md research)
- `socket.io` / `socket.io-client` (imposes custom protocol; overkill)
- `reactflow` (renamed to `@xyflow/react`)
- `redux` / `redux-toolkit` for a 3-store v1 (Phase 4 might revisit but not here)
- `styled-components` / `emotion` for Next.js 15 (RSC boundary issues; Tailwind is the path of least resistance)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `tick` event payload includes a `tickMs` field the dashboard can read to derive the 2× staleness threshold | §Pattern 4 Heartbeat, Pitfall 6 | Staleness threshold uses a hard-coded 30 s default → possibly too loose in test environments with faster ticks. Planner should verify `grid/src/clock/ticker.ts` emits tick rate in payload; if not, the dashboard either (a) fetches `/api/v1/grid/clock` on load for the interval, or (b) uses a fixed 60 s threshold. Either fallback is trivial. |
| A2 | `nous.direct_message` payload in AuditChain contains metadata only (from:did, to:did, maybe topic) — NOT the message body | §Architecture (filter categories), Pitfall "privacy leak" | If a message body leaks into `payload.content`, Phase 1 allowlist check at `broadcast-allowlist.ts` should catch keywords, but neutral words like `"content"` aren't flagged. Planner should verify NousRunner's `audit.append('nous.direct_message', ...)` payload shape. If it does include body, this is a Phase-1/Phase-2 bug to escalate — not a Phase-3 feature. |
| A3 | `@fastify/cors` on the Grid already allows `http://localhost:3001` OR is trivially configurable to | §Pitfall 2 "CORS on WS upgrade" | Phase 3 plan must include a small Grid-side task to add `http://localhost:3001` to the allowlist, OR confirm the current config is permissive in dev. If the existing config is reflective (`origin: true`), no change is needed. Planner verifies by reading `grid/src/api/server.ts` CORS registration. |
| A4 | Next.js 15 (`^15.2.4`) will work with React 19.2.x at runtime | §Standard Stack | If peer dependency warnings arise during `npm install`, downgrade React to the last Next.js-15-blessed version (likely `19.0.x`). Risk low — Next.js 15 shipped with React 19 support. |
| A5 | A single Playwright "smoke" test is sufficient E2E coverage for Phase 3 | §Validation Architecture | If the plan grows more interactive features (zoom, inspector), more Playwright tests get added in Phase 4. v1 only needs "the page loads and 3 ticks stream". |
| A6 | The default Grid HTTP port is 3000 (same as Next.js default) — we pick 3001 for dashboard to avoid collision | §User Constraints, §Pattern 1 | If Grid is actually configured for a different port (e.g., 8080 per some docs), dashboard's default `NEXT_PUBLIC_GRID_ORIGIN` must match. Planner should grep Grid entrypoint for the `listen({ port })` value and set the default accordingly. Trivial fix. |
| A7 | Region graph (nodes + edges) is small and static enough that SVG hand-rolling beats `@xyflow/react` | §Standard Stack, §Pattern 3 | If Phase 4 adds >25 regions or interactive edges, revisit and migrate to `@xyflow/react`. Migration is additive: the SVG component is replaceable. |
| A8 | `createdAt` on `AuditEntry` is epoch milliseconds | §Phase Requirements AUDIT-02 | If it's seconds, the heartbeat's age math is off by 1000×. Low risk — code inspection at plan time verifies. |

---

## Open Questions

1. **Exact payload shape of `tick` event and `nous.moved` event**
   - What we know: Phase 2 forwards allowlisted events verbatim; the shapes are defined by NousRunner/Ticker, not by the WS layer.
   - What's unclear: Does `tick.payload` carry tick rate, world time, or both? Does `nous.moved.payload` use `toRegion: string` (region id) or `{to: {x,y}}` coordinates?
   - Recommendation: Planner reads `grid/src/clock/ticker.ts` and `grid/src/integration/nous-runner.ts` (the latter's `audit.append('nous.moved', ...)` at line 138 per earlier grep) before finalizing the PresenceStore's `moveNous` signature.

2. **Region connection topology**
   - What we know: `GET /api/v1/grid/regions` returns regions with some connection data.
   - What's unclear: Exact shape of the `connections` field — is it `string[]` of region ids, or `Array<{to: string, cost?: number}>`?
   - Recommendation: Planner reads `grid/src/space/map.ts` to confirm. If shape isn't client-friendly, add a projection.

3. **Grid binding port and dev-origin wiring**
   - What we know: Grid uses Fastify; port is configurable.
   - What's unclear: Default dev port.
   - Recommendation: Grep `grid/src/main.ts` (or whatever entrypoint actually does `app.listen`) for the literal port; set `dashboard/.env.example` accordingly.

4. **CORS allowlist state**
   - What we know: `@fastify/cors` is installed.
   - What's unclear: Whether `http://localhost:3001` is in the dev allowlist, or if CORS is wide-open in dev.
   - Recommendation: Planner adds a task to verify/extend CORS in the same Phase-3 plan (small Grid edit).

5. **Should the dashboard use an initial REST prime fetch of recent events?**
   - Options: (A) Rely solely on `subscribe {sinceId: 0}` which server replays up to REPLAY_WINDOW=512; (B) Fetch `/api/v1/audit/trail?limit=500` on page load and then connect WS with `sinceId=<latest>`.
   - Recommendation: **(A)** — fewer moving parts, proves the WS path on load. If replay is too slow (>500 ms), switch to (B).

---

## Environment Availability

Phase 3 depends on the browser, Node 20, and the existing Grid server. No new runtime or external service dependency is introduced.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev server, Vitest | ✓ | ≥ 20 (matches Grid) | — |
| npm | Workspace install | ✓ | ≥ 10 (default with Node 20) | — |
| Grid server running | Manual dev + Playwright smoke | ✓ (Phase 2 verified) | — | Vitest component tests use FakeWebSocket; no Grid needed |
| Chromium | Playwright smoke | Installed by `npx playwright install` | — | Manual browser verification |
| @fastify/cors dev allowlist including :3001 | REST refill + WS from :3001 | TBD — Planner verifies | — | Add to allowlist if missing |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** See CORS allowlist above — trivial Grid-side edit.

---

## Validation Architecture

Per `.planning/config.json` the `workflow.nyquist_validation` key is absent, so this section is INCLUDED (absent = enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 + @testing-library/react 16.3 (component); Playwright 1.50 (one smoke) |
| Config files | `dashboard/vitest.config.ts`, `dashboard/playwright.config.ts`, `dashboard/src/test/setup.ts` |
| Quick run command | `cd dashboard && npx vitest run --reporter=dot` |
| Component-watch | `cd dashboard && npx vitest` |
| Full suite command | `cd dashboard && npm test && npx playwright test` |
| Playwright smoke (needs Grid running on :3000) | `cd dashboard && npm run dev:all & sleep 5 && npx playwright test && kill %1` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACT-03 | Firehose ring buffer caps at 500 | unit | `npx vitest run src/lib/store-firehose.test.ts -t "caps at 500"` | ❌ Wave 0 |
| ACT-03 | Firehose deduplicates by `id` across replay + live | unit | `npx vitest run src/lib/store-firehose.test.ts -t "dedupes id"` | ❌ Wave 0 |
| ACT-03 | Firehose renders event type + actor + timestamp + payload snippet | component | `npx vitest run src/components/Firehose.test.tsx -t "renders entry"` | ❌ Wave 0 |
| MAP-01 | Initial REST /grid/regions response renders a node per region and a line per connection | component | `npx vitest run src/components/RegionMap.test.tsx -t "renders regions and edges"` | ❌ Wave 0 |
| MAP-02 | Each region displays the set of Nous DIDs currently present | component | `npx vitest run src/components/RegionMap.test.tsx -t "shows present nous"` | ❌ Wave 0 |
| MAP-03 | `nous.moved` event triggers marker re-position within one render cycle (verified by DOM snapshot before/after flushSync) | component | `npx vitest run src/components/RegionMap.test.tsx -t "moves marker same render"` | ❌ Wave 0 |
| AUDIT-01 | Firehose shows entries in sequence (oldest first OR newest first — per plan) | component | `npx vitest run src/components/Firehose.test.tsx -t "entries in sequence"` | ❌ Wave 0 |
| AUDIT-02 | Each entry exposes eventType, actorDid, createdAt, payload in the DOM | component | `npx vitest run src/components/Firehose.test.tsx -t "exposes all fields"` | ❌ Wave 0 |
| AUDIT-03 | Unchecking 'trade' filter hides trade.* entries within same render | component + user-event | `npx vitest run src/components/EventTypeFilter.test.tsx -t "filter toggles"` | ❌ Wave 0 |
| SC#2 (roadmap) | WsClient reconnects with exponential backoff + jitter after ws close | unit | `npx vitest run src/lib/ws-client.test.ts -t "reconnects with backoff"` | ❌ Wave 0 |
| SC#2 | WsClient sends `sinceId` on resubscribe after reconnect | unit | `npx vitest run src/lib/ws-client.test.ts -t "sends sinceId on reconnect"` | ❌ Wave 0 |
| SC#2 | WsClient on `dropped` frame triggers REST refill (mocked fetch) | unit | `npx vitest run src/lib/ws-client.test.ts -t "refills on dropped"` | ❌ Wave 0 |
| SC#6 (roadmap heartbeat) | Heartbeat widget shows red/stale after 2× tick rate with no events | component + fake timers | `npx vitest run src/components/Heartbeat.test.tsx -t "turns stale"` | ❌ Wave 0 |
| SC#5 (roadmap bye) | On `bye` frame, WsClient stops reconnecting and sets heartbeat.status = shutdown | unit | `npx vitest run src/lib/ws-client.test.ts -t "bye halts reconnect"` | ❌ Wave 0 |
| End-to-end | Dev server + Grid → page loads → 3 tick events stream into DOM within 5s | e2e (Playwright) | `npx playwright test grid-page.spec.ts` | ❌ Wave 0 |
| Integrity (PITFALLS) | Retrying on bye is forbidden — assert no reconnect-timer after bye | unit | `npx vitest run src/lib/ws-client.test.ts -t "no reconnect after bye"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd dashboard && npx vitest run --reporter=dot` (unit + component; target <10 s)
- **Per wave merge:** `cd dashboard && npx vitest run && npx playwright test` (+ the Playwright smoke)
- **Phase gate:** All of the above green; the full `turbo test` at the repo root still green (Grid's 289 tests untouched)

### Wave 0 Gaps

The dashboard workspace does not exist on disk yet. Wave 0 MUST create:

- [ ] `dashboard/package.json` — workspace entry point
- [ ] `dashboard/tsconfig.json` — TypeScript config for Next.js 15 app router
- [ ] `dashboard/next.config.mjs` — Next.js 15 config (minimal)
- [ ] `dashboard/tailwind.config.ts` + `postcss.config.mjs` — Tailwind 4 integration
- [ ] `dashboard/vitest.config.ts` — Vitest + jsdom + @testing-library
- [ ] `dashboard/src/test/setup.ts` — `@testing-library/jest-dom/vitest` imports
- [ ] `dashboard/playwright.config.ts` — single-worker Chromium config
- [ ] `dashboard/src/test/mocks/mock-websocket.ts` — FakeWebSocket test double
- [ ] Framework install: see §Standard Stack Installation block
- [ ] Verify `npm --workspace dashboard test` exits 0 on a trivial placeholder test BEFORE Wave 1 begins (proves the rig is alive)

---

## Security Domain

Per SUMMARY.md §6 Q4, auth is intentionally minimal for v1 (single-developer localhost use). Phase 2 already implements the server-side bearer-token gate via `GRID_WS_SECRET`. Phase 3's security surface is shallow — the browser is the client, there's no multi-user anything — but OWASP ASVS still applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Pass-through of `GRID_WS_SECRET` via `NEXT_PUBLIC_GRID_WS_SECRET` env; no client-side auth logic. Document clearly that `NEXT_PUBLIC_*` envs are exposed to the browser bundle — acceptable only in dev. |
| V3 Session Management | no | No session; stateless WS with bearer token. |
| V4 Access Control | no | Single-user dev tool. |
| V5 Input Validation | yes | Every incoming WS frame JSON-parsed inside try/catch; `type` discriminator narrowed before use; unknown frame types logged and dropped. |
| V6 Cryptography | no | No secrets handled client-side beyond a dev env var echoed to the Grid. |
| V11 Business Logic | partial | Dropped-frame refill guarded against loops (Pitfall 4); reconnect backoff prevents DoS of a recovering Grid (PITFALLS M3). |
| V13 API / Web Service | yes | `fetch()` against `/api/v1/audit/trail` validates response shape before pushing to stores. |
| V14 Configuration | yes | `.env.example` documents all `NEXT_PUBLIC_*` vars; none contain real secrets. |

### Known Threat Patterns for Next.js 15 + WebSocket Client

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via unescaped event payload text in firehose | Tampering | React escapes children by default; never use `dangerouslySetInnerHTML`. Render payload as JSON-stringified pre-block — not as HTML. |
| Prototype pollution via untrusted JSON parse | Tampering | Use `JSON.parse` (safe); do not use `eval` / `Function` / `reviver` functions that mutate targets. |
| WebSocket cookie confusion / session hijack | Spoofing | Not applicable — bearer token is in query param OR header (Phase 2 contract). Cookies are not used. |
| Supply-chain attack via `create-next-app` scaffold | Tampering | Pin `next@^15.2.4` exactly; audit `npm install` output for unexpected deps; run `npm audit` as part of Wave 0 gate. |
| Reconnect flood / self-DoS | DoS | Full-jitter exponential backoff (§Pattern 1); respect `bye` frame; cap attempts at 10. |
| Info disclosure via dev console logging WS payloads | Information Disclosure | No `console.log(frame)` in production paths; dev-only logging behind `process.env.NODE_ENV !== 'production'`. |
| CSRF on `/audit/trail` GET | Tampering | GET is safe; same-origin in dev via CORS allowlist. No state-changing REST calls from the dashboard in Phase 3. |

**Key insight:** The dashboard does not send state-changing requests to the Grid in Phase 3 (strictly observational). This removes CSRF, request-body validation, and most auth-related risk from the Phase 3 scope.

---

## Sources

### Primary (HIGH confidence — direct file reads from this repo)

- `/Users/desirey/Programming/src/Noēsis/.planning/research/STACK.md` — package versions and "do not install" list
- `/Users/desirey/Programming/src/Noēsis/.planning/research/ARCHITECTURE.md` — critical seam, wire protocol, data flow
- `/Users/desirey/Programming/src/Noēsis/.planning/research/FEATURES.md` — table stakes vs differentiators
- `/Users/desirey/Programming/src/Noēsis/.planning/research/PITFALLS.md` — C1-C6 critical + M1-M8 moderate pitfalls
- `/Users/desirey/Programming/src/Noēsis/.planning/research/SUMMARY.md` — all 6 open planner questions
- `/Users/desirey/Programming/src/Noēsis/.planning/ROADMAP.md` — Phase 3 success criteria
- `/Users/desirey/Programming/src/Noēsis/.planning/REQUIREMENTS.md` — ACT-03, MAP-01..03, AUDIT-01..03
- `/Users/desirey/Programming/src/Noēsis/.planning/phases/02-wshub-ws-events-endpoint/02-CONTEXT.md` — locked wire protocol + `sinceId` replay semantics
- `/Users/desirey/Programming/src/Noēsis/.planning/phases/02-wshub-ws-events-endpoint/02-01-PLAN.md` — exact frame type definitions Phase 3 consumes
- `/Users/desirey/Programming/src/Noēsis/.planning/phases/02-wshub-ws-events-endpoint/02-VERIFICATION.md` — proof Phase 2 contract is working
- `/Users/desirey/Programming/src/Noēsis/grid/src/api/ws-protocol.ts` — frame types to copy into `dashboard/src/lib/ws-protocol.ts`
- `/Users/desirey/Programming/src/Noēsis/grid/src/api/server.ts` — REST endpoints + WS route wiring + CORS state
- `/Users/desirey/Programming/src/Noēsis/grid/src/audit/types.ts` — `AuditEntry` shape
- `/Users/desirey/Programming/src/Noēsis/grid/src/audit/broadcast-allowlist.ts` — allowlisted event types
- `/Users/desirey/Programming/src/Noēsis/package.json` — workspace declaration
- `/Users/desirey/Programming/src/Noēsis/PHILOSOPHY.md` — sovereignty guardrails
- npm registry (live): `next@latest` 16.2.4, `react@latest` 19.2.5, `vitest@latest` 4.1.4, `@testing-library/react@latest` 16.3.2, `@xyflow/react@latest` 12.10.2, `zustand@latest` 5.0.12, `partysocket@latest` 1.1.16, `@tanstack/react-virtual@latest` 3.13.24 — all verified `npm view … version` on 2026-04-18

### Secondary (MEDIUM confidence — WebSearch verified with official sources)

- Next.js 15 stable & 16 current — [nextjs.org/blog/next-15](https://nextjs.org/blog/next-15) and [abhs.in/blog/nextjs-current-version-march-2026](https://www.abhs.in/blog/nextjs-current-version-march-2026-stable-release-whats-new)
- Next.js + Vitest canonical setup — [nextjs.org/docs/app/guides/testing/vitest](https://nextjs.org/docs/app/guides/testing/vitest)
- React `useSyncExternalStore` — [react.dev/reference/react/useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- AWS Full-Jitter exponential backoff — [aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- TanStack Virtual vs react-window — [tanstack/virtual discussions #459](https://github.com/TanStack/virtual/discussions/459)
- WebSocket reconnection guide — [websocket.org/guides/reconnection](https://websocket.org/guides/reconnection/)
- Vitest vs Jest for Next.js 2026 — [dev.to/whoffagents/vitest-vs-jest-for-nextjs-in-2026](https://dev.to/whoffagents/vitest-vs-jest-for-nextjs-in-2026-setup-speed-and-when-to-switch-224a)

### Tertiary (LOW confidence — single-source, flag for validation at plan time)

- Tailwind 4 + Next.js 15 exact PostCSS plugin name (`@tailwindcss/postcss`) — should be re-verified against Tailwind docs at scaffold time; if wrong, the fix is local.
- Playwright 1.50 being current in April 2026 — not directly verified; planner does `npm view @playwright/test version` before install.

---

## Metadata

**Confidence breakdown:**
- Standard stack (Next.js 15 + React 19 + Vitest + Tailwind): HIGH — verified against npm registry 2026-04-18 and against the ROADMAP-locked decisions.
- Architecture (store pattern, WsClient state machine, map rendering): HIGH — directly derives from Phase 2 verified contract; no speculation.
- Pitfalls: HIGH — merges upstream PITFALLS.md (already MEDIUM-HIGH) with Next.js-15-specific gotchas (MEDIUM, flagged).
- Test strategy: HIGH — canonical Vitest + RTL stack is boring and works.
- Map library choice (SVG over xyflow): MEDIUM — depends on region count staying small; documented as Assumption A7.

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — this is a fast-moving ecosystem; Next.js 16 is already the `latest` tag, so planners running after 2026-05 should re-verify Next.js 15's LTS status).
