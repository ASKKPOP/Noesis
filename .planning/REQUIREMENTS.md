# Requirements: Noēsis — v2.6 Resilience & Observability

**Defined:** 2026-05-24
**Core Value:** Trust in the audit pipeline and observability surfaces is the foundation for everything that follows. v2.5 opened the Grid to humans; v2.6 makes sure the operators and Steward surfaces always see what the Grid actually emits.
**Research source:** `.planning/research/v2.6/OBSERVABILITY-HARDENING.md` (committed `3e1fbe6`).

## v2.6 Active Requirements

### OBS — Audit Pipeline Persistence (Phase 31 — GAP-A root cause)

<!-- Production currently uses plain AuditChain; PersistentAuditChain exists but is never instantiated.
     Result: no entry has flushed to MySQL since 2026-05-22T06:57Z. Fix is structural, not a flusher tweak. -->

- [x] **OBS-01**: `PersistentAuditChain` is instantiated in the production boot path (`grid/src/main.ts`) when `dbConn` is present, and passed into `GenesisLauncher` via injected deps. Replaces the plain `AuditChain` construction at `grid/src/genesis/launcher.ts:138`. Listener fan-out semantics preserved (zero-diff invariant — `super.append()` first, then fire-and-forget DB write).
- [x] **OBS-02**: A tick-cadenced reconcile loop (every 60 ticks, ≈30s at default rate) compares `chain.length` to `SELECT MAX(id) FROM audit_trail WHERE grid_name = ?` and replays missing tail entries via `INSERT IGNORE` (idempotent). Lives at `grid/src/db/audit-reconcile.ts`, wired into `launcher.clock.onTick()`. Logs `{ event: 'audit_reconcile_ok', divergence: N }` on every cadence tick (not just failures) — silence is itself a signal.
- [x] **OBS-03**: All audit-persistence failure paths log via Pino structured logging with `{ event: 'audit_persist_failed', entry_id, event_type, error_message, error_code }`. Zero silent `.catch(err => console.warn(...))` patterns remain in `grid/src/db/` or `grid/src/audit/`. Enforced by `scripts/check-no-silent-catch.mjs` CI gate.
- [x] **OBS-04**: A one-shot backfill script (`scripts/backfill-audit-trail.mjs`) recovers in-memory entries that never reached MySQL during the 2026-05-22 → present stall. Reads in-memory chain via REST (`GET /api/v1/audit/trail`), writes to MySQL via direct mysql2 connection. Idempotent (uses `INSERT IGNORE`). Documented manual UAT step in `31-HUMAN-UAT.md`.

### OBS — Firehose Observability (Phase 32 — frame visibility)

<!-- "Tick advances but zero frames delivered" must never go unnoticed for >60s.
     Current hub swallows all socket errors with no counter, no log. -->

- [ ] **OBS-05**: `WsFirehoseHub` exposes a `stats()` method returning `{ frames_sent_total, frames_dropped_total, last_frame_at, client_count, watermark_bytes }`. `frames_sent_total` increments in `ClientConnection.trySend()` AFTER successful `socket.send` (NOT before — backpressure-evicted entries do not count as "sent"). `frames_dropped_total` increments in `ClientConnection.enqueue()` on ring-buffer overflow eviction. `last_frame_at` updates to `Date.now()` on every successful send.
- [ ] **OBS-06**: `GET /health/detailed` endpoint returns `{ status: 'ok'|'degraded'|'critical', timestamp, audit: { in_memory_length, persisted_max_id, divergence, divergence_threshold, last_persist_attempt_at, last_persist_error }, firehose: { client_count, frames_sent_total, frames_dropped_total, last_frame_at, watermark_bytes }, clock: { tick, running, last_tick_at } }`. `status: 'degraded'` when divergence >10 OR last_frame_at null with clients>0 OR last_frame_at >60s stale with clients>0. `status: 'critical'` when divergence >100 OR last_persist_error set with divergence >0. Endpoint MUST NOT block on DB — uses cached `persisted_max_id` populated by the reconcile loop.
- [ ] **OBS-07**: A `HealthWatchdog` at `grid/src/diagnostics/health-watchdog.ts` tracks `last_reconcile_at` and `last_persist_attempt_at`. If `Date.now() - last_reconcile_at > 5 × snapshotCadenceMs`, surfaces `status: 'degraded'` with the stale timestamp in the `/health/detailed` response. Watchdog is a `readonly` field on `GenesisLauncher` (not in a closure) with explicit `stop()` in `launcher.stop()`.

