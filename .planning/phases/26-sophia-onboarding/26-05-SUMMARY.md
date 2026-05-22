---
phase: 26-sophia-onboarding
plan: 05
subsystem: ui
tags: [react, nextjs, wizard, onboarding, sophia, chat, typescript]
dependency_graph:
  requires: [26-02, 26-03, 26-04]
  provides: [portal-onboard-wizard, step-welcome, step-sophia-chat, step-world-tour]
  affects:
    - dashboard/src/app/portal/onboard/page.tsx
    - dashboard/src/app/portal/onboard/WizardStepIndicator.tsx
    - dashboard/src/app/portal/onboard/StepWelcome.tsx
    - dashboard/src/app/portal/onboard/StepSophiaChat.tsx
    - dashboard/src/app/portal/onboard/StepWorldTour.tsx
    - dashboard/src/app/portal/onboard/SophiaBubble.tsx
    - dashboard/src/app/portal/onboard/UserBubble.tsx
    - dashboard/src/app/portal/onboard/ChatInput.tsx
    - dashboard/src/app/portal/onboard/ContinueButton.tsx
tech_stack:
  added: []
  patterns:
    - "dynamic({ ssr: false }) double-wrapper pattern for wagmi-safe client pages"
    - "Three-layer z-index stack: CyberGrid canvas (z:0) → dark veil (z:1) → wizard content (z:2)"
    - "Ref-sync pattern for stale closure avoidance in async sendMessages"
    - "inline <style> for portal-pulse @keyframes (avoids globals.css dependency)"
    - "sentInitialRef guard for StrictMode double-invocation of opening Sophia message"
key_files:
  created:
    - dashboard/src/app/portal/onboard/page.tsx
    - dashboard/src/app/portal/onboard/WizardStepIndicator.tsx
    - dashboard/src/app/portal/onboard/StepWelcome.tsx
    - dashboard/src/app/portal/onboard/StepSophiaChat.tsx
    - dashboard/src/app/portal/onboard/StepWorldTour.tsx
    - dashboard/src/app/portal/onboard/SophiaBubble.tsx
    - dashboard/src/app/portal/onboard/UserBubble.tsx
    - dashboard/src/app/portal/onboard/ChatInput.tsx
    - dashboard/src/app/portal/onboard/ContinueButton.tsx
  modified: []
decisions:
  - "portal-pulse @keyframes injected inline via <style> tag in StepSophiaChat rather than globals.css — avoids cross-file coupling, keeps the animation local to the component that owns it"
  - "messagesRef and userMessageCountRef refs added alongside state to avoid stale closures in sendMessages async callback — state updates are batched, refs are always current"
  - "sentInitialRef guard in StepSophiaChat.useEffect prevents React StrictMode from double-firing the opening Sophia message fetch"
  - "NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080' used in both page.tsx and StepSophiaChat.tsx — same pattern as auth/page.tsx"
  - "DistrictId type defined locally in both page.tsx and StepWorldTour.tsx (not imported from CyberGrid) — avoids coupling to internal CyberGrid types; values are constrained to valid DistrictId values that CyberGrid accepts"
metrics:
  duration: 8m
  completed: 2026-05-22T15:36:00Z
  tasks: 2
  files_modified: 9
---

# Phase 26 Plan 05: Sophia Onboarding Wizard — Complete UI Implementation Summary

All 9 onboarding wizard components created at dashboard/src/app/portal/onboard/ — full 3-step wizard using CyberGrid background, UI-SPEC tokens, and Sophia LLM chat via POST /chat/onboard endpoint from plan 04.

## What Was Built

### dashboard/src/app/portal/onboard/page.tsx (new)

Wizard state machine. Exports `PortalOnboardPage` wrapped in `dynamic({ ssr: false })` double-wrapper (exact pattern from auth/page.tsx). State: `step: 1 | 2 | 3`, `currentDistrict: DistrictId | null`.

- Three-layer layout: CyberGrid bg (z:0, fixed, pointerEvents:none) → dark veil (z:1, opacity switches between step 2 and step 3 values per UI-SPEC) → wizard content column (z:2, maxWidth:520)
- Already-onboarded guard: `useEffect` watches `currentUser.onboarded`, calls `router.replace('/portal')`
- `handleSophiaDone`: PATCHes `/api/v1/portal/auth/me` with `onboarding_goal` (non-blocking, errors suppressed per D-08), then sets step 3
- `handleWizardComplete`: updates store `onboarded:true` to prevent redirect guard re-firing, then `router.push('/portal')`
- `DISTRICT_ORDER` constant passed down to StepWorldTour; `onDistrictChange` callback feeds `currentDistrict` state which flows into CyberGrid `highlightDistrict` prop

