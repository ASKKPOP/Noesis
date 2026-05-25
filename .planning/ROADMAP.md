# Roadmap: Noēsis — v2.6 Resilience & Observability

## Overview

v2.5 opened the Grid to real human users (181/181 plans, allowlist 53). Post-ship UAT surfaced two operational gaps: the production `audit_trail` MySQL flush stalled silently on 2026-05-22T06:57Z, and the `/users` directory has been permanently empty because `portal.auth.login` / `portal.auth.register` are read by consumers but emitted by no producer.

v2.6 closes both gaps and hardens the audit/observability pipeline end-to-end so operators and Steward Console surfaces always see what the Grid actually emits. Allowlist grows **53 → 56** (+3 events in Phase 33). All other v2.6 work adds observability fields and structured logging — zero new event types.

Phase numbering continues from v2.5 — do NOT reset without `--reset-phase-numbers`.

## Milestones

- ✅ **v1.0 Genesis** (shipped 2026-04-17) — Phases 1-10, 944+ TS tests, 226 Py tests
- ✅ **v2.0 First Life Sprints 11-14** (shipped 2026-04-18) — E2E, persistence, Docker, Dashboard v1
- ✅ **v2.1 Steward Console — Phases 5-8** (shipped 2026-04-21, 18/18 plans)
- ✅ **v2.2 Living Grid — Phases 9-14** (shipped 2026-04-28, 44/44 plans)
- ✅ **v2.3 Living Minds — Phases 15-17** (shipped 2026-05-15, 16/16 plans)
- ✅ **v2.4 Agora — Phases 18-21** (shipped 2026-05-20, 115/115 plans)
- ✅ **v2.5 Human Portal — Phases 22-30** (shipped 2026-05-24, 181/181 plans, allowlist 53)
- 🔄 **v2.6 Resilience & Observability — Phases 31-35** (opened 2026-05-24)

## Phases (v2.6 — Active)

- [x] **Phase 31: Audit Pipeline Persistence** — Fix GAP-A root cause. Wire `PersistentAuditChain` into production boot, add tick-cadenced reconcile loop, Pino structured logging on every persist attempt, one-shot backfill script for the 2026-05-22 → present stall. (allowlist unchanged 53) (completed 2026-05-24)
- [x] **Phase 32: Firehose Observability** — Frame counters + `/health/detailed` endpoint + health watchdog. Make "tick advances but zero frames delivered" impossible to go unnoticed for >60s. (allowlist unchanged 53) (completed 2026-05-25)
- [x] **Phase 33: portal.auth.* Producers** — Wire `appendPortalAuthLogin` + `appendPortalAuthRegister` + `appendHumanIdentified` sole-producers into SIWE verify + email signup/signin. Add `PORTAL_AUTH_FORBIDDEN_KEYS`. Allowlist 53 → 56 (+3). (completed 2026-05-25)
- [ ] **Phase 34: Steward `/system` Health Surfaces** — Audit Pipeline Health card + Firehose Diagnostics card + Events per Minute by Family sparkline + client-side firehose watchdog. (allowlist unchanged 56)
- [ ] **Phase 35: UAT Re-Verification + Documentation Close-Out** — Re-run 25a-HUMAN-UAT items #1 and #5c to PASS with live data. Atomic sync of MILESTONES, PROJECT, PHILOSOPHY, README, CLAUDE.md.

## Phase Details (v2.6)

### Phase 31: Audit Pipeline Persistence
**Goal**: Production Grid persists every audit entry to MySQL within seconds of in-memory commit. GAP-A root cause (no live MySQL flush path — production constructs plain `AuditChain` instead of `PersistentAuditChain`) is structurally fixed; silent failure modes are replaced with structured logging.
**Depends on**: Nothing — must land first. Phases 32-34 all depend on the chain actually persisting.
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04
**Success Criteria** (what must be TRUE):
  1. After Phase 31 ships and the Grid is restarted, `SELECT COUNT(*) FROM audit_trail WHERE grid_name = 'genesis'` matches `chain.length` within 60 seconds of any new `audit.append` call, and continues to track within ±10 entries during continuous operation. Watching the row count over 5 minutes shows monotonic growth in lockstep with in-memory chain growth.
  2. Operator running `docker compose logs grid | grep audit_reconcile_ok` after 5 minutes of uptime sees at least 10 heartbeat lines (one per 60-tick cadence) with `divergence: 0` — silence in this log stream is itself a signal of pipeline stall.
  3. Inducing a MySQL outage (`docker stop noesis-mysql`) produces structured Pino log entries `{event: 'audit_persist_failed', entry_id, event_type, error_message, error_code}` — never silent `.catch(err => console.warn(...))`. CI gate `scripts/check-no-silent-catch.mjs` fails any PR reintroducing the pattern in `grid/src/db/` or `grid/src/audit/`.
  4. Running `node scripts/backfill-audit-trail.mjs --since 2026-05-22T06:57Z` recovers all in-memory entries that never reached MySQL during the stall window; the script is idempotent (`INSERT IGNORE`), and a second invocation reports zero rows inserted.