### OBS — Missing portal.auth.* Producers (Phase 33 — GAP-B fix)

<!-- /users + /humans/[did]/history read portal.auth.login/register events but NO producer emits them.
     Closed 3-key payloads, hash-only privacy — IP / UA / email / token never on the wire. -->

- [ ] **OBS-08**: `appendPortalAuthLogin(audit, { human_did, method, tick })` sole-producer file lands at `grid/src/audit/append-portal-auth-login.ts`. Closed 3-key payload, `method ∈ {'siwe', 'email'}` (closed enum), DID_RE on `human_did`, integer guard on `tick`, structural `Object.keys(payload).sort()` strict-equality check, `payloadPrivacyCheck` runs before `audit.append('portal.auth.login', ...)`. Emits at allowlist position 54. Wired into SIWE verify success path (line ~131 in `grid/src/api/portal/auth.ts`) AND email signin success (line ~265). Mirror discipline of `append-human-joined.ts`.
- [ ] **OBS-09**: `appendPortalAuthRegister(audit, { human_did, method, tick })` sole-producer file lands at `grid/src/audit/append-portal-auth-register.ts`. Same discipline as OBS-08. Emits at allowlist position 55. Wired into SIWE verify FIRST-CONNECT path (after `appendHumanJoined`, only when `isNew === true`) AND email signup success (line ~217).
- [ ] **OBS-10**: `PORTAL_AUTH_FORBIDDEN_KEYS` set blocks: `ip_address`, `ip`, `user_agent`, `ua`, `session_id`, `token`, `jwt`, `cookie`, `email` (plaintext, vs `email_hash` allowed), `password_hash`, `nonce`, `signature`, `device_fingerprint`. `FORBIDDEN_KEY_PATTERN` extended with word-boundary-anchored alternation `\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b`. Test cases for `email_hash` (allowed) vs `email` (forbidden) AND `nonce_hash` (allowed) vs `nonce` (forbidden).

### OBS — Steward Console Health Surfaces (Phase 34 — visibility)

<!-- Operator looking at /system must immediately know if any of the three pipelines
     (in-memory chain, MySQL persistence, firehose fan-out) is degraded. -->

- [ ] **OBS-11**: Steward `/system` page renders an **Audit Pipeline Health** card above the existing Allowlist Monitor. Polls `/health/detailed` every 5s. Renders the `audit` block: big-number `divergence` with green (0) / amber (1-10) / red (>10) banding; sub-line `In-memory: N · Persisted: M · Last persist error: <code> at <time>`. Hook: `steward/src/lib/use-health-detailed.ts` (new SWR-style polling hook with abort-on-unmount).
- [ ] **OBS-12**: Steward `/system` page renders a **Firehose Diagnostics** card. Polls `/health/detailed` every 5s. Renders: connected-clients gauge, frames-sent (1m delta + 12-point sparkline), frames-dropped (1m delta), time-since-last-frame (red state when >60s AND clients>0). Uses the same `use-health-detailed` hook as OBS-11.
- [ ] **OBS-13**: Steward `/system` page renders an **Events per Minute by Family** sparkline driven by REST (`GET /api/v1/audit/trail?limit=200`, NOT WebSocket). Buckets events by `eventType` prefix (`nous.*`, `operator.*`, `human.*`, `portal.*`, etc.); renders a horizontal stacked bar of the last 5 minutes. REST-driven so it stays alive when the firehose is broken (exactly when you want to look at it).
- [ ] **OBS-14**: Steward firehose page (`/firehose`) has a client-side watchdog (`steward/src/lib/use-firehose-ws.ts`) tracking `last_frame_at`. If `Date.now() - last_frame_at > 60_000` AND server reports `client_count > 0` in `/health/detailed`, forces a WS reconnect. Prevents the "WS opens, never delivers, browser thinks it's healthy forever" failure mode.

