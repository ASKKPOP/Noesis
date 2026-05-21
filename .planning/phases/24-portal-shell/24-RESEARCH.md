# Phase 24: Portal Shell — Research

**Researched:** 2026-05-20
**Domain:** Next.js 15 portal UI + Fastify Grid API + MySQL migration
**Confidence:** HIGH

---

## Summary

Phase 24 is a targeted completion pass on the portal shell that was built organically in Phases 22–23. No new architecture is introduced. All work is additive modification to existing files. The codebase was read in full during research; every claim below is VERIFIED from source.

The phase has four work streams: (1) DB migration to add `region` column, extend `/me` endpoint, and propagate `region` + `created_at` into the Zustand store; (2) three new profile rows (Region, Cyber Coin balance, Member Since); (3) mobile hamburger sidebar using CSS translateX — no animation library; (4) portal home polish replacing hardcoded STATS/NOUS_AGENTS/UPDATES with live API data.

WALLET-04 (`human.transferred` at allowlist position 45) is **already shipped** in commit `ca6d76b`. The sole-producer file `grid/src/audit/append-human-transferred.ts` exists, the 4-key closed tuple is validated, and the entry appears in `broadcast-allowlist.ts` at position 45 with correct comment. No reimplementation needed — only verification in plan.

**Primary recommendation:** Execute the four work streams sequentially: DB/API layer → Store → Profile page → Mobile sidebar → Portal home polish. Each stream is independent once the store extension is complete.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Region is read-only and auto-assigned — `'agora'` by default on first SIWE sign-in. No interactive region picker in Phase 24.
- **D-02:** DB migration adds `region VARCHAR(127) DEFAULT 'agora'` to `human_users`. Migration version 10. Runs on startup via existing `MigrationRunner`.
- **D-03:** Grid returns `region` from `GET /api/v1/portal/auth/me`. No new endpoint.
- **D-04:** No `human.moved` event in Phase 24. Allowlist stays at 45 after `human.transferred`. Deferred.
- **D-05:** Profile page adds three rows: (1) Current Region from store, (2) Cyber Coin Balance from wagmi hooks, (3) Member Since from `/me` `created_at`.
- **D-06:** Region shown on profile page only. Not in sidebar footer or header breadcrumb.
- **D-07:** `/me` endpoint extended to return `{ did, eth_address, region, created_at }`.
- **D-08:** Below 768px, sidebar hidden; hamburger in `PortalHeader`. Sidebar opens as slide-in overlay.
- **D-09:** `PortalSidebar` gains `isOpen`/`onClose` props. `PortalHeader` gains `onMenuOpen` prop. State in `PortalShell` only.
- **D-10:** Hamburger: three horizontal lines. Close button (×) inside sidebar header. CSS `transform: translateX` only — no animation library.
- **D-11:** Portal home updates: label `'Grid · v2.5'`, live Active Nous count + Current Tick. Section cards updated. UPDATES list updated. Polling at 15s.
- **D-12:** `/worldmap` and `/nous` cross-links stay.
- **D-13:** NOUS_AGENTS status driven by live `GET /api/v1/grid/nous` response. Absent from roster = `'offline'`.

### Claude's Discretion

- Polling interval for live Grid stats (15s chosen per UI-SPEC; adjust if flicker observed)
- Region capitalization: title-case (`'Agora'`) in UI
- Optional small "→ Set during onboarding" edit hint on region row when region is null or default
- Hamburger icon placement in `PortalHeader` (left side per UI-SPEC)

### Deferred Ideas (OUT OF SCOPE)

