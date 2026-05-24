---
phase: 28-personal-nous
verified: 2026-05-23T00:00:00Z
status: human_needed
score: 10/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm on-chain USDT payment flows end-to-end (payment confirmation gate)"
    expected: "POST /api/v1/portal/nous/spawn returns 200 with nous_did after a real USDT transfer to GRID_TREASURY_ADDRESS on testnet; /spawn/status/:txHash returns { confirmed: true } before the spawn POST is made"
    why_human: "evmConfirmTx is not wired in grid/src/main.ts — the GridServices.evmConfirmTx optional field is absent from the production entrypoint, causing confirmTxPaid to always return { confirmed: false }. Automated tests stub this dep; no end-to-end payment test exists. Requires live testnet USDT transfer with GRID_EVM_RPC_URL set."
---

# Phase 28: Personal Nous Verification Report

**Phase Goal:** Enable human users to spawn their own personal Nous via the Portal — with payment confirmation, a 4-step wizard UI, and an owner hub to view and chat with their Nous.
**Verified:** 2026-05-23
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `nous.spawned_by_human` is at allowlist position 53 | VERIFIED | `grep -c "nous.spawned_by_human" broadcast-allowlist.ts` → 2; `grep -c "// (53)"` → 1 |
| 2 | `appendNousSpawnedByHuman` is the sole emit site for `nous.spawned_by_human` | VERIFIED | `grep -rn "audit.append('nous.spawned_by_human'" grid/src/ | wc -l` → 1 |
| 3 | `bootstrapPsycheHash` accepts optional `personalitySeed` and forks hash input | VERIFIED | launcher.ts lines 41-50: `const input = personalitySeed ? ...with seed... : ...without`; call at line 478 passes `personalitySeed` |
| 4 | `launcher.spawnNous` accepts `personalitySeed?: string` | VERIFIED | launcher.ts line 458: 6th param `personalitySeed?`; forwarded to `registry.spawn()` and `bootstrapPsycheHash()` |
| 5 | Migrations v15, v16, v17 present | VERIFIED | `grep -c "version: 15/16/17"` each → 1; `spawn_payments` table → 4 matches; `personality_seed` column → 3 matches; `uq_human_owner` → 2 matches |
| 6 | Freeze gate covers POST /spawn but not GET /spawn/* | VERIFIED | check-frozen.ts contains `/^\/api\/v1\/portal\/nous\/spawn$/` with `$` anchor preventing over-block of status/config/check-name GETs |
| 7 | POST /spawn validates name, seed enum, body, auth, payment, 1-Nous cap, replay guard | VERIFIED | spawn.ts contains `already_owns_nous`, `payment_already_claimed`, `name_taken`, `payment_not_confirmed`, `spawn_not_enabled`, `ALLOW_HUMAN_SPAWNED_NOUS` env gate, NAME_RE `/^[a-zA-Z0-9_]{3,32}$/`, SEED_ENUM |
| 8 | 4-step wizard renders at /portal/nous/spawn with payment polling, all steps functional | VERIFIED | 10 files under dashboard/src/app/portal/nous/spawn/; page.tsx has `dynamic({ ssr: false })`; StepPay has useWriteContract, parseUnits, 120_000 timeout, 3000ms poll interval; human checkpoint approved 2026-05-23 |
| 9 | Personal Nous chat works via seed-derived dynamic system prompt | VERIFIED | chat.ts contains `buildPersonalNousPrompt`, `SEED_PERSONALITY_DESC`, DID prefix gate `did:noesis:human-nous:`, `SELECT personality_seed, name FROM nous_registry WHERE did = ?` |
| 10 | /portal/my-nous shows empty-state CTA or owner hub; HeroCard resolves personal Nous DIDs | VERIFIED | page.tsx fetches `human/me/nous`; OwnerHub composes HeroCard+ProfileTabBar+tabs+OwnerInfoSection; HeroCard has `resolveNousMeta`, `resolveAvatar`, `PersonalNousAvatar` import; no management controls (grep returns 0 for rename/suspend/delete/pause); human checkpoint approved 2026-05-23 |
| 11 | POST /spawn payment confirmation verifies on-chain USDT transfer | PARTIAL | `confirmTxPaid` is wired through optional `services.evmConfirmTx` in index.ts; when absent (production main.ts — no evmConfirmTx wired), returns `{ confirmed: false }`. EVM RPC client not instantiated in grid/src/main.ts. Automated tests stub this dep and pass. Real payment confirmation requires human testnet verification. |

**Score:** 10/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/append-nous-spawned-by-human.ts` | Sole-producer emitter for nous.spawned_by_human | VERIFIED | exports `appendNousSpawnedByHuman`, EXPECTED_KEYS closed-tuple, no spread, payloadPrivacyCheck |
| `grid/src/audit/broadcast-allowlist.ts` | 53-member allowlist including nous.spawned_by_human | VERIFIED | position 53 confirmed |
| `grid/src/db/schema.ts` | Migrations v15 (personality_seed), v16 (spawn_payments), v17 (uq_human_owner) | VERIFIED | All 3 migration versions present |
| `grid/src/genesis/launcher.ts` | spawnNous + bootstrapPsycheHash with personalitySeed | VERIFIED | personalitySeed in 6 locations in launcher.ts |
| `grid/src/api/portal/check-frozen.ts` | Freeze gate covers POST /spawn (anchored $) | VERIFIED | Pattern `/^\/api\/v1\/portal\/nous\/spawn$/` present |
| `grid/test/portal/spawn-nous.test.ts` | 26+ it() contract tests covering SPAWN-01..06 | VERIFIED | 26 it() cases, describe('POST /api/v1/portal/nous/spawn') present |
| `grid/test/audit/append-nous-spawned-by-human.test.ts` | Sole-producer invariant tests | VERIFIED | File exists, covers all guard layers |
| `grid/src/api/portal/spawn.ts` | 5 portal spawn routes + SpawnHumanNousDeps interface | VERIFIED | registerSpawnRoutes exported, 13 route path matches, appendNousSpawnedByHuman imported |
| `grid/src/api/portal/index.ts` | registerSpawnRoutes wired with deps | VERIFIED | `registerSpawnRoutes` count → 2 (import + call) |
| `grid/src/api/portal/chat.ts` | buildPersonalNousPrompt + DID prefix gate | VERIFIED | SEED_PERSONALITY_DESC, buildPersonalNousPrompt × 2, personality_seed SELECT query present |
| `dashboard/src/app/portal/nous/spawn/page.tsx` | Thin wrapper with `dynamic({ ssr: false })` | VERIFIED | 8 lines, dynamic import, ssr:false |
| `dashboard/src/app/portal/nous/spawn/SpawnWizardClient.tsx` | 4-step state machine + mount guard | VERIFIED | useState<Step>, human/me/nous fetch, router.replace('/portal/my-nous') |
| `dashboard/src/app/portal/nous/spawn/StepPay.tsx` | wagmi USDT transfer + 3s polling + 120s timeout | VERIFIED | useWriteContract, parseUnits, spawn/status/, 120_000, 3000 all confirmed |
| `dashboard/src/app/portal/my-nous/page.tsx` | Double-duty: empty CTA or OwnerHub | VERIFIED | human/me/nous fetch, "Spawn Your Nous" CTA, /portal/nous/spawn route |
| `dashboard/src/app/portal/my-nous/OwnerHub.tsx` | HeroCard + tabs + OwnerInfoSection | VERIFIED | OwnerInfoSection × 2, HeroCard × 2, ProfileTabBar × 2; no management controls |
| `dashboard/src/components/portal/avatars/PersonalNousAvatar.tsx` | Dual-sparkle SVG, var(--bronze) | VERIFIED | export function PersonalNousAvatar, default export, var(--bronze) × 2, no raw hex |
| `dashboard/src/app/portal/nous/[id]/HeroCard.tsx` | Extended for personal Nous DID resolution | VERIFIED | PersonalNousAvatar × 3, resolveNousMeta/resolveAvatar × 4, did:noesis:human-nous: × 3, chat?nous= × 1 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| POST /spawn handler | launcher.spawnNous() | deps.spawnNous() call in spawn.ts | VERIFIED | `grep -c "deps.*spawnNous"` → 1 in spawn.ts |
| POST /spawn success | appendNousSpawnedByHuman | when deps.audit present → emits event | VERIFIED | appendNousSpawnedByHuman imported and called conditionally |
| SpawnWizardClient mount | GET /human/me/nous | fetch with credentials:include; redirect if nous != null | VERIFIED | pattern "human/me/nous" in SpawnWizardClient × 1; router.replace to /portal/my-nous × 2 |
| StepPay payment | POST /api/v1/portal/nous/spawn | fetch after polling confirmed=true | VERIFIED | spawn/status/ polling + POST /spawn in StepPay × confirmed count |
| my-nous/page.tsx | GET /human/me/nous | fetch → null→empty state, record→OwnerHub | VERIFIED | "human/me/nous" in page.tsx × 1 |
| HeroCard Chat button | /portal/chat?nous=<did> | `encodeURIComponent(nousId)` in chatHref | VERIFIED | line 66 of HeroCard.tsx |
| chat.ts personal Nous | nous_registry.personality_seed | SELECT personality_seed, name FROM nous_registry WHERE did = ? | VERIFIED | Query at chat.ts line 193 |
| confirmTxPaid | GRID_EVM_RPC_URL (production EVM client) | services.evmConfirmTx optional field | PARTIAL | Field defined in GridServices (server.ts line 243); NOT wired in grid/src/main.ts; returns `{ confirmed: false }` when absent — requires human testnet verification |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| my-nous/page.tsx | nousData | GET /api/v1/portal/human/me/nous → index.ts getOwnedNous SQL | SELECT from nous_registry where human_owner = ? | FLOWING |
| StepPay.tsx | txHash (wagmi) | useWriteContract → MetaMask wallet | Real wallet signature + on-chain tx | FLOWING (wagmi) |
| StepPay.tsx | confirmed | GET /spawn/status/:txHash → confirmTxPaid | Optional evmConfirmTx; absent in main.ts → always { confirmed: false } | HOLLOW in production (see Truth 11) |
| StepName.tsx | checkResult | GET /spawn/check-name → queryNameTaken SQL | SELECT 1 FROM nous_registry WHERE name = ? | FLOWING |
| OwnerInfoSection.tsx | spawnedAtTick display | formatTickAsDate() | Returns "Tick #N" (no tick→date formatter) | STATIC (acceptable per plan; "Tick #N" is the designed fallback) |

### Behavioral Spot-Checks

Step 7b: SKIPPED for wagmi and MetaMask flows (require live browser + wallet). API routes require running server.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SPAWN-01 | 28-01, 28-02, 28-03, 28-04 | Payment-gated spawn flow — on-chain USDT confirmation required | PARTIAL | POST /spawn route requires payment; confirmTxPaid server logic present but evmConfirmTx not wired in production main.ts; UI payment flow human-approved |
| SPAWN-02 | 28-01, 28-02, 28-03, 28-04 | 4-step wizard: name (3–32 alphanum+_), personality seed, region, pay; DID `did:noesis:human-nous:...` | VERIFIED | NAME_RE, SEED_ENUM ['Explorer','Scholar','Merchant','Guardian'], DID derivation in spawn.ts; all 4 wizard steps built and human-approved |
| SPAWN-03 | 28-01, 28-03 | ALLOW_HUMAN_SPAWNED_NOUS env gate; Brain provisioning via shared container (D-01 scoping decision) | VERIFIED | 503 spawn_not_enabled gate present in spawn.ts; D-01 explicitly defers dedicated Docker container; shared Brain handles personal Nous via dynamic system prompt |
| SPAWN-04 | 28-01, 28-02 | `nous.spawned_by_human` audit event at position 53, closed-tuple payload | VERIFIED | Sole-producer emitter exists; allowlist position 53 confirmed; 421 tests pass |
| SPAWN-05 | 28-05 | Human can see their Nous via /portal/my-nous; no direct control; can chat | VERIFIED | OwnerHub renders HeroCard+tabs+OwnerInfoSection; no management controls confirmed; chat button routes to /portal/chat?nous=<did> |
| SPAWN-06 | 28-03, 28-04 | Max 1 Nous per human; migration v17 unique constraint | VERIFIED | queryHasNous check in spawn.ts; uq_human_owner UNIQUE KEY in schema migration v17; 409 already_owns_nous error code present |

Note: SPAWN-01..06 are defined in `.planning/research/v2.5-requirements.md`. They are not in `.planning/REQUIREMENTS.md` (which covers v2.2/v2.4 milestones). They are tracked in the ROADMAP as the requirements for Phase 28 (v2.5 milestone).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `dashboard/src/app/portal/my-nous/OwnerInfoSection.tsx` | 41-43 | `formatTickAsDate` returns `"Tick #N"` — no real tick→date conversion | Info | Display-only; shows spawn tick number instead of a human-readable date. Accepted per plan decision — no tick→date utility exists; "Tick #N" is the designed fallback per UI-SPEC |
| `dashboard/src/app/portal/my-nous/OwnerHub.tsx` | line ~47 | `spawn_cost_usdt ?? '50'` — defaults to '50' when field absent from API response | Info | API getOwnedNous SQL does not SELECT spawn_cost_usdt (it's not in nous_registry); falls back gracefully |
| `grid/src/api/portal/index.ts` | 41-42 | `if (!services.evmConfirmTx) return { confirmed: false }` — no-op fallback when EVM client absent | Warning | In production (grid/src/main.ts), `evmConfirmTx` is never set on GridServices, so payment confirmation always returns unconfirmed. Spawn POST will never reach 200 in production until this is wired. |

### Human Verification Required

### 1. End-to-End Payment Confirmation (SPAWN-01)

**Test:** Set `GRID_EVM_RPC_URL`, `GRID_TREASURY_ADDRESS`, `SPAWN_COST_USDT=50`, `ALLOW_HUMAN_SPAWNED_NOUS=true` in docker-compose.yml. Wire `evmConfirmTx` in `grid/src/main.ts` to an actual EVM RPC client (viem or ethers). Perform a real USDT transfer on testnet. Navigate to /portal/nous/spawn, complete the wizard, and sign the MetaMask transaction.

**Expected:** After tx broadcast, /spawn/status/:txHash returns `{ confirmed: true }` once the testnet tx is mined; wizard POSTs to /spawn and receives `{ ok: true, nous_did: "did:noesis:human-nous:..." }`; page redirects to /portal/my-nous which shows the owner hub.

**Why human:** The `evmConfirmTx` optional service field is defined in GridServices (`server.ts` line 243) but is not wired in `grid/src/main.ts`. Without this wiring, `confirmTxPaid` always returns `{ confirmed: false }`, causing POST /spawn to return 400 `payment_not_confirmed`. This is documented in 28-03-SUMMARY.md as a known stub under "Known Stubs." No automated test covers real EVM receipt verification; all tests use injectable stubs. The developer must wire the EVM RPC client in `main.ts` before spawn can work end-to-end in production.

---

### Gaps Summary

There are no FAILED truths — all verified items pass. One item (Truth 11, SPAWN-01 payment confirmation) is PARTIAL: the route layer is correctly implemented and tested with stubs, but the production `GridServices` wiring of `evmConfirmTx` is absent from `grid/src/main.ts`. The overall phase infrastructure is sound; human verification of the payment path on testnet is the outstanding gate.

The `formatTickAsDate` stub in OwnerInfoSection is an accepted info-level item (by plan design).
The `spawn_cost_usdt ?? '50'` default in OwnerHub is a minor info-level item (API doesn't return this field; default is acceptable).

---

_Verified: 2026-05-23_
_Verifier: Claude (gsd-verifier)_
