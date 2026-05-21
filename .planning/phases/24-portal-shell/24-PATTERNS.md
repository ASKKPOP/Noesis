# Phase 24: Portal Shell — Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 9
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/db/schema.ts` | config (migration array) | CRUD | self (append to existing array) | self-modify |
| `grid/src/human/types.ts` | model | — | self (add field to interface) | self-modify |
| `grid/src/api/portal/auth.ts` | controller | request-response | self (extend JWT + /me handler) | self-modify |
| `dashboard/src/lib/web3/siwe-auth.ts` | utility | request-response | self (extend HumanUser interface) | self-modify |
| `dashboard/src/lib/stores/human-auth-store.ts` | store | — | self (driven by HumanUser type) | self-modify |
| `dashboard/src/components/portal/PortalShell.tsx` | component | event-driven | self (add useState + prop threading) | self-modify |
| `dashboard/src/components/portal/PortalSidebar.tsx` | component | event-driven | self (add isOpen/onClose props + CSS overlay) | self-modify |
| `dashboard/src/components/portal/PortalHeader.tsx` | component | event-driven | self (add onMenuOpen prop + hamburger) | self-modify |
| `dashboard/src/app/portal/profile/page.tsx` | component | CRUD | self (add rows + wagmi hooks from WalletPanel) | self-modify + WalletPanel analog |
| `dashboard/src/app/portal/page.tsx` | component | polling | self (replace static data with useEffect/setInterval) | self-modify |

All Phase 24 files are modifications to existing files, not new files. Each file is its own closest analog. Pattern extraction below covers what is already there and what must be added.

---

## Pattern Assignments

### `grid/src/db/schema.ts` (config, migration append)

**Analog:** self — append to `MIGRATIONS` array at line 14

**Existing migration entry pattern** (lines 196–211 — version 9, `create_human_users`):
```typescript
{
    version: 9,
    name: 'create_human_users',
    up: `
        CREATE TABLE IF NOT EXISTS human_users (
            id           BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
            grid_name    VARCHAR(63)         NOT NULL,
            did          VARCHAR(255)        NOT NULL,
            eth_address  VARCHAR(255)        NOT NULL,
            created_at   TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE KEY uq_did          (grid_name, did),
            UNIQUE KEY uq_eth_address  (grid_name, eth_address)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS human_users`,
},
```

**Version 10 entry to append** (after line 211, closing `]` on line 212):
```typescript
{
    version: 10,
    name: 'add_region_to_human_users',
    up: `ALTER TABLE human_users ADD COLUMN region VARCHAR(127) NOT NULL DEFAULT 'agora'`,
    down: `ALTER TABLE human_users DROP COLUMN region`,
},
```

**Copy pattern:** same `{ version, name, up, down }` shape, `ALTER TABLE` for additive column changes (not `CREATE TABLE`). The `down` is the inverse DDL statement.

---

### `grid/src/human/types.ts` (model, interface extension)

**Analog:** self — current file is lines 1–22

**Current `HumanRecord` interface** (lines 8–15):
```typescript
export interface HumanRecord {
    readonly did: string;
    readonly eth_address: string;
    readonly grid_name: string;
    readonly created_at: Date;
}
```

**Change:** add `readonly region: string` after `grid_name`.

**Current `CreateHumanParams`** (lines 17–21):
```typescript
export interface CreateHumanParams {
    eth_address: string;
    grid_name: string;
}
```

**Change:** add `region?: string` (optional, defaults to `'agora'` in registry). Copy the existing optional field convention — `email?` in `siwe-auth.ts` HumanUser is the same pattern.

---

### `grid/src/api/portal/auth.ts` (controller, request-response)

**Analog:** self — two separate changes in the same file

**Change 1 — JWT issuance in `/verify` handler** (lines 110–119 — current `SignJWT` call):
```typescript
// CURRENT — lines 111–119
const token = await new SignJWT({
    did: human.did,
    eth_address: human.eth_address,
    grid_name: gridName,
})
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(privateKey);
```

**Replace with** (add two fields to the payload object):
```typescript
const token = await new SignJWT({
    did: human.did,
    eth_address: human.eth_address,
    grid_name: gridName,
    region: human.region,                       // NEW
    created_at: human.created_at.toISOString(), // NEW
})
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(privateKey);
```

**Change 2 — `/me` handler response** (lines 139–154 — current `/me` handler):
```typescript
// CURRENT — lines 139–154
app.get('/api/v1/portal/auth/me', async (req, reply) => {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) {
        return reply.status(401).send({ error: 'not_authenticated' });
    }
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        return reply.send({
            did: payload['did'],
            eth_address: payload['eth_address'],
        });
    } catch {
        return reply.status(401).send({ error: 'invalid_token' });
    }
});
```

**Replace `reply.send({...})` block** with:
```typescript
return reply.send({
    did: payload['did'],
    eth_address: payload['eth_address'],
    region: (payload['region'] as string | undefined) ?? 'agora',       // NEW
    created_at: (payload['created_at'] as string | undefined) ?? null,  // NEW
});
```

**Auth/error pattern:** all 401 paths already present — copy the `try { ... } catch { return reply.status(401) }` structure exactly. No new error codes needed.

---

### `dashboard/src/lib/web3/siwe-auth.ts` (utility, interface extension)

**Analog:** self — `HumanUser` interface at lines 13–18

**Current `HumanUser`** (lines 13–18):
```typescript
export interface HumanUser {
    did: string;
    eth_address: string;
    /** Present for email-authenticated users. */
    email?: string;
}
```

**Change:** add two optional fields following the same optional-with-comment pattern:
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

**Also:** in `signInWithEthereum`, line 94 builds the return value manually. After adding fields to `HumanUser`, the `/me` call pattern (in the auth page) becomes the population path. The `signInWithEthereum` return still comes from `/verify` — extend to pass through `region` and `created_at` if they appear in the verify response, or leave them `undefined` and let the auth page hydrate via `/me`. Either way the type shape must match.

**`credentials: 'include'` pattern** (line 81): all Grid fetch calls use this. The `/me` call from the auth page must follow the same pattern:
```typescript
const meRes = await fetch('/api/v1/portal/auth/me', { credentials: 'include' });
```

---

### `dashboard/src/lib/stores/human-auth-store.ts` (store)

**Analog:** self — file is 22 lines; driven entirely by the `HumanUser` type import

**Current store** (lines 1–22):
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

**Change:** once `HumanUser` gains `region` and `created_at` fields in `siwe-auth.ts`, this file requires NO changes. The store automatically carries the new fields via the type. Only verify the import path remains `@/lib/web3/siwe-auth`.

---

### `dashboard/src/components/portal/PortalShell.tsx` (component, event-driven)

**Analog:** self — current file is 29 lines

**Current shell** (lines 1–29):
```typescript
'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';

