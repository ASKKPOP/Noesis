# Phase 33: portal.auth.* Producers — Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Light up the `/users` directory and `/humans/[did]/history siwe_sessions` by emitting sole-producer audit events from SIWE verify + email signup/signin paths. PII (IP, UA, email plaintext, session token, signature, nonce) is permanently forbidden from the audit chain via `PORTAL_AUTH_FORBIDDEN_KEYS`.

**Originally scoped (REQ-locked):**
- OBS-08: `appendPortalAuthLogin` sole-producer (allowlist position 54)
- OBS-09: `appendPortalAuthRegister` sole-producer (allowlist position 55)
- OBS-10: `PORTAL_AUTH_FORBIDDEN_KEYS` set + `FORBIDDEN_KEY_PATTERN` word-boundary alternation extension

**Scope-expanded during discussion (locked 2026-05-25):**
- **OBS-08b**: NEW event `human.identified` (allowlist position 56) — universal identity-stamp event covering BOTH SIWE and email paths. Closed 5-key payload `{grid_name, human_did, identity_hash, identity_method, tick}`. Coexists with Phase 22's `human.joined` (preserved SIWE-only); SIWE first-connect emits both; email signup emits `human.identified` only.

**Closes:** GAP-2026-05-24-B (missing portal.auth.* producers).

**Does NOT touch:** firehose frame counters (Phase 32 territory, shipped); `/health/detailed` endpoint (Phase 32 shipped); Phase 31 `PersistentAuditChain` wiring (shipped); Steward `/system` UI cards (Phase 34); listener fan-out order; zero-diff hash chain invariant (Merkle); pre-Phase-33 `human.joined` entries (preserved unmodified per PHILOSOPHY §1).

**Foundational dependency:** Phase 31 (events must persist to MySQL for `humans.ts:97-98` consumer queries to return entries). Phase 31 already shipped.

**Cross-phase impact:** v2.6 allowlist budget revises from **+2 (53→55)** to **+3 (53→56)**. ROADMAP.md, REQUIREMENTS.md, STATE.md MUST be updated by Phase 33's plans (per CLAUDE.md Documentation Sync Rule) — NOT deferred to Phase 35 close-out.

</domain>

<decisions>
## Implementation Decisions

### Area 1: `human.identified` — new universal identity-stamp event

- **D-33-A1**: Add NEW allowlist entry `'human.identified'` at position 56. v2.6 allowlist budget revised from +2 to **+3**. Position 54 = `'portal.auth.login'`; position 55 = `'portal.auth.register'`; position 56 = `'human.identified'`. Appended at end of `ALLOWLIST_MEMBERS` in `grid/src/audit/broadcast-allowlist.ts`.

- **D-33-A2**: Closed 5-key payload (alphabetical):

  ```typescript
  interface HumanIdentifiedPayload {
      readonly grid_name: string;        // non-empty string
      readonly human_did: string;        // DID_RE (did:noesis:human:* or did:noesis:human-nous:* per Phase 28)
      readonly identity_hash: string;    // HEX64_RE (64-hex SHA-256)
      readonly identity_method: 'siwe' | 'email';  // closed enum
      readonly tick: number;             // non-negative integer
  }
  ```

  `identity_hash` computation:
    - SIWE path: `sha256(ethAddress.toLowerCase())` — IDENTICAL to Phase 22 `eth_address_hash` for the same human (allows correlation between Phase 22 `human.joined` and Phase 33+ `human.identified` entries via shared hash).
    - Email path: `sha256(email.toLowerCase().trim())` — new for v2.6.

  `identity_method` closed enum at exactly 2 values: `'siwe'`, `'email'`. Future expansion (e.g., `'passkey'`) requires explicit enum extension via a new CONTEXT.md (sole-producer gate enforces).

- **D-33-A3**: New sole-producer file `grid/src/audit/append-human-identified.ts` mirrors `append-human-joined.ts:50-114` line-by-line:
  1. Plain-object payload guard
  2. DID_RE regex guard on `human_did`
  3. HEX64_RE regex guard on `identity_hash`
  4. Closed-enum check on `identity_method` (membership in `IDENTITY_METHOD_ENUM = ['siwe', 'email'] as const`)
  5. Non-empty string guard on `grid_name`
  6. Non-negative integer guard on `tick`
  7. Closed 5-key structural check via `Object.keys(payload).sort()` strict equality
  8. Explicit reconstruction (no spread, no prototype pollution)
  9. `payloadPrivacyCheck` belt-and-suspenders
  10. `audit.append('human.identified', payload.human_did, cleanPayload)`

- **D-33-A4**: Wiring sequence at SIWE verify (`grid/src/api/portal/auth.ts` lines 116-131 region):

  ```typescript
  let human = humanRegistry.findByAddress(gridName, ethAddress);
  const isNew = human === undefined;
  if (!human) {
      human = humanRegistry.createHuman({ eth_address: ethAddress, grid_name: gridName });
      const eth_address_hash = createHash('sha256').update(ethAddress.toLowerCase()).digest('hex');

      // Phase 22 (preserved — legacy SIWE narrative continues):
      appendHumanJoined(services.audit, {
          human_did: human.did,
          eth_address_hash,
          grid_name: gridName,
          tick: services.clock.state.tick,
      });

      // Phase 33 NEW — universal identity event:
      appendHumanIdentified(services.audit, {
          grid_name: gridName,
          human_did: human.did,
          identity_hash: eth_address_hash,
          identity_method: 'siwe',
          tick: services.clock.state.tick,
      });

      // Phase 33 NEW — portal-layer register event:
      appendPortalAuthRegister(services.audit, {
          human_did: human.did,
          method: 'siwe',
          tick: services.clock.state.tick,
      });
  }
  // Phase 33 NEW — always fires on every SIWE verify success (first-connect or repeat):
  appendPortalAuthLogin(services.audit, {
      human_did: human.did,
      method: 'siwe',
      tick: services.clock.state.tick,
  });
  ```

  Order on SIWE first-connect: `human.joined → human.identified → portal.auth.register → portal.auth.login` (4 audit entries). Subsequent SIWE verify: `portal.auth.login` only (1 audit entry).

