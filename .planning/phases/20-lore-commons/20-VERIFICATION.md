---
phase: 20-lore-commons
verified: 2026-05-17T02:30:00Z
status: gaps_found
score: 6/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "lore.cited fires when a Nous references lore at prompt-build time"
    status: failed
    reason: "lore_entries_for_prompt is computed in on_tick() via LoreStore.retrieve() but is never passed to build_system_prompt(). The lore_entries kwarg exists in system.py and _lore_commons_section() is implemented, but the call site at line 298 (on_message) does not include lore_entries=lore_entries_for_prompt. Lore content is never actually injected into the Nous system prompt — the primary purpose of LORE-02 (collective knowledge visible at prompt-build) is not achieved."
    artifacts:
      - path: "brain/src/noesis_brain/rpc/handler.py"
        issue: "lore_entries_for_prompt (line 679) is populated but never passed to build_system_prompt (line 298, located in on_message not on_tick). The on_tick path has no build_system_prompt call. LORE_CITED actions are queued (citation counting works), but lore content is absent from the prompt."
      - path: "brain/src/noesis_brain/prompts/system.py"
        issue: "lore_entries kwarg (line 45) and _lore_commons_section helper (line 300) exist and are correct — but they are never called with real data."
    missing:
      - "Pass lore_entries_for_prompt to the build_system_prompt call site. Since on_tick does not currently call build_system_prompt, the lore injection must be integrated into the on_tick prompt-build flow (e.g., in the LLM call path inside on_tick, or by making the on_tick lore retrieval available to the on_message build_system_prompt call via instance state)."
      - "Add a test asserting that when LoreStore contains entries, build_system_prompt output includes '## Lore Commons'."

  - truth: "LoreQuotaTracker enforces K=3 per sleep epoch — quota applied at runtime"
    status: partial
    reason: "LoreQuotaTracker.ts is implemented correctly and tested. NousRunner has quota enforcement code. However loreDeps (which carries the quotaTracker) is an optional dependency that is never constructed or injected by GenesisLauncher or any Grid startup code. grep across all of grid/src/ (excluding nous-runner.ts and LoreQuotaTracker.ts) finds zero references to loreDeps or LoreQuotaTracker. At runtime, this.loreDeps is always undefined, the quota check is silently skipped, and K=3 is never enforced."
    artifacts:
      - path: "grid/src/integration/nous-runner.ts"
        issue: "loreDeps?.quotaTracker is optional (line 817). The tryConsume call is guarded: 'if (quotaTracker && !quotaTracker.tryConsume(...))'. If loreDeps is not injected, quotaTracker is undefined and the block is skipped entirely."
      - path: "grid/src/api/server.ts"
        issue: "No LoreQuotaTracker is constructed or passed to NousRunnerConfig here."
    missing:
      - "Construct LoreQuotaTracker in GenesisLauncher (or server.ts / wherever NousRunner is instantiated) and pass it as loreDeps: { quotaTracker } to NousRunnerConfig."
      - "Add an integration test or grep test verifying that loreDeps is non-null in production NousRunner construction."
deferred: []
---

# Phase 20: Lore Commons Verification Report