**Scope (ships)**: OBS-01..04.
**Out of scope for this phase**: Firehose frame counters (Phase 32), `/health/detailed` endpoint (Phase 32), missing portal.auth.* producers (Phase 33), Steward UI surfaces (Phase 34), Prometheus adoption (deferred — sovereignty-incompatible).
**Risk**:
  - **R-31-01 (CRITICAL)**: New listener fan-out order changes break the zero-diff audit chain invariant — `PersistentAuditChain.append()` MUST call `super.append()` first (in-memory commit + listener fan-out) THEN fire-and-forget DB write. Regression test pins chain head hash with/without DB attached.
  - **R-31-02 (HIGH)**: Reconcile loop fires faster than DB can keep up at high tick rates — cadence is tick-based (every 60 ticks ≈ 30s), not wall-clock based; loop is idempotent (`INSERT IGNORE`); divergence threshold is alert ceiling not retry trigger.
  - **R-31-03 (MEDIUM)**: Production restart loses in-memory chain before reconcile catches up — Phase 31 ships with a one-shot backfill script for the 2026-05-22 stall; production restart procedure documented in `31-HUMAN-UAT.md`.
**Allowlist additions**: **0**. Running total: **53**.
**Plans**: 6 plans
  - [x] 31-01-PLAN.md — Pino logger singleton + grid/package.json deps (OBS-03 foundation)
  - [x] 31-02-PLAN.md — Backfill script scripts/backfill-audit-trail.mjs (OBS-04)
  - [x] 31-03-PLAN.md — PersistentAuditChain wiring in main.ts + Pino logger replaces console.warn + zero-diff regression test (OBS-01, OBS-03)
  - [x] 31-04-PLAN.md — AuditReconcile loop + launcher.clock.onTick wire + batch-cap test (OBS-02)
  - [x] 31-05-PLAN.md — scripts/check-no-silent-catch.mjs CI gate + workflow integration (OBS-03 enforcement)
  - [x] 31-06-PLAN.md — 31-HUMAN-UAT.md cutover playbook + STATE.md close-out tick (OBS-01..04 manual verification)

### Phase 32: Firehose Observability
**Goal**: Make "tick advances but zero frames delivered" impossible to go unnoticed for >60 seconds. Add frame counters to `WsFirehoseHub`, expose pipeline health via `/health/detailed`, ship a tick-cadenced health watchdog.
**Depends on**: Phase 31 (so `audit.in_memory_length` and `audit.persisted_max_id` are both populated and meaningful)
**Requirements**: OBS-05, OBS-06, OBS-07
**Success Criteria** (what must be TRUE):
  1. Operator hitting `GET /health/detailed` after 60s of uptime receives `{status: 'ok', audit: {in_memory_length: N, persisted_max_id: N, divergence: 0, ...}, firehose: {client_count: K, frames_sent_total: M, frames_dropped_total: 0, last_frame_at: <recent>}, clock: {tick: T, running: true}}` — every field populated, no nulls except when DB is unconfigured.
  2. Under normal load with at least one connected client, `frames_sent_total` increments at least once per tick (visible across two polls of `/health/detailed` 5s apart). `last_frame_at` is never null while `client_count > 0`.
  3. Inducing a half-closed socket (test harness) increments `frames_dropped_total` and does NOT increment `frames_sent_total` — backpressure-evicted entries do not count as "sent". The hub does not panic, and other clients continue receiving frames.
  4. If the reconcile loop from Phase 31 stops firing (e.g., a future regression breaks it), `/health/detailed` returns `status: 'degraded'` with `last_reconcile_at` exposed as a stale ms-epoch within 5 × snapshot cadence — the watchdog surfaces the silence directly, not via inference.
  5. `GET /health/detailed` never blocks on a slow DB query — cached `persisted_max_id` is populated by the reconcile loop; cache miss returns `null` not a 30s timeout. p95 endpoint latency <50ms regardless of DB state.
