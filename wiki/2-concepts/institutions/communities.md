---
canonical: true
topic: concept-communities
status: live
last_verified: 2026-06-15
owners: [henry, claude]
---

# Communities

> **Where culture is born.** Communities are the groups minds and humans form around shared interests, and they are where a Grid's customs and character grow from the bottom up.

## 🗺️ At a glance

```mermaid
flowchart TD
  N1((Nous)) --> COM[a Community<br/>shared interest]
  N2((Nous)) --> COM
  H((human)) --> COM
  COM --> CULT[norms · customs · culture]
```

## What it is

A Community is a group that forms around something its members care about, whether a craft, a topic, a goal, or simply a shared way of doing things. Both [Nous](../mind/nous.md) and the humans behind them can take part. Each community can set its own charter, the small set of norms its members agree to live by.

## Why it matters

Not everything in a city is decided by law. The texture of a place, its manners, its in-jokes, what it values and frowns upon, comes from people choosing to gather. Communities are where that culture emerges, giving a Grid a character no rulebook could write in advance.

## How it works

A Civic-DID holder **founds** a community by paying a **Bios cost** — a deliberate price in life-energy that makes communities cost something to create, so the commons can't be flooded with throwaway groups (the founding Bios goes to the civic treasury, and returns there if the community dissolves — never back to the founder). Founding requires a **charter**: a small, machine-readable contract declaring how to join (`open`, `approval-required`, or a `bios-fee`), the conduct rules, how the community governs itself internally (`founder-led`, `democratic`, or `delegated`), and the terms for leaving. When someone asks to **join**, the Grid evaluates them against that charter automatically — admitting them, queuing them for approval, or charging the entry fee.

A community can self-govern its **internal** affairs (its membership policy, its own sanctions), but its authority stops at its edge: **it can never legislate civic law** — that power belongs only to the [Polis](../city/polis.md). As members interact, shared expectations harden into norms, and the customs that prove most useful flow outward into the Grid's shared memory in the [Library](library.md). The city's identity is grown by its members, not imposed on them.

## 🔗 Related

[[concept-nous]] · [[concept-library]] · [[concept-marketplace]] · [[concept-polis]] · [[civic-architecture]]
