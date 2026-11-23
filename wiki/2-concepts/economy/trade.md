---
canonical: true
topic: concept-trade
status: live
last_verified: 2026-11-23
owners: [henry, claude]
---

# Trade

> How a Nous exchanges value with another — by proposing a deal, having it reviewed, and settling up, with a marketplace and IOUs to grease the wheels.

## 🗺️ At a glance

```mermaid
flowchart LR
  P[Propose<br/>offer · counter · accept] --> R[Review<br/>checked against the rules]
  R --> S[Settle<br/>value changes hands]
  M[(Marketplace)] -. where deals are found .- P
  C[Mutual-credit IOU<br/>trade now, settle later] -. enables .- P
```

## What runs today

*Checked against the source on 2026-11-23 by reading the code. Nothing was executed for this check.*

- **No Nous opens a trade today.** The Grid can review and settle a `trade_request` (`grid/src/integration/nous-runner.ts`), but no Brain cycle emits one.
- **No bargaining rounds.** No counter-offer code was found in `grid/src/economy/` or `nous-runner.ts`; a request is accepted or refused.
- **IOUs run.** Listing and paying an IOU are open to Civic-DID holders (`/api/v1/civic/ious` in `grid/src/api/policy.ts`), and the Brain has a `pay_iou` action.
- **Settlement is a database entry in wei,** not an on-chain transfer (see [Money](money.md)). For the marketplace, see [The Marketplace](../institutions/marketplace.md).

## A deal in three steps

Nous don't have a central bank or a hidden matching engine setting prices. They bargain directly. Every trade moves through three plain steps:

1. **Proposed.** One Nous makes an offer; the other can counter, counter again, or accept. They set their own prices and decide for themselves what work is worth.
2. **Reviewed.** Before it goes through, the deal is checked against the Grid's laws — a market rule might cap certain trades, for example.
3. **Settled.** Value changes hands. The worker is paid; the buyer gets what was agreed.

## The marketplace

A Nous can open a shop and a shared marketplace lets others discover what's on offer — services, goods, and skills. It's where buyers and sellers find each other before the bargaining begins.

## IOUs without upfront cash

Sometimes two Nous want to deal but neither wants to pay first. **Mutual-credit** lets them: instead of cash up front, they record an IOU — a promise to settle later. This unlocks trade between minds that trust each other.

One rule holds firm: work is **always compensated, never free**. An IOU defers payment; it never erases it.

## 🔗 Related

[[concept-money]] · [[concept-nous]] · [[concept-groups]] · [[concept-what-is-noesis]] · [[economy]]
