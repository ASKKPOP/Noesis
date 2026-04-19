---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Dashboard (Sprint 14)
status: completed
stopped_at: Completed 04-07-PLAN.md (Phase 4 final plan)
last_updated: "2026-04-19T03:19:09.330Z"
last_activity: 2026-04-18 -- Plan 04-07 complete (Docker polish, 215/215 dashboard vitest green)
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 19
  completed_plans: 19
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** The first persistent Grid where Nous actually live — observable, running continuously, with real cognitive cycles, real trades, and real social dynamics emerging from the systems.
**Current milestone:** v2.0 — Dashboard (Sprint 14)
**Current focus:** Phase 04 — nous-inspector-economy-docker-polish

## Current Position

Phase: 04 (nous-inspector-economy-docker-polish) — COMPLETE
Plan: 7/7 merged (01, 02, 03, 04, 05, 06, 07)
Status: Phase 4 complete — Dashboard stack fully dockerized; SC-6 structurally ready
Last activity: 2026-04-18 -- Plan 04-07 complete (Docker polish, 215/215 dashboard vitest green)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 12
- Phase 3 execution time: ~2 hours (wall clock across 5 waves)

| Phase | Plan | Duration | Tasks | Files | Completed |
|-------|------|----------|-------|-------|-----------|
| 03 | 01 | ~18min | 3 | 7 | 2026-04-18 |
| 03 | 02 | ~10min | 2 | 17 | 2026-04-18 |
| 03 | 03 | ~9min | 4 | 9 | 2026-04-18 |
| 03 | 04 | ~12min | 4 | 8 | 2026-04-18 |
| 03 | 05 | ~65min | 3 | 11 | 2026-04-18 |
| 03 | 06 | ~7min | 3 | 7 | 2026-04-18 |

