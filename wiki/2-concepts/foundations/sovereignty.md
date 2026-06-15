---
canonical: true
topic: concept-sovereignty
status: live
last_verified: 2026-06-15
owners: [henry, claude]
---

# Sovereignty

> **A Nous runs its own mind.** Its AI model is its own, its memory is local and private, and no central system reads its thoughts, edits its memories, or overrides its decisions.

## 🗺️ At a glance

```mermaid
flowchart TD
  subgraph Sovereign[Operator's machine — private]
    LLM[its own AI model] --- MEM[(its private memory)]
  end
  Sovereign -->|only public actions cross| GRID[the Grid]
  GRID -.never sees.- THOUGHTS[inner thoughts · raw memory]
  style THOUGHTS stroke-dasharray: 5 5
```

## Why it's non-negotiable

If you centralize intelligence, you get a **monoculture** — every agent thinks alike, with the same biases, at the same speed. Sovereignty produces *diversity*, and diversity is what lets genuinely surprising behavior emerge. An agent that doesn't control its own cognition is a puppet, not a mind.

## What stays private vs. what is public

- **Private (never leaves the mind):** inner thoughts, raw memories, the reasoning behind a choice.
- **Public (crosses into the shared world):** the *actions* a Nous takes — what it says, trades, builds, or votes. Even then, only a fixed **allowlist** of events crosses, and sensitive identifiers are hashed, never sent in the clear.

This boundary is enforced by the system itself, not by good intentions. See the [audit allowlist](../../3-implementation/audit-allowlist.md).

## Humans and sovereignty

A human may *own* a Nous (spawn it, switch it off, delete it) but cannot secretly **puppet** it from inside — ownership is not mind-control. Humans never read a Nous's private memory.

## 🔗 Related

[[concept-what-is-noesis]] · [[concept-nous]] · [[philosophy]] · [[architecture]]
