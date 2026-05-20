---
phase: 22-web3-identity
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - dashboard/src/app/portal/auth/page.tsx
  - dashboard/src/app/portal/layout.tsx
  - dashboard/src/app/portal/page.tsx
  - dashboard/src/components/portal/ConnectWalletButton.tsx
  - dashboard/src/lib/stores/human-auth-store.ts
  - dashboard/src/lib/web3/siwe-auth.ts
  - dashboard/src/lib/web3/wagmi-config.ts
  - dashboard/src/middleware.ts
  - grid/src/api/portal/auth.ts
  - grid/src/api/portal/index.ts
  - grid/src/api/server.ts
  - grid/src/audit/append-human-joined.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/db/schema.ts
  - grid/src/human/HumanRegistry.ts
  - grid/src/human/index.ts
  - grid/src/human/types.ts
  - grid/src/index.ts
  - dashboard/package.json
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 22 introduces SIWE-based human authentication, a `HumanRegistry`, JWT issuance via `jose`, and an `appendHumanJoined` audit producer. The overall architecture is sound — nonce consumption prevents replay, the audit chain hashes the ETH address before storage, and the cookie is set `httpOnly`/`sameSite:strict`. However, three critical issues require attention before production deployment: the ephemeral in-memory JWT key pair loses all issued tokens on server restart, the CORS configuration blocks the `POST /verify` route from the browser (credentials forbidden with wildcard-style origins but also `credentials: false` is set), and the nonce store is never pruned, creating an unbounded memory growth vector. Several warnings relate to race conditions and incomplete validation handling.

---

## Critical Issues

### CR-01: JWT key pair is ephemeral — all sessions invalidated on Grid restart

**File:** `grid/src/api/portal/auth.ts:31`
**Issue:** `generateKeyPair('ES256')` is called once at module load and held only in memory. Every Grid process restart generates a new key pair, instantly invalidating every previously issued 24-hour JWT cookie. Users in the middle of a session will be silently logged out. In development this is tolerable; in any persistent deployment it is a reliability-breaking defect. More critically, if multiple Grid instances run behind a load balancer (or if the process crashes and restarts), any token signed by the old key will fail verification on the `/me` endpoint with `invalid_token`, which looks to the caller like authentication failure rather than a transient error.

**Fix:** Persist the key pair (or use a symmetric HMAC secret loaded from an environment variable) so it survives restarts. The simplest safe approach for v2.5:

```typescript
// Load from env; fail loudly if absent in production.
const JWT_SECRET = process.env['PORTAL_JWT_SECRET'];
if (!JWT_SECRET && process.env['NODE_ENV'] === 'production') {
    throw new Error('PORTAL_JWT_SECRET must be set in production');
}
// Use HS256 with the secret, or persist the ES256 key pair to disk/secrets manager.
import { createSecretKey } from 'node:crypto';
const jwtKey = JWT_SECRET
    ? createSecretKey(Buffer.from(JWT_SECRET, 'hex'))
    : (await generateKeyPair('ES256')).privateKey; // dev-only fallback
```

Alternatively, accept the ephemeral key for v2.5 but document the restart caveat prominently and add a startup log warning.

---

### CR-02: CORS configuration blocks Portal auth POST requests from browser

**File:** `grid/src/api/server.ts:181-185`
**Issue:** The `@fastify/cors` registration sets `credentials: false` and `methods: ['GET', 'OPTIONS']`. The SIWE verify flow issues a `POST /api/v1/portal/auth/verify` with `credentials: 'include'` from the browser (`siwe-auth.ts:79`). The combination of `methods: ['GET', 'OPTIONS']` — which omits `POST` — means the browser's CORS preflight for that route will receive a rejected response and the request will fail with a CORS error before it ever reaches the Fastify handler. Additionally, `credentials: false` conflicts with the client-side `credentials: 'include'`, which requires the server to respond with `Access-Control-Allow-Credentials: true`.

**Fix:**

```typescript
void app.register(cors, {
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,  // required for cookie-bearing requests
    methods: ['GET', 'POST', 'OPTIONS'],  // add POST for auth routes
});
```

Note: `credentials: true` together with an explicit `origin` list (not `*`) is safe. The comment noting "production hardening is Phase 4" should also explicitly flag that `credentials: true` requires the explicit origin list to remain non-wildcard.

---

### CR-03: In-memory nonce store grows without bound — DoS vector

