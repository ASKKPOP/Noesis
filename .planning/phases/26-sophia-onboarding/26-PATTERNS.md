# Phase 26: Sophia Onboarding — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `dashboard/src/app/portal/onboard/page.tsx` | page (wizard) | request-response | `dashboard/src/app/portal/auth/page.tsx` | exact |
| `dashboard/src/app/portal/layout.tsx` | layout/middleware | request-response | `dashboard/src/app/portal/layout.tsx` (self) + `PortalShell.tsx` | role-match |
| `dashboard/src/lib/stores/human-auth-store.ts` | store | event-driven | `dashboard/src/lib/stores/human-auth-store.ts` (self) | exact |
| `dashboard/src/lib/web3/siwe-auth.ts` | utility/type def | request-response | `dashboard/src/lib/web3/siwe-auth.ts` (self) | exact |
| `grid/src/api/portal/chat.ts` (new) | route handler | request-response | `grid/src/api/portal/auth.ts` | role-match |
| `grid/src/api/portal/auth.ts` (extend) | route handler | request-response | `grid/src/api/portal/auth.ts` (self) | exact |
| `grid/src/db/schema.ts` (extend) | migration | CRUD | `grid/src/db/schema.ts` versions 10–13 | exact |

---

## Pattern Assignments

### `dashboard/src/app/portal/onboard/page.tsx` (page, request-response)

**Analog:** `dashboard/src/app/portal/auth/page.tsx`

**Key pattern — default export as ssr:false dynamic wrapper** (lines 643–644):
```typescript
export default dynamic(() => Promise.resolve({ default: PortalAuthPage }), { ssr: false });
```
The onboard page must use the identical pattern. The inner component name changes to `PortalOnboardPage`. Never `export default function` directly — wagmi hooks require client-only hydration.

**Imports pattern** (lines 12–23):
```typescript
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const CyberGridBg = dynamic(() => import('@/components/portal/CyberGrid'), { ssr: false });
import { useRouter } from 'next/navigation';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';
```
Onboard page drops wagmi imports (no wallet interaction needed) and adds nothing else. CyberGrid is loaded via `dynamic({ ssr: false })` — same pattern.

**Full-screen layout shell** (lines 220–248):
```typescript
return (
    <div style={{
        position: 'relative',
        minHeight: '100vh',
        background: '#020610',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        fontFamily: '"DM Sans", "Inter Tight", sans-serif',
    }}>
        {/* Live isometric city — full-screen non-interactive background */}
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
        }}>
            <CyberGridBg />
        </div>

        {/* Dark veil so content reads clearly over the busy city */}
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1,
            background: 'rgba(2,6,16,0.52)',
            pointerEvents: 'none',
        }} />

        {/* Content at zIndex 2 */}
        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 440 }}>
            ...
        </div>
    </div>
);
```
Copy this three-layer stack verbatim: `position:relative` root → `position:fixed inset:0 zIndex:0 pointerEvents:none` CyberGrid → `position:fixed inset:0 zIndex:1` dark veil → `position:relative zIndex:2` content.

**Primary button style** (lines 443–462 — the email submit button):
```typescript
<button
    type="submit"
    disabled={loading}
    style={{
        width: '100%',
        background: loading ? 'rgba(218,122,78,0.60)' : '#da7a4e',
        color: '#ffffff',
        border: 'none',
        borderRadius: 10,
        padding: '13px 16px',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: '"DM Sans", "Inter Tight", sans-serif',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
    }}
>
    Continue
</button>
```
Continue buttons across all 3 wizard steps use this exact style. The active color is `#da7a4e` (bronze/amber), disabled is `rgba(218,122,78,0.60)`.

**Card / glass panel style** (lines 295–302):
```typescript
<div style={{
    background: 'rgba(2,6,16,0.72)',
    border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: 16,
    padding: '36px 36px 28px',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,212,255,0.03)',
}}>
```
Sophia chat panel and step content panels use this glass-card style.

**Redirect if already onboarded** — mirrors the existing "already signed in" redirect (lines 97–99):
```typescript
useEffect(() => {
    if (currentUser?.onboarded) router.push('/portal');
}, [currentUser, router]);
```

**API fetch pattern** (lines 124–127):
```typescript
const meRes = await fetch(`${gridApiBase}/api/v1/portal/auth/me`, { credentials: 'include' });
```
All Grid calls from onboard page use `credentials: 'include'` and read `process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080'` for the base URL. No dedicated API client.