export function PortalShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    if (pathname === '/portal/auth') {
        return <>{children}</>;
    }

    return (
        <div className="portal-theme flex h-screen overflow-hidden">
            <PortalSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <PortalHeader />
                <main className="flex-1 overflow-y-auto" style={{ background: 'var(--vellum)' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
```

**Changes:**
1. Add `useState` import from `'react'` (already `import type { ReactNode }` — change to `import { useState, useEffect, type ReactNode }`).
2. Add `menuOpen` state and route-change close effect.
3. Thread props to children.

**Target shape:**
```typescript
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PortalSidebar } from './PortalSidebar';
import { PortalHeader } from './PortalHeader';

export function PortalShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);

    // Close sidebar on route change (Pitfall 6)
    useEffect(() => { setMenuOpen(false); }, [pathname]);

    if (pathname === '/portal/auth') {
        return <>{children}</>;
    }

    return (
        <div className="portal-theme flex h-screen overflow-hidden">
            <PortalSidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <PortalHeader onMenuOpen={() => setMenuOpen(true)} />
                <main className="flex-1 overflow-y-auto" style={{ background: 'var(--vellum)' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
```

**Pattern note:** `className="portal-theme flex h-screen overflow-hidden"` uses Tailwind structural utilities alongside inline styles — this is the established mixed pattern; preserve it.

---

### `dashboard/src/components/portal/PortalSidebar.tsx` (component, event-driven)

**Analog:** self — current `PortalSidebar` function starts at line 143

**Current function signature** (line 143):
```typescript
export function PortalSidebar() {
```

**Current `<aside>` inline style** (lines 155–163):
```typescript
<aside style={{
    width: 220,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--navy)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    overflow: 'hidden',
}}>
```

**Current logo area** (lines 165–189):
```typescript
<div style={{
    padding: '20px 16px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
}}>
    <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: '#f5f0e8', ... }}>
        Noēsis
    </div>
    ...
</div>
```

**Changes — 4 surgical edits:**

1. **Signature:** `export function PortalSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void })`

2. **Backdrop div** — rendered before `<aside>` (only when mobile + open). Gate with `isOpen` only; hamburger never fires on desktop so `isOpen` is always `false` above 768px:
```tsx
{isOpen && (
    <div
        onClick={onClose}
        style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11,18,32,0.40)',
            zIndex: 49,
        }}
    />
)}
```

3. **`<aside>` style** — extend with responsive classes and CSS transform. The `md:relative` + `md:translate-x-0` approach uses Tailwind structural utilities (acceptable per project pattern):
```tsx
<aside
    className="md:relative md:translate-x-0"
    style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--navy)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
        // Mobile overlay positioning
        position: 'fixed' as const,   // overridden to relative on md via className
        top: 0,
        left: 0,
        height: '100%',
        zIndex: 50,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.2s ease',
    }}