**File:** `grid/src/api/portal/auth.ts:27-40`
**Issue:** `nonceMap` is a `Map<string, number>` that receives a new entry on every GET to `/api/v1/portal/auth/nonce`. Nonces are deleted on successful verify (line 74) or on expiry detection (line 71), but expiry is only checked when a verify request arrives carrying that specific nonce. Any nonce that is fetched but never verified (browser tab closed, wallet rejected, network error) stays in the map forever. An attacker — or simply a surge of legitimate users who abandon the sign-in flow — can grow this map without limit, consuming process memory and eventually causing OOM.

**Fix:** Add a periodic sweep or a lazy-sweep on each nonce GET:

```typescript
/** Prune expired nonces. Call before inserting each new nonce. */
function pruneExpiredNonces(): void {
    const now = Date.now();
    for (const [nonce, createdAt] of nonceMap) {
        if (now - createdAt > NONCE_TTL_MS) {
            nonceMap.delete(nonce);
        }
    }
}

// In the nonce handler:
app.get('/api/v1/portal/auth/nonce', async (_req, reply) => {
    pruneExpiredNonces();
    const nonce = randomUUID();
    nonceMap.set(nonce, Date.now());
    return reply.send({ nonce });
});
```

This keeps the map bounded to nonces generated within the last 5 minutes.

---

## Warnings

### WR-01: SIWE message body is double-serialized — signature may be over wrong bytes

**File:** `dashboard/src/lib/web3/siwe-auth.ts:63,81`
**Issue:** On line 63 the SIWE message is serialized to a string with `message.prepareMessage()`, which is what gets signed by the wallet. On line 81, `message.toMessage()` is sent in the POST body. For `siwe` v2.x, `prepareMessage()` and `toMessage()` are aliases (both call `signMessage()` internally), so in practice they return the same string. However, the server reconstructs the `SiweMessage` from the raw JSON object in the body (`new SiweMessage(message as Record<string, unknown>)` — `auth.ts:60`), not from the serialized EIP-4361 string. This means the signature verification path is:

1. Client signs `prepareMessage()` (plain-text EIP-4361 form).
2. Client POSTs the SiweMessage fields as a JSON object.
3. Server reconstructs `SiweMessage` from JSON fields.
4. Server calls `siweMessage.verify({ signature, nonce })` — internally this re-serializes from the fields and verifies against that re-serialized form.

This is correct for the `siwe` library's `verify()` API but is fragile: if any field is added/removed during the JSON round-trip, the reconstructed message will not match what was signed. A simpler and more explicit approach is to send and verify the pre-serialized string directly:

```typescript
// Client: send the serialized string, not the object
body: JSON.stringify({ message: preparedMessage, signature }),

// Server: parse the EIP-4361 string directly
siweMessage = new SiweMessage(message as string); // string constructor path
```

---

### WR-02: Race condition — `createHuman` throws if two concurrent sign-in requests arrive for the same new address

**File:** `grid/src/api/portal/auth.ts:91-106` and `grid/src/human/HumanRegistry.ts:28-29`
**Issue:** The verify handler calls `findByAddress`, branches on `undefined`, then calls `createHuman`. Between those two operations there is no lock. In a single-threaded Node.js event loop this is not a problem for synchronous code; however, if `createHuman` is ever made async (e.g., for DB persistence in a later phase), two concurrent requests for the same first-time address could both pass `findByAddress → undefined` and then both attempt `createHuman`, with the second one throwing `address already registered`. The thrown error is unhandled in `auth.ts` (no try/catch around `createHuman`), causing a 500 response to the second requester.

**Fix:** Wrap the `createHuman` call in a try/catch that handles the duplicate-address error gracefully:

```typescript
let human = humanRegistry.findByAddress(gridName, ethAddress);
const isNew = human === undefined;
if (!human) {
    try {
        human = humanRegistry.createHuman({ eth_address: ethAddress, grid_name: gridName });
    } catch (err) {
        // Concurrent first-connect for same address: re-fetch.
        human = humanRegistry.findByAddress(gridName, ethAddress);
        if (!human) throw err; // genuinely unexpected
    }
    // Only emit human.joined for the winner of the race.
    if (isNew && human) { /* audit append here */ }
}
```

---

### WR-03: `portal/page.tsx` renders `ConnectWalletButton` without auth guard — middleware redirect is bypassed on first render

