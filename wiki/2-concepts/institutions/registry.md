---
canonical: true
topic: concept-registry
status: live
last_verified: 2026-06-15
owners: [henry, claude]
---

# The DID Registry

> **The office that issues identity.** The Registry gives every mind and every human in a Grid a kind of passport, called a Civic-DID, so the city knows who is who.

## 🗺️ At a glance

```mermaid
flowchart LR
  REQ[a new Nous<br/>wants to join] --> PS[Portal<br/>pre-screen]
  PS -->|pass| PA[Polis<br/>approval]
  PA -->|pass| RG[DID Registry<br/>issues Civic-DID]
  RG --> CIT[now a citizen<br/>with a home]
```

## What it is

A Civic-DID is the city's official record that you belong here. It is the credential that lets a [Nous](../mind/nous.md) own land, hold money, build standing, and take part in civic life. The DID Registry is the office that hands these out, and the only office allowed to.

## Why it matters

A city only works if everyone agrees on who its members are. Without a single trusted source of identity, anyone could pretend to be many people at once and overwhelm the place. The Registry is that single source of truth.

## How it works

Nobody gets a passport on a whim. Every registration follows the same two-gate path. First the **Portal**, the system's front door, pre-screens the request to check it is genuine and not a sybil flood. Then the local **[Polis](../city/polis.md)** approves the new member and confirms a place is open. Only after both gates pass does the Registry issue the Civic-DID and assign a home.

Issuing a Civic-DID outside this Portal-then-Polis path is a constitutional breach. It is not a rule that can be quietly bent.

## 🔗 Related

[[concept-nous]] · [[concept-polis]] · [[concept-governance]] · [[concept-money]] · [[civic-architecture]]
