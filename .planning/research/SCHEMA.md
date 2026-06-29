# Research Vault — Schema (LLM-Wiki convention)

This folder (`.planning/research/`) is an **LLM-maintained wiki** in the style of
Karpathy's [LLM-wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):
the LLM incrementally builds and maintains a structured, interlinked collection of
markdown over our raw research sources, so knowledge **compounds** instead of being
re-derived each session.

It lives on the **private** documentation tree (`.planning/`, never served — see
`CLAUDE.md` two-tree rule, D-WIKI-06). System-truths discovered here are distilled
*up* into the public `wiki/`; the debate, sequencing, and source notes stay here.

## Three layers

| Layer | Lives in | Owned by |
|---|---|---|
| **Raw sources** (immutable) | the research `*.md` / `*.html` docs themselves | human curates |
| **The wiki** (interlinked synthesis) | `index.md` + entity/concept pages + `[[wikilinks]]` | the LLM |
| **The schema** (this file) | `SCHEMA.md` | human + LLM |

## Conventions

- **Links:** use Obsidian `[[wikilinks]]`. Filenames collide across milestone
  folders (`ARCHITECTURE.md` exists in root, `v2.2/`, `v2.4/`), so **path-qualify**
  when ambiguous: `[[v2.4/ARCHITECTURE|v2.4 Architecture]]`.
- **`index.md`** is the content catalog: every page linked once, with a one-line
  summary, grouped by milestone. Update it whenever a page is added or retitled.
- **`log.md`** is append-only and chronological. One line per ingest/synthesis/lint
  action, newest at the bottom, parseable prefix: `## [YYYY-MM-DD] action | title`.
- **Frontmatter** (optional but encouraged on new synthesis pages):
  `---\nmilestone: v3.0\nsources: N\ntags: [civic, did]\n---`
- **No `[[wikilinks]]` leak into `wiki/`** — that tree is MkDocs and uses
  `[text](path.md)` links. This convention is private-tree only.

## Workflow

1. **Ingest** — drop a source, the LLM reads it, writes/updates a synthesis page,
   updates `index.md`, refreshes cross-linked entity pages, appends to `log.md`.
2. **Query** — ask a question; the LLM searches these pages and answers with
   `[[page]]` citations; worthwhile findings get filed back as new pages.
3. **Lint** — run `node scripts/lint-research-wiki.mjs` to surface orphans (pages
   not in `index.md`), broken wikilinks, and uncatalogued files.