- **D-33-A5**: Wiring at email signup (`auth.ts` line ~189-194 region):

  ```typescript
  const password_hash = await hashPassword(password);
  const human = services.humanRegistry.createHuman({ email, password_hash, grid_name: gridName });
  const email_hash = createHash('sha256').update(email.toLowerCase().trim()).digest('hex');

  // Phase 33 NEW — universal identity event (NO human.joined for email — Phase 22 contract preserved):
  appendHumanIdentified(services.audit, {
      grid_name: gridName,
      human_did: human.did,
      identity_hash: email_hash,
      identity_method: 'email',
      tick: services.clock.state.tick,
  });

  appendPortalAuthRegister(services.audit, {
      human_did: human.did,
      method: 'email',
      tick: services.clock.state.tick,
  });

  appendPortalAuthLogin(services.audit, {
      human_did: human.did,
      method: 'email',
      tick: services.clock.state.tick,
  });
  ```

  Order on email signup: `human.identified → portal.auth.register → portal.auth.login` (3 audit entries). NO `human.joined` for email humans — `human.joined` remains the Phase 22 SIWE-specific birth event with required `eth_address_hash`.

- **D-33-A6**: Wiring at email signin (`auth.ts` line ~252 region, after `valid` check passes, before JWT issuance):

  ```typescript
  appendPortalAuthLogin(services.audit, {
      human_did: human.did,
      method: 'email',
      tick: services.clock.state.tick,
  });
  ```

  Order on email signin: `portal.auth.login` only (1 audit entry, mirrors subsequent SIWE).

- **D-33-A7**: Pre-Phase-33 `human.joined` entries preserved **unmodified**. PHILOSOPHY §1 first-life promise + Merkle hash chain invariant (`chain.ts:181` `eventHash = SHA256(prevHash | eventType | actorDid | JSON.stringify(payload) | timestamp)`) preclude any payload rewrite. Zero data migration script. Consumers handle both events as canonical going forward:
  - Pre-Phase-33 SIWE humans: identified via `human.joined` (4-key, has `eth_address_hash`)
  - Phase 33+ SIWE humans: identified via BOTH `human.joined` AND `human.identified`
  - Phase 33+ email humans: identified via `human.identified` ONLY (with `identity_method: 'email'`)

  `humans.ts:97-98` `/users` consumer queries `portal.auth.register` (Phase 33+) for the universal "new human" lookup. For historical SIWE humans pre-Phase-33, also queries `human.joined`. Union by `human_did`. Phase 34 visualizes.

### Area 2: portal.auth.* producers (OBS-08, OBS-09, OBS-10) — REQ-locked

- **D-33-B1**: `appendPortalAuthLogin(audit, { human_did, method, tick })` at `grid/src/audit/append-portal-auth-login.ts`. Closed 3-key payload, `method ∈ {'siwe', 'email'}` (closed enum via `LOGIN_METHOD_ENUM = ['siwe', 'email'] as const`). Same triad discipline as `appendHumanJoined`. Wired into SIWE verify (line ~131, ALWAYS, regardless of isNew) AND email signup (line ~217, after `appendPortalAuthRegister`) AND email signin (line ~265, after valid check). Emits at allowlist position 54.

- **D-33-B2**: `appendPortalAuthRegister(audit, { human_did, method, tick })` at `grid/src/audit/append-portal-auth-register.ts`. Same closed 3-key payload + closed enum + DID_RE + integer-guard + structural triad discipline. Wired into SIWE verify FIRST-CONNECT path (inside `if (!human)`, after `appendHumanJoined` + `appendHumanIdentified`) AND email signup (after `appendHumanIdentified`). Emits at allowlist position 55.

- **D-33-B3**: `PORTAL_AUTH_FORBIDDEN_KEYS` declared in `grid/src/audit/broadcast-allowlist.ts` as `Object.freeze([...] as const)`, exactly 13 keys: `ip_address`, `ip`, `user_agent`, `ua`, `session_id`, `token`, `jwt`, `cookie`, `email`, `password_hash`, `nonce`, `signature`, `device_fingerprint`. Sibling-position to other `*_FORBIDDEN_KEYS` exports (DRIVE/BIOS/CHRONOS/GOVERNANCE/IRIS/HYPNOS/SKILL/NORM/LORE/WHISPER).

