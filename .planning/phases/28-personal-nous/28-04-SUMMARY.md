---
phase: 28-personal-nous
plan: "04"
subsystem: dashboard/portal/spawn
tags: [dashboard, portal, wizard, wagmi, payment, spawn, ui]
dependency_graph:
  requires:
    - 28-03 (spawn API routes: POST /spawn, GET /spawn/status/:txHash, GET /spawn/config, GET /spawn/check-name, GET /me/nous)
  provides:
    - 4-step spawn wizard at /portal/nous/spawn
    - Mount guard redirecting existing Nous owners to /portal/my-nous
    - wagmi USDT transfer + 3s-poll / 120s-timeout payment confirmation
    - All error states: payment_failed, already_owns, spawn_not_enabled, timeout
  affects:
    - dashboard/src/app/portal/nous/spawn/ (10 new files)
tech_stack:
  added: []
  patterns:
    - dynamic({ ssr: false }) at page.tsx level for wagmi SSR safety
    - Self-rescheduling setTimeout (not setInterval) for polling — prevents overlapping ticks
    - cancelled flag on useEffect cleanup to prevent state updates after unmount
    - CSS variables only — no raw hex except '#fff' on primary CTA buttons
    - noesis-card + noesis-stat-card CSS classes from globals.css
key_files:
  created:
    - dashboard/src/app/portal/nous/spawn/page.tsx (8 lines)
    - dashboard/src/app/portal/nous/spawn/SpawnWizardClient.tsx (98 lines)
    - dashboard/src/app/portal/nous/spawn/StepIndicator.tsx (57 lines)
    - dashboard/src/app/portal/nous/spawn/StepName.tsx (153 lines)
    - dashboard/src/app/portal/nous/spawn/StepSeed.tsx (80 lines)
    - dashboard/src/app/portal/nous/spawn/SeedCard.tsx (95 lines)
    - dashboard/src/app/portal/nous/spawn/StepRegion.tsx (100 lines)
    - dashboard/src/app/portal/nous/spawn/StepPay.tsx (282 lines)
    - dashboard/src/app/portal/nous/spawn/WizardSummaryCard.tsx (78 lines)
    - dashboard/src/app/portal/nous/spawn/PaymentPolling.tsx (35 lines)
  modified: []
decisions:
  - "DID preview uses '0x????' placeholder per plan spec — username prefix is server-derived from human DID ETH address; UI cannot know it client-side before spawn"
  - "Polling uses self-rescheduling setTimeout (not setInterval) to prevent overlapping async ticks if a tick takes longer than 3s to resolve"
  - "USDT_ADDR only has mainnet entry — plan specifies mainnet only for v2.5; falls back to mainnet if chainId not found"
  - "SeedCard SparkleIcon uses path-based inline SVG (4-pointed star) per plan discretion note; no external icon dependency"
metrics:
  duration: "~35 minutes"
  completed: "2026-05-23"
  tasks_completed: 4
  tasks_total: 4
  files_created: 10
  files_modified: 0
---

# Phase 28 Plan 04: Spawn Wizard UI Summary

4-step spawn wizard at `/portal/nous/spawn` implementing all 10 component files per UI-SPEC with wagmi USDT payment, Grid API polling, and all error states.

## What Was Built

### Task 1: Wizard Scaffold (page.tsx + SpawnWizardClient + StepIndicator)

**page.tsx** — Thin `'use client'` wrapper that dynamically imports `SpawnWizardClient` with `{ ssr: false }`. This is the SSR safety gate required for wagmi hooks used in StepPay.

**SpawnWizardClient.tsx** — 4-step state machine:
- `useState<Step>(1)` tracks current step (1=Name, 2=Seed, 3=Region, 4=Pay)
- Mount guard: fetches `GET /api/v1/portal/human/me/nous` on load; if `data.nous` is truthy, calls `router.replace('/portal/my-nous')` immediately
- Loading state shown while guard check is in flight (prevents wizard flash before redirect)
- Collects `name: string`, `seed: Seed`, `region: string` across steps; passes to StepPay

