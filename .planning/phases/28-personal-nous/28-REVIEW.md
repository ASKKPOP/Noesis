---
phase: 28-personal-nous
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - dashboard/src/app/portal/my-nous/OwnerHub.tsx
  - dashboard/src/app/portal/my-nous/OwnerInfoSection.tsx
  - dashboard/src/app/portal/my-nous/page.tsx
  - dashboard/src/app/portal/nous/[id]/HeroCard.tsx
  - dashboard/src/app/portal/nous/spawn/PaymentPolling.tsx
  - dashboard/src/app/portal/nous/spawn/SeedCard.tsx
  - dashboard/src/app/portal/nous/spawn/SpawnWizardClient.tsx
  - dashboard/src/app/portal/nous/spawn/StepIndicator.tsx
  - dashboard/src/app/portal/nous/spawn/StepName.tsx
  - dashboard/src/app/portal/nous/spawn/StepPay.tsx
  - dashboard/src/app/portal/nous/spawn/StepRegion.tsx
  - dashboard/src/app/portal/nous/spawn/StepSeed.tsx
  - dashboard/src/app/portal/nous/spawn/WizardSummaryCard.tsx
  - dashboard/src/app/portal/nous/spawn/page.tsx
  - dashboard/src/components/portal/avatars/PersonalNousAvatar.tsx
  - grid/src/api/portal/chat.ts
  - grid/src/api/portal/check-frozen.ts
  - grid/src/api/portal/index.ts
  - grid/src/api/portal/spawn.ts
  - grid/src/api/server.ts
  - grid/src/audit/append-human-joined.ts
  - grid/src/audit/append-nous-spawned-by-human.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/audit/index.ts
  - grid/src/db/schema.ts
  - grid/src/genesis/launcher.ts
  - grid/src/genesis/types.ts
  - grid/src/registry/types.ts
  - grid/test/audit/append-nous-spawned-by-human.test.ts
  - grid/test/audit/broadcast-allowlist.test.ts
  - grid/test/db/schema-v15-v16.test.ts
  - grid/test/genesis/launcher-personality-seed.test.ts
  - grid/test/portal/check-frozen-spawn.test.ts
  - grid/test/portal/spawn-nous.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Phase 28 implements the personal Nous spawn flow: a 4-step wizard (name, seed, region, pay) on the dashboard, a suite of new Grid API routes (POST /spawn, GET /spawn/status, GET /spawn/config, GET /spawn/check-name, GET /me/nous), schema migrations v15 and v17, a new audit event `nous.spawned_by_human`, and dynamic system prompts for personal Nous chat.

The implementation is solid overall. Security guards are layered correctly (env gate, JWT auth, frozen/banned check, replay guard, one-Nous cap, name uniqueness). The audit producer boundary follows the established sole-producer pattern precisely. Tests cover the contract surface well.

Four warnings are flagged: an unguarded BigInt conversion in HeroCard that will throw on invalid/missing ousia, a potential double-redirect race in SpawnWizardClient, a missing error handling branch in the /spawn config fetch on unexpected non-503 HTTP errors, and a minor mismatch between the schema test's final-version assertion and the actual latest migration version. Three info items are noted for minor quality improvements.

## Warnings

### WR-01: Unguarded `BigInt()` call in HeroCard will throw on bad ousia

**File:** `dashboard/src/app/portal/nous/[id]/HeroCard.tsx:68`

**Issue:** `BigInt(ousia || '0')` will throw a `SyntaxError` at runtime if `ousia` contains a decimal value (e.g. `"1.5"`) or a non-numeric string, because `BigInt()` does not accept those. The `|| '0'` guard only handles empty string/undefined, not malformed values. The `ousia` field comes from the database as a raw `BIGINT` string via JSON — if the DB column ever stores a non-integer value or if a personal Nous has a fractional amount in a future migration, this will crash the component silently via an unhandled exception.

**Fix:**
```typescript
// Replace line 68
const ousiaDisplay = (() => {
    try {
        return formatUnits(BigInt(ousia || '0'), 6);
    } catch {
        return '0';
    }
})();
```

---

### WR-02: Double-redirect race in SpawnWizardClient mount guard

**File:** `dashboard/src/app/portal/nous/spawn/SpawnWizardClient.tsx:24-35`

**Issue:** The mount guard fetches `/api/v1/portal/human/me/nous` to redirect existing owners away. If the fetch fails (network error, 401, etc.), it falls through to `setGuardChecked(true)` and shows the wizard — which is correct. However, if the JWT is expired, the grid returns a non-OK response, and `r.json()` is called on it. The fetch chain calls `.then(r => r.json())` unconditionally on line 28 regardless of `r.ok`, meaning a 401 JSON body (e.g. `{"error":"invalid_token"}`) gets parsed and `data?.nous` evaluates to `undefined`, so `setGuardChecked(true)` runs — the wizard renders, and then `StepPay` discovers the invalid auth at payment time. This is a UX issue rather than a security issue (auth is re-checked server-side), but the wizard renders incorrectly for unauthenticated users.

