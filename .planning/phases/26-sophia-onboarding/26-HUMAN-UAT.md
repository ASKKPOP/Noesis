---
status: partial
phase: 26-sophia-onboarding
source: [26-VERIFICATION.md]
started: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Current Test

[awaiting human testing — deferred from phase execution]

## Tests

### 1. Flow A — New User Onboarding
expected: /portal redirects to /portal/auth (unauthenticated); after sign-in with new account, redirected to /portal/onboard; Step 1 renders correctly; Step 2 Sophia chat works; Step 3 district tour works; post-wizard redirect to /portal
result: [pending]

### 2. Flow A — Step 1 visual
expected: CyberGrid visible full-screen, no HUD, dark veil, step dots, "Begin →" button visible immediately
result: [pending]

### 3. Flow A — Step 2 Sophia chat
expected: Sophia header, loading dots on mount, opening message renders, multi-turn chat works, continue gate appears after detectClose + 2 user messages
result: [pending]

### 4. Flow A — Step 3 World Tour
expected: District headings update on next/prev, building highlights cycle correctly, "Enter the World →" appears on last district, completes wizard
result: [pending]

### 5. Flow B — Returning User Bypass
expected: /portal/onboard with already-onboarded session redirects immediately to /portal
result: [pending]

### 6. Flow C — Database
expected: `onboarding_goal` column present and populated after wizard completion
result: [pending]

### 7. Flow D — GET /me
expected: Returns `onboarded: true` after wizard completion
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