### dashboard/src/app/portal/onboard/WizardStepIndicator.tsx (new)

3-dot step indicator with connector lines. Active dot: `#da7a4e` + `0 0 8px #da7a4e` shadow. Inactive: `rgba(218,122,78,0.25)`. Connector: 24px × 1px `rgba(218,122,78,0.25)`. Margin-bottom: 16px. Matches UI-SPEC exactly.

### dashboard/src/app/portal/onboard/StepWelcome.tsx (new)

Step 1 narration card. UI-SPEC locked copy: heading "Welcome to the Genesis Grid", body 3 sentences. Noēsis logotype at 42px serif. "Begin →" button visible immediately (no gate). Glass card styles from UI-SPEC.

### dashboard/src/app/portal/onboard/StepSophiaChat.tsx (new)

Multi-turn chat UI — the most complex component.

- Sophia's opening message fetched on mount via `useEffect` + `sentInitialRef` guard (prevents StrictMode double-fire)
- State: `messages`, `loading`, `inputValue`, `userMessageCount`, `showContinue`, `error`
- Refs: `messagesRef` and `userMessageCountRef` prevent stale closures in the async `sendMessages` callback
- `detectClose()` logic matches backend exactly (4 phrases)
- Continue gate: `showContinue` set when `(data.done || detectClose(reply)) && userCount >= 2`, OR when `userCount >= 3` (max exchanges hard-cap per T-26-14)
- 3-dot `portal-pulse` loading indicator with staggered 0.4s animation offsets; injected via inline `<style>` tag
- Error state: `rgba(184,50,50,0.10)` background, mono 11px, `#f87171` text
- Chat list: `maxHeight: 320px`, `overflowY: auto`, auto-scrolls via `chatEndRef` after each message
- `handleContinue`: extracts last user message from `messagesRef.current` and passes to `onDone`

### dashboard/src/app/portal/onboard/StepWorldTour.tsx (new)

5-district cycling. `DISTRICT_INFO` record with heading + narration for all 5 districts (AI_CORE, HUB, DATA, DARKWEB, RESIDENTIAL). District progress dots (5 dots). Navigation: ghost "← Previous" (hidden on first) + ghost "Next District →" or primary "Enter the World →" on last. `onDistrictChange` callback called in `useEffect` when `index` changes.

### dashboard/src/app/portal/onboard/SophiaBubble.tsx (new)

Left-aligned Sophia message bubble. 20×20 amber circle avatar with Σ in mono 11px. Bubble: serif 16px, `rgba(218,122,78,0.08)` bg, `4px 12px 12px 12px` border-radius.

### dashboard/src/app/portal/onboard/UserBubble.tsx (new)

Right-aligned user message bubble. `rgba(255,255,255,0.06)` bg, `12px 4px 12px 12px` border-radius, sans-portal 16px.

### dashboard/src/app/portal/onboard/ChatInput.tsx (new)

Textarea + Send Reply button column. Enter key (without Shift) submits. Focus border color switches to `rgba(218,122,78,0.50)`. Disabled (opacity 0.5) while loading or `showContinue === true`. Rule line `rgba(255,255,255,0.08)` separator above.

### dashboard/src/app/portal/onboard/ContinueButton.tsx (new)

Universal step progression button. Props: `label`, `onClick`, `disabled`, `visible`. When `visible=false`: `opacity:0`, `pointerEvents:none` (occupies space, avoids layout shift). 200ms opacity transition for step 2 fade-in.

## Task Commits

1. **Task 1: Wizard shell + StepWelcome + shared components** — `e3e9629`
   - page.tsx, WizardStepIndicator.tsx, StepWelcome.tsx, ContinueButton.tsx, SophiaBubble.tsx, UserBubble.tsx

2. **Task 2: StepSophiaChat + StepWorldTour + ChatInput** — `765f03e`
   - StepSophiaChat.tsx, StepWorldTour.tsx, ChatInput.tsx

## Deviations from Plan

### Auto-added: Ref-sync pattern for stale closures in StepSophiaChat