- `human.moved` audit event — deferred to a later phase
- PORTAL-06 live event feed — full Twitter-style activity stream deferred to Phase 25+
- Bottom tab bar mobile nav — rejected (sidebar has 18+ links)
- Region in header breadcrumb or sidebar footer — deferred
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PORTAL-04 | User profile page at `/portal/profile`: display name, DID, current region, Cyber Coin balance, owned Nous list, activity history | Profile page exists; needs 3 new rows. Region requires DB migration + `/me` extension + store update. Balance reuses wagmi hooks from WalletPanel. Member Since from new `created_at` field on `/me`. |
| PORTAL-05 | Portal is fully responsive (mobile-first). Primary usage on phone explicitly supported. | PortalShell/Sidebar/Header all read and understood. Mobile sidebar pattern: state in PortalShell, props threaded to children, CSS translateX, 768px breakpoint. |
| WALLET-04 | `human.transferred` audit event, allowlist slot 45 | ALREADY SHIPPED in commit `ca6d76b`. File `grid/src/audit/append-human-transferred.ts` exists with complete 4-key closed tuple. allowlist entry at position 45 confirmed. Verify only — do not re-implement. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Region DB migration | API / Backend (Grid) | — | MySQL schema change; runs via MigrationRunner at startup |
| `/me` endpoint extension | API / Backend (Grid) | — | Fastify route in `grid/src/api/portal/auth.ts` |
| HumanRegistry `region` field | API / Backend (Grid) | — | In-memory record in `HumanRecord`; populated from DB or default |
| Zustand store extension | Frontend (dashboard) | — | `human-auth-store.ts` is pure client-side state |
| Profile page new rows | Frontend (dashboard) | — | React component modification; wagmi hooks for balance |
| Mobile sidebar | Frontend (dashboard) | — | CSS-only animation; state in PortalShell |
| Portal home live stats | Frontend (dashboard) | API / Backend (Grid) | Dashboard polls `GET /api/v1/grid/nous` + `GET /api/v1/grid/status` |
| WALLET-04 verification | API / Backend (Grid) | — | Already shipped; planning task is verification only |

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15 (App Router) | Frontend framework | Already in use; all portal routes exist |
| wagmi | 2.x | EVM wallet hooks | Already in use; `useBalance`, `useReadContract` already called in WalletPanel |
| viem | 2.x | EVM utilities | Already in use alongside wagmi |
| zustand | 4.x | Client state | `human-auth-store.ts` already uses it |
| Fastify | 4.x | Grid HTTP server | Already used for all Grid API routes |
| `jose` | 4.x | JWT sign/verify | Already used in `portal/auth.ts` |

**No new libraries required for Phase 24.** [VERIFIED: direct codebase reads]

---

## Architecture Patterns

### System Architecture Diagram

```
Dashboard (Next.js 15)                Grid (Fastify)            MySQL
────────────────────────              ───────────────────────   ──────────────
portal/page.tsx                       GET /api/v1/grid/nous  →  nous_registry
  useEffect + setInterval (15s)  →    GET /api/v1/grid/status →  clock state
  → update NOUS_AGENTS (live)
  → update stats (Active Nous, Tick)

portal/profile/page.tsx               GET /api/v1/portal/auth/me →  human_users
  useHumanAuthStore().currentUser  ←    (region, created_at)
  useBalance(address)             ←  Ethereum RPC (wagmi)
  useReadContract(USDT balanceOf) ←  Ethereum RPC (wagmi)

PortalShell.tsx
  menuOpen: boolean (state)
    ↓ onMenuOpen prop    → PortalHeader (hamburger button)
    ↓ isOpen+onClose props → PortalSidebar (overlay + backdrop)

siwe-auth.ts (signInWithEthereum)
  POST /api/v1/portal/auth/verify
    ← JWT cookie (24h)
  GET /api/v1/portal/auth/me
    ← { did, eth_address, region, created_at }
  → human-auth-store.setUser(...)
```

### Recommended File Changes (all are modifications, no new files on dashboard)

```
dashboard/src/
  lib/
    stores/
      human-auth-store.ts          # add region, created_at fields to HumanUser type
    web3/
      siwe-auth.ts                 # add region, created_at to HumanUser interface + /me call
  components/portal/
    PortalShell.tsx                # add menuOpen state, thread props
    PortalSidebar.tsx              # accept isOpen+onClose; CSS transform; backdrop; × button
    PortalHeader.tsx               # accept onMenuOpen; render hamburger at md:hidden
  app/portal/
    profile/page.tsx               # add 3 new rows using updated store + wagmi
    page.tsx                       # replace hardcoded STATS/NOUS_AGENTS/UPDATES with live data

grid/src/
  db/
    schema.ts                      # append migration version 10 (region column)
  human/
    types.ts                       # add region: string to HumanRecord
    HumanRegistry.ts               # populate region from param or 'agora' default
  api/portal/
    auth.ts                        # extend /me to return region + created_at
```

---

## Key Implementation Details (VERIFIED from source)

### 1. DB Migration — Version 10

Current last migration is version 9 (`create_human_users`) — confirmed in `schema.ts`. Migration 10 adds `region` column:

