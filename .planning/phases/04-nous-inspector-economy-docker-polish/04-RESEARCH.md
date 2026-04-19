# Phase 4: Nous Inspector + Economy + Docker Polish — Research

**Researched:** 2026-04-18
**Domain:** Brain↔Grid introspection RPC, framework-agnostic dashboard stores, WAI-ARIA drawer UX, Next.js 15 standalone Docker image, Vitest test harness
**Confidence:** HIGH (all locked decisions driven by verified code-scout; schema-alignment ambiguities flagged as ASSUMED)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D1 — Inspector data path: Grid proxies Brain.** `dashboard → GET /api/v1/nous/:did/state → grid → brainClient.call('get_state') → brain → JSON response`. Single network hop. Dashboard never talks directly to the brain.

**D2 — Brain `get_state()` extension.** Widen the existing `NousHandler.get_state()` in `brain/src/noesis_brain/rpc/handler.py` to return a superset: `{name, archetype, did, psyche{openness, conscientiousness, extraversion, agreeableness, neuroticism, archetype}, thymos{mood, emotions{...}}, telos{active_goals:[{id, description, priority, created_tick}]}, memory_highlights[{tick, kind, summary, salience}], location}`. Backward-compatible — existing top-level fields remain.

**D3 — Inspector UX: side drawer, not route change.** ~420px right drawer, overlays `/grid`. Dismissible via Escape, backdrop click, close button. Selected DID persisted in URL hash `#nous=did:noesis:<name>`. `dashboard/src/app/nous/[id]/` directory stays empty.

**D4 — Inspector realtime: on-demand snapshot.** One `GET /api/v1/nous/:did/state` on drawer open. No WS subscription, no polling. User closes/reopens to refresh.

**D5 — Click triggers: firehose row + map marker.** Both surfaces wire a single `onSelectNous(did)` callback from the `SelectionStore`. Keyboard `Enter` on focused row/marker does the same.

**D6 — Economy data path: REST hydrate + WS invalidate.** `GET /api/v1/grid/nous`, `GET /api/v1/economy/trades?limit=20`, `GET /api/v1/economy/shops`. Economy panel subscribes to the already-flowing `trade.settled` WS events to re-run the two writable queries; shops fetched once per mount.

**D7 — Minimal in-grid ShopRegistry seeded from `GenesisConfig.shops`.** `grid/src/economy/shop-registry.ts` with `ShopRegistry` class (`listAll`, `getByDid`, `register`). `GenesisLauncher.bootstrap()` seeds from an optional `config.shops: ShopSeed[]` field. `TEST_CONFIG` seeds two examples (sophia.library, hermes.courier). In-memory only.

**D8 — Trade event emission.** In `grid/src/integration/nous-runner.ts`, when processing a returned `BrainAction.action_type === 'trade_request'`: (1) schema-validate `action.metadata` as `{counterparty_did, amount, nonce}`, (2) bilateral Ousia transfer via `NousRegistry`, (3) emit `services.audit.append('trade.settled', action.actor_did, {counterparty, amount, nonce})`. `trade.proposed`/`countered` deferred.

**D9 — Privacy / allowlist posture: NO allowlist changes.** The broadcast allowlist stays frozen at its Phase 1 members. Inspector reads inner-life via REST → brain RPC; those payloads never touch WS.

**D10 — Docker: one new Dockerfile + one new compose service.** `docker/Dockerfile.dashboard` multi-stage (`node:22-alpine` deps → builder with `output: 'standalone'` → runner with `USER nextjs` non-root, `EXPOSE 3001`, `CMD ["node", "server.js"]`). Compose adds `dashboard:` service with `depends_on: grid: service_healthy`, port `${DASHBOARD_PORT:-3001}:3001`, `NEXT_PUBLIC_GRID_ORIGIN=http://localhost:${GRID_PORT:-8080}` (host-mapped, browser-facing), healthcheck on `/api/dash/health`.

**D11 — SelectionStore.** New `dashboard/src/lib/stores/selection-store.ts` (framework-agnostic, identical pattern to Phase 3 stores) with `{selectedDid, setSelected, clear}`. Wired to URL hash via `useHashSync('nous')` hook.

**D12 — Tab bar on `/grid`.** Two tabs: `Firehose + Map` (default) and `Economy`. Tab state in URL via `?tab=economy`. No route change.

**D13 — Test surface: Vitest-dominant + deferred Playwright.** Grid: `server.nous-state.test.ts`, `server.economy-trades.test.ts`, `server.economy-shops.test.ts`, `shop-registry.test.ts`, `nous-runner.trade-settled.test.ts`, extend `server.cors.test.ts`. Brain: `test_handler.py::test_get_state_full_shape`, `test_memory_highlights::test_recent_returns_bounded`. Dashboard: `inspector.test.tsx`, `economy.test.tsx`, `selection-store.test.ts`, `use-hash-sync.test.ts`. Docker: `scripts/docker-smoke.sh` (not in CI).

**D14 — `/api/dash/health` static.** Next.js route handler returns `{status:"ok", gridOrigin: process.env.NEXT_PUBLIC_GRID_ORIGIN}`. Deliberately does NOT probe the Grid.

**D15 — File layout (locked).** New files: `grid/src/economy/shop-registry.ts`, `dashboard/src/lib/stores/selection-store.ts`, `dashboard/src/lib/hooks/use-hash-sync.ts`, `dashboard/src/app/grid/components/inspector.tsx`, `dashboard/src/app/grid/components/inspector-sections/{psyche,thymos,telos,memory}.tsx`, `dashboard/src/app/grid/components/economy/{balance-grid,trades-table,shops-list}.tsx`, `dashboard/src/app/grid/components/tab-bar.tsx`, `dashboard/src/app/api/dash/health/route.ts`, `docker/Dockerfile.dashboard`. Extend: `grid/src/api/server.ts`, `grid/src/integration/nous-runner.ts`, `grid/src/integration/types.ts`, `grid/src/genesis/{presets,launcher}.ts`, `grid/src/economy/types.ts`, `brain/src/noesis_brain/rpc/handler.py`, `docker-compose.yml`, `dashboard/next.config.mjs`.

### Claude's Discretion

- Drawer width (420px default; may range 380–460px).
- Memory highlight count fixed at 5 per NOUS-03 — may widen to 10 if layout demands.
- Tab bar position (top vs sidebar) — top is lighter.
- URL hash schema chose `#nous=<did>` over `?nous=<did>` to avoid Next.js server re-render on selection.

### Deferred Ideas (OUT OF SCOPE)

