---
status: partial
phase: 25b-sanctions-and-spawn-wizard
source: [25b-VERIFICATION.md]
started: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Ban-Human + Freeze-Wallet production wiring
expected: humanSanctionStore is wired in main.ts so ban/freeze routes resolve rather than returning 503 human_sanction_store_unavailable. A mysql2/promise Pool wrapper implementing the interface must be created and injected before these sanctions are operationally usable in production.
result: [pending]

### 2. Spawn-System-Nous production wiring
expected: SpawnNousDeps injectable (wrapping launcher.spawnNous) is wired in main.ts so the spawn route resolves rather than returning 503 spawn_unavailable in production.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
