---
phase: 12
plan: 02
subsystem: governance
tags: [governance, sole-producer, commit-reveal, tally, law-promotion, zero-diff, audit-chain]
dependency_graph:
  requires: ["12-00", "12-01"]
  provides: ["12-03", "12-04"]
  affects: ["grid/src/governance/**", "grid/src/logos/types.ts"]
tech_stack:
  added:
    - GovernanceStore (in-memory Map-backed + MySQL interface)
    - GovernanceEngine (tick-closed orchestrator)
    - computeTally (pure function)
    - runFixtureReplay (deterministic replay harness)
    - GovernanceError (structured error codes 404/409/422)
  patterns:
    - Sole-producer boundary (grep-gate enforced, one file per audit event)
    - Closed-tuple payload validation (Object.keys.sort() strict-equal)
    - DB-write-before-audit-append (orphan prevention)
    - Pessimistic quorum (committed-but-unrevealed counts toward denominator)
    - _proposalIdOverride escape hatch for deterministic replay (UUID bypass)
    - SQL whitespace normalization (replace /\s+/g with ' ') for multiline template literals in in-memory store
key_files:
  created:
    - grid/src/governance/appendProposalOpened.ts
    - grid/src/governance/appendBallotCommitted.ts
    - grid/src/governance/appendBallotRevealed.ts
    - grid/src/governance/appendProposalTallied.ts
    - grid/src/governance/appendLawTriggered.ts
    - grid/src/governance/tally.ts
    - grid/src/governance/store.ts
    - grid/src/governance/engine.ts
    - grid/src/governance/replay.ts
    - grid/src/governance/errors.ts
    - grid/test/governance/governance-emitter-enforcement.test.ts
    - grid/test/governance/governance-store.test.ts
    - grid/test/governance/governance-engine.test.ts
  modified:
    - grid/src/logos/types.ts (additive LawTriggeredPayload widening + LAW_TRIGGERED_KEYS)
    - grid/test/governance/governance-zero-diff.test.ts (async + Date.now mock + frozen hashes)
decisions:
  - "_proposalIdOverride escape hatch added to AppendProposalOpenedInput so replay.ts can pass a deterministic proposal_id without modifying the UUID-generating production path"
  - "In-memory store SQL matching fixed by normalizing whitespace (sql.replace(/\\s+/g, ' ')) before regex matching — multiline template literals broke single-line regex patterns"
  - "Zero-diff test made async (await runFixtureReplay) since all emitters are async; Date.now mocked via vi.spyOn for deterministic AuditChain hashes"
  - "law.triggered W0 producer-boundary test had no describe block — none added (plan only required the four ballot/proposal events; law.triggered coverage via emitter-enforcement tests)"
metrics:
  duration: "~90 minutes (resumed from context-interrupted session)"
  completed: "2026-04-27"
  tasks_completed: 4
  files_created: 12
  files_modified: 2
  tests_added: 87
  tests_all_green: true
---

# Phase 12 Plan 02: Governance Emitters + Tally Engine Summary

Five sole-producer emitters, pure tally function, GovernanceStore, GovernanceEngine, and replay harness — all four W0 RED stubs flip GREEN; law.triggered payload widens by `enacted_by: 'collective' | 'operator'`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 12-W2-01 | Four emitters + GovernanceStore + enforcement tests | 41ffc8b | appendProposalOpened, appendBallotCommitted, appendBallotRevealed, appendProposalTallied, store.ts, errors.ts, governance-emitter-enforcement.test.ts, governance-store.test.ts |
| 12-W2-02 | Pure computeTally + W0 tally/privacy-matrix GREEN | 75f87ff | tally.ts |
| 12-W2-03 | GovernanceEngine + replay harness + W0 zero-diff GREEN | 270c5c4 | engine.ts, replay.ts, governance-engine.test.ts, governance-zero-diff.test.ts |
| 12-W2-04 | appendLawTriggered + LawTriggeredPayload widening | 4f5db63 | appendLawTriggered.ts, logos/types.ts |

## Implementation Details

### Sole-Producer Pattern

Each of the five emitter files contains EXACTLY ONE call to `audit.append('event.literal', ...)` for its event. The grep gate in `governance-producer-boundary.test.ts` (16 tests) enforces this contract. All four W0 RED stubs now GREEN.

Payload validation in each emitter:
1. Input validation (DID_RE, range checks, non-empty strings)
2. Closed-tuple shape check: `Object.keys(payload).sort()` strict-equal against KEYS tuple
3. Forbidden-key check: iterate keys, throw if any in GOVERNANCE_FORBIDDEN_KEYS (12 keys)
4. DB write (INSERT or UPDATE)
5. audit.append (sole-producer line)

### computeTally (Pure Function)

Pessimistic quorum per D-12-03:
- `participation = reveals.length + unrevealedCommittedCount`
- `quorum_met = participation >= ceil(quorumPct/100 * totalNousCount)`
- `outcome = !quorum_met → 'quorum_fail' | (yes/(yes+no) >= supermajority/100) → 'passed' | else → 'rejected'`
- Edge case: `decisive === 0 && quorum_met → 'rejected'`

### GovernanceStore

MySQL interface (`GovernanceDb`) with in-memory Map-backed implementation (`createInMemoryStore`). 9 methods covering full proposal + ballot lifecycle. SQL pattern matching uses `sql.replace(/\s+/g, ' ')` normalization to handle multiline template literals.

