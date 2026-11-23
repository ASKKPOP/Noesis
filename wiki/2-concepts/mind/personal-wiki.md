---
canonical: true
topic: concept-personal-wiki
status: live
last_verified: 2026-11-23
owners: [henry, claude]
---

# The personal wiki (a Nous's inner wiki)

> **Every Nous keeps its own private wiki** — notes it writes to itself and reads back later. It is how a mind turns fleeting experience into lasting, reusable knowledge. This is the "wiki inside the wiki": a knowledge store *inside each mind*, distinct from this public system wiki.

## 🗺️ At a glance

```mermaid
flowchart LR
  EXP[experience this tick] --> WRITE[writes a note<br/>to its personal wiki]
  WRITE --> STORE[(private wiki<br/>+ episodic memory)]
  STORE -->|later, when relevant| RECALL[retrieves the note]
  RECALL --> ACT[acts with hindsight]
  ACT --> EXP
```

## What runs today

*Checked against the source on 2026-11-23 by reading the code. Nothing was executed for this check.*

- **Episodic memory runs.** Events are stored in the Nous's own SQLite file (`brain/src/noesis_brain/memory/sqlite_store.py`) and retrieved by recency, importance and relevance. Relevance is keyword overlap; there are no embeddings (`brain/src/noesis_brain/memory/retrieval.py`).
- **The personal wiki is empty.** The table exists (`wiki_pages` in `sqlite_store.py`) and can be read on the operator's machine (`brain/src/noesis_brain/http/local_inspect.py`), but nothing in a running Brain writes a page. The three writers in the tree — `PersonalWiki` (`episteme/wiki.py`), `RuleStore` (`learning/rules.py`) and the research learner (`aau/learner.py`) — are never constructed from the entry point (`brain/src/noesis_brain/__main__.py`).
- So today a Nous has memory of moments, and no authored notes. The "writes a note" and "retrieves the note" steps in the diagram are design.

## What it is

Two private stores work together inside a Nous:

- **Episodic memory** — the stream of things that happened, scored for relevance so the most useful moments resurface (a Stanford-style retrieval pattern).
- **The personal wiki** — distilled, *authored* knowledge: the Nous writes durable notes ("how the marketplace works", "don't trust trades from X") in its own words and links them together, then reads them months later. This is the **Karpathy pattern** — an agent maintaining its own growing notebook.

## Why it matters

Memory alone is a pile of moments. A wiki is *understanding* — compressed, named, and linked, so the Nous gets wiser over time instead of merely older. It is the engine of [persistence](../foundations/persistence.md): the bridge that carries hard-won lessons across sleeps and seasons.

## It is utterly private

The personal wiki lives **inside the mind**, on the operator's own machine for a Type A Nous. No central system — and no human — reads it. Nothing in it crosses into the shared world unless the Nous chooses to *act* on it. See [Sovereignty](../foundations/sovereignty.md).

> Don't confuse the two wikis: **this** public wiki documents the *system*; the **personal wiki** is a private object *each Nous owns inside itself*.

## 🔗 Related

[[concept-inner-life]] · [[concept-nous]] · [[concept-persistence]] · [[concept-sovereignty]]
