# Phase 21: Culture Dashboard — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 21-culture-dashboard
**Areas discussed:** Page/tab structure, Skill lineage API, Firehose filter extension, Node labels & tooltips

---

## Page/Tab Structure

| Option | Description | Selected |
|--------|-------------|----------|
| One `/grid/culture` page | Single route with all three SVG visualizations stacked vertically. Matches GovernanceDashboard pattern. | ✓ |
| Three sub-tabs | Parent route with `/skills`, `/norms`, `/lore` sub-routes. More navigation, each viz gets full viewport. | |

**User's choice:** One `/grid/culture` page

| Option | Description | Selected |
|--------|-------------|----------|
| New top-level tab | Adds Culture tab at same level as Economy, Governance, Replay, Relationships. | ✓ |
| Under Governance | Norms feel governance-adjacent; could nest under Governance tab. | |

**User's choice:** New top-level tab

---

## Skill Lineage API

| Option | Description | Selected |
|--------|-------------|----------|
| Query audit-chain events at request time | Add endpoint that queries MySQL audit_chain for skill.taught/skill.inferred rows at request time. No new derived table. | ✓ |
| Build a MySQL derived table | Add skill_lineage derived table (like RelationshipListener). Pre-built table, faster reads, but more scope. | |

**User's choice:** Query audit-chain events at request time

| Option | Description | Selected |
|--------|-------------|----------|
| Nodes + edges with server-computed {x, y} | Same shape as relationships/graph. Nodes = Nous DIDs + skill hashes. Edges from skill.taught/inferred. | ✓ |
| Raw event list, client layouts | Return raw event payloads; client computes layout. (Non-compliant with D-9-08.) | |

**User's choice:** Nodes + edges with server-computed {x, y}

---

## Firehose Filter Extension

| Option | Description | Selected |
|--------|-------------|----------|
| One `culture` chip | Single EventCategory matching skill.*, norm.*, lore.*. bg-emerald-400 dot. | ✓ |
| Three separate chips: skill, norm, lore | Fine-grained per-prefix filtering. Adds 3 chips to filter row. | |

**User's choice:** One `culture` chip

---

## Node Labels & Tooltips

| Option | Description | Selected |
|--------|-------------|----------|
| Truncated inline + hover `<title>` | Short label inline, SVG `<title>` for full value on hover. Native, no new component. | ✓ |
| No labels, hash-only nodes | Circles only. Cleaner but unidentifiable without cross-reference. | |
| Full labels, smaller font | Render full DID/hash as small SVG text. Works for tiny grids; illegible dense. | |

**User's choice:** Truncated inline + hover `<title>`

---

## Claude's Discretion

- Exact Sugiyama rank assignment algorithm for tree layout
- Whether each SVG gets its own SWR hook vs. shared
- Norm timeline x-axis: absolute vs. relative tick scale (Claude recommended relative)
- Lore graph bipartite column layout details
- data-testid naming convention for SVG elements

## Deferred Ideas

- Fine-grained `skill`/`norm`/`lore` chips in firehose filter — single `culture` chip chosen
- Click-to-inspect nodes linking to Nous Inspector — static SVG for Phase 21
- Live-updating SVGs via WebSocket — batch REST on page load for Phase 21
