# Phase 34: Steward `/system` Health Surfaces — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 9 (5 NEW, 4 MODIFIED)
**Analogs found:** 8 / 9 (one — `health-reason-labels.ts` — has no direct analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `steward/src/lib/use-health-detailed.ts` | hook | REST poll (5s) | `steward/src/app/system/page.tsx:242-261` (drift-poll useEffect) | exact (same cadence, same shape) |
| `steward/src/lib/use-firehose-ws.ts` | hook | WS event + watchdog | `steward/src/app/firehose/page.tsx:88-177` (connect/scheduleReconnect/refs) | exact (self-extract) |
| `steward/src/components/EventsPerMinuteSparkline.tsx` | component | one-shot REST fetch + bucket | `steward/src/app/culture/norm-timeline.tsx:101-182` (raw inline SVG) | role-match (SVG primitive only — geometry differs) |
| `steward/src/components/FrameCounterSparkline.tsx` | component | derived from hook state | NEW pattern — no existing CSS-div sparkline analog | NEW (no match) |
| `steward/src/lib/health-reason-labels.ts` | label-table | static-import | NEW — no existing snake_case→human-label module in `steward/src/lib/` | NEW (no match) |
| `grid/src/diagnostics/health-watchdog.ts` (MOD) | grid-payload-extension | self-reference | Self (lines 65-82 interface, lines 270-287 snapshot return) | exact (self) |
| `grid/test/health-detailed-route.test.ts` (MOD) | test-extension | self-reference | Self (lines 181-208 shape assertions) | exact (self) |
| `steward/src/app/system/page.tsx` (MOD) | component | REST + WS hook calls | Self (lines 7-53 array, lines 484-590 card panels, lines 242-261 useEffect) | exact (self) |
| `steward/src/app/firehose/page.tsx` (MOD) | component | WS + watchdog hook call | Self (lines 88-177 WS machinery) | exact (self) |

---

## Pattern Assignments

### `steward/src/lib/use-health-detailed.ts` (hook, REST poll)

**Role:** Custom React hook polling `GET ${GRID_ORIGIN}/health/detailed` at 5s cadence; returns `{ data, error, isLoading, refresh }` + frame-counter deltas (D-34-A3).
**Data flow:** REST poll on `setInterval(5000)` + cleanup on unmount.
**Closest analog:** `steward/src/app/system/page.tsx:221-261` — `fetchDriftAlerts` async fn + the dual-interval `useEffect` that drives it.

**Code excerpt (analog, lines 221-261):**
```typescript
async function fetchDriftAlerts() {
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/audit/drift-alerts`);
        if (!res.ok) {
            if (res.status === 503) {
                setDriftError('Drift endpoint unavailable.');
            } else {
                setDriftError(`HTTP ${res.status}`);
            }
            return;
        }
        const data = await res.json();
        setDriftAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        setDriftLastUpdated(Date.now());
        setDriftSecondsAgo(0);
        setDriftError(null);
    } catch {
        setDriftError('Drift endpoint unavailable.');
    }
}