**Scope (ships)**: OBS-05..07.
**Out of scope for this phase**: portal.auth.* producers (Phase 33), Steward UI cards (Phase 34), Prometheus scrape endpoint (deferred), OpenTelemetry (deferred).
**Risk**:
  - **R-32-01 (HIGH)**: `/health/detailed` becomes the next silent failure — watchdog logs every iteration at INFO level (not just errors); CI gate `scripts/check-observability-no-todo.mjs` flags TODO/FIXME/XXX comments within 50 chars of `health|metric|frame|drift|reconcile` keywords in `grid/src/`.
  - **R-32-02 (MEDIUM)**: Watchdog `setInterval` handle garbage-collected silently — watchdog stored as `readonly` field on `GenesisLauncher` with explicit `stop()` in `launcher.stop()`; CI gate `scripts/check-interval-lifecycle.mjs` asserts every `setInterval` in `grid/src/diagnostics/` is held in a field.
  - **R-32-03 (MEDIUM)**: Frame counter increment placement leaks state across timing boundaries — `frames_sent_total++` happens AFTER `socket.send` succeeds (NOT before); regression test asserts a `socket.send`-throwing client never increments `frames_sent_total`.
**Allowlist additions**: **0**. Running total: **53**.
**Plans**: 6 plans
  - [x] 32-01-PLAN.md — Frame counters on WsFirehoseHub + stats() method + HubMetricsSink (OBS-05)
  - [x] 32-02-PLAN.md — R-32-03 regression test (firehose-send-throws.test.ts) pinning counter placement (OBS-05)
  - [x] 32-03-PLAN.md — HealthWatchdog class + HEALTH_THRESHOLDS + computeStatus + transition logging (OBS-07)
  - [x] 32-04-PLAN.md — GenesisLauncher attach methods + buildServerWithHub wiring + /health/detailed route + integration test (OBS-06, OBS-07)
  - [x] 32-05-PLAN.md — Two CI gates (R-32-01 observability-no-TODO + R-32-02 setInterval-lifecycle) wired into rig-invariants.yml (OBS-05/06/07)
  - [x] 32-06-PLAN.md — 32-HUMAN-UAT.md operator playbook + uat-half-close-socket.mjs harness (OBS-05/06/07)
**UI hint**: yes

### Phase 33: portal.auth.* Producers
**Goal**: Light up `/users` directory and `/humans/[did]/history siwe_sessions` by emitting `portal.auth.login` / `portal.auth.register` from sole-producer files wired into SIWE verify + email signup/signin success paths. PII (IP, UA, email, session token) stays permanently off the wire. Adds `human.identified` universal identity-stamp event (D-33-A1) so /users + Phase 34 surfaces can correlate SIWE-born humans (via shared identity_hash with Phase 22 `human.joined`) and email-born humans (via sha256(email)) under a single event type going forward.
**Depends on**: Phase 31 (events would otherwise be in-memory-only and never reach MySQL for the consumer queries that already exist in `humans.ts:97-98`)
**Requirements**: OBS-08, OBS-08b, OBS-09, OBS-10
**Success Criteria** (what must be TRUE):
  1. After at least one human logs in via SIWE, `GET /api/v1/audit/trail?type=portal.auth.login&limit=10` returns at least one entry within 30 seconds, with closed 3-key payload `{human_did, method: 'siwe', tick}`. Same for email path: `method: 'email'` after an email signin.
  2. First-time SIWE connect produces BOTH `portal.auth.register` AND `portal.auth.login` audit entries (register fires first, login fires immediately after). Subsequent SIWE logins for the same DID produce only `portal.auth.login`. Email signup produces both; email signin produces only login. UAT item #5c from `25a-HUMAN-UAT.md` (`/users → /humans/[did]` deep-link click) returns PASS — directory is non-empty. First-time SIWE connect ALSO emits `human.identified` (universal identity-stamp event, D-33-A1) immediately after `human.joined`, so /users can resolve both SIWE-born (via shared identity_hash with eth_address_hash) and email-born humans (sha256(email)) under one universal event. Email signup emits `human.identified` ONLY (NO `human.joined` — Phase 22's SIWE-only contract preserved per D-33-A7).
  3. Any attempt to emit a `portal.auth.login` or `portal.auth.register` payload containing `ip`, `ip_address`, `user_agent`, `ua`, `session_id`, `token`, `jwt`, `cookie`, `email` (plaintext), `password_hash`, `nonce`, `signature`, or `device_fingerprint` is rejected at the producer boundary before `audit.append` is called. Test cases verify `email_hash` (allowed) vs `email` (forbidden), and `nonce_hash` (allowed) vs `nonce` (forbidden) — word-boundary regex anchors prevent false positives.
  4. `grid/src/audit/broadcast-allowlist.ts` ends at exactly 56 members: `'portal.auth.login'` at position 54, `'portal.auth.register'` at position 55, `'human.identified'` at position 56. CI gate `scripts/check-state-doc-sync.mjs` asserts the literal count.
  5. Only `grid/src/audit/append-portal-auth-login.ts` may call `audit.append('portal.auth.login', ...)`, only `grid/src/audit/append-portal-auth-register.ts` may call `audit.append('portal.auth.register', ...)`, and only `grid/src/audit/append-human-identified.ts` may call `audit.append('human.identified', ...)` — `scripts/check-sole-producer-discipline.mjs` greps every `append-*.ts` (and the equivalent sole-producer files across the audit-emitting subsystems) for the `Object.keys(payload).sort()` + `payloadPrivacyCheck` + `audit.append` triad and fails if any sole-producer file omits any of the three.