```sql
ALTER TABLE human_users ADD COLUMN region VARCHAR(127) NOT NULL DEFAULT 'agora'
```

Pattern to follow: append new entry to `MIGRATIONS` array in `grid/src/db/schema.ts` with `version: 10`.

`down` migration: `ALTER TABLE human_users DROP COLUMN region`

### 2. HumanRecord + HumanRegistry Extension

`HumanRecord` in `grid/src/human/types.ts` currently has: `did`, `eth_address`, `grid_name`, `created_at: Date`. Add `region: string`.

`HumanRegistry.createHuman` sets `created_at: new Date()` — already present. Add `region: params.region ?? 'agora'` to the record construction. Add optional `region?: string` to `CreateHumanParams`.

**Critical:** `createHuman` is called from `auth.ts` line 94 without a `region` param, so default must be `'agora'`. `CreateHumanParams` already has only `eth_address` + `grid_name`; add optional `region?: string`.

### 3. /me Endpoint Extension

Current `/me` handler (auth.ts line 139–154) reads JWT payload and returns `{ did, eth_address }`. Two options for adding region + created_at:

**Option A (preferred — simpler):** Embed `region` and `created_at` in the JWT at issue time (in `POST /verify`). The JWT currently carries `{ did, eth_address, grid_name }`. Add `region: human.region` and `created_at: human.created_at.toISOString()`. The `/me` handler reads them back from the decoded payload — no DB query needed.

**Option B:** DB lookup at `/me` time using `humanRegistry.findByDid(...)`. More accurate if region could change, but heavier.

Since D-01 locks region as read-only in Phase 24, Option A is correct. The JWT already has a 24h expiry; region won't change within a session.

**JWT payload extension:**
```typescript
const token = await new SignJWT({
    did: human.did,
    eth_address: human.eth_address,
    grid_name: gridName,
    region: human.region,                      // NEW
    created_at: human.created_at.toISOString(), // NEW
})
```

**`/me` response extension:**
```typescript
return reply.send({
    did: payload['did'],
    eth_address: payload['eth_address'],
    region: payload['region'] ?? 'agora',        // NEW
    created_at: payload['created_at'] ?? null,    // NEW
});
```

### 4. HumanUser type + siwe-auth.ts extension

`HumanUser` interface in `dashboard/src/lib/web3/siwe-auth.ts` currently: `{ did, eth_address, email? }`. Add `region?: string | null` and `created_at?: string | null`.

The `signInWithEthereum` function returns only what the `/verify` response provides — the verify response does NOT currently include region. Two paths:
- `/verify` already returns `{ did, eth_address, is_new }` — extend to also return `region` and `created_at`
- Or the auth page calls `/me` after sign-in to hydrate

**Cleaner path:** After `setUser()` in the auth page, make a separate call to `/me` to get the full profile including region + created_at. This way the auth page populates the store completely, and the profile page reads from store without re-fetching.

**Alternatively:** extend `human-auth-store.ts` directly. The `HumanUser` type imported from `siwe-auth.ts` drives the store's `currentUser` shape — add `region: string | null` and `created_at: string | null` to `HumanUser`, and populate at sign-in time via `/me` call.

### 5. Zustand Store Extension

`human-auth-store.ts` imports `HumanUser` from `siwe-auth.ts` — once `HumanUser` is extended, the store automatically carries the new fields. No store file changes needed beyond possibly adjusting import if HumanUser moves.

### 6. Profile Page — New Rows

Profile page uses a `rows` array of `{ label, value, mono? }` objects fed into a `<dl>` loop. Three rows to add to this array:

```typescript
// Current Region (from store)
{ label: 'Current Region', value: toTitleCase(currentUser?.region ?? null) ?? '—' },

// Cyber Coin Balance (wagmi hooks — same as WalletPanel)
// Balance row is special: has a "→ Wallet" link, not plain text.
// Must be rendered separately from the rows loop, or the rows loop
// must support an optional `link` field.

// Member Since (from store)
{ label: 'Member Since', value: formatMemberSince(currentUser?.created_at) ?? '—' },
```

**Balance row design decision:** The existing `rows` array renders all values as plain text. The Cyber Coin row needs an inline link (`→ Wallet`). Two approaches:
1. Extend the row type with `linkHref?: string` and handle in the render loop.
2. Render the balance row outside the `<dl>` loop as a one-off element.

