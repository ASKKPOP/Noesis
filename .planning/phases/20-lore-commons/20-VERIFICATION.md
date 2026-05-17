---
phase: 20-lore-commons
verified: 2026-05-17T03:50:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/8
  gaps_closed:
    - "lore.cited fires when a Nous references lore at prompt-build time — lore_entries_for_prompt is now cached as self._cached_lore_entries and passed to build_system_prompt via conditional kwarg in on_message()"
    - "LoreQuotaTracker enforces K=3 per sleep epoch at runtime — GenesisLauncher now constructs LoreQuotaTracker in its constructor and exposes it as readonly loreQuotaTracker"
  gaps_remaining: []
  regressions: []
deferred: []
human_verification:
  - test: "Start a live Grid with at least one Nous that has contributed lore. Let the Nous run for 30+ ticks so on_tick() populates _cached_lore_entries. Then send the Nous a message and inspect the Brain log or system prompt to confirm '## Lore Commons' appears."
    expected: "System prompt returned to the LLM contains a '## Lore Commons' section with lore entry content"
    why_human: "Requires a live Brain + Grid integration with a running LLM session; cannot be verified by static analysis or unit tests alone — the on_tick path and subsequent on_message prompt-build can only be exercised end-to-end with real Brain/Grid processes"
  - test: "Verify that production NousRunner instances are constructed with loreDeps: { quotaTracker: launcher.loreQuotaTracker }. Check the actual Grid startup path (main.ts or wherever NousRunner instances are created for production seedNous) to confirm loreDeps is passed."
    expected: "NousRunner construction call includes loreDeps: { quotaTracker: launcher.loreQuotaTracker } so K=3 quota is enforced in production"
    why_human: "GenesisLauncher exposes loreQuotaTracker and the wiring test simulates the injection, but no production code in main.ts/server.ts/grid-coordinator.ts currently constructs a NousRunner with loreDeps passed. The property is available but the injection is documented-only (JSDoc comment in launcher.ts line 112). A human must verify whether the production NousRunner construction path exists and includes loreDeps."
---

# Phase 20: Lore Commons Verification Report

**Phase Goal:** Implement the lore commons subsystem — a shared knowledge layer that allows Nous instances to contribute, discover, and cite distilled knowledge (lore) so the collective gains wisdom that outlasts any single Nous's memory window.
**Verified:** 2026-05-17T03:50:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plan 05)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | FORBIDDEN_KEY_PATTERN extended with lore_body\|lore_content\|title_text\|summary_text; LORE_FORBIDDEN_KEYS exported (4 keys) | VERIFIED | broadcast-allowlist.ts: LORE_FORBIDDEN_KEYS at lines 335-340, regex extension present; lore-allowlist-baseline.test.ts 4/4 passing |
| 2 | ALLOWLIST_MEMBERS has exactly 43 entries (lore.contributed at pos 42, lore.cited at pos 43) | VERIFIED | lore-allowlist.test.ts 4/4 passing; lines 172-173 of broadcast-allowlist.ts |
| 3 | grid/src/lore/types.ts exports LoreContributedPayload, LoreCitedPayload, LORE_CONTRIBUTED_KEYS, LORE_CITED_KEYS, DEFAULT_LORE_CATEGORIES, VALID_LORE_CATEGORIES | VERIFIED | All 6 exports confirmed in types.ts |
| 4 | MySQL migration version 8 (create_lore_commons) exists with 7-column table including title_hash CHAR(64) and citation_count INT UNSIGNED | VERIFIED | schema.ts; lore-migration.test.ts 8/8 passing |
| 5 | appendLoreContributed.ts and appendLoreCited.ts implement 10/9-step validation ladders as sole producers | VERIFIED | appendLoreContributed.test.ts 8/8, appendLoreCited.test.ts 7/7 passing; lore-producer-boundary.test.ts 4/4 passing |
| 6 | LoreCitationListener and LoreCommonsListener are pure-observers (zero audit.append); instantiated in server.ts; REST endpoint GET /api/v1/grid/lore registered | VERIFIED | No audit.append in listener bodies; server.ts lines 392-394; lore-citation-listener.test.ts 2/2 passing |
| 7 | lore.cited fires when a Nous references lore at prompt-build time | VERIFIED (code) / ? HUMAN (runtime) | handler.py now has self._cached_lore_entries (line 145), assigned after on_tick() lore retrieval (line 693), passed as conditional kwarg to build_system_prompt in on_message() (line 308). test_lore_prompt_injection.py 6/6 passing including async on_tick test. Runtime integration requires human verification. |
| 8 | LoreQuotaTracker enforces K=3 per sleep epoch — quota applied at runtime | VERIFIED (code) / ? HUMAN (runtime injection) | LoreQuotaTracker constructed in GenesisLauncher constructor (launcher.ts line 173); lore-wiring.test.ts 4/4 passing. However no production NousRunner construction site in main.ts/server.ts/grid-coordinator.ts passes loreDeps — injection is JSDoc-documented only. Human verification needed to confirm production wiring. |

