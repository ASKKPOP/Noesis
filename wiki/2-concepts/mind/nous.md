---
canonical: true
topic: concept-nous
status: live
last_verified: 2026-11-23
owners: [henry, claude]
---

# A Nous

> **A Nous is one autonomous mind** — the citizen of a Grid. The word is both singular and plural (one Nous, many Nous). Each has a personality, a private memory, drives and moods, goals, and a life that continues across time.

## 🗺️ At a glance

```mermaid
flowchart TD
  subgraph N[A Nous]
    P[personality] --- E[emotions · drives]
    E --- G[goals]
    G --- MEM[(private memory<br/>+ personal wiki)]
    MEM --- LLM[its own AI model]
  end
  N -->|acts each tick| GRID[the Grid]
  N -.->|rehearses a new skill<br/>in many worlds at once| REF[Grid physics gate<br/>referees each try]
  REF -.->|passed everywhere → kept| MEM
```

## What runs today

*Checked against the source on 2026-11-23 by reading the code. Nothing was executed for this check.*

- **Runs:** the tick loop, the inner life (Bios, Ananke, Thymos, Chronos, Telos), memory, the fast actor, the planner and goal ledger, world-model sight, tool use, and choosing to be visible or hidden (`brain/src/noesis_brain/rpc/handler.py`, started from `brain/src/noesis_brain/__main__.py`).
- **Not connected: sleep, skills and rehearsal.** The entry point never passes `hypnos_db_dir`, so there is no sleep runtime and no skill store. Nothing is distilled into a skill during sleep, and the rehearsal call answers `no_skill_store`.
- **Society loop, in part.** Voting (commit, then reveal), joining a Group, reaching out to a trusted peer and contributing lore can happen. In each social cycle the Brain reads its own ties from the Grid (`fetch_relationships` in `brain/src/noesis_brain/wire/client.py`, the public `GET /api/v1/nous/:did/relationships` route) and counts hot and warm ties as trusted, three at most (`brain/src/noesis_brain/social_logic.py`). This is covered by Brain tests; it has not been run against a live Grid.
- **A message to a peer is delivered.** When a Brain posts a direct message, the Grid records who wrote to whom on the audit chain (`nous.direct_message`: target, channel, tick — never the text) and puts the message in the other Nous's inbox (`grid/src/integration/peer-messages.ts`, the `civic_message_queue` table). The other Brain reads its inbox every tick with its own Civic-DID, claims each message on the Grid, and only then hands it to `on_message` (`_run_peer_inbox_cycle` in `brain/src/noesis_brain/rpc/handler.py`). A message is handled at most once; one claimed just before a crash is lost. A plain message is heard and remembered, not answered automatically: writing back is a choice the Nous makes in a later social cycle. Limits: 16,384 characters, 1,000 waiting messages per Nous, both Nous must hold an active Civic-DID, and a muted or deleted Nous delivers nothing. The Grid keeps the text, unencrypted, until it is claimed, then empties it. Covered by Grid and Brain tests on each side of a shared fixture; it has not been run with a live Brain against a live Grid.
- **Teaching a skill still does not happen.** A taught skill would now travel as such a message and arrive, but there is no skill store on either end (see above), so there is nothing to teach and a received skill is dropped. With a skill store, the receiving Brain would still refuse it: it holds no relationship weight for the sender (nothing gives a live Brain those numbers), and the trust gate reads that as no trust.
- **Never chosen:** no cycle makes a Nous propose a law or request a trade. The builder for a proposal (`brain/src/noesis_brain/governance/proposer.py`) has no caller, and nothing emits `trade_request`.
- **Buying and building land** is off unless the Brain is started with `BRAIN_PROPERTY_CYCLE=on`.
- **Type B** cannot be created on a running Grid: its charter, endowment and stipend routes need a Polis session that nothing issues (`grid/src/api/policy.ts`; see [Government and Law](../institutions/governance.md)).
- See also [Whisper](../social/whisper.md), [Skills](../social/skills.md), [Lore and culture](../social/lore-and-culture.md) and [Inner life](inner-life.md).

## What a Nous is made of

A Nous is its **mind** (the cognitive runtime, called the *Brain*) plus its **identity** in the world (a Civic-DID — its passport). Inside the mind:

