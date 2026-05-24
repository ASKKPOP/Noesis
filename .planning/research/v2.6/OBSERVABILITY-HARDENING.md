# v2.6 Research — Observability & Audit Pipeline Hardening

**Researched:** 2026-05-23
**Confidence:** HIGH (root cause of GAP-A confirmed by direct file read)
**Reading depth:** chain.ts, persistent-chain.ts, audit-store.ts, grid-store.ts, launcher.ts, main.ts, firehose-hub.ts, server.ts, ticker.ts, broadcast-allowlist.ts, append-human-joined.ts, portal/auth.ts, humans.ts

---

## Executive Summary

1. **GAP-A is a wiring bug, not a flusher stall.** `GenesisLauncher` constructs a plain `AuditChain` (launcher.ts:138), not `PersistentAuditChain`. The only path that writes to MySQL `audit_trail` is `snapshotGrid()`, which runs once at first boot and once at graceful shutdown. Since 2026-05-22T06:57Z the Grid has not been gracefully restarted; the in-memory chain has grown from 2193 → 2430+ with zero MySQL writes. **Hypothesis A (flusher stall) is wrong — there is no flusher.** Fix: switch construction to `PersistentAuditChain` OR add a tick-cadenced incremental flush. Recommendation below: do both, with the flush as the primary write path and a periodic reconcile as belt-and-suspenders.

2. **GAP-A firehose silence is a SEPARATE bug.** The in-memory chain IS growing (2430+ entries observed) and `tick` IS allowlisted (position 9), yet the WS hub delivers zero `event` frames. Per direct reading of `firehose-hub.ts:130`, the hub subscribes via `this.audit.onAppend(...)` in its constructor — and is constructed inside `buildServerWithHub` (server.ts:572) with the SAME `services.audit` reference passed to launcher.ts. The two surfaces are tied to one chain instance. The most likely cause is that **`buildServerWithHub` is never called in production** — instead, `main.ts:190` calls plain `buildServer(...)` which delegates to `buildServerWithHub` correctly (server.ts:259), so the hub IS constructed; but the firehose hub then sees only the listener set captured AT construction time. If the construction order in production is `launcher.bootstrap()` (which wires the tick listener via `this.clock.onTick`) → `buildServerWithHub` (which wires firehose `onAppend`) → `launcher.start()`, the order is correct. The frame-zero symptom must come from one of: (a) `tick` listener firing before firehose subscribed (race window narrow but possible at boot), (b) silent throw inside `ClientConnection.enqueue` that escapes the outer try/catch, (c) browser-side WS connection upgrading then immediately being deduplicated by a stale page handle. Phase 31 must add observable frame counters to disambiguate — without them the cause cannot be diagnosed with certainty.

3. **GAP-B is straightforward but has one trap.** `portal.auth.login` / `portal.auth.register` are read by `humans.ts:97-98` and `steward/users/page.tsx:95-97` but emitted by NO producer. Adding them is a 4-file change per producer (sole-producer file, allowlist entry, wiring point, regression test). The trap: SIWE flows carry IP and User-Agent on `req.raw.socket.remoteAddress` and `req.headers['user-agent']`. PHILOSOPHY §8 (zero custody, sovereignty for humans) forbids putting raw IP into the audit chain. **Recommendation: do NOT include IP, UA, or device fingerprint in the payload.** Hash them if needed (`ua_hash`, `ip_hash`) but the simpler answer is to keep the payload minimal: `{human_did, method, tick}` where `method ∈ {siwe, email}`.

4. **Sovereignty-compatible observability stack is already in-process.** No new Docker service. No Prometheus scrape endpoint. Pino v10.1.0 for structured logging (already a transitive dep via Fastify), in-process counters exposed via extended `/health/detailed` JSON endpoint, and a `WsFirehoseHub.stats()` accessor that returns `{frames_sent_total, frames_dropped_total, client_count, last_frame_at}`. The Steward Console `/system` page polls this every 5s — no scrape protocol needed.