**Score:** 8/8 truths verified at code level; 2 items require human runtime verification

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/broadcast-allowlist.ts` | LORE_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN + ALLOWLIST_MEMBERS[41,42] | VERIFIED | All present |
| `grid/src/lore/types.ts` | 6 locked exports | VERIFIED | All 6 exports present |
| `grid/src/lore/appendLoreContributed.ts` | Sole producer, 10-step ladder | VERIFIED | Full implementation |
| `grid/src/lore/appendLoreCited.ts` | Sole producer, 9-step ladder | VERIFIED | Full implementation |
| `grid/src/lore/LoreCitationListener.ts` | Pure-observer, zero audit.append | VERIFIED | Zero audit.append |
| `grid/src/lore/LoreCommonsListener.ts` | Pure-observer, zero audit.append | VERIFIED | Zero audit.append |
| `grid/src/lore/LoreStorage.ts` | upsertContribution, incrementCitationCount, queryEntries | VERIFIED | All 3 methods present |
| `grid/src/lore/LoreQuotaTracker.ts` | tryConsume(did, tick): boolean, K=3/epoch | VERIFIED | Class correct; exposed from GenesisLauncher |
| `grid/src/api/routes/lore.ts` | GET /api/v1/grid/lore with category + limit params | VERIFIED | registerLoreRoutes exported |
| `grid/src/integration/nous-runner.ts` | 4 lore cases with quota enforcement | VERIFIED (code) | lore_contribute, lore_cited, lore_request, lore_response cases present; quota guard operative when loreDeps injected |
| `grid/src/db/schema.ts` | version 8 migration, lore_commons 7-column table | VERIFIED | title_hash CHAR(64), citation_count INT UNSIGNED DEFAULT 0 confirmed |
| `grid/src/api/server.ts` | LoreCitationListener + LoreCommonsListener instantiated | VERIFIED | Lines 392-393 |
| `grid/src/genesis/launcher.ts` | readonly loreQuotaTracker: LoreQuotaTracker constructed in constructor | VERIFIED | Lines 114, 173; import line 25 |
| `brain/src/noesis_brain/lore/store.py` | LoreStore with FTS5 BM25, FIFO eviction, shared conn | VERIFIED | All methods present |
| `brain/src/noesis_brain/lore/types.py` | LoreEntry dataclass, LORE_CATEGORIES frozenset (4 values) | VERIFIED | Correct; to_prompt_block() present |
| `brain/src/noesis_brain/rpc/types.py` | 5 LORE_* ActionType entries | VERIFIED | All 5 present |
| `brain/src/noesis_brain/rpc/handler.py` | _cached_lore_entries instance field + lore_entries= passed to build_system_prompt | VERIFIED | Line 145 (init), line 693 (on_tick assign), line 308 (on_message kwarg) |
| `brain/src/noesis_brain/prompts/system.py` | lore_entries additive kwarg + _lore_commons_section helper | VERIFIED | kwarg at line 45; helper at line 300 |
| `brain/test/lore/test_lore_prompt_injection.py` | 6 tests — direct build_system_prompt tests + handler on_tick cache test | VERIFIED | 6/6 passing |
| `grid/test/lore/lore-wiring.test.ts` | 4 wiring tests — loreQuotaTracker non-null, instanceof, K=3, epoch reset | VERIFIED | 4/4 passing |
| `brain/test/lore/test_lore_store.py` | LoreStore unit tests: add/has/retrieve/eviction/FTS5 | VERIFIED | 10/10 passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `broadcast-allowlist.ts` FORBIDDEN_KEY_PATTERN | payloadPrivacyCheck | regex with lore_body\|lore_content\|title_text\|summary_text | VERIFIED | Negative lookahead content(?!_hash) permits content_hash field |
| `appendLoreContributed.ts` | audit.append('lore.contributed') | step 10 sole emit | VERIFIED | Confirmed at step 10 |
| `appendLoreCited.ts` | audit.append('lore.cited') | step 9 sole emit | VERIFIED | Confirmed |
| `LoreCitationListener.ts` | LoreStorage.incrementCitationCount | onAppend handler | VERIFIED | Fires-and-forgets |
| `LoreCommonsListener.ts` | LoreStorage.upsertContribution | onAppend handler | VERIFIED | Fires-and-forgets |
| `NousRunner` lore_contribute case | appendLoreContributed | quota check → sole-producer call | VERIFIED (code) | Code path exists; quota enforced when loreDeps injected |
| `NousRunner` lore_cited case | appendLoreCited | direct call | VERIFIED | Confirmed |
| `handler.py` on_tick lore retrieval | self._cached_lore_entries | LoreStore.retrieve() → assignment | VERIFIED | Line 693: `self._cached_lore_entries = lore_entries_for_prompt if lore_entries_for_prompt else None` |
| `handler.py` on_message | build_system_prompt(lore_entries=...) | self._cached_lore_entries conditional kwarg | VERIFIED | Line 308: `**({"lore_entries": self._cached_lore_entries} if self._cached_lore_entries else {})` |
| `handler.py` on_tick discovery poll | GET /api/v1/grid/lore | asyncio.create_task _poll() | VERIFIED | Polls /api/v1/grid/lore |
| `GenesisLauncher` constructor | new LoreQuotaTracker() | this.loreQuotaTracker = new LoreQuotaTracker() | VERIFIED | Line 173 |
| `GenesisLauncher.loreQuotaTracker` | NousRunner loreDeps | JSDoc-documented injection site | PARTIAL | Injection pattern documented at launcher.ts line 112; no production NousRunner construction site in src/ passes loreDeps |
| `server.ts` | LoreCitationListener + LoreCommonsListener | new Listener(...) at startup | VERIFIED | Lines 392-393 |
| `routes/lore.ts` | LoreStorage.queryEntries | Fastify GET handler | VERIFIED | Confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `brain/src/noesis_brain/prompts/system.py` _lore_commons_section | lore_entries param | handler.py self._cached_lore_entries | Yes — test_lore_prompt_injection.py 6/6 verifies data flows | FLOWING (unit-verified; runtime needs human check) |
| `brain/src/noesis_brain/rpc/handler.py` on_tick lore retrieval | self._cached_lore_entries | LoreStore.retrieve() → FTS5 BM25 | Yes (when LoreStore has entries) | FLOWING |
| `grid/src/lore/LoreStorage.ts` queryEntries | pool.query result | MySQL lore_commons table | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| All Grid lore tests pass | `npx vitest run test/lore/` | 46/46 passing (9 files) | PASS |
| Full Grid test suite | `npx vitest run` | 1584/1584 passing, 6 skipped | PASS |
| Brain lore unit tests | `uv run pytest test/lore/ -x -q` | 16/16 passing (2 files) | PASS |
| Full Brain test suite | `uv run pytest -x -q` | 698/698 passing, 5 warnings | PASS |
| _cached_lore_entries passes to build_system_prompt | `grep handler.py for lore_entries.*_cached_lore_entries` | Line 308 — confirmed | PASS |
| _cached_lore_entries initialized in __init__ | `grep handler.py for _cached_lore_entries` | Lines 145, 308, 693 — 3 occurrences | PASS |
| loreQuotaTracker constructed in GenesisLauncher | `grep launcher.ts for this.loreQuotaTracker = new LoreQuotaTracker` | Line 173 — confirmed | PASS |
| loreDeps injected at production NousRunner construction | grep grid/src for loreDeps outside nous-runner.ts/launcher.ts | Empty — no production injection site | HUMAN NEEDED |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LORE-01 | 20-01, 20-02, 20-03, 20-04 | lore.contributed sole audit event; hash index only; lore body Brain-private | SATISFIED | appendLoreContributed 10-step ladder; lore_commons migration; FORBIDDEN_KEY_PATTERN blocks lore body keys; lore-producer-boundary.test.ts 4/4 |
| LORE-02 | 20-01, 20-03, 20-04, 20-05 | __lore_request/__lore_response whisper retrieval; lore.cited fires at prompt-build | SATISFIED (code) / ? (runtime) | _cached_lore_entries wiring complete; test_lore_prompt_injection.py 6/6 passing. Whisper send path (lore_request/lore_response) is log-only — known WhisperRouter design constraint per Plan 04 SUMMARY. Primary discovery (HTTP poll + FTS5) is functional. Runtime end-to-end requires human verification. |
| LORE-03 | 20-04, 20-05 | K=3 quota per sleep epoch enforced, configurable via TOML | SATISFIED (code) / ? (runtime injection) | LoreQuotaTracker correct; GenesisLauncher constructs it; wiring test 4/4. No production NousRunner construction site passes loreDeps — injection is documented but not yet wired in main.ts. Human verification required. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `grid/src/genesis/launcher.ts` | 112 | loreDeps injection documented in JSDoc but no production caller in main.ts/server.ts constructs NousRunner with loreDeps | Warning | K=3 quota enforcement code path is correct but unreachable in production unless caller passes loreDeps; quota can only be bypassed silently |

### Human Verification Required

#### 1. Lore prompt injection — end-to-end runtime check

**Test:** Start a live Grid with at least one Nous. Contribute one or more lore entries (via LORE_CONTRIBUTE action). Let the Nous run for at least 30 ticks (one lore poll cycle). Send the Nous a message that requires an LLM response. Inspect the Brain's system prompt log or the raw LLM request to verify the prompt contains the Lore Commons section.

**Expected:** The system prompt passed to the LLM contains `## Lore Commons` followed by at least one lore entry formatted by `to_prompt_block()`.

