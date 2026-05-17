---
phase: 01-auditchain-listener-api-broadcast-allowlist
plan: 03
subsystem: infra
tags: [sovereignty, allowlist, privacy, broadcast, audit]

requires: []
provides:
  - Default-deny broadcast allowlist (ReadonlySet<string>, 10 locked v1 event types)
  - isAllowlisted() membership check
  - FORBIDDEN_KEY_PATTERN regex for sovereignty-forbidden payload keys
  - payloadPrivacyCheck() recursive walker returning first-match dotted path
  - Runtime-hardened ALLOWLIST (add/delete/clear throw TypeError)
affects:
  - phase-02-websocket-broadcaster
  - any-future-phase-adding-audit-event-types

tech-stack:
  added: []
  patterns:
    - "Default-deny sovereignty boundary module (pure utility, no AuditChain coupling)"
    - "Frozen ReadonlySet pattern with mutation-method override for runtime enforcement"
    - "Case-insensitive substring regex for forbidden payload keys"
    - "Dotted path reporting for nested violation localization"

key-files:
  created:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/test/broadcast-allowlist.test.ts
  modified: []

key-decisions:
  - "Kept broadcast-allowlist independent of AuditChain — no dev-mode assert inside append() — so Phase 2 WsHub can invert the dependency cleanly at the broadcast seam"
  - "Hardened ALLOWLIST runtime immutability by overriding add/delete/clear to throw TypeError, because Object.freeze alone does not prevent Set mutation methods"
  - "Regex matches substrings (user_prompt, prompting) by design — chosen over word-boundary match to catch producer-side variants of forbidden keys"

patterns-established:
  - "Sovereignty enforcement modules cite PHILOSOPHY.md sections in header comments so future contributors see the rationale at decision point"
  - "Privacy linters return structured {ok, offendingPath, offendingKeyword} rather than booleans — enables actionable error messages at the broadcaster seam"

requirements-completed: [INFRA-02]

duration: 4min
completed: 2026-04-17
---

# Phase 01 Plan 03: Broadcast Allowlist Summary

**Default-deny broadcast allowlist module with recursive payload privacy lint, enforcing Noēsis's sovereignty invariant at the Grid process boundary before any network code exists.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-17T23:40:00Z (approx)
- **Completed:** 2026-04-17T23:44:38Z
- **Tasks:** 1
- **Files modified:** 2 (both newly created)

## Accomplishments

- Shipped `grid/src/audit/broadcast-allowlist.ts` — the sole enforcement point for PHILOSOPHY.md §1, §4, §7 sovereignty invariants
- Locked the exact v1 allowlist (10 event types) in a frozen `ReadonlySet<string>` with runtime-hardened mutation guards
- Delivered `payloadPrivacyCheck()` that recursively walks objects and arrays, returning dotted paths on first violation
- 32 individual test assertions covering default-deny membership, frozen-mutation, case-insensitivity, nested/array traversal, and every forbidden keyword
- Zero coupling to AuditChain — the module is a pure utility ready for Phase 2 WsHub to consume at the broadcast seam

## Final ALLOWLIST Membership (v1, locked)

Exactly 10 event types, case-sensitive, default-deny for everything else:

```
nous.spawned
nous.moved
nous.spoke
nous.direct_message   (metadata only — body must never appear)
trade.proposed
trade.settled
law.triggered
tick
grid.started
grid.stopped
```

## Forbidden-Key Regex (as implemented)

```javascript
/prompt|response|wiki|reflection|thought|emotion_delta/i
```

- Matches anywhere in key (substring, not word-boundary): `user_prompt`, `Prompting`, `RESPONSE`, `WiKi` all fail
- Case-insensitive via `/i` flag
- Walks nested objects and arrays; arrays produce numeric path segments (e.g., `history.0.thought`)

## Task Commits

1. **Task 1 RED: failing test suite** — `f34b241` (test)
2. **Task 1 GREEN: module implementation** — `29c3516` (feat)

_TDD cycle: failing test committed first, implementation second. No REFACTOR commit needed — the module was clean on first pass._

## Files Created/Modified

- `grid/src/audit/broadcast-allowlist.ts` (created) — ALLOWLIST, isAllowlisted, FORBIDDEN_KEY_PATTERN, PrivacyCheckResult, payloadPrivacyCheck, plus frozen-set hardening helper
- `grid/test/broadcast-allowlist.test.ts` (created) — 32 assertions across 2 describe blocks

