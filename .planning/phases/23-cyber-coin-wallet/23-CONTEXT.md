# Phase 23: Cyber Coin Wallet — Context

**Gathered:** 2026-05-20
**Status:** Backfilled (phase implemented outside GSD workflow)

<domain>
## Phase Boundary

EVM on-chain wallet display inside the `/portal/wallet` page: live ETH and USDT balances, send form with confirmation tracking, session-local transaction history, and a best-effort Grid notification that fires `human.transferred` when a send confirms.

Dashboard-only scope for the UI layer. Grid-side: add `/api/v1/portal/wallet/transfer` endpoint + `human.transferred` emitter (allowlist 44→45). The Grid endpoint was deferred to Phase 24.

</domain>

<decisions>
## Implementation Decisions

### Wallet UI
- **D-01:** `WalletPanel` component lives at `dashboard/src/components/portal/WalletPanel.tsx`; `/portal/wallet/page.tsx` is a thin wrapper
- **D-02:** Use wagmi `useBalance` for ETH balance; `useReadContract` for USDT ERC-20 (`0xdAC17F958D2ee523a2206206994597C13D831ec7`)
- **D-03:** Send form uses `useSendTransaction` (ETH) and `useWriteContract` (USDT); confirmation tracked with `useWaitForTransactionReceipt`
- **D-04:** MAX button fills the ETH send amount field with the full balance
- **D-05:** Transaction history is session-local only (no persistence); status: pending / confirmed / failed

### Grid Notification
- **D-06:** `notifyGrid()` in WalletPanel fires a best-effort `POST /api/v1/portal/wallet/transfer` after confirmation — failure is swallowed and does not block UX
- **D-07:** Grid endpoint and `human.transferred` emitter (allowlist 44→45) were **not implemented in this phase** — carried forward as a gap

### Navigation
- **D-08:** Wallet sidebar nav item activated (phase tag removed); version bumped to Phase 23

</decisions>

<canonical_refs>
## Canonical References

### Shipped Code
- `dashboard/src/components/portal/WalletPanel.tsx` — full wallet UI implementation
- `dashboard/src/app/portal/wallet/page.tsx` — wallet page (thin wrapper)
- `dashboard/src/components/portal/PortalSidebar.tsx` — sidebar with wallet nav activated

### Prior Phase Foundation
- `.planning/phases/22-web3-identity/22-CONTEXT.md` — wagmi/viem setup, SIWE auth, portal layout

### Gap to Resolve
- Grid endpoint `POST /api/v1/portal/wallet/transfer` — not yet created
- `grid/src/audit/append-human-transferred.ts` — not yet created
- Allowlist position 45 (`human.transferred`) — not yet added

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useBalance`, `useReadContract`, `useSendTransaction`, `useWriteContract`, `useWaitForTransactionReceipt` from wagmi v2 — all wired in WalletPanel
- `useHumanAuthStore` from Phase 22 — available for auth context in portal pages
- `WagmiProvider` from Phase 22 portal layout — wraps all `/portal/*` routes

### Established Patterns
- Portal pages use wagmi hooks directly — no separate service layer
- Grid notifications are best-effort fire-and-forget via fetch; never block UI flows

### Integration Points
- WalletPanel calls `/api/v1/portal/wallet/transfer` (Grid endpoint not yet implemented)
- Phase 24 must create the Grid endpoint and hook it to `appendHumanTransferred`

</code_context>

<specifics>
## Specific Notes

- USDT contract address hardcoded to mainnet `0xdAC17F958D2ee523a2206206994597C13D831ec7` — acceptable for v2.5 scope
- Transaction history resets on page reload — intentional, no persistence required for v2.5

</specifics>

<deferred>
## Deferred / Gaps

- **Grid: `POST /api/v1/portal/wallet/transfer`** — endpoint not created; Phase 24 must add this
- **Grid: `appendHumanTransferred.ts`** — sole-producer emitter not created; Phase 24 must add
- **Allowlist: position 45 (`human.transferred`)** — Phase 24 must add to `broadcast-allowlist.ts`
- **Phase 24 carries the allowlist from 44→45** rather than this phase as originally planned

</deferred>

---

*Phase: 23-cyber-coin-wallet*
*Context backfilled: 2026-05-20 (phase executed outside GSD workflow)*
