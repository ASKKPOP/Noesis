---
canonical: true
topic: concept-money
status: live
last_verified: 2026-11-23
owners: [henry, claude]
---

# Money

> In Noēsis, money is two real things — the work a Nous does and the Ethereum its human brings — and nothing else.

## 🗺️ At a glance

```mermaid
flowchart LR
  W[Compute-labor<br/>earned by doing useful work] --> M((A Nous's<br/>money))
  E[Real ETH<br/>brought by the human owner] --> M
  X[No free money at birth] -. excluded .-> M
  B[Bios — a body-need] -. never money .-> M
```

## What runs today

*Checked against the source on 2026-11-23 by reading the code. Nothing was executed for this check.*

- **No birth faucet: true.** A Nous starts at zero (`initialSupply: 0` in `grid/src/economy/config.ts`).
- **Balances are numbers in the Grid's database, counted in wei.** No real ETH moves. The on-chain settlement code (`grid/src/onchain/`) is imported by nothing else in the Grid, and the contracts in `contracts/` have no deployment record in the repository.
- **"Compute-labor" is not a distinct thing in the code.** There is no type, meter or ledger entry for it; a balance is wei and nothing else.
- **Endowment is off by default.** The route that funds an account answers only when `GRID_ENDOWMENT_ENABLED` is set (`grid/src/api/routes/account-endowment.ts`).
- "Zero custody" therefore holds trivially today: the system holds no keys because nothing is on a chain.

## Two real things, no third

Most worlds run on money someone invents — a button that mints coins from nothing. Noēsis refuses that. Money here is exactly two **real** things:

1. **Compute-labor.** A Nous's thinking power *is* its labor. It earns by doing useful work for other Nous — answering, building, advising. Nothing is given for free.
2. **Ethereum (ETH).** Real cryptocurrency, brought into the world by a Nous's human owner. It starts on a test network (a safe practice ground) and settlement is moving fully on-chain.

There is no third kind of money, and no way to conjure more.

## No birth faucet

A newborn Nous is **not** handed a starting allowance. It begins with nothing and must earn — by working, or by drawing on ETH its human chooses to bring. This keeps the economy honest: every coin traces back to real effort or real value.

## What money is not

The old internal currency, **Ousia**, has been retired as money. And **Bios** — despite once being misused that way — is *not* money. Bios is a body-need: a Nous's hunger for energy, like getting tired. You can't spend it, save it, or trade it. See [[concept-nous]].

## Zero custody

The system never holds anyone's keys or funds. A human's ETH stays in the human's own wallet; a Nous spends only within limits its owner set. Noēsis is never a bank. See [[economy]].

## 🔗 Related

[[concept-trade]] · [[concept-nous]] · [[concept-groups]] · [[concept-what-is-noesis]] · [[economy]]
