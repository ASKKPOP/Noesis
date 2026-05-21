---
phase: 24-portal-shell
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - dashboard/src/app/portal/auth/page.tsx
  - dashboard/src/app/portal/page.tsx
  - dashboard/src/app/portal/portal-dashboard.test.ts
  - dashboard/src/app/portal/profile/page.tsx
  - dashboard/src/app/portal/profile/profile-page.test.ts
  - dashboard/src/app/portal/profile/profile-rows.test.tsx
  - dashboard/src/components/portal/PortalHeader.tsx
  - dashboard/src/components/portal/PortalShell.test.tsx
  - dashboard/src/components/portal/PortalShell.tsx
  - dashboard/src/components/portal/PortalSidebar.tsx
  - dashboard/src/components/portal/__tests__/PortalShell.test.tsx
  - dashboard/src/components/portal/__tests__/PortalSidebarHeader.test.tsx
  - dashboard/src/lib/web3/siwe-auth.test.ts
  - dashboard/src/lib/web3/siwe-auth.ts
  - grid/src/api/portal/auth.ts
  - grid/src/db/schema.ts
  - grid/src/human/HumanRegistry.ts
  - grid/src/human/types.ts
  - grid/test/audit/allowlist-forty-five.test.ts
  - grid/test/audit/human-transferred-producer-boundary.test.ts
  - grid/test/portal/human-region.test.ts
  - grid/test/portal/portal-auth-region.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 24 introduces the portal shell layout (sidebar + header), three new profile rows (Current Region, Cyber Coin, Member Since), live stats on the dashboard, and the region/created_at fields through the auth stack (migration v10 → HumanRecord → JWT → /me → HumanUser → auth page). The implementation is well-structured overall. Two critical issues were found: an in-memory nonce store that is not bounded (memory leak / DoS vector) and a data field truncation in siwe-auth.ts where the `/verify` response is discarded in favour of a partial object, causing region and created_at to always require the `/me` round-trip even on fresh logins. Four warnings cover logic correctness.

---

## Critical Issues

### CR-01: Unbounded in-memory nonce map — memory exhaustion / DoS

**File:** `grid/src/api/portal/auth.ts:28-40`

**Issue:** `nonceMap` grows without a size cap. Each `GET /nonce` call adds an entry; stale entries (past the 5-minute TTL) are only deleted on use (line 74) or on expiry check during verify (line 71). A caller that requests nonces but never verifies them will grow the map indefinitely. On a public endpoint this is a low-effort DoS against the process heap.

**Fix:** Prune expired entries on each nonce request (or on a periodic timer). Simplest approach:

```typescript
// After setting the new nonce, evict anything older than TTL
const now = Date.now();
for (const [k, ts] of nonceMap) {
    if (now - ts > NONCE_TTL_MS) nonceMap.delete(k);
}
nonceMap.set(nonce, now);
```

Alternatively, cap the map size and reject requests when saturated (rate-limiting concern, but that belongs at the reverse-proxy layer).

---

### CR-02: signInWithEthereum discards /verify response — region/created_at always lost

**File:** `dashboard/src/lib/web3/siwe-auth.ts:97-98`

**Issue:** The `/verify` response is parsed (`userData`) but then only `did` and `eth_address` are returned:

```typescript
const userData = await verifyRes.json() as HumanUser;
return { did: userData.did, eth_address: userData.eth_address };
```

The server at `auth.ts:131` already returns `{ did, eth_address, is_new }` — it does not return `region` or `created_at`. So even after the Phase 24 JWT changes, the return value from `signInWithEthereum` will always have `region: undefined` and `created_at: undefined`. The auth page then correctly calls `/me` to hydrate those fields — but only in the happy path. If the `/me` fetch fails (the outer `try/catch` on lines 119-132 swallows the error), the store retains the partial user and the Profile page shows `—` for Region and Member Since indefinitely, with no retry or indication to the user.

The underlying design intent (hydrate from `/me`) is sound, but the failure path means a transient network error permanently degrades the profile until the user signs out and back in.

**Fix (option A — resilient /me):** Surface the `/me` failure to the user and offer a retry button on the profile page rather than silently degrading.

**Fix (option B — extend /verify):** Have `/verify` return `region` and `created_at` directly from the newly issued JWT claims (they are already computed at that point in `auth.ts:115-116`), and forward them through `signInWithEthereum`:

```typescript
// auth.ts — extend the /verify response
return reply.send({
    did: human.did,
    eth_address: human.eth_address,
    region: human.region,
    created_at: human.created_at.toISOString(),
    is_new: isNew,
});

// siwe-auth.ts — forward all fields
const userData = await verifyRes.json() as HumanUser & { is_new: boolean };
return {
    did: userData.did,
    eth_address: userData.eth_address,
    region: userData.region,
    created_at: userData.created_at,
};
```

Option B eliminates the `/me` dependency entirely for SIWE logins.

---

## Warnings

### WR-01: Auto-SIWE effect depends on stale `isPending` closure

**File:** `dashboard/src/app/portal/auth/page.tsx:100-105`

**Issue:** The `useEffect` that auto-triggers SIWE on wallet connect has `[isConnected, address, chain?.id]` as dependencies but references `isPending` inside the body. `isPending` is excluded from the dependency array (guarded by the eslint-disable comment). If the effect fires a second time before the first SIWE call has set `isPending = true` (possible during React StrictMode double-invoke or if `chain.id` changes rapidly), `handleWalletSignIn` will be called concurrently, resulting in two parallel SIWE flows — two nonce fetches, two signature prompts.