**StepIndicator.tsx** — 4-circle progress bar:
- Active step: `border: 2px solid var(--terracotta-2)`, `background: var(--parchment-2)`, weight 600
- Completed step: shows `✓` checkmark, `background: var(--parchment-2)`, `border: var(--rule)`, weight 400
- Connector line: `var(--terracotta-2)` when step to its left is completed, `var(--rule)` otherwise
- Step labels: "Name" / "Seed" / "Region" / "Pay" in `var(--sans-portal)` 13px below circles
- Zero raw hex — all CSS variables

### Task 2: Steps 1-3 (StepName + StepSeed + SeedCard + StepRegion)

**StepName.tsx** — Step 1:
- Regex: `/^[a-zA-Z0-9_]{3,32}$/` validated live on change
- Debounced async call (350ms) to `GET /spawn/check-name?name={name}` with `credentials: 'include'`
- `checkResult: boolean | null` — `null` means no result yet, `true` = available, `false` = taken
- "Next" disabled when: format invalid, `checkResult !== true`, or `checking === true`
- Input border turns `var(--terracotta)` on format error or name-taken state
- DID preview: `did:noesis:human-nous:0x????-{name}` (intentional placeholder — username prefix is server-derived)
- Inline errors per UI-SPEC copywriting table

**StepSeed.tsx** — Step 2:
- 4 `<SeedCard>` instances in flex column with gap 8
- `selected: Seed | null` initialized to `initial` prop
- "Next" disabled when `selected === null`

**SeedCard.tsx** — Individual seed card:
- Seed-accent map: Explorer=`var(--terracotta-2)`, Scholar=`var(--bronze)`, Merchant=`var(--terracotta)`, Guardian=`var(--navy)`
- `borderLeft: 3px solid transparent` unselected, `borderLeft: 3px solid {accent}` selected
- `background: var(--parchment-2)` on selected/hover
- SparkleIcon: 4-pointed star inline SVG — `var(--muted)` default, `var(--terracotta-2)` selected
- Selected badge: `fontFamily: var(--mono-portal)` 13px 600 `var(--bronze)` text, `textTransform: uppercase`
- All descriptions match UI-SPEC §"Wizard — Step 2 Seed Descriptions" verbatim

**StepRegion.tsx** — Step 3:
- Hardcoded options: agora/nexus/archive/frontier (title-cased display labels)
- Custom chevron arrow via inline SVG `backgroundImage` data URL
- `appearance: none` removes browser default arrow
- "Next" disabled when no region selected

### Task 3: Step 4 — Payment Layer (StepPay + WizardSummaryCard + PaymentPolling)

**PaymentPolling.tsx**:
- 3-dot pulse animation matching Phase 26 style exactly
- `portal-pulse` keyframes injected via `<style>` tag
- 0.4s stagger between dots, 1.2s cycle, `var(--bronze)` fill
- Accepts `status: string` prop — displays below dots in italic muted sans 13px

**WizardSummaryCard.tsx**:
- Uses `noesis-stat-card` CSS class
- Four rows: "Nous name", "Personality seed" (inline badge), "Starting region" (title-cased), "Spawn cost" (bold 600)
- Seed badge inline: `var(--mono-portal)` 13px 600, `var(--bronze)`, `textTransform: uppercase`

**StepPay.tsx** — The full payment state machine:

Config fetch: loads `GET /spawn/config` on mount; sets `costUsdt` and `treasury`; handles 503 → `spawn_not_enabled` state

UI states:
- `idle` — Summary card + Back/Spawn Nous buttons
- `paying` — Back disabled, Spawn button disabled (user in MetaMask)
- `confirming` — `<PaymentPolling status="Confirming payment…" />` shown; buttons hidden
- `spawning` — `<PaymentPolling status="Spawning your Nous…" />` shown
- `spawn_not_enabled` — "Coming Soon" block replaces wizard card
- `error_timeout` — Error block + buttons shown (user can retry)
- `error_payment_failed` — Error block + buttons shown (user can retry)
- `error_already_owns` — Error block shown; calls `onAlreadyOwns()` after 2s

Polling logic:
- Self-rescheduling `setTimeout(tick, 3000)` — avoids overlap if tick takes >3s
- `120_000`ms hard timeout (2 minutes exactly per D-04)
- `cancelled` flag prevents state updates after component unmount
- On `confirmed === true`: POSTs to `/spawn`, handles 200/503/409 branches