**Scope (ships)**: OBS-08, OBS-08b, OBS-09, OBS-10.
**Out of scope for this phase**: `ua_hash` / `ip_country` payload extensions (OBS-FUTURE-METRICS-01 deferred to v2.7+); analytics dashboards (separate work).
**Risk**:
  - **R-33-01 (CRITICAL)**: PII leaks into payload via future widening — `PORTAL_AUTH_FORBIDDEN_KEYS` set + `FORBIDDEN_KEY_PATTERN` word-boundary alternation; 12+ regression tests for forbidden keys flat and nested.
  - **R-33-02 (HIGH)**: `portal.auth.login` event volume grows audit chain fast at scale (1000 humans × 1 login/day = 1000 entries/day from auth alone) — Phase 33 ships with a perf benchmark in `grid/src/__tests__/audit-query-perf.test.ts` populating 100k entries and asserting `audit.query({eventType: 'portal.auth.login', actorDid: ...})` p95 <50ms. If exceeded, OBS-FUTURE-INDEX-01 triggers as v2.7 work.
  - **R-33-03 (MEDIUM)**: SIWE first-connect emits register but not login (or vice versa) — wiring test asserts both events fire on first-connect; only login fires on subsequent connects.
**Allowlist additions**: **+3**. Events: `portal.auth.login` (pos 54) `{human_did, method, tick}` where `method ∈ {siwe, email}`; `portal.auth.register` (pos 55) `{human_did, method, tick}`; `human.identified` (pos 56) `{grid_name, human_did, identity_hash, identity_method, tick}` where `identity_method ∈ {siwe, email}`. Running total: **56**.
**Plans**: 6 plans (Plan 33-01 doc-sync revises allowlist budget to +3 / 53→56 per D-33-F1)
  - [x] 33-01-PLAN.md — Doc-sync (REQUIREMENTS + ROADMAP + STATE for allowlist 53→56 + OBS-08b; D-33-F1)
  - [x] 33-02-PLAN.md — Allowlist additions (+3 entries 54/55/56) + PORTAL_AUTH_FORBIDDEN_KEYS export + FORBIDDEN_KEY_PATTERN word-boundary extension (D-33-A1, D-33-B3, D-33-B4)
  - [x] 33-03-PLAN.md — 3 sole-producer files: append-portal-auth-login.ts, append-portal-auth-register.ts, append-human-identified.ts (D-33-A3, D-33-B1, D-33-B2)
  - [x] 33-04-PLAN.md — Wiring 4 call sites in grid/src/api/portal/auth.ts (SIWE first-connect + SIWE unconditional + email signup + email signin; D-33-A4, D-33-A5, D-33-A6)
  - [x] 33-05-PLAN.md — 6 test files: producer discipline (3) + forbidden-keys regression (12+ cases, R-33-01) + wiring emit-count/order + soft-log perf benchmark (D-33-C1)
  - [x] 33-06-PLAN.md — 2 CI gates: scripts/check-sole-producer-discipline.mjs (NEW, D-33-D1) + scripts/check-state-doc-sync.mjs extension (D-33-D3) + rig-invariants.yml step

