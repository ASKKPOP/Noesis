# Phase 24: Portal Shell — Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the portal user experience foundation before Phase 25 onboarding. The portal shell (PortalShell, PortalSidebar, PortalHeader, layout, navigation, auth pages) was built organically during Phases 22-23 and is NOT being rebuilt. Phase 24 delivers the remaining pieces: region presence display on the profile page, profile page completeness (region + wallet balance + join date), mobile responsiveness (hamburger sidebar), and portal home polish (live Grid stats, stale phase labels corrected).

Also included: Grid wallet transfer endpoint + `human.transferred` allowlist slot 45 are already resolved in commit `ca6d76b` — verify in planning but do not re-implement.

</domain>

<decisions>
## Implementation Decisions

### Region Presence

- **D-01:** Region is **read-only and auto-assigned** — on first SIWE sign-in, Grid places the human in the `'agora'` region by default. This matches ONBOARD-05 which says onboarding completion places the user in Agora. No interactive region picker in Phase 24.
- **D-02:** DB migration adds a `region VARCHAR(127) DEFAULT 'agora'` column to `human_users`. Migration runs on startup via the existing `MigrationRunner` (schema version 10).
- **D-03:** Grid must return `region` from the `GET /api/v1/portal/auth/me` endpoint (add field to JWT payload or read from DB at `/me` time). No new endpoint needed.
- **D-04:** **No `human.moved` event in Phase 24.** Allowlist stays at 45 after `human.transferred`. Region is a profile field, not an observable Grid event in this phase. A `human.moved` event is deferred to a later phase when human movement matters more.

### Profile Page Completeness

- **D-05:** Profile page at `/portal/profile` adds three new rows to the identity card:
  1. **Current Region** — value from `useHumanAuthStore().currentUser.region` (once `/me` returns it); displayed as plain text (e.g. `'agora'`).
  2. **Cyber Coin Balance** — ETH and USDT balances from wagmi `useBalance` / `useReadContract` hooks (same hooks as `WalletPanel`). Displayed as a summary row (e.g. `'0.42 ETH · 120 USDT'`); links to `/portal/wallet` for full details. No new Grid endpoint.
  3. **Member Since** — `human_users.created_at` returned by `/me` endpoint. Formatted as e.g. `'May 2026'`.
- **D-06:** Region is shown on the **profile page only**. Not added to the sidebar footer or header breadcrumb in Phase 24.
- **D-07:** The `/me` endpoint (`GET /api/v1/portal/auth/me`) must be extended to return `{ did, eth_address, region, created_at }`. Currently returns only `{ did, eth_address }`.

### Mobile Responsiveness

- **D-08:** Below 768px (`md` Tailwind breakpoint), the portal sidebar is hidden and a **hamburger button** appears in `PortalHeader`. Tapping opens the sidebar as a slide-in overlay (z-index above content, full-height, with a backdrop tap-to-close). Above 768px, sidebar is always visible (current behavior unchanged).
- **D-09:** `PortalSidebar` gains `isOpen: boolean` and `onClose: () => void` props. `PortalHeader` gains an `onMenuOpen: () => void` prop. State lives in `PortalShell`.
- **D-10:** Hamburger icon: three horizontal lines (standard). Close button (`×`) inside sidebar header area on mobile. No animation library — CSS `transform: translateX` transition only.

### Portal Home Polish

- **D-11:** Portal home (`/portal/page.tsx`) updates stale hardcoded content:
  - Header label changes from `'Grid · Phase 22'` to `'Grid · v2.5'`
  - Stats row changes to live data: **Active Nous** count from `GET /api/v1/grid/nous`, **Current Tick** from `GET /api/v1/grid/state` (if available) or `GET /api/v1/dash/health`. Fetched client-side via `fetch` with a short polling interval (10s) or on mount only — Claude's discretion.
  - Section cards updated: Wallet card changes from `'P23'` (coming) to live (no phase badge). Phase badges on Chat/My Nous/Community/Leaderboard updated to reflect current roadmap.
  - The "Coming · Phase 23" entry in Grid Updates removed; replaced with `'Phase 24 — Portal Shell: region presence, mobile layout, live Grid stats'`.
- **D-12:** The `/worldmap` and `/nous` cross-links in the sidebar CTA and section cards **stay**. Portal users who know both UIs benefit from them.
- **D-13:** NOUS_AGENTS list updated to show live status via the `GET /api/v1/grid/nous` response — if a Nous is not in the roster it shows as `'offline'` instead of hardcoded `'live'`.

### Claude's Discretion

- Polling interval for live Grid stats on portal home (10s suggested; adjust if it causes visible flicker)
- How `region` is capitalized for display (e.g. `'Agora'` vs `'agora'`) — prefer title-case in UI
- Whether to add a small "edit" link on the region row that redirects to Phase 25 onboarding (optional UX hint)
- Exact placement of the hamburger icon in `PortalHeader` (left side, right side)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.5 Requirements
- `.planning/research/v2.5-requirements.md` §PORTAL — PORTAL-01 through PORTAL-06 define the portal scope; PORTAL-05 (mobile-first) and PORTAL-06 (live feed) are the two requirements addressed in Phase 24
- `.planning/research/v2.5-requirements.md` §WALLET — WALLET-04 defines `human.transferred` (already shipped in `ca6d76b`); verify it's complete before writing wallet-related plans