- **D-33-B4**: `FORBIDDEN_KEY_PATTERN` extension uses **word-boundary anchored alternation** for the 6 multi-word / word-collision-risk keys:

  ```typescript
  // Existing pattern ends with: ...|reflexion_text|creed_text|whisper_plaintext/i
  // Phase 33 appends: |\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b
  ```

  Word-boundary regex `\b...\b` prevents false-positive matches on legitimate keys. Test fixtures REQUIRED (R-33-01 mitigation):
    - `email_hash` (allowed in any payload) vs `email` (forbidden) — verifies non-word-boundary behavior on `email`
    - `nonce_hash` (allowed) vs `nonce` (forbidden) — verifies non-word-boundary behavior on `nonce`
    - `ip_country` (allowed — future OBS-FUTURE-METRICS-01) vs `ip_address` and `ip` (forbidden) — verifies `ip` non-bounded vs `ip_address` bounded
    - `user_agent_version` (still forbidden — `\buser_agent\b` matches via leading boundary) vs `agent_version` (allowed)

  Test count: **at least 12 forbidden-keys regression test cases** (flat + nested object + nested array), per ROADMAP R-33-01.

- **D-33-B5**: Single sole-producer per event type — enforced by new CI gate (D-33-D1) and code review. Only `append-portal-auth-login.ts` may call `audit.append('portal.auth.login', ...)`. Only `append-portal-auth-register.ts` may call `audit.append('portal.auth.register', ...)`. Only `append-human-identified.ts` may call `audit.append('human.identified', ...)`. Mirrors Phase 22 (`human.joined`) + Phase 27 (`human.spoke`) + Phase 28 (`nous.spawned_by_human`) discipline.

### Area 3: perf benchmark — soft-log behavior

- **D-33-C1**: `grid/src/__tests__/audit-query-perf.test.ts` ships as a **soft-log perf monitor** — NOT a hard-assert CI gate. Test structure:

  ```typescript
  test('audit.query({eventType, actorDid}) p95 perf with 100k entries', () => {
      const chain = new AuditChain();
      // Seed 100k entries spanning multiple event types and actor DIDs
      // Run audit.query({eventType: 'portal.auth.login', actorDid: testDid}) 100 times
      // Compute p95 of measured latencies
      console.log(`[perf] audit.query p95 at 100k entries: ${p95.toFixed(2)}ms (target <50ms)`);
      // NO expect().toBeLessThan() — benchmark visible in CI history, no CI fail on regression
  });
  ```

  Aligns with REQ R-33-02 phrasing "If exceeded, OBS-FUTURE-INDEX-01 triggers as v2.7 work" — human-triggered, not CI-forced. Trend monitoring is operator's responsibility via CI log inspection. If/when p95 trends above 50ms, OBS-FUTURE-INDEX-01 (in-memory index-by-event-type map inside `AuditChain`) is opened as a v2.7 deliverable.

### Area 4: sole-producer discipline gate — audit-wide retrospective

- **D-33-D1**: `scripts/check-sole-producer-discipline.mjs` greps **all sole-producer files** across the codebase:
  - `grid/src/audit/append-*.ts` (13 existing + 3 new in Phase 33 = 16 after Phase 33)
  - `grid/src/ananke/append-drive-crossed.ts` (1)
  - `grid/src/bios/appendBiosBirth.ts`, `appendBiosDeath.ts` (2)
  - `grid/src/sleep/appendNousSleepEntered.ts`, `appendNousSleepCompleted.ts` (2)
  - `grid/src/iris/append*.ts` (4 files)
  - `grid/src/skills/append*.ts` (3 files)
  - `grid/src/norms/append*.ts` (2 files)
  - `grid/src/lore/append*.ts` (2 files)
  - `grid/src/governance/append*.ts` (4 files)
  - `grid/src/whisper/appendNousWhispered.ts` (1)

  Total after Phase 33 ships: ~38 files. Gate enforces every file contains all three of:
    1. `Object.keys(payload).sort()` — structural closed-tuple check
    2. `payloadPrivacyCheck` — privacy gate
    3. `audit.append(` — chain commit

  Gate fails (non-zero exit) if ANY file omits ANY of the three. Wired into `.github/workflows/rig-invariants.yml` as step `"OBS-09 sole-producer-discipline gate (Phase 33)"` alongside Phase 31 + 32 gates.

- **D-33-D2**: Pre-Phase-33 sole-producer files that don't conform to the triad get fixed under Phase 33 surgical cleanup-opportunistic scope. Expectation: most/all already conform (research + spot-check of `append-human-joined.ts` + `append-human-spoke.ts` + `append-human-transferred.ts` confirmed Phase 22+ pattern). Any divergence is fixed in a dedicated Phase 33 plan with explicit per-file diff justification.

- **D-33-D3**: `scripts/check-state-doc-sync.mjs` already exists from prior phases — Phase 33 **extends** it to assert:
  - `ALLOWLIST_MEMBERS.length === 56` (was checking 53; revised target 56)
  - Position 54 is `'portal.auth.login'`
  - Position 55 is `'portal.auth.register'`
  - Position 56 is `'human.identified'`

  Per ROADMAP §Phase 33 SC#4: "CI gate `scripts/check-state-doc-sync.mjs` asserts the literal count." Phase 33 D-33-A1 revises the literal count from 55 to 56.

### Area 5: auth.ts console cleanup — surgical only

- **D-33-E1**: Phase 33 modifies `grid/src/api/portal/auth.ts` **ONLY** at the new producer call sites (SIWE verify lines 125-131 region, email signup line ~189 region, email signin line ~252 region). The pre-existing `console.warn` at L308-312 (`/me` route) and `console.error` at L356 (`PATCH /me` route) are LEFT UNCHANGED. Per CLAUDE.md §3 Surgical Changes: "Don't 'improve' adjacent code". Phase 31 CI gate `check-no-silent-catch.mjs` scopes only `grid/src/db/` + `grid/src/audit/` — `grid/src/api/` is out-of-scope and remains so.