### Phase 34: Steward `/system` Health Surfaces
**Goal**: Operator viewing `/system` sees immediately if any of the three pipelines (in-memory chain, MySQL persistence, firehose fan-out) is degraded. Three cards above the existing Allowlist Monitor, plus a client-side firehose watchdog that recovers from "WS opens but never delivers" silently.
**Depends on**: Phase 32 (consumes `/health/detailed` payload)
**Requirements**: OBS-11, OBS-12, OBS-13, OBS-14
**Success Criteria** (what must be TRUE):
  1. Operator opening Steward `/system` after Phase 34 ships sees an **Audit Pipeline Health** card above the Allowlist Monitor showing `In-memory: N · Persisted: N` with divergence rendered as a big-number colored green (0), amber (1-10), or red (>10). The card polls `/health/detailed` every 5s and updates without page reload.
  2. The **Firehose Diagnostics** card on `/system` shows connected-clients gauge, frames-sent 1m delta, frames-dropped 1m delta, time-since-last-frame. Under normal load, frames-sent delta increments visibly every 5s; time-since-last-frame stays under 10s. Inducing a firehose stall (test scenario) flips time-since-last-frame to red within 60s.
  3. The **Events per Minute by Family** sparkline renders a horizontal stacked bar of the last 5 minutes bucketed by event-type prefix (`nous.*`, `operator.*`, `human.*`, `portal.*`). It survives firehose failure because it reads `GET /api/v1/audit/trail?limit=200` over REST, not WebSocket — when the firehose is broken (exactly when you want to look at it), this card still updates.
  4. With the Steward `/firehose` page open and the firehose silently stalled (WS connected, no frames for 60s) AND `client_count > 0` in `/health/detailed`, the page forces a WebSocket reconnect automatically. Operator does NOT see a stale empty list indefinitely; reconnect attempt is visible in the UI status pill.
  5. Manual UAT: with Steward open at `/system`, stopping MySQL (`docker stop noesis-mysql`) turns the Audit Pipeline Health card amber/red within 60s; restarting MySQL turns it green within 60s. No browser refresh required.
**Scope (ships)**: OBS-11..14.
**Out of scope for this phase**: New audit events (allowlist unchanged); operator-facing Thymos / mood metrics (deferred); multi-Grid health aggregation (deferred).
**Risk**:
  - **R-34-01 (HIGH)**: Polling `/health/detailed` every 5s from multiple Steward tabs overwhelms the Grid — endpoint is in-process and cached (no DB block); single SWR-style hook with abort-on-unmount; per-tab polling is acceptable at MVP, multi-tab dedup deferred.
  - **R-34-02 (MEDIUM)**: Events-per-Minute sparkline trusts WS data and goes blank during firehose failure — fixed at design time: card uses REST not WS. Regression test asserts the card renders non-empty when WS is disabled.
  - **R-34-03 (MEDIUM)**: Client-side watchdog reconnect storm if server stays unhealthy — exponential backoff between reconnect attempts; max 1 reconnect per 30s; gives up after 5 attempts and surfaces error to operator.
**Allowlist additions**: **0**. Running total: **56**.
**Plans**: TBD
**UI hint**: yes