### Existing Portal Code (read before writing plans)
- `dashboard/src/app/portal/layout.tsx` — PortalWagmiShell dynamic import pattern (SSR bypass)
- `dashboard/src/components/portal/PortalShell.tsx` — shell that receives `isOpen`/`onClose` props once mobile is added
- `dashboard/src/components/portal/PortalSidebar.tsx` — sidebar component to make responsive
- `dashboard/src/components/portal/PortalHeader.tsx` — header to receive hamburger button
- `dashboard/src/app/portal/profile/page.tsx` — profile page to extend with region, balance, join date
- `dashboard/src/app/portal/page.tsx` — home page to update with live stats
- `dashboard/src/components/portal/WalletPanel.tsx` — reference for wagmi balance hooks (useBalance, useReadContract) to reuse on profile

### Grid Backend (read before writing plans)
- `grid/src/api/portal/auth.ts` — `/me` endpoint to extend (add `region`, `created_at` to response)
- `grid/src/db/schema.ts` — migration array; Phase 24 migration is version 10 (adds `region` col to `human_users`)
- `grid/src/audit/broadcast-allowlist.ts` — confirm `human.transferred` is at position 45 (should be after `ca6d76b`)
- `grid/src/audit/append-human-transferred.ts` — confirm sole-producer boundary exists

### Design System
- `dashboard/src/app/globals.css` or equivalent — check for `--vellum`, `--parchment`, `--navy`, `--terracotta`, `--bronze`, `--mono-portal`, `--serif`, `--sans-portal` CSS variables used throughout portal; new components must use the same tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WalletPanel.tsx`: Contains `useBalance` and `useReadContract` hooks for ETH/USDT — copy the same hook calls for the profile balance summary row. Don't re-implement.
- `useHumanAuthStore` (Zustand store): Holds `currentUser: { did, eth_address }`. Once `/me` returns `region` and `created_at`, the store needs those fields added.
- `PortalSidebar`: Has its own auth-aware footer (wallet pill, connect CTA, sign out). The hamburger open/close state should thread through `PortalShell` as a prop rather than lifting into a Context.
- `PortalHeader`: Already renders DID chip + wallet chip + sign in/out. Adding a hamburger button is additive.

### Established Patterns
- **CSS variables, not Tailwind class tokens**: Portal components use inline style objects with `var(--navy)`, `var(--parchment)`, `var(--rule)` etc. — not `className="bg-navy"`. New components must follow this pattern.
- **`dynamic({ ssr: false })`**: Any client component using wagmi hooks (including the updated profile page) already uses `next/dynamic` with `ssr: false` — preserve this pattern.
- **`fetch` with `credentials: 'include'`**: Grid calls from the portal always include the `noesis_portal_token` cookie — see `siwe-auth.ts` for the pattern.
- **Sole-producer audit boundary**: Any new audit event (even though `human.moved` is deferred) must follow the existing pattern: sole-producer file `grid/src/audit/append-*.ts`, closed-tuple payload, `Object.keys(payload).sort()` equality check.

### Integration Points
- `grid/src/api/portal/auth.ts` line ~138: `/me` handler — add `region` and `created_at` fields to the decoded JWT payload or DB lookup
- `grid/src/db/schema.ts` end of migrations array — append migration version 10
- `dashboard/src/lib/stores/human-auth-store.ts` — add `region: string | null` and `created_at: string | null` to `HumanUser` type and store shape
- `PortalShell.tsx` — add `menuOpen: boolean` state, thread `onMenuOpen` to header, `isOpen`/`onClose` to sidebar

</code_context>

<specifics>
## Specific Ideas

- The profile page balance summary row should show ETH and USDT on one row (e.g. `'0.42 ETH · 120 USDT'`) with a `→ Wallet` link at the end — not separate rows
- Region display on profile should use title-case: `'Agora'` not `'agora'`
- Portal home live stats: show active Nous count with their names (Sophia · Hermes · Themis) and current tick number if available

</specifics>

<deferred>
## Deferred Ideas

- **`human.moved` audit event** — Interactive region picker with allowlist event deferred to a later v2.5 phase. Phase 24 uses read-only auto-assigned region only.
- **PORTAL-06 live event feed** — Full Twitter-style activity stream at `/portal` home deferred to Phase 25 or later. Phase 24 only adds live stats counts to the existing dashboard layout.
- **Bottom tab bar mobile nav** — Alternative to hamburger; considered and rejected for Phase 24 (sidebar has 18+ links, tab bar limited to 5).
- **Region in header breadcrumb or sidebar footer** — Considered; deferred to a later phase when region becomes interactive.

</deferred>

---

*Phase: 24-portal-shell*
*Context gathered: 2026-05-20*
