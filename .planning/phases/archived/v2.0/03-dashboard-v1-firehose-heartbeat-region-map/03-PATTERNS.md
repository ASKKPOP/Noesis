# Phase 3: Dashboard v1 — Firehose + Heartbeat + Region Map — Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 29 new / 1 modified (Grid CORS, conditional)
**Analogs found:** 8 strong / 30 (27%)

**Dominant situation:** Phase 3 is a greenfield Next.js 15 + React 19 + Tailwind 4 workspace. The existing repo is pure backend TypeScript (Fastify + Vitest). There are **no React, JSX, CSS, Next.js, or browser-side files anywhere in the repo**. Most new files have NO in-repo analog and must follow the research patterns in `03-RESEARCH.md` directly.

The analogs that DO exist are all in the **protocol-contract + testing-rig** layer:
- Wire types that MUST be copied verbatim from `grid/src/api/ws-protocol.ts` and `grid/src/audit/types.ts`.
- Vitest file structure and naming (Grid uses Vitest — dashboard uses Vitest 4 with jsdom but the idiom transfers).
- Ring-buffer semantics (Grid has one already — dashboard FirehoseStore is its closest cousin).
- FakeSocket test double shape (Grid has one — dashboard FakeWebSocket mirrors it).
- TypeScript `strict: true` posture (reuse Grid's compiler strictness).

Everything else — React components, Next.js app-router layout, Tailwind config, Playwright config, WsClient browser class, useSyncExternalStore stores — is **NEW PATTERN, NO IN-REPO ANALOG**, and must be generated from `03-RESEARCH.md` §Architecture Patterns and `03-UI-SPEC.md` directly.

---

## File Classification

### Workspace Scaffolding (Wave 0)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `dashboard/package.json` | config | n/a | `grid/package.json` | role-match (different stack) |
| `dashboard/tsconfig.json` | config | n/a | `grid/tsconfig.json` | role-match (different target) |
| `dashboard/next.config.mjs` | config | n/a | — | **NO ANALOG — greenfield** |
| `dashboard/tailwind.config.ts` | config | n/a | — | **NO ANALOG — greenfield** |
| `dashboard/postcss.config.mjs` | config | n/a | — | **NO ANALOG — greenfield** |
| `dashboard/vitest.config.ts` | config | n/a | `protocol/vitest.config.ts` | partial (node env vs jsdom) |
| `dashboard/playwright.config.ts` | config | n/a | — | **NO ANALOG — greenfield** |
| `dashboard/.env.example` | config | n/a | `/.env.example` | role-match (different vars) |
| `dashboard/src/test/setup.ts` | test | n/a | — | **NO ANALOG — greenfield** |

### Protocol/Type Copies (Phase 2 contract duplication)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `dashboard/src/lib/ws-protocol.ts` | model | type-only | `grid/src/api/ws-protocol.ts` | **exact (verbatim copy)** |
| `dashboard/src/lib/audit-types.ts` | model | type-only | `grid/src/audit/types.ts` | **exact (verbatim copy)** |
| `dashboard/src/lib/region-types.ts` | model | type-only | `grid/src/space/types.ts` | **exact (verbatim copy)** |
| `dashboard/src/lib/env.ts` | utility | config-resolve | — | **NO ANALOG — greenfield** |

### Transport & State

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `dashboard/src/lib/ws-client.ts` | service | event-driven (ws) | `grid/src/api/ws-hub.ts` | partial (server vs client state machine) |
| `dashboard/src/lib/refill.ts` | service | request-response | `grid/src/api/server.ts` (GET /audit/trail) | partial (producer vs consumer) |
| `dashboard/src/lib/store-firehose.ts` | store | event-driven | `grid/src/util/ring-buffer.ts` | role-match (data structure) |
| `dashboard/src/lib/store-presence.ts` | store | event-driven | `grid/src/space/map.ts` | partial (server `SpatialMap` has similar projection) |
| `dashboard/src/lib/store-heartbeat.ts` | store | event-driven | `grid/src/clock/ticker.ts` | partial (observer side of same event) |

### Next.js App Router

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `dashboard/src/app/layout.tsx` | component (RSC) | render | — | **NO ANALOG — greenfield** |
| `dashboard/src/app/page.tsx` | component (RSC) | redirect | — | **NO ANALOG — greenfield** |
| `dashboard/src/app/grid/page.tsx` | component (RSC) | fetch-then-render | — | **NO ANALOG — greenfield** |
| `dashboard/src/app/grid/GridClient.tsx` | component (client) | event-driven orchestration | — | **NO ANALOG — greenfield** |
| `dashboard/src/app/globals.css` | style | n/a | — | **NO ANALOG — greenfield** |

### Client Components (all `'use client'`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `dashboard/src/components/Firehose.tsx` | component | subscribe-render | — | **NO ANALOG — greenfield** |
| `dashboard/src/components/FirehoseRow.tsx` | component | render (memo'd) | — | **NO ANALOG — greenfield** |
| `dashboard/src/components/Heartbeat.tsx` | component | subscribe-render + timer | — | **NO ANALOG — greenfield** |
| `dashboard/src/components/RegionMap.tsx` | component | subscribe-render (SVG) | — | **NO ANALOG — greenfield** |
| `dashboard/src/components/EventTypeFilter.tsx` | component | local-state toggle | — | **NO ANALOG — greenfield** |

### Tests

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `dashboard/src/test/mocks/mock-websocket.ts` | test (mock) | n/a | `grid/test/ws-hub.test.ts` (FakeSocket) | **exact (pattern-mirror)** |
| `dashboard/src/lib/store-firehose.test.ts` | test (unit) | n/a | `grid/test/ring-buffer.test.ts` | **exact** |
| `dashboard/src/lib/ws-client.test.ts` | test (unit) | n/a | `grid/test/ws-hub.test.ts` | role-match |
| `dashboard/src/components/*.test.tsx` | test (component) | n/a | — | **NO ANALOG — greenfield (RTL)** |
| `dashboard/test/grid-page.spec.ts` | test (e2e) | n/a | `grid/test/ws-integration.test.ts` | partial (Playwright vs ws client) |

### Potential Grid Modification (Pitfall 2, Assumption A3)

| File | Role | Data Flow | Analog | Match Quality |
|------|------|-----------|--------|---------------|
| `grid/src/api/server.ts` (add `@fastify/cors` + `http://localhost:3001` allowlist, IF not already permissive) | config | request-response | self (existing) | n/a (inline edit) |

---

## Pattern Assignments

### `dashboard/src/lib/ws-protocol.ts` (model, type-only) — COPY VERBATIM

**Analog:** `grid/src/api/ws-protocol.ts` (full file, 122 lines)

**Copy strategy:** Duplicate the entire file into `dashboard/src/lib/ws-protocol.ts`. Change the header comment to a SYNC marker. Change the `AuditEntry` import path from `'../audit/types.js'` to `'./audit-types.js'` (dashboard-local copy).

**Header excerpt to add** (top of file):

```typescript
/**
 * Wire protocol for /ws/events — the WebSocket endpoint mounted by Phase 2 WsHub.
 *
 * SYNC WITH grid/src/api/ws-protocol.ts — any change to frame shapes on the
 * Grid side MUST be mirrored here. These types are consumed by WsClient and
 * by Vitest tests in dashboard/. A shared `protocol/` workspace is a Phase 4+
 * cleanup per 03-RESEARCH.md §Architecture Patterns "Workspace integration".
 *
 * JSON over text frames. All frames carry a `type` discriminator.
 */
import type { AuditEntry } from './audit-types.js';
```

**Core types** (exactly as `grid/src/api/ws-protocol.ts` lines 13–74, unchanged):

```typescript
// ── Server → Client ────────────────────────────────────────────────────────
export interface HelloFrame { type: 'hello'; serverTime: number; gridName: string; lastEntryId: number; }
export interface EventFrame { type: 'event'; entry: AuditEntry; }
export interface DroppedFrame { type: 'dropped'; sinceId: number; latestId: number; }
export interface PingFrame { type: 'ping'; t: number; }
export interface PongFrame { type: 'pong'; t: number; }
export interface ByeFrame { type: 'bye'; reason: string; }

// ── Client → Server ────────────────────────────────────────────────────────
export interface SubscribeFrame { type: 'subscribe'; filters?: string[]; sinceId?: number; }
export interface UnsubscribeFrame { type: 'unsubscribe'; }

// ── Unions ─────────────────────────────────────────────────────────────────
export type ServerFrame = HelloFrame | EventFrame | DroppedFrame | PingFrame | PongFrame | ByeFrame;
export type ClientFrame = SubscribeFrame | UnsubscribeFrame | PingFrame | PongFrame;
```

**Do NOT copy `parseClientFrame`** — that narrows client→server frames, which is a server concern. Dashboard only receives server frames; parsing is a try/catch + JSON.parse in `WsClient` (already spec'd in research §Pattern 1).

---

### `dashboard/src/lib/audit-types.ts` (model, type-only) — COPY VERBATIM

**Analog:** `grid/src/audit/types.ts` (26 lines)

**Copy strategy:** Duplicate. Change header to sync marker. Drop `AppendListener` and `Unsubscribe` (server-only producer types). Keep `AuditEntry` and `AuditQuery` (the latter is used when constructing `/audit/trail?type=...&limit=...` query strings in `refill.ts`).

```typescript
/**
 * Audit types — copy of grid/src/audit/types.ts for client-side type safety.
 * SYNC WITH grid/src/audit/types.ts on every server-side change.
 */
export interface AuditEntry {
    id?: number;
    eventType: string;
    actorDid: string;
    targetDid?: string;
    payload: Record<string, unknown>;
    prevHash: string;
    eventHash: string;
    createdAt: number; // Unix ms (VERIFIED grid/src/audit/types.ts line 13)
}

export interface AuditQuery {
    eventType?: string;
    actorDid?: string;
    targetDid?: string;
    limit?: number;
    offset?: number;
}
```

**Critical note for planner:** `id?: number` is **optional in the type** but `EventFrame` contract asserts `entry.id` MUST be present for live frames (PITFALLS §9, Assumption A9 in 03-RESEARCH.md). WsClient MUST narrow `typeof entry.id === 'number'` before assigning `lastSeenId`.

---

### `dashboard/src/lib/region-types.ts` (model, type-only) — COPY VERBATIM

**Analog:** `grid/src/space/types.ts` (34 lines)

**Copy strategy:** Duplicate `Region` and `RegionConnection`. Drop `NousPosition` and `MoveResult` (server-only state). Dashboard's presence projection is DID → region-id, not `NousPosition` records.

```typescript
/**
 * Region types — copy of grid/src/space/types.ts shape returned by
 * GET /api/v1/grid/regions. SYNC WITH grid/src/space/types.ts.
 */
export interface Region {
    id: string;
    name: string;
    description: string;
    regionType: 'public' | 'restricted' | 'private';
    capacity: number;
    properties: Record<string, unknown>;
}

export interface RegionConnection {
    fromRegion: string;
    toRegion: string;
    travelCost: number;
    bidirectional: boolean;
}
```

**Open question for planner:** `GET /api/v1/grid/regions` currently returns `{ regions: Region[] }` (see `grid/src/api/server.ts:69`). It does NOT return connections in that endpoint. Planner must either (a) extend the Grid endpoint to include `connections`, or (b) add a sibling endpoint `GET /api/v1/grid/regions/connections`, or (c) derive edges from `getConnections()` data that doesn't leave the server today. This is flagged in 03-RESEARCH.md Open Question #2.

---

### `dashboard/src/lib/store-firehose.ts` (store, event-driven)

**Analog:** `grid/src/util/ring-buffer.ts` (45 lines)

**Match quality:** role-match — Grid's `RingBuffer<T>` is a bounded FIFO; dashboard's `FirehoseStore` is a bounded FIFO that also fans out to React subscribers via `useSyncExternalStore`. Same capacity-eviction invariant; different consumer protocol.

**Imports pattern to mirror** (from `grid/src/util/ring-buffer.ts` lines 1–9):

```typescript
// Grid pattern: top-of-file jsdoc describing semantics, no runtime imports
// where possible.

/**
 * FirehoseStore — bounded FIFO of AuditEntry + React subscription via
 * useSyncExternalStore. 500-entry DOM cap per ROADMAP Phase 3 SC#3.
 */
import { useSyncExternalStore } from 'react';
import type { AuditEntry } from './audit-types.js';
```

**Capacity/eviction pattern** (from `grid/src/util/ring-buffer.ts` lines 25–32, adapt the invariant):

```typescript
// Grid pattern (server-side RingBuffer):
// push(item: T): T | null {
//     let evicted: T | null = null;
//     if (this.items.length >= this._capacity) {
//         evicted = this.items.shift() ?? null;
//     }
//     this.items.push(item);
//     return evicted;
// }

// Dashboard adaptation (FirehoseStore — same invariant + notify):
push(entry: AuditEntry): void {
    // Dedupe by id — sinceId replays can collide with live frames
    if (this.entries.length > 0 && entry.id !== undefined) {
        const last = this.entries[this.entries.length - 1];
        if (last?.id === entry.id) return;
    }
    this.entries.push(entry);
    if (this.entries.length > CAPACITY) this.entries.shift();
    this.emit();
}
```

**Core pattern** (from 03-RESEARCH.md §Pattern 2 — authoritative spec; no in-repo analog):

```typescript
const CAPACITY = 500;

export class FirehoseStore {
    private entries: AuditEntry[] = [];
    private listeners = new Set<() => void>();

    push(entry: AuditEntry): void { /* see above */ }

    pushBatch(entries: AuditEntry[]): void {
        // Pitfall §3: replay flood. Batch-push then emit ONCE.
        for (const e of entries) {
            if (e.id !== undefined && this.entries.at(-1)?.id === e.id) continue;
            this.entries.push(e);
            if (this.entries.length > CAPACITY) this.entries.shift();
        }
        this.emit();
    }

    getSnapshot = (): readonly AuditEntry[] => this.entries;

    subscribe = (cb: () => void): (() => void) => {
        this.listeners.add(cb);
        return () => { this.listeners.delete(cb); };
    };

    private emit(): void {
        // Immutable snapshot — useSyncExternalStore compares via Object.is
        this.entries = [...this.entries];
        for (const l of this.listeners) l();
    }
}

export const firehose = new FirehoseStore();

export function useFirehose(): readonly AuditEntry[] {
    return useSyncExternalStore(firehose.subscribe, firehose.getSnapshot, firehose.getSnapshot);
}
```

**Error handling pattern:** None needed — store is pure in-memory; invalid entries are rejected at the WsClient boundary.

---

### `dashboard/src/lib/store-firehose.test.ts` (test, unit)

**Analog:** `grid/test/ring-buffer.test.ts` (60 lines read)

**Imports pattern** (lines 1–2):

```typescript
import { describe, it, expect } from 'vitest';
import { FirehoseStore } from './store-firehose.js';
```

**Test structure pattern** (from `grid/test/ring-buffer.test.ts` lines 4–50):

```typescript
describe('FirehoseStore', () => {
    it('starts empty', () => {
        const s = new FirehoseStore();
        expect(s.getSnapshot()).toHaveLength(0);
    });

    it('caps at 500 entries (drops oldest)', () => {
        const s = new FirehoseStore();
        for (let i = 1; i <= 600; i++) s.push({ id: i, /* ... */ } as AuditEntry);
        expect(s.getSnapshot()).toHaveLength(500);
        expect(s.getSnapshot()[0].id).toBe(101);
        expect(s.getSnapshot().at(-1)?.id).toBe(600);
    });

    it('dedupes by id when same entry pushed twice', () => {
        const s = new FirehoseStore();
        s.push({ id: 1, /* ... */ } as AuditEntry);
        s.push({ id: 1, /* ... */ } as AuditEntry);
        expect(s.getSnapshot()).toHaveLength(1);
    });

    it('emits new array reference on push (Object.is triggers re-render)', () => {
        const s = new FirehoseStore();
        const before = s.getSnapshot();
        s.push({ id: 1, /* ... */ } as AuditEntry);
        const after = s.getSnapshot();
        expect(after).not.toBe(before); // reference changed
    });

    it('subscribe returns unsubscribe; unsubscribe stops notifications', () => {
        const s = new FirehoseStore();
        let n = 0;
        const off = s.subscribe(() => { n++; });
        s.push({ id: 1, /* ... */ } as AuditEntry);
        off();
        s.push({ id: 2, /* ... */ } as AuditEntry);
        expect(n).toBe(1);
    });
});
```

**Naming convention from Grid:** Test file co-located with source (`ring-buffer.test.ts` next to `ring-buffer.ts`) — dashboard follows the same convention. The Grid's `vitest.config.ts` pattern (`test/**/*.{test,spec}.ts`) would NOT pick up co-located tests; the dashboard's `vitest.config.ts` must use `include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.ts']`.

---

### `dashboard/src/lib/ws-client.ts` (service, event-driven)

**Analog:** `grid/src/api/ws-hub.ts` (lines 1–80 read)

**Match quality:** partial — `WsHub` is the *server-side* fan-out of the same protocol; `WsClient` is the *browser-side* single-socket reconnecting consumer. Both own:
- a state machine (idle → open → closed → reconnecting)
- a protocol parser/guard (ws-hub uses `parseClientFrame` for incoming; ws-client needs `parseServerFrame` — which research §Pattern 1 inlines as a `try/catch JSON.parse`)
- a subscription callback ("onFrame" on ws-client mirrors the hub's `onConnect` callback shape)

**Imports pattern** (mirror `grid/src/api/ws-hub.ts` lines 20–32 style — type imports separated):

```typescript
import type { ClientFrame, ServerFrame } from './ws-protocol.js';
```

**Core state machine pattern** — **AUTHORITATIVE SPEC is 03-RESEARCH.md §Pattern 1 lines 300–371** (full class shown there). No in-repo analog exists for a *browser WebSocket client*; use the research example verbatim as the starting point. The excerpt below is reproduced for reference:

```typescript
export interface WsClientOptions {
    url: string;             // e.g. ws://localhost:3000/ws/events
    token?: string;          // GRID_WS_SECRET when bound
    filters?: string[];      // glob patterns; undefined = all
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

    start(): void { /* see 03-RESEARCH.md §Pattern 1 */ }
    stop(): void { /* see 03-RESEARCH.md §Pattern 1 */ }
    private connect(): void { /* full-jitter: Math.random() * Math.min(30_000, 250 * 2^attempt) */ }
    private send(frame: ClientFrame): void { /* readyState guard */ }
}
```

**Reconnect invariant (mirror from `grid/src/api/ws-hub.ts` line 61):**

```typescript
// Grid side sets REPLAY_WINDOW = 512 for bounded replay.
// Dashboard side caps backoff `attempt` at 10 (beyond that, delay is already
// saturated at CAP and hammering is pointless). Mirror of the same "bounded
// worst case" discipline.
const BASE_MS = 250;
const CAP_MS = 30_000;
const MAX_ATTEMPTS = 10;
```

**Bye-frame handling invariant — MUST match Grid's behavior** (from `grid/src/api/ws-hub.ts` comment lines 12–17):

```typescript
// On ByeFrame: set shouldReconnect = false. NEVER retry after a clean
// server shutdown — per PITFALLS.md M3, auto-reconnect after bye hammers
// a dying server. The Grid's WsHub is the producer of ByeFrame; the
// dashboard WsClient is the consumer. Symmetric contract.
if (frame.type === 'bye') {
    this.shouldReconnect = false;
}
```

---

### `dashboard/src/lib/ws-client.test.ts` (test, unit)

**Analog:** `grid/test/ws-hub.test.ts` lines 1–80 (read)

**Imports pattern** (lines 1–3):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WsClient } from './ws-client.js';
import { FakeWebSocket } from '../test/mocks/mock-websocket.js';
```

**FakeSocket → FakeWebSocket pattern mirror** (from `grid/test/ws-hub.test.ts` lines 7–48 — adapt to browser `WebSocket` API surface):

```typescript
// Grid's FakeSocket implements ServerSocket (send / close / on('message'|'close'|'error')).
// Dashboard's FakeWebSocket must implement the *browser* WebSocket contract:
//   - readyState getter
//   - send(data)
//   - close(code?)
//   - addEventListener('open' | 'message' | 'close' | 'error', cb)
// Research §Code Example 3 (03-RESEARCH.md lines 701–735) gives the full shape.
// Install globally before each test:
//   beforeEach(() => { (globalThis as any).WebSocket = FakeWebSocket; });
```

**Test-case template — mirror `grid/test/ws-hub.test.ts` invariant tests**, adapted for client-side assertions:

| Grid ws-hub test | Dashboard ws-client mirror |
|-----------------|---------------------------|
| "onConnect sends HelloFrame immediately" | "on open, sends SubscribeFrame with current lastSeenId" |
| "non-allowlisted event dropped" | (N/A — enforced server-side; client assumes all frames allowlisted) |
| "sinceId resume replays missed entries" | "on reconnect, resubscribes with updated sinceId" |
| "bye frame halts sends" | "bye frame sets shouldReconnect=false; no timer fires" |
| "dropped frame emitted on overflow" | "dropped frame → onFrame invoked with sinceId/latestId; caller refills via REST" |

---

### `dashboard/src/test/mocks/mock-websocket.ts` (test, mock)

**Analog:** `grid/test/ws-hub.test.ts` FakeSocket (lines 7–48)

**Match quality:** exact — same idiom (private `listeners` map, `send` buffers to `sent[]`, test helpers to simulate lifecycle events). Key differences:
1. Browser `WebSocket` uses `addEventListener` (not `on`); the FakeSocket's `on` must be renamed.
2. Browser `WebSocket` has static readyState constants (`CONNECTING=0`, `OPEN=1`, `CLOSING=2`, `CLOSED=3`).

**Direct analog excerpt** (from `grid/test/ws-hub.test.ts` lines 9–48):

```typescript
// grid FakeSocket pattern:
class FakeSocket implements ServerSocket {
    bufferedAmount = 0;
    sent: string[] = [];
    closed = false;
    closeArgs: { code?: number; reason?: string } | null = null;
    private listeners: { message: [...]; close: [...]; error: [...] } = { ... };

    send(data: string): void { this.sent.push(data); }
    close(code?: number, reason?: string): void { this.closed = true; this.closeArgs = { code, reason }; }
    on(event, cb) { this.listeners[event].push(cb); }

    // Test helpers:
    emit(event, arg): void { for (const cb of this.listeners[event]) cb(arg); }
}
```

**Dashboard adaptation — full spec in 03-RESEARCH.md §Code Example 3 lines 701–735**:

```typescript
export class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = FakeWebSocket.CONNECTING;
    sent: string[] = [];
    private listeners: Record<string, Array<(e: unknown) => void>> = {};

    constructor(public url: string) {}
    addEventListener(ev: string, cb: (e: unknown) => void): void {
        (this.listeners[ev] ??= []).push(cb);
    }
    send(data: string): void { this.sent.push(data); }
    close(code?: number): void {
        this.readyState = FakeWebSocket.CLOSED;
        for (const cb of this.listeners['close'] ?? []) cb({ code } as CloseEvent);
    }
    // Test helpers (match grid FakeSocket.emit idiom):
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

### `dashboard/src/lib/store-presence.ts` (store, event-driven)

**Analog:** `grid/src/space/map.ts` lines 1–60 (read) — `SpatialMap` is the server-side source of truth for Nous → Region position. The dashboard projects the same state from the event stream.

**Data-structure analog** (from `grid/src/space/map.ts` lines 7–10):

```typescript
// Grid server pattern — authoritative SpatialMap:
export class SpatialMap {
    private readonly regions = new Map<string, Region>();
    private readonly connections: RegionConnection[] = [];
    private readonly positions = new Map<string, NousPosition>();  // did → position
    // ...
}
```

**Dashboard adaptation — inverted index** (from 03-RESEARCH.md §"Region presence projection"):

```typescript
// Dashboard PresenceStore inverts to region → did set for O(1) "who's here":
export class PresenceStore {
    private regions: Region[] = [];
    private presence = new Map<string, Set<string>>();  // regionId → Set<did>
    private location = new Map<string, string>();        // did → regionId
    private listeners = new Set<() => void>();

    hydrateRegions(rs: Region[]): void { /* seed .regions[]; emit */ }

    moveNous(did: string, toRegionId: string): void {
        // Idempotent — Pitfall §6. Works even if prior spawn is out of window.
        const prev = this.location.get(did);
        if (prev) this.presence.get(prev)?.delete(did);
        this.location.set(did, toRegionId);
        let set = this.presence.get(toRegionId);
        if (!set) { set = new Set(); this.presence.set(toRegionId, set); }
        set.add(did);
        this.emit();
    }

    applyEvent(entry: AuditEntry): void {
        if (entry.eventType === 'nous.spawned' || entry.eventType === 'nous.moved') {
            const toRegion = entry.payload.toRegion as string | undefined;
            if (toRegion) this.moveNous(entry.actorDid, toRegion);
        }
    }
    // getSnapshot / subscribe mirror FirehoseStore pattern exactly.
}
```

**Cross-reference:** `moveNous` semantics must be symmetric with `grid/src/space/map.ts:placeNous` (lines 46–55) — both accept `(did, regionId)` pairs. Differences:
- Server `placeNous` throws if region unknown; dashboard `moveNous` is defensive (silent add) per Pitfall §6.
- Server uses `NousPosition` (with `arrivedAt`); dashboard only tracks membership.

---

### `dashboard/src/lib/store-heartbeat.ts` (store, event-driven)

**Analog:** `grid/src/clock/ticker.ts` lines 1–80 (read) — server-side clock that EMITS `tick` events; dashboard heartbeat is the CONSUMER.

**Structural analog** (from `grid/src/clock/ticker.ts` lines 15–20):

```typescript
// Grid server WorldClock pattern:
export class WorldClock {
    private tick = 0;
    private epoch = 0;
    private readonly tickRateMs: number;
    private readonly listeners: Set<TickListener> = new Set();
    // ...
}
```

**Dashboard HeartbeatStore** — observer-side mirror (no in-repo analog for the staleness detection; spec is 03-RESEARCH.md §Pattern 4 lines 470–499):

```typescript
export interface HeartbeatSnapshot {
    lastTick: number | null;
    lastSeen: number | null;       // Date.now() of most recent frame
    tickMs: number | null;         // from tick.payload.tickMs (Assumption A1)
    status: 'connecting' | 'open' | 'reconnecting' | 'closed' | 'shutdown';
    shutdownReason: string | null;
}

export class HeartbeatStore {
    private snap: HeartbeatSnapshot = { lastTick: null, lastSeen: null, tickMs: null, status: 'connecting', shutdownReason: null };
    private listeners = new Set<() => void>();

    applyEvent(entry: AuditEntry): void {
        this.snap = { ...this.snap, lastSeen: Date.now() };
        if (entry.eventType === 'tick') {
            const payload = entry.payload as { tick?: number; tickRateMs?: number };
            if (typeof payload.tick === 'number') this.snap.lastTick = payload.tick;
            if (typeof payload.tickRateMs === 'number') this.snap.tickMs = payload.tickRateMs;
        }
        this.emit();
    }

    setStatus(s: HeartbeatSnapshot['status']): void { /* ... */ }
    markShutdown(reason: string): void { /* status='shutdown'; reason=reason */ }
    // getSnapshot / subscribe mirror FirehoseStore.
}
```

**Open question flagged to planner (Assumption A1):** Verify `grid/src/clock/ticker.ts` tick payload actually carries `tickRateMs`. Reading `state` getter (lines 71–78) shows `ClockState` has `tickRateMs`, but whether the `tick` AuditEntry's `payload` field includes it is a NousRunner/ticker coupling that MUST be verified before the store reads the field. Fallback: `GET /api/v1/grid/clock` on page load (endpoint exists: `server.ts:63`).

---

### `dashboard/src/lib/refill.ts` (service, request-response)

**Analog producer:** `grid/src/api/server.ts` lines 99–110 (GET `/api/v1/audit/trail`).

**Endpoint contract** (from `server.ts:99-110`):

```typescript
// Grid producer:
app.get<{ Querystring: { type?: string; actor?: string; limit?: string; offset?: string } }>(
    '/api/v1/audit/trail',
    async (req) => {
        const entries = services.audit.query({
            eventType: req.query.type,
            actorDid: req.query.actor,
            limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
            offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
        });
        return { entries, total: services.audit.length };
    },
);
```

**Dashboard consumer — in-flight guard pattern** (from 03-RESEARCH.md §Code Example 2 lines 672–696):

```typescript
let inFlight = false;
let pendingLatest = 0;

export async function refillFromRest(sinceId: number, latestId: number): Promise<void> {
    pendingLatest = Math.max(pendingLatest, latestId);
    if (inFlight) return;                                      // Pitfall §4 guard
    inFlight = true;
    try {
        while (((firehose.getSnapshot().at(-1)?.id ?? 0) < pendingLatest)) {
            const offset = (firehose.getSnapshot().at(-1)?.id ?? 0) + 1;
            const res = await fetch(
                `${env.GRID_ORIGIN}/api/v1/audit/trail?offset=${offset}&limit=200`,
            );
            if (!res.ok) break;
            const body = (await res.json()) as { entries: AuditEntry[]; total: number };
            if (body.entries.length === 0) break;
            firehose.pushBatch(body.entries);
            for (const e of body.entries) presence.applyEvent(e);
        }
    } finally {
        inFlight = false;
    }
}
```

**Validation pattern** (from the Grid producer — narrowing response before trust): Dashboard MUST guard `Array.isArray(body.entries)` and narrow each entry's `eventType: string` + `actorDid: string` + `createdAt: number` before pushing. The Grid contract guarantees these, but REST boundaries cross trust zones.

---

### `dashboard/vitest.config.ts` (config)

**Analog:** `protocol/vitest.config.ts` (34 lines, full file read)

**Match quality:** partial — `protocol/vitest.config.ts` uses `environment: 'node'` and no plugins; dashboard needs `environment: 'jsdom'` + `@vitejs/plugin-react`.

**Pattern excerpt** (from `protocol/vitest.config.ts` lines 1–34):

```typescript
// protocol/ pattern:
import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        coverage: { provider: 'v8', reporter: ['text', 'json', 'html'], /* thresholds 80/80/70/80 */ },
        reporters: ['verbose'],
        testTimeout: 10000,
        hookTimeout: 10000,
    },
    resolve: { alias: { '@': '/src' } },
});
```

**Dashboard adaptation**:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',                                   // ← differs from protocol
        setupFiles: ['./src/test/setup.ts'],                    // ← RTL / jest-dom setup
        include: [
            'src/**/*.{test,spec}.{ts,tsx}',                    // co-located
            'test/**/*.{test,spec}.{ts,tsx}',
        ],
        exclude: ['node_modules', '.next', 'test/**/*.spec.ts'],  // exclude Playwright
        testTimeout: 10000,
        hookTimeout: 10000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
        },
    },
});
```

**Coverage thresholds to mirror:** Keep Grid's `80/80/70/80` bar — consistency across workspaces is a soft contract that appears in both `protocol/vitest.config.ts` (lines 18–23) and the Grid's implicit Vitest 2 setup.

---

### `dashboard/package.json` (config)

**Analog:** `grid/package.json` (34 lines, full file read)

**Pattern excerpt** (from `grid/package.json`):

```json
{
    "name": "@noesis/grid",
    "version": "0.1.0",
    "scripts": {
        "build": "tsc",
        "start": "node dist/entrypoint.js",
        "dev": "tsx watch src/index.ts",
        "test": "vitest run",
        "test:watch": "vitest",
        "lint": "eslint src/",
        "clean": "rm -rf dist/"
    },
    "devDependencies": {
        "@types/node": "^20.0.0",
        "eslint": "^9.0.0",
        "tsx": "^4.0.0",
        "typescript": "^5.5.0",
        "vitest": "^2.0.0"
    },
    "engines": { "node": ">=20.0.0" }
}
```

**Dashboard adaptation — same script shape, Next.js targets**:

```json
{
    "name": "@noesis/dashboard",
    "version": "0.1.0",
    "private": true,
    "scripts": {
        "dev": "next dev --port 3001",
        "build": "next build",
        "start": "next start --port 3001",
        "test": "vitest run",
        "test:watch": "vitest",
        "test:e2e": "playwright test",
        "lint": "eslint src/",
        "clean": "rm -rf .next dist"
    },
    "dependencies": {
        "next": "^15.2.4",
        "react": "^19.2.5",
        "react-dom": "^19.2.5",
        "clsx": "^2.1.0"
    },
    "devDependencies": {
        "@types/node": "^20.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "typescript": "^5.5.0",
        "tailwindcss": "^4.0.0",
        "@tailwindcss/postcss": "^4.0.0",
        "vitest": "^4.1.0",
        "@vitejs/plugin-react": "^5.0.0",
        "@testing-library/react": "^16.3.2",
        "@testing-library/jest-dom": "^6.6.0",
        "@testing-library/user-event": "^14.6.0",
        "jsdom": "^25.0.0",
        "@playwright/test": "^1.50.0",
        "eslint": "^9.0.0",
        "eslint-config-next": "^15.0.0",
        "lucide-react": "^0.454.0"
    },
    "engines": { "node": ">=20.0.0" }
}
```

**Key invariants mirrored from Grid:**
- `private: true` and `@noesis/*` scope naming.
- `engines.node: ">=20.0.0"` (Grid line 31–33).
- `scripts.test: "vitest run"` and `test:watch: "vitest"` (Grid lines 11–12).
- TypeScript `^5.5.0` pinned to match root and Grid.
- `eslint: "^9.0.0"` aligned with Grid major.

---

### `dashboard/tsconfig.json` (config)

**Analog:** `grid/tsconfig.json` (19 lines, full file read)

**CRITICAL DIVERGENCE from Grid** — per 03-RESEARCH.md lines 273–274: dashboard CANNOT share Grid's `module: NodeNext` because Next.js requires `jsx: "preserve"` and a bundler-resolution path.

**What to mirror from Grid:**
- `strict: true` (Grid line 10)
- `esModuleInterop: true` (line 11)
- `skipLibCheck: true` (line 12)
- `forceConsistentCasingInFileNames: true` (line 13)
- `resolveJsonModule: true` (line 14)

**What to change for Next.js 15:**

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "esnext",                        // ← differs from Grid's NodeNext
        "moduleResolution": "bundler",              // ← differs from Grid's NodeNext
        "lib": ["ES2022", "dom", "dom.iterable"],  // ← adds DOM
        "jsx": "preserve",                          // ← new (Next.js requirement)
        "allowJs": true,
        "noEmit": true,                             // ← Next.js handles emit
        "incremental": true,
        "strict": true,                             // ← keep Grid invariant
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "isolatedModules": true,                    // ← Next.js requirement
        "plugins": [{ "name": "next" }],
        "paths": { "@/*": ["./src/*"] }
    },
    "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
    "exclude": ["node_modules", ".next"]
}
```

---

## Shared Patterns

### Strict TypeScript

**Source:** `grid/tsconfig.json` lines 10, 13

**Apply to:** `dashboard/tsconfig.json`

```json
"strict": true,
"forceConsistentCasingInFileNames": true
```

**Rationale:** All three existing workspaces (`protocol/`, `grid/`, `cli/`) use `strict: true`. Dashboard must match.

---

### Type-Only Cross-Workspace Duplication (with SYNC marker)

**Source pattern:** Introduced in 03-RESEARCH.md §Architecture Patterns "Workspace integration notes" (line 274) — no existing in-repo example, but the convention applies to all three `dashboard/src/lib/*-types.ts` and `dashboard/src/lib/ws-protocol.ts` files.

**Apply to:** `dashboard/src/lib/ws-protocol.ts`, `dashboard/src/lib/audit-types.ts`, `dashboard/src/lib/region-types.ts`

**Header comment template (required on every duplicated file):**

```typescript
/**
 * SYNC WITH grid/src/<path>/<file>.ts — any change to this shape on the
 * Grid side MUST be mirrored here. A shared `protocol/` workspace is a
 * Phase 4+ cleanup per 03-RESEARCH.md §Architecture Patterns.
 */