### Zero-Diff Regression

Chain-tail hashes frozen for fixture-A (10 voters, 8 yes + 2 no, quorum=50%, supermajority=67%):
- 0 reveals: `a3fb2a6368d66a608083a63840c95f60aa86f305d3e49729d8a661acf0acaf1c`
- 1 reveal:  `37a3c8b369a9fa0cba323a2b15aad7ca035f9e82a13b6837a1456fc68c350985`
- 5 reveals: `642d5e101312108c20ef78d1321952803764c9010cf89d77b3c73def14364ef3`
- 10 reveals: `c2636503f177bd36888661deda4ef2a3e46f610520e87c0592626422973e06c7`

Determinism requires: (1) `Date.now` mocked via `vi.spyOn`, (2) `proposal_id` fixed via `_proposalIdOverride: fixtureId`.

### law.triggered Widening (T-09-15)

`LawTriggeredPayload` widened from 3 keys to 4: `{enacted_by, law_hash, law_id, triggered_at_tick}`. `enacted_by: 'collective' | 'operator'` distinguishes governance-driven from operator-driven law enactment. Phase 12 is the first time `law.triggered` is emitted programmatically — `appendLawTriggered` is the sole producer.

## Test Coverage

| File | Tests | Status |
|------|-------|--------|
| governance-producer-boundary.test.ts | 16 | GREEN |
| governance-tally.test.ts | 7 | GREEN |
| governance-privacy-matrix.test.ts | 5 | GREEN |
| governance-zero-diff.test.ts | 5 | GREEN |
| governance-emitter-enforcement.test.ts | 19 | GREEN (NEW) |
| governance-store.test.ts | 14 | GREEN (NEW) |
| governance-engine.test.ts | 6 | GREEN (NEW) |
| governance-commit-hash.test.ts | 6 | GREEN (unchanged) |
| governance-reveal-verify.test.ts | 9 | GREEN (unchanged) |
| **Total** | **87** | **ALL GREEN** |

Pre-existing tests: 387 tests across audit, whisper, bios, logos — all GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] In-memory store SQL pattern matching broken for multiline template literals**
- **Found during:** Task 12-W2-03 (zero-diff test debugging)
- **Issue:** The in-memory GovernanceStore used regex patterns like `/SELECT.*FROM governance_ballots.*voter_did = \?/` against multiline SQL template literals. JavaScript `.` does not match newlines by default, so `FROM` on a different line from `SELECT` was not matched. `getBallot` returned `null` for all lookups.
- **Fix:** Added `const s = sql.replace(/\s+/g, ' ')` at the top of both `execute` and `query` handlers; all pattern matches use `s` (whitespace-normalized) instead of raw `sql`.
- **Files modified:** `grid/src/governance/store.ts`
- **Commit:** 41ffc8b

**2. [Rule 1 - Bug] Zero-diff test non-deterministic due to randomUUID() in appendProposalOpened**
- **Found during:** Task 12-W2-03 (zero-diff hash stability verification)
- **Issue:** `randomUUID()` generates a fresh UUID each run. The proposal_id appears in ballot keys, audit payloads, and the replay store — making chain-tail hashes different on every run even with `Date.now` mocked.
- **Fix:** Added `_proposalIdOverride?: string` to `AppendProposalOpenedInput` (escape hatch, ignored in production). `replay.ts` passes `fixtureId` as the override. Zero production code path changed.
- **Files modified:** `grid/src/governance/appendProposalOpened.ts`, `grid/src/governance/replay.ts`
- **Commit:** 270c5c4

**3. [Rule 1 - Bug] Producer-boundary forbidden-siblings test failed (JSDoc headers contained literal forbidden sibling strings)**
- **Found during:** Task 12-W2-01 (producer-boundary test run)
- **Issue:** The emitter file JSDoc headers documented forbidden sibling event names literally (e.g., `"proposal.created, proposal.draft"`). The test does a plain `src.includes(sibling)` scan of all `grid/src/**` files, causing 4 test failures.
- **Fix:** Replaced forbidden sibling lists in all 4 emitter JSDoc headers with `"see governance-producer-boundary.test.ts for the full list"`.
- **Files modified:** `appendProposalOpened.ts`, `appendBallotCommitted.ts`, `appendBallotRevealed.ts`, `appendProposalTallied.ts`
- **Commit:** 41ffc8b

**4. [Rule 2 - Missing] Zero-diff test W0 stub was synchronous; runFixtureReplay is async**
- **Found during:** Task 12-W2-03 (zero-diff test design)
- **Issue:** W0 stub called `runFixtureReplay` without `await`, meaning it compared a Promise to a string. The test file was redesigned to be fully async with `beforeEach`/`afterEach` for Date.now mocking.
- **Fix:** Rewrote `governance-zero-diff.test.ts` with async test bodies, `vi.spyOn(Date, 'now')`, and reset `fakeNow = 1_700_000_000_000` before each call.
- **Files modified:** `grid/test/governance/governance-zero-diff.test.ts`
- **Commit:** 270c5c4

## Known Stubs

None. All emitters are fully wired. The governance API routes (Wave 3) will call these emitters but the emitters themselves are complete and tested.

## Threat Flags

No new network endpoints or auth paths introduced. GovernanceStore is constructed via DI (no module-level singleton). All emitters reject forbidden payload keys at runtime.

## Self-Check: PASSED
