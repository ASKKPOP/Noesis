---
phase: 26-sophia-onboarding
plan: 02
subsystem: dashboard-frontend
tags: [auth, onboarding, routing, store, portal-shell]
dependency_graph:
  requires: [26-01]
  provides: [HumanUser-onboarded-field, auth-conditional-redirect, portal-shell-onboard-guard]
  affects:
    - dashboard/src/lib/web3/siwe-auth.ts
    - dashboard/src/app/portal/auth/page.tsx
    - dashboard/src/components/portal/PortalShell.tsx
tech_stack:
  added: []
  patterns: [conditional-redirect-on-onboarded, portal-shell-bypass, zustand-auth-store]
key_files:
  created: []
  modified:
    - dashboard/src/lib/web3/siwe-auth.ts
    - dashboard/src/app/portal/auth/page.tsx
    - dashboard/src/components/portal/PortalShell.tsx
decisions:
  - "PortalShell was already a 'use client' component — hooks worked directly, no wrapper needed"
  - "Email paths received identical /me hydration + conditional redirect as SIWE path"
  - "router.replace used in PortalShell guard (not push) — onboarding is mandatory, not optional"
  - "Fallback to /portal when /me call fails — sign-in success preserved even if profile fetch fails"
metrics:
  duration: 4m
  completed: 2026-05-22T22:35:00Z
  tasks: 2
  files_modified: 3
---

# Phase 26 Plan 02: Frontend Onboarding Wire-Up Summary

HumanUser.onboarded field added, auth page redirects conditionally after /me hydration, PortalShell bypasses sidebar for /portal/onboard and guards unonboarded users on all portal pages.

## What Was Built

### HumanUser.onboarded Field (siwe-auth.ts)

Added `onboarded?: boolean` to the `HumanUser` interface with JSDoc matching the existing optional field pattern:

```typescript
/** True when human_users.onboarding_goal IS NOT NULL. Populated from /me after sign-in. */
onboarded?: boolean;
```

The store (`human-auth-store.ts`) imports `HumanUser` by type — no changes needed there. The `setUser(meData)` call already assigns all fields.

### auth/page.tsx — SIWE Path

Extended the `/me` hydration block in `handleWalletSignIn`:
- `meData` type now includes `onboarded: boolean`
- After `setUser(meData)`, redirects to `/portal/onboard` when `!meData.onboarded`, else `/portal`
- The original unconditional `router.push('/portal')` was replaced by this conditional inside the try block
- Fallback paths (non-ok response, catch block) both push to `/portal`

### auth/page.tsx — Email Paths

`handleEmailSubmit` (covers both sign-in and sign-up tabs) now applies the same pattern:
- After `setUser(user)` from the email auth response, calls `/me`
- Applies the same conditional redirect based on `meData.onboarded`
- Falls back to `/portal` if `/me` fails

Previously the email path had no `/me` hydration at all — this plan adds it.

### auth/page.tsx — Already Signed-In useEffect

The existing redirect guard that fired when `currentUser` is already set:

```typescript
// Before
if (currentUser) router.push('/portal');

// After
if (!currentUser) return;
if (currentUser.onboarded === false) {
    router.push('/portal/onboard');
} else {
    router.push('/portal');
}
```

This handles the case where a user revisits `/portal/auth` while already authenticated.

### PortalShell — Bypass for /portal/onboard

Extended the existing `/portal/auth` bypass to also cover `/portal/onboard`:

```typescript
if (pathname === '/portal/auth' || pathname === '/portal/onboard') {
    return <>{children}</>;
}
```

The onboarding wizard renders full-screen with no sidebar or header, identical to the auth page.

### PortalShell — First-Time Redirect Guard

Added a guard after the bypass check:

```typescript
if (currentUser !== null && currentUser.onboarded === false && pathname !== '/portal/onboard') {
    router.replace('/portal/onboard');
    return null;
}
```

Uses `router.replace` (not `push`) because onboarding is mandatory — the user should not be able to navigate back to the portal page from the onboarding wizard via the browser back button.

### PortalShell Client Component Confirmation

PortalShell already had `'use client'` at line 1 and was already using `usePathname` and `useState`. Adding `useRouter` and `useHumanAuthStore` required only two additional import lines. No structural changes needed.

## TypeScript

`npx tsc --noEmit` passes with zero errors after both tasks.

## Deviations from Plan

None — plan executed exactly as written. The only judgment call was where to place the fallback `router.push('/portal')` paths when `/me` fails (inside the try-catch inline, matching the existing non-fatal pattern).

## Known Stubs

None. All redirects use real `currentUser.onboarded` values from the server. No placeholder data.

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| T-26-05: PortalShell redirect guard bypass (client-side only) | Accepted per plan — UX convenience, backend enforces JWT independently |
| T-26-06: currentUser.onboarded spoofed | Accepted per plan — value comes from authenticated /me response |

## Self-Check: PASSED

Files confirmed present:
- `dashboard/src/lib/web3/siwe-auth.ts` — contains `onboarded`
- `dashboard/src/app/portal/auth/page.tsx` — contains `onboarded` and `/portal/onboard`
- `dashboard/src/components/portal/PortalShell.tsx` — contains `portal/onboard`

Commits confirmed:
- `4c89ccb` feat(26-02): onboarded field + auth redirect by onboarding status
- `ec2a889` feat(26-02): PortalShell bypass + redirect guard for onboarding