useEffect(() => {
    fetchStatus();
    fetchClock();
    fetchRegions();
    fetchDriftAlerts();

    // Poll drift alerts every 5s
    const driftInterval = setInterval(fetchDriftAlerts, 5000);

    // Update "last updated Xs ago" every second
    const secondsInterval = setInterval(() => {
        setDriftSecondsAgo(Math.round((Date.now() - driftLastUpdated) / 1000));
    }, 1000);

    return () => {
        clearInterval(driftInterval);
        clearInterval(secondsInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**What to mirror:**
- `setInterval(fetch, 5000)` cadence — locked by REQ OBS-11 / OBS-12.
- `clearInterval` in the `useEffect` return — prevents handle leak (R-32-02 discipline carried over).
- 503 special-case in the catch arm — Phase 32 `/health/detailed` returns 503 `watchdog_not_ready` during the narrow startup window; surface as a distinct error string.
- Plain `useState + useEffect` (no SWR library — v2.1 frontend invariant: zero hook-utility deps).
- `try / catch` around the JSON parse path — exact shape of drift-poll's error swallow.
- Frame-counter deltas: keep a `prevStatsRef = useRef<FirehoseStats | null>(null)`; on each successful poll compute `sentDelta = data.firehose.frames_sent_total - prevStatsRef.current.frames_sent_total` (clamp negative to 0 on reset), maintain a `useState<number[]>` ring of the last 12 deltas (D-34-A3).
- Use `AbortController` to cancel in-flight fetch on unmount (small addition over the drift-poll analog — current code doesn't bother because drift-poll runs only on `/system`; the new hook may be called by both `/system` and `/firehose` so abort discipline matters more).

**What NOT to mirror:**
- The `secondsInterval` (1s tick) from the analog is purely for displaying "last updated Xs ago" — only include this if the planner decides a card needs that label; it's not required by REQ OBS-11/12.
- Do NOT re-implement an exponential-backoff retry — REQ OBS-11 says 5s flat. The drift-poll analog has no backoff and that's correct here.

**Frozen contracts touched:**
- Phase 32 D-32-C3 — `/health/detailed` route shape is the consumed contract.
- Phase 32 D-32-C2 + D-34-B1 — the `reasons: string[]` field will exist by the time this hook reads it (D-34-B1 grid-side change must land first OR be coordinated so the field is optional from the hook's perspective until rendered).
- v2.1 frontend invariant — zero hook-utility libs (no SWR, no react-query); plain `useState`/`useEffect`/`useRef` only.

---

### `steward/src/lib/use-firehose-ws.ts` (hook, WS event + watchdog)

**Role:** Optional extraction of WS connect + reconnect machinery from `/firehose/page.tsx`; adds the watchdog check that triggers reconnect when `last_frame_at >60s AND client_count >0`.
**Data flow:** WS `onmessage` event-driven + a 5s watchdog `setInterval` that reads polled `/health/detailed.firehose` state and may call `wsRef.current?.close()` to trigger the existing reconnect path.
**Closest analog:** `steward/src/app/firehose/page.tsx:88-177` — `connect()`, `scheduleReconnect()`, the four refs (`wsRef`, `retryTimerRef`, `countdownTimerRef`, `retryDelayRef`), and the unmount cleanup.

**Code excerpt (analog, lines 88-177):**
```typescript
function connect() {
    const wsUrl = GRID_ORIGIN.replace(/^http/, 'ws') + '/api/v1/audit/firehose';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setConnected('connecting');

    ws.onopen = () => {
        setConnected('connected');
        retryDelayRef.current = 1;
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
        setRetryCountdown(0);
    };

    ws.onmessage = (evt) => {
        // ... frame parsing
    };

    ws.onclose = () => {
        setConnected('disconnected');
        scheduleReconnect();
    };

    ws.onerror = () => {
        ws.close();
    };
}

function scheduleReconnect() {
    const delay = retryDelayRef.current;
    retryDelayRef.current = Math.min(delay * 2, 30);
    setRetryCountdown(delay);

    countdownTimerRef.current = setInterval(() => {
        setRetryCountdown((c) => {
            if (c <= 1) {
                if (countdownTimerRef.current) {
                    clearInterval(countdownTimerRef.current);
                    countdownTimerRef.current = null;
                }
                return 0;
            }
            return c - 1;
        });
    }, 1000);

    retryTimerRef.current = setTimeout(() => {
        connect();
    }, delay * 1000);
}

useEffect(() => {
    connect();
    return () => {
        if (wsRef.current) wsRef.current.close();
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**What to mirror:**
- Exponential backoff `1 → 2 → 4 → 8 → 16 → 30` (cap) — `retryDelayRef.current = Math.min(delay * 2, 30)`. Do not touch this scaling.
- Four-ref pattern: `wsRef`, `retryTimerRef`, `countdownTimerRef`, `retryDelayRef` — all `useRef`, kept in class-field-style discipline (matches Phase 32 R-32-02 setInterval-lifecycle gate's spirit on the client side).
- Cleanup discipline: every timer/interval stored in a ref is `clearTimeout`/`clearInterval`'d on unmount.
- The watchdog ADD is a separate `setInterval(checkFreshness, 5000)` (or piggybacks on `use-health-detailed`'s 5s tick); on trigger, calls `wsRef.current?.close()`. The existing `onclose → scheduleReconnect` path then handles the actual reconnect — **no new reconnect code is needed**.
- `ws.onerror = () => ws.close()` — the analog already collapses error → close → reconnect; keep that single fan-in.

**What NOT to mirror:**
- The `MAX_EVENTS` / `MAX_BUFFER` ring buffer for paused-event accumulation (`/firehose` page concern only — `/system` cards do not buffer events).
- The `isPausedRef` hover-pause mechanic — `/system` cards have no hover-pause UX.
- Extracting the entire WS code to the hook is OPTIONAL per Claude's Discretion in CONTEXT.md §"Claude's Discretion": the smallest-blast-radius approach is to add ONLY a `useFirehoseWatchdog(wsRef, healthData)` hook and leave `/firehose/page.tsx`'s `connect()` body in place. Planner decides — Surgical Changes rule biases toward smaller surface.

**Frozen contracts touched:**
- Phase 32 D-32-A4 — `FirehoseStats` shape (`client_count`, `last_frame_at`) is the watchdog trigger input.
- REQ OBS-14 — watchdog trigger predicate is locked: `Date.now() - last_frame_at > 60_000 AND client_count > 0`.
- R-34-03 — reconnect storm: the watchdog must NOT loop-trigger close-then-immediately-watchdog-again. Mitigation: the watchdog's `last_frame_at` check is gated by a "we just reconnected within the last 60s" suppression window OR by relying on the existing exponential backoff to space subsequent reconnects.

---

### `steward/src/components/EventsPerMinuteSparkline.tsx` (component, REST-driven sparkline)

**Role:** Raw inline SVG sparkline showing events-per-minute bucketed by event-family prefix; 60 buckets × 5s = 5-minute window (D-34-A2). REST-driven from `GET /api/v1/audit/trail?limit=200` so it survives firehose failure.
**Data flow:** One-shot REST fetch per 5s poll (driven by parent's `use-health-detailed` tick OR an independent `setInterval`), filtering entries within `now - 300_000` ms, bucketing by `floor((now - createdAt) / 5000)`.
**Closest analog:** `steward/src/app/culture/norm-timeline.tsx:101-182` — the existing raw-SVG primitive in the codebase. Geometry is very different (norm-timeline = horizontal timeline rows; sparkline = stacked-family vertical bars), but the SVG conventions (viewBox, `var(--mono)`/`var(--ink)`/`var(--rule)` palette, `role="img"` + `aria-label`) transfer directly.

**Code excerpt (analog, lines 99-167):**
```typescript
<svg
    role="img"
    aria-label={`Norm timeline visualization. ${norms.length} norms.`}
    viewBox={`0 0 800 ${svgHeight}`}
    width="100%"
    style={{ background: 'var(--parchment)', display: 'block' }}
>
    {/* X-axis line */}
    <line x1={80} y1={20} x2={800} y2={20} stroke="var(--rule)" strokeWidth={1} />

    {/* Tick marks */}
    {tickMarks.map(t => (
        <text
            key={`tick-${t}`}
            x={scaleX(t, minTick, maxTick)}
            y={14}
            fontSize={9}
            fontFamily="var(--mono)"
            fill="var(--muted)"
            textAnchor="middle"
        >
            {t}
        </text>
    ))}

    {/* Norm rows */}
    {sortedNorms.map((norm, i) => {
        const color = normColor(norm.convergence_type);
        // ... compute positions
        return (
            <g key={norm.norm_id} transform={`translate(0, ${i * 32 + 40})`}>
                <rect x={rangeStart} y={4} width={rangeWidth} height={16} rx={3} fill={color} opacity={0.25} />
                <circle cx={cx} cy={14} r={5} fill={color} stroke="var(--ink)" strokeWidth={1} />
            </g>
        );
    })}
</svg>
```

**What to mirror:**
- `<svg role="img" aria-label="...">` — accessibility convention for non-text data viz.
- `viewBox="0 0 W H"` + `width="100%"` — responsive SVG without losing crisp geometry.
- Palette: stroke/fill via `var(--rule)`, `var(--muted)`, `var(--ink)`; family colors via `EVENT_FAMILY_COLORS` (extract to `steward/src/lib/event-family-colors.ts` per CONTEXT.md §"Reusable Assets" if both consumers use it).
- `fontFamily="var(--mono)"` for any axis labels.
- `<g key=...>` per-bucket grouping if doing transforms.
- `title=` attribute on individual `<rect>` bars for hover tooltips per Claude's Discretion ("12 events at 14:35:00").
- A helper `getFamilyName(eventType)` + `getFamilyColors(eventType)` that mirrors `firehose/page.tsx:26-42` — pull these helpers from there OR re-export them via `steward/src/lib/event-family-colors.ts`.

**What NOT to mirror:**
- The norm-timeline's `scaleX` linear interpolation is for unbounded tick ranges; the sparkline's x-axis is fixed (60 buckets × known pixel width). Use a simpler `x = bucketIndex * barWidth`.
- The norm-timeline uses arbitrary `svgHeight` based on row count; the sparkline has a fixed height (≈80-120 px) appropriate for at-a-glance reading inside a card.

**Frozen contracts touched:**
- v2.4 Culture Dashboard invariant: **"raw SVG only — no d3 / no recharts / no react-flow / no cytoscape"** — D-34-A1 explicitly extends this invariant to the new Phase 34 sparkline. Adding any chart library would violate it.
- REQ OBS-13: REST-not-WS — sparkline MUST fetch `/api/v1/audit/trail?limit=200`, NOT subscribe to the firehose WS. This is the "orthogonal observation channel" property that lets the sparkline keep updating when the firehose is down (the exact failure mode the operator opens `/system` to diagnose).
- Phase 32 `FORBIDDEN_KEY_PATTERN` & PII discipline: the audit-trail response payload is the same as the firehose feed; consumer code MUST NOT log or display payload contents — only `event_type` + `actor_did` + `created_at` are safe to surface, mirroring `firehose/page.tsx`'s `FirehoseEvent` shape.

---

### `steward/src/components/FrameCounterSparkline.tsx` (component, derived deltas)

**Role:** Two stacked rows of CSS-div bars rendering `frames_sent` delta (top row, neutral) and `frames_dropped` delta (bottom row, `var(--terracotta)`) at 12 × 5s = 1-minute window (D-34-A3).
**Data flow:** Reads delta arrays from `use-health-detailed`'s return value (or recomputes deltas internally given the prev/current `FirehoseStats`).
**Closest analog:** **NO direct analog.** No existing CSS-div sparkline in the codebase. Closest stylistic reference: the `steward-stat-card` div + inline-style convention used throughout `steward/src/app/system/page.tsx:324-336` (a CSS-class container + inline styles for individual elements).

**Stylistic reference excerpt (system/page.tsx:324-336):**
```typescript
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
    {statItems.map(({ label, value }) => (
        <div key={label} className="steward-stat-card">
            <div style={{ padding: '14px 18px 18px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                    {label}
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: value === '—' ? 'var(--muted)' : 'var(--ink)', lineHeight: 1 }}>
                    {value}
                </div>
            </div>
        </div>
    ))}
</div>
```

**What to mirror (as a NEW pattern):**
- Inline-style convention (no styled-components, no Tailwind — Steward uses CSS-var palette + inline `style={{}}` everywhere).
- Palette CSS vars: `var(--ink)`, `var(--muted)`, `var(--terracotta)`, `var(--parchment)`, `var(--vellum)`, `var(--rule)` — defined in `globals.css` (referenced by `StewardShell.tsx`).
- Two-row layout: `<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>` containing two `<div style={{ display: 'flex', gap: 1, height: 16 }}>` rows of bars.
- Per-bar `<div>` with `style={{ width: barWidth, height: '100%', background: sentColor, opacity: scaledByDelta }}` — height-encode the delta, or width-fixed + opacity-encoded.
- Color: `var(--terracotta)` for the dropped row (warning palette — already established as the warn color throughout `/system` drift-alerts panel and clockOpStatus error state). Sent row: planner picks from `var(--ink) at 40% opacity` or `var(--vellum) filled` — both fit the existing palette discipline.
- Mono labels above each row: `fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)'` — matches all other stat-card eyebrow labels.

**What NOT to mirror:**
- The `steward-stat-card` class is for big-number cards (single value, large serif font). Don't wrap the bars in `steward-stat-card` — they're sub-elements of the Firehose Diagnostics `steward-card`.
- Do NOT introduce `<canvas>` — would break the "no chart libs" invariant spirit and is unnecessary for 24 bars total (12 sent + 12 dropped).

**Frozen contracts touched:**
- v2.4 raw-SVG/no-chart-lib invariant — D-34-A1 specifies CSS divs are a deliberate exception for this single-signal bar shape. Do NOT introduce SVG geometry here; the deliberate-exception choice is part of the locked decision.
- REQ OBS-12: 12 buckets × 5s window — do not change cadence or count.
- D-34-A3: color assignment locked (`var(--terracotta)` for dropped) — planner picks the sent-row color from the existing palette only.

---

### `steward/src/lib/health-reason-labels.ts` (label-table, static-import)

**Role:** Snake_case→human-label mapping for the `reasons: string[]` field from `/health/detailed`. Pure data; no React, no hooks, no I/O.
**Data flow:** Static import — `import { HEALTH_REASON_LABELS } from '@/lib/health-reason-labels'`.
**Closest analog:** **NO direct analog.** No existing snake_case→human-label module in `steward/src/lib/`. Closest stylistic reference: the `EVENT_FAMILY_COLORS` record in `steward/src/app/firehose/page.tsx:9-21` (plain `Record<string, ...>` exported as a `const`).

**Stylistic reference excerpt (firehose/page.tsx:9-21):**
```typescript
const EVENT_FAMILY_COLORS: Record<string, { leftBorder: string; badgeBg: string; badgeText: string }> = {
    'operator.': { leftBorder: '#b8542f', badgeBg: 'rgba(184,84,47,0.10)', badgeText: '#b8542f' },
    'nous.':     { leftBorder: '#3a7a5a', badgeBg: 'rgba(58,122,90,0.10)',  badgeText: '#2d6b4a' },
    'trade.':    { leftBorder: '#8a6a2e', badgeBg: 'rgba(138,106,46,0.10)', badgeText: '#7a5a20' },
    // ...
    'unknown':   { leftBorder: '#dbd8cc', badgeBg: 'rgba(219,216,204,0.30)', badgeText: '#8a8479' },
};
```

**What to mirror (as a NEW pattern):**
- Plain `Record<string, string>` exported as a `const` (or `as const` typed).
- Cover the seven known keys from D-34-B2: `grace_period`, `divergence_above_critical`, `persist_error_with_divergence`, `divergence_above_degraded`, `no_frames_with_clients`, `stale_frames`, `reconcile_stale` (all produced by `computeStatus()` at `grid/src/diagnostics/health-watchdog.ts:107-155` — see that file's reason emit sites for the authoritative list).
- Provide a `getReasonLabel(key: string): string` helper that returns `HEALTH_REASON_LABELS[key] ?? key` so unknown reasons fall back to the raw key (graceful unknown — future grid-side additions don't break the UI).
- Keep labels short (Title Case or sentence case, 2-4 words) so they fit comma-separated on one sub-line: e.g., `'reconcile_stale' → 'Reconcile loop stale'`, `'stale_frames' → 'No frames in 60s'`, `'divergence_above_critical' → 'Audit divergence critical'`.

**What NOT to mirror:**
- Don't make this React/JSX — pure data only.
- Don't include color choices in this module — colors are per-card visual concerns (the `reasons` sub-line uses `var(--muted)` everywhere per CONTEXT.md D-34-B3).

**Frozen contracts touched:**
- D-34-B2 — snake_case keys are the source-of-truth (match `computeStatus()` output + the Pino `health_status_changed` log shape).
- D-34-B3 — labels render as comma-separated muted text under the status banner; keep them brief enough to fit on one line.
- Phase 32 `computeStatus()` reasons are authoritative — if grid adds a new reason in a future phase, this file must be updated (deferred CI gate per CONTEXT.md §"Deferred Ideas").

---

### `grid/src/diagnostics/health-watchdog.ts` (MODIFIED — interface extension)

**Role:** Extend `HealthDetailedPayload` (lines 65-82) with `readonly reasons: readonly string[]` (D-34-B1); propagate from `computeStatus()` result (already computed at lines 107-155) through `snapshot()` (line 270+).
**Data flow:** Pure-pull — additive field on the existing payload, no new computation.
**Closest analog:** Self.

**Code excerpt (current shape — interface, lines 65-82):**
```typescript
export interface HealthDetailedPayload {
    readonly status: HealthStatus;
    readonly timestamp: number;
    readonly audit: {
        readonly in_memory_length: number | null;
        readonly persisted_max_id: number | null;
        readonly divergence: number | null;
        readonly divergence_threshold: number;
        readonly last_persist_attempt_at: number | null;
        readonly last_persist_error: { readonly code: string; readonly at: number } | null;
    };
    readonly firehose: FirehoseStats;
    readonly clock: {
        readonly tick: number;
        readonly running: boolean;
        readonly last_tick_at: number | null;
    };
}
```

**Code excerpt (current shape — snapshot() return, lines 243-288):**
```typescript
const { status, reasons } = computeStatus({
    auditDivergence: divergence,
    auditLastPersistError: auditPersistError,
    firehoseLastFrameAt: firehose.last_frame_at,
    firehoseClientCount: firehose.client_count,
    reconcileStaleMs,
    now,
    snapshotCadenceMs: this.snapshotCadenceMs,
    gracePeriodActive,
});

// State-transition log (D-32-B3) — fires only when status changes.
if (this.lastStatus !== null && this.lastStatus !== status) {
    const payload = {
        event: 'health_status_changed',
        from: this.lastStatus,
        to: status,
        reasons,
    };
    if (status === 'ok') {
        log.info(payload, 'health recovered');
    } else {
        log.warn(payload, 'health degraded');
    }
}
this.lastStatus = status;

return {
    status,
    timestamp: now,
    audit: { /* ... */ },
    firehose,
    clock: { /* ... */ },
};
```

**What to mirror (within this file's existing conventions):**
- Add `readonly reasons: readonly string[]` after `status` in the interface (top of payload — same prominence as `status`).
- In `snapshot()`'s return literal, add `reasons,` immediately after `status,` — destructured from `computeStatus()` already in scope.
- Preserve `readonly` discipline — payload immutability is part of the contract.
- Keep `computeStatus()` body (lines 107-155) UNCHANGED — it already returns `reasons` and Phase 32 D-32-C2 explicitly anticipated this propagation.
- Empty array `[]` for `status === 'ok'` (matches current `computeStatus()` line 154: `return { status: 'ok', reasons: [] }`).

**What NOT to mirror:**
- Do NOT add a derived reasons array on the audit/firehose sub-blocks — single top-level `reasons` array per D-34-B1.
- Do NOT change `computeStatus()` evaluation order, thresholds, or reason key names — frozen by Phase 32 D-32-C1 / D-32-C2.
- Do NOT log the new field separately — the existing `health_status_changed` warn-log already includes `reasons` (line 261). Surfacing it in the route payload is the only change.

**Frozen contracts touched:**
- Phase 32 D-32-C1 `HEALTH_THRESHOLDS` — frozen, no change.
- Phase 32 D-32-C2 `computeStatus()` predicate logic — frozen, no change.
- Phase 32 D-32-C3 route shape — extended ADDITIVELY (Phase 34 D-34-B1). Phase 32 D-32-C2 explicitly said: "if Phase 34 wants WHY a status is degraded, expose `computeStatus().reasons` via an additional `/health/detailed` response field" — this is that change, exactly as anticipated.
- Cross-workspace coordination: this is an additive grid-side change consumed by Steward. Order of landing: safe in either direction because Steward consumers MAY treat `reasons` as optional (`payload.reasons ?? []`) until both sides ship.
- Zero-diff invariant (chain.ts): UNTOUCHED — this change is in the diagnostics layer, not the chain.

---

### `grid/test/health-detailed-route.test.ts` (MODIFIED — assertion extension)

**Role:** Extend payload shape assertions to lock the new `reasons` field — empty array on ok, populated on degraded/critical.
**Data flow:** Test — `app.inject()` driven, deterministic.
**Closest analog:** Self.

**Code excerpt (current shape — shape-assertion block, lines 181-208):**
```typescript
it('payload audit block exposes ONLY the OBS-06 contract keys (no leakage)', async () => {
    const now = 4_000_000;
    const built = await buildTestServer({
        auditReconcile: makeFakeReconcile({
            lastReconcileAt: now - 1000,
            persistedMaxId: 50,
            lastPersistError: { code: 'ECONNREFUSED', at: now - 500 },
        }),
        tick: 200, now: () => now,
    });
    app = built.app; clock = built.clock;

    const res = await app.inject({ method: 'GET', url: '/health/detailed' });
    const body = JSON.parse(res.body);
    // T-32-01 information-disclosure mitigation: assert closed key set in audit block.
    expect(Object.keys(body.audit).sort()).toEqual([
        'divergence',
        'divergence_threshold',
        'in_memory_length',
        'last_persist_attempt_at',
        'last_persist_error',
        'persisted_max_id',
    ].sort());
    // Persist error: ONLY {code, at} — no message, no stack.
    expect(Object.keys(body.audit.last_persist_error).sort()).toEqual(['at', 'code']);
    expect(body.audit.last_persist_error).not.toHaveProperty('message');
    expect(body.audit.last_persist_error).not.toHaveProperty('stack');
});
```

**Code excerpt (current shape — top-level keys assertion, line 136):**
```typescript
// Shape completeness: exactly 5 top-level keys.
expect(Object.keys(body).sort()).toEqual(['audit', 'clock', 'firehose', 'status', 'timestamp']);
```

**What to mirror:**
- The existing `Object.keys(body).sort()` exact-match assertion at line 136 is THE shape-lock gate. Extend it: `['audit', 'clock', 'firehose', 'reasons', 'status', 'timestamp']` (6 keys, sorted).
- Add a new `it('exposes reasons array — empty on ok, populated on degraded')` test case that drives the route into degraded (`auditReconcile.lastReconcileAt = now - 6*30_000 - 1` per the existing `'returns degraded when reconcile is stale beyond multiplier'` case at lines 167-179) and asserts `body.reasons` is a non-empty array containing `'reconcile_stale'`.
- Add an ok-case assertion: `expect(body.reasons).toEqual([])`.
- Add a grace-period assertion: `expect(body.reasons).toEqual(['grace_period'])` for the `tick < 60` case at lines 126-146 (matches `computeStatus()` line 112 return value).

**What NOT to mirror:**
- Do NOT change the existing audit-block-only key assertion at lines 196-203 — that's the T-32-01 information-disclosure mitigation for `audit.last_persist_error` shape (no `message`/`stack` leak). Stays exactly as is.
- Do NOT change the p95 latency test (lines 210-229) — `reasons` field adds negligible serialization cost; the 50ms invariant holds.

**Frozen contracts touched:**
- Phase 32 D-32-D2 bullet 3 — this test is the active enforcement of the payload shape contract. Extending it LOCKS the new shape for downstream Steward consumers. Phase 32 D-32 "Cross-phase API stability" section: "Test files (health-detailed-route.test.ts shape assertions) are the active enforcement. No silent shape drift."

---

### `steward/src/app/system/page.tsx` (MODIFIED — 3 new cards + ALLOWLIST_STATIC fix)

**Role:** Render 3 new cards (Audit Pipeline Health, Firehose Diagnostics, Events per Minute by Family) ABOVE the existing Allowlist Monitor section; fix `ALLOWLIST_STATIC` array (lines 7-53) from 45 → 56 entries (D-34-C1).
**Data flow:** REST (via `use-health-detailed`) + REST (via the sparkline's direct fetch).
**Closest analog:** Self.

**Code excerpt (analog — existing card with alert/aria-live, lines 494-540):**
```typescript
{/* Drift Alert Panel — ABOVE static reference per UI-SPEC */}
<div
    role="alert"
    style={{
        background: driftAlerts.length === 0
            ? 'rgba(34,139,34,0.06)'
            : 'rgba(184,84,47,0.08)',
        border: driftAlerts.length === 0
            ? '1px solid rgba(34,139,34,0.3)'
            : '1px solid rgba(184,84,47,0.4)',
        borderLeft: driftAlerts.length === 0
            ? '1px solid rgba(34,139,34,0.3)'
            : '4px solid var(--terracotta)',
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 16,
    }}
>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {driftAlerts.length > 0 && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--terracotta)' }}>!</span>
        )}
        <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, color: driftAlerts.length > 0 ? 'var(--terracotta)' : '#2d7a2d' }}>
            Drift Alerts
        </span>
        <span
            aria-live="polite"
            className="badge"
            style={{
                background: driftAlerts.length > 0 ? 'rgba(184,84,47,0.12)' : 'rgba(34,139,34,0.10)',
                color: driftAlerts.length > 0 ? 'var(--terracotta)' : '#2d7a2d',
                border: driftAlerts.length > 0 ? '1px solid rgba(184,84,47,0.2)' : '1px solid rgba(34,139,34,0.2)',
                fontFamily: 'var(--mono)',
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 10,
            }}
        >
            {driftAlerts.length}
        </span>
    </div>
    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginBottom: 12 }}>
        {/* ... last updated label ... */}
    </div>
    {/* ... body ... */}
</div>
```

**Code excerpt (analog — ALLOWLIST_STATIC array shape, lines 7-53):**
```typescript
// Hardcoded allowlist from grid/src/audit/broadcast-allowlist.ts ALLOWLIST_MEMBERS (45 events as of Phase 24)
const ALLOWLIST_STATIC: Array<{ position: number; eventType: string; producer: string }> = [
    { position: 1,  eventType: 'nous.spawned',                 producer: 'grid/src/nous/' },
    { position: 2,  eventType: 'nous.moved',                   producer: 'grid/src/nous/' },
    // ... 43 more entries ...
    { position: 45, eventType: 'human.transferred',            producer: 'grid/src/audit/append-human-transferred.ts' },
];
```

**What to mirror:**
- **Card insertion site:** Insert the 3 new cards immediately before the existing `{/* Allowlist Monitor */}` block at line 484 (`<div style={{ marginTop: 28 }}>`). Order per CONTEXT.md §"Integration Points": Audit Pipeline Health → Firehose Diagnostics → Events per Minute by Family.
- **Container convention:** Use `className="steward-card"` for each (matches the existing Clock Control card at line 342 and Regions card at line 432). Banner panels within a card may use the inline-`role="alert"` div pattern from the Drift Alert Panel (lines 495-510) for the colored status surface.
- **Status color bands (REQ OBS-11):** Green (`#2d7a2d`, `rgba(34,139,34,0.06)` bg, `rgba(34,139,34,0.3)` border) — already in the drift-alert panel ok state AND the firehose status pill. Red/terracotta (`var(--terracotta)`, `rgba(184,84,47,0.08)` bg, `rgba(184,84,47,0.4)` border) — already in the drift-alert panel drift state. Amber: not yet a precedent in the codebase — planner picks (CONTEXT.md says "`--terracotta` adjacent" — could use `rgba(184,84,47,0.06)` lighter wash + an amber tint like `#b88a2f` for the text).
- **ARIA discipline:** `role="alert"` on the colored status banner (mirrors line 496); `aria-live="polite"` on the divergence count badge (mirrors line 521); these announce status changes to screen readers without interrupting.
- **Big-number convention:** Reuse the `steward-stat-card` class + `fontFamily: 'var(--serif)', fontSize: 32` pattern from lines 326-336 for the divergence count and client_count gauge.
- **Reasons sub-line (D-34-B3):** Directly beneath the big-number banner, render `<div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{reasons.map(getReasonLabel).join(', ')}</div>` — only when `reasons.length > 0`.
- **ALLOWLIST_STATIC fix (D-34-C1):** Update comment header from `(45 events as of Phase 24)` → `(56 events as of Phase 33)`. Add positions 46-56 maintaining the same `{ position, eventType, producer }` shape and column alignment style (mono-spaced visual). Producer-file paths for positions 46-51 are sanction events (path convention `grid/src/audit/append-operator-*.ts`); 52 is `grid/src/audit/append-human-spoke.ts`; 53 is `grid/src/audit/append-nous-spawned-by-human.ts`; 54-56 are confirmed via `ls grid/src/audit/append-portal-auth-*.ts append-human-identified.ts`: `append-portal-auth-login.ts`, `append-portal-auth-register.ts`, `append-human-identified.ts`.
- **Badge auto-update:** Line 599 reads `{ALLOWLIST_STATIC.length} events` — extending the array to 56 entries makes this badge read "56 events" automatically. No additional change needed at the badge site.

**What NOT to mirror:**
- Do NOT replicate the `secondsInterval` 1s tick from the drift-alert pattern unless a card needs an explicit "last updated Xs ago" sub-label (CONTEXT.md says this is optional per Claude's Discretion).
- Do NOT introduce a new `className` — `steward-card` and `steward-stat-card` are the only container classes; do NOT create `steward-health-card` or similar.
- Do NOT use the `pause/resume` clock-control side-by-side `grid-template-columns: '1fr 1fr'` layout — that's a control-input pattern, not a status-display pattern.
- Do NOT touch lines 154-261 (the existing useEffect + fetch handlers) — the new `use-health-detailed` hook adds its own state alongside; existing state stays unchanged (Surgical Changes rule).

**Frozen contracts touched:**
- Allowlist-frozen invariant: D-34-C1 adds zero events to the actual allowlist (`grid/src/audit/broadcast-allowlist.ts` stays at 56). This is a Steward-side STATIC array sync, not an allowlist mutation. PHILOSOPHY.md §7 unaffected.
- v2.4 Culture Dashboard SVG invariant — applies to the new sparkline component the page imports; the page itself doesn't render SVG.
- Phase 32 D-32-C3 — `/health/detailed` is the data source for the two health cards (Audit + Firehose).
- D-34-B3 — reasons sub-line lives directly beneath the banner inside both health cards; cross-cutting reasons render on both, audit-prefix reasons on the audit card only, firehose-prefix reasons on the firehose card only.

---

### `steward/src/app/firehose/page.tsx` (MODIFIED — add watchdog hook call)

**Role:** Add a client-side watchdog that reads `last_frame_at` from polled `/health/detailed.firehose` and forces WS reconnect when `Date.now() - last_frame_at > 60_000 AND client_count > 0` (REQ OBS-14).
**Data flow:** Existing WS event-driven + new 5s watchdog interval that calls `wsRef.current?.close()` to trigger the existing reconnect path.
**Closest analog:** Self.

**Code excerpt (analog — connect() entry point + scheduleReconnect() + unmount cleanup, lines 88-177):**
```typescript
function connect() {
    const wsUrl = GRID_ORIGIN.replace(/^http/, 'ws') + '/api/v1/audit/firehose';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setConnected('connecting');

    ws.onopen = () => {
        setConnected('connected');
        retryDelayRef.current = 1;
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
        setRetryCountdown(0);
    };

    // ... ws.onmessage / onclose / onerror ...
}

function scheduleReconnect() {
    const delay = retryDelayRef.current;
    retryDelayRef.current = Math.min(delay * 2, 30);
    // ... countdownTimer + retryTimer setup ...
    retryTimerRef.current = setTimeout(() => {
        connect();
    }, delay * 1000);
}

useEffect(() => {
    connect();
    return () => {
        if (wsRef.current) wsRef.current.close();
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**What to mirror:**
- Add a NEW `useEffect` AFTER the existing one (lines 169-177); inside it, set up `const watchdogInterval = setInterval(checkFreshness, 5000)`. Return `() => clearInterval(watchdogInterval)` for cleanup — mirrors the existing cleanup discipline.
- `checkFreshness` fetches `${GRID_ORIGIN}/health/detailed` (or, if the planner extracts `use-health-detailed` for shared use, reads from that hook). If `data.firehose.last_frame_at !== null && Date.now() - data.firehose.last_frame_at > 60_000 && data.firehose.client_count > 0` → `wsRef.current?.close()`. The existing `ws.onclose` (line 136) fires `scheduleReconnect()` automatically — no new reconnect code.
- Keep the existing `connect()` / `scheduleReconnect()` UNCHANGED — they handle the reconnect path correctly already.
- Suppression window for reconnect storm (R-34-03): track `lastWatchdogClose: number | null` in a `useRef`; only trigger close if `Date.now() - lastWatchdogClose > 60_000`. Without this, the watchdog could re-trigger close immediately after reconnect when `last_frame_at` is stale by definition for a few seconds.

**What NOT to mirror:**
- Do NOT modify the existing `connect()`, `scheduleReconnect()`, `ws.onmessage`, or any state-mutation logic (Surgical Changes — every line traces to OBS-14, not WS plumbing changes).
- Do NOT modify the `EVENT_FAMILY_COLORS` palette, the table rendering, or the hover-pause UX.
- Do NOT replace the exponential backoff with a fixed-delay reconnect — the backoff is part of R-34-03 mitigation.

**Frozen contracts touched:**
- Phase 32 D-32-A4 `FirehoseStats` shape — watchdog reads `last_frame_at` and `client_count` from this shape via `/health/detailed`.
- REQ OBS-14 trigger predicate: `Date.now() - last_frame_at > 60_000 AND client_count > 0` — locked exactly.
- R-34-03 reconnect storm — must NOT trigger continuous reconnect loop; suppression window OR backoff-respect required.
- Existing `/firehose` page WS plumbing (Phase 25a / 25b territory) — UNTOUCHED except for the new watchdog interval addition.

---

## Shared Patterns

### Authentication / Authorization
**Not applicable.** `/health/detailed` is a public read-only endpoint (Phase 32 D-32-C3); `/api/v1/audit/trail` is also public (no `x-operator-id` header required for reads). No new auth surfaces in Phase 34. The Steward `app/api/operator/[...path]/route.ts` proxy is for WRITE actions only — Phase 34 introduces zero writes.

### Error Handling
**Source:** `steward/src/app/system/page.tsx:221-240` (fetchDriftAlerts try/catch shape)
**Apply to:** `use-health-detailed.ts`, `EventsPerMinuteSparkline.tsx` fetch
```typescript
async function fetchDriftAlerts() {
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/audit/drift-alerts`);
        if (!res.ok) {
            if (res.status === 503) {
                setDriftError('Drift endpoint unavailable.');
            } else {
                setDriftError(`HTTP ${res.status}`);
            }
            return;
        }
        const data = await res.json();
        setDriftAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        setDriftLastUpdated(Date.now());
        setDriftSecondsAgo(0);
        setDriftError(null);
    } catch {
        setDriftError('Drift endpoint unavailable.');
    }
}
```
**Discipline:** 503 special-cased (anticipated startup-window response from `/health/detailed`); network failures collapse to a single muted error string; never throw out of the fetch handler.

### CSS Variable Palette
**Source:** `steward/src/components/StewardShell.tsx` (referenced throughout; CSS-var definitions live in `globals.css`)
**Apply to:** All new components — `EventsPerMinuteSparkline.tsx`, `FrameCounterSparkline.tsx`, all new card markup in `system/page.tsx`.

Canonical vars used by Phase 34:
- `--ink` — primary text
- `--muted` — secondary / metadata text
- `--terracotta` — warning / error / drop-counter
- `--parchment` — card background base
- `--vellum` — secondary card bg / pill bg
- `--rule` — borders
- `--mono` — tabular / metadata fontFamily
- `--serif` — heading / big-number fontFamily

Status color bands (REQ OBS-11):
- Green: `#2d7a2d` text, `rgba(34,139,34,0.06)` bg, `rgba(34,139,34,0.3)` border (already in `/firehose` status pill + drift-alert ok state)
- Red: `var(--terracotta)` text, `rgba(184,84,47,0.08)` bg, `rgba(184,84,47,0.4)` border (already in drift-alert drift state + clockOpStatus error state)
- Amber: NEW — planner picks from the existing palette adjacent space

### Tabular / Mono Convention
**Source:** Throughout `system/page.tsx`, `firehose/page.tsx`, `StewardShell.tsx`
- `fontFamily: 'var(--mono)'` for tabular data, timestamps, counts, eyebrow labels
- `fontFamily: 'var(--serif)'` for headings + big numbers
- Eyebrow labels: `fontSize: 9-10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)'`

### Direct-Fetch Pattern for Read-Only Endpoints
**Source:** `steward/src/app/system/page.tsx:183-219` (fetchStatus, fetchClock, fetchRegions all hit `${GRID_ORIGIN}/api/v1/...` directly without the operator proxy)
**Apply to:** `use-health-detailed.ts` (`${GRID_ORIGIN}/health/detailed`), `EventsPerMinuteSparkline.tsx` (`${GRID_ORIGIN}/api/v1/audit/trail?limit=200`).
**Discipline:** Operator proxy at `steward/src/app/api/operator/[...path]/route.ts` is for WRITE actions only because `x-operator-id` is server-only. Read endpoints go direct.

---

## No Analog Found

Two new files with no direct codebase analog — planner uses RESEARCH.md patterns + the stylistic-reference excerpts above:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `steward/src/components/FrameCounterSparkline.tsx` | component | derived deltas | No existing CSS-div sparkline. Stylistic ref: `steward-stat-card` inline-style pattern. NEW visual primitive per D-34-A1 (deliberate exception to SVG-only invariant). |
| `steward/src/lib/health-reason-labels.ts` | label-table | static-import | No existing snake_case→human-label mapping module in `steward/src/lib/` (lib/ directory itself does not yet exist — Phase 34 creates it). Stylistic ref: `EVENT_FAMILY_COLORS` (firehose/page.tsx:9-21). |

---

## Cross-Workspace Coordination Notes

### D-34-B1 ordering safety
The `HealthDetailedPayload.reasons` field is **additive** (Phase 32 D-32-C3 contract permits this). Land order is flexible:
- **Grid first:** Steward consumers see the new field but render nothing until Steward's cards exist — no functional regression.
- **Steward first:** Steward consumers treat `reasons` as optional (`payload.reasons ?? []`) and render nothing until Grid populates the field — no functional regression.

In practice the planner should treat this as ONE atomic phase (both workspaces land together) because Phase 34's value proposition (visible reasons sub-line) requires both halves.

### Test gate locks the shape
`grid/test/health-detailed-route.test.ts` is the active enforcement — extending its `Object.keys(body).sort()` assertion locks the new 6-key payload shape going forward (Phase 32 D-32-D2 "no silent shape drift" discipline). Any future grid-side change that drops `reasons` from the payload fails this test.

### ALLOWLIST_STATIC sync vs the real allowlist
- Real allowlist: `grid/src/audit/broadcast-allowlist.ts` `ALLOWLIST_MEMBERS` — 56 entries, frozen at runtime via `buildFrozenAllowlist()`.
- Steward static reflection: `steward/src/app/system/page.tsx:7-53` — currently 45 entries, fixed inline to 56 in this phase (D-34-C1). CI gate to prevent future drift is **deferred to v2.7+** per CONTEXT.md §"Deferred Ideas".

---

## Metadata

**Analog search scope:**
- `steward/src/app/` (full)
- `steward/src/components/` (full)
- `steward/src/lib/` (does not exist yet — Phase 34 creates it)
- `grid/src/diagnostics/health-watchdog.ts`
- `grid/src/api/routes/health-detailed.ts`
- `grid/src/audit/firehose-hub.ts`
- `grid/src/audit/broadcast-allowlist.ts`
- `grid/src/audit/append-portal-auth-login.ts` / `append-portal-auth-register.ts` / `append-human-identified.ts`
- `grid/test/health-detailed-route.test.ts`

**Files scanned:** ~12
**Pattern extraction date:** 2026-05-25

## PATTERN MAPPING COMPLETE
