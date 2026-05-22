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
    - "Treasury funding source documented in code: planner-chosen mechanism"
    - "Steward /system/spawn page renders wizard: name → personality seeds → confirm → spawn"
  artifacts:
    - path: "grid/src/api/operator/spawn-system-nous.ts"
      provides: "POST /api/v1/operator/spawn-system-nous, H5 header-auth, reuses nous.spawned"
      exports: ["registerSpawnSystemNousRoute"]
    - path: "steward/src/app/system/spawn/page.tsx"
      provides: "Spawn wizard UI (name + personality seeds + confirm)"
  key_links:
    - from: "spawn-system-nous.ts"
      to: "Existing nous spawn machinery"
      via: "Reuse Phase 22/24 spawn path (read code to identify)"
      pattern: "nous.spawned"
    - from: "Steward /system/spawn"
      to: "POST /api/v1/operator/spawn-system-nous"
      via: "fetch with header-auth, body {name, personality_seeds}"
      pattern: "x-operator-tier"
---

<objective>
Ship the researcher Nous spawn wizard (D-25b-12): H5 operator route + Steward UI to spawn a system-tier Nous (Sophia/Hermes/Themis-class). Distinct from Phase 27's `nous.spawned_by_human` flow (different DID scheme, treasury-funded vs Cyber-Coin-funded). Reuses existing `nous.spawned` audit event — NO allowlist delta.

Purpose: Operator capability to bootstrap new system Nous post-deployment.

