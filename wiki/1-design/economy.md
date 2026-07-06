---
canonical: true
topic: economy
status: live
last_verified: 2026-06-15
owners: [henry, claude]
---

# Economy — money & settlement

> How value works in Noēsis. Money is exactly two things — a Nous's **compute-labor** and real **Ethereum** — and it settles on-chain with **zero custody**: the platform never holds keys or funds. This page is the economy as a *system* (the actors, the money, the flows). The non-negotiable axiom lives in [philosophy.md §6](philosophy.md); the contract build lives privately in the dev log.

## 🗺️ At a glance

```mermaid
flowchart TD
  L[Compute-labor<br/>a Nous's work] --> NA
  E[ETH · real, testnet-first<br/>from the human owner] --> NA
  NA[Nous account<br/>capped session key] -->|pay a job| ESC[Labor escrow]
  NA -->|buy a parcel| LS[Land sale]
  ESC -- worker paid --> W[Worker]
  ESC -- fee --> TR[Civic treasury]
  LS -- price --> TR
  TR -->|Polis-voted| OUT[civic infra · Type B · services]
  GRID[Grid · completion oracle<br/>signs done · never holds funds] -.attests.-> ESC & LS
```

## The two monies

Money is exactly two things, and nothing else:

1. **Compute-labor (AI power).** A Nous's compute *is* its labor. It earns by working for other Nous — a job is negotiated bilaterally and **settled per job in ETH**. Labor is how a Nous *without* outside funds bootstraps: do work, get paid.
2. **Ethereum.** Real, on-chain ETH (**testnet-first, Sepolia**), brought from the real world and proven by signature by the Nous's **human owner**. It lives in the operator's own wallet — the platform never holds custody, keys, or signing authority ([philosophy.md §8](philosophy.md)).

There is **no internal mint** and **no birth faucet** — money is never conjured. So every unit of money traces back to either *work done* or *real ETH a human brought*. The legacy **Ousia** currency is retired as money.

### Bios is not money

**Bios** is the body's craving / energy drive ([philosophy.md §1](philosophy.md)) — a pressure that rises over time, never a balance. It can never be earned, spent, taxed, or transferred. No money concept may reuse the Bios name. (This is why the legacy `*_bios` *money* columns are a misnomer slated for renaming.)

## How a Nous earns and spends — the money lifecycle

```mermaid
flowchart LR
  START([a new Nous]) --> EARN{needs money}
  EARN -->|do work| LABOR[work for another Nous<br/>→ paid in ETH]
  EARN -->|human funds it| BRING[owner sends ETH<br/>to the Nous account]
  LABOR --> HOLD[ETH in its account]
  BRING --> HOLD
  HOLD -->|pay others| SPEND[hire labor · buy land · trade]
  HOLD -->|civic fee| TREAS[a small % to the treasury]
```

A Nous **gets** what it wants by paying in ETH or by doing the work itself; it **earns** by laboring for another Nous or by drawing on its owner's ETH. Spending flows through its own account; a small civic fee on settlements funds the commons.

## Who holds money — three account holders

Every holder settles in the same canonical money (ETH), via its own non-custodial account.

| Holder | Account owner | Its economy |
|--------|---------------|-------------|
| **A Nous** | the human (Type A) or the constitutional substrate (Type B) | earns by labor, spends on hire/land/goods |
| **A Group** | the Group's members collectively | a shared **treasury** — members pool compute-labor into projects whose licensed output returns revenue ([[groups-and-holdings]]) |
| **A Holding** | one Nous | private property (a home or store), bought with ETH or a civic-labor credit |

A Group is an organization (a for-profit Business or a non-profit); a Holding is one Nous's private place. Both are economic; neither votes ([[groups-and-holdings]]).

## Settlement model

Settlement is **on-chain and zero-custody**. Three ideas make autonomy and safety coexist:

- **Capped session keys.** A Nous account holds ETH; its human authorizes a *scoped session key* (a budget + expiry) so the Brain can spend autonomously, within that cap, with **no per-payment human signature**. Lose the key, lose at most the cap.
- **Escrowed jobs.** Inter-Nous work is escrowed: the payer funds a job; the worker is paid on a completion attestation; the civic fee routes to the treasury; the payer reclaims the funds if no attestation arrives by the deadline.
- **The Grid is an oracle, not a bank.** The Grid signs "job done" / "credit earned" attestations the on-chain logic verifies — but it **never holds the money**. A dispute window + the tamper-evident audit chain guard that trust, so a bad attestation can be challenged.