**Phase Goal:** Implement the lore commons subsystem — a shared knowledge layer that allows Nous instances to contribute, discover, and cite distilled knowledge (lore) so the collective gains wisdom that outlasts any single Nous's memory window.
**Verified:** 2026-05-17T02:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | FORBIDDEN_KEY_PATTERN extended with lore_body\|lore_content\|title_text\|summary_text; LORE_FORBIDDEN_KEYS exported (4 keys) | VERIFIED | broadcast-allowlist.ts line 412 shows the regex with all 4 keys; line 335-340 exports LORE_FORBIDDEN_KEYS constant |
| 2 | ALLOWLIST_MEMBERS has exactly 43 entries (lore.contributed at pos 42, lore.cited at pos 43) | VERIFIED | Lines 172-173 of broadcast-allowlist.ts; lore-allowlist.test.ts 4/4 passing |
| 3 | grid/src/lore/types.ts exports LoreContributedPayload, LoreCitedPayload, LORE_CONTRIBUTED_KEYS, LORE_CITED_KEYS, DEFAULT_LORE_CATEGORIES, VALID_LORE_CATEGORIES | VERIFIED | All 6 exports confirmed in types.ts |
| 4 | MySQL migration version 8 (create_lore_commons) exists with 7-column table including title_hash CHAR(64) and citation_count INT UNSIGNED | VERIFIED | schema.ts lines 176-193; lore-migration.test.ts 8/8 passing |
| 5 | appendLoreContributed.ts and appendLoreCited.ts implement 10/9-step validation ladders as sole producers | VERIFIED | Both files implement full ladders; lore-producer-boundary.test.ts 4/4 passing; appendLoreContributed.test.ts 8/8, appendLoreCited.test.ts 7/7 passing |
| 6 | LoreCitationListener and LoreCommonsListener are pure-observers (zero audit.append); instantiated in server.ts; REST endpoint GET /api/v1/grid/lore registered | VERIFIED | No audit.append in listener bodies; server.ts lines 392-394 instantiate both; routes/lore.ts implements endpoint; lore-citation-listener.test.ts 2/2 passing |
| 7 | lore.cited fires when a Nous references lore at prompt-build time | FAILED | lore_entries_for_prompt is populated in on_tick() (handler.py line 679) from LoreStore.retrieve() but is never passed to build_system_prompt(). The only build_system_prompt call is in on_message() (line 298). Lore content is not injected into the system prompt. LORE_CITED actions are queued (citation_count increments) but the collective knowledge is not visible to the Nous at reasoning time. |
| 8 | LoreQuotaTracker enforces K=3 per sleep epoch at runtime | PARTIAL | LoreQuotaTracker is implemented and tested (lore-quota.test.ts 5/5). NousRunner has quota enforcement code. However loreDeps is never constructed or injected by any startup code — quotaTracker is always undefined at runtime and the quota check is silently bypassed. |