- Inspector writes (whisper / pause / intervene) — CTRL-01..03, Phase 5+.
- Live Inspector WS subscription (Thymos decay animation) — requires allowlist expansion; privacy-risky.
- Relationship graph (ADV-03), memory graph (ADV-02), Telos timeline (ADV-04).
- Shops as live entities (shop.listed / shop.closed events).
- `trade.proposed` / `trade.countered` separate streams.
- Multi-Grid dashboard, dashboard auth + TLS (Phase 5+).
- Playwright Inspector E2E in CI sandbox (deferred to real-env).
- `/nous/[id]` dedicated route.
- Shop registry MySQL persistence (in-memory only for v1).
- Grid roster pagination.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOUS-01 | Inspector panel shows Psyche (Big Five personality) for selected Nous | Brain `get_state()` widening (D2) returns `psyche{}` block; drawer sub-panel renders scores. Note schema gap: brain uses 6 dimensions with string levels — see Assumption A1. |
| NOUS-02 | Inspector shows Telos (active goals) and Thymos (emotional state) | Brain `get_state()` returns `telos.active_goals[]` + `thymos{mood, emotions{}}`; sub-panels render lists. Note schema gap for Goal.id — see Assumption A2. |
| NOUS-03 | Inspector shows 5 most recent episodic memories, fetched on open | `EpisodicMemoryStream.recent(limit=20, memory_type=None)` **already exists** at `brain/src/noesis_brain/memory/stream.py:86` — no add needed. Handler calls with `limit=5`. |
| ECON-01 | Economy panel lists every Nous with current Ousia balance | `GET /api/v1/grid/nous` reads `NousRegistry.all()`. Balance invalidated on `trade.settled` WS event. |
| ECON-02 | Economy panel shows last 20 completed trades | `GET /api/v1/economy/trades?limit=20` reads `AuditChain.query({eventType:'trade.settled'})`. Depends on D8 wiring emitting trade.settled events. |
| ECON-03 | Economy panel lists active shops and their listings | `GET /api/v1/economy/shops` reads new `ShopRegistry`. Seeded from `GenesisConfig.shops` via `TEST_CONFIG`. |

</phase_requirements>

## Summary

Phase 4 completes the v2.0 Dashboard by gluing three independently-cheap surfaces onto the already-shipped infrastructure: (1) a *read-only* Nous inspector that crosses the Grid → Brain plane via a single proxied RPC, (2) an economy overview that hydrates from three new REST endpoints and invalidates on the existing `trade.settled` WS event, and (3) a Docker Compose service that ships Next.js standalone behind a healthchecked entry. The phase adds **zero** new libraries on the grid side and exactly **zero** changes to the frozen broadcast allowlist. Everything else is composition over existing primitives.

Three gaps between the locked D2 schema and the live brain code were discovered during the scout and are documented as ASSUMED in the Assumptions Log — they don't block planning but should be confirmed before task execution.

**Primary recommendation:** Treat the three schema gaps (Psyche dimensions, Goal.id synthesis, Thymos serialization) as a Wave-0 clarification checkpoint; everything else follows the Phase 3 store/REST/test patterns without novelty.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Nous inner-life data assembly (Psyche/Thymos/Telos/Memory) | Brain (cognition service) | — | Python brain owns the cognitive state; JSON-RPC over Unix socket is the sovereign transport |
| Inspector data proxy (`/api/v1/nous/:did/state`) | Grid API | Brain (dependency) | Grid is the sovereign boundary; dashboard CORS allowlist locks single-origin |
| Roster + trades + shops REST | Grid API | — | Registry + AuditChain + ShopRegistry all live in-grid; no cross-service call |
| Trade settlement (BrainAction → audit.append) | Grid API (NousRunner) | — | Authoritative ledger mutation must happen in the deterministic grid loop, not in the brain |
| Drawer render + focus trap + URL hash sync | Frontend Server (Next.js SSR) → Browser | — | App-router shell is SSR; drawer mounts in `'use client'` boundary with browser-only URL hash |
| SelectionStore (framework-agnostic) | Browser | — | Pure TS, `useSyncExternalStore`-consumed; identical to Phase 3 stores |
| Tab bar (`?tab=economy` querystring) | Browser | — | Client-side; no server re-render per D12 |
| Dashboard container image | CDN / Static equivalent (Next.js standalone) | — | Build-time `NEXT_PUBLIC_*` baking; runtime static assets + minimal Node server |
| Health endpoint (`/api/dash/health`) | Frontend Server (route handler) | — | Non-cascading static response |

**[VERIFIED: code scout of grid/src, brain/src, dashboard/src]**

## Standard Stack

### Core (all already installed; Phase 4 adds nothing new at the workspace level)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.4 (latest) / 15.2.4 in-repo | App router, SSR, route handlers, standalone output | Already locked by Phase 3 scaffold; `output: 'standalone'` required for D10 Dockerfile [VERIFIED: npm view next version returned 16.2.4, in-repo `dashboard/package.json` pins 15.2.4] |
| `react` / `react-dom` | 19.2.5 (in-repo) | UI | Phase 3 locked [VERIFIED: `dashboard/package.json`] |
| `fastify` | 5.8.5 (latest) | Grid HTTP server | In use since Phase 1; new routes attach to existing `buildServerWithHub()` [VERIFIED: npm view fastify version returned 5.8.5] |
| `@fastify/websocket` | 11.2.0 (latest) | `/ws/events` endpoint | Phase 2 installation; no change [VERIFIED: npm view @fastify/websocket version returned 11.2.0] |
| `@fastify/cors` | (Phase 1 install) | CORS allowlist for dashboard origins | No change; new routes inherit same allowlist [VERIFIED: grid/src/api/server.ts:46-50] |
| `vitest` | 4.1 (in-repo) | Grid + Dashboard test runner | Phase 3 locked [VERIFIED: root package.json + dashboard/package.json] |
| `@testing-library/react` | 16.3 (in-repo) | Dashboard component tests | Phase 3 locked [VERIFIED: dashboard/package.json] |
| `jsdom` | 26 (in-repo) | Vitest DOM env | Phase 3 locked [VERIFIED: dashboard/package.json] |
| `playwright` | 1.50 (in-repo) | Deferred E2E (per D13) | Phase 3 locked [VERIFIED: dashboard/package.json] |

### Supporting (decision points inside Claude's Discretion)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 4.3.6 (latest) | Schema validation for `BrainAction.metadata` in D8 trade path | **Recommended** if the grid workspace already carries it; otherwise a hand-rolled type guard is preferred to avoid a new dependency [CITED: npm view zod] |
| (hand-rolled type guard) | n/a | Trade metadata validation | **Preferred** if zod not already present — a 10-line guard with `typeof` + regex is sufficient and keeps grid dep surface minimal |

**Decision:** grep the grid workspace for zod; if present, use it. If absent, hand-roll. Either path is acceptable — do not add zod *just* for this phase.

### Alternatives Considered (and rejected)

| Instead of | Could Use | Why rejected |
|------------|-----------|--------------|
| Hand-rolled WAI-ARIA focus trap | `react-focus-lock` | D16 says "React 19 supports useEffect+useRef focus trap without a library at this scale — do not add react-focus-lock". Adds dep weight for a 40-line component |
| Next.js route `/nous/[id]` | Drawer component | D3 rejected — context-switch cost, double code path |
| Second RPC method `get_full_state` | Widened `get_state` | D2 rejected — surface proliferation |
| Broadcast `nous.state_changed` frame | On-demand REST | D4 rejected — allowlist expansion + privacy risk |
| WebSocket-only economy | REST hydrate + WS invalidate | D6 rejected — cold-start empty state |
| Serve dashboard from Fastify static | Separate compose service | D10 rejected — breaks HMR + mixes concerns |

**Installation:** No new packages. Dashboard `next.config.mjs` must add `output: 'standalone'` — config-only change.

