---
status: partial
phase: 28-personal-nous
source: [28-VERIFICATION.md]
started: 2026-05-23T00:00:00Z
updated: 2026-05-23T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-End Payment Confirmation (SPAWN-01)

expected: Wire `evmConfirmTx` in `grid/src/main.ts` with a real EVM RPC client, set env vars, perform a real USDT transfer on testnet. `/spawn/status/:txHash` returns `{ confirmed: true }` after tx mines; wizard POSTs to `/spawn` and receives `{ ok: true, nous_did: "did:noesis:human-nous:..." }`.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