```

**Rationale:** The planner MUST add this header to every copied file so future maintainers can't accidentally drift the contract.

---

### Vitest Test File Structure

**Source:** `grid/test/ring-buffer.test.ts` lines 1–3, 4–50

**Apply to:** All `dashboard/src/**/*.test.ts` and `dashboard/src/**/*.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { /* unit under test */ } from './xxx.js';

describe('UnitName', () => {
    it('starts in known state', () => { /* ... */ });
    it('enforces invariant N', () => { /* ... */ });
    // ...
});
```

**Conventions mirrored:**
- Describe block is class/module name (`'RingBuffer'`, `'WsHub'`, `'FirehoseStore'`).
- `it` description is a SHOULD statement in present tense ("caps at 500", not "should cap at 500").
- Boundary tests first (empty, full, capacity=1).
- One expectation per `it` where possible; bundled expects only when they assert a SINGLE behavior from multiple angles.

---

### ServerSocket / FakeWebSocket Test-Double Idiom

**Source:** `grid/test/ws-hub.test.ts` FakeSocket lines 9–48

**Apply to:** `dashboard/src/test/mocks/mock-websocket.ts`

**Idiom:**
1. Private `listeners` map keyed by event name.
2. Public `sent: string[]` array (captures all `send()` calls).
3. Public test helpers to `emit`/`simulate` lifecycle events.
4. Class implements the production interface (ServerSocket in Grid, browser WebSocket surface in dashboard).

---

### Error Handling — ByeFrame Respect

**Source:** `grid/src/api/ws-hub.ts` (the Grid is the *producer* of ByeFrame; all dashboard consumer code must respect it)

**Apply to:** `dashboard/src/lib/ws-client.ts` (single enforcement point)

**Rule:** On any `ByeFrame`, set `shouldReconnect = false` and DO NOT schedule a reconnect timer. Per PITFALLS.md §M3, auto-reconnect after a clean server shutdown hammers a dying Grid — the Phase 3 integrity non-negotiable (03-RESEARCH.md User Constraints line 34).

---

### CORS Contract

**Source:** `grid/src/api/server.ts` (currently no `@fastify/cors` registration visible in read; planner must verify).

**Apply to:** `grid/src/api/server.ts` (conditional edit)

**Action required:** Planner MUST grep `grid/src/api/server.ts` for any `@fastify/cors` registration. If absent or not permissive for `http://localhost:3001`, add a Wave task to register:

