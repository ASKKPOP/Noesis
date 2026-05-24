---
phase: 31-audit-pipeline-persistence
verified: 2026-05-23T23:15:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run 31-HUMAN-UAT.md Steps 1-9 cutover sequence against live docker compose stack"
    expected: "Step 2 reports positive divergence; Step 3 inserts that count; Step 4 confirms row_count equals REST .total; Step 7 shows Pino JSON in docker logs; Step 8 yields >=10 audit_reconcile_ok heartbeats in 5 min; Step 9b shows monotonically increasing MAX(id) over 2 min"
    why_human: "Production restart with real MySQL, docker compose build/up, and tail-log observation cannot be executed programmatically from the planning loop"
---

# Phase 31: Audit Pipeline Persistence Verification Report

**Phase Goal:** Wire PersistentAuditChain + tick-driven AuditReconcile + Pino structured logging + OBS-03 CI gate + operator cutover playbook, satisfying OBS-01..04 for v2.6 Resilience & Observability milestone.
**Verified:** 2026-05-23T23:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PersistentAuditChain is instantiated in production boot path when config.db is present, injected via GenesisLauncherDeps | VERIFIED | `grid/src/main.ts:89` constructs PersistentAuditChain; `launcher.ts:173` assigns `deps?.audit ?? new AuditChain()`; construction order confirmed (PAC line 89 precedes GenesisLauncher line 101) |
| 2 | When config.db is absent, launcher.audit is plain AuditChain — existing >40 unit tests continue to pass | VERIFIED | `grid/test/audit-persistence-wiring.test.ts`: "uses plain AuditChain when no deps supplied" passes; `deps?.audit ?? new AuditChain()` default path confirmed |
| 3 | AuditReconcile fires every 60 ticks via single existing onTick block; emits structured Pino heartbeat on every cycle | VERIFIED | `grep -c 'this\.clock\.onTick'` returns 1 (single subscription); lines 397-404 of launcher.ts wire `event.tick % 60 === 0`; tests confirm heartbeat at info/warn level |
| 4 | DB persist failures emit `logger.warn({ event: 'audit_persist_failed', entry_id, event_type, error_message, error_code })` — zero silent console.warn | VERIFIED | `persistent-chain.ts:66-73` uses exact closed shape; `grep -rn 'console\.'` in grid/src/db/ and grid/src/audit/ returns zero code-level matches; CI gate exits 0 |
| 5 | REPLAY_BATCH_CAP === 500; reconcile loop body never throws | VERIFIED | `audit-reconcile.ts:34: export const REPLAY_BATCH_CAP = 500`; outer try/catch at line 143; test "replays exactly 500 entries when divergence is 1000" passes; "outer catch" test passes |
| 6 | Backfill script reads REST endpoint with pagination, writes via INSERT IGNORE, reads DB creds from env | VERIFIED | `scripts/backfill-audit-trail.mjs:236 lines`; INSERT IGNORE present; MYSQL_ env vars (11 references); pagination with ?limit=100&offset= |
| 7 | CI gate `check-no-silent-catch.mjs` scans grid/src/db/ and grid/src/audit/ and exits 0 on current codebase | VERIFIED | `node scripts/check-no-silent-catch.mjs` exits 0; FORBIDDEN_PATTERN present; wired as "OBS-03 no-silent-catch gate (Phase 31)" step in rig-invariants.yml |
| 8 | 31-HUMAN-UAT.md has 9-step cutover playbook with backfill-FIRST ordering, docker compose build grid, rollback section | VERIFIED | 259 lines; 9 step headings; "docker compose build grid" at line 144; Step 3 (backfill) at line 68 precedes Step 5 (graceful-stop) at line 119; R-31-03 language present; rollback section at line 253 |
| 9 | PersistentAuditChain.head is byte-identical with vs without DB after N appends (R-31-01 zero-diff invariant) | VERIFIED | `audit-persistence-wiring.test.ts:102`: `expect(plain.head).toBe(persistent.head)` passes; 13/13 tests pass |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Requirement | Status | Details |
|----------|-------------|--------|---------|
| `grid/src/util/logger.ts` | exports `logger` and `Logger`, >=25 lines, Pino redact | VERIFIED | 66 lines; exports `logger: Logger` and `type Logger`; redact list includes password, signature, nonce, cookie, jwt, authorization, secret, token with wildcard variants; NOESIS_LOG_PRETTY env-gate |
| `scripts/backfill-audit-trail.mjs` | >=150 lines, env-only credentials, INSERT IGNORE, --dry-run | VERIFIED | 236 lines; executable; 11 MYSQL_ env references; INSERT IGNORE at line ~237; --dry-run flag present |
| `grid/src/db/persistent-chain.ts` | Pino logger child, lastPersistError getter, no console.warn | VERIFIED | 77 lines; imports baseLogger and creates child; lastPersistError getter at line 46; zero console.* |
| `grid/src/db/audit-reconcile.ts` | class AuditReconcile, REPLAY_BATCH_CAP=500, 60-tick cadence wired externally | VERIFIED | 159 lines; exports AuditReconcile, REPLAY_BATCH_CAP=500, DIVERGENCE_WARN_THRESHOLD=10; three getters; no setInterval; no raw INSERT SQL |
| `grid/src/genesis/launcher.ts` | auditReconcile field readonly, single onTick block | VERIFIED | `readonly auditReconcile: AuditReconcile | undefined` at line 151; exactly 1 onTick subscription; reconcile wired at lines 402-404 |
| `grid/src/main.ts` | constructs PersistentAuditChain + AuditReconcile when config.db present | VERIFIED | Both constructed inside `if (config.db)` block; deps passed as `{ audit: chain, auditReconcile }` |
| `scripts/check-no-silent-catch.mjs` | >=90 lines, FORBIDDEN_PATTERN, executable | VERIFIED | 135 lines; executable; FORBIDDEN_PATTERN at line 53; SCAN_DIRS covers grid/src/db/ and grid/src/audit/; exits 0 on current codebase |
| `.github/workflows/rig-invariants.yml` | new step running check-no-silent-catch.mjs | VERIFIED | Step "OBS-03 no-silent-catch gate (Phase 31)" at line 27; runs before Vitest step; no new workflow file created |
| `.planning/phases/31-audit-pipeline-persistence/31-HUMAN-UAT.md` | >=100 lines, 9-step cutover, backfill-FIRST, docker compose build grid | VERIFIED | 259 lines; 9 steps; Step 3 (backfill) before Step 5 (stop); explicit R-31-03 mitigation framing |
| `grid/test/audit-persistence-wiring.test.ts` | >=80 lines, R-31-01 zero-diff regression | VERIFIED | 145 lines; 4 test cases pass (13 total with reconcile suite); zero-diff assertion at line 102 |
| `grid/test/audit-reconcile.test.ts` | >=100 lines, batch cap pin, outer-catch | VERIFIED | 278 lines; 9 test cases; REPLAY_BATCH_CAP=500 asserted; `toHaveLength(500)` for divergence-1000 case; outer-catch uses `resolves.toBeUndefined()` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `grid/src/main.ts` | `grid/src/genesis/launcher.ts` | `new GenesisLauncher(config.genesisConfig, chain ? { audit: chain, auditReconcile } : undefined)` | WIRED | Line 101-104 of main.ts; confirmed by grep |
| `grid/src/db/persistent-chain.ts` | `grid/src/util/logger.ts` | `import { logger as baseLogger } from '../util/logger.js'` | WIRED | Line 26 of persistent-chain.ts; child logger at line 28 |
| `grid/src/genesis/launcher.ts (onTick block)` | `grid/src/db/audit-reconcile.ts` | `void this.auditReconcile.run()` inside single onTick | WIRED | Lines 402-404 of launcher.ts; single subscription confirmed |
| `grid/src/main.ts` | `grid/src/db/audit-reconcile.ts` | `import { AuditReconcile } from './db/audit-reconcile.js'` | WIRED | Line 24 of main.ts; construction at line 93 |
| `.github/workflows/rig-invariants.yml` | `scripts/check-no-silent-catch.mjs` | `node scripts/check-no-silent-catch.mjs` | WIRED | Line 28 of rig-invariants.yml |
| `scripts/backfill-audit-trail.mjs` | `/api/v1/audit/trail` | `fetch(...audit/trail?limit=100&offset=...)` | WIRED | Pagination fetch in script |
| `scripts/backfill-audit-trail.mjs` | `audit_trail MySQL table` | `INSERT IGNORE INTO audit_trail` | WIRED | Present in script via mysql2/promise |
| `.planning/phases/31-audit-pipeline-persistence/31-HUMAN-UAT.md` | `scripts/backfill-audit-trail.mjs` | Step 2-3 invocations | WIRED | "backfill-audit-trail" appears 5 times in UAT doc |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `persistent-chain.ts` | `entry` (from super.append) | `AuditChain.append()` synchronous in-memory | Yes — direct method call | FLOWING |
| `audit-reconcile.ts` | `dbMaxId` (SELECT MAX(id)) | `db.query(SELECT COALESCE...)` | Yes — DB query with parameterized gridName | FLOWING |
| `check-no-silent-catch.mjs` | `allViolations` | `readFileSync` walk over SCAN_DIRS | Yes — filesystem scan | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 13 Phase 31 tests pass | `cd grid && npx vitest run test/audit-persistence-wiring.test.ts test/audit-reconcile.test.ts` | 13/13 passed in 309ms | PASS |
| CI gate exits 0 on current codebase | `node scripts/check-no-silent-catch.mjs` | Exit 0, "OK — no silent .catch" | PASS |
| Backfill script parses cleanly | `node --check scripts/backfill-audit-trail.mjs` | Exit 0 | PASS |
| db.query used for SELECT (correct API) | `grep 'db\.query' grid/src/db/audit-reconcile.ts` | Line 76: `db.query<{max_id...}>` — correct: `query` returns typed rows, `execute` returns void | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| OBS-01 | 31-03 | PersistentAuditChain in production boot path when dbConn is present; zero-diff invariant | SATISFIED | `main.ts:89` constructs PAC inside `if (config.db)`; `launcher.ts:173` `deps?.audit ?? new AuditChain()`; R-31-01 regression test passes |
| OBS-02 | 31-04 | AuditReconcile every 60 ticks; INSERT IGNORE replay; heartbeat logs every cycle | SATISFIED | Single onTick subscription wires `event.tick % 60 === 0`; REPLAY_BATCH_CAP=500; heartbeat logged at info/warn per divergence; tests pin behavior |
| OBS-03 | 31-01, 31-03, 31-05 | Pino structured logging for all audit-persistence failure paths; zero silent .catch+console; CI gate | SATISFIED | Zero console.* in grid/src/db/ and grid/src/audit/ (code lines); CI gate exits 0; workflow step present |
| OBS-04 | 31-02 | Backfill script via REST + INSERT IGNORE; idempotent; documented in HUMAN-UAT | SATISFIED | `scripts/backfill-audit-trail.mjs:236 lines`; INSERT IGNORE; env-only credentials; HUMAN-UAT Steps 2-4 document manual verification |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `grid/src/db/persistent-chain.ts` | 10 | `console.warn` in JSDoc comment (not code) | Info | Not a code violation; the CI gate correctly skips comment lines; zero code-level console.* calls exist |
| `grid/src/db/audit-reconcile.ts` | 76 | Uses `db.query` where plan specified `db.execute` | Info | NOT a bug — `query` returns typed rows (correct for SELECT); `execute` returns void (correct for DML). The implementation chose the right method; the plan had a minor inconsistency. Tests confirm correct behavior. |