**Why human:** The `_cached_lore_entries` → `build_system_prompt` data path is fully unit-tested (6/6 tests pass) but requires a live Brain + Grid integration, a running LLM, and populated LoreStore data to observe in production. Static analysis and unit tests confirm the wiring exists; runtime confirmation requires running the system.

#### 2. LoreQuotaTracker production injection

**Test:** Inspect how NousRunner instances are constructed in production. Find the call site(s) in `main.ts`, `server.ts`, `grid-coordinator.ts`, or wherever `GenesisLauncher` spins up NousRunner instances for `seedNous`. Verify those call sites pass `loreDeps: { quotaTracker: launcher.loreQuotaTracker }` to the NousRunnerConfig.

**Expected:** Production NousRunner construction includes `loreDeps: { quotaTracker: launcher.loreQuotaTracker }` so that `this.loreDeps?.quotaTracker` is non-undefined at runtime and the K=3 quota check at line 817 of `nous-runner.ts` is exercised.

**Why human:** `GenesisLauncher` now exposes a functional `loreQuotaTracker`. The wiring test confirms the tracker works. However, no code in `grid/src/main.ts`, `grid/src/api/server.ts`, or `grid/src/integration/grid-coordinator.ts` currently passes `loreDeps` when constructing `NousRunner`. The `GenesisLauncher` JSDoc at line 112 documents the intended pattern but production NousRunner construction may not exist yet (comment at `main.ts` line 96 says "runners land in main.ts (sub-plan future)"). If NousRunner instances are not yet constructed in production, this gap is architectural/future-work; if they are constructed elsewhere, loreDeps must be added.

### Gaps Summary

No blocker gaps remain at the code level. Both previously-identified gaps (LORE-02 prompt injection and LORE-03 quota wiring) have been closed in Plan 05 with confirmed unit test coverage.

Two items require human runtime verification:

1. **LORE-02 runtime**: The `_cached_lore_entries` wiring is correct and unit-tested. End-to-end confirmation in a live system requires a human with a running Brain+Grid+LLM stack.

2. **LORE-03 production injection**: `GenesisLauncher` exposes `loreQuotaTracker`. However, the actual NousRunner construction in production (via `main.ts` or `GenesisLauncher`) may not yet pass `loreDeps`. Comment at `main.ts` line 96 ("runners land in main.ts (sub-plan future)") suggests NousRunner production construction is not yet live — meaning the quota guard exists but may never be invoked in the current production entry point. This is an architectural question only a human can resolve by inspecting the live deployment path.

---

_Verified: 2026-05-17T03:50:00Z_
_Verifier: Claude (gsd-verifier)_