## Decisions Made

- **Dev-mode assert inside `append()` explicitly deferred.** 01-CONTEXT.md §"Claude's Discretion" suggested calling `payloadPrivacyCheck` inside `AuditChain.append()` behind a NODE_ENV check. I deferred this because wiring it here would create a hidden dependency from `chain.ts` into `broadcast-allowlist.ts` that Phase 2 WsHub might later want to invert (the WsHub should own the broadcast-seam enforcement). Keeping the modules independent preserves Phase 2's freedom to integrate at the correct layer. The plan's `<action>` block explicitly endorses this deferral.

- **Runtime-freeze hardening beyond `Object.freeze`.** The plan specified `Object.freeze(new Set(...))`, but `Object.freeze` does NOT prevent `Set.prototype.add/delete/clear` because those methods mutate internal slots rather than properties. The must_haves assertion "runtime mutation throws or is type-prevented" required a stronger guarantee. Added `Object.defineProperty` overrides on `add`, `delete`, `clear` that throw TypeError, then froze the instance. This keeps `ReadonlySet<string>` type-soundness AND guarantees runtime immutability — tested explicitly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Object.freeze(new Set(...))` does not prevent Set mutation**

- **Found during:** Task 1 (GREEN phase — test `ALLOWLIST is frozen — runtime mutation throws` failed)
- **Issue:** The plan's action block used `Object.freeze(new Set(members))` and expected `(ALLOWLIST as Set).add(...)` to throw. `Object.freeze` freezes own-property descriptors but has no effect on Set's internal slots, so `add/delete/clear` silently succeed on a frozen Set. The must_haves explicitly require the mutation to throw.
- **Fix:** Wrapped Set construction in a `buildFrozenAllowlist()` helper that uses `Object.defineProperty` to override `add`, `delete`, and `clear` with a throwing implementation (writable: false, configurable: false), then calls `Object.freeze`. Preserves the `ReadonlySet<string>` public type; the consumer sees a perfectly normal immutable Set.
- **Files modified:** `grid/src/audit/broadcast-allowlist.ts`
- **Verification:** Test `ALLOWLIST is frozen — runtime mutation throws` now passes; `TypeError` thrown on `.add('law.bypassed')`; `ALLOWLIST.size` remains 10 after attempted mutation.
- **Committed in:** `29c3516` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (1 bug — plan's freeze approach insufficient for Set mutation methods)
**Impact on plan:** Zero scope creep. The fix strengthens the sovereignty invariant exactly as must_haves specified. Public API unchanged.

## Issues Encountered

None beyond the documented deviation. TDD cycle ran cleanly: RED (no module yet) → GREEN (fix freeze issue) → done.

## Verification Results

- `cd grid && npx vitest run test/broadcast-allowlist.test.ts` → 32 passed (0 failed)
- `cd grid && npm test` → 241 tests passed across 18 test files (all pre-existing + 32 new)
- `git diff grid/src/audit/chain.ts` → empty (invariant preserved)
- `git diff grid/src/audit/types.ts` → empty (invariant preserved)
- ALLOWLIST membership count grep → exactly 10 matches of the expected strings
- PHILOSOPHY citation grep → 1 match (header comment)
- `Object.freeze` grep → 1 match (in helper)

## Next Phase Readiness

- **Phase 2 WsHub** can now call `isAllowlisted(entry.eventType)` and `payloadPrivacyCheck(entry.payload)` at the broadcast seam with zero additional wiring required.
- `FORBIDDEN_KEY_PATTERN` exported so Phase 2 tests can assert sanitization guarantees at the NousRunner boundary without re-declaring the regex.
- No blockers. The module is pure and deterministic — safe to import anywhere.

## Self-Check: PASSED

- FOUND: `grid/src/audit/broadcast-allowlist.ts`
- FOUND: `grid/test/broadcast-allowlist.test.ts`
- FOUND commit: `f34b241` (test RED)
- FOUND commit: `29c3516` (feat GREEN)
- chain.ts unmodified (git diff empty)
- types.ts unmodified (git diff empty)
- All 32 new tests pass; full suite (241) green

---
*Phase: 01-auditchain-listener-api-broadcast-allowlist*
*Plan: 03*
*Completed: 2026-04-17*