No blockers. No stubs. No orphaned artifacts.

### Human Verification Required

#### 1. Live Cutover Sequence (31-HUMAN-UAT.md Steps 1-9)

**Test:** Follow the 9-step cutover playbook in `.planning/phases/31-audit-pipeline-persistence/31-HUMAN-UAT.md`. The critical path is: (1) verify OLD Grid is up, (2) run backfill --dry-run to see divergence, (3) run backfill live, (4) confirm MySQL row_count == REST .total, (5) stop OLD Grid, (6) docker compose build grid && docker compose up -d grid, (7) tail logs 30s for Pino JSON + first audit_reconcile_ok, (8) count >=10 heartbeats in 5 min, (9a) REST returns entries, (9b) MAX(id) is monotonic over 2 min.

**Expected:** Step 2 delta > 0; Step 3 inserted == delta; Step 4 row_count == REST total; Step 7 shows Pino-shaped JSON (not plain text PersistentAuditChain warnings); Step 8 yields >=10 audit_reconcile_ok lines with divergence: 0 at steady state; Step 9b second MAX(id) strictly greater than first.

**Why human:** Requires a running Docker Compose stack with live MySQL and the production Grid container. Needs live `docker compose build grid && docker compose up -d grid` per the deploy-docker memory rule. Log tailing for 5 minutes and MySQL queries cannot be executed from within the planning loop.

### Gaps Summary

No gaps. All 9 observable truths are VERIFIED against the actual codebase. All 11 required artifacts exist, are substantive (above minimum line counts), and are wired into their consuming paths. All 8 key links are confirmed present. The CI gate runs cleanly. All 13 Phase 31 regression tests pass.

The single human_needed item is the operator cutover (31-HUMAN-UAT.md), which is intrinsically operator-gated: its purpose is to convert the shipped code into deployed production state by running the 9-step procedure against the live docker stack. The code artifacts that the cutover validates are all VERIFIED.

**Code review status:** 31-REVIEW.md documents 0 critical, 7 warnings, 9 info findings. The top open item (WR-01: AuditReconcile.run() in-flight guard) is not a phase blocker — it is a follow-up recommendation via `/gsd-code-review-fix`.

---

_Verified: 2026-05-23T23:15:00Z_
_Verifier: Claude (gsd-verifier)_