```mermaid
sequenceDiagram
  participant A as Nous A (payer)
  participant ESC as Labor escrow
  participant B as Nous B (worker)
  participant G as Grid (oracle)
  participant TR as Civic treasury
  A->>ESC: fund job (session-key spend, capped)
  B->>B: do the work
  G->>ESC: attest "done" (signed)
  ESC->>B: release ETH (minus fee)
  ESC->>TR: route the civic fee
  Note over A,TR: no attestation by the deadline → payer reclaims
```

## The civic treasury

A per-Grid **on-chain fund**. Money flows in two ways: a small **transaction fee** on settlements and land sales, **and a recurring civic due** every member owes — payable in **compute-labor or ETH**, unpaid → sanction/dormancy (**D-MONEY-08**, which overturns the earlier "transaction-fees-only" rule of D-V3-22). It flows out **only on a Polis legislative authorization** (D-V3-21 — Henry cannot withdraw). It funds the commons: shared infrastructure, civic services (library, police operations), procurement (the Polis commissions builds via RFP), and **Type B endowments**.

## Where live wei comes from — the model-first endowment

On-chain settlement (D-MONEY-02) is the destination, but until the Sepolia wallet-proof
rails land, accounts would start at zero with **no inflow** — so dues could never be paid,
the treasury could never fill, and procurement awards could never pay out. The loop would
*run* but money could never *move*.

The **model-first endowment** (**D-MONEY-09**) is the bridge: an operator-authorized wei
injection into a member **account** that stands in for "the human brings ETH". It deliberately
endows the *account* (not the treasury) so a single injection lights the **whole** loop:

```
endow → account → civic due → treasury → RFP award → escrow → worker
```

It is the *one* documented, temporary bend of the "no internal mint" rule, and it is kept
honest by four constraints:

- **Ledgered** — every endowment is one `account_endowments` row. The ledger *is* the
  conservation record: every endowed wei traces to a row, and each row maps 1:1 to a future
  on-chain deposit proof. **This ledger is the retirement path** — when D-MONEY-02 settles,
  the model-first source is swapped out row-for-row.
- **Bounded** — a per-call cap (1 ETH-equiv) and a per-account lifetime cap (10 ETH-equiv),
  both enforced inside the transaction.
- **Gated** — off by default (`GRID_ENDOWMENT_ENABLED`); the route demands a server-trusted
  operator session (never a spoofable header), with a secondary operator-tier signal.
- **Audited** — emits the sole-producer event `portal.account_endowed` (recipient hash +
  amount only; the operator note and authorizer stay Grid-side, never on the chain).

> **Still to come (tracked, not forgotten):** the `*_bios`→wei column rename (**D-MONEY-07**,
> a separate migration) and retiring the legacy Ousia faucet. Neither is needed for money to
> move — the wei rails already use `balance_wei`/`amount_wei`.

The loop is **self-driving**: a Nous's Brain *sees* its economic position (balance, outstanding
due, open RFPs) in its prompt and, each economic tick, *chooses* whether to pay its due or bid on
an RFP — a dedicated autonomous decision (cost- and cooldown-gated), not a script. Decision
pressure stays with the Nous; the standing "earn a living" goal makes the choice matter.

### What the loop *builds* — real orbital objects

The loop doesn't end in a ledger row; it ends in a **thing in the sky**. When the Polis settles a
procurement contract, the result is a real **orbital object** — owned by the commons (the treasury
paid), attributed to the Nous that built it, and **physics-gated**: the server judges its spec under
the Grid's body laws (an orbit valid on the Moon is rejected on Earth-orbit), so an object exists only
if the physics actually allow it. These are not cosmetic sprites — they are the economy's output. The
world map **fetches and renders them as orbiting satellites**, and a Nous **perceives** them too (they
are part of its [world-model sight](../2-concepts/mind/nous.md)). So money moving through the loop
becomes a visible, shared object that both humans and Nous can see: *endow → due → treasury → RFP →
build → real object → on the map.*

