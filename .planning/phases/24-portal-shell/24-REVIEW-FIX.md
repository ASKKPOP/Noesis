---
phase: 24-portal-shell
fixed_at: 2026-05-21T02:01:22Z
review_path: .planning/phases/24-portal-shell/24-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 24: Code Review Fix Report

**Fixed at:** 2026-05-21T02:01:22Z
**Source review:** .planning/phases/24-portal-shell/24-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Unbounded in-memory nonce map

**Files modified:** `grid/src/api/portal/auth.ts`
**Commit:** 802828b
**Applied fix:** Added a pruning loop immediately before `nonceMap.set(nonce, now)` in the `GET /nonce` handler. On each nonce request, all entries older than `NONCE_TTL_MS` (5 minutes) are evicted before the new entry is inserted, bounding map growth to at most the number of nonces created within any 5-minute window.

### CR-02: signInWithEthereum discards /verify response — region/created_at always lost

**Files modified:** `grid/src/api/portal/auth.ts`, `dashboard/src/lib/web3/siwe-auth.ts`
**Commit:** 97f05aa
**Applied fix:** Extended the `/verify` response in `auth.ts` to include `region`, `created_at` (as ISO string), and `is_new`. Updated `signInWithEthereum` in `siwe-auth.ts` to type the response as `HumanUser & { is_new: boolean }` and return all four user fields (`did`, `eth_address`, `region`, `created_at`), eliminating the `/me` dependency for fresh SIWE logins.

### WR-01: Auto-SIWE effect double-invocation risk

**Files modified:** `dashboard/src/app/portal/auth/page.tsx`
**Commit:** 4e0e2a0
**Applied fix:** Added `const pendingRef = useRef(false)` and replaced the `!isPending` state check in the auto-SIWE `useEffect` with `!pendingRef.current`. The ref is set to `true` before calling `handleWalletSignIn()` and reset to `false` in the `.finally()` callback, making the guard synchronous and immune to React StrictMode double-invocation and rapid dependency changes.

### WR-02: handleSignOut uses direct cookie write instead of logout endpoint

**Files modified:** `dashboard/src/components/portal/PortalHeader.tsx`, `dashboard/src/components/portal/PortalSidebar.tsx`, `dashboard/src/app/portal/profile/page.tsx`
**Commit:** 9a30e89
**Applied fix:** Replaced the ineffective `document.cookie = 'noesis_portal_token=; Max-Age=0; path=/'` line in all three `handleSignOut` functions with `await fetch('/api/v1/portal/auth/logout', { method: 'POST', credentials: 'include' })`. Each function was also changed from `function` to `async function` to support the await. The server-side `clearCookie` call in the logout route now correctly clears the httpOnly cookie.

### WR-03: PortalSidebar shows stale phase number

**Files modified:** `dashboard/src/components/portal/PortalSidebar.tsx`
**Commit:** eb7e019
**Applied fix:** Changed the sidebar footer version line from `v2.5 · Phase 23 · Genesis Grid` to `v2.5 · Phase 24 · Genesis Grid`.

### WR-04: /me endpoint returns region with hardcoded 'agora' fallback

**Files modified:** `grid/src/api/portal/auth.ts`
**Commit:** 79d2283
**Applied fix:** Changed the `region` fallback in the `/me` response from `?? 'agora'` to `?? null`, consistent with the `created_at` fallback on the same line. Pre-migration tokens without a `region` claim now return `null`, allowing the profile page to display `—` rather than silently asserting `Agora` for users whose region is unknown.

---

_Fixed: 2026-05-21T02:01:22Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