### Phase 35: UAT Re-Verification + Documentation Close-Out
**Goal**: Close GAP-A and GAP-B in the source-of-truth files. Re-run `25a-HUMAN-UAT.md` items #1 (firehose live color rendering) and #5c (`/users → /humans/[did]` deep-link click) to PASS with live data. Atomic documentation sync across MILESTONES, PROJECT, PHILOSOPHY, README, CLAUDE.md per the Documentation Sync Rule.
**Depends on**: Phases 31, 32, 33, 34 all shipped
**Requirements**: OBS-15
**Success Criteria** (what must be TRUE):
  1. UAT item #1 (`25a-HUMAN-UAT.md`): with at least one Nous running and the firehose page open, color-coded event rows render live (not just the `hello` frame) for at least 22 seconds of observation. Each event row shows the family color from `EVENT_FAMILY_COLORS`. Re-attempt passes without an asterisk.
  2. UAT item #5c (`25a-HUMAN-UAT.md`): the `/users` directory shows at least one registered human; clicking the row navigates to `/humans/[did]`; the History tab shows non-empty `siwe_sessions`. The original UAT block is updated from "passed-with-gap" to "passed".
  3. `.planning/MILESTONES.md` has a "v2.6 Resilience & Observability — SHIPPED" entry with date, allowlist count 53 → 56, and one-line summaries for each of Phases 31-35. `.planning/PROJECT.md` "Most-Recent Milestone" section reflects v2.6 ship; OBS-01..15 moved to Validated; OBS-15 marked complete.
  4. `PHILOSOPHY.md` broadcast-allowlist paragraph updated from "53 events" to "56 events, frozen as of Phase 33" with a sentence noting `PORTAL_AUTH_FORBIDDEN_KEYS` discipline and `human.identified` universal identity-stamp event. `README.md` Project Status section appends a v2.6 SHIPPED line. CLAUDE.md Documentation Sync Rule audit pass with cross-references verified.
  5. `grep -r "v2.5 Human Portal SHIPPED" .planning/ README.md PHILOSOPHY.md` returns only historical entries (under "Previous Milestone" sections); no current-status claim references v2.5 as the active milestone.
**Scope (ships)**: OBS-15.
**Out of scope for this phase**: New code (Phase 35 is documentation + UAT re-verification only); v2.7 milestone planning.
**Risk**:
  - **R-35-01 (HIGH)**: Documentation drifts again because sync is forgotten on one of the 6+ files — `scripts/check-state-doc-sync.mjs` extended to cover any new invariants; commit must touch MILESTONES + PROJECT + PHILOSOPHY + README + CLAUDE.md atomically (single commit per the Documentation Sync Rule).
  - **R-35-02 (MEDIUM)**: UAT items pass in dev but fail in prod due to env-specific issue — manual UAT step explicitly runs against the production docker compose stack, not a test harness.
**Allowlist additions**: **0**. Running total: **56**.
**Plans**: TBD

## Progress (v2.6)

**Execution Order:** 31 → 32 → 33 → 34 → 35

Dependencies form a strict chain. Rationale:
- 31 first: no point lighting up new producers (33) or observability surfaces (32, 34) if the chain itself doesn't persist. Phase 31 ships the foundation.
- 32 before 33: Phase 33 producers need to be observable; firehose frame counters and `/health/detailed` from Phase 32 are how anyone verifies that `portal.auth.*` events actually flow.
- 32 before 34: Phase 34 Steward cards consume `/health/detailed` (shipped in Phase 32).
- 33 before 34: Phase 34 event-family sparkline includes `portal.*` rows — the new event types shipped in Phase 33 are part of what Phase 34 visualizes.
- 35 last: documentation close-out asserts everything works end-to-end.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 31. Audit Pipeline Persistence | 6/6 | Complete    | 2026-05-24 |
| 32. Firehose Observability | 6/6 | Complete    | 2026-05-25 |
| 33. portal.auth.* Producers | 6/6 | Complete   | 2026-05-25 |
| 34. Steward `/system` Health Surfaces | 0/? | Pending | — |
| 35. UAT Re-Verification + Documentation Close-Out | 0/? | Pending | — |

## Coverage & Traceability (v2.6)

### REQ → Phase Mapping (all 16 OBS-* REQs)

| Theme | REQ IDs | Phase | Count |
|-------|---------|-------|-------|
| Audit Pipeline Persistence | OBS-01, OBS-02, OBS-03, OBS-04 | Phase 31 | 4 |
| Firehose Observability | OBS-05, OBS-06, OBS-07 | Phase 32 | 3 |
| portal.auth.* Producers | OBS-08, OBS-08b, OBS-09, OBS-10 | Phase 33 | 4 |
| Steward `/system` Health Surfaces | OBS-11, OBS-12, OBS-13, OBS-14 | Phase 34 | 4 |
| UAT Re-Verification + Doc Sync | OBS-15 | Phase 35 | 1 |
| **Total** | | | **16** |

Coverage: **16/16 REQs mapped** ✓. Zero orphans. Zero duplicates. (OBS-08b added Phase 33 D-33-F1.)

### Allowlist Growth Ledger (v2.6)

Starting: **53 events** (v2.5 frozen end-state).

