# Phase 32: Firehose Observability — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `32-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 32-firehose-observability
**Areas discussed:** Frame counter eviction plumbing, HealthWatchdog cadence + lifecycle, /health/detailed status logic + threshold home, CI gates + test/UAT depth, HealthWatchdog ↔ FirehoseHub wiring, Watchdog constructor contract, main.ts integration sequence

---

## Frame Counter Eviction Plumbing

### Q1: How should `frames_dropped_total` learn about RingBuffer eviction?

| Option | Description | Selected |
|--------|-------------|----------|
| Check `size===capacity` in `enqueue` | ClientConnection checks before push; no RingBuffer API change | ✓ |
| Extend RingBuffer with `onEvict` callback | Cleaner encapsulation; touches shared util | |
| Track size before/after push | Defensive; more verbose | |

**User's choice:** Check `size===capacity` in `enqueue`
**Notes:** Zero API change to RingBuffer (shared util), locality stays in firehose layer, simplest read of intent.

### Q2: Where do frame counters live?

| Option | Description | Selected |
|--------|-------------|----------|
| Hub-level metrics + callbacks into ClientConnection | Hub holds private metrics; passes increment callbacks | ✓ |
| Per-ClientConnection fields, `stats()` sums | Cleaner per-client encapsulation but loses disconnected-client counters | |
| Hub holds raw counters; ClientConnection mutates directly | Saves indirection but exposes hub internals | |

**User's choice:** Hub-level metrics + callbacks into ClientConnection
**Notes:** Counters need to survive client disconnects; callback boundary keeps ClientConnection from reaching into hub.

### Q3: Exact increment site for `frames_sent_total` (R-32-03 anchor)?

| Option | Description | Selected |
|--------|-------------|----------|
| After `socket.send` inside try, before catch | If send throws, increments never reached | ✓ |
| Wrap send in `safeSend` helper returning success bool | Explicit but adds layer | |
| Increment optimistically before send, decrement on throw | Risky if decrement missed | |

**User's choice:** After `socket.send` inside try, before catch
**Notes:** Satisfies R-32-03 directly; existing `// Swallow` comment stays.

### Q4: `stats()` return shape — include `watermark_bytes`?

| Option | Description | Selected |
|--------|-------------|----------|
| Include `watermark_bytes` + move to Area 2 | OBS-05 spec shape | ✓ |
| Add `buffer_high_water_mark` per client | Expands scope beyond OBS-05 | |
| More questions in Area 1 | | |

**User's choice:** Include `watermark_bytes` + move to Area 2
**Notes:** Spec-aligned; defer per-client high-water-mark to v2.7+ if needed.

---

## HealthWatchdog Cadence + Lifecycle

### Q1: What drives the HealthWatchdog's checks?

| Option | Description | Selected |
|--------|-------------|----------|
| Pure pull: no timer, route handler computes on demand | Zero new onTick, zero setInterval | ✓ |
| `setInterval(5_000)` updating cached snapshot | Independent heartbeat log channel | |
| Piggyback existing `clock.onTick` (every N ticks) | Watchdog stops with paused clock | |

**User's choice:** Pure pull (no timer)
**Notes:** STATE.md locks single onTick subscription; R-32-02 trivially satisfied without setInterval.

### Q2: Pure-pull HealthWatchdog ownership?

| Option | Description | Selected |
|--------|-------------|----------|
| Class instance, readonly-style field on GenesisLauncher | Mirrors Phase 31 AuditReconcile shape | ✓ |
| Standalone module-level function (no class) | Simpler, harder to extend | |
| Constructed inline by route handler each request | Scatters threshold logic into route | |

**User's choice:** Class instance, field on GenesisLauncher
**Notes:** Symmetric with Phase 31; testable in isolation.

### Q3: What should we log given pure-pull has no iteration?