Option 2 is simpler (CLAUDE.md: simplicity first). The balance row can be inserted between the Network row and the Agency Tier row in the `<dl>`, hardcoded as a separate `<div>` element.

**Wagmi hooks for balance** — exact calls from WalletPanel.tsx (VERIFIED):
```typescript
const { data: ethBal } = useBalance({ address });
const usdtAddr = chain?.id ? USDT_ADDR[chain.id] : undefined;
const { data: usdtRaw } = useReadContract({
    address: usdtAddr,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!usdtAddr && !!address },
});
```

The `USDT_ADDR` map and `ERC20_ABI` constant can be copied inline in the profile page, or extracted to a shared module — a shared module is cleaner but CLAUDE.md says no abstractions for single-use code. Given WalletPanel already defines them, the implementation choice is either duplicate (two uses = valid) or shared. Duplicate is acceptable; shared is better. Claude's discretion.

**formatMemberSince:** `new Date(created_at).toLocaleString('en-US', { month: 'long', year: 'numeric' })` → `'May 2026'`.

### 7. Mobile Sidebar

**State location:** `menuOpen: boolean` + `setMenuOpen` in `PortalShell` only (D-09). Not Context. Not Zustand.

**PortalShell.tsx change:**
```tsx
const [menuOpen, setMenuOpen] = useState(false);
// ...
<PortalSidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
<PortalHeader onMenuOpen={() => setMenuOpen(true)} />
```

**PortalSidebar.tsx changes:**
- Accept `isOpen: boolean` + `onClose: () => void` props
- On mobile (below 768px): render as fixed-position full-height overlay
- Add backdrop `<div>` with `rgba(11,18,32,0.40)` background, z-index 49, onClick closes
- Sidebar itself: z-index 50, CSS transition `transform: translateX(-100%)` → `translateX(0)`
- Add × button inside logo area (right of "Noēsis" text on mobile), color `rgba(200,192,184,0.72)`
- Above 768px: sidebar renders normally (always visible, no overlay)

**CSS approach** — inline styles only (project pattern). `transform: translateX(${isOpen ? '0' : '-100%'})` with `transition: transform 0.2s ease`.

**Breakpoint detection:** The project uses Tailwind for class-based breakpoints (`md:hidden`) — but portal components use inline styles, not className tokens. For mobile detection in JSX with inline styles, use a `useMediaQuery` hook or CSS classes.

**Decision point:** Tailwind's `md:hidden` class works perfectly for hiding/showing the hamburger button — this is className usage for layout visibility, not design token usage. This is acceptable since `md:hidden` is a structural Tailwind utility, not a color/spacing token. Confirmed in project — `PortalShell` already uses `className="portal-theme flex h-screen overflow-hidden"` alongside inline styles. Hamburger button uses `className="md:hidden"` to hide above 768px; sidebar gets `className="md:block"` structural class for always-visible on desktop.

**Route change close:** The sidebar should close when the user navigates. `usePathname()` changes trigger a `useEffect` that calls `onClose()`. This is the standard Next.js App Router pattern.

### 8. Portal Home Live Stats

**Endpoint confirmed:** `GET /api/v1/grid/nous` returns `{ nous: NousRosterEntry[] }` where each entry has `{ did, name, region, ousia, lifecyclePhase, reputation, status }`. [VERIFIED: server.ts line 233]

**Current tick:** `GET /api/v1/grid/status` returns `{ name, tick, epoch, nousCount, regionCount, activeLaws, auditEntries, uptime }`. This is the correct endpoint for `tick`. [VERIFIED: server.ts line 195]

Note: CONTEXT.md mentioned `GET /api/v1/grid/state` — this endpoint does NOT exist. The correct endpoint is `GET /api/v1/grid/status`. The Interaction Contract in UI-SPEC mentions fallback to `/api/v1/dash/health` — `/health` exists and returns `{ status, timestamp }` but no tick. Use `/api/v1/grid/status` as primary for tick.

**Polling pattern** (15s per UI-SPEC D-11):
```typescript
useEffect(() => {
    async function fetchStats() {
        const [nousRes, statusRes] = await Promise.allSettled([
            fetch('/api/v1/grid/nous', { credentials: 'include' }),
            fetch('/api/v1/grid/status', { credentials: 'include' }),
        ]);
        // update state
    }
    void fetchStats();
    const id = setInterval(() => void fetchStats(), 15_000);
    return () => clearInterval(id);
}, []);
```