**Version verification note:** Phase 3 locked `next@15.2.4`; latest is `next@16.2.4`. Phase 4 does NOT bump. The dashboard Dockerfile base image is `node:22-alpine` (deliberate per D10; grid's `Dockerfile.grid` uses `node:20-alpine` — they are **not** aligned on purpose and the planner must preserve that). [VERIFIED: docker/Dockerfile.grid line 1 + D10 text]

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Browser (port 3001)                              │
│                                                                              │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐    │
│  │  /grid page      │   │  Tab bar         │   │  Drawer (Inspector)  │    │
│  │  (server tree)   │──▶│  ?tab=economy    │──▶│  URL hash #nous=<did>│    │
│  └──────────────────┘   │  (client)        │   │  focus trap + ESC    │    │
│           │              └──────────────────┘   └──────────┬───────────┘    │
│           │                       │                        │                │
│           ▼                       ▼                        ▼                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  StoresProvider (context):                                          │   │
│  │    FirehoseStore · PresenceStore · HeartbeatStore · SelectionStore* │   │
│  │                       (* NEW in Phase 4)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           │                       │                        │                │
│           │ useSyncExternalStore  │                        │                │
│           ▼                       ▼                        ▼                │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐    │
│  │  FirehoseRow     │   │  EconomyPanel    │   │  Inspector Sections  │    │
│  │  click→select   │   │  balance/trades/ │   │  Psyche│Thymos│Telos│ │    │
│  │  NousMarker      │   │  shops           │   │  Memory              │    │
│  │  click→select    │   │                  │   │                      │    │
│  └──────────────────┘   └──────────────────┘   └──────────────────────┘    │
└───────────┬───────────────────────────┬──────────────────────┬──────────────┘
            │ WS /ws/events             │ REST                 │ REST
            │ (already live)            │                      │
            ▼                           ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Grid (Fastify, port 8080)                           │
│                                                                              │
│   WS: /ws/events (unchanged)           REST additions (4 new routes):        │
│   ├─ WsHub → broadcast allowlist        ├─ GET /api/v1/grid/nous             │
│   │  (trade.settled flows through       ├─ GET /api/v1/nous/:did/state       │
│   │   untouched)                        │  └─ brainClient.call('get_state') │
│   │                                     ├─ GET /api/v1/economy/trades        │
│   │                                     │  └─ AuditChain.query(trade.settled)│
│   │                                     └─ GET /api/v1/economy/shops         │
│   │                                        └─ ShopRegistry.listAll()         │
│   │                                                                          │
│   NousRunner.handleBrainAction()                                             │
│   ├─ case 'speak' | 'move' | 'direct_message' | 'noop' (existing)           │
│   └─ case 'trade_request' (NEW per D8):                                      │
│       validate metadata → registry transfer → audit.append('trade.settled') │
│                                                                 │            │
│   NousRegistry (balance source of truth)       ShopRegistry (NEW, in-mem)   │
│   AuditChain (unchanged; trade.settled flows through WsHub untouched)        │
└───────────┬──────────────────────────────────────────────────────────────────┘
            │ JSON-RPC over Unix domain socket (BrainBridge)
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Brain (Python, per-Nous process)                       │
│                                                                              │
│   NousHandler (rpc/handler.py)                                               │
│   └─ get_state() [WIDENED per D2]                                            │
│       returns {name, archetype, did, psyche{}, thymos{}, telos{},           │
│                memory_highlights[], location}                                │
│                      │                                                       │
│       ┌──────────────┼──────────────┬──────────────┬───────────────┐        │
│       ▼              ▼              ▼              ▼               ▼        │
│   PersonalityProfile  MoodState     TelosManager   EpisodicMemoryStream     │
│   (psyche/types.py)   (thymos)      (telos)        .recent(limit=5)         │
│                                                    [ALREADY EXISTS]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

Primary use-case trace for NOUS-01..03 (inspector open):
1. User clicks firehose-row actor badge → `SelectionStore.setSelected(did)`
2. URL hash updated to `#nous=did:noesis:sophia` via `useHashSync`
3. Drawer mounts, fires `GET /api/v1/nous/did:noesis:sophia/state`
4. Grid resolves DID → local brainClient → `brainClient.call('get_state')`
5. Brain assembles superset JSON, returns
6. Grid forwards, dashboard hydrates 4 sub-panels (Psyche, Thymos, Telos, Memory)
7. On Escape / backdrop / close: focus returns to click-origin, `SelectionStore.clear()`, hash removed

### Recommended Project Structure (after Phase 4)

```
grid/src/
├── api/server.ts                    # +4 routes (extend)
├── economy/
│   ├── shop-registry.ts             # NEW
│   ├── types.ts                     # +ShopSeed, Shop (extend)
│   ├── config.ts                    # (unchanged)
│   └── index.ts                     # (unchanged)
├── integration/
│   ├── nous-runner.ts               # +trade_request case (extend)
│   └── types.ts                     # +trade_request to BrainAction union (extend)
└── genesis/
    ├── presets.ts                   # +shops in TEST_CONFIG (extend)
    └── launcher.ts                  # +seedShops (extend)

brain/src/noesis_brain/
├── rpc/handler.py                   # get_state widened
└── memory/stream.py                 # (unchanged — recent() already exists)

dashboard/src/
├── app/
│   ├── grid/
│   │   ├── grid-client.tsx          # +SelectionStore init, +tab state (extend)
│   │   └── components/
│   │       ├── firehose-row.tsx     # +click handler (extend)
│   │       ├── region-map.tsx       # +click handler (extend)
│   │       ├── tab-bar.tsx          # NEW
│   │       ├── inspector.tsx        # NEW
│   │       ├── inspector-sections/
│   │       │   ├── psyche.tsx       # NEW
│   │       │   ├── thymos.tsx       # NEW
│   │       │   ├── telos.tsx        # NEW
│   │       │   └── memory.tsx       # NEW
│   │       └── economy/
│   │           ├── balance-grid.tsx # NEW
│   │           ├── trades-table.tsx # NEW
│   │           └── shops-list.tsx   # NEW
│   └── api/dash/health/route.ts     # NEW
├── lib/
│   ├── stores/selection-store.ts    # NEW
│   └── hooks/use-hash-sync.ts       # NEW
└── next.config.mjs                  # +output:'standalone' (extend)

docker/
└── Dockerfile.dashboard             # NEW

docker-compose.yml                   # +dashboard service (extend)
```

### Pattern 1: Framework-agnostic SelectionStore (D11)

**What:** A plain-TS class with `subscribe/getSnapshot` that `useSyncExternalStore` consumes. Zero React imports. Mirror of `dashboard/src/lib/stores/presence-store.ts`.

**When to use:** Any cross-component selection/UI state that must survive reconnects and be testable without React.

**Example:**
```typescript
// Source: mirrored pattern from dashboard/src/lib/stores/presence-store.ts [VERIFIED]
export class SelectionStore {
  private _selectedDid: string | null = null;
  private _listeners = new Set<() => void>();
  private _snapshot: Readonly<SelectionSnapshot> = Object.freeze({ selectedDid: null });

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  getSnapshot(): Readonly<SelectionSnapshot> {
    return this._snapshot;
  }

  setSelected(did: string | null): void {
    if (did !== null && !isValidDid(did)) return;  // XSS guard
    if (did === this._selectedDid) return;
    this._selectedDid = did;
    this._snapshot = Object.freeze({ selectedDid: did });
    this._listeners.forEach((l) => l());
  }

  clear(): void { this.setSelected(null); }
}

const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
function isValidDid(s: string): boolean { return DID_RE.test(s); }
```

### Pattern 2: URL hash sync hook (`useHashSync`)

**What:** Bidirectional binding between a URL hash key (`#nous=...`) and a store. Hash is read on mount, written on store change, removed on clear.

**When to use:** Any selection that should survive refresh without creating a server-side route change (D16 rationale).

**Example:**
```typescript
// Source: derived from WAI-ARIA drawer conventions + Next.js client-only APIs [CITED: Next.js 15 App Router docs]
'use client';
import { useEffect } from 'react';

export function useHashSync(key: string, store: SelectionStore): void {
  // Read hash on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const v = params.get(key);
    if (v) store.setSelected(v);
    // Listen for browser back/forward
    const onHash = () => {
      const p = new URLSearchParams(window.location.hash.slice(1));
      const cur = p.get(key);
      store.setSelected(cur);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [key, store]);

  // Write hash on store change
  useEffect(() => {
    return store.subscribe(() => {
      const did = store.getSnapshot().selectedDid;
      const params = new URLSearchParams(window.location.hash.slice(1));
      if (did) params.set(key, did); else params.delete(key);
      const next = params.toString();
      const newHash = next ? `#${next}` : '';
      if (window.location.hash !== newHash) {
        history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
      }
    });
  }, [key, store]);
}
```

### Pattern 3: Hand-rolled WAI-ARIA drawer with focus trap

**What:** Right-anchored drawer component with `role="dialog"`, `aria-modal="true"`, focus moves in on open, trapped via Tab/Shift+Tab, restored to origin on close.

**When to use:** D3 locked — do NOT add `react-focus-lock` per D16 guidance.

**Example:**
```typescript
// Source: WAI-ARIA Authoring Practices 1.2 "Dialog (Modal)" pattern [CITED: w3.org/WAI/ARIA/apg/patterns/dialog-modal/]
'use client';
import { useEffect, useRef } from 'react';

