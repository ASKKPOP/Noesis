---
phase: 25b-sanctions-and-spawn-wizard
plan: 14
type: execute
wave: 4
depends_on: [25b-04]
files_modified:
  - grid/src/api/operator/spawn-system-nous.ts
  - grid/src/api/operator/index.ts
  - steward/src/app/system/spawn/page.tsx
  - grid/test/operator/spawn-system-nous.test.ts
autonomous: true
requirements: [D-25b-12, D-25b-NEW-1]
tags: [spawn-wizard, h5, researcher-nous, system]

must_haves:
  truths:
    - "POST /api/v1/operator/spawn-system-nous requires H5 via header"
    - "Spawned Nous uses did:noesis:system:<uuid> DID scheme (distinct from did:noesis:human:* per Phase 27)"
    - "Spawn reuses existing nous.spawned audit event (no new allowlist member)"
    - "Spawn reuses GenesisLauncher.spawnNous → economy.initialSupply for funding (no new treasury mechanism in 25b)"
    - "Steward /system/spawn page renders wizard: name → personality seeds → confirm → spawn"
  artifacts:
    - path: "grid/src/api/operator/spawn-system-nous.ts"
      provides: "POST /api/v1/operator/spawn-system-nous, H5 header-auth, reuses GenesisLauncher.spawnNous"
      exports: ["registerSpawnSystemNousRoute"]
    - path: "steward/src/app/system/spawn/page.tsx"
      provides: "Spawn wizard UI (name + personality seeds + confirm)"
  key_links:
    - from: "spawn-system-nous.ts"
      to: "GenesisLauncher.spawnNous (grid/src/genesis/launcher.ts:444)"
      via: "Direct call — reuses the same code path Phase 22 / genesis bootstrap uses for every spawned Nous; emits nous.spawned via existing sole-producer + appendBiosBirth"
      pattern: "spawnNous"
    - from: "GenesisLauncher.spawnNous"
      to: "economy.initialSupply (grid/src/economy/config.ts:8, default 1000 Ousia)"
      via: "Existing call site — registry.spawn(..., this.economy.initialSupply) at launcher.ts:452"
      pattern: "economy.initialSupply"
    - from: "Steward /system/spawn"
      to: "POST /api/v1/operator/spawn-system-nous"
      via: "fetch with header-auth, body {name, personality_seeds}"
      pattern: "x-operator-tier"
---

<objective>
Ship the researcher Nous spawn wizard (D-25b-12): H5 operator route + Steward UI to spawn a system-tier Nous (Sophia/Hermes/Themis-class). Distinct from Phase 27's `nous.spawned_by_human` flow (different DID scheme). Reuses existing `nous.spawned` audit event — NO allowlist delta.

**Treasury decision (locked in plan-checker revision, 2026-05-21):** Reuse the existing `GenesisLauncher.spawnNous` path. That method already routes through `economy.initialSupply` (default 1000 Ousia) — the same allocation every Nous spawn (genesis seed Nous and runtime spawns alike) has used since Phase 10. **No new treasury mechanism in 25b.** A future phase may introduce a separate `system_treasury` ledger or per-spawn allocation override; that work is deferred (see CONTEXT.md `<deferred_ideas>` entry "Treasury funding mechanism for system Nous spawn").

Purpose: Operator capability to bootstrap new system Nous post-deployment, reusing the production-tested spawn path with zero new economy surface area.