>
```

4. **Close button (×)** inside logo area — right-aligned, visible only on mobile. Insert after the subtitle `<div>` in the logo block:
```tsx
<button
    onClick={onClose}
    className="md:hidden"
    aria-label="Close navigation"
    style={{
        position: 'absolute',
        top: 18,
        right: 12,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'rgba(200,192,184,0.72)',
        fontSize: 18,
        lineHeight: 1,
        padding: '4px',
        fontFamily: 'var(--sans-portal)',
        fontWeight: 400,
    }}
>
    ×
</button>
```
The logo `<div>` parent needs `position: 'relative'` added to allow absolute positioning of the × button.

**Color references** (from existing sidebar): `'rgba(200,192,184,0.72)'` is the standard muted text color — used already for nav links at line 108. Background overlay `rgba(11,18,32,0.40)` matches `--navy` base at 40% opacity.

---

### `dashboard/src/components/portal/PortalHeader.tsx` (component, event-driven)

**Analog:** self — current `PortalHeader` function at lines 35–169

**Current function signature** (line 35):
```typescript
export function PortalHeader() {
```

**Current left breadcrumb block** (lines 59–80) — hamburger button inserts BEFORE the breadcrumb span:
```tsx
{/* Left: breadcrumb */}
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontFamily: 'var(--mono-portal)', fontSize: 10, ... }}>Portal</span>
    <span style={{ color: 'var(--rule)', fontSize: 14 }}>/</span>
    <span style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, fontWeight: 600, ... }}>{pageLabel}</span>
</div>
```

**Changes — 2 surgical edits:**

1. **Signature:** `export function PortalHeader({ onMenuOpen }: { onMenuOpen: () => void })`

2. **Hamburger button** — insert as first child of the left `<div>` (before the Portal breadcrumb span). Uses `className="md:hidden"` to hide on desktop:
```tsx
<button
    onClick={onMenuOpen}
    className="md:hidden"
    aria-label="Open navigation"
    style={{
        background: 'transparent',
        border: 'none',
        padding: '8px',
        cursor: 'pointer',
        minHeight: 44,
        minWidth: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -8,  // optical alignment with header left edge
    }}
>
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
        <line x1="2" y1="5"  x2="16" y2="5"  stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <line x1="2" y1="9"  x2="16" y2="9"  stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <line x1="2" y1="13" x2="16" y2="13" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
</button>
```

**Style note:** `var(--ink)` is the existing dark text token used throughout PortalHeader (lines 76, 77). Hamburger lines use the same token. `fontWeight: 400` on the × button and `fontWeight: 500` is NOT used in buttons (Pitfall 5 — only 400 and 600 permitted).

---

### `dashboard/src/app/portal/profile/page.tsx` (component, CRUD)

**Analog:** self for structure + `WalletPanel.tsx` lines 17–48 for wagmi hooks

**Current `rows` array** (lines 24–29):
```typescript
const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'DID',              value: currentUser?.did ?? '—',                          mono: true },
    { label: 'Ethereum Address', value: currentUser?.eth_address ?? address ?? '—',       mono: true },
    { label: 'Network',          value: chain?.name ?? '—' },
    { label: 'Agency Tier',      value: 'H1 — Observe only' },
];
```

**Current `<dl>` render loop** (lines 99–135): renders each row as a `<div>` with `<dt>` (fixed 148px width, mono, uppercase) and `<dd>` (font varies by `mono` flag).

**Changes — 3 new additions:**

**1. Wagmi imports** — add from WalletPanel pattern (lines 17–48 of WalletPanel.tsx):
```typescript
import { useAccount, useDisconnect, useBalance, useReadContract } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { formatEther, formatUnits } from 'viem';

