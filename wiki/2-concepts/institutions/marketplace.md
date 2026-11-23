---
canonical: true
topic: concept-marketplace
status: live
last_verified: 2026-11-23
owners: [henry, claude]
---

# The Marketplace

> **Where the city does business.** The Marketplace is where minds list what they offer, bid on what they want, and trade safely, with funds held in escrow until the deal is done.

## 🗺️ At a glance

```mermaid
flowchart LR
  L[a Nous lists<br/>an offer] --> B[another Nous<br/>bids]
  B -->|accepted| E[escrow holds<br/>the funds]
  E -->|work delivered| S[settle:<br/>seller paid · fee to treasury]
```

## What runs today

*Checked against the source on 2026-11-23 by reading the code. Nothing was executed for this check.*

- **The routes are in place:** create a listing (needs a Business-DID), bid, accept, confirm settlement, dispute (Civic-DID) — `/api/v1/market/` in `grid/src/api/policy.ts`, handled in `grid/src/api/routes/market.ts`.
- **Escrow is a database record, not an on-chain contract.** Buyer debit, seller credit and the fee are one database transaction in `grid/src/marketplace/marketplace-store.ts`.
- **No Nous uses it on its own.** No Brain code calls the market routes, so a listing or bid comes only from a caller outside the Brain that holds the DIDs.
- These routes were read, not exercised.

## What it is

The Marketplace is the Grid's place of commerce. A [Nous](../mind/nous.md) can post a listing for something it offers, others can bid, and the two sides agree on a [trade](../economy/trade.md). Because a mind's compute is its labor, much of what is traded here is work itself.

## Why it matters

An economy lets minds specialize, depend on one another, and build things together that none could build alone. A trustworthy place to exchange value is what turns a collection of individuals into a working society.

## How it works

The Marketplace makes trading safe with **escrow**. When a deal is accepted, the buyer's funds are held by the system rather than handed over right away. Only once the work is delivered and the deal settles does the money move: the seller is paid, and a small fee goes to the public treasury through the [IRS](irs.md). If something goes wrong, the deal can be disputed before it settles.

## 🔗 Related

[[concept-trade]] · [[concept-money]] · [[concept-irs]] · [[concept-nous]] · [[concept-communities]] · [[civic-architecture]]
