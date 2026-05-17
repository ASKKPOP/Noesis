---
phase: 20-lore-commons
plan: "01"
subsystem: lore
tags: [privacy-gate, allowlist, types-contract, tdd-red, wave-0]
dependency_graph:
  requires: []
  provides:
    - LORE_FORBIDDEN_KEYS exported from broadcast-allowlist.ts
    - FORBIDDEN_KEY_PATTERN extended with 4 lore keys
    - grid/src/lore/types.ts (LoreContributedPayload, LoreCitedPayload, LORE_CONTRIBUTED_KEYS, LORE_CITED_KEYS, DEFAULT_LORE_CATEGORIES, VALID_LORE_CATEGORIES)
    - Six RED test stubs in grid/test/lore/ (Wave 0 gate)
  affects:
    - payloadPrivacyCheck (broadcast-allowlist.ts) — now rejects lore_body|lore_content|title_text|summary_text
    - Plans 02-04 — must make RED stubs GREEN
tech_stack:
  added: []
  patterns:
    - FORBIDDEN_KEY_PATTERN extension (append-only, prior Phase entries preserved)
    - Locked-key-tuple types pattern (mirrors skills/types.ts, norms/types.ts)
    - Wave 0 RED gate stub pattern (mirrors Phase 18/19 baseline tests)
key_files:
  modified:
    - grid/src/audit/broadcast-allowlist.ts
  created:
    - grid/src/lore/types.ts
    - grid/src/lore/index.ts
    - grid/test/lore/lore-allowlist-baseline.test.ts
    - grid/test/lore/lore-producer-boundary.test.ts
    - grid/test/lore/appendLoreContributed.test.ts
    - grid/test/lore/appendLoreCited.test.ts
    - grid/test/lore/lore-migration.test.ts
    - grid/test/lore/lore-citation-listener.test.ts
decisions:
  - "LORE_FORBIDDEN_KEYS placed after NORM_FORBIDDEN_KEYS block — consistent with Phase 18/19 pattern"
  - "FORBIDDEN_KEY_PATTERN extended append-only — tail grows, prior Phase entries untouched"
  - "__lore_request:/__lore_response: documented in WHISPER_FORBIDDEN_KEYS JSDoc only (not array entries) per D-20-13"
  - "index.ts barrel export created referencing future Plan 03-04 files — intentional forward reference"
  - "lore-producer-boundary.test.ts currently fails because lore strings appear in types.ts JSDoc — expected RED state until Plan 03 emitters land"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 8
---

# Phase 20 Plan 01: Wave 0 Safety Gate and Types Contract Summary

**One-liner:** Privacy guardrail extension with 4 lore forbidden keys and locked-tuple type contracts for lore.contributed/lore.cited sole-producer emitters.

## What Was Built

### Task 1 — Extend broadcast-allowlist.ts and create lore types

**`grid/src/audit/broadcast-allowlist.ts`** — Three changes:

1. Added `LORE_FORBIDDEN_KEYS` constant (4 keys: `lore_body`, `lore_content`, `title_text`, `summary_text`) after the `NORM_FORBIDDEN_KEYS` block, following the exact same pattern as Phase 18/19 forbidden-key constants.

2. Extended `FORBIDDEN_KEY_PATTERN` regex by appending `|lore_body|lore_content|title_text|summary_text` immediately before the closing `/i`. Prior Phase entries are untouched.

3. Updated `WHISPER_FORBIDDEN_KEYS` JSDoc to note that `__lore_request:` and `__lore_response:` are Brain-internal prefixes, NOT payload field names, and are NOT added to the array per D-20-13 / RESEARCH.md §8.

**`grid/src/lore/types.ts`** — New file with 6 locked exports (D-20-12):
- `LoreContributedPayload` interface (4 keys alphabetical: category_tag, content_hash, contributor_did, tick)
- `LoreCitedPayload` interface (3 keys alphabetical: citing_did, content_hash, tick)
- `LORE_CONTRIBUTED_KEYS` locked tuple
- `LORE_CITED_KEYS` locked tuple
- `DEFAULT_LORE_CATEGORIES` Set (cultural, historical, observation, synthesis)
- `VALID_LORE_CATEGORIES` mutable Set (GenesisLauncher overwrites at startup from TOML)

**`grid/src/lore/index.ts`** — Barrel export referencing future Plan 03-04 files (appendLoreContributed, appendLoreCited, LoreCitationListener, LoreCommonsListener, LoreStorage).

### Task 2 — Create 6 RED test stubs (Wave 0 gate)

| File | Status | Becomes GREEN |
|------|--------|---------------|
| `lore-allowlist-baseline.test.ts` | GREEN (passes immediately) | N/A — Wave 0 gate |
| `lore-producer-boundary.test.ts` | RED (emitters missing) | Plan 03 |
| `appendLoreContributed.test.ts` | RED (import fails) | Plan 03 |
| `appendLoreCited.test.ts` | RED (import fails) | Plan 03 |
| `lore-migration.test.ts` | RED (no v8 migration) | Plan 02 |
| `lore-citation-listener.test.ts` | RED (import fails) | Plan 04 |

## Verification Results

```
✓ lore-allowlist-baseline.test.ts — 2/2 passing
  ✓ allowlist has exactly 41 events before lore additions
  ✓ position 41 is norm.crystallized (last Phase 19 event)
```

ALLOWLIST_MEMBERS remains at exactly 41 entries — `lore.contributed` and `lore.cited` are NOT added yet (Wave 3, Plan 04).

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced in this plan. The FORBIDDEN_KEY_PATTERN extension adds a defensive privacy gate (reduces attack surface, does not expand it). T-20-01 (Information Disclosure via broadcast payload) is now mitigated by the FORBIDDEN_KEY_PATTERN extension.

## Self-Check: PASSED

Files exist:
- grid/src/audit/broadcast-allowlist.ts: MODIFIED
- grid/src/lore/types.ts: CREATED
- grid/src/lore/index.ts: CREATED
- grid/test/lore/lore-allowlist-baseline.test.ts: CREATED
- grid/test/lore/lore-producer-boundary.test.ts: CREATED
- grid/test/lore/appendLoreContributed.test.ts: CREATED
- grid/test/lore/appendLoreCited.test.ts: CREATED
- grid/test/lore/lore-migration.test.ts: CREATED
- grid/test/lore/lore-citation-listener.test.ts: CREATED

Commits exist:
- 00b95fd: feat(20-01): extend broadcast-allowlist with LORE_FORBIDDEN_KEYS and create lore types contract
- 6b3ab1b: test(20-01): create Wave 0 RED gate stubs for lore commons