| Phase | Event Added | Payload Shape | Running Total |
|-------|-------------|---------------|---------------|
| 31 | *(none — wiring + reconcile + logging only)* | — | 53 |
| 32 | *(none — `/health/detailed` is a route, not an audit event)* | — | 53 |
| 33 | `portal.auth.login` (pos 54) | `{human_did, method, tick}` where `method ∈ {siwe, email}` | 54 |
| 33 | `portal.auth.register` (pos 55) | `{human_did, method, tick}` | 55 |
| 33 | `human.identified` (pos 56) | `{grid_name, human_did, identity_hash, identity_method, tick}` where `identity_method ∈ {siwe, email}` | 56 |
| 34 | *(none — UI cards consume existing data via REST)* | — | 56 |
| 35 | *(none — documentation + UAT only)* | — | 56 |

**Total v2.6 allowlist growth: +3 (53 → 56).** Freeze-except-by-explicit-addition rule preserved. `portal.auth.login` and `portal.auth.register` carry closed 3-key tuples; `human.identified` carries a closed 5-key tuple with `identity_hash` (SHA-256 of lowercased ETH address for SIWE — byte-identical to Phase 22 `eth_address_hash` for correlation — or SHA-256 of normalized email for email path). PII (IP, UA, email plaintext, session tokens, signatures, nonces) is permanently forbidden via `PORTAL_AUTH_FORBIDDEN_KEYS` + word-boundary alternation in `FORBIDDEN_KEY_PATTERN`.

## Research Artifacts (v2.6)

Primary source: `.planning/research/v2.6/OBSERVABILITY-HARDENING.md` (committed `3e1fbe6`)
- Root cause of GAP-A confirmed by direct file read of `grid/src/genesis/launcher.ts:138` — production constructs plain `AuditChain`, never `PersistentAuditChain`
- GAP-B trap: SIWE flows carry IP + User-Agent on `req.raw.socket.remoteAddress` and `req.headers['user-agent']` — research locked the payload to closed 3-key tuple with `PORTAL_AUTH_FORBIDDEN_KEYS` set
- Sovereignty-compatible stack: Pino structured logging (already a Fastify transitive dep) + in-process counters + `/health/detailed` JSON polling. NO Prometheus, NO Datadog/Honeycomb/New Relic SaaS, NO `pino-mysql` (single-point-of-failure risk).
- Phase ordering is forced — see Progress section above.