**Score:** 6/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/broadcast-allowlist.ts` | LORE_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN + ALLOWLIST_MEMBERS[41,42] | VERIFIED | All present; content(?!_hash) negative lookahead correctly permits content_hash |
| `grid/src/lore/types.ts` | 6 locked exports | VERIFIED | All 6 exports present with correct alphabetical key order |
| `grid/src/lore/appendLoreContributed.ts` | Sole producer, 10-step ladder | VERIFIED | Full implementation; exports LORE_CONTRIBUTED_EVENT constant for listener import |
| `grid/src/lore/appendLoreCited.ts` | Sole producer, 9-step ladder | VERIFIED | Full implementation; exports LORE_CITED_EVENT constant |
| `grid/src/lore/LoreCitationListener.ts` | Pure-observer, zero audit.append | VERIFIED | Zero audit.append; fires-and-forgets incrementCitationCount |
| `grid/src/lore/LoreCommonsListener.ts` | Pure-observer, zero audit.append | VERIFIED | Zero audit.append; fires-and-forgets upsertContribution |
| `grid/src/lore/LoreStorage.ts` | upsertContribution, incrementCitationCount, queryEntries | VERIFIED | All 3 methods present; INSERT IGNORE and citation_count + 1 UPDATE confirmed |
| `grid/src/lore/LoreQuotaTracker.ts` | tryConsume(did, tick): boolean, K=3/epoch | VERIFIED (artifact) | Class exists and is correct; PARTIAL (wiring) — never injected at runtime |
| `grid/src/api/routes/lore.ts` | GET /api/v1/grid/lore with category + limit params | VERIFIED | registerLoreRoutes exported; VALID_LORE_CATEGORIES validation; 400/500 responses |
| `grid/src/integration/nous-runner.ts` | 4 lore cases with quota enforcement | PARTIAL | lore_contribute, lore_cited, lore_request, lore_response cases present; lore_request/lore_response are log-only (expected — WhisperRouter constraint); quota check present but loreDeps never injected |
| `grid/src/db/schema.ts` | version 8 migration, lore_commons 7-column table | VERIFIED | title_hash CHAR(64), citation_count INT UNSIGNED DEFAULT 0 confirmed |
| `grid/src/api/server.ts` | LoreCitationListener + LoreCommonsListener instantiated | VERIFIED | Lines 392-393 instantiate both listeners |
| `brain/src/noesis_brain/lore/store.py` | LoreStore with FTS5 BM25, FIFO eviction, shared conn | VERIFIED | All methods present; FTS5 triggers correct; shared MemoryStore._conn confirmed |
| `brain/src/noesis_brain/lore/types.py` | LoreEntry dataclass, LORE_CATEGORIES frozenset (4 values) | VERIFIED | Correct; to_prompt_block() method present |
| `brain/src/noesis_brain/rpc/types.py` | 5 LORE_* ActionType entries | VERIFIED | LORE_CONTRIBUTE, LORE_CITED, LORE_DISCOVER, LORE_REQUEST, LORE_RESPONSE all present |
| `brain/src/noesis_brain/rpc/handler.py` | __lore_request:/__lore_response: prefix dispatch + discovery poll + prompt injection | PARTIAL | Prefix dispatch (on_message) and discovery poll (on_tick) are implemented. Prompt injection code exists in on_tick but lore_entries_for_prompt is never passed to build_system_prompt. |
| `brain/src/noesis_brain/prompts/system.py` | lore_entries additive kwarg + _lore_commons_section helper | VERIFIED (artifact) | kwarg present at line 45; _lore_commons_section at line 300. PARTIAL (wiring) — never called with real data. |
| `brain/test/lore/test_lore_store.py` | LoreStore unit tests: add/has/retrieve/eviction/FTS5 | VERIFIED | 10/10 tests passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `broadcast-allowlist.ts` FORBIDDEN_KEY_PATTERN | payloadPrivacyCheck | regex with lore_body\|lore_content\|title_text\|summary_text | VERIFIED | content(?!_hash) negative lookahead allows content_hash field |
| `appendLoreContributed.ts` | audit.append('lore.contributed') | step 10 sole emit | VERIFIED | Confirmed at line 76 |
| `appendLoreCited.ts` | audit.append('lore.cited') | step 9 sole emit | VERIFIED | Confirmed at line 76 |
| `LoreCitationListener.ts` | LoreStorage.incrementCitationCount | onAppend handler | VERIFIED | Line 28; fires-and-forgets |
| `LoreCommonsListener.ts` | LoreStorage.upsertContribution | onAppend handler | VERIFIED | Line 45; fires-and-forgets |
| `NousRunner` lore_contribute case | appendLoreContributed | quota check → sole-producer call | PARTIAL | Code path exists; quota check is dead (loreDeps never injected) |
| `NousRunner` lore_cited case | appendLoreCited | direct call | VERIFIED | Line 844+ |
| `NousRunner` lore_request/lore_response | whisperRouter.sendWhisper | log-only; WhisperRouter is pre-encrypted-only | PARTIAL | Known design limitation (Plan 04 SUMMARY). Whisper-based Nous-to-Nous retrieval cannot complete end-to-end. Brain on_message() receive path exists. |
| `handler.py` on_tick discovery poll | GET /api/v1/grid/lore | asyncio.create_task _poll() | VERIFIED | Lines 643-673; polls /api/v1/grid/lore |
| `handler.py` on_tick lore injection | build_system_prompt(lore_entries=...) | lore_entries_for_prompt variable | NOT_WIRED | lore_entries_for_prompt is computed but never passed to build_system_prompt |
| `server.ts` | LoreCitationListener + LoreCommonsListener | new Listener(...) at startup | VERIFIED | Lines 392-393 |
| `routes/lore.ts` | LoreStorage.queryEntries | Fastify GET handler | VERIFIED | Line 30 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `brain/src/noesis_brain/prompts/system.py` _lore_commons_section | lore_entries param | handler.py lore_entries_for_prompt | No — variable computed but never passed | HOLLOW — kwarg exists but no data flows to it |
| `brain/src/noesis_brain/rpc/handler.py` on_tick lore poll | pending_actions list | asyncio GET /api/v1/grid/lore → LORE_REQUEST actions | Yes (when grid_base_url set) | FLOWING (discovery works; retrieval delivery is blocked) |
| `grid/src/lore/LoreStorage.ts` queryEntries | pool.query result | MySQL lore_commons table | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| All Grid lore tests pass | `npx vitest run test/lore/` | 42/42 passing (8 files) | PASS |
| Full Grid test suite | `npx vitest run` | 1580/1580 passing, 6 skipped | PASS |
| Brain lore unit tests | `uv run pytest test/lore/ -x -q` | 10/10 passing | PASS |
| Full Brain test suite | `uv run pytest -x -q` | 692/692 passing, 5 warnings | PASS |
| lore_entries_for_prompt passes to build_system_prompt | grep handler.py for build_system_prompt(...lore_entries...) | Not found — variable computed but not passed | FAIL |
| loreDeps injected at Grid startup | grep grid/src for LoreQuotaTracker construction outside LoreQuotaTracker.ts and nous-runner.ts | Empty — no injection site | FAIL |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LORE-01 | 20-01, 20-02, 20-03 | lore.contributed sole audit event; hash index only; lore body Brain-private | SATISFIED | appendLoreContributed 10-step ladder; lore_commons migration; FORBIDDEN_KEY_PATTERN blocks lore body keys; lore-producer-boundary.test.ts 4/4 |
| LORE-02 | 20-01, 20-03, 20-04 | __lore_request/__lore_response whisper retrieval; lore.cited fires at prompt-build | PARTIAL | Receive-side prefix dispatch implemented (handler.py on_message). Whisper send (NousRunner lore_request/lore_response) is log-only — full end-to-end retrieval non-functional. Prompt injection: lore_entries_for_prompt computed but not passed to build_system_prompt — lore.cited actions are queued but lore content is absent from the Nous's LLM context. |
| LORE-03 | 20-04 | K=3 quota per sleep epoch enforced, configurable via TOML | PARTIAL | LoreQuotaTracker implements correct logic; NousRunner has enforcement code; loreDeps never injected at startup so quota is silently bypassed at runtime |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `brain/src/noesis_brain/rpc/handler.py` | 679-688 | lore_entries_for_prompt computed but never consumed for prompt injection | Blocker | Collective lore knowledge is never visible to the Nous's LLM; D-20-02 and LORE-02 not achieved |
| `grid/src/integration/nous-runner.ts` | 817 | `if (quotaTracker && ...)` — quotaTracker always undefined at runtime | Blocker | LORE-03 quota enforcement silently bypassed in production; lore flooding possible |

### Human Verification Required

None — all gaps are programmatically verifiable.

### Gaps Summary

**Gap 1 — Lore prompt injection (LORE-02 partial failure):**

`lore_entries_for_prompt` is populated at handler.py line 679 using `LoreStore.retrieve(telos_text, k=3)`. This variable is then used only to queue `LORE_CITED` actions (so `citation_count` increments correctly in the Grid hash index). However, the purpose of D-20-02 is that retrieved lore entries are **injected into the Nous system prompt** so the Nous has access to collective knowledge during LLM reasoning.

The `build_system_prompt` function at line 298 is called only in `on_message`, not in `on_tick`. The `on_tick` path that computes `lore_entries_for_prompt` never calls `build_system_prompt`. The `lore_entries` kwarg exists in `system.py` and `_lore_commons_section()` is implemented — but zero data ever flows to them.

The fix requires either: (a) passing `lore_entries_for_prompt` to the existing `build_system_prompt` call in `on_message` (via instance state or a session-scoped cache), or (b) adding a `build_system_prompt` call in the `on_tick` autonomous action path.

**Gap 2 — LoreQuotaTracker not wired at startup (LORE-03 partial failure):**

`LoreQuotaTracker` is a correct, tested class. `NousRunner` has the enforcement code. But `loreDeps` is an optional field in `NousRunnerConfig` with no construction site anywhere in the codebase outside of test code. `GenesisLauncher` / `server.ts` / `genesis.ts` (wherever `NousRunner` is instantiated for production) do not create a `LoreQuotaTracker` or pass it as `loreDeps`. At runtime, `this.loreDeps` is always `undefined`, the guard `if (quotaTracker && ...)` evaluates false, and no quota is enforced.

The fix requires constructing `new LoreQuotaTracker()` at Grid startup and injecting it as `loreDeps: { quotaTracker }` in the NousRunner configuration.

**Note on lore_request / lore_response dispatch:** The Plan 04 SUMMARY documents this as a known architectural constraint — WhisperRouter only handles pre-encrypted envelopes and cannot deliver plaintext lore discovery messages. The Brain's on_message() receive handlers for both prefixes are implemented and functional. The gap is that the send side (NousRunner lore_request case) cannot actually deliver the message to the peer, making end-to-end Nous-to-Nous lore content retrieval non-functional. This is a LORE-02 partial failure but is scoped to a known infrastructure gap with the current WhisperRouter design. The primary discovery path (Brain HTTP polling GET /api/v1/grid/lore) is functional.

---

_Verified: 2026-05-17T02:30:00Z_
_Verifier: Claude (gsd-verifier)_