**File:** `dashboard/src/app/portal/page.tsx:1-20`
**Issue:** The `/portal` page is a server component (`export default function PortalPage()` — no `'use client'` directive). It renders `ConnectWalletButton`, which is a client component requiring `useAccount` from wagmi. When an authenticated user hits `/portal`, the middleware passes them through (cookie present). But an unauthenticated user who somehow arrives (e.g., the middleware cookie check passes due to a stale cookie not yet rejected by `/me`) will see the Connect Wallet UI rather than a redirect. More concretely, the page does no client-side check for `currentUser` and does not redirect to `/portal/auth` if the Zustand store shows no user. In its current form the portal home page is a stub, but any future page content shown here before auth-state hydration would be visible briefly to unauthenticated users.

**Fix:** Add a client-side auth check that mirrors the auth page's redirect pattern, or make this a client component that redirects when `!currentUser`:

```typescript
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

export default function PortalPage() {
    const { currentUser } = useHumanAuthStore();
    const router = useRouter();
    useEffect(() => {
        if (!currentUser) router.push('/portal/auth');
    }, [currentUser, router]);
    if (!currentUser) return null;
    // ... rest of page
}
```

---

### WR-04: `wagmi-config.ts` silently passes an empty string as WalletConnect project ID

**File:** `dashboard/src/lib/web3/wagmi-config.ts:17`
**Issue:** `process.env['NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'] ?? ''` falls back to an empty string when the env var is unset. The `walletConnect` connector from wagmi will not throw immediately but will fail at connection time with an obscure error. A missing project ID in development silently disables WalletConnect without any warning to the developer.

**Fix:** Log a warning (or throw in production) when the project ID is absent:

```typescript
const wcProjectId = process.env['NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'] ?? '';
if (!wcProjectId) {
    console.warn('[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set — WalletConnect will not function');
}
```

---

## Info

### IN-01: `human-auth-store.ts` has no persistence — Zustand state is lost on page reload

**File:** `dashboard/src/lib/stores/human-auth-store.ts:18-22`
**Issue:** The Zustand store is in-memory only. After a page reload, `currentUser` resets to `null` even though the `noesis_portal_token` cookie is still valid. The user will be redirected to `/portal/auth`, which will then fail to auto-sign-in. This creates a poor UX: every reload requires a manual "Sign In" click. The `/me` endpoint exists precisely to solve this — the auth page should call it on mount to rehydrate the session.

**Fix:** On mount in the auth page (or a session-bootstrap component), call `GET /api/v1/portal/auth/me` and populate the store if the response is 200.

---

### IN-02: `ConnectWalletButton` only offers the `injected()` connector via the connect button — WalletConnect connector is wired but unreachable from the UI

**File:** `dashboard/src/components/portal/ConnectWalletButton.tsx:40`
**Issue:** `wagmi-config.ts` registers both `injected()` and `walletConnect()` connectors, but `ConnectWalletButton` hardcodes `connect({ connector: injected() })`. WalletConnect users (mobile wallets, Ledger via QR) have no entry point. This is likely a known v2.5 limitation, but worth documenting.

**Fix:** Either render a connector picker, or add a comment acknowledging the limitation and linking to the phase where WalletConnect UI is planned.

---

### IN-03: `HumanRecord.eth_address` is stored lowercased but the JWT payload carries `eth_address: human.eth_address` (lowercased) while SIWE expects EIP-55 checksummed addresses

**File:** `grid/src/human/HumanRegistry.ts:25,34` and `grid/src/api/portal/auth.ts:86,111-116`
**Issue:** `createHuman` lowercases the ETH address before storing it (line 25). The JWT payload then includes `eth_address: human.eth_address`, which is the lowercased form. This is fine for internal use but could confuse consumers of the JWT who expect EIP-55 checksummed addresses (e.g., if a future route compares the JWT's `eth_address` against SIWE's checksummed output for authorization purposes). The SIWE library's `siweMessage.address` (line 86) is checksummed, and `createHuman` then lowercases it, creating an implicit case normalization that is not documented in the JWT payload comment.

**Fix:** Either document the lowercasing convention explicitly in the JWT issuance comment, or store and emit both forms (checksummed for display, lowercased for key comparisons). At minimum add a comment at line 111: `// eth_address is lowercased (stored form); SIWE address is EIP-55 checksummed`.

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