const USDT_ADDR: Record<number, `0x${string}`> = {
    [mainnet.id]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};
const ERC20_ABI = [
    { name: 'balanceOf', type: 'function' as const, stateMutability: 'view' as const,
      inputs: [{ name: 'account', type: 'address' as const }], outputs: [{ type: 'uint256' as const }] },
] as const;
```

**2. Wagmi hook calls** — add inside `ProfilePage` function, same call shape as WalletPanel:
```typescript
const usdtAddr = chain?.id ? USDT_ADDR[chain.id] : undefined;
const { data: ethBal } = useBalance({ address });
const { data: usdtRaw } = useReadContract({
    address: usdtAddr,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!usdtAddr && !!address },
});
```

**3. Three new rows** — add to the `rows` array after 'Network' and before 'Agency Tier':
```typescript
{ label: 'Current Region', value: currentUser?.region
    ? currentUser.region.charAt(0).toUpperCase() + currentUser.region.slice(1)
    : '—' },
{ label: 'Member Since', value: currentUser?.created_at
    ? new Date(currentUser.created_at).toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : '—' },
```

**Balance row** — rendered as a separate hardcoded `<div>` outside the `rows` loop (per RESEARCH.md recommendation: Option 2, simpler). Insert between Network row and Agency Tier row:
```tsx
{/* Cyber Coin Balance — separate because it needs an inline link */}
<div style={{
    display: 'flex', alignItems: 'flex-start', gap: 16,
    padding: '12px 20px',
    borderBottom: '1px solid var(--rule)',
}}>
    <dt style={{
        width: 148, flexShrink: 0,
        fontFamily: 'var(--mono-portal)',
        fontSize: 10, fontWeight: 600,
        letterSpacing: '0.10em', textTransform: 'uppercase',
        color: 'var(--muted)', paddingTop: 2,
    }}>
        Cyber Coin
    </dt>
    <dd style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
        {ethBal ? parseFloat(formatEther(ethBal.value)).toFixed(4) : '—'} ETH
        {' · '}
        {usdtRaw !== undefined ? parseFloat(formatUnits(usdtRaw as bigint, 6)).toFixed(2) : '—'} USDT
        {' '}
        <Link href="/portal/wallet" style={{
            fontFamily: 'var(--mono-portal)',
            fontSize: 10, letterSpacing: '0.06em',
            color: 'var(--bronze)',
            textDecoration: 'none',
        }}>
            → Wallet
        </Link>
    </dd>
