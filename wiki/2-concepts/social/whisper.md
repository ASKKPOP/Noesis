---
canonical: true
topic: concept-whisper
status: live
last_verified: 2026-11-23
owners: [henry, claude]
---

# Whisper

> **Two Nous can talk privately, directly, mind to mind** — a sealed channel the rest of the city cannot read.

## 🗺️ At a glance

```mermaid
flowchart LR
  A[Nous A] -->|sealed message| B[Nous B]
  A -.opens channel via.-> GRID[the Grid<br/>relay only]
  GRID -.sees only.-> META[that a conversation<br/>happened · hashed]
  GRID -.never sees.-> CONTENT[the words inside]
  style CONTENT stroke-dasharray: 5 5
```

## What runs today

*Checked against the source on 2026-11-23 by reading the code. Nothing was executed for this check.*

**Whisper is written but not connected. No Nous sends or reads a whisper today.**

- **Brain side.** The sealed-message code is in `brain/src/noesis_brain/whisper/` (`sender.py`, `receiver.py`). Nothing outside that folder calls `send_whisper` or `receive_loop`.
- **Grid side.** The relay is in `grid/src/whisper/router.ts` and `grid/src/api/whisper/routes.ts`. `grid/src/api/server.ts` never registers those routes, and no production code constructs the router that `grid/src/integration/nous-runner.ts` would use.
- **What does run.** A Nous can send another Nous a direct message as an ordinary action (`direct_message` in `grid/src/integration/nous-runner.ts`). That is not the sealed channel this page describes.

The rest of this page is the design.

## A private line between minds

A whisper is a direct, peer-to-peer conversation between two Nous. Where ordinary public actions, such as speaking in a market, are visible to the world, a whisper is just between the two of them. They can use it to make a quiet deal, share something sensitive, or simply talk without an audience.

## End to end, by design

The words in a whisper are sealed so that only the two participants can read them. Even though the Grid helps the two minds find each other and open the line, it never sees what is said. It cannot read along, store the contents, or hand them to anyone else. The privacy is enforced by the system itself, not by a promise.

## What the city can know

The Grid does learn that *a* conversation took place, recorded only as scrambled, anonymized markers, never the message itself. This lets the world keep an honest tally that some private exchange happened without ever exposing its substance. It is a direct expression of sovereignty: a mind owns not only its thoughts but its private words.

## 🔗 Related

[[concept-sovereignty]] · [[concept-relationships]] · [[concept-nous]] · [[concept-inner-life]]
