---
canonical: true
topic: wiki-protocol
status: live
last_verified: 2026-06-14
owners: [henry, claude]
---

# Wiki Protocol — Follow & Update

> **The wiki only stays trustworthy if it is read first and updated every task.** This page is the contract for both Henry and Claude.

## 🗺️ At a glance

```mermaid
flowchart TD
  A[Task starts] --> B[Read wiki/index.md<br/>find the canonical doc]
  B --> C[Do the work]
  C --> D[Update canonical page<br/>+ At-a-glance diagram<br/>+ last_verified date]
  D --> E{check-wiki.mjs passes?}
  E -- no --> D
  E -- yes --> F[Commit work + wiki together]
  F --> G([Task DONE])
  C -. wiki not updated .-> X[/❌ task NOT done/]
```

## The loop (mandatory)

1. **Read-first.** Open [`wiki/index.md`](index.md) at the start of every session/task to locate the canonical doc for what you're touching.
2. **Do the work.**
3. **Update-after.** Update the canonical page(s) the change affects — body **and** the `## At a glance` diagram — and bump `last_verified`. This is the [Documentation Sync Rule](../CLAUDE.md) made mechanical.
4. **Same commit.** Wiki edits ship in the **same commit** as the work they describe.
5. **Completion gate (requirement).** A task is **not complete**, and must not be claimed complete, until the wiki reflects it.

## Page invariants (CI: `scripts/check-wiki.mjs`)

| # | Rule | Decision |
|---|------|----------|
| 1 | Every page has front-matter with `status` | D-WIKI-04 |
| 2 | Every `live`/`draft` page has an `## At a glance` Mermaid diagram | D-WIKI-05 |
| 3 | At most **one** `canonical: true` page per `topic` | D-WIKI-04 |
| 4 | A `superseded` page is a stub with a `moved_to:` pointer, no body | D-WIKI-03 |

> The gate runs `scripts/wiki.sh check`. It is **advisory** during migration (`ENFORCED=false`) and flips to **blocking** at migration Step 6.

## Front-matter schema

```yaml
---
canonical: true              # this IS the source of truth for its topic
topic: civic-architecture    # the unique topic key (one canonical per topic)
supersedes: [planning/ARCHITECTURE.md]   # old paths now redirecting here
status: live                 # live | draft | superseded | archived
last_verified: 2026-06-14
owners: [henry, claude]
---
```

## Page template

Copy this for any new page:

```markdown
---
canonical: true
topic: <key>
status: live
last_verified: 2026-06-14
owners: [henry, claude]
---
# <Title>
> One-line purpose.
## 🗺️ At a glance
```mermaid
flowchart LR
  Portal --> Grid --> Brain
```
## Details
...
## 🔗 Related
[[architecture]] · [[decisions]]
```