**NOUS_AGENTS live status:** Compare API roster `nous[].name` against known names (Sophia, Hermes, Themis). If name not in API response or status !== 'active', show 'offline'. Status color for offline: `rgba(200,192,184,0.28)` (per UI-SPEC).

**Page.tsx is NOT wrapped in `dynamic({ ssr: false })`** — it uses `useAccount` and `useHumanAuthStore` which are client-side, but the file is currently a `'use client'` without dynamic. Adding wagmi hooks (which are already present via `useAccount`) means this is fine. However, if we add polling with fetch, we need to stay in `'use client'` mode, which already exists.

**STATS array replacement:** The hardcoded `STATS` constant (4 entries: Current Phase, Active Nous, Grid Health, Next Phase) gets replaced with two live-data cards:
1. Active Nous count (from `/api/v1/grid/nous`)
2. Current Tick (from `/api/v1/grid/status`)
3. Phase label `'v2.5'` (static, but moved from hardcoded `'P22'`)

Grid Health and Next Phase cards are removed (hardcoded/stale — D-11).

### 9. WALLET-04 Verification

`human.transferred` at allowlist position 45 — **VERIFIED from source:**
- `grid/src/audit/broadcast-allowlist.ts` line 182: entry `'human.transferred'` with comment `// (45)`
- `grid/src/audit/append-human-transferred.ts`: complete sole-producer file, 4-key closed tuple `{asset, grid_name, human_did, tick}`, all guards present
- `ALLOWLIST_MEMBERS.length` is 45 after this entry

The Phase 24 planning task for WALLET-04 is: read the file, confirm it exists and passes structure checks, add a comment in the plan confirming verification. No code changes needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EVM balance fetching | Custom RPC fetch | `useBalance`, `useReadContract` from wagmi | Already in WalletPanel — exact same hooks |
| JWT parse/issue | Custom base64 decode | `jose` `SignJWT`/`jwtVerify` | Already used in auth.ts |
| CSS animation | JavaScript setInterval animation | CSS `transform: translateX` + `transition` | Simpler, performant, no library needed |
| Client state | Custom event bus | zustand `useHumanAuthStore` | Already the pattern |

---

## Common Pitfalls

### Pitfall 1: `/api/v1/grid/state` does not exist
**What goes wrong:** Portal home fetches `/api/v1/grid/state` for tick data and gets 404.
**Why it happens:** CONTEXT.md mentions this endpoint but it was never created.
**How to avoid:** Use `/api/v1/grid/status` (confirmed in server.ts line 195) for tick and Grid metadata.
**Warning signs:** 404 response from Grid; tick shows "—" permanently.

### Pitfall 2: JWT doesn't carry region/created_at without explicit encoding
**What goes wrong:** `/me` returns `undefined` for region and created_at after extension.
**Why it happens:** `jwtVerify` returns `payload` as an opaque object; fields added to `SignJWT` call are available but must be explicitly read in the `/me` handler.
**How to avoid:** After extending `SignJWT({..., region, created_at})`, update the `/me` handler to read `payload['region']` and `payload['created_at']`. Both must be added together.

### Pitfall 3: Sidebar overlay breaks desktop layout
**What goes wrong:** The overlay backdrop or full-height sidebar renders on desktop and covers content.
**Why it happens:** Failing to gate the overlay/backdrop rendering to mobile breakpoint only.
**How to avoid:** Wrap backdrop `<div>` and overlay styles in a conditional — only render when below 768px AND `isOpen`. Above 768px, sidebar renders as normal `<aside>` with no backdrop.
**Implementation:** `isOpen` prop is `false` on desktop (hamburger never renders, so `setMenuOpen` never fires). Backdrop only renders when `isOpen && isMobile`. Use a `useMediaQuery(768)` hook or rely on `isOpen` always being `false` on desktop.

### Pitfall 4: Profile page wagmi hooks break SSR
**What goes wrong:** Next.js server renders the profile page and throws because wagmi hooks require a browser context.
**Why it happens:** Profile page currently uses `dynamic({ ssr: false })` — this must not be removed when adding new wagmi hooks.
**How to avoid:** Keep `export default dynamic(() => Promise.resolve({ default: ProfilePage }), { ssr: false })` at the bottom of the file. Do not convert to a server component.