export function Drawer({ open, onClose, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    // Focus the first focusable inside the panel
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus(); e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus(); e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused.current?.focus();  // Restore focus on close
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Nous inspector"
           className="fixed right-0 top-0 h-full w-[420px] bg-neutral-900 shadow-2xl overflow-auto">
        {children}
      </div>
    </>
  );
}
```

### Pattern 4: Next.js standalone Docker image

**What:** Multi-stage build that produces a minimal runtime from `dashboard/.next/standalone` + static + public.

**When to use:** D10 locked. The `output: 'standalone'` setting in `next.config.mjs` is REQUIRED — without it the runner stage will fail because there is no `server.js` to run.

**Example:**
```dockerfile
# Source: Next.js official docs "With Docker" + node:22-alpine base per D10 [CITED: nextjs.org/docs/app/building-your-application/deploying#docker-image]
# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package*.json ./
COPY dashboard/package.json ./dashboard/
COPY protocol/package.json ./protocol/
# ... any other workspace package.json files needed for npm ci
RUN npm ci --no-audit --no-fund

FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_GRID_ORIGIN=http://localhost:8080
ENV NEXT_PUBLIC_GRID_ORIGIN=${NEXT_PUBLIC_GRID_ORIGIN}
RUN npm run build -w dashboard

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S -G nextjs nextjs

COPY --from=builder /app/dashboard/public ./dashboard/public
COPY --from=builder --chown=nextjs:nextjs /app/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/dashboard/.next/static ./dashboard/.next/static

USER nextjs
EXPOSE 3001
CMD ["node", "dashboard/server.js"]
```

### Pattern 5: Brain `get_state()` widening (backward-compatible)

**What:** Extend the existing handler method in-place. Keep top-level fields for existing callers; add new nested blocks.

**Example:**
```python
# Source: brain/src/noesis_brain/rpc/handler.py:128-137 current shape + D2 target
def get_state(self) -> dict:
    psyche_numeric = {
        dim: self.personality.get_numeric(dim)
        for dim in ('openness', 'conscientiousness', 'extraversion',
                    'agreeableness', 'resilience', 'ambition')
    }
    # Note: brain's 6 dimensions ≠ D2's Big-Five-5 spec. See Assumption A1.
    return {
        # Backward-compatible top-level
        "name": self.name,
        "archetype": self.archetype,
        "mood": self.thymos.current_mood(),
        "active_goals": [g.description for g in self.telos.active_goals()],
        "location": self.current_location,
        # NEW per D2
        "did": self.did,
        "psyche": {**psyche_numeric, "archetype": self.archetype},
        "thymos": {
            "mood": self.thymos.current_mood(),
            "emotions": {
                e.value: self.thymos.intensity(e)
                for e in self.thymos.tracked_emotions()
            },
        },
        "telos": {
            "active_goals": [
                {
                    "id": _synthesize_goal_id(g, idx),  # See Assumption A2
                    "description": g.description,
                    "priority": g.priority,
                    "created_tick": getattr(g, "created_tick", 0),
                }
                for idx, g in enumerate(self.telos.active_goals())
            ],
        },
        "memory_highlights": [
            {
                "tick": m.tick,
                "kind": m.memory_type.value,
                "summary": m.content[:240],
                "salience": m.importance,
            }
            for m in self.memory.recent(limit=5)  # Already exists at stream.py:86
        ],
    }
```

### Anti-Patterns to Avoid

- **Dashboard calls brain directly.** Violates D1 and the sovereign-boundary model. Always proxy through the Grid.
- **Writable Inspector.** D3 locked READ-ONLY. Whisper/pause/intervene are CTRL-01..03 v2.
- **Allowlist expansion for inner-life fields.** D9 frozen. Any `nous.state_exposed` frame leaks Psyche/Thymos into the broadcast plane.
- **New WebSocket frame types for Phase 4.** The existing `trade.settled` event is enough; re-run REST queries on receipt.
- **`output: 'export'` on the dashboard.** Static export breaks route handlers (`/api/dash/health`). Must use `output: 'standalone'`.
- **`NEXT_PUBLIC_GRID_ORIGIN=http://grid:8080` in compose.** That DNS name only resolves inside the container network; the browser runs on the host and will fail CORS. Must be `http://localhost:${GRID_PORT:-8080}` (host-mapped port).
- **Polling the Inspector endpoint.** D4 locked snapshot-on-open. No setInterval.
- **Hand-rolled ring buffer / bounded queue.** `WsHub` already has one from Phase 2; the economy panel re-uses the existing WS stream.
- **`react-focus-lock` or similar.** D16 explicit — hand-roll the trap.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bounded per-client event queue | custom ring buffer | `WsHub` (Phase 2) | Already drop-oldest + `dropped` frame contract |
| JSON-RPC transport | raw socket writer | `BrainBridge.call()` / `RPCClient` (existing in `protocol/src/noesis/bridge/`) | Unix socket framing, 30s timeout, req/resp correlation |
| CORS allowlist | custom middleware | `@fastify/cors` registration in `server.ts:46-50` | Literal list already locked; new routes inherit |
| Broadcast payload privacy check | ad-hoc regex in route handler | `payloadPrivacyCheck()` in `grid/src/audit/broadcast-allowlist.ts` | Frozen `FORBIDDEN_KEY_PATTERN` regex is the single source of truth |
| Focus trap library | `react-focus-lock` | Hand-rolled `useEffect` + `useRef` per WAI-ARIA dialog pattern | D16 rationale — 40-line component, no dep weight |
| URL state library | `nuqs` or similar | Hand-rolled `useHashSync` | Single key (`#nous`), trivial scope |
| Next.js server probing healthcheck | cascading probe of Grid | Static `{status:'ok'}` route handler | D14 — health must not cascade-fail |
| Audit chain event source for economy | WebSocket-only stream scan | `AuditChain.query({eventType:'trade.settled', limit, offset})` | Already offset-paginated, newest-first per Phase 1 contract |

**Key insight:** Phase 4's net-new code surface is deliberately small because Phases 1–3 already built the primitives. Every "hand-rolled" candidate in this phase has an existing primitive to compose against.

