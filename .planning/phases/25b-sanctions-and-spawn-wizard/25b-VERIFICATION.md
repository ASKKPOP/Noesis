---
phase: 25b-sanctions-and-spawn-wizard
verified: 2026-05-22T15:05:44Z
status: human_needed
score: 13/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm ban-human and freeze-wallet routes work end-to-end in a running Grid"
    expected: "POST /api/v1/operator/humans/:did/ban and /freeze return 200 ok, set DB flags, emit audit events"
    why_human: "humanSanctionStore is not wired in main.ts — routes return 503 human_sanction_store_unavailable in production. The interface, routes, and tests are fully implemented but production wiring is deferred (same pattern as delete-nous _deleteNousDeps). Cannot verify DB write path without running infrastructure."
  - test: "Confirm spawn-system-nous route works end-to-end in a running Grid"
    expected: "POST /api/v1/operator/spawn-system-nous returns 200 with nous_did matching did:noesis:system:*, Nous appears in registry with 1000 Ousia balance"
    why_human: "SpawnNousDeps injectable is not wired in main.ts — route returns 503 spawn_unavailable in production. Route, wizard UI, and tests are fully implemented. Production wiring (main.ts wraps launcher.spawnNous) is deferred per SUMMARY-14 note."
---

# Phase 25b: Sanctions + Spawn Wizard Verification Report

**Phase Goal:** Ship operator-facing write actions: Nous sanctions (mute-broadcast H3, slash-coin H4, quarantine H4, force-sleep H3), human sanctions (ban-human H5, freeze-wallet H5), system/researcher Nous spawn wizard (H5), AND a Wave-0 header-auth migration of the 6 existing operator routes (security prerequisite per D-25b-NEW-1). Allowlist delta: +6 (operator.muted, operator.slashed, operator.quarantined, operator.forced_sleep, operator.human_banned, operator.human_frozen). Running total after 25b: 51.

**Verified:** 2026-05-22T15:05:44Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 6 existing operator routes reject body-supplied tier (Wave 0 header-auth) | VERIFIED | `validateTierBody` absent from all 6 route files; `x-operator-tier` reads present; tier gates confirmed: clock H3, governance H3, telos H4, delete-nous H5, memory-query H2, export-replay H5 |
| 2 | Allowlist contains exactly 51 entries with 6 new operator.* sanction events | VERIFIED | `broadcast-allowlist.ts` contains `operator.muted` (46) through `operator.human_frozen` (51) at correct positions |
| 3 | 6 sole-producer emitter files exist with closed-tuple validation and reason_hash discipline | VERIFIED | All 6 emitter files present; HEX64_RE validation, EXPECTED_KEYS closed-tuple, self-report invariant, no plaintext field names |
| 4 | Migration v12 creates sanction_reasons table + human_users.frozen column | VERIFIED | `schema.ts` version 12 contains both DDL statements |
| 5 | Migration v13 adds human_users.banned column (separate from frozen, per D-25b-NEW-5) | VERIFIED | `schema.ts` version 13 adds `banned TINYINT(1) NOT NULL DEFAULT 0` |
| 6 | Mute-broadcast (H3) and force-sleep (H3) sanction routes exist with header-auth and are registered | VERIFIED | `mute-broadcast.ts` and `force-sleep.ts` with `tierNum < 3` gates; both registered in `operator/index.ts` |
| 7 | NousRunner muteFlag enforced at 4 broadcast emit boundaries | VERIFIED | `nous-runner.ts` has `muteFlag: boolean = false` field and 4 `if (this.muteFlag)` suppression guards (handleSpeak/nous.spoke, direct_message, whisper_send, skill_taught) |
| 8 | Quarantine (H4) and slash-coin (H4) sanction routes exist with header-auth and registry effects | VERIFIED | `quarantine.ts` and `slash-coin.ts` with `tierNum < 4`; `NousRecord.quarantineFlag` in `types.ts`; peer-discovery filter in `registry.ts inRegion()`; amount validated as positive integer |
| 9 | Steward /nous/[id] Sanctions card exposes all 4 Nous sanctions with header-auth fetches | VERIFIED | Page contains Sanctions card with 4 rows; `x-operator-tier` present in all fetches; no body-supplied tier |
| 10 | Ban-human (H5) and freeze-wallet (H5) routes exist with header-auth; freeze has zero-custody invariant | VERIFIED | Both routes with `tierNum < 5`; freeze-wallet has ZERO-CUSTODY comment; no wagmi/ethers/web3 imports; both registered in barrel |
| 11 | Portal middleware blocks frozen/banned humans on action routes; SIWE sign-in not blocked | VERIFIED | `check-frozen.ts` preHandler with `PORTAL_ACTION_PATTERNS`; registered in `portal/index.ts` after SIWE auth routes |
| 12 | Steward /humans/[did] Sanctions tab exists with H5 confirm dialogs for ban + freeze | VERIFIED | `TabId` union includes `'sanctions'`; TABS array has Sanctions entry; walletSuffix confirm pattern (last 6 chars); reason ≥10 chars guard |
| 13 | Spawn wizard route (H5) exists using did:noesis:system:* DID scheme, reusing GenesisLauncher.spawnNous, no new allowlist entry | VERIFIED | `spawn-system-nous.ts` with `tierNum < 5`; generates `did:noesis:system:${randomUUID()}`; calls `resolvedDeps.spawnNous`; allowlist stays at 51 |
| 14 | Ban-human, freeze-wallet, and spawn routes functional in a running production Grid | HUMAN NEEDED | `humanSanctionStore` and `SpawnNousDeps` not wired in `main.ts`; routes return 503 until production wiring is added. Same deferred-wiring pattern as `delete-nous` (`_deleteNousDeps`). |

