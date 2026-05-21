---
phase: 25a
plan: "01"
subsystem: grid/audit, grid/util, grid/api/operator, scripts
tags: [foundation, ci-gate, plaintext-leak-prevention, forbidden-key-pattern, ring-buffer]
requires: []
provides:
  - FORBIDDEN_KEY_PATTERN extended with reflexion_text|creed_text|whisper_plaintext
  - RingBuffer.peek() non-destructive snapshot API
  - brain-http-errors.ts shared error module
  - check-cognitive-snapshot-plaintext.mjs CI gate
affects:
  - Plans 25a-02 through 25a-06 (all consume these primitives)
tech-stack:
  added: []
  patterns:
    - Explicit named alternates in FORBIDDEN_KEY_PATTERN (structural grep-ability over behavioral sufficiency)
    - Re-export pattern for backward-compatible module extraction
    - Property-key position regex for CI plaintext gate
key-files:
  created:
    - grid/src/api/operator/brain-http-errors.ts
    - grid/test/audit/forbidden-key-pattern.test.ts
    - grid/test/util/ring-buffer.test.ts
    - scripts/check-cognitive-snapshot-plaintext.mjs
  modified:
    - grid/src/audit/broadcast-allowlist.ts (FORBIDDEN_KEY_PATTERN line 421)
    - grid/src/util/ring-buffer.ts (peek() method added)
    - grid/src/api/operator/brain-hash-state-client.ts (classes extracted, re-exported)
decisions:
  - "D-25a-05: reflexion_text|creed_text|whisper_plaintext added as explicit named alternates (not relying on substring match via 'text'/'plaintext') for structural grep-ability in CI"
  - "skill_title NOT added to FORBIDDEN_KEY_PATTERN per D-25a-05 explicit exemption"
  - "brain-http-errors.ts extraction uses re-export from brain-hash-state-client.ts to preserve all existing import paths without changes to callers"
  - "CI script uses property-key-position regex to avoid false positives on variable names"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 3
---

# Phase 25a Plan 01: Foundation Summary

**One-liner:** Explicit FORBIDDEN_KEY_PATTERN extensions for 3 cognitive-snapshot keys + RingBuffer.peek() + shared Brain error module + CI plaintext gate script.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extend FORBIDDEN_KEY_PATTERN + add RingBuffer.peek() | ce6dbdc | broadcast-allowlist.ts, ring-buffer.ts, 2 test files |
| 2 | Extract shared Brain HTTP error classes | 932d7c3 | brain-http-errors.ts, brain-hash-state-client.ts |
| 3 | Ship check-cognitive-snapshot-plaintext.mjs CI gate | 497b440 | scripts/check-cognitive-snapshot-plaintext.mjs |

## Artifacts

### Final FORBIDDEN_KEY_PATTERN (grid/src/audit/broadcast-allowlist.ts line 421)

```
/prompt|response|wiki|reflection|thought|emotion_delta|hunger|curiosity|safety|boredom|loneliness|drive_value|energy|sustenance|need_value|bios_value|subjective_multiplier|chronos_multiplier|subjective_tick|text|body|content(?!_hash)|message|utterance|plaintext|decrypted|payload_plain|description|rationale|proposal_text|law_text|body_text|weight|reputation|relationship_score|ousia_weight|belief_content|target_content|emotion_text|dimension_text|belief_prose|iris_content|ltm_content|concept_text|graph_data|episode_text|node_content|edge_content|skill_body|skill_text|rule_text|norm_text|fingerprint_text|rule_content|lore_body|lore_content|title_text|summary_text|reflexion_text|creed_text|whisper_plaintext/i
```

New additions appended after `summary_text`: `reflexion_text|creed_text|whisper_plaintext`

### RingBuffer.peek() Signature (grid/src/util/ring-buffer.ts)

```typescript
peek(): readonly T[]
```

Non-destructive snapshot in FIFO order. Returns `[...this.items]` (defensive copy). Used by DriftDetector polling. Unlike `drain()`, does not empty the buffer.

### brain-http-errors.ts Module (grid/src/api/operator/brain-http-errors.ts)

Exports:
- `BrainUnreachableError` — Brain was unreachable or timed out
- `BrainUnknownDidError` — Brain returned non-200 status for a DID
- `BrainMalformedResponseError` — Brain returned 200 but invalid body schema

`brain-hash-state-client.ts` re-exports all three, preserving all existing import paths.

### CI Script — check-cognitive-snapshot-plaintext.mjs

**Scan globs:**
- `brain/src/noesis_brain/http/**/*.py`
- `brain/test/test_cognitive_snapshot*.py`
- `grid/src/api/operator/cognitive-snapshot*.ts`
- `grid/test/operator/cognitive-snapshot*.test.ts`

**FORBIDDEN_KEYS:**
```
reflexion_text, rule_text, creed_text, skill_body, lore_body, whisper_plaintext
```

**Exemption:** `skill_title` — D-25a-05 explicit exception, documented in script comment. Never add it.

**Exit semantics:** Exit 0 on clean; exit 1 with scope/file/line/key report on violation.

**Status at HEAD:** Exit 0 (no cognitive-snapshot files exist yet).

## Decision IDs Implemented

- **D-25a-05** (forbidden-key gate): Three new keys added as explicit named alternates in FORBIDDEN_KEY_PATTERN for grep-ability. skill_title explicitly excluded. CI script enforces gate across Brain (Python) and Grid (TypeScript) cognitive-snapshot surface.

## Deviations from Plan

### Observation: FORBIDDEN_KEY_PATTERN already matched new keys via substring

The existing regex contained `text` and `plaintext` as alternates, which already matched `reflexion_text`, `creed_text`, and `whisper_plaintext` via substring. The plan's acceptance criteria required explicit grep-level evidence (`grep -n "reflexion_text" broadcast-allowlist.ts` must return a match), so the explicit named alternates were added regardless. This is the correct behavior — structural grep-ability over behavioral sufficiency.

Otherwise: plan executed exactly as written.

## Known Stubs

None — this plan ships primitives only; no UI or data-flow stubs.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries beyond what the plan's threat model already covers.

## Self-Check: PASSED

All created files present on disk. All three task commits verified in git log (ce6dbdc, 932d7c3, 497b440).
