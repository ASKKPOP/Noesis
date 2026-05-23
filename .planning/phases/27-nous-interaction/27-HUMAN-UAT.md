---
status: partial
phase: 27-nous-interaction
source: [27-VERIFICATION.md]
started: 2026-05-23T09:10:00Z
updated: 2026-05-23T09:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Auto-greeting fires on Nous selection; 3-dot loader visible
expected: Selecting a Nous card fires a greeting LLM call; 3-dot loading bubble appears during the call; reply appears as a Nous bubble on completion
result: [pending]

### 2. Greeting guard works on re-selection (localStorage, no duplicate greeting)
expected: Revisiting a prior conversation (same human+nous DID pair) loads localStorage history without re-firing the greeting call
result: [pending]

### 3. TipPanel wagmi flow
expected: Tip button in footer opens slide-up TipPanel with 1/5/10 USDT presets; selecting a preset fires wagmi useWriteContract; after on-chain confirmation a system message "✓ You sent N USDT to [Name]" appears inline
result: [pending]

### 4. Nous profile page: tab switching, skeleton loading, data display
expected: /portal/nous/sophia shows HeroCard with name + role + region + Ousia balance + Chat button; Skills/Lore/Norms tabs switch correctly; skeleton loaders appear before data; data rows render for each tab
result: [pending]

### 5. Unknown Nous ID error state
expected: Navigating to /portal/nous/unknown-id shows "Nous not found." error state without making any data fetches
result: [pending]

### 6. URL param ?nous=hermes pre-selects Hermes on mount
expected: Opening /portal/chat?nous=hermes pre-selects Hermes in the NousSidebar and fires the greeting for Hermes (if conversation is empty)
result: [pending]

### 7. Live status dots reflect actual Grid Nous status
expected: NousSidebar status dots show green glow for online Nous and muted dot for offline; status updates when Grid responds
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