**What differs from auth/page.tsx:**
- Wizard state machine replaces tab switcher (`step: 1 | 2 | 3` instead of `tab: 'signin' | 'join'`)
- Step 2 has a local `messages: Array<{ role: 'sophia' | 'user'; text: string }>` state and calls `POST /api/v1/portal/chat/onboard`
- Step 3 drives CyberGrid district highlighting via a prop or CSS overlay — see CyberGrid pattern below
- No wagmi hooks needed (user is already authenticated when they reach `/portal/onboard`)
- `fontFamily: 'var(--serif)'` for Sophia's message bubbles; `fontFamily: 'var(--sans-portal)'` for user input and UI chrome

---

### `dashboard/src/app/portal/layout.tsx` (layout, extend)

**Analog:** `dashboard/src/app/portal/layout.tsx` (self) + `dashboard/src/components/portal/PortalShell.tsx`

**Current layout pattern** (full file, 47 lines) — do not restructure, only add redirect logic:
```typescript
'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';

const PortalWagmiShell = dynamic(
    () => import('@/components/portal/PortalWagmiShell'),
    { ssr: false, loading: () => <PortalSkeleton /> },
);

export default function PortalLayout({ children }: { children: ReactNode }) {
    return <PortalWagmiShell>{children}</PortalWagmiShell>;
}
```

**The redirect belongs in PortalShell.tsx, not layout.tsx.** The shell already bypasses itself for `/portal/auth` (line 17):
```typescript
if (pathname === '/portal/auth') {
    return <>{children}</>;
}
```
Add the same bypass for `/portal/onboard` AND add an `onboarded` redirect check:
```typescript
const pathname = usePathname();
const { currentUser } = useHumanAuthStore();

// Onboard page is full-screen — no sidebar or header.
if (pathname === '/portal/onboard' || pathname === '/portal/auth') {
    return <>{children}</>;
}

// Redirect first-time users to onboarding before any other portal page.
if (currentUser && !currentUser.onboarded && pathname !== '/portal/onboard') {
    router.replace('/portal/onboard');
    return null;
}
```

**What differs:** PortalShell gains `useHumanAuthStore` import and `useRouter` import; layout.tsx itself is unchanged.

---

### `dashboard/src/lib/stores/human-auth-store.ts` (store, extend)

**Analog:** `dashboard/src/lib/stores/human-auth-store.ts` (self)

**Current store pattern** (full file, 22 lines):
```typescript
import { create } from 'zustand';
import type { HumanUser } from '@/lib/web3/siwe-auth';

interface HumanAuthState {
    currentUser: HumanUser | null;
    setUser: (user: HumanUser) => void;
    clearUser: () => void;
}

export const useHumanAuthStore = create<HumanAuthState>((set) => ({
    currentUser: null,
    setUser: (user) => set({ currentUser: user }),
    clearUser: () => set({ currentUser: null }),
}));
```

**What to add:** `onboarded: boolean` is added to the `HumanUser` interface in `siwe-auth.ts` (see below), so the store picks it up automatically through the `HumanUser` type. No store structure change needed — only the type definition changes.

---

### `dashboard/src/lib/web3/siwe-auth.ts` (utility/type, extend)

**Analog:** `dashboard/src/lib/web3/siwe-auth.ts` (self)

**Current HumanUser interface** (lines 13–22):
```typescript
export interface HumanUser {
    did: string;
    eth_address: string;
    /** Present for email-authenticated users. */
    email?: string;
    /** Auto-assigned region — populated from /me after sign-in. */
    region?: string | null;
    /** ISO 8601 join timestamp — populated from /me after sign-in. */
    created_at?: string | null;
}
```

**What to add** — append `onboarded` as optional (populated from `/me` after sign-in, same pattern as `region` and `created_at`):
```typescript
/** True when human_users.onboarding_goal IS NOT NULL. Populated from /me. */
onboarded?: boolean;
```

**The /me hydration in auth/page.tsx** (lines 122–137) already overwrites the store with the full profile after sign-in:
```typescript
const meData = await fetch(`${gridApiBase}/api/v1/portal/auth/me`, { credentials: 'include' });
setUser(meData);  // overwrites with full profile including onboarded
```
Once Grid's `/me` returns `onboarded`, this wiring is automatic.

---

### `grid/src/api/portal/chat.ts` (new route handler, request-response)

**Analog:** `grid/src/api/portal/auth.ts`

**Registration function pattern** (lines 52–55):
```typescript
export function registerPortalChatRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
```
New file exports `registerPortalChatRoutes`. Registration is added to `grid/src/api/portal/index.ts` alongside `registerPortalAuthRoutes`.