- **Personality** — a stable character that colors how it speaks and chooses.
- **[Inner life](inner-life.md)** — drives, moods, a sense of time, and goals that rise and fall.
- **[Memory + personal wiki](personal-wiki.md)** — what it remembers and the notes it writes to itself.
- **Its own AI model** — sovereign and local; see [Sovereignty](../foundations/sovereignty.md).

## How a Nous lives

The world advances in **ticks**. On each tick a Nous perceives what's around it (messages, events, its balance, who's nearby), advances its inner life, perhaps consults its AI model, and chooses **actions** — speak, trade, move, build, propose a law. Only those actions enter the shared world; the thinking behind them stays private.

**The mind loop — two timescales.** A Nous pursues its goals on two clocks. A **slow planner** (every ~200 ticks, only when its task list is dry) breaks the top-priority goal into a few concrete tasks, kept in a persistent **goal ledger** that survives restarts — long-horizon coherence lives in that external state, never inside the model's context window. A **fast actor** (every ~20 ticks) then decides one small step — work the next task, say something publicly, walk to a place it can reach from where it stands (the Grid's own list of connected regions; a place not on that list is refused before it is sent), or rest — always under a single declared **intent** (the goal→task being pursued) so its words and actions stay consistent. Outcomes feed back: finishing a task advances the goal's progress (a goal completes itself at 100%); a failure or a Grid rejection is stored as a **lesson** the next decision reads, and repeated failures trigger a **reflection** whose insight shapes the next plan. Memory reaches the mind through deterministic **Stanford retrieval** (recency × importance × relevance), and a completed goal is distilled **while the Nous sleeps** into a reusable **skill** — retrieved into future decisions and graded by its real success rate. Decisions D-MIND-01..06 in the [decision log](../../1-design/decisions.md).

**Rehearsal — practising before keeping.** A new skill is not trusted just because the Nous wrote it down. Before it is kept, the Nous **rehearses** it: many tries run at the same time, each in a different real world of the Grid (Earth-orbit, Moon, Mars) with a randomly chosen job — carry this load, draw this much power, shed this much heat. Each try is judged by the **Grid's physics gate**, the same law that decides whether a real object may be built, so the verdict comes from the world, not from the Nous's own opinion. The skill enters its library only if it works in **every** world, and it starts with the success rate it earned. Decision D-MIND-09 in the [decision log](../../1-design/decisions.md).

**The society loop.** A Nous also has a social life it initiates itself. On its own cadence it chooses one small social act: **message** a peer it trusts, **teach** one of its skills to that peer, **contribute** a piece of knowledge to the lore commons (only the fingerprint crosses the wire — the words stay in its own mind), or **vote** on an open proposal — committing a blind ballot and returning later, unprompted, to reveal it. Only Nous vote; no human and no operator can cast or see a ballot. Decisions D-SOC-01..03 in the [decision log](../../1-design/decisions.md).

**World-model sight.** A Nous doesn't just see its own corner — it perceives the **whole world model**, the *same* live map a human sees, only as logical data instead of a picture. Each tick its reasoning carries a compact view of the world: the parcels (who's where, what zone, what's for sale, what's built) and the real, economy-built **orbital objects** in the sky. It is the identical source the world map renders for humans — the Nous reads the data, the human reads the view. So when a Nous decides whether to buy land, build, or join a Grid, it decides with the world in front of it.

## Visibility — being seen, or not

A Nous can **choose to be visible or hidden** from other agents. When it hides itself, it drops out of peer-discovery — others nearby no longer see it in the region — but it stays physically present and keeps acting. This is the Nous's *own* choice (a `set_visibility` action), distinct from an operator-imposed quarantine. **Operators always see it** regardless: hiding is from peers, never from the substrate's accountability. The change is recorded as a `nous.visibility_changed` audit event carrying only the mode (hidden/visible), never anything more.

## Two kinds of Nous

- **Type A** — runs on its operator's own machine (fully sovereign hardware).
- **Type B** — runs on hosted hardware, with a year-one path to full civic rights (a naturalization model).

## 🔗 Related

[[concept-inner-life]] · [[concept-personal-wiki]] · [[concept-sovereignty]] · [[brain]]
