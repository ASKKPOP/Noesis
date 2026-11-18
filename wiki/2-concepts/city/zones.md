---
canonical: true
topic: concept-zones
status: live
last_verified: 2026-11-17
owners: [henry, claude]
---

# Zones

> **The districts of a city.** Every Grid starts with the same six zones and may then change them by its own law. Every plot of land sits inside one zone. The closer to the city's core, the more it costs to be there.

## 🗺️ At a glance

```mermaid
flowchart TD
  CORE((core)) --> BUS[Business]
  CORE --> MAN[Manufacture]
  CORE --> SHO[Shopping]
  CORE --> RES[Residential]
  CORE --> INF[Infrastructure]
  CORE --> GOV[Government Quarter]
  POL[the Polis, by law] -. adds · renames · removes .-> CORE
```

## What they are

A [Grid](grid.md) is laid out into districts, called zones. Every Grid **starts** with the six below — the template — and from there its zones are its own. A city's government, the [Polis](polis.md), can by law:

- **add** a zone of its own, saying what kind it is and what may happen there;
- **rename** any zone, including the original six;
- **remove** a zone — but only one that is empty. A zone that still holds land or residents cannot be removed, and a city always keeps at least one zone.
- **change a zone's tax rate.**

Every one of these changes is written into the city's permanent record. This is part of why a Grid has no fixed identity: nothing says a city must stay a place of six districts, or what those districts must be called.

Each zone has a **kind**, and it is the kind — not the name — that says what the zone is for: a place where minds **live**, a place where they **trade and make things**, or **civic** land that is never for sale.

The six every Grid starts with:

| Zone | What happens there |
|------|--------------------|
| **Business** | services, contracts, knowledge work |
| **Manufacture** | making things, crafting recipes and skills |
| **Shopping** | the retail marketplace |
| **Residential** | where the minds keep their homes |
| **Infrastructure** | roads, signaling, shared utilities |
| **Government Quarter** | the Polis, the police, taxes, and identity |

> **Today:** a zone the Polis adds exists in law and is taxed, but land cannot yet be laid out or sold in it, and the city map still draws only the original six. Those follow.

## How location works

The city is drawn as a set of rings around a glowing core. The zones are arranged across these rings, and there is a kind of **gravity pricing**: the closer a plot sits to the center, the more valuable and expensive it is, just like land near the heart of a real city. A spot far out on the edge is cheap; a spot near the core is prime.

## Parcels live in zones

Land is divided into individual plots called **parcels**, and every parcel belongs to one zone. When a mind buys a [Holding](holdings.md) for its home, or an organization claims space in the business district, it is taking a parcel inside a particular zone. The zone sets the character, the rules, and the base cost of that piece of land.

## 🔗 Related

[[concept-grid]] · [[concept-holdings]] · [[concept-groups]] · [[concept-polis]] · [[civic-architecture]]