- **D-33-E2**: Deferred to v2.7+ backlog: a follow-up logger-consistency phase that migrates `grid/src/api/**` console.* calls to Pino structured logs. Captured in `<deferred>` below.

### Area 6: Documentation Sync (NEW — required by Phase 33 scope expansion)

- **D-33-F1**: Allowlist budget revised: v2.6 ROADMAP / REQUIREMENTS / STATE currently document "+2 (53→55)". With `human.identified` added per D-33-A1, the correct value is **+3 (53→56)**. Per CLAUDE.md Documentation Sync Rule, these files MUST be updated **by Phase 33's plans** (not deferred to Phase 35 close-out). Files affected:
    - `.planning/ROADMAP.md` §"Phase 33: portal.auth.* Producers" — update "Allowlist additions: +2" → "+3", add `human.identified` to running total, update success criteria #4 from "55 members" to "56 members", append `human.identified` to v2.6 allowlist growth ledger
    - `.planning/REQUIREMENTS.md` — add **OBS-08b**: "`appendHumanIdentified` sole-producer file at `grid/src/audit/append-human-identified.ts`, closed 5-key payload `{grid_name, human_did, identity_hash, identity_method, tick}`, `identity_method ∈ {'siwe', 'email'}` closed enum, allowlist position 56, wired into SIWE first-connect AND email signup paths. Pre-Phase-33 `human.joined` entries preserved unmodified per PHILOSOPHY §1."
    - `.planning/STATE.md` — update v2.6 allowlist additions section, Phase 33 budget delta (53→56), carry-forward `human.identified` invariants
    - These doc updates ship in the **FIRST** Phase 33 plan (33-01-DOC-SYNC.md or 33-01-PLAN.md) BEFORE producer code so downstream plans + executor see the right invariants throughout.

