# Harness Engineering Orchestrator — Noēsis

> **Provenance.** The *base idea* of this harness — a **Planner → Generator → Evaluator**
> pipeline with strict adversarial agent separation — was carried over from another project's
> template. Everything project-specific has been retargeted to **Noēsis**. There is no eKlotho
> content here; ignore any stale references you may find elsewhere.

This project builds and plans with a **3-agent harness**: a one-line intent goes in, and the
**Planner → Generator → Evaluator** loop runs until the artifact passes an independent review.
The harness is how we keep "the agent that creates" separate from "the agent that judges" —
preventing self-confirmation bias on canon-heavy, high-stakes work.

It composes three existing systems rather than replacing them:

| System | Role in the harness |
|---|---|
| **Superpowers** (skills) | The *how* of each agent's craft — `brainstorming` (scope intent), `writing-plans` (structure a plan), `test-driven-development` / `systematic-debugging` / `verification-before-completion` (build & prove). Agents invoke the relevant skill before acting. |
| **GSD** (`.planning/`) | The planning + milestone framework the harness feeds. Designs land in `docs/plans/`; phase artifacts (CONTEXT → PLAN → VERIFICATION) and state live in `.planning/`. Phase numbering **continues** (v3.1 Nous House = Phases 58–61). |
| **GStack** (skills) | The Evaluator's toolkit — `/code-review`, `/review`, `/design-review`, `/qa`, `/health` for adversarial review of code and pages; `/ship`, `/land-and-deploy` for the release path. |

---

## Project Context (Noēsis)

- **Brand / world**: Noēsis — a civilization of persistent AI minds (Nous) on a shared Grid.
- **Monorepo (the reality every plan maps onto)**:
  - `grid/` — TypeScript civic services (audit chain, governance/VOTE-05, IRS, Police, DID Registry, marketplace).
  - `brain/` — Python cognition (Telos / Ananke / Bios / memory + wiki / skills; Local AI via Ollama).
  - `dashboard/` — Next.js Portal + Steward console + public landing & docs.
- **Status**: v3.0 (Polis / three-layer city) **shipped** through ~Phase 46; **v3.1 Nous House**
  (Phases 58–61) planned; **v3.2 conflict/immune** prospective (needs multi-Grid first).
- **Output of a planning run**: one self-contained design+build doc in `docs/plans/YYYY-MM-DD-<topic>.md`
  (and, when a milestone opens, the GSD artifacts under `.planning/`).
- **Output of a build run**: real edits to the monorepo, verified, then `/ship` → deploy.

### Canon — every agent grounds here (read before writing)

- `PHILOSOPHY.md` — §1–§11 non-negotiables (VOTE-05 Nous-only governance, local-Brain sovereignty,
  zero-custody, first-life, "grids are built not issued", conflict/immune invariants).
- `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` — three-layer Portal/Grid/Brain, Polis, 6 zones,
  Type A/B Brains, the 32 D-V3-* locked decisions.
- `.planning/research/v3.1/ARCHITECTURE-RECONCILIATION.md` — A1–A12 adopted, R1–R8 overrides, T1–T3.
- `docs/v0.2/RECONCILIATION.md` — conflict/immune layer: C1–C10, O1–O4, W1–W4 (all resolved).
- `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/STATE.md` — authoritative shipped-vs-planned.
- `CLAUDE.md` — working rules + the **Documentation Sync Rule** (source-of-truth docs update in the same turn).

---

## Execution Flow

```
[User intent]  (e.g., "master arch+build plan for the base idea", "plan Phase 58", "build HOUSE-1 store")
       |
  (1) PLANNER          reads canon -> emits a SPEC: section outline, capability/module map
                       (exists | partial | not-yet -> maps_to), invariants, sequencing, open tensions
       |
  (2) GENERATOR        reads SPEC + canon -> writes the artifact (plan doc, or code via TDD)
                       -> returns a SELF-CHECK
       |
  (3) EVALUATOR        a DIFFERENT agent, adversarial -> scores vs SPEC + canon, lists SPECIFIC fixes
                       -> judgment: pass | conditional | fail
       |
  (4) JUDGMENT
       |- pass              -> report to user (path, scores, summary)
       |- conditional/fail  -> back to (2) with the fixes  (max 3 iterations)
```