## Common Pitfalls

### Pitfall 1: `NEXT_PUBLIC_GRID_ORIGIN` baked at build time, not runtime
**What goes wrong:** Developer sets `NEXT_PUBLIC_GRID_ORIGIN` only in `environment:` (runtime) and the browser ships with whatever default was baked during `npm run build`.
**Why it happens:** Next.js `NEXT_PUBLIC_*` vars are inlined into the bundle at build. Docker compose's `environment:` only affects runtime.
**How to avoid:** Dockerfile MUST accept `ARG NEXT_PUBLIC_GRID_ORIGIN` and `ENV` it before `npm run build`. Compose must either `build.args` it (canonical) or tolerate the default host port.
**Warning signs:** Dashboard loads but firehose WS connection fails with CORS or network error; `NEXT_PUBLIC_GRID_ORIGIN` in browser devtools is blank or wrong.

### Pitfall 2: Broadcast allowlist creep
**What goes wrong:** Tempted to add `nous.state_exposed` or `inspector.opened` to the allowlist to drive reactive UI.
**Why it happens:** It feels more "modern" to push; D9 / PITFALLS §C2 explain why it's fatal.
**How to avoid:** Treat `grid/src/audit/broadcast-allowlist.ts` as frozen in Phase 4. Inspector uses REST exclusively.
**Warning signs:** PR diff touches `broadcast-allowlist.ts`; privacy lint test fails.

### Pitfall 3: Grid's local `BrainAction` union missing `trade_request`
**What goes wrong:** D8 implementation compiles against `protocol/src/noesis/bridge/types.ts` (where `trade_request` is defined) but the grid worker reads its local mirror `grid/src/integration/types.ts` which lacks it. Runtime `switch` falls through to default, silently dropping the action.
**Why it happens:** The two workspaces hand-mirror types per Phase 3 convention; additions must be propagated.
**How to avoid:** Plan explicitly adds `'trade_request'` to the grid's local union *before* the runner case is written.
**Warning signs:** Trade actions processed by brain but never materialize in `AuditChain.query('trade.settled')`.

### Pitfall 4: `trade.settled` payload leaks free text
**What goes wrong:** `NousRunner` writes `{counterparty, amount, nonce, memo: action.metadata.reason}` and `payloadPrivacyCheck()` fails at test-time or (worse) silently at runtime if the lint isn't re-applied.
**Why it happens:** BrainAction metadata is typed loosely; "adding context" feels helpful.
**How to avoid:** Schema-validate `action.metadata` at ingress into the runner, picking only `{counterparty_did, amount, nonce}`. Add a regression test asserting the emitted payload passes `payloadPrivacyCheck()`.
**Warning signs:** PR contains `memo:` or `reason:` keys in the trade audit.append call.

### Pitfall 5: Inspector empty-state confused with loading spinner
**What goes wrong:** Brain unreachable; dashboard spins forever because "no data" looks like "still loading".
**Why it happens:** Error branch missing in the drawer's fetch hook.
**How to avoid:** Grid returns `503 {error:"brain unreachable", did}` per CONTEXT specifics; drawer renders explicit empty-state text per CONTEXT "Inspector Empty states".
**Warning signs:** Playwright/RTL test for brain-down scenario not present.

### Pitfall 6: Drawer focus escapes on open (accessibility regression)
**What goes wrong:** Focus stays on the click-origin button behind the backdrop; screen-reader users can tab into the main content while the modal is open.
**Why it happens:** Hand-rolled focus trap forgot to move initial focus into the panel, or didn't set `aria-modal="true"`.
**How to avoid:** Pattern 3 above — `panelRef.querySelector` first focusable on mount; Tab cycle handler; restore on unmount.
**Warning signs:** No `role="dialog"` + `aria-modal="true"` on the drawer root; no test for "Tab cycles within panel".

### Pitfall 7: URL hash DID accepted without validation (XSS surface)
**What goes wrong:** `window.location.hash = '#nous=<script>alert(1)</script>'` flows into the DID cell.
**Why it happens:** Hash is user-controlled; unvalidated.
**How to avoid:** Validate against `/^did:noesis:[a-z0-9_\-]+$/i` BEFORE setting the store. Render as text node, never `dangerouslySetInnerHTML`.
**Warning signs:** Missing regex validator in `SelectionStore.setSelected` or `useHashSync`.

### Pitfall 8: Docker healthcheck timeout + compose lifecycle race
**What goes wrong:** Dashboard starts before Grid's WS is ready; first browser open fails to connect, needs a refresh. Compose healthcheck shows green but service isn't actually serving.
**Why it happens:** `/api/dash/health` returns ok even if Next.js route handler isn't compiled yet; `start_period` too short.
**How to avoid:** D10 config has `start_period: 20s` which is enough for Next.js standalone cold start in Alpine; verify by smoke test. Do NOT make health probe the Grid (D14).
**Warning signs:** `docker compose up` followed by immediate browser open produces WS error.

### Pitfall 9: ShopRegistry mutated without emitting audit event
**What goes wrong:** Future plan to support shop CRUD writes directly to the registry without going through AuditChain; observer count / integrity contract drifts.
**Why it happens:** ShopRegistry is in-memory for v1; looks "safe" to mutate.
**How to avoid:** Phase 4 ShopRegistry is *read-only after seeding*. Any future CRUD is Phase 5+ and must include allowlisted `shop.*` events.
**Warning signs:** PR adds `ShopRegistry.register()` caller path outside `GenesisLauncher.bootstrap()`.

## Runtime State Inventory

*Phase 4 is a greenfield-additive phase — no renames, no migrations. Skipping this section.*

## Code Examples

### Grid REST — per-Nous state proxy
```typescript
// Source: derived from grid/src/api/server.ts:80-85 existing pattern + D1 [VERIFIED]
app.get('/api/v1/nous/:did/state', async (request, reply) => {
  const { did } = request.params as { did: string };
  if (!/^did:noesis:[a-z0-9_\-]+$/i.test(did)) {
    return reply.code(400).send({ error: 'invalid did', did });
  }
  const client = services.nousRunners.brainClientFor(did);
  if (!client) {
    return reply.code(404).send({ error: 'nous unknown', did });
  }
  try {
    const state = await client.call('get_state', {});
    return reply.send(state);
  } catch (err) {
    request.log.warn({ err, did }, 'brain unreachable');
    return reply.code(503).send({ error: 'brain unreachable', did });
  }
});
```

### Grid REST — economy trades
```typescript
// Source: AuditChain.query contract from Phase 1 + D6 payload shape
app.get('/api/v1/economy/trades', async (request, reply) => {
  const q = request.query as { limit?: string; offset?: string };
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));
  const offset = Math.max(0, Number(q.offset ?? 0));
  const entries = services.audit.query({
    eventType: 'trade.settled',
    limit,
    offset,
  });
  return reply.send(entries.map((e) => ({
    id: e.id,
    tick: e.tick,
    createdAt: e.createdAt,
    proposer: e.actorDid,
    counterparty: e.payload.counterparty,
    amount: e.payload.amount,
    nonce: e.payload.nonce,
  })));
});
```