### OBS — UAT Re-Verification + Documentation Sync (Phase 35 — close-out)

<!-- Loop closure: the gaps that motivated v2.6 must measurably close. -->

- [ ] **OBS-15**: `25a-HUMAN-UAT.md` items #1 (firehose color rendering, live) and #5c (`/users` → `/humans/[did]` deep-link click) re-verified to PASS with live data. `.planning/MILESTONES.md` logs v2.6 close with allowlist count 53 → 55. `.planning/PROJECT.md` moves OBS-01..14 to Validated; updates Most-Recent Milestone section. `PHILOSOPHY.md` updates broadcast-allowlist paragraph (53 → 55, mentions `PORTAL_AUTH_FORBIDDEN_KEYS`). `README.md` Project Status appends v2.6 SHIPPED line. CLAUDE.md Documentation Sync Rule audit pass.

## Future Requirements (deferred to v2.7+)

- **OBS-FUTURE-METRICS-01**: `ua_hash` and `ip_country` payload extensions for portal.auth.* if analytics need surfaces. Deferred — YAGNI for v2.6.
- **OBS-FUTURE-OTEL-01**: OpenTelemetry self-hosted via `@fastify/otel` + OTLP collector. Deferred — only if operators ask. Sovereignty review required.
- **OBS-FUTURE-INDEX-01**: In-memory index-by-event-type map inside `AuditChain` if `audit.query({ eventType })` p95 exceeds 50ms at 100k+ entries. Conditional on the perf benchmark added in Phase 33.
- **OBS-FUTURE-DIAG-01**: `GET /api/v1/health/diagnostics/self-test` endpoint that runs an end-to-end synthetic event through chain → DB → firehose to detect silent breakage. Deferred — the OBS-06 `/health/detailed` + OBS-14 client-watchdog combination is the v2.6 minimum.

## Out of Scope (v2.6)

| Item | Reason |
|------|--------|
| Adopt Prometheus / `prom-client` | Adds new HTTP scrape endpoint; pulls Prometheus deployment model into the stack. Sovereignty-incompatible. Pino + `/health/detailed` JSON polling does the same job in-process. |
| Adopt Datadog / Honeycomb / New Relic SaaS | Vendor lock-in violates PHILOSOPHY §1 sovereignty. |
| Replace logger with winston / bunyan | Pino is already a Fastify transitive dep. No reason to introduce a second logger. |
| Add `pino-mysql` transport | Logging into the same MySQL connection that audit_trail uses is a single-point-of-failure. Log to stdout, let Docker handle it. |
| New Docker service for observability | Self-hosted users on a single VPS gain nothing. In-process metrics + REST polling is sufficient. |
| Migrate `audit_trail` to a time-series DB | YAGNI for current chain size (~2500 entries). v2.7+ if benchmark warrants. |
| Operator-facing Thymos / mood metrics | Out of scope per the v2.6 theme — Thymos remains deferred until at least v2.7. |
| Multi-Grid health aggregation | Single-Grid for v2.6. Federation deferred. |

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| OBS-01 | 31 | Complete |
| OBS-02 | 31 | Complete |
| OBS-03 | 31 | Complete |
| OBS-04 | 31 | Complete |
| OBS-05 | 32 | Pending |
| OBS-06 | 32 | Pending |
| OBS-07 | 32 | Pending |
| OBS-08 | 33 | Pending |
| OBS-09 | 33 | Pending |
| OBS-10 | 33 | Pending |
| OBS-11 | 34 | Pending |
| OBS-12 | 34 | Pending |
| OBS-13 | 34 | Pending |
| OBS-14 | 34 | Pending |
| OBS-15 | 35 | Pending |

**Coverage:** 15/15 v2.6 REQs mapped to phases. Zero orphans. Zero duplicates.
