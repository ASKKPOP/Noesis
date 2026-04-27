---
phase: "12"
plan: "12-00"
subsystem: governance
tags: [allowlist, types, migration, tdd-red, doc-sync, commit-reveal, governance]
dependency_graph:
  requires:
    - phase-11-plan-11-00  # allowlist 21→22 (nous.whispered)
  provides:
    - governance-types-module
    - governance-config-module
    - governance-db-schema-v6
    - governance-red-test-stubs
    - allowlist-22-to-26
  affects:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/governance/
    - dashboard/src/lib/protocol/
    - brain/src/noesis_brain/governance/
    - grid/src/db/schema.ts
    - grid/test/governance/
    - scripts/check-state-doc-sync.mjs
    - scripts/check-wallclock-forbidden.mjs
tech_stack:
  added:
    - governance module (grid/src/governance/)
    - governance brain module (brain/src/noesis_brain/governance/)
    - governance dashboard mirror (dashboard/src/lib/protocol/governance-types.ts)
  patterns:
    - closed-tuple payload interfaces with KEYS tuples
    - sole-producer boundary pattern (four append*.ts stubs RED)
    - three-tier type mirrors (grid TS → dashboard TS → brain Python)
    - SYNC header comments for drift detection
    - TDD RED stubs (Wave 0 compile-error stubs for Wave 1/2 implementation)
    - commit-reveal sha256(choice|nonce|voter_did) with pipe delimiters
    - pessimistic quorum (committed-but-unrevealed count toward quorum)
    - GOVERNANCE_FORBIDDEN_KEYS (12 literals, body-text + vote-weighting)
key_files:
  created:
    - grid/src/governance/types.ts
    - grid/src/governance/config.ts
    - dashboard/src/lib/protocol/governance-types.ts
    - brain/src/noesis_brain/governance/types.py
    - brain/src/noesis_brain/governance/__init__.py
    - grid/test/audit/allowlist-twenty-six.test.ts
    - grid/test/governance/governance-producer-boundary.test.ts
    - grid/test/governance/governance-commit-hash.test.ts
    - grid/test/governance/governance-tally.test.ts
    - grid/test/governance/governance-privacy-matrix.test.ts
    - grid/test/governance/governance-zero-diff.test.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/db/schema.ts
    - grid/test/audit/broadcast-allowlist.test.ts
    - grid/test/audit/allowlist-twenty-two.test.ts
    - scripts/check-state-doc-sync.mjs
    - scripts/check-wallclock-forbidden.mjs
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - PHILOSOPHY.md
decisions:
  - "GOVERNANCE_FORBIDDEN_KEYS declared in broadcast-allowlist.ts and re-exported via governance/types.ts to avoid circular dependency"
  - "Migration v6 uses plain SQL strings (up/down) following existing MIGRATIONS array pattern, not async Pool callback"
  - "commit_hash formula frozen as sha256(choice|nonce|voter_did) with pipe delimiters (D-12-02)"
  - "Pessimistic quorum: (revealed + unrevealed_committed) / totalNousCount >= quorumPct/100"
  - "GOVERNANCE_FORBIDDEN_KEYS de-duplicates: text/body/content already in FORBIDDEN_KEY_PATTERN from Phase 11; 9 new keys appended"
  - "allowlist-twenty-two.test.ts refactored to remove exact EXPECTED_ORDER full-array comparison — only asserts position-22 (nous.whispered) and membership of 22 prior events"
  - "KNOWN_CONSUMERS arrays in producer-boundary test include governance/types.ts because it references event names in SYNC docblock"
metrics:
  duration: "~60 minutes (cross-session)"
  completed_date: "2026-04-27"
  tasks_completed: 5
  files_created: 11
  files_modified: 9
---

# Phase 12 Plan 00: Governance Wave 0 Setup Summary