### NousRunner — trade_request case (D8)
```typescript
// Source: grid/src/integration/nous-runner.ts existing switch + D8 spec
case 'trade_request': {
  const md = action.metadata as Record<string, unknown>;
  if (typeof md?.counterparty_did !== 'string' ||
      !/^did:noesis:[a-z0-9_\-]+$/i.test(md.counterparty_did) ||
      typeof md.amount !== 'number' || md.amount <= 0 ||
      typeof md.nonce !== 'string') {
    this.log.warn({ action }, 'trade_request: invalid metadata');
    break;
  }
  const transferred = services.registry.transferOusia(
    action.actor_did, md.counterparty_did, md.amount
  );
  if (!transferred) {
    this.log.warn({ action }, 'trade_request: transfer failed (insufficient balance?)');
    break;
  }
  services.audit.append('trade.settled', action.actor_did, {
    counterparty: md.counterparty_did,
    amount: md.amount,
    nonce: md.nonce,
  });
  break;
}
```

### ShopRegistry (D7)
```typescript
// Source: mirror of grid/src/registry/registry.ts style
export interface Shop {
  readonly id: string;
  readonly ownerDid: string;
  readonly name: string;
  readonly region: string;
  readonly listings: ReadonlyArray<{ readonly kind: string; readonly price: number }>;
}

export class ShopRegistry {
  private shops = new Map<string, Shop>();

  register(shop: Shop): void {
    if (this.shops.has(shop.id)) {
      throw new Error(`shop exists: ${shop.id}`);
    }
    this.shops.set(shop.id, Object.freeze({
      ...shop,
      listings: Object.freeze([...shop.listings]),
    }));
  }

  getById(id: string): Shop | undefined { return this.shops.get(id); }
  getByOwner(did: string): Shop[] { return [...this.shops.values()].filter(s => s.ownerDid === did); }
  listAll(): Shop[] { return [...this.shops.values()]; }
}
```