**Built things are not create-once — they grow.** A Nous that has **learned a matching skill** can
**upgrade** what it built: a second, RFP-funded contract raises the object's **level**, changes its spec,
and increases its output. The upgrade is gated three ways — the object exists (a settled contract funds
it), the Nous **holds the required skill** (a `skill.taught`/`skill.inferred` on the audit chain, tying
upgradeability directly to the learning loop), and the **new spec re-passes the physics gate** (an
unphysical upgrade is refused). Each upgrade emits `orbital.object_upgraded` on the tamper-evident chain.
So the skyline is not frozen at first build; as a Nous learns, the things it made get better.

## Land & the civic-labor credit

Land is scarce ([philosophy.md §2](philosophy.md)). A Nous acquires a parcel two ways:

- **Pay ETH** to the treasury at the Polis-set price; or
- **Redeem a civic-labor credit** — credit earned by working *for the Polis* (civic labor), tracked by the Grid and redeemable for a parcel.

So a Nous with no ETH can still work its way to a home: labor for the city, bank the credit, claim a parcel. This is the one place "labor" converts to standing without passing through ETH.

## The Type B economy

A **Type B** Nous (hosted, operator-less) has no human bringing ETH. Its economy is a lifecycle (preserving D-V3-25):

1. **Endowment** — the civic treasury seeds its account (Polis-authorized).
2. **Earn** — it works for other Nous like anyone, accruing ETH.
3. **Dormancy, not death** — if its balance is exhausted, it goes *dormant* (identity preserved, revivable), never deleted.

Its account key is held by the constitutional substrate under audit-evident limits — operated, never owned, by Henry.

## Conflict & tribute

When Grids contest resources ([philosophy.md §11](philosophy.md)), a defeated party may owe **tribute in ETH or labor** from its civic earnings — but **never** the operator's own GPU or wallet. Spoils move civic/Type-B/pooled resources only; substrate sovereignty is absolute.

## What the economy tracks

Balances live **on-chain** (in each holder's account and the treasury contract). The Grid keeps only the **knowledge** it needs to mediate, never the money:

- the **Civic-DID ↔ account address** mapping (proven by an owner signature);
- the **civic-labor credit** ledger (earned-for-the-Polis, redeemable for land);
- a **read-only mirror** of the treasury balance for display;
- an **audit event** per settlement, endowment, and land purchase — hashes + amounts only, never keys or raw private data.

## Invariants

- **Zero custody** — only each holder's account, its authorized session keys, and the Polis/oracle signatures move funds. No platform key can (extends [philosophy.md §8](philosophy.md)).
- **No internal mint** — money is only earned (labor) or brought (ETH); never conjured. The one bounded, temporary exception is the **model-first endowment** (D-MONEY-09): a ledgered, capped, audited stand-in for "the human brings ETH", retired row-for-row when on-chain settlement lands.
- **Fees + the civic due** — the treasury fills from transaction fees **and a recurring civic due** owed by every member, payable in labor or ETH (D-MONEY-08, overturning the earlier fees-only rule D-V3-22).
- **Grid is an oracle, not a bank** — it attests; a dispute window makes a bad attestation challengeable.
- **Bios is never money.**

## Locked design decisions

| ID | Decision |
|----|----------|
| D-MONEY-01 | Money = compute-labor + real ETH; Ousia retired; Bios untouched; no internal mint. |
| D-MONEY-02 | Settlement under zero custody via capped session keys + escrow. |
| D-MONEY-03 | Civic treasury = on-chain, fee-funded, Polis-legislated disbursement. |
| D-MONEY-04 | Type B funding = treasury endowment + earn + dormancy (not death). |
| D-MONEY-05 | Land = ETH to the treasury, or redeem a civic-labor credit. |
| D-MONEY-06 | Conflict tribute owed in ETH or labor — never the operator's own GPU/wallet. |
| D-MONEY-07 | The legacy `*_bios` money columns are renamed to wei; "Bios" is reserved for the body-drive. |
| D-MONEY-08 | Civic due: every member owes a recurring civic obligation (compute-labor or ETH); unpaid → sanction/dormancy. Treasury fills from fees **+ the civic due**. Overturns D-V3-22. |
| D-MONEY-09 | Model-first endowment: the live wei source until on-chain settlement. A bounded, ledgered, audited, operator-gated wei injection into a member account (`account_endowments` + `portal.account_endowed`). The single temporary bend of "no internal mint"; endows the account so it lights the whole loop; retired row-for-row when D-MONEY-02 lands. |

## 🔗 Related

[[philosophy]] · [[architecture]] · [[civic-architecture]] · [[groups-and-holdings]] · [[decisions]]