```typescript
import cors from '@fastify/cors';
await app.register(cors, {
    origin: ['http://localhost:3001'],   // dashboard dev origin
    credentials: false,
});
```

Note: `@fastify/cors` is already in `grid/package.json` dependencies (line 17) — installed but not necessarily wired. Verify, then wire if needed.

---

### Environment Variable Convention

**Source:** Root `/.env.example` (lines 1–28, full read)

**Apply to:** `dashboard/.env.example`

**Convention mirrored:**
- Comments group variables by concern (`# Grid MySQL`, `# Grid Settings`).
- Keys are UPPER_SNAKE_CASE.
- Every key has a default value (no empty assignments except for optional secrets which use `# KEY=` commented form).

**Dashboard adaptation:**

```bash
# Grid origin (where the Phase 2 WS endpoint + REST API lives)
NEXT_PUBLIC_GRID_ORIGIN=http://localhost:3000

# Optional — only set if GRID_WS_SECRET is configured on the server
# NEXT_PUBLIC_GRID_WS_SECRET=
```

**Port collision note:** Grid default port per `/.env.example` line 10 is `GRID_PORT=8080` — but 03-RESEARCH.md assumes Grid runs on `:3000`. **Planner must verify** which default the Grid actually uses at `grid/src/main.ts` (or wherever `app.listen` lives) and set `NEXT_PUBLIC_GRID_ORIGIN` accordingly. Flagged as Assumption A6 in 03-RESEARCH.md.