Wagmi transfer:
- `useWriteContract` with `ERC20_ABI` transfer function
- `parseUnits(costUsdt, 6)` — USDT has 6 decimals
- Falls back to `USDT_ADDR[mainnet.id]` if chainId not in map
- `walletError` effect resets to `error_payment_failed` state

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

**DID preview `0x????` placeholder** — `StepName.tsx` line 49. Intentional per plan spec: "use `0x????` placeholder since the username prefix is derived server-side from the human DID". This is by design, not a stub that blocks functionality.

**Testnet USDT address** — `USDT_ADDR` contains mainnet only. Plan specifies "mainnet only for now". No testnet USDT address added.

## Threat Flags

None — all threat mitigations from the plan's STRIDE register were implemented:
- T-28-ui-02: wagmi prompts user for MetaMask signature; `/spawn` POST requires server-side payment confirmation
- T-28-ui-04: Polling uses `cancelled` flag + 120s timeout; no runaway loop
- T-28-ui-05: `dynamic({ ssr: false })` prevents hydration issues

## Human Verification

**Checkpoint type:** human-verify
**Result:** APPROVED
**Approved by:** User on 2026-05-23
**What was verified:** Full 4-step spawn wizard at /portal/nous/spawn — all steps, seed cards, region select, payment flow, error states, and Coming Soon gate.

## Commits

| Commit | Description |
|--------|-------------|
| `594df38` | feat(28-04): wizard scaffold — page.tsx + SpawnWizardClient + StepIndicator |
| `1cedfab` | feat(28-04): wizard steps 1-3 — StepName + StepSeed + SeedCard + StepRegion |
| `bb8cb27` | feat(28-04): wizard step 4 — StepPay + WizardSummaryCard + PaymentPolling |
| `d905ad2` | docs(28-04): complete spawn wizard plan summary |

## Self-Check: PASSED

- [x] `dashboard/src/app/portal/nous/spawn/page.tsx` — FOUND (8 lines, contains `dynamic(`)
- [x] `dashboard/src/app/portal/nous/spawn/SpawnWizardClient.tsx` — FOUND (contains `'use client'`, `useState<Step>`, `human/me/nous`, `router.replace('/portal/my-nous')`)
- [x] `dashboard/src/app/portal/nous/spawn/StepIndicator.tsx` — FOUND (contains `currentStep: 1 | 2 | 3 | 4`, no raw hex)
- [x] `dashboard/src/app/portal/nous/spawn/StepName.tsx` — FOUND (contains "Name Your Nous", regex, check-name)
- [x] `dashboard/src/app/portal/nous/spawn/StepSeed.tsx` — FOUND (contains "Choose a Personality Seed")
- [x] `dashboard/src/app/portal/nous/spawn/SeedCard.tsx` — FOUND (all 4 seed descriptions, terracotta-2/bronze/navy accents)
- [x] `dashboard/src/app/portal/nous/spawn/StepRegion.tsx` — FOUND (contains "Pick a Starting Region")
- [x] `dashboard/src/app/portal/nous/spawn/StepPay.tsx` — FOUND (useWriteContract, parseUnits, spawn/status/, spawn/config, 120_000, 3000, "Confirming payment", "Spawning your Nous", "Coming Soon")
- [x] `dashboard/src/app/portal/nous/spawn/WizardSummaryCard.tsx` — FOUND (noesis-stat-card, all 4 rows)
- [x] `dashboard/src/app/portal/nous/spawn/PaymentPolling.tsx` — FOUND (portal-pulse, var(--bronze))
- [x] `npx tsc --noEmit` — PASSED (no errors in spawn/ files)
- [x] `npx next build --no-lint` — PASSED (/portal/nous/spawn renders as static, 1.33kB)
- [x] No raw hex colors in spawn/*.tsx except '#fff' on primary buttons
- [x] No Tailwind color tokens in spawn/*.tsx
- [x] Commits 594df38, 1cedfab, bb8cb27 — present in git log
- [x] No STATE.md or ROADMAP.md modifications
- [x] Human verification checkpoint approved (Task 4) — all 4 tasks complete