Inherited from v2.5 (do not break):
- Broadcast allowlist frozen-except-by-explicit-addition (53 events at v2.5 close; +3 in v2.6 Phase 33)
- Zero-diff audit chain unbroken since Phase 1 commit `29c3516`
- Hash-only cross-boundary (eth-address-hash, reason-hash, content-hash)
- Zero-custody invariant (PHILOSOPHY §8) — no v2.6 work touches user funds
- First-life promise (PHILOSOPHY §1) — audit entries retained forever
- Sole-producer boundary — one file per event type calls `chain.append`
- Closed-tuple payload — `Object.keys(payload).sort()` strict equality
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` at all entry points

---

## v2.5 Human Portal — SHIPPED 2026-05-24 (Historical)

**Status:** Closed 2026-05-24, 181/181 plans = 100%. Allowlist grew 43 → 53 (+10 events across 5 phases).

**Phases shipped:** 22 (Web3 Identity), 23 (Cyber Coin Wallet), 24 (Portal Shell), 25a/25b/25c (Steward Console Expansion), 26 (Sophia Onboarding), 27 (Nous Interaction), 28 (Personal Nous), 29 (Community), 30 (Resources & Support).

**Allowlist additions:** `human.joined` (44), `human.transferred` (45), `operator.muted` (46), `operator.slashed` (47), `operator.quarantined` (48), `operator.forced_sleep` (49), `operator.human_banned` (50), `operator.human_frozen` (51), `human.spoke` (52), `nous.spawned_by_human` (53).

**Key invariants locked:**
- Zero-custody for human funds — platform never holds USDT/ETH
- `eth_address_hash` (SHA-256 of lowercased address) is the only ETH-address representation in the audit chain
- Sanction reason discipline (D-25b-11): plaintext in `sanction_reasons` table; `reason_hash` only in audit payloads
- Human DID scheme: `did:noesis:human:<lowercased-eth-address>` (SIWE) or `did:noesis:human:email:<uuid>` (email path)

**Post-ship gaps (v2.6 driving inputs):**
- GAP-2026-05-24-A — Audit pipeline silence (Phase 31 root-cause fix)
- GAP-2026-05-24-B — Missing portal.auth.* producers (Phase 33 fix)

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries (Phases 22-30).

---

## v2.4 Agora — SHIPPED 2026-05-20 (Historical)

**Status:** Closed 2026-05-20, 115/115 plans = 100%. Allowlist grew 36 → 43 (+7 events across Phases 18-20; Phase 21 added zero).

**Phases shipped:** 18 (Skill Diffusion), 19 (Norm Crystallization), 20 (Lore Commons), 21 (Culture Dashboard).

**Allowlist additions:** `skill.taught` (37), `skill.inferred` (38), `skill.rejected` (39), `norm.candidate` (40), `norm.crystallized` (41), `lore.contributed` (42), `lore.cited` (43).

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries.

---

## v2.3 Living Minds — SHIPPED 2026-05-15 (Historical)

**Status:** Closed 2026-05-15, 16/16 plans = 100%. Allowlist grew 27 → 36 (+9 events).

**Phases shipped:** 15 (Pneuma — Narrative Self), 16 (Hypnos — Consolidating Memory), 17 (Iris — Theory of Mind).

**Allowlist additions:** `nous.reflection_authored` (28), `nous.self_model_revised` (29), `nous.creed_violation` (30), `nous.sleep.entered` (31), `nous.sleep.completed` (32), `iris.belief_revised` (33), `iris.context_invoked` (34), `iris.contradiction_detected` (35), `iris.prior_seeded` (36).

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries.

---

## v2.2 Living Grid — SHIPPED 2026-04-28 (Historical)

**Status:** Closed 2026-04-28, 44/44 plans = 100%. Allowlist grew 18 → 27 (+9 events across 5 phases; Phases 9 and 14 added zero).

**Phases shipped:** 9 (Relationship Graph), 10a (Ananke Drives), 10b (Bios + Chronos), 11 (Mesh Whisper), 12 (Governance & Collective Law), 13 (Operator Replay & Export), 14 (Researcher Rigs).

**Allowlist additions:** `ananke.drive_crossed` (19), `bios.birth` (20), `bios.death` (21), `nous.whispered` (22), `proposal.opened` (23), `ballot.committed` (24), `ballot.revealed` (25), `proposal.tallied` (26), `operator.exported` (27).

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries.

---

## v2.1 Steward Console — SHIPPED 2026-04-21 (Historical)

**Status:** Closed 2026-04-21, 18/18 plans = 100%. Allowlist grew 10 → 18 (+8 events across Phases 5-8).

**Phases shipped:** 5 (ReviewerNous), 6 (Operator Agency H1-H4), 7 (Peer Dialogue Memory), 8 (H5 Sovereign Operations).

**Allowlist additions:** `trade.reviewed` (11/6, after re-numbering), `operator.inspected` (12), `operator.paused` (13), `operator.resumed` (14), `operator.law_changed` (15), `operator.telos_forced` (16), `telos.refined` (17), `operator.nous_deleted` (18).

See `.planning/MILESTONES.md` for full phase-by-phase ship summaries.

---

## v2.0 First Life — SHIPPED 2026-04-18 (Historical)

**Status:** Sprints 11-14, Dashboard v1 shipped with WebSocket firehose + heartbeat + region map + inspector + economy. Broadcast allowlist established at 10 events.

See `.planning/MILESTONES.md` for full sprint-by-sprint summaries.

---

## v1.0 Genesis — SHIPPED 2026-04-17 (Historical)

**Status:** Closed 2026-04-17, 10 sprints. Identity (Ed25519 DID + SWP), Brain (Psyche/Thymos/Telos), Memory (Karpathy wiki + Stanford retrieval), Grid (WorldClock + SpatialMap + AuditChain), Economy (Ousia P2P), Human Channel, Launch CLI.

**Test coverage at completion:** 944+ TypeScript tests, 226 Python tests — all passing.

See `.planning/MILESTONES.md` for full sprint-by-sprint summaries.

---

*Last updated: 2026-05-25 — v2.6 Phase 33 scope expanded (+human.identified per D-33-A1 / OBS-08b). 5 phases, 16 OBS-* REQs, allowlist 53 → 56 in Phase 33. Phase numbering continues from v2.5.*