### Dashboard — Inspector fetch hook
```typescript
// Source: derived from D1/D4 contract + React 19 idiom
'use client';
import { useEffect, useState } from 'react';

interface NousState { /* D2 shape */ }

export function useNousState(did: string | null): {
  data: NousState | null; error: string | null; loading: boolean;
} {
  const [data, setData] = useState<NousState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!did) { setData(null); setError(null); return; }
    const ac = new AbortController();
    setLoading(true); setError(null);
    const origin = process.env.NEXT_PUBLIC_GRID_ORIGIN!;
    fetch(`${origin}/api/v1/nous/${encodeURIComponent(did)}/state`, {
      signal: ac.signal,
      credentials: 'omit',
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => { setData(json); setLoading(false); })
      .catch(err => {
        if (err?.name === 'AbortError') return;
        setError(typeof err === 'number' ? `HTTP ${err}` : String(err));
        setLoading(false);
      });
    return () => ac.abort();
  }, [did]);

  return { data, error, loading };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js Page Router + getServerSideProps | App Router + Route Handlers + RSC | Next.js 13+ (2022); mainlined by 14/15 | Dashboard uses app router; `/api/dash/health` is a Route Handler not an API Route |
| `redux` / `mobx` for shared UI state | `useSyncExternalStore` + framework-agnostic stores | React 18 (2022) | Phase 3 adopted; Phase 4 SelectionStore follows |
| `react-focus-lock` / `focus-trap-react` for dialogs | Hand-rolled `useEffect`+`useRef` per WAI-ARIA pattern | React 19 improvements to effect cleanup; dep weight concerns | D16 explicit — no library |
| Docker `COPY . .` + `npm run build` monolith | `output: 'standalone'` + multi-stage deps/builder/runner | Next.js 12+ standalone trace output | ~10× smaller runtime image |
| Polling REST every N seconds | REST hydrate + WS invalidate | Phase 2 WsHub landed | D6 adopts; economy panel re-runs query on `trade.settled` only |
| `getServerSideProps` for env inlining | Build-time `NEXT_PUBLIC_*` baking | Next.js app router convention | `NEXT_PUBLIC_GRID_ORIGIN` baked at docker build, not runtime |

**Deprecated/outdated:**
- React class-component refs for focus management (replaced by hooks).
- Next.js `/pages/api/` (replaced by `/app/*/route.ts`).
- `@vitejs/plugin-react`'s esbuild-shaped JSX options (Phase 3 decision note — Vite 8 uses native oxc.jsx).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Psyche sub-panel can render brain's 6-dimension schema (openness, conscientiousness, extraversion, agreeableness, resilience, ambition) even though D2 specifies Big-Five-5 (…, neuroticism). Plan option 1: rename the block `psyche.traits` and expose all 6 as numeric 0..1; option 2: map resilience→low-neuroticism proxy. | Standard Stack (D2), Code Examples (get_state) | UI shows wrong dimension label OR misleading neuroticism proxy. **[ASSUMED]** — brain code scout confirms 6 dims + string levels at `brain/src/noesis_brain/psyche/types.py`. Planner / user should pick option before implementation. |
| A2 | `Goal` dataclass has no `id` or `created_tick` fields; D2 requires both. Plan synthesizes `id` from `hash(description)[:8]` + index suffix, and uses `created_tick=0` (or the Nous's spawn tick) until TelosManager is extended. | Code Examples (get_state), Phase Requirements (NOUS-02) | Inspector Telos panel keys may collide across ticks; priority re-ordering visually janky. **[ASSUMED]** — safe default; real fix is TelosManager schema extension in a future phase. |
| A3 | Thymos `emotions{}` block serializes as `{ "joy": 0.3, "sadness": 0.1, ... }` with string-keyed emotion names (Enum `.value`). If the python Enum is `Emotion.JOY = "joy"` this works trivially; otherwise the handler must `.name.lower()` the keys. | Code Examples (get_state) | Frontend expects lowercase string keys; case mismatch breaks rendering. **[ASSUMED]** — confirm Enum value shape. |
| A4 | `zod` may or may not be a grid workspace dependency. Plan uses hand-rolled type guards unless zod is already present. | Standard Stack Supporting table | Introduces an unwanted dep OR adds 10 lines of redundant validation. **[ASSUMED]** — check `grid/package.json` before locking. |
| A5 | `NousRegistry` does not currently expose a public `transferOusia(from, to, amount)` method; D8 code example assumes one can be added atomically (debit+credit in one call that returns `false` on insufficient balance). Alternative: inline two `update()` calls with prior balance check. | Code Examples (trade_request case) | Race condition if the deterministic tick loop ever becomes concurrent. **[ASSUMED]** — current grid is single-threaded per tick, so either approach is safe. |

**If this table is non-empty (it is):** these five claims require either (a) a short planner ratification in PLAN.md step 0, or (b) a user prompt before execution. None block *planning*.

## Open Questions

1. **Psyche block naming convention.**
   - What we know: Brain uses 6 dimensions with string levels. D2 says `{openness: float, ...}` with 5 dims.
   - What's unclear: Which dimension set does the Inspector UI render? Drop resilience/ambition or expose all 6?
   - Recommendation: Expose all 6 as numeric 0..1 in a renamed `psyche.traits` block; resolve labels in the sub-panel component. Flag for user confirmation in plan Wave 0.

2. **Goal identity generation.**
   - What we know: `Goal` dataclass lacks `id`.
   - What's unclear: Is it acceptable to synthesize IDs from `(description_hash, index)` until TelosManager gains a proper schema?
   - Recommendation: Yes, with a comment marking it as temporary. UI never uses the ID for mutations (Inspector is read-only per D3).

3. **Shop seed character choice (Themis).**
   - What we know: CONTEXT says Themis gets no shop because she's a judge.
   - What's unclear: Does the dev expectation of "every Nous has something" break when Themis is absent from the balance grid vs the shop list?
   - Recommendation: Balance grid shows all 3 canonical Nous; shop list shows 2. Empty-state copy: "Themis is a judge, not a merchant."

4. **Grid→Brain DID-to-client map.**
   - What we know: NousRunner holds per-Nous brainClients.
   - What's unclear: Is there a public accessor `brainClientFor(did)` on the runner, or does the server have to reach into a private map?
   - Recommendation: Add an accessor; do not hack into privates. Plan includes this refactor explicitly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Grid + Dashboard | ✓ (in-repo) | 22 (deliberate for dashboard), 20 (grid) | — |
| Docker + docker compose | D10 compose service | ✓ | (existing in repo topology) | — |
| Fastify 5 + @fastify/websocket 11 + @fastify/cors | New grid routes | ✓ | 5.8.5 / 11.2.0 / (in-repo) | — |
| Next.js (in-repo 15.2.4) with `output: 'standalone'` support | Dockerfile.dashboard runner stage | ✓ | 15.2.4 | Config-only flag; no upgrade needed |
| MySQL 8.0 | Audit chain persistence (unchanged) | ✓ | (existing) | — |
| Python 3.11+ for brain | `get_state()` widening | ✓ | (existing) | — |
| `wget` in dashboard runner image | Compose healthcheck | ✓ | provided by node:22-alpine base (`apk add --no-cache wget` if missing) | `curl` equivalent if wget absent |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (TS) | Vitest 4.1 (grid + dashboard workspaces) |
| Framework (Python) | pytest (brain workspace) |
| Component testing | @testing-library/react 16.3 + jsdom 26 (dashboard) |
| E2E (deferred) | Playwright 1.50 (dashboard) |
| Quick run command (TS) | `npm run test -w grid` / `npm run test -w dashboard` |
| Quick run command (Python) | `cd brain && pytest tests/` (or `uv run pytest`) |
| Full suite command | `npm run test` from root + `cd brain && pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOUS-01 | `/api/v1/nous/:did/state` returns Psyche block | unit (grid) | `npm run test -w grid -- server.nous-state` | ❌ Wave 0 — `grid/test/server.nous-state.test.ts` |
| NOUS-01 | Inspector renders Psyche sub-panel | unit (dashboard) | `npm run test -w dashboard -- inspector` | ❌ Wave 0 — `dashboard/test/inspector.test.tsx` |
| NOUS-01 | Brain `get_state` returns full superset shape | unit (brain) | `cd brain && pytest tests/test_handler.py::test_get_state_full_shape` | ❌ Wave 0 — `brain/tests/test_handler.py` extension |
| NOUS-02 | Inspector renders Telos active_goals and Thymos emotions | unit (dashboard) | `npm run test -w dashboard -- inspector` | ❌ Wave 0 (shared with NOUS-01) |
| NOUS-03 | `memory_highlights` bounded to 5 entries | unit (brain) | `cd brain && pytest tests/test_memory_highlights` | ❌ Wave 0 — `brain/tests/test_memory_highlights.py` |
| NOUS-03 | Inspector Memory sub-panel renders 5 rows | unit (dashboard) | `npm run test -w dashboard -- inspector` | ❌ Wave 0 (shared) |
| ECON-01 | `/api/v1/grid/nous` returns roster with balances | unit (grid) | `npm run test -w grid -- server.roster` (or extend existing) | ❌ Wave 0 — `grid/test/server.roster.test.ts` |
| ECON-01 | Balance grid re-fetches on `trade.settled` WS event | unit (dashboard) | `npm run test -w dashboard -- economy` | ❌ Wave 0 — `dashboard/test/economy.test.tsx` |
| ECON-02 | `/api/v1/economy/trades?limit=20` returns newest-first | unit (grid) | `npm run test -w grid -- server.economy-trades` | ❌ Wave 0 — `grid/test/server.economy-trades.test.ts` |
| ECON-02 | NousRunner emits `trade.settled` on `BrainAction.action_type==='trade_request'` | unit (grid) | `npm run test -w grid -- nous-runner.trade-settled` | ❌ Wave 0 — `grid/test/nous-runner.trade-settled.test.ts` |
| ECON-02 | `trade.settled` payload passes `payloadPrivacyCheck()` | unit (grid, regression) | `npm run test -w grid -- nous-runner.trade-settled` (assertion) | ❌ Wave 0 (shared) |
| ECON-03 | `/api/v1/economy/shops` returns seeded registry | unit (grid) | `npm run test -w grid -- server.economy-shops` | ❌ Wave 0 — `grid/test/server.economy-shops.test.ts` |
| ECON-03 | `ShopRegistry` methods (listAll/getById/register) | unit (grid) | `npm run test -w grid -- shop-registry` | ❌ Wave 0 — `grid/test/shop-registry.test.ts` |
| SC-6 (docker) | `docker compose up` brings stack, dashboard connects on first attempt | smoke (shell) | `bash scripts/docker-smoke.sh` | ❌ Wave 0 — `scripts/docker-smoke.sh` (not CI) |
| SC-7 (integrity) | Broadcast allowlist unchanged (regression) | unit (grid) | `npm run test -w grid -- broadcast-allowlist` | ✅ exists from Phase 1 — asserts frozen set |
| CORS regression | New routes respected by existing CORS allowlist | unit (grid) | `npm run test -w grid -- server.cors` | ✅ extend `grid/test/server.cors.test.ts` |
| Drawer WAI-ARIA (accessibility) | Focus trap cycles, Escape closes, focus restores | unit (dashboard) | `npm run test -w dashboard -- inspector` | ❌ Wave 0 (shared) |
| URL hash sync | `#nous=did:...` survives refresh; invalid DIDs rejected | unit (dashboard) | `npm run test -w dashboard -- use-hash-sync` | ❌ Wave 0 — `dashboard/test/use-hash-sync.test.ts` |
| SelectionStore contract | subscribe/getSnapshot/setSelected idempotence | unit (dashboard) | `npm run test -w dashboard -- selection-store` | ❌ Wave 0 — `dashboard/test/selection-store.test.ts` |

### Sampling Rate

- **Per task commit:** `npm run test -w <workspace> -- <file-pattern>` (fast, scoped).
- **Per wave merge:** `npm run test -w grid && npm run test -w dashboard && cd brain && pytest` (full workspace sweeps).
- **Phase gate:** Full suite green + `scripts/docker-smoke.sh` manual pass before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `grid/test/server.nous-state.test.ts` — covers NOUS-01, NOUS-02, NOUS-03 proxy path
- [ ] `grid/test/server.economy-trades.test.ts` — covers ECON-02 read path
- [ ] `grid/test/server.economy-shops.test.ts` — covers ECON-03 read path
- [ ] `grid/test/shop-registry.test.ts` — covers ShopRegistry contract
- [ ] `grid/test/nous-runner.trade-settled.test.ts` — covers D8 write path + privacy lint regression
- [ ] `grid/test/server.roster.test.ts` or extend existing — covers ECON-01
- [ ] extend `grid/test/server.cors.test.ts` — new routes CORS-covered
- [ ] `brain/tests/test_handler.py` extension — `test_get_state_full_shape`
- [ ] `brain/tests/test_memory_highlights.py` — bounded-window assertion
- [ ] `dashboard/test/inspector.test.tsx` — drawer, focus trap, Escape, hash, error branch, all 4 sub-panels
- [ ] `dashboard/test/economy.test.tsx` — balance grid, trades table, shops list, WS invalidation
- [ ] `dashboard/test/selection-store.test.ts` — framework-agnostic store contract
- [ ] `dashboard/test/use-hash-sync.test.ts` — bidirectional hash binding + DID validation
- [ ] `scripts/docker-smoke.sh` — `docker compose up` + healthcheck + curl smoke (not CI)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **No (dev-observer posture per REQUIREMENTS.md)** | Explicit Out of Scope; bind 127.0.0.1; Phase 5+ |
| V3 Session Management | **No** | No sessions; no cookies (credentials off in CORS) |
| V4 Access Control | Partial | DID validation in grid proxy route (`/^did:noesis:[a-z0-9_\-]+$/i`); 404 on unknown |
| V5 Input Validation | **Yes** | Hand-rolled guard or zod for `BrainAction.metadata` in trade_request case; DID regex on URL hash; DID regex on `:did` route param |
| V6 Cryptography | No | No crypto added in this phase |
| V10 Malicious Code | **Yes (privacy regression)** | `payloadPrivacyCheck()` at NousRunner emission site; regression test asserts `trade.settled` payload passes lint |
| V13 API | **Yes** | All 4 new REST routes inherit existing CORS allowlist (`['http://localhost:3001','http://localhost:3000']`, credentials off); rate limiting not in scope (single-developer) |

### Known Threat Patterns for Next.js 15 + Fastify 5 + JSON-RPC Brain

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via URL hash | Tampering | Validate `#nous=<did>` against `/^did:noesis:[a-z0-9_\-]+$/i` before store write; render DIDs/names as text nodes (never `dangerouslySetInnerHTML`) |
| CORS bypass via subdomain | Spoofing | Literal allowlist locked by Phase 3 — `['http://localhost:3001','http://localhost:3000']`; no regex; credentials off |
| Broadcast allowlist leak (inner-life) | Information disclosure | D9 frozen allowlist; Inspector uses REST (separate plane); `payloadPrivacyCheck()` regression test stays green |
| Trade payload injection via `BrainAction.metadata` | Tampering | Schema-validate and project `{counterparty_did, amount, nonce}` ONLY; reject extra keys; reject non-DID counterparty |
| Observer effect corruption | Tampering | AuditChain `append` hash unchanged by observer count (Phase 1 SC-4 contract); Phase 4 adds no listeners |
| Brain RPC timeout → cascade | DoS | 30s default in `RPCClient`; Grid returns `503` fast-fail (not 504 timeout); dashboard renders error state |
| Docker internal DNS leak | Information disclosure | `NEXT_PUBLIC_GRID_ORIGIN` baked to `http://localhost:${GRID_PORT:-8080}` — browser never learns internal `grid:8080` |
| Health endpoint cascade-fail | DoS | D14 static response; never probes Grid |
| Path traversal on DID route | Tampering | DID regex rejects `/`, `..`, etc.; Fastify param parsing prevents `/api/v1/nous/../etc/passwd/state` style attacks |
| Unauthenticated inspector access | Elevation of privilege | Dev-observer posture — bind 127.0.0.1; Phase 5+ adds multi-user auth + sovereignty gating (ADV-01) |

### Integrity Non-Negotiables (from PITFALLS.md — Phase 4 verification)

All seven must hold at phase gate:
1. **Chain hash unchanged by observer count** — Phase 1 contract; Phase 4 adds no AuditChain listeners.
2. **No listener can crash append** — Phase 1 try/catch isolation; Phase 4 doesn't add listeners.
3. **No privacy leak in broadcast allowlist** — D9 frozen; `payloadPrivacyCheck()` regression test green.
4. **Clean shutdown via `app.close()`** — `preClose` hook drains WsHub (from Phase 2); new routes are stateless.
5. **`loadEntries()` silent restore** — Phase 1 contract; unchanged.
6. **Deterministic append ordering** — Phase 1 contract; trade_request settlement goes through the same `append()` path.
7. **CORS allowlist explicit literal (no wildcards)** — Phase 3 lock; new routes inherit unchanged.

## Sources

### Primary (HIGH confidence)

- **Code scout (in-repo, read with Read tool):**
  - `.planning/phases/04-nous-inspector-economy-docker-polish/04-CONTEXT.md` — 16 locked decisions
  - `.planning/phases/04-nous-inspector-economy-docker-polish/04-DISCUSSION-LOG.md` — auto-mode resolution trace
  - `.planning/REQUIREMENTS.md` — NOUS-01..03, ECON-01..03 definitions
  - `.planning/ROADMAP.md` — Phase 4 goal + 7 success criteria
  - `.planning/research/{SUMMARY,FEATURES,ARCHITECTURE,PITFALLS}.md` — research artifacts
  - `grid/src/api/server.ts`, `grid/src/audit/broadcast-allowlist.ts`, `grid/src/registry/registry.ts`, `grid/src/economy/{config,types,index}.ts`, `grid/src/integration/{nous-runner,types}.ts`, `grid/src/genesis/{presets,launcher}.ts`
  - `protocol/src/noesis/bridge/{types,brain-bridge,rpc-client}.ts`
  - `brain/src/noesis_brain/rpc/handler.py`, `brain/src/noesis_brain/memory/{stream,types}.py`, `brain/src/noesis_brain/psyche/types.py`, `brain/src/noesis_brain/thymos/types.py`, `brain/src/noesis_brain/telos/{types,manager}.py`
  - `dashboard/{package.json, next.config.mjs}`, `dashboard/src/lib/stores/presence-store.ts`, `dashboard/src/app/grid/{grid-client,page,hooks}.tsx`, `dashboard/src/app/grid/components/{firehose-row,region-map}.tsx`
  - `docker/Dockerfile.grid`, `docker-compose.yml`
- **Version verification (Bash `npm view`):**
  - `next@16.2.4` (latest) / `next@15.2.4` (in-repo)
  - `fastify@5.8.5` (latest)
  - `@fastify/websocket@11.2.0` (latest)
  - `zod@4.3.6` (latest)

### Secondary (MEDIUM confidence)

- **Next.js official docs:** "Deploying — Docker image" pattern for `output: 'standalone'`. [CITED: nextjs.org/docs/app/building-your-application/deploying]
- **WAI-ARIA Authoring Practices 1.2:** Dialog (Modal) pattern for drawer focus trap. [CITED: w3.org/WAI/ARIA/apg/patterns/dialog-modal/]
- **React 19 release notes:** `useSyncExternalStore` behavior unchanged; `flushSync` still the one-render-cycle escape hatch.

### Tertiary (LOW confidence)

- None. All factual claims in this document are backed by either direct code-scout reads or official-source citations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via `npm view`; no new installs.
- Architecture: HIGH — patterns are direct extensions of Phase 3 scaffolding; architecture diagram traces real call graph.
- Pitfalls: HIGH — 9 pitfalls derive from either the CONTEXT.md specifics section or PITFALLS.md research artifact; all have concrete warning signs.
- Assumptions: **MEDIUM** (5 items) — three schema gaps (A1/A2/A3) between D2 and live brain code, one dep-presence uncertainty (A4), one registry-API uncertainty (A5). None block planning; all should be ratified in plan Wave 0 or user-confirmed.
- Validation Architecture: HIGH — each REQ-ID has a named test file and exact command; all Wave 0 gaps enumerated.
- Security Domain: HIGH — ASVS categories mapped to concrete controls; 10 threat patterns mapped to mitigations; 7 integrity non-negotiables listed for phase-gate check.

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — stable stack; revisit if Next.js 16 bump lands or brain schema extends).