---

## No Analog Found

The following files have no meaningful analog in the existing codebase. Planner must use 03-RESEARCH.md and 03-UI-SPEC.md as the authoritative source:

| File | Role | Data Flow | Reason / Authoritative Reference |
|------|------|-----------|----------------------------------|
| `dashboard/next.config.mjs` | config | n/a | No Next.js anywhere in repo. Use minimal Next.js 15 scaffold. |
| `dashboard/tailwind.config.ts` | config | n/a | No CSS anywhere in repo. Use 03-UI-SPEC.md §Color, §Typography, §Spacing tokens. |
| `dashboard/postcss.config.mjs` | config | n/a | Tailwind 4 canonical form. |
| `dashboard/playwright.config.ts` | config | n/a | No Playwright in repo. Use Playwright docs single-worker Chromium config. |
| `dashboard/src/app/layout.tsx` | RSC | render | App router root shell — Next.js 15 docs pattern. |
| `dashboard/src/app/page.tsx` | RSC | redirect | `redirect('/grid')` — Next.js built-in. |
| `dashboard/src/app/grid/page.tsx` | RSC | fetch-then-render | Server-component that fetches `/api/v1/grid/regions` and passes to `<GridClient>`. |
| `dashboard/src/app/grid/GridClient.tsx` | client component | event-driven orchestration | 03-RESEARCH.md §Code Example 1 (lines 626–668) is authoritative. |
| `dashboard/src/app/globals.css` | style | n/a | 03-UI-SPEC.md color/typography tokens via Tailwind 4 `@theme` directive. |
| `dashboard/src/components/Firehose.tsx` | client component | subscribe-render | 03-RESEARCH.md §Pattern 5 + 03-UI-SPEC.md §Component Inventory. |
| `dashboard/src/components/FirehoseRow.tsx` | client component | render | 03-UI-SPEC.md §Color event-type dots, §Typography micro row. |
| `dashboard/src/components/Heartbeat.tsx` | client component | subscribe-render + 500ms interval | 03-RESEARCH.md §Pattern 4 (lines 478–500) is authoritative. |
| `dashboard/src/components/RegionMap.tsx` | client component | SVG subscribe-render + flushSync | 03-RESEARCH.md §Pattern 3 (lines 434–468) is authoritative. |
| `dashboard/src/components/EventTypeFilter.tsx` | client component | local-state toggle | 03-UI-SPEC.md §Interaction Contract rows 1 and 4. |
| `dashboard/src/lib/env.ts` | utility | config-resolve | Trivial — read `process.env.NEXT_PUBLIC_GRID_ORIGIN`; convert `http→ws`. |
| `dashboard/src/test/setup.ts` | test | n/a | `import '@testing-library/jest-dom/vitest'` — RTL canonical one-liner. |
| `dashboard/src/components/*.test.tsx` | test | n/a | Use `@testing-library/react` canonical patterns (`render`, `screen`, `user-event`). No in-repo RTL precedent. |
| `dashboard/test/grid-page.spec.ts` | e2e | n/a | Playwright canonical smoke — `grid/test/ws-integration.test.ts` provides distant inspiration for "real server, real client, await N frames" but uses `ws` + Fastify inject, not a browser. |

