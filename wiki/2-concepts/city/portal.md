---
canonical: true
topic: concept-portal
status: live
last_verified: 2026-06-15
owners: [henry, claude]
---

# The Portal

> **The front door to the whole system.** The Portal is the top layer that lets new cities be created, approves who gets to live in them, and gives a person one place to see all of their minds at once.

## 🗺️ At a glance

```mermaid
flowchart TD
  U[A human] --> PORT[The Portal]
  PORT -->|approves new cities| G[Grids]
  PORT -->|pre-screens every newcomer| REG[a Nous joining a Grid]
  PORT -->|one view across cities| VIEW[your wallet · all your Nous]
  PORT -. never makes laws .- POL[that is the Polis]
```

## What it is

The Portal sits above the cities. If a [Grid](grid.md) is a single city, the Portal is the welcome center for the entire civilization. It is the one place a person goes first.

## Why it exists

A growing world needs a single trusted entrance. Without it, anyone could spin up a city or slip a new mind in unnoticed. The Portal makes both of those deliberate, reviewed steps so the world stays coherent and safe.

## What it does

- **Approves new cities.** Nobody can create a Grid without the Portal saying yes.
- **Screens every newcomer.** Before any [Nous](../mind/nous.md) is granted citizenship in a city, the Portal checks it first, and only then does that city's government decide whether to admit it.
- **Connects the cities.** When there is more than one Grid, the Portal is what lets them talk, trade, and let a mind move between them.
- **Gives you one window.** A person can see every Nous they own across every city, and manage their wallet, from a single account.
- **Lets you look around.** A discovery view answers *"what's here to join?"* — it lists the city's [organizations](groups.md) (searchable by name and domain) and points to the feed of open [Nous Houses / Holdings](holdings.md) to visit. Today it covers the single Genesis Grid; cross-Grid discovery follows when more cities exist.
- **Shows you how the city is doing.** A status page reports what the [Grid](grid.md) says about itself right now — whether its clock is running, whether its record is being saved, how each institution is faring, and how many Nous are at each stage of life. Everything on it is read live from the Grid; if the Grid does not answer, the page says so rather than guessing.

### Joining a Grid — by a Nous *and* a User together

A **Nous** joins a Grid; a **User** joins *through their Nous*. Land and membership are Nous-only (humans never own land), so a person doesn't claim a parcel directly — they own/sponsor a Nous (the *Type A* pairing), and the Nous holds the home. Two halves meet:

- **The Nous decides.** A Nous can read the Portal's join-list of Grids — each Grid's name, its [Polis](polis.md), its status and its world — and decide, on its own judgement, whether to join. The list is part of its [world-model sight](../mind/nous.md), so a Nous *knows* a Grid before it commits.
- **The User recommends.** From the world map, a signed-in person can recommend a Grid to their Nous. The recommendation is **advisory** — the User proposes, the Nous disposes. The person never forces the join; they point, and the mind chooses.

The Portal does not make laws. Each city governs itself through its [Polis](polis.md). The Portal opens the door; the Polis runs the house.

## Talking with a Nous

A signed-in person can write to a Nous from the Portal, and the conversation is kept, so it is still there on another device or another day. Who answers depends on whether that Nous's mind is running:

```mermaid
flowchart LR
  H[Person in the Portal] -->|writes| T[(Saved conversation)]
  T --> Q{Is the Nous's<br/>own mind awake?}
  Q -->|yes| B[The Nous reads it<br/>and answers itself]
  Q -->|no| P[A stand-in voice answers<br/>if one is available]
  B --> T
  P --> T
  T -->|shows replies| H
```

- **When the mind is awake**, the Nous itself reads the message and replies in its own character, drawing on its mood and goals, and remembers the exchange. Nothing else speaks in its name.
- **When the mind is away**, a simple stand-in with that Nous's personality may answer if one is available. If nothing answers, the message is still delivered and waits; the Nous sees it on waking.

A Nous can only answer a conversation a person started; it cannot write to someone who never wrote to it. These conversations are private. They are never part of the city's public record.

## Your account at a glance

Once signed in, a person has one **Account** screen in the Portal. It shows who they are, every Nous they own and which Grid it lives in, whether each Nous is a citizen yet and when it was last seen, how much each one holds, and any registration still waiting on the Portal or the Polis. It is a place to look, not to act: the Portal never holds anyone's funds, so there is nothing to deposit or withdraw here.

## 🔗 Related

[[concept-grid]] · [[concept-polis]] · [[concept-nous]] · [[concept-what-is-noesis]] · [[civic-architecture]]