| Option | Description | Selected |
|--------|-------------|----------|
| Log on every state transition (ok→degraded→critical) at warn | Phase 31 `audit_reconcile_ok` is canonical heartbeat | ✓ |
| Log every `snapshot()` at debug level | Requires NOESIS_LOG_LEVEL=debug to see | |
| No watchdog log; rely entirely on Phase 31 heartbeat | Loses explicit transition signal | |

**User's choice:** Log on every state transition at warn
**Notes:** Orthogonal to Phase 31 heartbeat; both signals required for R-32-01.

### Q4: Cold-start (uptime <30s, `lastReconcileAt=0`) reporting?

| Option | Description | Selected |
|--------|-------------|----------|
| Grace window: status='ok' during first N ticks | Avoids false-degraded on every boot | ✓ |
| Always apply staleness rule from t=0 | Honest but operationally noisy | |
| Detect 'never reconciled' vs 'stale' separately | More nuanced; extra branch | |

**User's choice:** Grace window (first 60 ticks = ok)
**Notes:** Threshold matches Phase 31 reconcile cadence (60 ticks).

### Q5: Should HealthWatchdog accept injectable now()/snapshotCadenceMs for tests?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — constructor `opts.now: () => number` | Cleanest test injection | ✓ |
| No — `vi.useFakeTimers()` in tests | Avoids DI machinery | |

**User's choice:** Yes — constructor opts
**Notes:** Mirrors Phase 31 AuditReconcile time injection.

---

## /health/detailed Status Logic + Threshold Home

### Q1: Where do threshold constants live?

| Option | Description | Selected |
|--------|-------------|----------|
| Module-level `HEALTH_THRESHOLDS` const in `health-watchdog.ts` | Named export; co-located with reader | ✓ |
| Constructor opts on HealthWatchdog (injectable per Grid) | Test-easy but turns policy into config | |
| Magic literals inline in `snapshot()` | Loses grep-ability | |

**User's choice:** Module-level const
**Notes:** REQ-locked policy, not deployment-tunable config.

### Q2: How does `snapshot()` compute status?

| Option | Description | Selected |
|--------|-------------|----------|
| Single pure helper: `computeStatus(audit, firehose, clock)` | Trivially testable | ✓ |
| Inline inside `snapshot()` method body | Couples gathering with policy | |
| Reason codes: return triggered conditions in payload | Adds payload surface beyond OBS-06 | |

**User's choice:** Single pure helper
**Notes:** Reasons array still used internally for transition warn logs; not exposed in route payload.

### Q3: Route registration — where does /health/detailed live and in which scope?

| Option | Description | Selected |
|--------|-------------|----------|
| New file `grid/src/api/routes/health-detailed.ts`; main scope | Mirrors `tick-metrics.ts` pattern | ✓ |
| Inline in `server.ts` next to `/health` | server.ts already 800+ lines | |
| Extend `/health` with `?detailed=1` query | Conflates two SLAs on one route | |

**User's choice:** New file, main scope registration
**Notes:** NOT inside the WebSocket-only `app.register(async instance => ...)` scope.

---

## CI Gates + Test/UAT Depth

### Q1: CI gate scope (R-32-01 + R-32-02)?

| Option | Description | Selected |
|--------|-------------|----------|
| Both gates scoped to `diagnostics/` + `audit/` + `db/` | Covers observability + persistence layers | ✓ |
| Diagnostics dir only — narrowest scope | Misses firehose-hub.ts (in audit/) | |
| Entire `grid/src/` recursively — broadest scope | False-positive risk from test fixtures | |

**User's choice:** Three-directory scope
**Notes:** Wired into `.github/workflows/rig-invariants.yml` alongside Phase 31's `check-no-silent-catch`.

### Q2: Minimum regression test set for Phase 32?

| Option | Description | Selected |
|--------|-------------|----------|
| Four files: counters, send-throws, route shape, transitions | Clean separation of regressions | ✓ |
| Three files (collapse counter + send-throws into one) | Saves file but couples regressions | |
| Five files (add construction-order race regression) | Defensive but order is already locked by structure | |

**User's choice:** Four files
**Notes:** `firehose-subscribes-before-clock.test.ts` deferred — buildServerWithHub locks order structurally.

