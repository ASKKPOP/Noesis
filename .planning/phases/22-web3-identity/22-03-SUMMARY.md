---
phase: 22-web3-identity
plan: "03"
subsystem: dashboard
tags: [wagmi, web3, wallet, portal, react-query]
dependency_graph:
  requires: []
  provides: [wagmi-config, portal-layout, portal-page, connect-wallet-button]
  affects: [22-04-PLAN.md]
tech_stack:
  added: [wagmi@^2.0.0, viem@^2.0.0, "@wagmi/connectors@^5.0.0", "@tanstack/react-query@^5.0.0"]
  patterns: [wagmi-v2-provider, tanstack-query-client, wagmi-hooks]
key_files:
  created:
    - dashboard/src/lib/web3/wagmi-config.ts
    - dashboard/src/app/portal/layout.tsx
    - dashboard/src/app/portal/page.tsx
    - dashboard/src/components/portal/ConnectWalletButton.tsx
  modified:
    - dashboard/package.json
    - package-lock.json
decisions:
  - "wagmiConfig created at module scope with injected + walletConnect connectors on mainnet + sepolia"
  - "QueryClient instantiated at module scope (not per-render) per threat model T-22-03-03 to avoid DoS"
  - "Portal layout marked 'use client' to enable wagmi hooks in RSC tree; portal page is server component"
  - "ConnectWalletButton uses injected() connector for the default connect path (MetaMask)"
metrics:
  duration: "146s"
  completed: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 22 Plan 03: wagmi Config, Portal Layout, and ConnectWalletButton Summary

wagmi v2 dependencies installed and portal route namespace created with WagmiProvider layout, ConnectWalletButton, and portal home page.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add wagmi dependencies to dashboard/package.json | f8b4c22 | dashboard/package.json, package-lock.json |
| 2 | Create wagmi config, portal layout, portal home page, and ConnectWalletButton | c48ce97 | 4 new files in src/lib/web3/, src/app/portal/, src/components/portal/ |

## What Was Built

**wagmi v2 dependency installation** — Added `wagmi@^2.0.0`, `viem@^2.0.0`, `@wagmi/connectors@^5.0.0`, and `@tanstack/react-query@^5.0.0` to `dashboard/package.json` dependencies. Ran `npm install` (449 packages added).

**wagmiConfig** (`dashboard/src/lib/web3/wagmi-config.ts`) — Creates wagmi v2 config with MetaMask (injected) and WalletConnect v2 connectors on mainnet and sepolia chains. WalletConnect project ID read from `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` env var (intentionally public, not a secret).

**Portal layout** (`dashboard/src/app/portal/layout.tsx`) — Next.js App Router nested segment layout for all `/portal/*` routes. Wraps children in `WagmiProvider` + `QueryClientProvider`. Does not include `<html>`/`<body>` — those remain in the root layout. `QueryClient` instantiated at module scope (not per-render) to avoid recreation on mount.

**Portal home page** (`dashboard/src/app/portal/page.tsx`) — Entry point for human users at `/portal`. Renders centered `ConnectWalletButton` with Noesis Portal heading. Server component (no `'use client'`).

**ConnectWalletButton** (`dashboard/src/components/portal/ConnectWalletButton.tsx`) — Client component using `useAccount`, `useConnect`, `useDisconnect` from wagmi v2. Shows truncated address + Disconnect button when connected; shows Connect Wallet button (triggering injected connector) when disconnected. Disabled state during pending connection.

## Verification

```
npx tsc --noEmit  →  exit 0 (no output)
ls dashboard/src/app/portal/  →  layout.tsx  page.tsx
ls dashboard/src/components/portal/  →  ConnectWalletButton.tsx
grep WagmiProvider dashboard/src/app/portal/layout.tsx  →  match
grep wagmi dashboard/package.json  →  match
```

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new security surface beyond what the plan's threat model covers:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — intentionally public (T-22-03-02, accepted)
- `QueryClient` at module scope — prevents DoS from per-mount recreation (T-22-03-03, accepted)
- ConnectWalletButton address display reflects wagmi `useAccount` — cannot be spoofed independently of wallet (T-22-03-01, accepted)

## Known Stubs

`portal/page.tsx` shows `ConnectWalletButton` unconditionally. Auth redirect logic (redirect to `/portal/auth` if not signed in, redirect to feed if signed in) is deferred to Plan 22-04 which implements the full SIWE sign-in flow.

## Self-Check: PASSED

- `dashboard/src/lib/web3/wagmi-config.ts` — FOUND
- `dashboard/src/app/portal/layout.tsx` — FOUND
- `dashboard/src/app/portal/page.tsx` — FOUND
- `dashboard/src/components/portal/ConnectWalletButton.tsx` — FOUND
- Commit f8b4c22 (Task 1) — FOUND
- Commit c48ce97 (Task 2) — FOUND
