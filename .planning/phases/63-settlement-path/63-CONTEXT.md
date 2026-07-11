# Phase 63 — On-chain settlement path (Wave B)

**Gathered:** 2026-07-11
**Status:** Ready for build (core increment)
**Depends on:** 62.5 (one civic-keyed in-DB balance ✅) + 62 (contracts ✅ 54 Foundry tests, wallet-proof route ✅)

> Private dev log. Registry: [../../money-migration-plan.md](../../money-migration-plan.md) row B. System design: [wiki/1-design/economy.md](../../../wiki/1-design/economy.md).

## Goal
Bridge the in-DB labor/procurement settlement to the **on-chain** `LaborEscrow` contract: when a job completes in-Grid, the Grid (as oracle) attests completion on-chain → dispute window → finalize pays the worker + fee → `CivicTreasury`. **Local-anvil-first**, zero-custody of funds, Sepolia deploy deferred to the operator.

## Locked decisions (operator, 2026-07-11)
- **D-63-1 Oracle-key model:** the Grid holds an **attestation-authority signing key** (the `GRID_ORACLE` the contracts were deployed with) to sign `LaborEscrow.completionDigest(jobId)`. This is NOT fund custody — the Grid never holds user money; it only signs attestations. Zero-custody invariant (PHILOSOPHY §8) holds.
- **D-63-2 Submission = Grid relayer (first increment):** on-chain txns are submitted by a **Grid-run relayer EOA** that pays gas (`GRID_RELAYER_KEY`). ERC-4337 bundler / user-wallet-driven `NousAccount` UserOps are a **later increment** (D-63-2b, deferred).
- **D-63-3 Local-anvil-first:** build + test against a local `anvil` node (:8545). Sepolia deploy (RPC + keys) is the operator's, later. All on-chain code is behind an **off-by-default feature flag** `GRID_ONCHAIN_SETTLEMENT_ENABLED` (like `GRID_ENDOWMENT_ENABLED`).

## Validated groundwork (this session)
- Foundry v1.7.1 installed; `forge-std` vendored (gitignored, NOT a submodule); **54 contract tests pass**.
- `Deploy.s.sol` deploys to anvil: env `PRIVATE_KEY` (deployer), `POLIS_AUTHORIZER` (=arbiter), `GRID_ORACLE`, `FEE_BPS`(200), `DISPUTE_WINDOW`(1d). Anvil default accounts: 0=deployer/relayer, 1=authorizer, 2=oracle. Deployed OK: CivicTreasury/LaborEscrow/LandSale.
- **Oracle attestation flow** (from `LaborEscrow.t.sol` + `.sol`): `fundJob{value}(worker, deadline)→jobId` · oracle signs `completionDigest(jobId)` (= `toEthSignedMessageHash(keccak256(abi.encode(chainId, escrowAddr, jobId)))`) → `attestCompletion(jobId, sig)` · after `disputeWindow`, `finalize(jobId)` pays worker + fee→treasury. In ethers: `wallet.signMessage(getBytes(keccak256(AbiCoder.encode(['uint256','address','uint256'],[chainId, escrowAddr, jobId]))))`. In an anvil test, advance the window with the `evm_increaseTime`+`evm_mine` RPCs (not the forge `vm.warp` cheatcode).

## Core increment (this build)
1. **On-chain settlement module** (`grid/src/onchain/`): env-driven config (RPC url, LaborEscrow+CivicTreasury addresses, relayer key, oracle key) behind `GRID_ONCHAIN_SETTLEMENT_ENABLED` (off → all fns 503/no-op). An ethers `LaborEscrow` client (relayer-signed) + an **oracle attestation signer**.
2. **`attestJobCompletion(jobId)`** — signs `completionDigest` with the oracle key, submits `attestCompletion` via the relayer. Plus `finalizeJob(jobId)` (relayer submits `finalize`).
3. **Anvil integration test** (skip-if-no-anvil at :8545, mirroring the MySQL skip-if-no-DB pattern): deploy fresh contracts to anvil (shell `forge script` or ethers factory from `contracts/out`), fund a job, call the Grid `attestJobCompletion`, advance time via `evm_increaseTime`, `finalizeJob`, assert worker balance up by `amount − fee` and treasury up by `fee`.

## Out of scope (follow-ups)
- Wiring `attestJobCompletion` into the live `labor-escrow-store`/procurement tick flow (the in-DB→on-chain trigger) — next increment once the client is proven.
- LandSale + NousAccount (ERC-4337 UserOp) clients; the bundler/user-wallet submission model (D-63-2b).
- New audit events for on-chain settlement (`settle.*`) + allowlist additions — check whether the existing `procurement.attested`/`procurement.settled` events (`append-procurement-*.ts`) can be reused/mirrored before adding new allowlisted events (allowlist is frozen; additions need explicit per-phase entries + sole-producer triads).
- Sepolia deploy (operator infra: RPC, deploy key, test ETH).

## Invariants
- **Zero custody** — the Grid holds only its oracle + relayer keys (signing/gas), never user funds. The `grid/src` custody CI ban still passes.
- Feature-flag off by default; no behavior change when disabled.
- Hash-only audit boundary if any event is emitted; deterministic tick (no new clock source in the core module — attestation is request/flow-driven).

---
*Phase: 63-settlement-path · Context 2026-07-11 (operator decisions locked; local-anvil groundwork validated)*