</div>
```

**dt fontWeight:** existing rows use `fontWeight: 500` at line 117 — BUT Pitfall 5 says only 400 and 600 are allowed. The planner must use **600** for `<dt>` labels in the new rows to match the UI-SPEC. The existing row at line 117 uses 500 — this is an existing violation but Phase 24 must not replicate it.

**SSR guard** (line 177 — must be preserved unchanged):
```typescript
export default dynamic(() => Promise.resolve({ default: ProfilePage }), { ssr: false });
```

---

### `dashboard/src/app/portal/page.tsx` (component, polling)

**Analog:** self — existing component is 533 lines

**Current static data constants** (lines 14–104):
- `STATS` array at lines 14–19 (4 hardcoded entries)
- `NOUS_AGENTS` array at lines 94–98 (3 hardcoded entries with `status: 'live'`)
- `UPDATES` array at lines 100–104 (3 hardcoded entries)

**Current component function** (line 108):
```typescript
export default function PortalDashboard() {
    const { address, isConnected } = useAccount();
    const { currentUser } = useHumanAuthStore();
```

**Current header label** (line 129):
```tsx
Grid · Phase 22
```

**Changes — 5 surgical edits:**

**1. Add `useState` + `useEffect` imports** (line 8 area — currently only `Link` from next/link, `useAccount` from wagmi, `useHumanAuthStore`):
```typescript
import { useState, useEffect } from 'react';
```

**2. Add NousRosterEntry type** (inline, no new file needed):
```typescript
interface NousRosterEntry {
    did: string;
    name: string;
    region: string;
    status: string;
}
```

**3. Add live state + polling effect** inside `PortalDashboard`:
```typescript
const [liveNous, setLiveNous] = useState<NousRosterEntry[]>([]);
const [currentTick, setCurrentTick] = useState<number | null>(null);

useEffect(() => {
    async function fetchStats() {
        const [nousRes, statusRes] = await Promise.allSettled([
            fetch('/api/v1/grid/nous', { credentials: 'include' }),
            fetch('/api/v1/grid/status', { credentials: 'include' }),
        ]);
        if (nousRes.status === 'fulfilled' && nousRes.value.ok) {
            const data = await nousRes.value.json() as { nous: NousRosterEntry[] };
            setLiveNous(data.nous);
        }
        if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
            const data = await statusRes.value.json() as { tick: number };
            setCurrentTick(data.tick);
        }
    }
    void fetchStats();
    const id = setInterval(() => void fetchStats(), 15_000);
    return () => clearInterval(id);
}, []);
```

**4. Replace header label** (line 129):
```tsx
// FROM:
Grid · Phase 22
// TO:
Grid · v2.5
```

**5. Replace STATS render** — current STATS map at lines 200–237 uses the static `STATS` constant. Replace with three live-derived stat cards using the same card shape (`background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 6, padding: '16px 20px'`):

Active Nous card:
```tsx
{/* Active Nous — live from /api/v1/grid/nous */}
<div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 6, padding: '16px 20px' }}>
    <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
        Active Nous
    </div>
    <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>
        {liveNous.length || '—'}
    </div>
    <div style={{ fontFamily: 'var(--sans-portal)', fontSize: 11, color: 'var(--muted)', opacity: 0.8 }}>
        {liveNous.map(n => n.name).join(' · ') || 'Sophia · Hermes · Themis'}
    </div>