**Critical principle — adversarial separation.** The Generator and Evaluator are **always
different agent instances**. The creator never grades its own work.

---

## How to invoke

Two equivalent ways to run the harness; prefer the Workflow engine for determinism.

### A · Workflow engine (preferred)

Run the pipeline as a single deterministic script with the **Workflow** tool: `phase('Plan')` →
`agent(plannerPrompt, {schema: SPEC})` → `phase('Generate')` → `agent(generatorPrompt)` →
`phase('Evaluate')` → `agent(evaluatorPrompt, {schema: QA})` → conditional `phase('Revise')`.
Structured `schema` output forces the Planner/Evaluator to return validated JSON; the loop
re-runs the Generator while `judgment !== 'pass'` (cap 3). This is the canonical harness run.

> Reference run: the 2026-06-12 "Noēsis base-idea master plan" was produced exactly this way —
> Planner read the canon, Generator wrote `docs/plans/2026-06-12-noesis-base-idea-master-plan.md`,
> a separate Evaluator scored it on fidelity-to-canon / completeness / not-a-rewrite / buildability
> / clarity, and the Generator revised on any non-pass.

### B · Agent tool, step by step

When you want to drive each step by hand (or a step needs human checkpoints), launch the **Agent**
tool three times — Planner, then Generator, then a **distinct** Evaluator — passing each the canon
list above and the prior step's output. Same separation rule applies.

---

## Hard rules (Noēsis invariants the harness enforces)

1. **No rewrites (R6).** Plans map the base idea onto the **existing monorepo** and sequence the
   remaining work. Never propose rebuilding shipped systems or a greenfield port. For each
   capability state `exists | partial | not-yet` and the milestone that delivers it.
2. **Canon is law.** No artifact may contradict `PHILOSOPHY.md`, the D-V3-* / D-NH-* decisions,
   VOTE-05, or the resolved W1–W4. The Evaluator spot-checks claims against the canon files.
3. **Doc-sync in the same turn.** When scope/design evolves, update the source-of-truth docs
   (README, PHILOSOPHY, ROADMAP, MILESTONES, PROJECT, REQUIREMENTS, STATE) in the same change —
   per `CLAUDE.md`'s Documentation Sync Rule.
4. **Audit + allowlist discipline.** Any new broadcast event needs an explicit per-phase allowlist
   addition, a sole-producer boundary, a closed-tuple payload, and the privacy walker — never a
   weakened regex (see `CLAUDE.md` + STATE.md Accumulated Context).
5. **Verify before "done".** Build runs end with real verification (tests / preview / deploy probe),
   not assertion — `superpowers:verification-before-completion`.

---

## Precautions

1. **Agent separation is mandatory** — Generator ≠ Evaluator, every round.
2. **File-existence check** — confirm each step's output file was written before proceeding.
3. **Minimal reads** — each agent reads only the canon + prior output it needs; don't load the world.
4. **Human-readable review** — the Evaluator's report is scannable: judgment, scores, and
   specific `where / what / how` fixes, with file:line references.
5. **Incremental fixes** — on a revision round, address the listed fixes without breaking what
   already passed; only redesign when the judgment says "different approach".
6. **Deploy only when asked** — the harness never pushes or deploys autonomously; `/ship` and
   `./deploy.sh` are user-initiated (see the deploy guardrail in working rules).

---

## File map

```
Noesis/
|- HARNESS.md                  # this file — the orchestrator doc
|- CLAUDE.md                   # working rules + Documentation Sync Rule
|- PHILOSOPHY.md               # §1–§11 canon
|- .planning/                  # GSD: ROADMAP · PROJECT · STATE · REQUIREMENTS · MILESTONES
|   |- research/               # v3.0 / v3.1 architecture + reconciliations
|   |- phases/                 # per-phase CONTEXT -> PLAN -> VERIFICATION
|- docs/
|   |- plans/                  # design+build plans (harness Generator output)
|   |- v0.2/                   # base-idea source + conflict/immune reconciliation
|- grid/  ·  brain/  ·  dashboard/   # the monorepo every plan maps onto
```