**Found during:** Task 2 implementation
**Issue:** `sendMessages` is an async function called from both the initial `useEffect` and `handleSend`. Without refs, the closures over `messages` and `userMessageCount` would capture stale state values from the render they were created in, causing incorrect `showContinue` gate logic (e.g., a message appended to a stale `messages` array would drop prior messages from the UI).
**Fix:** Added `messagesRef` and `userMessageCountRef` that mirror their state counterparts. `sendMessages` signature changed to accept `currentMessages` and `currentUserCount` as explicit arguments (eliminates closure dependency entirely). Refs updated at every mutation point.
**Files modified:** dashboard/src/app/portal/onboard/StepSophiaChat.tsx
**Rule:** Rule 2 (missing correctness requirement — incorrect multi-turn conversation behavior)

### Auto-added: sentInitialRef StrictMode guard in StepSophiaChat

**Found during:** Task 2 implementation
**Issue:** React StrictMode double-invokes effects in development, causing two opening Sophia messages to be fetched. This doubles API calls and shows duplicate bubbles on first render.
**Fix:** `sentInitialRef` boolean ref initialized to `false`, set to `true` on first effect invocation. Second invocation is a no-op.
**Files modified:** dashboard/src/app/portal/onboard/StepSophiaChat.tsx
**Rule:** Rule 2 (missing correctness requirement — duplicate API calls in dev)

### Decision: portal-pulse keyframe injected inline

The plan noted "Add `@keyframes portal-pulse` to the portal globals CSS if not already present, or use an inline `<style>` tag." The inline approach was chosen — it keeps the animation co-located with the component that owns it, avoids touching globals.css, and requires no coordination with other plan waves.

### Decision: DistrictId type defined locally (not imported from CyberGrid)

CyberGrid.tsx exports no `DistrictId` type publicly (it's internal to that file). Defining it locally in `page.tsx` and `StepWorldTour.tsx` as the 5-district subset that the wizard uses is correct — the values passed as `highlightDistrict` are valid members of CyberGrid's internal union type.

## NEXT_PUBLIC_GRID_ORIGIN Pattern

Both `page.tsx` and `StepSophiaChat.tsx` use:
```typescript
const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
```
Identical to the pattern established in auth/page.tsx. No `.env.local` modification required — default localhost:8080 serves development.

## TypeScript Issues Encountered

None. `npx tsc --noEmit` produces zero output (clean) after both task commits.

## Known Stubs

None — all 9 components are fully wired:
- `page.tsx` imports and renders all child components
- `StepSophiaChat` calls real `POST /api/v1/portal/chat/onboard` (from plan 04)
- `handleSophiaDone` calls real `PATCH /api/v1/portal/auth/me` (from plan 01/02)
- `StepWorldTour` passes real `highlightDistrict` values to CyberGrid (from plan 03)
- CyberGrid `highlightDistrict` and `hideHud` props from plan 03 are fully functional

## Threat Model Coverage

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-26-13: Prompt injection via user messages | User messages passed as role:'user' only; system prompt is server-side | Implemented — frontend sends messages array, backend prepends system prompt |
| T-26-14: Unonboarded user looping forever | Max 3 exchanges hard-cap: `userCount >= 3` forces `showContinue=true` | Implemented |
| T-26-15: Already-onboarded user visiting /portal/onboard | `useEffect` guard: `currentUser.onboarded === true` → `router.replace('/portal')` | Implemented |

## Threat Flags

None. No new network endpoints. No new DOM injection surfaces. All user input goes through React state (no `dangerouslySetInnerHTML`).

## Self-Check: PASSED

Files created (all confirmed present):
- dashboard/src/app/portal/onboard/page.tsx — FOUND
- dashboard/src/app/portal/onboard/WizardStepIndicator.tsx — FOUND
- dashboard/src/app/portal/onboard/StepWelcome.tsx — FOUND
- dashboard/src/app/portal/onboard/StepSophiaChat.tsx — FOUND
- dashboard/src/app/portal/onboard/StepWorldTour.tsx — FOUND
- dashboard/src/app/portal/onboard/SophiaBubble.tsx — FOUND
- dashboard/src/app/portal/onboard/UserBubble.tsx — FOUND
- dashboard/src/app/portal/onboard/ChatInput.tsx — FOUND
- dashboard/src/app/portal/onboard/ContinueButton.tsx — FOUND

Commits:
- e3e9629 (Task 1: wizard shell + shared components) — FOUND
- 765f03e (Task 2: StepSophiaChat + StepWorldTour + ChatInput) — FOUND

TypeScript: `npx tsc --noEmit` → zero output (CLEAN)

---
*Phase: 26-sophia-onboarding*
*Completed: 2026-05-22*