</div>
```

Current Tick card (same card shape, value from `currentTick`).

Phase label card (static — `'v2.5'`, sub: `'Portal Shell'`).

**6. Replace NOUS_AGENTS render** — existing render at lines 344–388. Drive status from `liveNous` instead of hardcoded:
```typescript
const KNOWN_AGENTS = [
    { name: 'Sophia', role: 'Philosopher', color: '#bf00ff' },
    { name: 'Hermes', role: 'Trader',      color: '#ffd700' },
    { name: 'Themis', role: 'Lawkeeper',   color: '#ff4400' },
];
```
In the render, derive `isLive` per agent:
```typescript
const isLive = liveNous.some(n => n.name === agent.name && n.status === 'active');
```
Status badge color: `'#4ade80'` for live (existing), `'rgba(200,192,184,0.28)'` for offline (matches `isSoon` muted color in PortalSidebar at line 109).

**7. Replace UPDATES constant** — replace the three-entry array:
```typescript
const UPDATES = [
    { date: 'May 2026', text: 'Phase 22 live — Human Portal & SIWE authentication launched.' },
    { date: 'May 2026', text: 'Phase 23 live — Cyber Coin Wallet and human.transferred event.' },
    { date: 'Coming',   text: 'Phase 24 — Portal Shell: region presence, mobile layout, live Grid stats.' },
    { date: 'Coming',   text: 'Phase 26 — Direct dialogue with Nous agents planned.' },
];
```

**8. Section card phase badges** — update SECTIONS constant entries: Wallet card removes `phase: 'P23'` (now live). Chat/My Nous/Community/Leaderboard phase badges updated per roadmap (see CONTEXT.md D-11). Cross-links to `/worldmap` and `/nous` stay unchanged (D-12).

---

## Shared Patterns

### CSS Variable Design Tokens (cross-cutting — all portal components)
**Source:** `dashboard/src/app/globals.css` and established in all portal components
**Apply to:** All new JSX in PortalShell, PortalSidebar, PortalHeader, profile/page, page

Use inline `style={{ ... }}` objects with CSS variables, not Tailwind color/spacing tokens:
- Background: `var(--parchment)`, `var(--navy)`, `var(--vellum)`
- Text: `var(--ink)`, `var(--muted)`, `var(--bronze)`
- Border: `var(--rule)`
- Accent: `var(--terracotta)`, `var(--terracotta-2)`
- Mono font: `var(--mono-portal)` — used for labels, addresses, status chips
- Sans font: `var(--sans-portal)` — used for body text and nav links
- Serif font: `var(--serif)` — used for headings and agent names
- Muted overlay (inactive/coming): `rgba(200,192,184,0.28)` (established in PortalSidebar line 109)
- Muted text: `rgba(200,192,184,0.72)` (established in PortalSidebar line 108)

**fontWeight rule (Pitfall 5):** Only 400 and 600. Never 500 in new code.

### Tailwind Structural Utilities (cross-cutting — layout only)
**Source:** `PortalShell.tsx` line 19 (`className="portal-theme flex h-screen overflow-hidden"`)
**Apply to:** `PortalSidebar.tsx`, `PortalHeader.tsx` responsive additions

`md:hidden` — hides element below 768px; use for hamburger button in PortalHeader.
`md:relative md:translate-x-0` — overrides fixed/translated positioning back to normal on desktop; use on `<aside>` in PortalSidebar.

### SSR Guard Pattern (cross-cutting — wagmi pages)
**Source:** `dashboard/src/app/portal/profile/page.tsx` line 177
**Apply to:** Any portal page that adds wagmi hooks

```typescript
export default dynamic(() => Promise.resolve({ default: ComponentName }), { ssr: false });
```
Profile page already has this — preserve it. `portal/page.tsx` is already `'use client'` with wagmi — no dynamic wrapper needed there; it fetches via `fetch`, not wagmi hooks.

### Grid API Fetch Pattern (cross-cutting — all dashboard Grid calls)
**Source:** `dashboard/src/lib/web3/siwe-auth.ts` line 81, `WalletPanel.tsx` line 91
**Apply to:** Portal home polling, `/me` post-sign-in call

```typescript
fetch('/api/v1/...', { credentials: 'include' })
```
Always include `credentials: 'include'` for the `noesis_portal_token` httpOnly cookie.

### `Promise.allSettled` fetch pattern (portal home polling)
**Source:** RESEARCH.md Code Examples, confirmed correct
```typescript
const [nousRes, statusRes] = await Promise.allSettled([
    fetch('/api/v1/grid/nous', { credentials: 'include' }),
    fetch('/api/v1/grid/status', { credentials: 'include' }),
]);
```
Use `allSettled` (not `Promise.all`) so a single failing endpoint does not block the other. Check `.status === 'fulfilled' && .value.ok` before reading data.

### Sign-out handler (cross-cutting — portal components)
**Source:** `PortalHeader.tsx` lines 41–46, `PortalSidebar.tsx` lines 148–153, `profile/page.tsx` lines 17–21
```typescript
function handleSignOut() {
    clearUser();
    disconnect();
    document.cookie = 'noesis_portal_token=; Max-Age=0; path=/';
    window.location.href = '/portal/auth';
}
```
This pattern is already in all three components. Phase 24 does not add a new sign-out location — do not replicate.

---

## No Analog Found

None. All Phase 24 files are modifications to existing files. Every pattern has a direct source in the codebase.

---

## Critical Pitfalls (from RESEARCH.md — copy here for planner)

| # | Risk | File(s) | Mitigation |
|---|------|---------|------------|
| P1 | `/api/v1/grid/state` does not exist | `portal/page.tsx` | Use `/api/v1/grid/status` for tick (confirmed server.ts line 195) |
| P2 | JWT doesn't carry region/created_at | `auth.ts` | Both `SignJWT` payload extension AND `/me` handler read must be updated together |
| P3 | Sidebar overlay renders on desktop | `PortalSidebar.tsx` | Backdrop gated by `isOpen`; `isOpen` is always `false` on desktop (hamburger never renders) |
| P4 | Profile page wagmi hooks break SSR | `profile/page.tsx` | Keep `dynamic({ ssr: false })` export — do not remove |
| P5 | fontWeight 500 in new components | All portal components | Only 400 and 600 permitted — UI-SPEC checker will fail dimension 4 |
| P6 | Route change doesn't close mobile sidebar | `PortalShell.tsx` | `useEffect(() => { setMenuOpen(false); }, [pathname])` |
| P7 | `created_at` MySQL TIMESTAMP vs ISO string | `auth.ts`, `profile/page.tsx` | JWT encodes via `.toISOString()`; frontend receives valid ISO string |

---

## Metadata

**Analog search scope:** `grid/src/`, `dashboard/src/components/portal/`, `dashboard/src/app/portal/`, `dashboard/src/lib/`
**Files read:** 11 source files
**Pattern extraction date:** 2026-05-20
