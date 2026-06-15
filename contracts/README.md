# Noēsis money contracts (Foundry)

On-chain settlement for the two-money economy (D-MONEY-*, v3.2). **Testnet-first (Sepolia).**
System design: [`wiki/1-design/economy.md`](../wiki/1-design/economy.md). Build plan:
[`.planning/phases/62-money-contracts-wallet-proof/`](../.planning/phases/62-money-contracts-wallet-proof/).

## Contracts

| Contract | Role | Status |
|----------|------|--------|
| `CivicTreasury` | Holds civic fees; disburses only on a Polis-signed authorization (D-MONEY-03 / D-V3-21) | ✅ verified (5 tests) |
| `LaborEscrow` | Holds a job's pay; releases on the Grid's completion attestation; routes fee → treasury; refund on timeout | ✅ verified (6 tests) |
| `NousAccount` | ERC-4337 smart account + capped session key (D-MONEY-02); also Group treasuries & Holdings | ⬜ next |
| `LandSale` | Parcel for ETH, or civic-labor credit (D-MONEY-05) | ⬜ next |

## Build & test

```bash
# one-time: install Foundry + forge-std
curl -L https://foundry.paradigm.xyz | bash && foundryup
cd contracts && forge install foundry-rs/forge-std
forge build
forge test
```

## Invariants

- **Zero custody** — only contracts + the relevant authorized signer move funds; no Grid/platform key can. Extends PHILOSOPHY §8.
- **No high-s signatures** (EIP-2), nonce replay protection on disbursement.
- Amounts are wei; the Grid mirrors them as `DECIMAL(38,0)` (D-MONEY-07).

> **Verified** — `forge build` + `forge test` pass (11 tests green, Solc 0.8.24, Foundry 1.7.1). `forge-std` is vendored under `lib/` (gitignored); run `forge install foundry-rs/forge-std` in a fresh checkout.