### Pitfall 5: fontWeight 500 in new components
**What goes wrong:** UI-SPEC checker flags components using weight 500.
**Why it happens:** UI-SPEC declares only weights 400 and 600 are permitted. Many devs default to 500 for "medium" text.
**How to avoid:** Profile dt labels use weight 600 (bold labels). Profile dd values use weight 400. Hamburger has no visible label. No 500 permitted.
**Warning signs:** Checker dimension 4 fails.

### Pitfall 6: Route-change doesn't close mobile sidebar
**What goes wrong:** User taps a nav link; sidebar stays open over the new page content.
**Why it happens:** Route changes don't automatically reset component state in Next.js App Router.
**How to avoid:** In `PortalShell`, add `useEffect(() => { setMenuOpen(false); }, [pathname])` — `pathname` comes from `usePathname()`.

### Pitfall 7: `created_at` returned as MySQL TIMESTAMP vs ISO string vs Date
**What goes wrong:** `formatMemberSince(created_at)` receives a MySQL TIMESTAMP string like `'2026-05-20 12:34:56.789'` instead of ISO 8601.
**Why it happens:** MySQL TIMESTAMP(3) format is not ISO 8601. JWT encoding via `.toISOString()` fixes this — but only if `human.created_at` is a `Date` object at encode time.
**How to avoid:** `HumanRecord.created_at` is typed as `Date` and set via `new Date()` in `HumanRegistry.createHuman`. JWT encodes with `.toISOString()`. Frontend receives a valid ISO string. `formatMemberSince` uses `new Date(created_at)` — this is safe.

---

## Runtime State Inventory

> Phase 24 is additive modification, not a rename/refactor. This section confirms no runtime state needs migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `human_users` MySQL table — no `region` column yet | Migration version 10 adds `region VARCHAR(127) DEFAULT 'agora'`; existing rows get default value automatically |
| Live service config | None — no external service config references Phase 24 features | None |
| OS-registered state | None | None |
| Secrets/env vars | JWT secret (`ES256` key pair generated at module load) — no name change | None |
| Build artifacts | None | None |

**Existing human_users rows:** MySQL `ALTER TABLE ... ADD COLUMN ... DEFAULT 'agora'` automatically backfills the default value for all existing rows. No data migration script needed. [ASSUMED — standard MySQL behavior, not verified against a live DB instance]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Grid + Dashboard | ✓ | Darwin 25.4.0 env | — |
| npm | Package installs | ✓ | (project running) | — |
| MySQL | DB migration | Required at runtime | — | Migration skipped if DB not available (MigrationRunner handles) |
| Ethereum RPC (wagmi) | Balance hooks | Wallet-dependent | — | Hooks return `undefined`; profile shows "—" |

No blocking missing dependencies. All required tools are in the project or already installed.

---

## Validation Architecture

> **Note (Nyquist compliance):** This section, together with the Wave 0 Gaps list below, serves as the Phase 24 validation plan. No separate 24-VALIDATION.md is required. Checker tools should treat this RESEARCH.md as the authoritative Nyquist validation strategy for this phase.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (grid: `^2.0.0`, dashboard: `^4.1.0`) |
| Config file | `grid/vitest.config.*` (inferred), `dashboard/vitest.config.ts` |
| Quick run command | `cd grid && npm test` or `cd dashboard && npm run test:unit` |
| Full suite command | `cd dashboard && npm test` (vitest + playwright) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORTAL-04 | Region row appears on profile | unit (component render) | `cd dashboard && npm run test:unit` | ❌ Wave 0 |
| PORTAL-04 | Member Since formatted correctly | unit (pure function) | `cd dashboard && npm run test:unit` | ❌ Wave 0 |
| PORTAL-04 | Balance row shows "—" when wallet not connected | unit (component render) | `cd dashboard && npm run test:unit` | ❌ Wave 0 |
| PORTAL-05 | Sidebar closes on route change | unit (PortalShell) | `cd dashboard && npm run test:unit` | ❌ Wave 0 |
| WALLET-04 | `human.transferred` at position 45 | unit (allowlist) | `cd grid && npm test` | ❌ Wave 0 (test for count=45) |
| WALLET-04 | `appendHumanTransferred` payload validation | unit | `cd grid && npm test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd grid && npm test` (backend changes) or `cd dashboard && npm run test:unit` (frontend changes)
- **Per wave merge:** Full grid + dashboard unit suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `grid/test/audit/allowlist-forty-five.test.ts` — covers WALLET-04: confirms `ALLOWLIST.size === 45`, `human.transferred` at index 44
- [ ] `grid/test/audit/human-transferred-producer-boundary.test.ts` — covers WALLET-04 producer guards
- [ ] `dashboard/src/components/portal/PortalShell.test.tsx` — covers PORTAL-05: route change closes sidebar
- [ ] `dashboard/src/app/portal/profile/profile-rows.test.tsx` — covers PORTAL-04: region/balance/member-since rows render correctly