Output: 1 new H5 route + Steward wizard page + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/25b-sanctions-and-spawn-wizard/25b-CONTEXT.md
@.planning/phases/25b-sanctions-and-spawn-wizard/25b-PATTERNS.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: POST /api/v1/operator/spawn-system-nous route (H5) reusing GenesisLauncher.spawnNous</name>
  <files>grid/src/api/operator/spawn-system-nous.ts, grid/src/api/operator/index.ts, grid/test/operator/spawn-system-nous.test.ts</files>
  <read_first>
    - grid/src/api/operator/cognitive-snapshot.ts (header-auth block lines ~25-90)
    - grid/src/api/operator/mute-broadcast.ts (route template from plan 09)
    - grid/src/genesis/launcher.ts lines 443-468 (existing `spawnNous(name, did, publicKey, region, humanOwner?)` method — this is the canonical spawn entry; it already calls `registry.spawn(..., this.economy.initialSupply)`, places into space, emits `nous.spawned`, and appends bios-birth. Reuse verbatim.)
    - grid/src/economy/config.ts (confirms `initialSupply: 1000` default)
    - grid/src/registry/nous-registry.ts (confirm `spawn(...)` signature and DID handling)
    - GridServices / app context (locate where the GenesisLauncher instance is exposed — likely `services.launcher` or `services.genesisLauncher`; grep `grid/src/main.ts` and `grid/src/api/operator/index.ts` to confirm)
  </read_first>
  <behavior>
    - POST /api/v1/operator/spawn-system-nous with H5 header-auth + valid body `{name: string, personality_seeds: string[]}` → 200 ok + `{nous_did}`
    - Spawned DID format: `did:noesis:system:<lowercase-hex-uuid>` (distinct from did:noesis:human:* and did:noesis:nous:* schemes)
    - Audit chain shows ONE nous.spawned event followed by ONE bios.birth event (the exact pair the existing `GenesisLauncher.spawnNous` emits — no new operator.* event for the spawn itself per D-25b-12)
    - Spawned Nous registered in NousRegistry, addressable in subsequent queries
    - Header-auth errors: 401, 403, 400 same as other H5 routes
    - Body validation: name non-empty string ≤64 chars; personality_seeds array of 1-8 non-empty strings; else 400 invalid_body
    - Funding: `economy.initialSupply` (1000 Ousia default) — automatic via the existing `GenesisLauncher.spawnNous` → `registry.spawn(..., this.economy.initialSupply)` call site. No new wallet/treasury code in this route.
    - personality_seeds are accepted in the request body for forward-compat with future personality-bootstrap work, but in 25b they are stored as a JSON blob in the audit payload metadata only — they do not yet feed into a personality bootstrap step (that work is out of scope). Document this clearly in a code comment so a future phase can wire it.
  </behavior>
  <action>
    **A. Create `grid/src/api/operator/spawn-system-nous.ts`:**

    Clone the route template from `mute-broadcast.ts` with:
    - Endpoint: `POST /api/v1/operator/spawn-system-nous` (note: no :did param — operator creates a new one)
    - Function: `registerSpawnSystemNousRoute`
    - Tier: H5 (`< 5` gate, `resolvedTier: 'H5'`)
    - Body type: `{ name?: unknown; personality_seeds?: unknown }`
    - Validation: name (string, 1-64 chars), personality_seeds (array of 1-8 non-empty strings); fail → 400 invalid_body
    - DID generation: `did:noesis:system:${crypto.randomUUID()}` (lowercase, hex+dash UUIDv4 — `randomUUID()` already lowercases by default)
    - publicKey: generate a placeholder ed25519 public key the same way GenesisLauncher does (read launcher.ts for the existing pattern — DO NOT invent a new key gen; reuse the existing helper). If the existing genesis path takes a pre-generated keypair from config, generate one inline for the runtime spawn case using `node:crypto` `generateKeyPairSync('ed25519')` → export as 'spki' DER → base64 — but ONLY if launcher.ts shows no existing helper. Confirm during implementation.
    - region: pick a default seed region (read genesis config to find the canonical "system" region name; if none distinguishable, use the same default region the first genesis Nous uses).
    - **Spawn call:** `services.launcher.spawnNous(name, generatedDid, publicKey, region)` (no humanOwner — this is a system Nous, not human-owned).
    - **Funding:** automatic via existing `economy.initialSupply` inside `spawnNous`. No additional balance manipulation in this route.
    - Return: `{ ok: true, nous_did: generatedDid }`

    Add code comment block at top documenting:
    1. D-25b-12 scope (researcher/system Nous only; NOT human-spawn)
    2. Treasury / funding: reuses `economy.initialSupply` via `GenesisLauncher.spawnNous`. Locked in plan-checker revision 2026-05-21 per CONTEXT D-25b-NEW-5 sibling entry (`<deferred_ideas>` "Treasury funding mechanism..."). Future phase may introduce a distinct system treasury.
    3. DID scheme reasoning (system: prefix distinguishes from human: per Phase 27)
    4. personality_seeds are accepted but not yet consumed by a personality-bootstrap step (forward-compat only in 25b).

    **B. Register route in `grid/src/api/operator/index.ts`** (append at end of registrar; preserve all prior plans' registrations).

    **C. Tests in `grid/test/operator/spawn-system-nous.test.ts`:**

    - Header-auth contract (4 cases at H5)
    - Body validation: missing name → 400; name too long → 400; personality_seeds empty array → 400; personality_seeds non-string entries → 400
    - Success: 200 + nous_did matching `^did:noesis:system:[0-9a-f-]{36}$`; audit chain shows nous.spawned + bios.birth pair for the generated DID; Nous registered in registry; registry record shows balance == `economy.initialSupply`
    - No new operator.* allowlist event emitted (audit chain length increase is exactly the genesis pair: +2, no operator.* delta)
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/spawn-system-nous.test.ts</automated>
  </verify>
  <done>
    - Route exists, H5 header-auth
    - Reuses GenesisLauncher.spawnNous (no new spawn machinery, no new nous.spawned producer)
    - Funding via `economy.initialSupply` — no new treasury code
    - DID scheme is did:noesis:system:*
    - Route registered in barrel
    - All tests pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Steward /system/spawn wizard UI page</name>
  <files>steward/src/app/system/spawn/page.tsx</files>
  <read_first>
    - steward/src/app/system/ (existing pages — identify routing convention)
    - steward/src/app/nous/[id]/page.tsx (Force Telos form pattern at lines ~751-839 for input + submit; header-auth fetch at ~221-231)
    - steward/src/app/nous/[id]/page.tsx (Danger Zone IrreversibilityDialog ~842-952 for final confirm-typing pattern)
  </read_first>
  <action>
    Create new file `steward/src/app/system/spawn/page.tsx` (Next.js App Router page). Layout: 3-step wizard within a single page (useState for current step):

    **Step 1 — Name:**
    - Text input for Nous name (max 64 chars)
    - Helper text: "This becomes the human-readable name. The Nous DID is auto-generated."
    - "Next" button (disabled until name non-empty)

    **Step 2 — Personality seeds:**
    - Repeating text-input rows for personality seed strings (Add Seed button; min 1, max 8)
    - Helper text: "These bootstrap the Nous's initial creed and self-model. Examples: 'patient teacher', 'skeptical empiricist'."
    - "Back" + "Next" buttons

    **Step 3 — Confirm + Spawn:**
    - Review panel showing name + all seeds
    - H5 IrreversibilityDialog-style confirm: "Type SPAWN to confirm" + reason field (≥10 chars)
    - Submit button (disabled until confirm typed + reason valid) → fetch:
      ```typescript
      const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/spawn-system-nous`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-tier': '5',
          'x-operator-id': process.env.NEXT_PUBLIC_STEWARD_OPERATOR_ID ?? 'op:00000000-0000-4000-8000-000000000001',
        },
        body: JSON.stringify({ name, personality_seeds }),
      });
      ```
    - On 200: show success banner with new nous_did and a link to /nous/[did]
    - On error: show error code

    Match existing steward-card styling. Do NOT introduce new global CSS or components.
  </action>
  <verify>
    <automated>npm --prefix steward run build</automated>
  </verify>
  <done>
    - Wizard page renders at /system/spawn
    - 3 steps with state-managed navigation
    - Final fetch uses header-auth
    - Build succeeds
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Steward UI → spawn-system-nous (H5) | Untrusted client must not claim H5 to spawn arbitrary system Nous |
| Spawn body → economy.initialSupply | Bounded automatically: every spawn allocates exactly `economy.initialSupply` (1000 default); operator cannot override the amount |
| System DID scheme → human DID scheme | Must remain distinct (D-25b-12) |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-14-01 | Elevation of Privilege | spawn-system-nous route | mitigate | H5 header-auth gate; tests pin contract |
| T-25b-14-02 | Resource Exhaustion | Repeated spawning | mitigate | Each spawn allocates fixed `economy.initialSupply` (operator cannot specify amount); body caps personality_seeds at 8 entries × bounded length; rate-limit deferred to future hardening |
| T-25b-14-03 | Tampering | DID collision with human flow | mitigate | did:noesis:system:* prefix distinct from did:noesis:human:* (Phase 27); regex assertion in tests |
| T-25b-14-04 | Repudiation | operator_id on nous.spawned | mitigate | Operator-id sourced from server-trusted header; existing nous.spawned emitter's self-report invariant validates |
</threat_model>

<verification>
- `npm --prefix grid run test -- run test/operator/spawn-system-nous.test.ts` passes
- `npm --prefix steward run build` succeeds
- `grep -c "x-operator-tier" steward/src/app/system/spawn/page.tsx` ≥ 1
- Allowlist length still 51 (no new event added) — `grep -c "^    'operator" grid/src/audit/broadcast-allowlist.ts` unchanged from plan 07 baseline
- `grep -c "spawnNous" grid/src/api/operator/spawn-system-nous.ts` ≥ 1 (confirms reuse of launcher path)
- `grep -E "(treasury|systemTreasury)" grid/src/api/operator/spawn-system-nous.ts` returns nothing (confirms no new treasury surface)
</verification>

<success_criteria>
- Spawn route ships with H5 header-auth and did:noesis:system:* scheme
- Wizard UI renders 3 steps and submits via header-auth
- No new allowlist entry; nous.spawned reused
- No new treasury mechanism; reuses `economy.initialSupply` via `GenesisLauncher.spawnNous`
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-14-SUMMARY.md`
</output>