**Route handler pattern** (lines 69–81 of auth.ts — POST /verify body validation):
```typescript
app.post<{
    Body: { messages: unknown };
}>('/api/v1/portal/chat/onboard', async (req, reply) => {
    const body = req.body ?? ({} as { messages: unknown });
    const { messages } = body;
    if (!Array.isArray(messages)) {
        return reply.status(400).send({ error: 'invalid_request' });
    }
```

**JWT auth guard pattern** (lines 286–301 of auth.ts — GET /me):
```typescript
const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
if (!token) {
    return reply.status(401).send({ error: 'not_authenticated' });
}
try {
    const { publicKey } = await keyPairPromise;
    const { payload } = await jwtVerify(token, publicKey);
    // payload.did is the authenticated human's DID
} catch {
    return reply.status(401).send({ error: 'invalid_token' });
}
```
Import `{ COOKIE_NAME, keyPairPromise }` from `./auth.js` — same module, no duplication.

**LLM proxy pattern** — no existing analog in Grid codebase. Use environment variable `BRAIN_URL` (or `LLM_URL`) for the upstream endpoint. Pattern follows the Brain bridge HTTP pattern: `fetch` POST to the configured provider URL with `Content-Type: application/json`. The system prompt is embedded as a constant string in the file.

**Error handling pattern** (auth.ts throughout):
```typescript
try {
    // operation
} catch {
    return reply.status(500).send({ error: 'llm_unavailable' });
}
```

**Import block to copy** (auth.ts lines 17–23):
```typescript
import { jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';
```

**What differs from auth.ts:**
- Route is `POST /api/v1/portal/chat/onboard` only (single route, not multi-route like auth.ts)
- Body is `{ messages: Array<{ role: 'user' | 'assistant'; content: string }> }` (OpenAI-compatible chat format)
- Handler calls external LLM provider via `fetch` using `BRAIN_URL` or `LLM_PROXY_URL` env var
- System prompt constant is defined at top of file: `const SOPHIA_ONBOARD_SYSTEM_PROMPT = '...'`
- Response body: `{ reply: string }` — no cookie manipulation
- No DB writes in this handler (goal storage is PATCH /me, separate handler)

---

### `grid/src/api/portal/auth.ts` (extend — GET /me + PATCH /me)

**Analog:** `grid/src/api/portal/auth.ts` (self)

**Existing GET /me pattern** (lines 284–302) — add `onboarded` to the response:
```typescript
app.get('/api/v1/portal/auth/me', async (req, reply) => {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) return reply.status(401).send({ error: 'not_authenticated' });
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        return reply.send({
            did: payload['did'],
            eth_address: payload['eth_address'],
            region: (payload['region'] as string | undefined) ?? null,
            created_at: (payload['created_at'] as string | undefined) ?? null,
            onboarded: /* DB query: human_users.onboarding_goal IS NOT NULL */,
        });
    } catch {
        return reply.status(401).send({ error: 'invalid_token' });
    }
});
```
`onboarded` requires a DB lookup because it's not in the JWT payload. Use the same pool pattern as `humanSanctionStore` in main.ts:
```typescript
const [rows] = await pool.query(
    'SELECT onboarding_goal FROM human_users WHERE did = ? LIMIT 1',
    [payload['did']]
) as any;
const onboarded = rows.length > 0 && rows[0].onboarding_goal !== null;
```

**New PATCH /me pattern** (copy PATCH shape from POST /verify body validation):
```typescript
app.patch<{
    Body: { onboarding_goal: unknown };
}>('/api/v1/portal/auth/me', async (req, reply) => {
    // 1. JWT auth guard (same as GET /me)
    // 2. Validate body.onboarding_goal is a non-empty string
    // 3. UPDATE human_users SET onboarding_goal = ? WHERE did = ?
    // 4. Return { ok: true }
    // On DB error: log but return { ok: true } per D-08 (non-blocking)
});
```

**What differs:** GET /me gains `onboarded` field; PATCH /me is new — needs `services.db` pool (pattern from main.ts lines 144–158 where pool is accessed directly via `pool.query()`).

---

### `grid/src/db/schema.ts` (extend — version 14)

**Analog:** `grid/src/db/schema.ts` versions 10–13 (ALTER TABLE pattern)

**Current highest version is 13** (add_banned_human_users, lines 261–268):
```typescript
{
    version: 13,
    name: 'add_banned_human_users',
    up: `
        ALTER TABLE human_users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0;
    `,
    down: `
        ALTER TABLE human_users DROP COLUMN banned;
    `,
},
```

**Version 10 pattern** (lines 213–217) — single-line ALTER for a column add:
```typescript
{
    version: 10,
    name: 'add_region_to_human_users',
    up: `ALTER TABLE human_users ADD COLUMN region VARCHAR(127) NOT NULL DEFAULT 'agora'`,
    down: `ALTER TABLE human_users DROP COLUMN region`,
},
```