Commit-reveal governance foundation: allowlist 22→26 with four closed-tuple events, three-tier type mirrors, MySQL migration v6, five TDD-RED test stubs, wall-clock gate extension, and atomic doc-sync across STATE/ROADMAP/PHILOSOPHY/CI scripts.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 12-W0-01 | Bump broadcast allowlist 22→26 + GOVERNANCE_FORBIDDEN_KEYS | ffe0baa | broadcast-allowlist.ts, allowlist-twenty-six.test.ts, broadcast-allowlist.test.ts, allowlist-twenty-two.test.ts |
| 12-W0-02 | Closed-tuple type module + dashboard fifth mirror + brain mirror | 50f22b1 | grid/src/governance/types.ts, config.ts, dashboard/src/lib/protocol/governance-types.ts, brain/src/noesis_brain/governance/types.py, __init__.py |
| 12-W0-03 | MySQL migration v6 — governance_proposals + governance_ballots | 9a36599 | grid/src/db/schema.ts |
| 12-W0-04 | Five RED stubs in grid/test/governance/ | d6e6617 | governance-producer-boundary.test.ts, governance-commit-hash.test.ts, governance-tally.test.ts, governance-privacy-matrix.test.ts, governance-zero-diff.test.ts |
| 12-W0-05 | Wall-clock gate + atomic doc-sync | 19cf9b7 | check-wallclock-forbidden.mjs, check-state-doc-sync.mjs, STATE.md, ROADMAP.md, PHILOSOPHY.md |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed allowlist-twenty-two.test.ts full-array comparison**
- **Found during:** Task 12-W0-01
- **Issue:** `allowlist-twenty-two.test.ts` asserted `expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER])` against a hardcoded 22-element array. After allowlist grew to 26, this would fail with a spurious mismatch.
- **Fix:** Rewrote test to assert only: (a) position-22 is `nous.whispered` (unchanged by Phase 12), (b) all 22 prior members are present. Removed exact-order full-array comparison.
- **Files modified:** `grid/test/audit/allowlist-twenty-two.test.ts`
- **Commit:** ffe0baa

**2. [Rule 1 - Bug] Schema migration v6 pattern mismatch**
- **Found during:** Task 12-W0-03
- **Issue:** Plan's `<interfaces>` block showed migration v6 as an `async (conn: Pool) => { await conn.execute(...) }` callback, but `grid/src/db/schema.ts` uses plain SQL strings (`up: string`, `down: string`).
- **Fix:** Adapted to plain SQL strings; both CREATE TABLE statements placed in `up` field per existing MIGRATIONS array pattern.
- **Files modified:** `grid/src/db/schema.ts`
- **Commit:** 9a36599

**3. [Rule 2 - Missing critical] KNOWN_CONSUMERS arrays in producer-boundary test**
- **Found during:** Task 12-W0-04
- **Issue:** `governance-producer-boundary.test.ts` KNOWN_CONSUMERS arrays needed to include `governance/types.ts` because that file references governance event names in its SYNC docblock — the producer-boundary grep would incorrectly flag it as an unauthorized emitter reference otherwise.
- **Fix:** Added `GOVERNANCE_TYPES_FILE` constant to each of the four KNOWN_CONSUMERS arrays.
- **Files modified:** `grid/test/governance/governance-producer-boundary.test.ts`
- **Commit:** d6e6617

**4. [Rule 2 - Missing critical] GOVERNANCE_FORBIDDEN_KEYS de-duplication**
- **Found during:** Task 12-W0-01
- **Issue:** `text`, `body`, `content` already existed in `FORBIDDEN_KEY_PATTERN` from Phase 11 whisper extension. Adding them again would create a redundant alternation group.
- **Fix:** Added only the 9 net-new governance keys (`description|rationale|proposal_text|law_text|body_text|weight|reputation|relationship_score|ousia_weight`); existing three keys preserved in place.
- **Files modified:** `grid/src/audit/broadcast-allowlist.ts`
- **Commit:** ffe0baa

## Known Stubs

The following are intentional Wave 0 RED stubs — missing implementation files that Wave 1/2 will supply:

