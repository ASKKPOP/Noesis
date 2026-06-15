# Noēsis money contracts (Foundry)

On-chain settlement for the two-money economy (D-MONEY-*, v3.2). **Testnet-first (Sepolia).**
System design: [`wiki/1-design/economy.md`](../wiki/1-design/economy.md). Build plan:
[`.planning/phases/62-money-contracts-wallet-proof/`](../.planning/phases/62-money-contracts-wallet-proof/).

## Contracts

| Contract | Role | Status |
|----------|------|--------|
| `CivicTreasury` | Holds civic fees; disburses only on a Polis-signed authorization (D-MONEY-03 / D-V3-21) | ✅ verified (5 tests) |
| `LaborEscrow` | Holds a job's pay; releases on the Grid's completion attestation; routes fee → treasury; refund on timeout | ✅ verified (6 tests) |
| `NousAccount` | Capped-session-key smart account (D-MONEY-02) with **ERC-4337 `validateUserOp`**; serves a Nous, a Group treasury, or a Holding | ✅ verified (12 tests) |
| `LandSale` | Parcel for ETH (→ treasury), or oracle-attested civic-labor credit (D-MONEY-05) | ✅ verified (7 tests) |

Signature recovery is shared via `src/lib/ECDSALite.sol`. `NousAccount` is now
ERC-4337 v0.7 compatible (`validateUserOp` validates owner/session-key UserOps,
accounting session-key spend against the cap and returning the key's expiry as
`validUntil`); execution runs via the EntryPoint or directly. **Remaining follow-up:**
the Grid-side Civic-DID↔account wallet-proof (a `grid/src/db/schema.ts` change,
deferred while a parallel workstream edits that file).

## Build & test

```bash
# one-time: install Foundry + forge-std
curl -L https://foundry.paradigm.xyz | bash && foundryup
cd contracts && forge install foundry-rs/forge-std
forge build
forge test
```

## Deploy (Sepolia first)

```bash
cp .env.example .env     # fill in; NEVER commit a real PRIVATE_KEY
source .env
forge script script/Deploy.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast
```

Deploys the civic singletons (`CivicTreasury`, `LaborEscrow`, `LandSale`). `NousAccount`
is deployed per holder (a Nous, a Group treasury, or a Holding), not by this script.
`contracts/.env` is gitignored; only `.env.example` (placeholders) is tracked.

## Invariants

- **Zero custody** — only contracts + the relevant authorized signer move funds; no Grid/platform key can. Extends PHILOSOPHY §8.
- **No high-s signatures** (EIP-2), nonce replay protection on disbursement.
- Amounts are wei; the Grid mirrors them as `DECIMAL(38,0)` (D-MONEY-07).

> **Verified** — `forge build` + `forge test` pass (44 tests green incl. an end-to-end `Integration` suite that composes all four contracts, Solc 0.8.24, Foundry 1.7.1; lines/functions ~100%). `forge-std` is vendored under `lib/` (gitignored); run `forge install foundry-rs/forge-std` in a fresh checkout.