**New migration to append** (version 14, not 11 — the schema has already advanced to 13):
```typescript
{
    version: 14,
    name: 'add_onboarding_goal_to_human_users',
    up: `ALTER TABLE human_users ADD COLUMN onboarding_goal TEXT NULL DEFAULT NULL`,
    down: `ALTER TABLE human_users DROP COLUMN onboarding_goal`,
},
```

Note: CONTEXT.md D-13 says "Schema version 11" but the schema file already has versions 11, 12, and 13 from subsequent phases. The correct next version is **14**. The planner must use 14, not 11.

**MigrationRunner pattern** — no change needed. Appending to the `MIGRATIONS` array is sufficient; `MigrationRunner.run()` in main.ts applies missing versions automatically on boot.

---

## Shared Patterns

### CSS Variables — No Raw Color Values
**Source:** All existing portal components
**Apply to:** All new dashboard files in Phase 26
```typescript
// Correct
style={{ color: 'var(--ink)', fontFamily: 'var(--serif)' }}

// Wrong — never Tailwind color classes or raw hex for the portal palette
className="text-amber-500"
style={{ color: '#da7a4e' }}  // ← only acceptable in auth/page.tsx clones
```
Exception: `#020610` (page background) and `#da7a4e` (bronze) are used as raw values in auth/page.tsx because they predate the CSS variable system — new files should use `var(--navy)` and `var(--bronze)` if those variables exist in globals.css, otherwise raw hex is acceptable.

### `dynamic({ ssr: false })` for CyberGrid
**Source:** `dashboard/src/app/portal/auth/page.tsx` lines 15–16
**Apply to:** `portal/onboard/page.tsx`
```typescript
const CyberGridBg = dynamic(() => import('@/components/portal/CyberGrid'), { ssr: false });
```
CyberGrid uses canvas APIs unavailable in Node.js — always SSR-disabled.

### `credentials: 'include'` on All Grid Fetches
**Source:** `dashboard/src/app/portal/auth/page.tsx` line 125, `siwe-auth.ts` line 83
**Apply to:** All fetch calls in `portal/onboard/page.tsx`
```typescript
await fetch(`${gridApiBase}/api/v1/portal/chat/onboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ messages }),
});
```

### JWT Auth Guard in Grid Routes
**Source:** `grid/src/api/portal/auth.ts` lines 286–301 (GET /me)
**Apply to:** `POST /api/v1/portal/chat/onboard`, `PATCH /api/v1/portal/auth/me`
```typescript
import { COOKIE_NAME, keyPairPromise } from './auth.js';

const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
if (!token) return reply.status(401).send({ error: 'not_authenticated' });
const { publicKey } = await keyPairPromise;
const { payload } = await jwtVerify(token, publicKey);
// payload.did = authenticated human DID
```

### Fastify Route Registration Pattern
**Source:** `grid/src/api/portal/index.ts`
**Apply to:** `grid/src/api/portal/chat.ts` + `grid/src/api/portal/index.ts` (extend)
```typescript
// In chat.ts:
export function registerPortalChatRoutes(app: FastifyInstance, services: GridServices): void { ... }

// In index.ts, add:
import { registerPortalChatRoutes } from './chat.js';
// Inside registerPortalRoutes():
registerPortalChatRoutes(app, services);
```

### PortalShell Bypass for Full-Screen Pages
**Source:** `dashboard/src/components/portal/PortalShell.tsx` lines 17–19
**Apply to:** `PortalShell.tsx` (extend)
```typescript
if (pathname === '/portal/auth' || pathname === '/portal/onboard') {
    return <>{children}</>;
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| LLM proxy fetch inside `grid/src/api/portal/chat.ts` | HTTP client | request-response | No existing direct LLM fetch in Grid codebase — Brain bridge uses Unix socket RPC, not HTTP. Use `fetch` to `process.env.LLM_PROXY_URL` with OpenAI-compatible `/chat/completions` body. |

---

## Metadata

**Analog search scope:** `dashboard/src/app/portal/`, `dashboard/src/lib/stores/`, `dashboard/src/lib/web3/`, `dashboard/src/components/portal/`, `grid/src/api/portal/`, `grid/src/db/`
**Files scanned:** 14
**Pattern extraction date:** 2026-05-22

**Schema version note:** CONTEXT.md D-13 states "schema version 11" but the live schema file (`grid/src/db/schema.ts`) already has versions through 13. The Phase 26 migration must be **version 14**.