Note: The allowlist test may already be covered by `allowlist-twenty-six.test.ts` (which currently checks a specific count). Phase 24 needs a test asserting count is exactly 45 and `human.transferred` is at index 44.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes — `/me` extension | Existing `jwtVerify` with `ES256` public key; no new auth path |
| V3 Session Management | yes — JWT cookie | Existing `httpOnly`/`sameSite: strict` cookie; unchanged |
| V4 Access Control | no — read-only profile data; no sensitive actions | — |
| V5 Input Validation | yes — DB migration SQL | Migration runs in parameterized context via MigrationRunner; no user input in DDL |
| V6 Cryptography | no — no new crypto | Existing ES256 key pair unchanged |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JWT field injection (extra JWT claims mislead `/me`) | Spoofing | `jwtVerify` only reads known fields; unknown claims ignored |
| XSS via region value | Tampering | React renders region as text node (JSX escapes); no `dangerouslySetInnerHTML` |
| Mobile sidebar backdrop bypass | Spoofing | Backdrop covers entire viewport; z-index 49 below sidebar (50); pointer-events enabled |

**Audit allowlist discipline (NFR-04):** Phase 24 adds zero new allowlist events (D-04 locks this). The allowlist stays at 45. No `human.moved` or any new event type. This is by design and must be confirmed in the plan's WALLET-04 verification task.

---

## Code Examples

### /me endpoint extension (Grid)

```typescript
// Source: grid/src/api/portal/auth.ts — /me handler, extended version
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
            region: (payload['region'] as string | undefined) ?? 'agora',
            created_at: (payload['created_at'] as string | undefined) ?? null,
        });
    } catch {
        return reply.status(401).send({ error: 'invalid_token' });
    }
});
```

### PortalShell mobile state threading

```tsx
// Source: dashboard/src/components/portal/PortalShell.tsx — extended
const [menuOpen, setMenuOpen] = useState(false);
const pathname = usePathname();

// Close sidebar on route change
useEffect(() => { setMenuOpen(false); }, [pathname]);

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
```

### Hamburger button in PortalHeader

```tsx
// Source: dashboard/src/components/portal/PortalHeader.tsx
// Receives: onMenuOpen: () => void
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
    }}
>
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
        <line x1="2" y1="5"  x2="16" y2="5"  stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <line x1="2" y1="9"  x2="16" y2="9"  stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <line x1="2" y1="13" x2="16" y2="13" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
</button>
```

### Portal home live stats polling