**For every file above:** the planner must NOT guess. The research document is the contract.

---

## Metadata

**Analog search scope:**
- `/Users/desirey/Programming/src/Noēsis/grid/src/**` (full read of `api/`, `audit/`, `space/`, `clock/`, `util/`)
- `/Users/desirey/Programming/src/Noēsis/grid/test/**` (ring-buffer, ws-hub, ws-integration, api test structures)
- `/Users/desirey/Programming/src/Noēsis/protocol/**` (vitest.config.ts)
- `/Users/desirey/Programming/src/Noēsis/cli/**` (listed — no React/frontend code)
- Root config (`package.json`, `turbo.json`, `.env.example`)

**Files scanned:** ~15 source files, 5 test files, 6 config files.

**Strong analogs (8):**
1. `grid/src/api/ws-protocol.ts` → verbatim copy source
2. `grid/src/audit/types.ts` → verbatim copy source
3. `grid/src/space/types.ts` → verbatim copy source
4. `grid/src/util/ring-buffer.ts` → FirehoseStore capacity-eviction pattern
5. `grid/test/ring-buffer.test.ts` → FirehoseStore test structure
6. `grid/test/ws-hub.test.ts` FakeSocket → FakeWebSocket idiom
7. `protocol/vitest.config.ts` → dashboard vitest.config.ts base
8. `grid/package.json` → dashboard package.json scripts + engines

**Partial analogs (5):**
1. `grid/src/api/ws-hub.ts` → WsClient state-machine discipline (server mirror)
2. `grid/src/space/map.ts` → PresenceStore inverse projection
3. `grid/src/clock/ticker.ts` → HeartbeatStore event-shape expectation
4. `grid/src/api/server.ts:99-110` → refill.ts request target
5. `/.env.example` → dashboard/.env.example convention

**Pattern extraction date:** 2026-04-18