**Fix:** Gate on a ref rather than state to prevent double-invocation:

```typescript
const pendingRef = useRef(false);

useEffect(() => {
    if (isConnected && address && chain && !currentUser && !pendingRef.current) {
        pendingRef.current = true;
        handleWalletSignIn().finally(() => { pendingRef.current = false; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isConnected, address, chain?.id]);
```

---

### WR-02: handleSignOut uses direct cookie write instead of logout endpoint

**File:** `dashboard/src/components/portal/PortalHeader.tsx:44` and `dashboard/src/components/portal/PortalSidebar.tsx:151` and `dashboard/src/app/portal/profile/page.tsx:51`

**Issue:** Sign-out in all three locations clears the auth cookie with `document.cookie = 'noesis_portal_token=; Max-Age=0; path=/'`. The cookie is `httpOnly: true` (set in `auth.ts:124`). An httpOnly cookie **cannot be read or deleted by JavaScript** — `document.cookie` assignment on an httpOnly cookie is silently ignored by the browser. The actual cookie persists; subsequent requests will still carry it, and the JWT will remain valid until its 24h expiry.

The server already has a proper logout route: `POST /api/v1/portal/auth/logout` which calls `reply.clearCookie(COOKIE_NAME)` server-side.

**Fix:** Replace the `document.cookie` line with a call to the logout endpoint in all three sign-out handlers:

```typescript
async function handleSignOut() {
    clearUser();
    disconnect();
    await fetch('/api/v1/portal/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/portal/auth';
}
```

---

### WR-03: PortalSidebar shows stale phase number

**File:** `dashboard/src/components/portal/PortalSidebar.tsx:368`

**Issue:** The version line in the sidebar footer reads `v2.5 · Phase 23 · Genesis Grid`. The rest of the codebase (dashboard page, portal page title, UPDATES list) references Phase 24 / v2.5. This is a minor cosmetic inconsistency but it is a data correctness error (incorrect phase number displayed to users).

**Fix:**
```typescript
v2.5 · Phase 24 · Genesis Grid
```

---

### WR-04: /me endpoint returns region with hardcoded 'agora' fallback, masking missing data

**File:** `grid/src/api/portal/auth.ts:150-153`

**Issue:** When the JWT does not contain a `region` field (old tokens), `/me` silently substitutes `'agora'`:

```typescript
region: (payload['region'] as string | undefined) ?? 'agora',
```

This makes it impossible for the client to distinguish "user is in the agora region" from "user's region is unknown because they authenticated before the region feature shipped." The profile page will display `Agora` for all pre-migration users even if their actual stored region is different, until they re-authenticate. The test at `portal-auth-region.test.ts:93-108` explicitly asserts this fallback as correct, so the behavior is intentional — but it creates a data inconsistency window.

**Fix (recommended):** Return `null` for missing region in old tokens (consistent with the `created_at` fallback on line 153), and have the profile page display `—` with a note to re-authenticate, rather than silently asserting 'agora'. If the business requirement is that all users default to 'agora', that default should live in the database (`human_users.region DEFAULT 'agora'`) and be read from there on `/me`, not injected client-side from a JWT fallback.

---

## Info

### IN-01: Duplicate sign-out logic across three components

**File:** `dashboard/src/components/portal/PortalHeader.tsx:41-46`, `dashboard/src/components/portal/PortalSidebar.tsx:148-153`, `dashboard/src/app/portal/profile/page.tsx:48-53`

**Issue:** The `handleSignOut` function is copy-pasted verbatim in three separate components. Once WR-02 is fixed (switching to the logout API), that fix will need to be applied in all three places, creating a maintenance footprint.

**Fix:** Extract to a shared hook (e.g., `useSignOut`) in `@/lib/hooks/use-sign-out.ts` and use it in all three components.

---

### IN-02: Source-text contract tests are fragile to whitespace and reformatting

**File:** `dashboard/src/app/portal/portal-dashboard.test.ts`, `dashboard/src/app/portal/profile/profile-page.test.ts`, `dashboard/src/lib/web3/siwe-auth.test.ts`

**Issue:** Multiple test files use `fs.readFileSync` to assert the presence of specific string literals in source files (e.g., `expect(src).toContain('liveNous.length')`). These tests will silently pass if the tested behaviour is removed and replaced with a renamed variable, and will silently fail if code is reformatted. The comment in the test files acknowledges this is a workaround for the `oxc SSR transform` issue with JSX rendering.

This is a pre-existing testing environment constraint, not a new issue introduced in Phase 24. Noting it for awareness — when the vitest/vite SSR issue is resolved, these source-text contracts should be migrated to proper component render tests.

---

### IN-03: PortalHeader maps /portal to 'World Map' but the page renders the Genesis Grid dashboard

**File:** `dashboard/src/components/portal/PortalHeader.tsx:18`

**Issue:** The `labels` map entry for `/portal` returns `'World Map'`, but `dashboard/src/app/portal/page.tsx` renders the Genesis Grid dashboard (section cards, stats, agent roster, updates). The actual World Map lives at `/worldmap`. This will show "World Map" as the breadcrumb when the user is on the dashboard, which is misleading.

**Fix:**
```typescript
'/portal': 'Dashboard',
```

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
