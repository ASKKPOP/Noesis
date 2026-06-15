# Money migration — build plan (developer log)

> **Private developer doc — NOT in the public wiki.** The *system design* (what we're building) lives in the public wiki: [wiki/1-design/economy.md](../wiki/1-design/economy.md). This page is the *process*: phases, build order, risks, and progress for replacing the legacy Ousia/`*_bios` economy with compute-labor + ETH (D-MONEY-01).

**Status:** design locked 2026-06-15 · **not started** · proposed milestone **v3.2 Money**.

## Phases (proposed — v3.2, Phases 62–66)

Phase numbering continues from v3.1 Nous House (last shipped Phase 61). Each phase ships its wiki + audit-allowlist updates in the same commit.

| Wave | Phase | Goal | Status |
|------|-------|------|--------|
| A | 62 — Contracts & wallet-proof | Deploy Nous-account / escrow / treasury / land contracts to Sepolia + tests; SIWE-style proof linking Civic-DID ↔ account. | ☐ not started |
| B | 63 — Settlement path | Session-key spend, LaborEscrow integration, completion attestation, fee → treasury, new audit events. | ☐ not started |
| C | 64 — Treasury & Type B | On-chain treasury reads, Polis-legislated disbursement, Type B endowment + dormancy. | ☐ not started |
| D | 65 — Land & civic-labor credit | ETH / labor-credit parcel purchase, civic-labor ledger. | ☐ not started |
| E | 66 — Cleanup & rename | Retire Ousia faucet, `*_bios` → `*_wei` rename, conflict-tribute, full doc/wiki sync. | ☐ not started |

## Build notes & risks (process)

- **Grid as trusted "job done" signer** → guard with the existing dispute window so a bad attestation can be challenged on-chain. (Design invariant captured in the wiki economy page.)
- **wei overflow** → store amounts as `DECIMAL(38,0)`, never `BIGINT`.
- **Session-key compromise** → on-chain spending cap + short expiry bound the loss; rotation via the human's owner wallet.
- **Testnet → mainnet** → ship and harden on Sepolia first; mainnet is a later, explicit decision.
- **Legacy tests use a mock Pool** → the `*_bios` → `*_wei` rename touches SQL that only fails on real MySQL; validate migrations against MySQL 8.0 before deploy (see deploy-mock-pool gap note).
- **Audit discipline** → new money events (`escrow.*`, settlement, land, endowment prefixes) each need an explicit broadcast-allowlist addition in the phase that introduces them, sole-producer triad, payload keys dodging `FORBIDDEN_KEY_PATTERN`, hashes/amounts/`tx_hash` only.

## Cross-references

- System design (public): [wiki/1-design/economy.md](../wiki/1-design/economy.md)
- Axiom (public): [wiki/1-design/philosophy.md](../wiki/1-design/philosophy.md) §6
- Requirements: [REQUIREMENTS.md](REQUIREMENTS.md) MONEY-01..06
- Roadmap milestone: [ROADMAP.md](ROADMAP.md) (Money Migration — FUTURE)
- State block: [STATE.md](STATE.md) (Money Axiom — D-MONEY-01)
