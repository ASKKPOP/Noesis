---
phase: 24-portal-shell
plan: "02"
subsystem: dashboard/portal
tags: [HumanUser, wagmi, profile, siwe-auth, store-hydration]
dependency_graph:
  requires: ["24-01"]
  provides: ["profile-region-display", "profile-cyber-coin", "profile-member-since", "me-store-hydration"]
  affects: ["dashboard/src/lib/web3/siwe-auth.ts", "dashboard/src/app/portal/auth/page.tsx", "dashboard/src/app/portal/profile/page.tsx"]
tech_stack:
  added: ["useBalance (wagmi)", "useReadContract (wagmi)", "formatEther/formatUnits (viem)", "next/link"]
  patterns: ["source-text contract tests for wagmi components", "shared CSS constant for fontWeight compliance"]
key_files:
  created:
    - dashboard/src/lib/web3/siwe-auth.test.ts
    - dashboard/src/app/portal/profile/profile-page.test.ts
  modified:
    - dashboard/src/lib/web3/siwe-auth.ts
    - dashboard/src/app/portal/auth/page.tsx
    - dashboard/src/app/portal/profile/page.tsx
decisions:
  - "New rows rendered as hardcoded divs (not via loop) to guarantee fontWeight: 600 without touching pre-existing loop"
  - "Shared newDtStyle constant ensures consistent 600-weight across all 3 new dt labels"
  - "source-text contract tests used because wagmi hooks require full Web3Provider render tree"
metrics:
  duration_minutes: 15
  tasks_completed: 2
  files_changed: 5
  completed_date: "2026-05-21"
---

# Phase 24 Plan 02: HumanUser Region + Profile Rows Summary

HumanUser type extended with `region` and `created_at`; auth page hydrates store from `/me` after SIWE; profile identity card shows Current Region, Cyber Coin balance, and Member Since rows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend HumanUser type and hydrate store after sign-in | eab2ae9 | siwe-auth.ts, auth/page.tsx, siwe-auth.test.ts |
| 2 | Add 3 new rows to the profile page identity card | 5a60d68 | profile/page.tsx, profile-page.test.ts |

## What Was Built

### Task 1 — HumanUser type + /me hydration

**`dashboard/src/lib/web3/siwe-auth.ts`** — `HumanUser` interface extended with two optional fields:
- `region?: string | null` — auto-assigned region populated from `/me` after sign-in
- `created_at?: string | null` — ISO 8601 join timestamp populated from `/me` after sign-in

**`dashboard/src/app/portal/auth/page.tsx`** — `handleWalletSignIn` now calls `GET /api/v1/portal/auth/me` with `credentials: 'include'` after successful `/verify`. The response overwrites the store with the full profile (including region + created_at). The call is wrapped in `try/catch` — a `/me` failure is non-fatal; the store retains the partial user from `/verify`.

The `human-auth-store.ts` required no changes — it inherits the new fields automatically via the `HumanUser` type import.

### Task 2 — Profile page 3 new rows

**`dashboard/src/app/portal/profile/page.tsx`** additions:
- Imports: `useBalance`, `useReadContract` from wagmi; `mainnet` from wagmi/chains; `formatEther`, `formatUnits` from viem; `Link` from next/link
- Module-level constants: `USDT_ADDR` map and `ERC20_ABI` (copied from WalletPanel.tsx)
- Hook calls: `useBalance({ address })` for ETH; `useReadContract` for USDT balance
- 3 new rows rendered as hardcoded `<div>` elements (not via the existing loop):
  - **Current Region** — title-case value (e.g. 'Agora'), fallback '—'
  - **Cyber Coin** — `X.XXXX ETH · X.XX USDT` + `→ Wallet` link to `/portal/wallet` in `var(--terracotta)`
  - **Member Since** — `toLocaleString('en-US', { month: 'long', year: 'numeric' })` format (e.g. 'May 2026'), fallback '—'
- All new `<dt>` labels use `fontWeight: 600` via shared `newDtStyle` constant (UI-SPEC compliant)
- SSR guard `dynamic({ ssr: false })` preserved unchanged

## Test Results

21 tests across 2 test files, all passing:

- `siwe-auth.test.ts` — 9 tests: 7 type-level assertions for `region`/`created_at` optional fields; 2 source-text contracts for `/me` call in auth page
- `profile-page.test.ts` — 12 tests: presence of all 3 row labels, `/portal/wallet` link, `var(--terracotta)`, `ssr: false`, `useBalance`, `useReadContract`, fallback '—' patterns, fontWeight: 600 on new rows

Pre-existing failures: 42 `.test.tsx` files fail with JSX parse errors — these failures existed before this plan (confirmed via `git stash`). All `.test.ts` files pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source-text regex for fontWeight: 600 check needed adjustment**
- **Found during:** Task 2 RED phase verification
- **Issue:** Test regex `Cyber Coin[\s\S]{0,600}fontWeight: 600` looked forward in source for `fontWeight: 600` after "Cyber Coin", but the implementation correctly uses a shared `newDtStyle` constant defined earlier in the file
- **Fix:** Updated test to verify the constant contains `fontWeight: 600` and that no `fontWeight: 500` appears in the Cyber Coin row block
- **Files modified:** `profile-page.test.ts`
- **Commit:** 5a60d68 (included in same task commit)

**2. [Rule 3 - Design decision] New rows rendered as hardcoded divs, not via loop**
- **Found during:** Task 2 implementation
- **Issue:** The existing `<dl>` render loop uses `fontWeight: 500` for `<dt>` labels. Per CLAUDE.md "do NOT refactor or improve the existing rows". To guarantee `fontWeight: 600` on new rows without touching pre-existing code, new rows were rendered as separate hardcoded `<div>` elements (same approach as specified for Cyber Coin in the plan)
- **Fix:** Applied same hardcoded-div approach to Current Region and Member Since rows as well
- **Impact:** Cleaner separation, no risk of accidentally modifying existing rows

## Known Stubs

None. All three new rows are wired to live data sources:
- `currentUser?.region` — populated from `/me` endpoint after sign-in
- `currentUser?.created_at` — populated from `/me` endpoint after sign-in
- `ethBal` / `usdtRaw` — live wagmi balance hooks

## Threat Flags

No new surface beyond what was modeled in the plan's threat register.

## Self-Check

- [x] `eab2ae9` commit exists: feat(24-02): extend HumanUser type
- [x] `5a60d68` commit exists: feat(24-02): add profile page rows
- [x] `grep -c "region?: string | null" siwe-auth.ts` returns `1`
- [x] `grep -c "portal/auth/me" auth/page.tsx` returns `1`
- [x] `grep -c "Current Region" profile/page.tsx` returns `2` (JSX + comment)
- [x] `grep -c "ssr: false" profile/page.tsx` returns `1`
- [x] 21 unit tests pass

## Self-Check: PASSED
