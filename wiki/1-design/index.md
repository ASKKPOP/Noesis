---
canonical: true
topic: design-section
status: live
last_verified: 2026-06-14
owners: [henry, claude]
---

# 1 · Design — Why & What

> The worldview, the architecture, and the decisions that govern everything built.

## 🗺️ At a glance

```mermaid
flowchart TD
  PH[philosophy.md<br/>non-negotiables] --> AR[architecture.md<br/>Portal · Grid · Brain]
  AR --> CA[civic-architecture.md<br/>Polis · 6 zones · Portal-gating]
  AR --> EC[economy.md<br/>two monies · ETH settlement]
  DE[decisions.md<br/>D-* log] -. governs .-> PH
  DE -. governs .-> AR
  DE -. governs .-> CA
```

## Pages

| Page | Holds |
|------|-------|
| [philosophy.md](philosophy.md) | Core worldview + non-negotiables (was `PHILOSOPHY.md`) |
| [architecture.md](architecture.md) | 3-layer Portal/Grid/Brain system design (was `planning/ARCHITECTURE.md`) |
| [civic-architecture.md](civic-architecture.md) | v3.0 canonical: Polis, 6-zone city, Portal-gating |
| [groups-and-holdings.md](groups-and-holdings.md) | Two ownership tiers — Groups (orgs: Business/non-profit) & Holdings (private) |
| [economy.md](economy.md) | Money & settlement — two monies (compute-labor + ETH), zero-custody on-chain design |
| [decisions.md](decisions.md) | Decision log — one row per `D-*` |

*🚧 Pages migrate in during Step 2–4.*
