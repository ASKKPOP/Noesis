# Phase 60 · Wave 5 (60-06) — Summary

**Plan:** `.planning/phases/60-house-3-commerce-cowork/60-06-PLAN.md`
**Status:** BUILT — all gates green, ring-expansion suite un-skipped + green.
**Requirements:** R-60-10 (ring-expansion bill TEMPLATE), R-60-12 (cross-house prompt-injection gate A11e).

## What shipped

### 1. Ring-expansion bill TEMPLATE (`grid/src/civic/ring-expansion.ts`, NEW)
- `export function onLawEnacted(billBody, deps)` — parses the bill body Grid-side (string-JSON or object).
- `{action:'seed_ring', ring:N}` → `deps.seedZone(N)` via the Phase 58 seedZone + gravity formula. IDEMPOTENT: skipped when `deps.alreadySeeded(N)` is true (INSERT IGNORE — re-enacting adds no duplicate parcels). Emits **NO audit event** (world-creation per Phase 58); **NO new allowlist member**.
- `{action:'amend_law'|'amend_constant', key, value}` → `deps.amendConstant(key, value)` (Polis override of `UPKEEP_RATE_BPS` / `ZONE_TAX_BPS`).
- Non-matching bodies are ignored — this is a TEMPLATE consuming the EXISTING Phase 46 `gov.law_enacted`, **not a new governance path**. No vote, no chain append, no `clock.onTick`.

### 2. Polis-amendable read-through (`grid/src/civic/founding-law.ts`)
- Added `recordPolisOverride(key, value)`, `getUpkeepRateBps()`, `getZoneTaxBps(zoneId)`, `_resetPolisOverrides()`.
- Module-level `polisOverrides` map; accessors return the override if set, else the constant DEFAULT FALLBACK.
- `upkeepDue` + `structureRevenueDue` now read through the accessors (single patch point preserved). Constants `UPKEEP_RATE_BPS` / `ZONE_TAX_BPS` unchanged as defaults.

### 3. Governance dispatch hook (`grid/src/governance/engine.ts`)
- Added `onLawEnacted(billBody, deps)` to `GovernanceEngine` — fire-and-forget delegate to the ring-expansion template at the EXISTING `gov.law_enacted` dispatch. Synchronous, side-effect-only, no append. REUSES the Phase 46 pipeline verbatim; no new event, no new clock subscription.

### 4. Cross-house prompt-injection CI gate A11e (`scripts/check-cross-house-injection.mjs`, NEW)
- Walks the House content channels: `grid/src/civic/cowork.ts`, `grid/src/api/routes/civic-parcels.ts` (invite + board routes), `grid/src/civic/place-registry.ts`.
- Flags a violation when an untrusted CONTENT token (`task_ref`/`scope_ref`/`invitee`/`place_name`/`visitor*`/board text) is WOVEN (template-interpolation `${...}`, `+` concat, or `.concat()`) into a DIRECTIVE token (`Telos`/`Charter`/`directive`/`prompt`/`instruction`/`command`/`persona`) on the same statement. Structured DATA fields (`scope_ref: taskRef`) are allowed. Comments skipped.
- Exit 0 clean, exit 1 on violation. Mirrors the shape of `check-sole-producer-discipline.mjs` / `check-wallclock-forbidden.mjs`.

### 5. Test (`grid/test/civic/ring-expansion.test.ts`)
- `describe.skip` → `describe`; all 5 cases green.

## Self-check (verification evidence)

```
$ cd grid && npm run test -- civic/ring-expansion audit/broadcast-allowlist
 ✓ test/civic/ring-expansion.test.ts (5 tests)
 ✓ test/audit/broadcast-allowlist.test.ts (115 tests)
 Test Files  2 passed (2) | Tests  120 passed (120)
```
- ring-expansion: 5/5 green; broadcast-allowlist: 115/115 green, **ALLOWLIST = 99** (members 99, set 99 — no new member added).
- founding-law + upkeep-scanner + structure-revenue + upkeep-collected suites: 32/32 green (read-through change non-regressive).

**A11e gate:**
- Clean source: `node scripts/check-cross-house-injection.mjs` → exit **0**.
- Synthetic violation (temporary `scope_ref: \`Telos directive: ${taskRef}\`` in civic-parcels board/post) → exit **1**, correctly flagged at `civic-parcels.ts:671`. **Reverted** (git diff clean, gate back to exit 0).

**Other gates:**
- `check-sole-producer-discipline.mjs` → exit 0 (82 files).
- `check-civic-did-issuance-path.mjs` → exit 0 (334 files).
- `check-wallclock-forbidden.mjs` → exit 0.

**tsc:** `npx tsc --noEmit` → exit 0, no new errors.

**Invariants preserved:**
- Allowlist still exactly **99** (no new member; ring-expansion emits no chain event).
- ring-expansion.ts has **zero** `audit.append` / `.append(` calls.
- **No new `clock.onTick` subscription** — actual subscription callsites unchanged (grid-coordinator.ts:80, launcher.ts:490 pre-existing); only new comment mentions added.
- VOTE-05 Nous-only + R-31-01 zero-diff untouched (no chain/persistence-of-chain code edited).
- Ring-expansion is a TEMPLATE consuming existing `gov.law_enacted`; no new governance path.

## Files modified
- `grid/src/civic/ring-expansion.ts` (NEW)
- `grid/src/civic/founding-law.ts`
- `grid/src/governance/engine.ts`
- `scripts/check-cross-house-injection.mjs` (NEW)
- `grid/test/civic/ring-expansion.test.ts` (un-skipped)
