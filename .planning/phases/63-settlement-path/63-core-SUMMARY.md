---
phase: 63-settlement-path
plan: core
subsystem: economy / on-chain settlement
tags: [onchain, settlement, LaborEscrow, oracle, relayer, ethers, anvil, zero-custody]
requires: [62.5 in-DB civic ledger, 62 contracts (LaborEscrow/CivicTreasury) + Foundry suite]
provides: [grid/src/onchain OnchainSettlement client, oracle-attest + relayer-finalize path, anvil integration test]
affects: [grid/src/onchain, .env.example]
decisions: [D-63-1 oracle-key model, D-63-2 Grid relayer submission, D-63-3 local-anvil-first + off-by-default flag]
metrics:
  duration: ~35m
  completed: 2026-07-11
key-files:
  created:
    - grid/src/onchain/config.ts
    - grid/src/onchain/settlement.ts
    - grid/test/onchain/settlement.anvil.test.ts
  modified:
    - .env.example
commits:
  - 62aa37bc feat(63) module
  - 059abb9e test(63) anvil integration
  - 1a7e6eef docs(63) env vars
---

# Phase 63 Core: On-chain settlement (LaborEscrow oracle attestation via a Grid relayer) Summary

Bridges an in-Grid completed job to the on-chain `LaborEscrow` contract: the Grid oracle-signs
`completionDigest(jobId)` and the Grid relayer submits `attestCompletion` → dispute window →
`finalize` pays the worker (amount − fee) with the fee routed to `CivicTreasury`. Built in ethers
v6, off by default behind `GRID_ONCHAIN_SETTLEMENT_ENABLED`, proven against a local anvil node.
Zero-custody: the Grid holds only its oracle + relayer keys, never user funds.

## What shipped

**Task 1 — `grid/src/onchain/` module.**
- `config.ts`: `loadOnchainSettlementConfig(env)` — returns `null` unless
  `GRID_ONCHAIN_SETTLEMENT_ENABLED === 'true'`; when enabled reads `GRID_ONCHAIN_RPC_URL`,
  `GRID_LABOR_ESCROW_ADDRESS`, `GRID_CIVIC_TREASURY_ADDRESS`, `GRID_RELAYER_KEY`,
  `GRID_ORACLE_KEY`, throwing `OnchainSettlementConfigError` if the flag is on but a var is
  missing (a live misconfiguration is loud; the intentional off state is silent). Mirrors the
  `account-endowment.ts` disabled-path pattern.
- `settlement.ts`: `OnchainSettlement` (+ `fromEnv()` factory). `attestJobCompletion(jobId)`
  computes `inner = keccak256(AbiCoder.encode(['uint256','address','uint256'],[chainId, escrow,
  jobId]))`, `oracleWallet.signMessage(getBytes(inner))` (EIP-191 personal_sign == the contract's
  `toEthSignedMessageHash`), and relayer-submits `attestCompletion`. `finalizeJob(jobId)` relayer-
  submits `finalize`. `getJob(jobId)` reads state/worker/amount for assertions/observability. When
  the flag is off, every method throws `onchain_settlement_disabled` with no side effects (no
  provider, wallet, or tx constructed).

**Task 2 — `grid/test/onchain/settlement.anvil.test.ts`.** Probes the RPC at collection and
`describe.skipIf(!anvilUp)` (skips cleanly with no node — verified against a dead port). Deploys
`CivicTreasury` then `LaborEscrow(oracle, arbiter, treasury, 200, disputeWindow=2s)` to anvil via
ethers `ContractFactory` (abi + bytecode from `contracts/out/*.json`). Happy path: payer (acct3)
`fundJob{value:1 ether}` → `attestJobCompletion` → `evm_increaseTime`+`evm_mine` → `finalizeJob` →
asserts worker `+= amount − fee` (0.98 ETH), treasury `+= fee` (0.02 ETH), state `Released`. Also
asserts the disabled path throws `onchain_settlement_disabled` and sends no tx.

**Task 3 — docs.** `.env.example` documents the five vars + the flag, noting off-by-default,
local-anvil-first, and zero-custody.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ethers/anvil nonce race on sequential relayer submits.**
- **Found during:** Task 2. Back-to-back deploys and the rapid attest→finalize relayer submits hit
  `NONCE_EXPIRED` — ethers re-queried a lagging `pending` nonce between two awaited txns on a
  persistent anvil node.
- **Fix:** wrapped the relayer in ethers `NonceManager` (reads the nonce once, increments locally —
  the idiomatic pattern for a sequential-submitting relayer); the test deploys from a distinct
  account (acct9) so the relayer's (acct0) nonce is never contended by deployment.
- **Files:** `grid/src/onchain/settlement.ts`, `grid/test/onchain/settlement.anvil.test.ts`.
- **Commits:** 62aa37bc, 059abb9e.

**2. [Rule 3 - Blocking] stale-latest balance read after a same-process mine.**
- **Found during:** Task 2. `provider.getBalance(addr)` returned a cached pre-finalize balance
  (delta 0) via ethers' typed perform-cache.
- **Fix:** read balances through the raw `eth_getBalance` RPC (`provider.send`), which bypasses the
  cache and returns a fresh `latest`.
- **Files:** `grid/test/onchain/settlement.anvil.test.ts`.
- **Commit:** 059abb9e.

## Verification

- `cd grid && npx tsc --noEmit` — clean.
- `npx vitest run test/onchain/settlement.anvil.test.ts` — 2 passed (worker paid amount−fee,
  treasury got fee, disabled-path throws); deterministic across 3 consecutive runs. Skips cleanly
  when the RPC is unreachable (verified with a dead port → 2 skipped).
- `node scripts/check-ledger-b-money.mjs` — pass (no `transferWei` / Ledger-B `.balance_wei` writes).
- Zero-custody CI ban — pass: `grid/src/onchain` has no `transferFrom` / allowance / user-fund
  movement (only the module doc-comment mentions the word).
- Full grid suite: **4136 passed / 8–10 failed / 37 skipped** across two runs. All failures are the
  documented pre-existing flakes and NONE are new: `test/ci/operator-scope-typing.test.ts` (EACCES
  on a foreign hardcoded path `/Users/desirey/...`), `test/rig/end-to-end-smoke.test.ts` +
  `test/rig/tarball-integrity.test.ts` (rig process tests), and the SNS-watchdog parallelism flake
  (seen only in the parallel run). The new anvil test passes in-suite here because anvil is live;
  it skips in CI (no anvil), which is correct.

## Follow-ups (per 63-CONTEXT, out of scope for this core increment)

- Wire `attestJobCompletion` into the live `labor-escrow-store` / procurement tick (the in-DB →
  on-chain trigger).
- LandSale + NousAccount (ERC-4337 UserOp) clients; the bundler / user-wallet submission model
  (D-63-2b).
- New audit events for on-chain settlement — check whether `procurement.attested` /
  `procurement.settled` can be reused before adding allowlisted `settle.*` events.
- Sepolia deploy (operator infra: RPC, deploy key, test ETH).

## Self-Check: PASSED