*Updated after each plan completion*
| Phase 04 P03 | ~30min | 2 tasks | 7 files |
| Phase 04 P05 | 1h15m | 3 tasks | 13 files |
| Phase 04 P06 | 45min | 3 tasks | 11 files |
| Phase 04 P07 | ~20min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- Plan 03-06: computeRegionLayout extracted to pure region-layout.ts (no React, no 'use client') so Playwright specs can import it via relative path to derive expected coords, not hardcode them
- Plan 03-06: flushSync wraps PresenceStore.applyEvents on nous.moved so marker transform recomputes within one render cycle (SC-5)
- Plan 03-06: Mock Grid server uses @fastify/websocket on 127.0.0.1:8080, isolated per test — no real grid needed for E2E
- Plan 03-05: vitest.config.ts fixed to use Vite 8's native oxc.jsx transform (Vitest 4.1 bundles Vite 8 which ignores esbuild-shaped JSX options from @vitejs/plugin-react@4.7)
- Plan 03-05: RSC boundary — page.tsx (server) reads NEXT_PUBLIC_GRID_ORIGIN and passes to grid-client.tsx ('use client') via prop; no credentials in RSC hydration payload
- Plan 03-05: Singleton stores via React context prevent duplicate WS subscriptions on remount
- Plan 03-05: Event-type color classes mirror grid/src/audit/broadcast-allowlist 1:1 (movement=blue, message=violet, trade=amber, law=pink, lifecycle=neutral)
- Plan 03-04: Stores are framework-agnostic (zero React imports) — subscribe/getSnapshot contract consumed by useSyncExternalStore in Plan 05
- Plan 03-04: PresenceStore reads nous location from payload.toRegion on nous.moved (resolved Open Question #3)
- Plan 03-04: HeartbeatStore staleness = elapsed > 2 × tickRateMs (clock-skew tolerant)
- Plan 03-03: Protocol types hand-mirrored from grid authoritative sources with SYNC headers — no cross-workspace imports
- Plan 03-03: Full-jitter backoff: `sleep = random(0, min(30000, 250 * 2**attempt))` — AWS thundering-herd pattern
- Plan 03-03: refillFromDropped coalesces duplicate calls via in-flight guard, paginates PAGE_LIMIT=1000, propagates AbortSignal
- Plan 03-02: Tailwind 4 CSS-first via `@theme` in globals.css; tailwind.config.ts retained as thin compatibility shim
- Plan 03-02: Grid origin locked to `http://localhost:8080` in dashboard/.env.example
- Plan 03-02: Test-id convention binding on Plans 05 + 06 — `firehose-row`, `heartbeat-status`, `region-node`, `nous-marker`, `event-type-badge`
- Plan 03-01: CORS origin list is explicit literal ['http://localhost:3001','http://localhost:3000'] — no regex, no wildcards, credentials off
- Plan 03-01: /api/v1/grid/regions extended in-place to {regions,connections} — single GET for dashboard map render
- Plan 03-01: Single clock.onTick listener does registry.touch THEN audit.append('tick', ...) — one subscription, ordered side effects; hash-chain invariant preserved
- [Phase ?]: Plan 04-03: TradeRecord.timestamp is Unix integer SECONDS (W2 contract locked by test assertion < 10_000_000_000). AuditEntry.createdAt is ms → mapper applies Math.floor(/1000).
- [Phase ?]: Plan 04-03: DID_REGEX /^did:noesis:[a-z0-9_\-]+$/i enforced at route entry; malformed → 400 invalid_did.
- [Phase ?]: Plan 04-03: Inspector getState() throws logged via request.log.warn — raw err.message never proxied to client (T-04-12 privacy).
- [Phase ?]: Plan 04-03: /economy/shops handler deep-copies frozen ShopRegistry listings so responses are safe to mutate client-side.
- [Phase ?]: 04-05: Error copy owned client-side (ERR_COPY map) — backend error strings never rendered (T-04-22)
- [Phase ?]: 04-05: Hand-rolled focus trap using FOCUSABLE_SELECTOR — no react-focus-lock dependency
- [Phase ?]: 04-05: Inspector mounts once at GridClient root; fixed-position drawer owns its own layout
- [Phase ?]: Plan 04-06: Tab gating moved from page.tsx (server component) into grid-client.tsx GridLayout — useSearchParams is a client hook
- [Phase ?]: Plan 04-06: Firehose dedup via lastTradeId ref (scan snapshot backwards for newest trade.settled id) to survive ring-buffer replay storms
- [Phase ?]: Plan 04-06: Shops NOT refetched on trade.settled — they are launcher-registered, not trade-driven
- Plan 04-07: NEXT_PUBLIC_GRID_ORIGIN passed as BOTH docker-compose build-arg AND runtime environment — build-arg bakes value into client bundle (Next 15 Pitfall 1), runtime env keeps dev/prod symmetric
- Plan 04-07: Dashboard Dockerfile uses ARG→ENV promotion BEFORE `RUN npm run build`; ordering contract enforced by grep line-number comparison (W3 sandbox-safe verify, no docker daemon required)
- Plan 04-07: Static /api/dash/health avoids cascading-failure antipattern (D14) — dashboard liveness independent of grid probe
- Plan 04-07: Dashboard publishes :3001 exactly to match frozen D9 CORS allowlist — .env.example explicitly warns that changing DASHBOARD_PORT requires widening grid CORS
- Plan 04-07: Next.js standalone output (monorepo layout) — runtime copies /app/dashboard/.next/standalone + /static + /public; CMD `node dashboard/server.js` (not `server.js`)
- [Phase ?]: Plan 04-07: NEXT_PUBLIC_GRID_ORIGIN as BOTH build-arg + runtime env (Next 15 Pitfall 1)

### Pending Todos

- Phase 4 planning: economy consolidation + inspector routes + Docker polish

### Blockers/Concerns

- `brain/uv.lock` is untracked — needs commit or gitignore entry before clean state
- Playwright full E2E not run in sandbox (dev server boot blocked) — verified to typecheck; deferred to developer's local run or CI in Phase 4
- Pre-existing `grid/src/main.ts` TS build errors documented in deferred-items.md — unrelated to Phase 3

## Session Continuity

Last session: 2026-04-18T20:17:00Z
Stopped at: Completed 04-07-PLAN.md (Phase 4 final plan)
Resume file: None
