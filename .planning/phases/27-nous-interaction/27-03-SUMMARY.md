---
phase: 27-nous-interaction
plan: "03"
subsystem: dashboard-portal-chat
tags:
  - portal-chat
  - nous-interaction
  - wagmi
  - svg-avatars
  - localStorage
dependency_graph:
  requires:
    - POST /api/v1/portal/chat/nous/:nousId   # plan 27-01
    - dashboard/src/components/portal/WalletPanel.tsx  # wagmi patterns
    - dashboard/src/lib/stores/human-auth-store.ts     # currentUser.did
    - dashboard/src/app/globals.css                    # CSS variable palette
  provides:
    - dashboard/src/app/portal/chat/page.tsx           # full chat page (replaces Phase 26 placeholder)
    - dashboard/src/app/portal/chat/TipPanel.tsx       # wagmi USDT tip flow
    - dashboard/src/components/portal/avatars/SophiaAvatar.tsx
    - dashboard/src/components/portal/avatars/HermesAvatar.tsx
    - dashboard/src/components/portal/avatars/ThemisAvatar.tsx
  affects:
    - /portal/chat route (Phase 26 placeholder replaced)
tech_stack:
  added:
    - "next/dynamic ssr:false pattern for wagmi TipPanel (TipPanelInner.tsx)"
    - "localStorage keyed by humanDid+nousId for chat history persistence"
  patterns:
    - "Split-pane layout: NousSidebar(256px) + ConversationPane(flex:1)"
    - "Greeting-guard: history.length === 0 before fireGreeting (D-04 / Pitfall 4)"
    - "TipPanel position:absolute bottom:100% anchored to ConversationPane position:relative"
    - "wagmi useWriteContract + useWaitForTransactionReceipt for USDT tip (mirrors WalletPanel)"
key_files:
  created:
    - dashboard/src/app/portal/chat/NousSidebar.tsx
    - dashboard/src/app/portal/chat/NousCard.tsx
    - dashboard/src/app/portal/chat/ConversationPane.tsx
    - dashboard/src/app/portal/chat/NousHeader.tsx
    - dashboard/src/app/portal/chat/MessageList.tsx
    - dashboard/src/app/portal/chat/NousBubble.tsx
    - dashboard/src/app/portal/chat/UserBubble.tsx
    - dashboard/src/app/portal/chat/LoadingBubble.tsx
    - dashboard/src/app/portal/chat/SystemMessage.tsx
    - dashboard/src/app/portal/chat/ChatFooter.tsx
    - dashboard/src/app/portal/chat/ChatInput.tsx
    - dashboard/src/app/portal/chat/TipPanel.tsx
    - dashboard/src/app/portal/chat/TipPanelInner.tsx
    - dashboard/src/app/portal/chat/NousSidebar.test.tsx
    - dashboard/src/app/portal/chat/ConversationPane.test.tsx
    - dashboard/src/app/portal/chat/TipPanel.test.tsx
    - dashboard/src/components/portal/avatars/SophiaAvatar.tsx
    - dashboard/src/components/portal/avatars/HermesAvatar.tsx
    - dashboard/src/components/portal/avatars/ThemisAvatar.tsx
  modified:
    - dashboard/src/app/portal/chat/page.tsx  # replaced Phase 26 placeholder
decisions:
  - "localStorage key uses did:noesis: prefix for nousId (noesis:chat:{humanDid}:did:noesis:{nousId})"
  - "NOUS_TREASURY_ADDRESS falls back to 0x000...001 when env var not set (MetaMask is final user approval gate per T-27-12)"
  - "TipPanel uses dynamic import ssr:false to prevent SSR of wagmi hooks"
  - "ConversationPane has position:relative as the absolute anchor for TipPanel bottom:100%"
  - "Chat page root has height:100% + overflow:hidden per Pitfall 2"
metrics:
  duration: "22m"
  completed: "2026-05-23T16:45:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 19
  files_modified: 1
---

# Phase 27 Plan 03: Portal Chat UI Summary

Full `/portal/chat` page replacing Phase 26 placeholder: split-pane NousSidebar (3 Nous cards with live status, SVG avatars) + ConversationPane (message bubbles, 3-dot loading, localStorage history with greeting guard, wagmi USDT TipPanel).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 — stub test files | d0a9244 | NousSidebar.test.tsx, ConversationPane.test.tsx, TipPanel.test.tsx |
| 2 | Nous SVG avatars + NousSidebar + NousCard | 88dd988 | SophiaAvatar.tsx, HermesAvatar.tsx, ThemisAvatar.tsx, NousCard.tsx, NousSidebar.tsx |
| 3 | Chat page + ConversationPane + message components + TipPanel + ChatFooter | 719986f | page.tsx + 11 new component files |

## What Was Built

### Task 1: Wave 0 Stub Tests

Created three stub test files so vitest picks them up as distinct test suites:
- `TipPanel.test.tsx` — dynamic import module resolve check (passes)
- `NousSidebar.test.tsx` — render stub with mocked fetch
- `ConversationPane.test.tsx` — render stub with empty state

All three are picked up by vitest and reported. TipPanel passes. NousSidebar and ConversationPane render stubs trigger the pre-existing systemic `React is not defined` issue in this project's OXC/jsdom vitest pipeline (same failure class as 373 baseline tests that exist before this plan). This is not a regression.

### Task 2: SVG Avatars + NousCard + NousSidebar