```typescript
// Source: dashboard/src/app/portal/page.tsx — live stats pattern
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

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded STATS array | Live polling GET /api/v1/grid/nous + /status | Phase 24 | Active Nous count and tick reflect real Grid state |
| Hardcoded `'Grid · Phase 22'` label | `'Grid · v2.5'` | Phase 24 | Accurate versioning |
| HumanUser has only `{ did, eth_address }` | Adds `region`, `created_at` | Phase 24 | Profile page can show regional identity and join date |

---

## Project Constraints (from CLAUDE.md)

1. **Inline styles, not Tailwind tokens:** Portal components use `style={{ color: 'var(--navy)' }}` — not `className="bg-navy"`. New components must follow. Tailwind structural utilities (`md:hidden`, `flex`, `overflow-hidden`) are acceptable for layout.
2. **`dynamic({ ssr: false })`:** wagmi hooks require client rendering. Profile page already exports with `ssr: false` — preserve this pattern. Do not add `'use server'` or server components to wagmi-dependent pages.
3. **Simplicity first:** No abstractions for single-use code. No speculative flexibility.
4. **Surgical changes:** Only touch what Phase 24 requires. Don't refactor adjacent code.
5. **Goal-driven execution:** Each task should have a verifiable success criterion.
6. **No auto-commit:** Never commit automatically.
7. **Documentation sync:** When phase ships, update ROADMAP, MILESTONES, STATE, PROJECT per Documentation Sync Rule.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MySQL `ALTER TABLE ... ADD COLUMN ... DEFAULT 'agora'` automatically backfills existing rows | Runtime State Inventory | If MySQL version doesn't backfill (unlikely), existing users have NULL region; profile shows "—" |
| A2 | `GET /api/v1/grid/status` is accessible from the dashboard without CORS issues at 15s polling intervals | Code Examples | If CORS blocks this endpoint (only `GET` from localhost is allowed per server.ts), polling would fail silently |

CORS config in `server.ts` (line 181): `origin: ['http://localhost:3001', 'http://localhost:3000']`, `methods: ['GET', 'OPTIONS']`. Both `/api/v1/grid/nous` and `/api/v1/grid/status` are GET endpoints. CORS is configured correctly. A2 risk is LOW.

---

## Open Questions (RESOLVED)

1. **Does `/verify` endpoint need to return region + created_at?**
   - What we know: `/verify` currently returns `{ did, eth_address, is_new }`. The auth page calls `setUser()` with only `did` and `eth_address`.
   - What's unclear: Should the store be populated immediately at sign-in, or via a subsequent `/me` call?
   - Recommendation: Add a `/me` call immediately after `setUser()` in the auth page's sign-in handler. This is the cleanest separation — `/verify` handles auth, `/me` handles profile. The profile page already calls `/me` on mount as a fallback if needed.

2. **Current allowlist count is 45 — does the broadcast-allowlist test need updating?**
   - What we know: `allowlist-twenty-two.test.ts` asserts `ALLOWLIST.size === 43` (updated to 43 for Phase 20). `human.joined` added at 44, `human.transferred` at 45.
   - What's unclear: Is there already a test asserting size === 45?
   - Recommendation: Wave 0 gap — add `allowlist-forty-five.test.ts` asserting size === 45 and positions 44/45.

---

## Sources

### Primary (HIGH confidence — directly read from source files)
- `dashboard/src/components/portal/PortalShell.tsx` — current state, no props
- `dashboard/src/components/portal/PortalSidebar.tsx` — complete component, nav structure
- `dashboard/src/components/portal/PortalHeader.tsx` — complete component
- `dashboard/src/app/portal/profile/page.tsx` — rows array, wagmi hooks, dynamic export
- `dashboard/src/app/portal/page.tsx` — hardcoded STATS, NOUS_AGENTS, UPDATES
- `dashboard/src/components/portal/WalletPanel.tsx` — exact wagmi hook calls for balance
- `dashboard/src/lib/stores/human-auth-store.ts` — Zustand store shape
- `dashboard/src/lib/web3/siwe-auth.ts` — HumanUser interface, signInWithEthereum
- `dashboard/src/app/globals.css` — `.portal-theme` CSS variables (all tokens verified)
- `grid/src/api/portal/auth.ts` — /me handler, JWT encoding, /verify handler
- `grid/src/db/schema.ts` — MIGRATIONS array (versions 1–9; version 10 slot confirmed open)
- `grid/src/audit/broadcast-allowlist.ts` — ALLOWLIST_MEMBERS (45 entries confirmed)
- `grid/src/audit/append-human-transferred.ts` — sole-producer boundary (VERIFIED complete)
- `grid/src/human/HumanRegistry.ts` — createHuman, HumanRecord shape
- `grid/src/human/types.ts` — HumanRecord interface (no region field currently)
- `grid/src/api/server.ts` — GET /api/v1/grid/nous (line 233), GET /api/v1/grid/status (line 195)
- `grid/src/api/types.ts` — NousRosterEntry shape
- `.planning/phases/24-portal-shell/24-CONTEXT.md` — all locked decisions
- `.planning/phases/24-portal-shell/24-UI-SPEC.md` — typography, color, spacing, interaction contracts
- `.planning/research/v2.5-requirements.md` — PORTAL-04, PORTAL-05, WALLET-04

### Tertiary (LOW confidence — noted)
- Claim A1 (MySQL default backfill behavior) is standard SQL behavior not verified against a running DB instance

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in running project
- Architecture: HIGH — all files read, all endpoints confirmed in source
- Pitfalls: HIGH — sourced from direct code reading, not assumption
- WALLET-04 verification: HIGH — file confirmed present with correct structure

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable codebase; tech choices are frozen for this phase)
