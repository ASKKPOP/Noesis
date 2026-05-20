---
phase: 22-web3-identity
plan: "04"
subsystem: dashboard
tags: [web3, siwe, jwt, auth, middleware, zustand, portal]
dependency_graph:
  requires: [22-02, 22-03]
  provides: [signInWithEthereum, useHumanAuthStore, portal-auth-page, portal-middleware]
  affects: [dashboard/src/app/portal/auth/page.tsx, dashboard/src/middleware.ts]
tech_stack:
  added: [siwe@^2.3.2, zustand@^4.5.0]
  patterns: [siwe-client-utility, zustand-session-store, nextjs-edge-middleware]
key_files:
  created:
    - dashboard/src/lib/web3/siwe-auth.ts
    - dashboard/src/lib/stores/human-auth-store.ts
    - dashboard/src/app/portal/auth/page.tsx
    - dashboard/src/middleware.ts
  modified:
    - dashboard/package.json
decisions:
  - "signInWithEthereum is a plain async function (not a hook) — signMessage injected as param for testability without wagmi render context"
  - "Middleware checks cookie presence only (not JWT signature) — full JWT validation happens at Grid /me endpoint per T-22-04-01 accept disposition"
  - "useEffect redirect in auth page avoids SSR issues — currentUser checked client-side"
  - "siwe@^2.3.2 pinned (not ^2.0.0) — latest stable v2 patch resolving ethers peer dep"
metrics:
  duration_seconds: 240
  completed_date: "2026-05-20"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 4
---

# Phase 22 Plan 04: SIWE Sign-In Flow Wiring Summary

Complete client-side SIWE auth: siwe-auth utility calling Grid endpoints, Zustand session store, /portal/auth sign-in page, and Next.js Edge middleware protecting /portal/*.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create siwe-auth utility and human-auth Zustand store | 0afa16c | dashboard/src/lib/web3/siwe-auth.ts, dashboard/src/lib/stores/human-auth-store.ts, dashboard/package.json |
| 1b | Update package-lock.json | 58002b2 | package-lock.json |
| 2 | Create portal sign-in page and Next.js middleware | 06e54ff | dashboard/src/app/portal/auth/page.tsx, dashboard/src/middleware.ts |

## What Was Built

**siwe-auth.ts** (`dashboard/src/lib/web3/siwe-auth.ts`) — Plain async utility `signInWithEthereum()` that:
1. Fetches a nonce from `GET /api/v1/portal/auth/nonce`
2. Constructs a `SiweMessage` using the `siwe` npm package
3. Calls the injected `signMessage` callback to prompt the wallet
4. POSTs `{ message, signature }` to `/api/v1/portal/auth/verify` with `credentials: 'include'`
5. Returns `HumanUser { did, eth_address }` on success
6. Throws named errors (`user_rejected_signature`, `sign_in_failed`, Grid error field) for UI display

**human-auth-store.ts** (`dashboard/src/lib/stores/human-auth-store.ts`) — Zustand v4 store:
- `currentUser: HumanUser | null` — session state across navigations
- `setUser(user)` — called after successful SIWE verify
- `clearUser()` — called on logout or wallet disconnect

**portal/auth/page.tsx** (`dashboard/src/app/portal/auth/page.tsx`) — Client component sign-in page:
- Not connected → renders `ConnectWalletButton`
- Connected, not signed in → renders "Sign In" button; clicking calls `signInWithEthereum` with `useSignMessage` from wagmi
- Already signed in (`currentUser` set) → `useEffect` redirects to `/portal`
- Error state displayed with `role="alert"` for accessibility

**middleware.ts** (`dashboard/src/middleware.ts`) — Next.js Edge middleware:
- Matches `/portal/:path*` via `config.matcher`
- Excludes `/portal/auth` itself to prevent redirect loop
- Checks `noesis_portal_token` cookie presence; redirects to `/portal/auth` if absent
- Cookie presence only — intentional v2.5 scope (full JWT verification at Grid /me)

**Dependencies added:**
- `siwe@^2.3.2` — EIP-4361 SIWE message construction and parsing
- `zustand@^4.5.0` — Lightweight session state management

## Pending Checkpoint

**Task 3 (checkpoint:human-verify)** requires browser verification of the end-to-end SIWE flow:
1. Visit `/portal` → should redirect to `/portal/auth`
2. Connect wallet → MetaMask / injected wallet prompt
3. Click "Sign In" → wallet message signing prompt
4. After signing → redirect to `/portal`
5. Cookie `noesis_portal_token` present → `/portal/auth` redirects back to `/portal`
6. Grid `/me` endpoint returns `{ did, eth_address }`
7. `human.joined` audit event fires on first connect only

This checkpoint must be approved before the plan is considered fully complete.

## Deviations from Plan

None — plan executed exactly as written. `siwe@^2.3.2` used instead of `^2.0.0` to pick up latest v2 stable patch.

## Threat Model Compliance

| Threat | Disposition | Status |
|--------|-------------|--------|
| T-22-04-01 Spoofing (middleware cookie check only) | accept | Cookie presence intentional; JWT verified by Grid /me |
| T-22-04-02 Info Disclosure (siwe-auth error messages) | mitigate | Grid error field surfaced; generic 'sign_in_failed' fallback — no server internals |
| T-22-04-03 Repudiation (double verify call) | accept | Backend nonce-store deletes nonce after first use; second call returns nonce_unknown |
| T-22-04-04 DoS (redirect loop) | mitigate | Middleware excludes /portal/auth; auth page checks currentUser before redirect |
| T-22-04-05 EoP (wallet rejection) | accept | User rejection surfaces as error; no session created |

## Known Stubs

None — all wiring is live. The middleware and sign-in page call real endpoints from Plan 22-02.

## Self-Check: PASSED

- `dashboard/src/lib/web3/siwe-auth.ts` — FOUND
- `dashboard/src/lib/stores/human-auth-store.ts` — FOUND
- `dashboard/src/app/portal/auth/page.tsx` — FOUND
- `dashboard/src/middleware.ts` — FOUND
- `grep noesis_portal_token dashboard/src/middleware.ts` — FOUND (line 16)
- `grep signInWithEthereum dashboard/src/app/portal/auth/page.tsx` — FOUND (lines 18, 41)
- `grep useHumanAuthStore dashboard/src/lib/stores/human-auth-store.ts` — FOUND (line 18)
- `grep portal/auth dashboard/src/middleware.ts` — FOUND (lines 4, 17, 22)
- `npx tsc --noEmit` exits 0 — VERIFIED
- Commit 0afa16c — FOUND
- Commit 06e54ff — FOUND