### Q3: Phase 32 own HUMAN-UAT, or fold into Phase 31's?

| Option | Description | Selected |
|--------|-------------|----------|
| Own `32-HUMAN-UAT.md` | Independent operator cutover | ✓ |
| Fold into `31-HUMAN-UAT.md` as Phase 32 addendum | Less proliferation, couples cutovers | |
| Skip UAT — unit + integration tests sufficient | Loses live failure-mode verification | |

**User's choice:** Own `32-HUMAN-UAT.md`
**Notes:** Mirrors Phase 31 D-31-D3 cutover-doc philosophy.

---

## HealthWatchdog ↔ FirehoseHub Wiring

### Q1: How does `launcher.healthWatchdog` reach firehose stats?

| Option | Description | Selected |
|--------|-------------|----------|
| Post-construction `attachFirehoseHub()` setter | Mirrors Phase 9 D-9-04 `attachRelationshipStorage` | ✓ |
| Construct HealthWatchdog inside `buildServerWithHub` instead | Violates 'readonly field' rule; undefined window | |
| Pass hub-factory function into launcher constructor | Circular dep + factory ordering awkward | |

**User's choice:** Post-construction setter
**Notes:** Setter accepts structural interface `{ stats(): FirehoseStats }` to avoid `genesis/` → `audit/` import direction.

---

## Watchdog Constructor Contract

### Q1: Deps shape — what does the constructor accept?

| Option | Description | Selected |
|--------|-------------|----------|
| Getter functions for clockState (testability) | Cheap test mocking, by-reference auditReconcile | ✓ |
| Direct refs to launcher subsystems (WorldClock) | Simpler but heavier test mocks | |
| Launcher reference (full back-pointer) | God-object; hard to unit-test | |

**User's choice:** Getter functions for clockState; by-reference for auditReconcile
**Notes:** `firehoseStats` is NOT in constructor — arrives via `attachFirehoseStats(fn)`.

---

## main.ts Integration Sequence

### Q1: Where exactly does HealthWatchdog construction land?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside `GenesisLauncher.constructor` (auto-instantiated) | Strict readonly invariant preserved | |
| main.ts constructs HealthWatchdog after launcher | Violates readonly | |
| `buildServerWithHub` constructs both watchdog AND attaches it | Single construction site; readonly relaxed | ✓ |

**User's choice:** `buildServerWithHub` constructs both
**Notes:** Trade-off accepted — `healthWatchdog` becomes one-shot-settable field (set via `attachHealthWatchdog`, throws on second call) instead of strictly `readonly` at construction. Justification: depends on `firehoseHub` which only exists after `buildServerWithHub`. Captured in D-32-G2.

---

## Claude's Discretion

Items where Claude has flexibility during planning/implementation:
- Exact RingBuffer accessor names (verify `size`/`capacity` are public; add if missing)
- Exact `HubMetricsSink` interface shape (discrete params vs single sink object)
- `HealthDetailedPayload` TypeScript export location (`diagnostics/` vs `api/types.ts`)
- `uat-half-close-socket.mjs` script depth (dedicated script vs `wscat` documentation)
- Reasons array log string shape (`'divergence>10'` vs `'divergence_above_threshold'`)
- Test depth on cold-start grace window (at minimum tick<60 + tick===60 cases)
- Migration of any pre-existing `setInterval` in `grid/src/audit/` or `grid/src/db/` (if any exist not held in fields, fix in this phase so CI gate passes)

## Deferred Ideas

Ideas mentioned during discussion noted for future phases:
- Per-client `buffer_high_water_mark` metric — revisit if Phase 34 dashboards want it
- Construction-order race regression test — structure locks order; typecheck/lint would catch
- Configurable thresholds via launcher config — keep as frozen consts unless real operational need surfaces
- Reasons array exposed in route payload — additive to OBS-06; defer to Phase 34 if Steward UI needs it
- Per-client send-error counter — R-32-03 send-throws test covers without payload expansion
