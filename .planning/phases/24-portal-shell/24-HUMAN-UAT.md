---
status: partial
phase: 24-portal-shell
source: [24-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Mobile sidebar overlay
expected: Open portal at <768px viewport width, tap the hamburger button. Sidebar slides in via CSS translateX (0.2s), backdrop appears, × button closes it, route navigation auto-closes it.
result: [pending]

### 2. Profile page wallet balance rows
expected: Sign in with SIWE, navigate to /portal/profile with a wallet holding ETH/USDT. Cyber Coin row shows actual wallet balances (ETH 4dp · USDT 2dp), → Wallet link in terracotta color.
result: [pending]

### 3. Portal home live Grid stats polling
expected: Load /portal with Grid running, wait 15+ seconds. Active Nous and Current Tick cards update every 15s. When Grid is down, both show '—' and 'Grid offline'.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