| Stub | File | Reason |
|------|------|--------|
| `computeCommitHash` import | `grid/test/governance/governance-commit-hash.test.ts:3` | `grid/src/governance/commit-reveal.ts` ships in Wave 1 |
| `computeTally` import | `grid/test/governance/governance-tally.test.ts:3` | `grid/src/governance/tally.ts` ships in Wave 2 |
| `runFixtureReplay` import | `grid/test/governance/governance-zero-diff.test.ts:27` | `grid/src/governance/replay.ts` ships in Wave 2 |
| `appendProposalOpened.ts` | `grid/test/governance/governance-producer-boundary.test.ts` | Sole-producer emitter ships in Wave 2 |
| `appendBallotCommitted.ts` | `grid/test/governance/governance-producer-boundary.test.ts` | Sole-producer emitter ships in Wave 2 |
| `appendBallotRevealed.ts` | `grid/test/governance/governance-producer-boundary.test.ts` | Sole-producer emitter ships in Wave 2 |
| `appendProposalTallied.ts` | `grid/test/governance/governance-producer-boundary.test.ts` | Sole-producer emitter ships in Wave 2 |
| expected hash `'TBD-W2'` | `grid/test/governance/governance-zero-diff.test.ts` | Wave 2 computes and pastes actual sha256 hex |

`governance-privacy-matrix.test.ts` is GREEN at Wave 0 (GOVERNANCE_FORBIDDEN_KEYS already exists from W0-01).

## Decisions Made

1. **GOVERNANCE_FORBIDDEN_KEYS source of truth**: Declared in `broadcast-allowlist.ts`, re-exported via `governance/types.ts`. This avoids a circular import (allowlist cannot import from governance/). The re-export pattern is consistent with Phase 11 WHISPER_FORBIDDEN_KEYS.

2. **Migration pattern**: Plain SQL strings (`up: string`, `down: string`) per existing `MIGRATIONS` array convention in `grid/src/db/schema.ts`. Plan's callback-style pseudocode was illustrative, not prescriptive.

3. **commit_hash formula frozen**: `sha256(choice + "|" + nonce + "|" + voter_did)` — pipe delimiters, lowercase choice, 32-hex nonce. Test fixture canonical value: `computeCommitHash('yes', '00000000000000000000000000000000', 'did:noesis:alice')` = `0cf5f7c6716a14ead21fea90c208612472843151494e341a90cc15017cb3e0f2`.

4. **Pessimistic quorum**: Unrevealed-but-committed ballots count toward quorum denominator. A Nous that committed but never revealed is still counted as a participant — prevents quorum gaming via silent abstention.

5. **Operator governance exclusion enforced by CI**: `scripts/check-governance-isolation.mjs` (ships Wave 2) will assert no `operator-events.ts` import in `grid/src/governance/**`. Wave 0 documents the invariant; Wave 2 enforces it mechanically.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: body-text-privacy | grid/src/db/schema.ts | `governance_proposals.body_text TEXT` — proposal full text stored in MySQL. Audit chain carries only `title_hash` (sha256[:32]). Row-level access control required in Wave 2 API layer (VOTE-05). |
| threat_flag: operator-governance-exclusion | grid/src/governance/types.ts | Governance module currently has no runtime operator exclusion gate — only type-level. CI grep gate and API-layer operator-DID check ship in Wave 2 (D-12-11). |

## CI Gate Results

- `node scripts/check-state-doc-sync.mjs` — OK (26-event allowlist, all 26 members present in STATE.md)
- `node scripts/check-wallclock-forbidden.mjs` — OK (no wall-clock reads in governance Brain/Grid trees)

## Self-Check: PASSED

All 15 key files found on disk. All 5 task commits verified in git log.

| Check | Result |
|-------|--------|
| grid/src/governance/types.ts | FOUND |
| grid/src/governance/config.ts | FOUND |
| dashboard/src/lib/protocol/governance-types.ts | FOUND |
| brain/src/noesis_brain/governance/types.py | FOUND |
| brain/src/noesis_brain/governance/__init__.py | FOUND |
| grid/src/audit/broadcast-allowlist.ts | FOUND |
| grid/src/db/schema.ts | FOUND (modified) |
| allowlist-twenty-six.test.ts | FOUND |
| Five governance test stubs | FOUND (×5) |
| CI scripts updated | FOUND (×2) |
| Commit ffe0baa (W0-01 allowlist) | FOUND |
| Commit 50f22b1 (W0-02 types) | FOUND |
| Commit 9a36599 (W0-03 migration) | FOUND |
| Commit d6e6617 (W0-04 RED stubs) | FOUND |
| Commit 19cf9b7 (W0-05 doc-sync) | FOUND |