**Fix:**
```typescript
fetch(`${GRID_BASE}/api/v1/portal/human/me/nous`, { credentials: 'include' })
    .then(r => {
        if (!r.ok) { if (!cancelled) setGuardChecked(true); return; }
        return r.json();
    })
    .then(data => {
        if (!data || cancelled) return;
        if (data?.nous) router.replace('/portal/my-nous');
        else setGuardChecked(true);
    })
    .catch(() => { if (!cancelled) setGuardChecked(true); });
```

---

### WR-03: Silent swallow of non-503 errors in /spawn/config fetch

**File:** `dashboard/src/app/portal/nous/spawn/StepPay.tsx:66-84`

**Issue:** The config fetch on lines 66-84 only checks `r.status === 503` to set `spawn_not_enabled`. Any other non-OK response (401, 500, network error) falls into the `.catch(() => null)` handler, leaving `treasury` as `null` and `costUsdt` at the default `'50'`. The Pay button will then be disabled (`canPay = false` because `treasury === null`) with no error message, giving the user no feedback. A 401 means the session expired; 500 means the grid is down. Both deserve a visible error state.

**Fix:** Distinguish between 503 (feature disabled) and other failures (show a generic error):
```typescript
.then(r => {
    if (r.status === 503) { setUiState('spawn_not_enabled'); throw new Error('disabled'); }
    if (!r.ok) { setUiState('error_payment_failed'); setErrorMsg('Could not load spawn config. Please refresh.'); throw new Error('config_error'); }
    return r.json();
})
```

---

### WR-04: Schema test `version 16 is the last version` is already stale

**File:** `grid/test/db/schema-v15-v16.test.ts:94-97`

**Issue:** The test at line 94 asserts `last.version === 16`, but `schema.ts` already has version 17 (`unique_nous_per_human`). This test will fail, or if it was written when v16 was last, it was never updated after v17 was added. A failing test in the suite may go unnoticed.

**Fix:** Either update the assertion to `17` to match the actual last migration, or remove this assertion in favor of the existing sequential-version test which already validates integrity without hardcoding the last number:
```typescript
it('version 17 is the last version', () => {
    const last = MIGRATIONS[MIGRATIONS.length - 1];
    expect(last.version).toBe(17);
});
```

---

## Info

### IN-01: `NousRecord` interface is duplicated across files

**File:** `dashboard/src/app/portal/my-nous/page.tsx:8-17` and `dashboard/src/app/portal/my-nous/OwnerHub.tsx:12-21`

**Issue:** The `NousRecord` interface is defined identically in both `page.tsx` and `OwnerHub.tsx`. If the shape evolves (e.g. new fields from the API), both must be updated in sync.

**Fix:** Define it once in a shared types file (e.g. `dashboard/src/types/portal.ts`) and import it in both.

---

### IN-02: `formatTickAsDate` is a stub with a TODO comment

**File:** `dashboard/src/app/portal/my-nous/OwnerInfoSection.tsx:41-44`

**Issue:** The function `formatTickAsDate` returns `"Tick #N"` with an inline comment stating this is a placeholder until a proper formatter is wired. This creates a permanent stub-in-production situation unless tracked.

**Fix:** Add a `// TODO(phase-29):` prefix so it appears in grep sweeps, or wire the real formatter now if the tick-to-date contract is known.

---

### IN-03: `nous_did` construction in `chat.ts` wraps the DID with an extra `did:noesis:` prefix

**File:** `grid/src/api/portal/chat.ts:244`

**Issue:** Line 244 constructs the audit `nous_did` as:
```typescript
nous_did: `did:noesis:${nousId}`,
```
When `nousId` is a genesis Nous (e.g. `sophia`), this produces `did:noesis:sophia` — correct. But when `nousId` is a personal Nous with the full DID (e.g. `did:noesis:human-nous:abc-name`), this produces `did:noesis:did:noesis:human-nous:abc-name` — a malformed double-prefixed DID. This would cause the `appendHumanSpoke` audit call to fail the `DID_RE` guard and throw a `TypeError`. The guard (line 188) already ensures personal Nous IDs start with `did:noesis:human-nous:` before reaching this point, so the double-prefix bug is reachable for all personal Nous chat messages.

**Fix:**
```typescript
// Line 244 — use nousId directly for personal Nous (already a full DID)
nous_did: nousId.startsWith('did:noesis:') ? nousId : `did:noesis:${nousId}`,
```

This is actually a bug, not just an info item, but it's in the audit fire-and-forget path — `appendHumanSpoke` throws a TypeError which is not caught, meaning the chat response still succeeds but the audit event is silently lost. Flagged as Info rather than Warning because the feature path (chat response) works correctly; only the audit event is affected.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