5. **Phase ordering is forced.** Phase 31 must fix GAP-A first (no point lighting up new producers if the chain itself doesn't persist). Phase 32 hardens the firehose. Phase 33 adds the missing producers. Phase 34 lands the Steward `/system` audit-pipeline-health card. Phase 35 closes the UAT loop (re-verify items #1 and #5).

---

## GAP-A Deep Dive — Audit Pipeline Silence

### Root-cause hypotheses ranked by likelihood

**H1 (CONFIRMED, HIGH confidence) — There is no live MySQL flush path in production.**
- Evidence: `grid/src/genesis/launcher.ts:138` reads `this.audit = new AuditChain()`. There is no override hook, no factory, no `PersistentAuditChain` instantiation anywhere in `main.ts` or `launcher.ts`.
- `PersistentAuditChain` exists in `grid/src/db/persistent-chain.ts` but is exported only via `grid/src/index.ts:36` for external consumers (Rigs, tests). It is never reached by the production boot path.
- The only MySQL writes happen via `snapshotGrid()` in `grid/src/main.ts:127` (first boot) and `:247` (graceful shutdown). Both run a synchronous loop over `launcher.audit.all()` and `await this.audit.append(...)` per entry. There is no tick-cadenced flush, no batched flush, no listener-driven flush.
- This matches the observed symptom byte-for-byte: max id 2193 was the snapshot taken at last graceful shutdown (2026-05-22T06:57Z); in-memory has grown to 2430+ because the Grid has been running continuously without graceful stop since then.

**H2 (RULED OUT, HIGH confidence) — MySQL flusher errored into stuck state.**
- Cannot apply: no flusher exists. Even `PersistentAuditChain`'s fire-and-forget `this.store.append(...).catch(...)` (persistent-chain.ts:34-39) catches errors and logs but does not "get stuck" — it just drops the write and continues.

**H3 (DISTINCT bug, MEDIUM confidence) — Firehose listener fan-out is silent for non-`tick` events.**
- The launcher wires `audit.append('tick', 'system', ...)` on every tick (launcher.ts:336). With ticks advancing 234 → 236 during the UAT observation window, the firehose SHOULD have delivered 2-3 `event` frames carrying `eventType: 'tick'`.
- Possibilities:
  - (a) Construction-order race: firehose hub is constructed at `buildServerWithHub` (called inside `buildServer` at main.ts:190, BEFORE `launcher.start()` which starts the clock). So the firehose listener IS registered before the first tick fires. Race ruled out.
  - (b) Silent throw inside `ClientConnection.enqueue`: ring buffer logic looks correct, `bufferedAmount` check is fine, `socket.send` is wrapped in try/catch. Unlikely.
  - (c) The firehose route registration scope: route is registered inside `app.register(async (instance) => {...})` (server.ts:588). Inside that scope, `registerAuditFirehoseRoute(instance, firehoseHub)` is called BEFORE the `/ws/events` route declaration. Both routes share the same `instance` scope. This is correct per the `25a-RESEARCH.md` Pitfall 5 note ("Do NOT register fastifyWebsocket a second time"). Likely correct.
  - (d) The browser-side EventSource/WebSocket connecting to the wrong URL or hitting CORS preflight. Steward dev runs on :3002, Grid on :8080, CORS allowlists :3002. Possible the WebSocket isn't going through CORS at all but the `hello` frame IS received per UAT evidence, so the connection succeeded.
- Most likely live cause: **(b)** silent failure inside `ClientConnection.enqueue` where a thrown JSON.stringify on a circular payload (unlikely) or `socket.send` throwing on a half-closed socket. Phase 32 needs frame counters to disambiguate.

### Recommended fix pattern + code-shape sketch

**Phase 31 fix (priority 1) — Wire `PersistentAuditChain` in production with a periodic reconcile.**

Change `grid/src/genesis/launcher.ts:138` from:
```typescript
this.audit = new AuditChain();
```
to accept an injected chain (or factory), and modify `main.ts:69-81` to construct the chain BEFORE the launcher:

```typescript
// main.ts (sketch)
const dbConn = config.db ? new DatabaseConnection(config.db) : undefined;
if (dbConn) await new MigrationRunner(dbConn).run();

const auditStore = dbConn ? new AuditStore(dbConn) : undefined;
const chain = auditStore
    ? new PersistentAuditChain(auditStore, config.genesisConfig.gridName)
    : new AuditChain();

const launcher = new GenesisLauncher(config.genesisConfig, { audit: chain });
```

This is the minimum surgical change. `PersistentAuditChain.append()` already calls `super.append()` first (in-memory commit + listener fan-out) THEN fire-and-forget DB write (persistent-chain.ts:30-41), so:
- Listeners (DialogueAggregator, RelationshipListener, NormDetector, firehose, drift) all fire on the in-memory commit, unchanged
- MySQL write happens asynchronously per entry — no batching, no stuck state
- A DB failure logs a warning and drops that one entry (acceptable; periodic reconcile catches it)

**Phase 31 fix (priority 2) — Add tick-cadenced reconcile loop as belt-and-suspenders.**

Every 60 ticks (≈30s at default tick rate), compare `chain.length` to `SELECT MAX(id) FROM audit_trail WHERE grid_name = ?`. If divergence > 10 entries, replay missing tail entries via `AuditStore.append()` (which is `INSERT IGNORE`, idempotent). Implementation file: `grid/src/db/audit-reconcile.ts`. Wired into `launcher.clock.onTick()`.

**Phase 31 fix (priority 3) — Structured logging on every flush attempt.**

Replace the `console.warn` in `persistent-chain.ts:35-38` with a Pino structured log:
```typescript
this.logger.warn({
    event: 'audit_persist_failed',
    entry_id: entry.id,
    event_type: eventType,
    error_message: err instanceof Error ? err.message : String(err),
    error_code: (err as { code?: string })?.code,
}, 'failed to persist audit entry');
```
This produces grep-able log lines (`event="audit_persist_failed"`) that operators can scrape from Docker logs and that a future Phase will aggregate into `/api/v1/health/detailed`.

### Prevention: regression test or CI gate

**Regression test** at `grid/src/__tests__/audit-persistence-wiring.test.ts`:
```typescript
test('production launcher constructs PersistentAuditChain when db is configured', async () => {
    const { launcher } = await createGridApp({ ...config, db: testDbConfig });
    expect(launcher.audit.constructor.name).toBe('PersistentAuditChain');
});
```

**CI grep gate** at `scripts/check-audit-chain-wiring.mjs`:
```bash
# Asserts that grid/src/main.ts mentions PersistentAuditChain by name.
# This is a structural gate — if someone reverts to plain AuditChain in
# main.ts, the test catches it before merge.
grep -q "PersistentAuditChain" grid/src/main.ts || exit 1
```

---

## GAP-B Deep Dive — Missing portal.auth.* Producers

### Proposed payload tuples (alphabetical keys, closed)

**`portal.auth.login`** — emitted on SIWE verify success AND email signin success (both lead to a session being established).

Closed 3-key payload:
```typescript
{
    human_did: string,    // DID_RE  (did:noesis:human:...)
    method: 'siwe' | 'email',
    tick: number,         // non-negative integer
}
```

**`portal.auth.register`** — emitted ONLY on first-time account creation (SIWE first-connect via `humanRegistry.createHuman`, OR email signup).

Closed 3-key payload:
```typescript
{
    human_did: string,    // DID_RE
    method: 'siwe' | 'email',
    tick: number,
}
```

**Why 3 keys not 5:** every additional key is an exposed PII surface. Time-of-event is already covered by `entry.createdAt` (set by `AuditChain.append` to `Date.now()`). The simulation tick anchor matches every other v2.5 human event (`human.joined`, `human.transferred`, `human.spoke`). The `method` enum is closed at exactly 2 values; expansion to a 3rd (e.g., `wallet_connect`) is a future allowlist decision, not a payload free-text field.

### Privacy considerations — what MUST stay off the wire

**MUST NOT appear in payload (PHILOSOPHY §1, §7, §8):**
- Raw IP address — sovereignty violation; correlatable to physical location
- User-Agent string — fingerprintable across sessions
- Email address (plaintext) — PII, never required by downstream consumers
- ETH address (raw) — `eth_address_hash` exists for `human.joined`; `portal.auth.login` and `register` are session events that don't need to re-identify by address (the `human_did` is the canonical identity)
- Browser locale, screen size, timezone — fingerprintable
- Session-ID / JWT / cookie value — not needed; chain is durable record of "auth happened", not the auth token itself
- Password hash, scrypt salt — would be a catastrophic leak even hashed
- Plaintext nonce or signature — already validated server-side; chain doesn't need to record cryptographic material

**MAY appear if a future phase needs it:**
- `ua_hash` (SHA-256 of User-Agent string) — for "is this the same device" analytics. Adds 1 key. Deferred per YAGNI; do not add in v2.6.
- `ip_country` (geo-coarsened country code) — geographic distribution analytics. Adds 1 key. Deferred.
- Neither is needed to light up `/users` directory or `/humans/[did]/history siwe_sessions`.

### Sole-producer file plan

**File 1:** `grid/src/audit/append-portal-auth-login.ts`
```typescript
export const LOGIN_METHOD_ENUM = ['siwe', 'email'] as const;
export type LoginMethod = typeof LOGIN_METHOD_ENUM[number];

export interface PortalAuthLoginPayload {
    readonly human_did: string;
    readonly method: LoginMethod;
    readonly tick: number;
}

const EXPECTED_KEYS = ['human_did', 'method', 'tick'] as const;

export function appendPortalAuthLogin(
    audit: AuditChain,
    payload: PortalAuthLoginPayload,
): AuditEntry {
    // Discipline copied verbatim from append-human-joined.ts:
    // 1. object guard, 2. DID_RE on human_did, 3. closed enum on method,
    // 4. integer guard on tick, 5. Object.keys(payload).sort() strict
    // equality vs EXPECTED_KEYS, 6. explicit reconstruction,
    // 7. payloadPrivacyCheck, 8. audit.append('portal.auth.login', ...).
}
```

**File 2:** `grid/src/audit/append-portal-auth-register.ts` — identical shape with `appendPortalAuthRegister` and `'portal.auth.register'`.

Both files mirror `append-human-joined.ts:50-114` line-by-line. The DID_RE + payloadPrivacyCheck + closed-tuple structural check + explicit reconstruction pattern is non-negotiable.

### Allowlist position (54, 55) — confirm against current 53-entry allowlist

Per `grid/src/audit/broadcast-allowlist.ts:80-206`, the current list is exactly 53 entries ending at `'nous.spawned_by_human'` (position 53). Phase 33 additions:

- Position 54: `'portal.auth.login'`
- Position 55: `'portal.auth.register'`

Add as the last two entries, with the existing comment convention. Update the `Phase 27 / Phase 28` count comments at top-of-file from "Allowlist 53" to "Allowlist 55, Phase 33 addition".

### Wiring points in auth.ts

`grid/src/api/portal/auth.ts` (THIS file):

- **Line 125 (after `appendHumanJoined` call in SIWE verify):** Add `appendPortalAuthRegister(...)` when `isNew === true`. The existing `human.joined` call is the FIRST-CONNECT event; `portal.auth.register` is semantically aligned with the same boundary but distinguishes "this is registration, not just connect" for analytics consumers.
- **Line ~131 (after the existing branch, unconditional for SIWE):** Add `appendPortalAuthLogin({ human_did: human.did, method: 'siwe', tick: services.clock.state.tick })`. Every SIWE verify success is a login event regardless of `isNew`.
- **Line ~217 (after `humanRegistry.createHuman` in email signup):** Add `appendPortalAuthRegister({ human_did: human.did, method: 'email', tick: services.clock.state.tick })` AND `appendPortalAuthLogin({ ..., method: 'email', tick: ... })` (signup also establishes a session).
- **Line ~265 (after password verify success in email signin):** Add `appendPortalAuthLogin({ human_did: human.did, method: 'email', tick: services.clock.state.tick })`. No `register` event — this is an existing user.

### Forbidden-key additions

None. The proposed payload only contains `human_did`, `method`, `tick` — all three are present in existing allowlisted events (`human_did` in `human.joined`, `method` is a new closed-enum string field, `tick` is universal). `method` is short enough that it could collide with future events but the FORBIDDEN_KEY_PATTERN regex doesn't currently match it, and we don't want it to.

However: **`PORTAL_AUTH_FORBIDDEN_KEYS`** should be declared for symmetry with the other domain-specific forbidden-key sets (DRIVE, BIOS, CHRONOS, GOVERNANCE, IRIS, HYPNOS, SKILL, NORM, LORE, WHISPER):

```typescript
export const PORTAL_AUTH_FORBIDDEN_KEYS = Object.freeze([
    'ip_address',
    'ip',
    'user_agent',
    'ua',
    'session_id',
    'token',
    'jwt',
    'cookie',
    'email',           // plaintext email never in chain
    'password_hash',   // never in chain
    'nonce',           // SIWE nonce — already validated
    'signature',       // SIWE signature — already validated
    'device_fingerprint',
] as const);
```

Then extend `FORBIDDEN_KEY_PATTERN` to add: `ip|user_agent|session_id|token|jwt|cookie|email|password_hash|nonce|signature|device_fingerprint`.

NB: `email` and `nonce` are common-enough English words that they could collide with legitimate keys in future events. Take care to NOT add them naively — instead use word-boundary regex anchors. Suggested pattern fragment: `\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b`. Test cases needed for `email_hash` (allowed) vs `email` (forbidden), `nonce_hash` (allowed) vs `nonce` (forbidden).

---

## Health Probes & Observability Surfaces

### /health endpoint extension shape

The existing `/health` returns `{ status: 'ok', timestamp }` (server.ts:284-286). Keep that response shape for backward compatibility. **Add a separate endpoint** `/health/detailed` so the basic `/health` stays cheap (used by Docker healthcheck, load balancers) and `/health/detailed` is a richer surface for the Steward.

`GET /health/detailed` returns:
```typescript
{
    status: 'ok' | 'degraded' | 'critical',
    timestamp: number,
    audit: {
        in_memory_length: number,           // launcher.audit.length
        persisted_max_id: number | null,    // SELECT MAX(id) FROM audit_trail WHERE grid_name = ?
        divergence: number | null,          // in_memory - persisted (null if no DB)
        divergence_threshold: 10,           // alert ceiling
        last_persist_attempt_at: number | null,  // ms epoch
        last_persist_error: string | null,  // last error code, e.g. 'ER_LOCK_DEADLOCK'
    },
    firehose: {
        client_count: number,
        frames_sent_total: number,
        frames_dropped_total: number,
        last_frame_at: number | null,        // ms epoch of last successful enqueue
        watermark_bytes: number,             // configured backpressure ceiling
    },
    clock: {
        tick: number,
        running: boolean,
        last_tick_at: number,
    },
}
```

**Rules:**
- `status: 'degraded'` when `audit.divergence > 10` OR `firehose.last_frame_at` is null OR (`Date.now() - firehose.last_frame_at > 60_000` AND `client_count > 0`).
- `status: 'critical'` when `audit.divergence > 100` OR `audit.last_persist_error` is set and `audit.divergence > 0`.
- Endpoint MUST NOT block on DB — use a cached `persisted_max_id` updated every 30s by the reconcile loop. Cache miss returns `null` not a slow query.

**Avoid the trap that this endpoint becomes the next silent failure:**
- The reconcile loop that populates `persisted_max_id` MUST log on EVERY tick where it runs (not just on failure). Even a `{ event: 'audit_reconcile_ok', divergence: 0 }` heartbeat at debug level prevents "we stopped checking and didn't notice".
- A separate watchdog (in `grid/src/diagnostics/health-watchdog.ts`) compares `Date.now() - lastReconcileAt` to `5 * snapshotCadenceMs`. If exceeded, surface `status: 'degraded'` with `last_reconcile_at` in the response.

### Steward `/system` card additions

In `steward/src/app/system/page.tsx` (which already exists per UAT item #2), add three cards above the existing Allowlist Monitor:

1. **Audit Pipeline Health card.** Polls `/health/detailed` every 5s. Renders the `audit` block with:
   - Big number: `divergence` (green if 0, amber if 1-10, red if >10)
   - Sub-line: `In-memory: 2430 · Persisted: 2193 · Last persist error: ER_LOCK_DEADLOCK at 13:42:01`

2. **Firehose Diagnostics card.** Polls `/health/detailed` every 5s. Renders:
   - Connected clients: gauge
   - Frames sent (last 60s): delta from previous poll, sparkline of last 12 polls = 1 minute
   - Frames dropped (last 60s): delta
   - Time since last frame: `5s ago` / `12m ago` (red if > 60s with clients connected)

3. **Events per Minute by Family sparkline.** Reads `GET /api/v1/audit/trail?limit=200` and buckets by `eventType` prefix (`nous.*`, `operator.*`, `trade.*`, etc.). Renders a horizontal stacked bar of the last 5 minutes. **This card MUST NOT use the firehose WS** — it polls REST so it stays alive even when the firehose is broken (which is exactly when you want to look at it).

### Frame-counter + drop-counter shape for `WsFirehoseHub`

Add to `WsFirehoseHub` (firehose-hub.ts):

```typescript
private metrics = {
    frames_sent_total: 0,
    frames_dropped_total: 0,
    last_frame_at: null as number | null,
};

stats(): {
    client_count: number;
    frames_sent_total: number;
    frames_dropped_total: number;
    last_frame_at: number | null;
    watermark_bytes: number;
} {
    return {
        client_count: this._clients.size,
        frames_sent_total: this.metrics.frames_sent_total,
        frames_dropped_total: this.metrics.frames_dropped_total,
        last_frame_at: this.metrics.last_frame_at,
        watermark_bytes: this.watermarkBytes,
    };
}
```

Increment `frames_sent_total` in `ClientConnection.trySend()` AFTER the `socket.send` succeeds (not before — backpressure-evicted entries should NOT count as "sent"). Increment `frames_dropped_total` in `ClientConnection.enqueue()` when `this.buffer.push(entry)` evicts an oldest entry (RingBuffer needs an `onEvict` callback OR check size before/after push).

Update `last_frame_at` to `Date.now()` on every successful `trySend`.

### Avoiding the "observer is the next thing that silently fails" trap

Three rules:

1. **Every observability surface ships with its own self-test endpoint.** `/api/v1/health/diagnostics/self-test` runs through: append a synthetic event to the chain (event type `diagnostics.heartbeat` — NOT allowlisted, intentionally; we want it filtered by the firehose), then within 2s, query DB for the entry by event_hash, verify `firehose_hub.stats().frames_sent_total` is at least the value seen 2s ago. Returns 200 if all three pass, 503 if any fails. Steward `/system` runs this on a manual button click ("Run diagnostics") AND on initial page load.

2. **Health-watchdog logs every iteration.** The reconcile loop logs `{ event: 'audit_reconcile', divergence: N }` at INFO level on every cadence tick — not just on error. Operators grep `tail -f` and see proof of life; if the log stops, that's itself a signal.

3. **CI gate: `scripts/check-observability-no-todo.mjs`** that greps for the regex `(?:TODO|FIXME|XXX).{0,50}(?:health|metric|frame|drift|reconcile)` in `grid/src/`. Fails the build if any such comment lands — observability code with deferred work is exactly what produces silent failures.

---

## Library Recommendations

| Library | Version | Purpose | Why sovereignty-safe |
|---------|---------|---------|----------------------|
| **pino** | 10.1.0 | Structured JSON logging — replaces `console.warn` calls in `persistent-chain.ts`, adds structured fields to flusher errors and reconcile loop heartbeats | Pure Node lib, zero external dependencies, runs in-process. Already a Fastify transitive dep. Output is plain JSON to stdout — Docker logs capture it; operators pipe to whatever sink they want. No SaaS attachment. (Verified via Context7 `/pinojs/pino`, Source Reputation High, Benchmark 87.6) |
| **mysql2 retry config** | (existing 3.x) | Pool config `acquireTimeout: 10_000`, `enableKeepAlive: true`, `keepAliveInitialDelay: 30_000` to detect dead connections | mysql2 already in stack. Config-only change. Per Context7 `/websites/sidorares_github_io_node-mysql2` Source Reputation High, Benchmark 98 — recommended for long-running pools |

**Explicitly rejected:**

| Library | Why rejected |
|---------|--------------|
| `prom-client` (Prometheus) | Adds new HTTP scrape endpoint surface; pulls Prometheus deployment model into the stack. Sovereignty-incompatible without operator running a Prometheus instance. Self-hosted users on a single VPS gain nothing. Use Pino + `/health/detailed` JSON polling instead. |
| `pino-mysql` (or any pino-to-MySQL transport) | Same MySQL connection that audit_trail uses — logging-into-the-thing-you're-monitoring is a single-point-of-failure. Log to stdout, let Docker handle it. |
| OpenTelemetry SaaS (Datadog, Honeycomb, New Relic) | Vendor lock-in violates PHILOSOPHY §1 sovereignty. `@fastify/otel` (Source Reputation High, Benchmark 88) exists and is self-host-able with an OTLP collector — DEFERRED to v2.7+ if/when operators ask. Don't introduce now. |
| `pino-opentelemetry-transport` | Same — defer. |
| `winston` | pino is faster and is already in tree via Fastify. No reason to introduce a second logger. |
| `node-fetch` for health endpoint polling from Steward | Steward is Next.js — use native `fetch` (Node 22 has it). No new dep. |

---

## Pitfalls

1. **Construction-order race between firehose subscription and first tick.**
   - Where it could re-occur: `grid/src/api/server.ts:572` — `WsFirehoseHub` is constructed inside `buildServerWithHub`, AFTER `launcher.bootstrap()` has wired the `clock.onTick` callback. If a future refactor moves the clock-start before the hub construction, the first N ticks would fire-and-vanish.
   - Prevention gate: regression test `grid/src/__tests__/firehose-subscribes-before-clock.test.ts` — builds the server, asserts that `firehoseHub.stats().frames_sent_total > 0` after `clock.advance()` is called manually before `clock.start()`.

2. **PersistentAuditChain swallows DB errors silently (persistent-chain.ts:34-39).**
   - Where it could re-occur: any `.catch(err => console.warn(...))` pattern in the persistence layer. The grep for `.catch.*console\.warn` returns this file as the canonical instance.
   - Prevention gate: extend `scripts/check-no-silent-catch.mjs` (or create it) to flag `.catch(.*console\.(warn|log|debug))` in `grid/src/db/` and `grid/src/audit/`. Force structured logging through Pino with `{ event: 'audit_persist_failed' }`.

3. **`firehose-hub.ts:55-58` silently swallows `socket.send` failures.**
   - Where: `ClientConnection.trySend` catches and discards. With no counter increment for "swallowed sends", a half-closed socket would appear as "frames sent" forever. The frame-counter recommendation above only counts AFTER successful send — if `send` throws, no increment, no log either.
   - Prevention gate: regression test that injects a `ClientConnection` with a `socket.send` throwing on every call, asserts `frames_sent_total === 0` AND `frames_dropped_total` increments OR a new `send_errors_total` counter increments.

4. **`payloadPrivacyCheck` is run AFTER `Object.keys(payload).sort()` check (append-human-joined.ts:88-106).**
   - The structural check throws on unexpected keys, which means privacy check is dead code for those cases. That's correct ordering — structural-first prevents bogus payloads ever reaching the privacy gate. BUT: if a future sole-producer file FORGETS the structural check (only does regex guards + privacy check), forbidden keys still get caught. If it forgets privacy check too, leak escapes.
   - Prevention gate: `scripts/check-sole-producer-discipline.mjs` greps every file matching `grid/src/audit/append-*.ts` and `grid/src/{ananke,bios,sleep,iris,skills,norms,lore,governance,whisper}/append*.ts` for ALL of: `Object.keys(payload).sort()`, `payloadPrivacyCheck`, `audit.append`. Fail if any sole-producer file omits any of the three.

5. **`AuditChain.append()` listener fan-out happens BEFORE the entry is mirrored to DB.**
   - `PersistentAuditChain.append()` calls `super.append()` first (which fires listeners synchronously) then schedules the DB write (chain.ts:51-58 fires listeners inline; persistent-chain.ts:30-38 schedules DB after). This is CORRECT — observers see consistent in-memory state. But it means firehose can deliver a frame BEFORE the entry is persisted; a consumer that reads MySQL after seeing the WS frame may not find it.
   - Prevention gate: documented invariant in `grid/src/audit/chain.ts` JSDoc — add comment block "I-26: observers see in-memory commit. Persistence is eventually-consistent within `audit_trail`. Consumers that require strong consistency must read from in-memory via `audit.query()`, never from MySQL directly."
   - Steward `/users` and `/humans/[did]/history` MUST use `GET /api/v1/audit/trail` (which reads in-memory) and NOT direct MySQL queries — which is already the case, so no code change. But add a CI grep gate at `scripts/check-no-direct-audit-trail-mysql.mjs` that flags any Steward source file referencing `audit_trail` as a SQL identifier.

6. **`portal.auth.login` will fire on EVERY login — high-volume relative to other allowlisted events.**
   - On a Grid with 1000 humans logging in once a day, that's 1000 new audit entries / day just from auth. Combined with `tick` (every 30s = 2880/day), the chain grows fast. `humans.ts:97-98` calls `audit.query({ eventType: 'portal.auth.login', actorDid: did })` which is O(n) across the whole chain.
   - Prevention gate: benchmark in `grid/src/__tests__/audit-query-perf.test.ts` — populate chain with 100k entries, assert `audit.query({ eventType: 'portal.auth.login', actorDid: ... })` returns in <50ms p95. If it doesn't, Phase 33 must add an index-by-event-type map inside `AuditChain` (separate from the array).

7. **Browser-side WebSocket reconnect storms when firehose silently fails.**
   - The Steward `/firehose` page (per UAT item #1) connects to `ws://localhost:8080/api/v1/audit/firehose`. If the WS opens but never delivers frames, the page's reconnect logic may treat the connection as healthy. When the page is left open for hours, the user sees a stale empty list.
   - Prevention: client-side watchdog in `steward/src/lib/use-firehose-ws.ts` (new file) that tracks `last_frame_at` AND if `Date.now() - last_frame_at > 60_000` AND server reports `client_count > 0` in `/health/detailed`, force a reconnect.

8. **Health-watchdog dies silently if its setInterval handle is garbage-collected.**
   - Node's `setInterval` keeps a reference alive, but if the watchdog is constructed inside a closure that gets re-assigned, the old interval can become orphaned.
   - Prevention: store the watchdog as a `readonly` field on `GenesisLauncher` (not in a closure), with an explicit `stop()` called in `launcher.stop()`. CI gate `scripts/check-interval-lifecycle.mjs` greps for `setInterval` calls in `grid/src/diagnostics/` and asserts each is stored in a field, not just `const`.

---

## Phase Decomposition Suggestion

### Phase 31 — Audit Pipeline Persistence (PRIORITY)

**Goal:** Fix GAP-A root cause. Production Grid must persist every audit entry to MySQL within seconds of in-memory commit.

**Deliverables:**
- `grid/src/genesis/launcher.ts` — accept injected `AuditChain` via `GenesisLauncherDeps` (new optional second arg)
- `grid/src/main.ts` — construct `PersistentAuditChain(auditStore, gridName)` when `dbConn` is present; pass to launcher
- `grid/src/db/persistent-chain.ts` — replace `console.warn` with Pino structured log; expose `lastPersistError`, `lastPersistAttemptAt` fields readable via getter
- `grid/src/db/audit-reconcile.ts` (new) — tick-cadenced (every 60 ticks) reconcile loop that compares `chain.length` to `SELECT MAX(id) FROM audit_trail`; replays missing entries via `INSERT IGNORE`
- `grid/src/__tests__/audit-persistence-wiring.test.ts` (new) — regression: launcher.audit is `PersistentAuditChain` when db config present
- `scripts/check-audit-chain-wiring.mjs` (new) — CI grep gate
- Manual UAT step: backfill the missing 2193 → 2430+ entries via a one-shot script `scripts/backfill-audit-trail.mjs` that reads in-memory chain via REST and writes via direct MySQL connection (one-time recovery)

**Dependencies:** none — must land first.

**Success criteria:** After Phase 31 ships and the Grid is restarted, `audit_trail` row count matches `chain.length` within 60 seconds. Watching the DB row count over 5 minutes shows continuous growth. Pino log stream shows zero `audit_persist_failed` events under normal operation.

---

### Phase 32 — Firehose Observability + Self-Test

**Goal:** Make "tick advances but zero frames" impossible to go unnoticed for >60 seconds.

**Deliverables:**
- `grid/src/audit/firehose-hub.ts` — add `metrics: { frames_sent_total, frames_dropped_total, last_frame_at }` fields; add `stats(): { ... }` method; increment counters in `trySend` (after success) and `enqueue` (on overflow eviction)
- `grid/src/util/ring-buffer.ts` — extend with `onEvict` callback OR `size`-before/after compare so eviction is observable
- `grid/src/api/routes/health-detailed.ts` (new) — `GET /health/detailed` endpoint surfacing audit + firehose + clock health blocks
- `grid/src/diagnostics/health-watchdog.ts` (new) — tracks `last_reconcile_at`, `last_persist_attempt_at`, degrades status when stale
- `grid/src/__tests__/firehose-frame-counters.test.ts` (new) — asserts counters increment correctly on send, drop, eviction
- `grid/src/__tests__/firehose-subscribes-before-clock.test.ts` (new) — regression for construction-order race
- `scripts/check-no-silent-catch.mjs` (new) — CI gate: no `.catch(err => console.warn(...))` in `grid/src/db/` or `grid/src/audit/`

**Dependencies:** Phase 31 (so `audit.in_memory_length` / `audit.persisted_max_id` are both populated)

**Success criteria:** `GET /health/detailed` returns shape documented above. Live firehose under load shows `frames_sent_total` incrementing by ~1 per tick. Inducing socket failure (test harness) increments dropped counter without panicking the hub.

---

### Phase 33 — Missing portal.auth.* Producers

**Goal:** Light up `/users` directory and `/humans/[did]/history siwe_sessions`.

**Deliverables:**
- `grid/src/audit/append-portal-auth-login.ts` (new) — sole producer, closed 3-key payload
- `grid/src/audit/append-portal-auth-register.ts` (new) — sole producer, closed 3-key payload
- `grid/src/audit/broadcast-allowlist.ts` — add `'portal.auth.login'` (pos 54), `'portal.auth.register'` (pos 55); add `PORTAL_AUTH_FORBIDDEN_KEYS` set; extend `FORBIDDEN_KEY_PATTERN` with word-boundary-anchored alternation for the new forbidden keys
- `grid/src/api/portal/auth.ts` — call sites at SIWE verify (lines 125/131), email signup (line 217), email signin (line 265)
- `grid/src/__tests__/portal-auth-events.test.ts` (new) — closed-tuple structural test, privacy-leak test (rejects payloads with ip/email/token/etc), wiring test (siwe path emits both register+login on first connect)
- `scripts/check-sole-producer-discipline.mjs` (new) — CI grep gate for all sole-producer files
- `PHILOSOPHY.md` — update allowlist count line from "53 events — frozen as of Phase 28" to "55 events — frozen as of Phase 33"
- `.planning/PROJECT.md` — update milestone summary

**Dependencies:** Phase 31 (events would otherwise be in-memory-only and never reach MySQL for the consumer queries that already exist in `humans.ts`)

**Success criteria:** UAT item #5c unblocked — `/users` directory shows registered humans, `/humans/[did]/history siwe_sessions` is non-empty after at least one login.

---

### Phase 34 — Steward `/system` Health Surfaces

**Goal:** Make pipeline health visible on the Steward Console so an operator looking at `/system` knows immediately if any of the three pipelines (in-memory chain, MySQL persistence, firehose fan-out) is degraded.

**Deliverables:**
- `steward/src/app/system/page.tsx` — add three new cards above existing Allowlist Monitor: Audit Pipeline Health, Firehose Diagnostics, Events per Minute by Family
- `steward/src/lib/use-health-detailed.ts` (new) — SWR hook polling `/health/detailed` every 5s with abort-on-unmount
- `steward/src/lib/use-firehose-ws.ts` (refactor) — add client-side `last_frame_at` watchdog; force reconnect if >60s since last frame AND server reports `client_count > 0`
- `steward/src/components/EventsPerMinuteSparkline.tsx` (new) — REST-driven (uses `/api/v1/audit/trail?limit=200`, NOT WS) so it survives firehose failure
- Manual UAT: open Steward, induce flusher failure via `docker stop noesis-mysql`; verify pipeline-health card turns red within 60s; restart MySQL, verify card turns green within 60s

**Dependencies:** Phase 32 (uses `/health/detailed` payload)

**Success criteria:** Operator viewing `/system` page sees: divergence number ≤ 10 (green) under normal operation; non-zero `frames_sent_total` delta every 5s poll under normal operation; events-per-minute sparkline shows continuous flow (zero bars indicate the page is broken, not the Grid).

---

### Phase 35 — UAT Re-Verification + Documentation Close-Out

**Goal:** Close GAP-A and GAP-B in the source-of-truth files. Re-run 25a-HUMAN-UAT items #1 and #5c.

**Deliverables:**
- `.planning/phases/31-audit-persistence/31-HUMAN-UAT.md` — verifies persistence within 60s under load
- `.planning/phases/32-firehose-observability/32-HUMAN-UAT.md` — verifies frame counter increments and `/health/detailed` shape
- `.planning/phases/33-portal-auth-producers/33-HUMAN-UAT.md` — re-runs 25a-HUMAN-UAT item #5c to PASS
- `.planning/phases/34-steward-system-health/34-HUMAN-UAT.md` — verifies pipeline-health card visibility, induced-failure recovery
- `.planning/MILESTONES.md` — log v2.6 close, allowlist 53 → 55
- `.planning/PROJECT.md` — move v2.6 REQs to Validated; update "Most-Recent Milestone" section
- `PHILOSOPHY.md` — append note to broadcast allowlist paragraph: "Phase 33 added `portal.auth.login` and `portal.auth.register` (positions 54, 55) with method-enum closed-tuple payloads. PII (IP, UA, email, session token) is permanently forbidden per `PORTAL_AUTH_FORBIDDEN_KEYS`."
- `README.md` — update "Current status" section from "v2.5 Human Portal SHIPPED" to "v2.6 Resilience & Observability SHIPPED"
- Documentation cross-reference audit per CLAUDE.md "Documentation Sync Rule"

**Dependencies:** Phases 31-34 all shipped

**Success criteria:** All v2.5 post-ship gaps closed. UAT items #1 and #5c return PASS. Documentation reflects v2.6 state.

---

## Sources

| Source | Confidence | Used for |
|--------|------------|----------|
| Direct read of `grid/src/genesis/launcher.ts:138` | HIGH | Root cause of GAP-A (plain AuditChain construction) |
| Direct read of `grid/src/db/persistent-chain.ts` | HIGH | Confirming PersistentAuditChain exists but unused in production |
| Direct read of `grid/src/main.ts:69-128` | HIGH | Confirming snapshotGrid is only persistence path (first-boot + shutdown) |
| Direct read of `grid/src/audit/firehose-hub.ts:130` | HIGH | Confirming firehose subscribes via `audit.onAppend` in constructor |
| Direct read of `grid/src/api/portal/auth.ts:125-131, 217, 265` | HIGH | Wiring points for new producers |
| Direct read of `grid/src/audit/broadcast-allowlist.ts:80-206` | HIGH | Current allowlist size (53), naming convention |
| Direct read of `grid/src/audit/append-human-joined.ts` | HIGH | Sole-producer pattern reference |
| 25a-HUMAN-UAT.md Gaps A & B | HIGH | Symptom evidence for GAP-A and GAP-B |
| Context7 `/pinojs/pino` (v10.1.0) | HIGH | Pino is current; benchmark 87.6; sovereign-stack-compatible |
| Context7 `/websites/sidorares_github_io_node-mysql2` | HIGH | mysql2 keepAlive + acquireTimeout config; benchmark 98 |
| Context7 `/fastify/fastify-websocket` | HIGH | Confirming current @fastify/websocket usage in firehose route is canonical |
| PHILOSOPHY.md §1 (sovereignty), §7 (53 events allowlist), §8 (zero custody) | HIGH | Privacy invariants for portal.auth.* payload design |