Output: 1 new H5 route + Steward wizard page + tests. Treasury funding mechanism is planner-chosen and surfaced in plan-checker review if ambiguous.
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
  <name>Task 1: POST /api/v1/operator/spawn-system-nous route (H5)</name>
  <files>grid/src/api/operator/spawn-system-nous.ts, grid/src/api/operator/index.ts, grid/test/operator/spawn-system-nous.test.ts</files>
  <read_first>
    - grid/src/api/operator/cognitive-snapshot.ts (header-auth block lines ~25-90)
    - grid/src/api/operator/mute-broadcast.ts (route template from plan 09)
    - GenesisLauncher / spawn entry point (locate via `grep -rn "nous.spawned" grid/src/` — identify the existing sole producer that emits nous.spawned; the spawn-system route must invoke this same path)
    - grid/src/registry/nous-registry.ts (how Nous are registered + DID generation pattern)
    - Phase 27 reference: Phase 27 will use `did:noesis:human:*` per ROADMAP — this route MUST use a DIFFERENT scheme `did:noesis:system:<uuid>` to keep flows distinct per D-25b-12.
  </read_first>
  <behavior>
    - POST /api/v1/operator/spawn-system-nous with H5 header-auth + valid body `{name: string, personality_seeds: string[]}` → 200 ok + `{nous_did}`
    - Spawned DID format: `did:noesis:system:<lowercase-hex-uuid>` (distinct from did:noesis:human:* and did:noesis:nous:* schemes)
    - Audit chain shows ONE nous.spawned event (no new operator.* event for the spawn itself per D-25b-12)
    - Spawned Nous registered in NousRegistry, addressable in subsequent queries
    - Header-auth errors: 401, 403, 400 same as other H5 routes
    - Body validation: name non-empty string ≤64 chars; personality_seeds array of 1-8 non-empty strings; else 400 invalid_body
    - Treasury funding mechanism: planner picks ONE of:
      a) Config-defined treasury DID (e.g. `services.config.systemTreasuryDid`) — debit a fixed startup allocation from this DID's balance
      b) Operator-pays-from-personal-allocation (operator_id has an associated balance debited)
      c) Zero-funded (Nous starts with 0 balance; researcher tops up later via separate mechanism)
    - Document the chosen mechanism in a code comment at top of the route file.
  </behavior>
  <action>
    **A. Read first to identify existing spawn machinery:**

    Run `grep -rn "appendNousSpawned\|nous.spawned" grid/src/ | head -20` to locate the sole-producer emitter and the spawn entry path used by the existing GenesisLauncher / Phase 22 human-onboard flow.

    **B. Create `grid/src/api/operator/spawn-system-nous.ts`:**

    Clone the route template from `mute-broadcast.ts` with:
    - Endpoint: `POST /api/v1/operator/spawn-system-nous` (note: no :did param — operator creates a new one)
    - Function: `registerSpawnSystemNousRoute`
    - Tier: H5 (`< 5` gate, `resolvedTier: 'H5'`)
    - Body type: `{ name?: unknown; personality_seeds?: unknown }`
    - Validation: name (string, 1-64 chars), personality_seeds (array of 1-8 non-empty strings); fail → 400 invalid_body
    - DID generation: `did:noesis:system:${randomUuid()}` (use crypto.randomUUID() or whatever pattern existing spawn code uses — clone it to keep replay determinism behavior consistent)
    - Treasury step: **planner picks**. Default to option (a) above: read `services.config.systemTreasuryDid` (add config field if not present), debit fixed allocation (e.g. 100 — confirm from existing Phase 22 onboarding allocation). If config field doesn't exist and economy code is unclear, document in code comment and raise in plan-checker review.
    - Invoke existing spawn machinery: call the same code path Phase 22 / GenesisLauncher uses to bootstrap a Nous, passing the generated DID + name + personality_seeds. This will emit nous.spawned via its existing sole-producer emitter.
    - Return: `{ ok: true, nous_did: '<generated did>' }`

    Add code comment block at top documenting:
    1. D-25b-12 scope (researcher/system Nous only; NOT human-spawn)
    2. Treasury mechanism chosen + why
    3. DID scheme reasoning (system: prefix distinguishes from human:)

    **C. Register route in `grid/src/api/operator/index.ts`.**

    **D. Tests in `grid/test/operator/spawn-system-nous.test.ts`:**

    - Header-auth contract (4 cases at H5)
    - Body validation: missing name → 400; name too long → 400; personality_seeds empty array → 400; personality_seeds non-string entries → 400
    - Success: 200 + nous_did matching `^did:noesis:system:[0-9a-f-]+$`; audit chain shows ONE new nous.spawned event with the generated DID; Nous registered in registry
    - No new operator.* allowlist event emitted (audit chain length increases by exactly 1)
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/operator/spawn-system-nous.test.ts</automated>
  </verify>
  <done>
    - Route exists, H5 header-auth
    - Reuses existing spawn machinery (no new nous.spawned producer)
    - DID scheme is did:noesis:system:*
    - Treasury mechanism documented in code
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
| Spawn body → treasury debit | Operator-supplied data must not trigger unbounded treasury drain |
| System DID scheme → human DID scheme | Must remain distinct (D-25b-12) |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-14-01 | Elevation of Privilege | spawn-system-nous route | mitigate | H5 header-auth gate; tests pin contract |
| T-25b-14-02 | Resource Exhaustion | Treasury drain | mitigate | Fixed per-spawn allocation (no operator-supplied amount); body validation caps personality_seeds at 8 entries × bounded length; rate-limit deferred to future hardening |
| T-25b-14-03 | Tampering | DID collision with human flow | mitigate | did:noesis:system:* prefix distinct from did:noesis:human:* (Phase 27); planner adds regex assertion in tests |
| T-25b-14-04 | Repudiation | operator_id on nous.spawned | mitigate | Operator-id sourced from server-trusted header; existing nous.spawned emitter's self-report invariant validates |
</threat_model>

<verification>
- `npm --prefix grid run test -- run test/operator/spawn-system-nous.test.ts` passes
- `npm --prefix steward run build` succeeds
- `grep -c "x-operator-tier" steward/src/app/system/spawn/page.tsx` ≥ 1
- Allowlist length still 51 (no new event added) — `grep -c "^    'operator" grid/src/audit/broadcast-allowlist.ts` unchanged from plan 07 baseline
</verification>

<success_criteria>
- Spawn route ships with H5 header-auth and did:noesis:system:* scheme
- Wizard UI renders 3 steps and submits via header-auth
- No new allowlist entry; nous.spawned reused
- Treasury mechanism chosen and documented
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-14-SUMMARY.md`
</output>