- **D-33-F2**: PHILOSOPHY.md and README.md updates remain deferred to Phase 35 close-out per existing Documentation Sync Rule cadence. Phase 33 touches the `.planning/*` drivers only (these drive Phase 33's own execution).

### Claude's Discretion

- **Exact `append-human-identified.ts` line-by-line structure** — planner mirrors `append-human-joined.ts:50-114`. Identity-method enum check is a new validation block before the structural check (placement: after DID_RE/HEX64_RE regex guards, before non-empty-string guard).
- **Test file organization** — bundled `portal-auth-events.test.ts` OR split into discrete files. Recommendation: SPLIT for clarity given 12+ forbidden-key cases would dominate a single file:
  - `portal-auth-login.test.ts` (producer-level discipline)
  - `portal-auth-register.test.ts` (producer-level discipline)
  - `human-identified.test.ts` (producer-level discipline)
  - `portal-auth-forbidden-keys.test.ts` (12+ word-boundary cases, flat + nested)
  - `portal-auth-wiring.test.ts` (emit-count + emit-order assertions per call site)
- **Wiring test depth** — minimum cases: (a) SIWE first-connect emits 4 events in `human.joined → human.identified → portal.auth.register → portal.auth.login` order, (b) SIWE repeat-connect emits 1 event (`portal.auth.login` only), (c) email signup emits 3 events in `human.identified → portal.auth.register → portal.auth.login` order, (d) email signin emits 1 event (`portal.auth.login` only), (e) forbidden-keys gate rejects all 13 keys flat + nested.
- **Perf benchmark seeding strategy** — 100k entries spanning multiple `eventType`s and `actorDid`s (so the query filter is non-trivial). Test runner: vitest with `console.log` p95 output. Skip integration with real DB.
- **CI gate workflow step naming** — `"OBS-09 sole-producer-discipline gate (Phase 33)"` matches Phase 31/32 naming convention. Planner's call on exact step label.
- **R-33-01 mitigation depth** — REQ says 12+ regression tests for forbidden keys. Planner adds more if any new corner case discovered during implementation (e.g., camelCase variants `ipAddress`, `userAgent`). Word-boundary regex tested in both directions.
- **Doc sync commit boundary** — D-33-F1 ROADMAP/REQUIREMENTS/STATE updates can ship as plan 33-01 (front) OR as a dedicated plan 33-DOC-SYNC at the very front. Planner's call; recommendation: dedicated DOC-SYNC plan first so downstream plans are read-aligned.
- **Migration of any non-conforming pre-Phase-33 sole-producer files** (D-33-D2) — if `check-sole-producer-discipline.mjs` flags any of the 35 pre-existing files, fix in surgical scope inside a per-file plan with explicit diff justification. Expectation: zero flags after spot-checks.

### Folded Todos

None — no pending todos matched Phase 33 scope at discuss time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### v2.6 Source-of-Truth

- `.planning/REQUIREMENTS.md` §"OBS — Missing portal.auth.* Producers (Phase 33)" — OBS-08/09/10 lock file paths, payload shapes, forbidden keys, success criteria. **Phase 33 D-33-F1 will append OBS-08b for `human.identified` to this file.**
- `.planning/ROADMAP.md` §"Phase 33: portal.auth.* Producers" — goal, success criteria, risks R-33-01/02/03, allowlist delta (currently +2; Phase 33 D-33-A1 revises to +3)
- `.planning/STATE.md` §"v2.6 Key Decisions (locked 2026-05-24)" — portal.auth.* payload shape (3-key closed tuple); PORTAL_AUTH_FORBIDDEN_KEYS list; freeze-except-by-explicit-addition rule
- `.planning/STATE.md` §"v2.6 allowlist additions" — current planned target 55; Phase 33 D-33-A1 revises to 56
- `.planning/STATE.md` §"v2.6 Phase 31 close-out" — Pino logger singleton, structured event convention, CI gate workflow integration pattern
- `.planning/research/v2.6/OBSERVABILITY-HARDENING.md` §"GAP-B Deep Dive" + §"Sole-producer file plan" + §"Pitfalls 4, 6" — payload design rationale, sole-producer triad, perf concern (R-33-02), word-boundary regex anchors

### Phase 22 Inherited Patterns (Mirror discipline line-by-line)

- `grid/src/audit/append-human-joined.ts` (lines 50-114) — **CANONICAL TEMPLATE**. `append-human-identified.ts` + `append-portal-auth-{login,register}.ts` mirror line-by-line: payload type guard → regex guards → enum check (new in Phase 33) → integer guard → structural triad → explicit reconstruction → privacy check → audit.append
- `grid/src/audit/append-human-spoke.ts` — Phase 27 pattern with hashed user input (msg_hash). Reference for SHA-256 hashing pattern at the producer boundary
- `grid/src/audit/append-human-transferred.ts` — Phase 24 pattern with closed payload sans sensitive fields. Reference for "what NOT to put in payload" discipline
- `grid/src/audit/append-nous-spawned-by-human.ts` — Phase 28 pattern with cross-prefix DID handling (`human:` and `human-nous:` segments). Reference for DID_RE allowing colons.

### Phase 31 Inherited Surfaces

- `.planning/phases/31-audit-pipeline-persistence/31-CONTEXT.md` §D-31-B1/B2/B3 — Pino logger singleton at `grid/src/util/logger.ts`; `.child({ module: 'name' })` per-module convention; closed-shape `{ event, ... }` structured log convention
- `grid/src/util/logger.ts` — Phase 31 singleton; `logger.warn({ event: '...', ... }, '...')` closed-shape convention (Phase 33 producers emit no logs themselves; the chain handles persistence logging via Phase 31)
- `scripts/check-no-silent-catch.mjs` (Phase 31 gate) — pattern reference for `scripts/check-sole-producer-discipline.mjs` discipline + `.github/workflows/rig-invariants.yml` step shape

### Phase 32 Inherited Surfaces

- `.planning/phases/32-firehose-observability/32-CONTEXT.md` §D-32-D1 — CI gate naming convention `"OBS-R-N-NN gate (Phase N)"`; workflow step integration in `rig-invariants.yml`; gate scope philosophy ("narrowest scope that locks the discipline without false-positive risk")
- `scripts/check-observability-no-todo.mjs` + `scripts/check-interval-lifecycle.mjs` (Phase 32 gates) — pattern reference for new Phase 33 sole-producer gate

### Phase 22 + 27 + 28 Cross-Reference

- `grid/src/audit/broadcast-allowlist.ts` lines 80-206 — current 53-entry allowlist; Phase 33 appends positions 54/55/56 at end (NOT inserted mid-list). Comment block convention follows Phase 28's `nous.spawned_by_human` pattern.
- `grid/src/audit/broadcast-allowlist.ts` lines 241-407 — existing `*_FORBIDDEN_KEYS` exports; `PORTAL_AUTH_FORBIDDEN_KEYS` added as new sibling export at end
- `grid/src/audit/broadcast-allowlist.ts` line 444 — `FORBIDDEN_KEY_PATTERN` regex; Phase 33 appends word-boundary alternation `|\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b`
- `grid/src/audit/chain.ts` line 181 — `eventHash = SHA256(prevHash | eventType | actorDid | JSON.stringify(payload) | timestamp)`. **Merkle invariant — Phase 33 changes NOTHING here**; pre-Phase-33 entries preserved unmodified.

### Code Anchors (existing — Phase 33 modifies or aligns with)

- `grid/src/api/portal/auth.ts` line 125 — existing `appendHumanJoined` call inside `if (!human)` SIWE block. Phase 33 adds `appendHumanIdentified` + `appendPortalAuthRegister` AFTER it (still inside the `if (!human)` block).
- `grid/src/api/portal/auth.ts` line ~131 (after `if (!human)` closes) — Phase 33 adds `appendPortalAuthLogin` (fires every SIWE verify success, not just first-connect).
- `grid/src/api/portal/auth.ts` line ~189-194 — email signup createHuman block. Phase 33 adds `appendHumanIdentified` + `appendPortalAuthRegister` + `appendPortalAuthLogin` AFTER createHuman.
- `grid/src/api/portal/auth.ts` line ~252 (after `valid` check passes) — email signin. Phase 33 adds `appendPortalAuthLogin` only.
- `grid/src/api/routes/humans.ts` lines 97-98 — `audit.query({ eventType: 'portal.auth.login', actorDid: did })` + `audit.query({ eventType: 'portal.auth.register', actorDid: did })`. CONSUMER already wired — Phase 33 just supplies producers.
- `grid/src/audit/types.ts` — `AuditEntry` shape; no changes from Phase 33.
- `package.json` (grid workspace) — NO new dependencies. SIWE `siwe` library already used (Phase 22). Pino already direct dep (Phase 31). Node `crypto.createHash` for identity hashing.
- `.github/workflows/rig-invariants.yml` — add new Phase 33 step `"OBS-09 sole-producer-discipline gate (Phase 33)"`

### Files NOT to Touch in Phase 33

- `grid/src/audit/chain.ts` — base `AuditChain.append` and listener fan-out order (zero-diff invariant since 29c3516; Phase 31 R-31-01 regression test pins this)
- `grid/src/db/persistent-chain.ts` — Phase 31 territory; structured-logging shape locked
- `grid/src/db/audit-reconcile.ts` — Phase 31 territory
- `grid/src/audit/firehose-hub.ts` — Phase 32 territory; frame counters frozen
- `grid/src/diagnostics/health-watchdog.ts` — Phase 32 territory
- `grid/src/api/routes/health-detailed.ts` — Phase 32 territory
- Pre-Phase-33 `human.joined` entries in chain (in-memory + MySQL `audit_trail`) — Merkle invariant; PHILOSOPHY §1 first-life promise
- `grid/src/api/portal/auth.ts` lines 308-312 + 356 — `console.warn`/`console.error` cleanup is DEFERRED (D-33-E1)
- `grid/src/api/portal/auth.ts` JWT issuance blocks, cookie config, nonce store — Phase 22-territory, no changes

### Project-Wide Invariants

- `PHILOSOPHY.md` §1 (sovereignty + first-life promise — audit entries retained forever, NEVER rewritten); §7 (broadcast allowlist frozen-except-by-explicit-addition — Phase 33 adds 3 new); §8 (zero custody, no PII)
- `CLAUDE.md` §"Documentation Sync Rule (user-mandated, 2026-04-20)" — Phase 33 plans MUST sync ROADMAP/REQUIREMENTS/STATE for allowlist 53→56 revision in the same commit chain as the producer code (D-33-F1)
- `CLAUDE.md` §"Surgical Changes" — Phase 33 leaves auth.ts:308-312 + 356 console.* calls alone (D-33-E1)
- `.planning/MILESTONES.md` — v2.6 ongoing; Phase 33 will be logged here at v2.6 close (Phase 35 territory)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`appendHumanJoined` sole-producer template** (`grid/src/audit/append-human-joined.ts`, 114 lines) — mirror EXACTLY for `append-human-identified.ts`, `append-portal-auth-login.ts`, `append-portal-auth-register.ts`. Single-file pattern: type guard → regex guards → enum check (Phase 33 specific) → integer guard → closed-tuple structural check → explicit reconstruction → privacy check → audit.append.
- **`createHash` SHA-256 lowercased pattern** (`auth.ts:121-123`) — already used for `eth_address_hash`. Phase 33 reuses for `identity_hash` (SIWE shares the value byte-for-byte) and computes new `email_hash` via `.toLowerCase().trim()` for email input normalization.
- **`payloadPrivacyCheck` + `FORBIDDEN_KEY_PATTERN`** (`broadcast-allowlist.ts:444, 460`) — already does recursive object/array walking. Phase 33 extends pattern with word-boundary alternation; no walker change needed.
- **`*_FORBIDDEN_KEYS` export sibling pattern** — DRIVE/BIOS/CHRONOS/GOVERNANCE/IRIS/HYPNOS/SKILL/NORM/LORE/WHISPER all use `Object.freeze([...] as const)` pattern. `PORTAL_AUTH_FORBIDDEN_KEYS` follows same shape.
- **Pino logger singleton** (Phase 31) — Phase 33 producers do NOT add log statements at `audit.append` time (the chain handles its own persistence logging via Phase 31). If wiring sites need error-path logging (e.g., audit.append throws on closed-tuple violation), use `logger.child({ module: 'portal-auth' })`.
- **`services.audit`, `services.clock.state.tick`, `services.gridName`** (FastifyInstance scope in `auth.ts`) — already available at all 4 wiring sites. No new plumbing.
- **`humanRegistry.findByAddress` / `createHuman` / `findByEmail`** — Phase 22 existing surfaces. Phase 33 doesn't modify these.
- **DID_RE + HEX64_RE** exports from `append-human-joined.ts` — reusable across all 3 new producer files (Phase 28 update allows `human:` and `human-nous:` segments).

### Established Patterns

- **Sole-producer file + sole-import call site** — Phase 22 `appendHumanJoined` imported only by `auth.ts:23`. Phase 27 `appendHumanSpoke` imported only by `chat.ts:27`. Phase 33 mirrors: `append-human-identified` imported only by `auth.ts`; `append-portal-auth-{login,register}` imported only by `auth.ts`. CI gate D-33-D1 enforces.
- **`createHuman` + sole-producer call as a pair** — at Phase 22 SIWE first-connect: `createHuman → eth_address_hash → appendHumanJoined`. Phase 33 extends: `createHuman → identity_hash → appendHumanJoined (SIWE only) → appendHumanIdentified → appendPortalAuthRegister`. Then unconditionally: `appendPortalAuthLogin`.
- **DID_RE allows colons in segments** (`append-human-joined.ts:31`) — Phase 28 update; supports `did:noesis:human:0xabc...` and `did:noesis:human-nous:...`. Phase 33 uses the same regex.
- **HEX64_RE for SHA-256 hashes** (`append-human-joined.ts:24`) — Phase 33 uses the SAME export. No new HEX regex.
- **Allowlist append at END (positions monotonically grow)** — never inserted mid-list. Phase 33 positions 54, 55, 56 appended in this exact order. Comment block follows Phase 28 `nous.spawned_by_human` convention.
- **Closed-enum validation via `as const` tuple + `.includes(value)`** — Phase 33 `method ∈ {'siwe', 'email'}` and `identity_method ∈ {'siwe', 'email'}` use `const METHOD_ENUM = ['siwe', 'email'] as const` + `METHOD_ENUM.includes(payload.method)` at producer boundary.

### Integration Points

- `grid/src/api/portal/auth.ts` — 4 producer call site insertions (SIWE verify isNew block, SIWE verify unconditional, email signup, email signin). NO other route changes; JWT/cookie/nonce code untouched.
- `grid/src/audit/broadcast-allowlist.ts` — 3 allowlist entries appended (54, 55, 56) + 1 new `PORTAL_AUTH_FORBIDDEN_KEYS` const export + 1-line regex extension at `FORBIDDEN_KEY_PATTERN`.
- `grid/src/audit/append-*.ts` — 3 new files created.
- `scripts/check-sole-producer-discipline.mjs` (NEW) — audit-wide grep gate.
- `scripts/check-state-doc-sync.mjs` — extend existing assertions for new allowlist count + positions.
- `.github/workflows/rig-invariants.yml` — add 1 new step for the new gate.
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — D-33-F1 doc sync updates in plan 33-01 (or 33-DOC-SYNC).

### Files Created by Phase 33

- `grid/src/audit/append-human-identified.ts` (~120 lines, mirrors append-human-joined.ts shape with method enum + 5-key payload)
- `grid/src/audit/append-portal-auth-login.ts` (~110 lines, 3-key payload with method enum)
- `grid/src/audit/append-portal-auth-register.ts` (~110 lines, 3-key payload with method enum)
- `grid/test/portal-auth-login.test.ts` (or bundled — planner's call)
- `grid/test/portal-auth-register.test.ts`
- `grid/test/human-identified.test.ts`
- `grid/test/portal-auth-forbidden-keys.test.ts` — 12+ test cases for forbidden-key gate (flat + nested + word-boundary corner cases)
- `grid/test/portal-auth-wiring.test.ts` — emit-count + emit-order assertions per wiring site
- `grid/src/__tests__/audit-query-perf.test.ts` — 100k-entry perf benchmark (soft-log only per D-33-C1)
- `scripts/check-sole-producer-discipline.mjs` (NEW gate)
- `.planning/phases/33-portal-auth-producers/33-HUMAN-UAT.md` (operator playbook: verify `/users` directory non-empty after at least one SIWE login + one email signin; check `audit.query` returns entries; tail Pino logs for any unexpected error events; verify `human.joined` from pre-Phase-33 entries still query correctly)

</code_context>

<specifics>
## Specific Ideas

- **Audit chain narrative for SIWE first-connect (Phase 33+):** chain reads as 4 sequential entries `human.joined → human.identified → portal.auth.register → portal.auth.login`. Operators tail logs and see: "Phase 22 birth → Phase 33 identity stamp → portal-layer registration → portal-layer session start". Each entry has a distinct semantic role; combined they're the complete first-time-here narrative.

- **Audit chain narrative for email signup (Phase 33+):** 3 sequential entries `human.identified → portal.auth.register → portal.auth.login`. NO `human.joined` for email humans — that event remains Phase 22 SIWE-specific. The asymmetry between SIWE (4 entries) and email (3 entries) is deliberate and preserves Phase 22's `eth_address_hash` invariant.

- **identity_hash design intent:** `identity_hash` for SIWE EQUALS the existing `eth_address_hash` byte-for-byte (both are `sha256(ethAddress.toLowerCase())`). This enables correlation between Phase 22 `human.joined` entries and Phase 33+ `human.identified` entries for the same SIWE human — they share the same hash. For email humans, `identity_hash = sha256(email.toLowerCase().trim())` is a NEW privacy-preserved identifier with no Phase 22 analog.

- **Word-boundary regex anchoring is load-bearing** — the existing `FORBIDDEN_KEY_PATTERN` has 50+ alternations without word boundaries (e.g., `content(?!_hash)` uses lookahead). Phase 33's word-boundary additions (`\b...\b`) are the FIRST time the regex uses word boundaries. Test coverage MUST include `email_hash` (allowed) vs `email` (forbidden) AND `nonce_hash` (allowed) vs `nonce` (forbidden) to verify boundary semantics — these are the canonical "allowed-when-hashed" pairs.

- **No `__portal_auth_*` Brain-private prefixes** — unlike Phase 20 lore (`__lore_request:`, `__lore_response:` whisper prefixes), Phase 33 events are purely Grid-side. No Brain↔Grid wire concerns. The producer boundary is in `grid/src/api/portal/auth.ts` (HTTP handler), not at the Brain interface.

- **Phase 33 doc sync ships FIRST plan, not last** — per D-33-F1, the ROADMAP/REQUIREMENTS/STATE updates to reflect allowlist 53→56 (instead of 55) ship as plan 33-01 BEFORE any producer code. This is the inverse of Phase 31/32 where docs were last. Reason: downstream plans/agents read these docs; if they see "55" while producing code that lands at "56", everything diverges.

- **Cutover dance respects user's persistent operational rules** (per memory): "Always push to git after committing" + "Rebuild Grid Docker after every source change". Phase 33 33-HUMAN-UAT.md mirrors Phase 31/32 — `docker compose build grid && docker compose up -d grid` is the cutover step before any verification.

- **`human.identified` design has a future evolution path:** if a 3rd auth method ships (e.g., passkey/WebAuthn), `identity_method` extends to `'passkey'` and a new SHA-256 input applies. This is a v2.7+ allowlist decision (extending a closed enum), NOT a payload shape change. Closed-enum + sole-producer gate would catch any unauthorized 4th value at structural check time.

- **Email-hash one-way** — `identity_hash = sha256(email.toLowerCase().trim())` is irreversible. Operators cannot recover the email from the chain. This is by design — PHILOSOPHY §8 zero PII on the wire. If future analytics need email-level correlation, that's `email_hash` as a sibling field in OBS-FUTURE-METRICS-01 (v2.7+), NOT a chain-side decryption story.

</specifics>

<deferred>
## Deferred Ideas

### Carried into Phase 34 (Steward `/system` Health Surfaces)

- Steward `/users` directory consumer adaptation — Phase 34 territory. `/users` page reads `audit.query({eventType: 'portal.auth.register'})` (universal Phase 33+) AND `audit.query({eventType: 'human.identified'})` (universal identity stamp Phase 33+) AND `audit.query({eventType: 'human.joined'})` (legacy SIWE pre-Phase-33) to build the unified human directory. Phase 33 supplies the events; Phase 34 visualizes them.

### Carried into Phase 35 (UAT + Doc Sync)

- PHILOSOPHY.md broadcast-allowlist paragraph update from "53 events" to "56 events, frozen as of Phase 33" with note on PORTAL_AUTH_FORBIDDEN_KEYS and word-boundary regex discipline
- README.md Project Status section appends v2.6 SHIPPED line (with allowlist 53→56, not 53→55)
- MILESTONES.md v2.6 close entry (allowlist 53 → 56, summarize Phase 33 deliverables including `human.identified`)
- Re-run 25a-HUMAN-UAT items #1 + #5c with live data
- Cross-reference audit per CLAUDE.md Documentation Sync Rule

### Out of scope for v2.6 entirely (post-shipped to v2.7+ if warranted)

- **OBS-FUTURE-METRICS-01**: `ua_hash` and `ip_country` payload extensions for `portal.auth.*` and `human.identified` events if analytics need surfaces. Closed `identity_method` enum stays at 2 values for v2.6.
- **OBS-FUTURE-INDEX-01**: In-memory index-by-event-type map inside `AuditChain` if `audit.query({eventType, actorDid})` p95 exceeds 50ms at 100k+ entries. Triggered by Phase 33 D-33-C1 soft-log perf benchmark observations.
- **OBS-FUTURE-OTEL-01**: OpenTelemetry self-hosted via `@fastify/otel`. Phase 31 deferral; remains deferred.
- **Passkey/WebAuthn auth method**: extends `identity_method` enum to a 3rd value `'passkey'`. New allowlist entry NOT needed (just enum extension via new CONTEXT.md).
- **Email-path `human.joined.email` event** (would be allowlist 57): explicitly rejected per Phase 33 D-33-A4 — email humans use `human.identified` instead.
- **Migrate pre-Phase-33 `human.joined` entries to 5-key shape**: explicitly rejected per Phase 33 D-33-A7 — Merkle invariant (`chain.ts:181`) + PHILOSOPHY §1 forbid. Consumers handle both shapes.
- **Logger-consistency phase for `grid/src/api/**`**: migrate `auth.ts:308-312 + 356` console.warn/error to Pino structured logs. Captured per D-33-E2. v2.7+ if surface area grows.
- **Cleanup of any `app.log.warn` calls** in portal/wallet.ts:63 (Phase 24) etc. — these ARE Pino via Fastify, no cleanup needed.

### Scope-creep ideas redirected during discussion

- "Should pre-Phase-33 `human.joined` entries be rewritten to include `identity_method: 'siwe'`?" — **REJECTED**. Merkle hash chain (chain.ts:181) rewriting breaks the chain head hash and every CI test that pins it. PHILOSOPHY §1 first-life promise also forbids.
- "Should `human.joined` be deprecated and removed from the allowlist?" — **REJECTED**. Removing allowlist entries violates PHILOSOPHY §7 frozen-except-by-explicit-addition. Legacy events stay in allowlist forever.
- "Should the perf benchmark hard-fail CI?" — **REJECTED** per D-33-C1. Aligns with REQ R-33-02 "triggers as v2.7 work" (human-driven, not CI-forced).
- "Should the sole-producer discipline gate cover only Phase 33's 3 files?" — **REJECTED** per D-33-D1. Audit-wide retrospective gives strongest invariant + locks future patterns.
- "Should auth.ts console.warn/error be cleaned up opportunistically?" — **REJECTED** per D-33-E1. CLAUDE.md §3 Surgical Changes; defer to dedicated logger-consistency phase.
- "Should `human.identified` payload be 4-key (variant) or 3-key (drop identity_hash for email)?" — **REJECTED** per D-33-A2. 5-key unified shape (`identity_hash` + `identity_method`) is the user's chosen design for narrative coherence.
- "Should `human.identified` REPLACE `human.joined` on SIWE first-connect (single-emit going forward)?" — **REJECTED** per D-33-A4. Both fire for the transition period to preserve Phase 22 narrative; allowing legacy consumers to continue without forced migration.

</deferred>

---

*Phase: 33-portal-auth-producers*
*Context gathered: 2026-05-25*