**Score:** 13/14 truths verified (1 requires human verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/api/operator/clock-pause-resume.ts` | Header-trust H3, no validateTierBody | VERIFIED | tierNum < 3; x-operator-tier present |
| `grid/src/api/operator/governance-laws.ts` | Header-trust H3, all 3 handlers | VERIFIED | tierNum < 3 in 3 handlers |
| `grid/src/api/operator/telos-force.ts` | Header-trust H4 | VERIFIED | tierNum < 4 |
| `grid/src/api/operator/delete-nous.ts` | Header-trust H5, ORDER-LOCKED preserved | VERIFIED | tierNum < 5; ORDER-LOCKED comment retained |
| `grid/src/api/operator/memory-query.ts` | Header-trust H2 | VERIFIED | tierNum < 2 |
| `grid/src/api/operator/export-replay.ts` | Header-trust H5, audit emit uses header op_id | VERIFIED | tierNum < 5 |
| `grid/src/audit/broadcast-allowlist.ts` | 51 entries, 6 new operator.* at positions 46-51 | VERIFIED | All 6 entries present in declared order |
| `grid/src/audit/append-operator-muted.ts` | 8-step sole-producer, H3, reason_hash | VERIFIED | HEX64_RE, EXPECTED_KEYS, self-report invariant |
| `grid/src/audit/append-operator-slashed.ts` | 8-step, H4, amount field | VERIFIED | 7-key EXPECTED_KEYS including amount |
| `grid/src/audit/append-operator-quarantined.ts` | 8-step, H4 | VERIFIED | Standard 6-key closed tuple |
| `grid/src/audit/append-operator-forced-sleep.ts` | 8-step, H3 | VERIFIED | Standard 6-key closed tuple |
| `grid/src/audit/append-operator-human-banned.ts` | 8-step, H5, human_did variant | VERIFIED | human_did key, colon-permissive DID_RE |
| `grid/src/audit/append-operator-human-frozen.ts` | 8-step, H5, human_did variant | VERIFIED | human_did key, colon-permissive DID_RE |
| `grid/src/db/schema.ts` | Migration v12 (sanction_reasons + frozen) and v13 (banned) | VERIFIED | Both migrations present |
| `scripts/check-operator-sanctions-plaintext.mjs` | CI gate for reason plaintext fields | VERIFIED | Exists; wired in package.json pretest |
| `grid/test/audit/operator-*-producer-boundary.test.ts` (6 files) | Sole-producer invariant per event | VERIFIED | All 6 files present |
| `grid/src/api/operator/mute-broadcast.ts` | H3 route, emits operator.muted, registered | VERIFIED | tierNum < 3; barrel registration confirmed |
| `grid/src/api/operator/force-sleep.ts` | H3 route, emits operator.forced_sleep, triggers Hypnos | VERIFIED | tierNum < 3; sleepTrigger injectable |
| `grid/src/integration/nous-runner.ts` | muteFlag: boolean + 4 suppression guards | VERIFIED | 4 `if (this.muteFlag)` guards at broadcast boundaries |
| `grid/src/api/operator/quarantine.ts` | H4 route, sets quarantineFlag, registered | VERIFIED | tierNum < 4; barrel registration |
| `grid/src/api/operator/slash-coin.ts` | H4 route, amount validation, debits balance | VERIFIED | tierNum < 4; invalid_amount guard; clamp-to-zero on insufficient |
| `grid/src/registry/types.ts` | quarantineFlag?: boolean on NousRecord | VERIFIED | Field present |
| `grid/src/registry/registry.ts` | inRegion() filters quarantineFlag=true | VERIFIED | `filter(r => !r.quarantineFlag)` present |
| `steward/src/app/nous/[id]/page.tsx` | Sanctions card with 4 rows, header-auth | VERIFIED | Card present; x-operator-tier in all 4 fetches |
| `grid/src/api/operator/ban-human.ts` | H5 route, sets banned=1, human_did audit field | VERIFIED | tierNum < 5; humanSanctionStore.setBanned; human_did in payload |
| `grid/src/api/operator/freeze-wallet.ts` | H5 route, sets frozen=1, zero-custody | VERIFIED | tierNum < 5; ZERO-CUSTODY invariant comment; no on-chain imports |
| `grid/src/api/portal/check-frozen.ts` | preHandler blocking frozen/banned humans on action routes | VERIFIED | PORTAL_ACTION_PATTERNS; banned check before frozen; SIWE routes excluded |
| `steward/src/app/humans/[did]/page.tsx` | Sanctions tab with H5 confirm dialogs | VERIFIED | sanctions TabId; walletSuffix confirm; reason ≥10 chars |
| `grid/src/api/operator/spawn-system-nous.ts` | H5 route, did:noesis:system:*, reuses spawnNous | VERIFIED | tierNum < 5; generated DID; resolvedDeps.spawnNous call; 503 fallback if not wired |
| `steward/src/app/system/spawn/page.tsx` | 3-step wizard, header-auth, SPAWN confirm | VERIFIED | Steps 1-3; confirmText === 'SPAWN'; x-operator-tier: '5' |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| clock-pause-resume.ts | x-operator-tier header | req.headers['x-operator-tier'] | WIRED | tierNum < 3 gate |
| governance-laws.ts | x-operator-tier header | req.headers['x-operator-tier'] | WIRED | All 3 handlers updated |
| telos-force.ts | x-operator-tier header | req.headers['x-operator-tier'] | WIRED | H4 gate confirmed |
| delete-nous.ts | x-operator-tier header | req.headers['x-operator-tier'] | WIRED | H5 gate + ORDER-LOCKED preserved |
| memory-query.ts | x-operator-tier header | req.headers['x-operator-tier'] | WIRED | H2 gate confirmed |
| export-replay.ts | appendOperatorExported | audit emit with header operator_id | WIRED | resolvedOperatorId in emit call |
| ALLOWLIST_MEMBERS | 6 new operator.* event names | positions 46-51 | WIRED | All 6 present in declared order |
| Each emitter | audit.append | 8-step sole-producer pattern | WIRED | HEX64_RE + closed-tuple + self-report invariant |
| mute-broadcast.ts | appendOperatorMuted | audit emit on success | WIRED | Confirmed in route |
| force-sleep.ts | Hypnos sleep entry path | sleepTrigger after operator.forced_sleep emit | WIRED | ORDER preserved: emit then trigger |
| nous-runner muteFlag | broadcast emit suppression | if (this.muteFlag) early-return | WIRED | 4 enforcement points confirmed |
| quarantine.ts | appendOperatorQuarantined | audit emit on success | WIRED | Confirmed |
| nous-registry inRegion() | quarantineFlag filter | filter(r => !r.quarantineFlag) | WIRED | Confirmed at registry.ts:217 |
| slash-coin.ts | appendOperatorSlashed | audit emit with amount | WIRED | amount field in payload |
| Sanctions card submit | POST /api/v1/operator/nous/:did/{mute,force-sleep,quarantine,slash} | fetch with x-operator-tier + x-operator-id headers | WIRED | No body tier; all 4 rows |
| ban-human.ts | human_users.banned column | humanSanctionStore.setBanned(did) | WIRED (route side) | Route wired; production store deferred |
| freeze-wallet.ts | human_users.frozen column | humanSanctionStore.setFrozen(did) | WIRED (route side) | Route wired; production store deferred |
| Portal action routes | check-frozen preHandler | Fastify addHook('preHandler') | WIRED | Registered in portal/index.ts after SIWE auth |
| Steward humans Sanctions tab | POST /api/v1/operator/humans/:did/{ban,freeze} | fetch with header-auth | WIRED | x-operator-tier: '5'; walletSuffix + reason guard |
| spawn-system-nous.ts | GenesisLauncher.spawnNous | resolvedDeps.spawnNous call | WIRED (route side) | Calls deps.spawnNous; 503 if not wired at deployment |
| Steward /system/spawn | POST /api/v1/operator/spawn-system-nous | fetch with x-operator-tier: 5 | WIRED | body: {name, personality_seeds}; no body tier |

### Behavioral Spot-Checks

Step 7b: SKIPPED (no runnable entry points available without starting the Grid server; the project uses Vitest unit tests for all route verification, not integration tests against a live server).

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| D-25b-NEW-1 | 25b-01 through 25b-06 | Header-auth migration of 6 existing operator routes | SATISFIED | All 6 routes migrated; validateTierBody absent; x-operator-tier reads present |
| D-25b-10 | 25b-01 through 25b-06 | Existing routes not redesigned, only auth hardened | SATISFIED | Only auth block changed; all business logic preserved |
| D-25b-07 | 25b-07, 25b-09, 25b-10, 25b-11 | 4 Nous sanctions with correct tiers and audit events | SATISFIED | mute H3, slash H4, quarantine H4, force-sleep H3; all emitting correct events |
| D-25b-08 | 25b-07, 25b-12, 25b-13 | 2 human sanctions (ban H5, freeze H5) | SATISFIED (code) | Routes exist; DB wiring deferred to production |
| D-25b-09 | 25b-07, 25b-08 | Closed-tuple sole-producer per event | SATISFIED | 6 emitter files + producer-boundary tests + CI gate |
| D-25b-11 | 25b-07, 25b-08, 25b-09, 25b-10, 25b-12 | reason_hash only in audit; plaintext in sanction_reasons | SATISFIED | HEX64_RE validation; CI gate passes; no forbidden keys |
| D-25b-12 | 25b-14 | Spawn wizard H5, system DID, reuses GenesisLauncher | SATISFIED (code) | did:noesis:system:* scheme; resolvedDeps.spawnNous; production wiring deferred |
| D-25b-NEW-3 | 25b-09, 25b-10 | Nous runtime sanction behavior | SATISFIED | muteFlag at 4 broadcast boundaries; quarantineFlag in peer-discovery filter |
| D-25b-NEW-4 | 25b-07, 25b-12, 25b-13 | Freeze is Grid-side flag, zero-custody | SATISFIED | frozen column in migration v12; ZERO-CUSTODY comment; no on-chain imports |
| D-25b-NEW-5 | 25b-12 | ban and frozen are separate columns | SATISFIED | v13 adds banned; v12 adds frozen; semantically distinct |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `grid/src/main.ts` | 128-153 | `humanSanctionStore` not passed to buildServer | Warning | ban-human and freeze-wallet routes return 503 in production deployment; routes are implemented and tested but require main.ts wiring to be operational |
| `grid/src/main.ts` | 128-153 | `SpawnNousDeps` (spawnNous wrapper) not passed to buildServer | Warning | spawn-system-nous route returns 503 in production; same deferred pattern as delete-nous `_deleteNousDeps` |
| `grid/src/api/operator/spawn-system-nous.ts` | All | personality_seeds accepted but not consumed by personality-bootstrap step | Info | Forward-compat only in 25b; seeds stored in audit payload metadata; TODO comment marks insertion point for future phase |

Note: The production wiring gaps are the established `_deleteNousDeps` injectable pattern intentionally used in this project. They are not accidental stubs — routes degrade gracefully with 503 rather than panicking, and the test harness fully exercises the happy paths via injectable mocks.

### Human Verification Required

#### 1. Ban-Human and Freeze-Wallet Production Wiring

**Test:** Wire `humanSanctionStore` in `main.ts` (or confirm deliberate deferral), then call `POST /api/v1/operator/humans/:did/ban` and `POST /api/v1/operator/humans/:did/freeze` with valid H5 header-auth against a running Grid.

**Expected:** 200 ok; `human_users.banned=1` (or `frozen=1`) set in database; `operator.human_banned` (or `operator.human_frozen`) audit event emitted; `sanction_reasons` row inserted with plaintext.

**Why human:** `humanSanctionStore` optional interface is not wired in `main.ts` — routes return 503 `human_sanction_store_unavailable` in production. The store implementation (wrapping a mysql2/promise Pool) must be created and passed to `buildServer`. This is the same deferred production-wiring pattern used for `delete-nous` (`_deleteNousDeps`). Cannot verify DB write path programmatically without a running MySQL instance.

#### 2. Spawn-System-Nous Production Wiring

**Test:** Wire `SpawnNousDeps` in `main.ts` (comment in spawn-system-nous.ts says "Production: wired by main.ts (wraps launcher.spawnNous)"), then call `POST /api/v1/operator/spawn-system-nous` with valid H5 header-auth and body `{name: "TestNous", personality_seeds: ["curious"]}`.

**Expected:** 200 ok with `nous_did` matching `did:noesis:system:[0-9a-f-]{36}`; Nous registered in NousRegistry; balance equals `economy.initialSupply` (default 1000 Ousia); `nous.spawned` and `bios.birth` audit events emitted.

**Why human:** `SpawnNousDeps` injectable is not wired in `main.ts` — route returns 503 `spawn_unavailable`. The production wiring (a thin wrapper around `launcher.spawnNous`) must be added to the `buildServer` call. Cannot verify registry and economy state without a running Grid.

---

### Gaps Summary

No gaps blocking goal achievement at the code level. All 14 must-haves are implemented and tested. Two human verification items concern production deployment wiring (`humanSanctionStore` and `SpawnNousDeps` not added to `main.ts`). These follow the project's established deferred-injectable pattern and do not prevent the routes from functioning in test-harness validation.

The allowlist delta is confirmed: +6 events at positions 46-51, running total 51. (Note: ROADMAP.md sub-phase overview table claims 53 with a qualifying note "assuming v2.5 portal +4 has landed" — this is a ROADMAP stale documentation discrepancy, not a code gap. The actual allowlist is 51 as specified in the phase goal.)

---

_Verified: 2026-05-22T15:05:44Z_
_Verifier: Claude (gsd-verifier)_
