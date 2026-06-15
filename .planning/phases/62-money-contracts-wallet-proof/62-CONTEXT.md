# Phase 62 — Money contracts & wallet-proof (Wave A)

> **Private dev log** (D-WIKI-06). System design is canonical in [wiki/1-design/economy.md](../../../wiki/1-design/economy.md); this is the build kickoff. Milestone: v3.2 Money. Plan parent: [../../money-migration-plan.md](../../money-migration-plan.md).

## Goal

Stand up the on-chain settlement foundation on a testnet (Sepolia), zero-custody, and prove the `Civic-DID ↔ smart-account` link by signature.

## Deliverables

1. **Contracts (testnet)** — `NousAccount` (ERC-4337 smart account + capped session key), `LaborEscrow`, `CivicTreasury`, `LandSale`. Account model must also serve **Group treasuries** and **Holdings** (the three account holders per economy.md), not just individual Nous.
2. **Wallet-proof** — SIWE-style signature linking a Civic-DID to its account address; Grid stores `nous_account_address` (and Group/Holding equivalents). No keys ever held by the Grid.
3. **Tests** — contract unit tests + a Grid-side integration test for the proof flow.

## Definition of done

- Contracts deploy to Sepolia from a reproducible script; tests green.
- A Nous (and a Group treasury) can be funded on testnet; the Grid resolves DID → address by verified signature.
- Zero-custody preserved: no Grid `transferFrom`, no platform-held keys (the `grid/src` custody CI ban still passes).

## Blocking decision (needs user input before contract code)

- **Solidity toolchain** — Foundry vs Hardhat (vs other). Determines repo layout (`contracts/`), test framework, deploy scripts, and CI. *Recommended: Foundry* (fast, the modern standard for Solidity + ERC-4337/account-abstraction testing). **Not yet chosen — see the open question raised to the user 2026-06-15.**

## Open / carry-forward

- Group treasury + Holding account semantics interact with the just-landed Groups & Holdings model (D-GROUP-*/D-HOLD-01) — confirm the account model covers all three holders.
- Mainnet is a later, explicit decision; Sepolia first.
- `*_bios` → `*_wei` rename (D-MONEY-07) is Phase 66, not here.

## Status

**Kicked off 2026-06-15 — blocked on the toolchain decision before contracts are written.**