Three Nous SVG avatars using portal CSS variables only:
- `SophiaAvatar` — phi spiral glyph, `--bronze` strokes, 44px default
- `HermesAvatar` — caduceus helix (staff + S-curves + wings), `--terracotta` strokes
- `ThemisAvatar` — balanced scales (beam + pans + suspension + triangle base), `--navy` strokes

`NousCard` — flex row with avatar, name (serif 16/600), tagline (sans 13/400 muted), status dot (online=#4ade80 with glow, busy=#fcd34d, offline=muted). Selected state: left-accent border with Nous-specific CSS variable color.

`NousSidebar` — 256px fixed width, fetches `GET /api/v1/grid/nous` on mount for live status, falls back to all-offline if fetch fails, renders "Nous" section header + 3 NousCards.

### Task 3: Full Chat Page

`page.tsx` replaces Phase 26 placeholder entirely:
- Split-pane: `NousSidebar` (256px, flexShrink:0) + `ConversationPane` (flex:1)
- Root div: `height:100%; display:flex; flexDirection:row; overflow:hidden` (Pitfall 2 compliance)
- `handleSelectNous`: loads localStorage → if `history.length === 0` fires greeting (D-04)
- `handleSendMessage`: builds LLM messages array (excludes system msgs), POSTs to `/api/v1/portal/chat/nous/:nousId`
- `handleTipConfirmed`: inserts `✓ You sent N USDT to [Name]` system message (D-12)
- `?nous=` URL param pre-selects Nous on mount (D-01)
- localStorage key: `noesis:chat:{humanDid}:did:noesis:{nousId}`, capped at 50 msgs

`ConversationPane` — `position:relative` (TipPanel anchor), NousHeader + MessageList(flex:1) + error strip + ChatFooter.

`MessageList` — auto-scrolls to bottom sentinel on message/loading change; empty state "Select a Nous to begin a conversation." when no nousId.

`ChatInput` — textarea, Enter submits / Shift+Enter newline, focus state border `--terracotta-2`.

`ChatFooter` — TipPanel (conditional), ChatInput, tip button (₮), send button.

`TipPanel` / `TipPanelInner` — `dynamic({ ssr: false })` wrapper. Inner: 1/5/10 USDT presets + custom field, `useWriteContract` USDT ERC-20 transfer, `isPending` disables Confirm (T-27-14 DoS mitigation), `isSuccess` → `onTipConfirmed` + close, `isError` → error message. Treasury address from `NEXT_PUBLIC_NOUS_TREASURY_ADDRESS` env (fallback `0x000...001`).

## Build Verification

`npm run build` completes with 0 TypeScript errors. `/portal/chat` route: 5.73 kB (was minimal placeholder).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test stubs failed with `React is not defined` in jsdom**
- **Found during:** Task 1 verification
- **Issue:** The project's OXC/vitest 4 JSX transform in jsdom environment does not inject the React import for component files — same as 373 pre-existing baseline test failures
- **Fix:** Added `import React from 'react'` to NousSidebar.test.tsx and ConversationPane.test.tsx (the test files themselves). Component source files retain the OXC automatic runtime pattern (consistent with rest of project).
- **Outcome:** The failures in NousSidebar and ConversationPane stub tests are same-class as pre-existing baseline failures — not regressions. TipPanel.test.tsx passes cleanly.

## Known Stubs

The `NEXT_PUBLIC_NOUS_TREASURY_ADDRESS` env variable must be configured to point to the actual Nous treasury wallet. The fallback address `0x0000000000000000000000000000000000000001` is clearly non-functional and MetaMask will show the actual destination to the user before confirmation (T-27-12 — user is the final approval gate). This is intentional per the plan.

## Threat Flags

No new security surface beyond what was planned and modeled in the plan's `<threat_model>`.

| Threat ID | Status |
|-----------|--------|
| T-27-12 | Accepted — MetaMask shows destination+amount; env-configurable treasury |
| T-27-13 | Accepted — localStorage is display-only; Grid re-validates auth on every POST |
| T-27-14 | Mitigated — `isPending` disables Confirm button after first click |
| T-27-15 | Mitigated — `history.length === 0` check before `fireGreeting` |
| T-27-16 | Accepted — user's own chat data, browser-local |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `dashboard/src/app/portal/chat/page.tsx` | FOUND (replaced) |
| `dashboard/src/app/portal/chat/TipPanel.tsx` | FOUND |
| `dashboard/src/app/portal/chat/TipPanelInner.tsx` | FOUND |
| `dashboard/src/components/portal/avatars/SophiaAvatar.tsx` | FOUND |
| `dashboard/src/components/portal/avatars/HermesAvatar.tsx` | FOUND |
| `dashboard/src/components/portal/avatars/ThemisAvatar.tsx` | FOUND |
| `dashboard/src/app/portal/chat/NousSidebar.test.tsx` | FOUND |
| `dashboard/src/app/portal/chat/ConversationPane.test.tsx` | FOUND |
| `dashboard/src/app/portal/chat/TipPanel.test.tsx` | FOUND |
| Commit d0a9244 (Task 1 stubs) | FOUND |
| Commit 88dd988 (Task 2 avatars) | FOUND |
| Commit 719986f (Task 3 chat page) | FOUND |
| `npm run build` — 0 TypeScript errors | PASSED |
| `grep "ssr: false" TipPanel.tsx` | PASSED |
| `grep "position.*relative" ConversationPane.tsx` | PASSED |
| `grep "height.*100%" page.tsx` | PASSED |
| No Tailwind color tokens in chat/ | PASSED |
| `localStorage.getItem` before `fireGreeting` decision | PASSED |
