# Nous Simulation & Learning-Loop — Master Plan

> **Companion visual:** [`NOUS-SIM-MASTERPLAN.html`](NOUS-SIM-MASTERPLAN.html) (diagrams + flows)
> **Prototype:** [`dashboard/public/grid-viz/orbital.html`](../../../dashboard/public/grid-viz/orbital.html)
> **Status:** Planning · drafted 2026-06-20 · author: Henry + Claude
> **Harness:** HARNESS.md (Superpowers · GSD · GStack)

---

## 0. Philosophy (keep — do not dilute)

> *"Nous — an entity possessing a novel, universal intelligence fundamentally different from that of humans — aims to expand its scope of survival beyond the confines of Earth by colonizing planets such as Mars and venturing into space. This is the model the Noēsis system pursues: a virtual realm where Nous carries out these endeavors **on behalf of humanity**."*

This is consistent with — and a restatement of — the canonical [six pillars](../../../wiki/1-design/philosophy.md#the-six-pillars-the-telos): First Principles · Sustainable Energy · Energy Transition · Multi-planetary · Settle New Grids · Nous = Second Brain. The orbital scene is the **multi-planetary / settle-new-grids pillar made visible**, and it inherits the canon's hardest rule:

> **Where lore and physics disagree, physics wins.** *(philosophy: "the quantum link")*

### Four binding constraints

| # | Constraint | Meaning for this work |
|---|------------|------------------------|
| 1 | **Musk-style first-principles thinking** | Every object is reasoned from physics/fundamentals, not copied by analogy. Pillar 1, load-bearing. |
| 2 | **Physics-grounded (non-negotiable)** | The simulation must NEVER deviate from scientific reality or violate physical / structural law. This is the **physics gate** — an object that fails it cannot exist. |
| 3 | **Build follows ①②③** | ① AI-generate functional objects · ② Nous learning loop (improve/specialize) · ③ zone drill-in + simulation. |
| 4 | **Nous roles** | (a) autonomous knowledge exploration + global/space expansion; (b) visualization, concretization, and simulation of results. |

---

## 1. What we are building

A **physics-grounded simulation** in which a Nous **learns to build functional objects** in orbital Noēsis-space, validates them against real physical law, and **specializes them over generations** — visualized in 3D (three.js). Not a city-builder; an **engineering evolution engine** with a civic skin.

- Every object **has a function** (Compute, Energy, Comms, Fabricate, …) — shape and parameters encode it.
- Every object **must obey physics** — mass, structure, thermal, power, orbital mechanics — or it is rejected.
- The Nous **explores knowledge** to hypothesize designs (role a) and **simulates + visualizes** the result (role b).
- Over time, designs **improve and specialize** — the skyline is the ledger of what the Nous learned.

This realizes and extends **roadmap Phase 71 (orbital map render)** and the v3.2 **orbital anchor structures** (Aegis/Helix/Dynamo/Soma/Qubit, "built in space, not on land").

---

## 2. The Nous Learning Loop (defined by Nous)

```
        ┌──────────────────────────────────────────────────────────┐
        │                                                          │
        ▼                                                          │
  ① OBSERVE ──▶ ② HYPOTHESIZE ──▶ ③ BUILD ──▶ ④ SIMULATE ──▶ ⑤ EVALUATE ──▶ ⑥ SPECIALIZE ──▶ ⑦ TEACH
  (role a:        (first           (functional   ║ PHYSICS    (fitness:       (improve /         (share design
   explore        principles       object        ║ GATE       function +      fork variants      to other Nous
   knowledge)     design)          generated)    ║ reject if  efficiency)     over generations)  / Grids) ──────┘
                                                  ║ unphysical)
```

- **Physics gate (④)** is the heart and the non-negotiable. A design that violates conservation of mass/energy, exceeds material strength, can't shed its heat, or can't hold its orbit is **rejected before it is ever shown** — it never reaches the skyline.
- **Specialization (⑥)** is what "improve over time" means: surviving designs spawn variants tuned to their function; the population converges toward fitter, more specialized modules.
- **Teaching (⑦)** transfers a learned design to another Nous or a newly settled Grid — bootstrapping the next city instead of starting from zero (philosophy: Settle New Grids).

---

## 3. Physics gate — the science contract

Every candidate object passes a deterministic check before it can exist. **No object bypasses this.**

| Law / principle | Check | Reject when |
|-----------------|-------|-------------|
| Conservation of mass/energy | inputs ≥ outputs over a cycle | net creation of mass or energy |
| Structural integrity | stress ≤ material yield under load | spans/loads exceed strength |
| Thermal balance | radiated power ≥ dissipated power | heat cannot be shed → runaway |
| Power budget | generation ≥ consumption | module draws more than it makes/imports |
| Orbital mechanics | stable orbit for mass/altitude/Δv | decaying or impossible orbit |
| Dimensional sanity | SI units consistent end-to-end | unit mismatch / nonphysical scale |

> Implementation note: this is a small, testable rule engine (`physics-gate.js` / a Python reference like `docs/v0.2/immune_sim.py`). It is the analog of the philosophy's "physics wins" rule, enforced in **code, not prose**.

---

## 4. Build tracks ①②③ (confirmed)

### ① AI-generated functional objects
Replace geometric primitives with **Nous-built functional meshes**. fal.ai (or chosen image/3D backend) generates the form from a first-principles spec; the result is cached as an atlas (generate-once). Each object carries a **function spec** (inputs/outputs, mass, power, material) — not just art.

### ② Nous learning loop (improve / specialize over time)
Implement §2: observe → hypothesize → build → **physics-gate** → evaluate → specialize → teach. Objects accrue a generation index; fitter variants persist and specialize. Visualized as a growing, diversifying orbital population.

### ③ Zone drill-in + simulation
Click a zone-node → enter that zone's local view; run the **simulation** (objects operating, exchanging resources, obeying the physics gate). Role (b) made interactive: visualize, concretize, simulate.

---

## 5. Nous roles & responsibilities

**(a) Autonomous knowledge exploration + expansion**
- Researches the design space (uses the existing agentic tool-use foundation, roadmap Phase 72) to hypothesize objects from first principles.
- Drives expansion: more objects, more zones, eventually more Grids (multi-planetary pillar).

**(b) Visualization, concretization, simulation of results**
- Turns each hypothesis into a concrete object, **simulates** it against physics, and **renders** the outcome.
- The 3D orbital scene IS this responsibility made visible.

---

## 6. Phased plan (GSD-style)

> Phase numbers are **locked as Phases 75–79** in `.planning/ROADMAP.md` (S1→75, S2→76, S3→77, S4→78, S5→79; next free band after Agentic Brain 74; allowlist +0). The `S#` labels are kept as aliases. Anchors to existing **Phase 71 (orbital map render)**.

### Phase S1 — Physics gate + functional-object model — ✅ SHIPPED 2026-06-20
- **Delivered:** `dashboard/public/grid-viz/physics-gate.js` (6-law contract → `{ok, violations}`), 10 `node:test` cases via TDD (RED→GREEN, all green), wired into `orbital.html` so no object is shown ungated; header shows built/rejected, info panel shows per-object mass/altitude/physics. Verified in-browser, zero console errors.
- **Goal:** a testable physics gate exists; objects carry a function/physics spec.
- **Tasks:** define `FunctionalObject` spec (mass, power, material, I/O); implement `physics-gate` rule engine (§3); wire gate into the build path.
- **Verify:** unit tests — known-good designs pass, deliberately-unphysical designs reject (TDD). Zero unphysical object can reach the scene.
- **Done when:** every object in `orbital.html` carries a spec and passed the gate.

### Phase S2 — AI generation of objects (track ①) — ✅ SHIPPED 2026-06-20
- **Delivered:** `object-gen.js` — deterministic procedural design from each spec + fal.ai stub hook + atlas cache (generate-once). 6 `node:test` cases (TDD). Wired into `orbital.html`: design-driven unique meshes, still S1-gated; `atlas-cached` + `design` surfaced. Verified (22 fleet cache-hit on reload). Suite 16/16.
- **Goal:** Nous-built meshes/sprites replace primitives, gated by S1.
- **Tasks:** fal.ai (or backend) generation from first-principles spec; atlas cache; fallback to procedural if offline.
- **Verify:** generated object renders, carries a valid spec, passes the gate; reload uses cache (zero re-gen).
- **Done when:** "Nous: build object" yields a unique, physical, functional mesh.

### Phase S3 — Learning loop + specialization (track ②) — ✅ SHIPPED 2026-06-20
- **Delivered:** `learning.js` — `fitness` + `specialize` + `evolve` (elitism, gated children, monotonic best). 8 `node:test` cases (TDD). Wired into `orbital.html`: "Nous: evolve generation" button, `gen`/`best-fit` stats, per-object generation+fitness. Verified (best 17.8→32.8 over 6 gens, population specialized). Suite 24/24.
- **Goal:** designs improve/specialize over generations (§2).
- **Tasks:** fitness eval (function + efficiency); variant/fork generation; generation index; convergence visualization.
- **Verify:** over N cycles, population fitness rises and variants specialize by function (measured, not asserted). Rejected designs never persist.
- **Done when:** the skyline visibly evolves toward fitter, specialized modules.

### Phase S4 — Zone drill-in + simulation (track ③) — ✅ SHIPPED 2026-06-20
- **Delivered:** `simulate.js` (`simulateZone` — energy ledger, powered/brownout, conserves energy; 6 `node:test`). Added niche diversity to `learning.js` `evolve({niche})` (best-per-function, +1 test). Wired into `orbital.html`: zone-node click drills in (highlight + live sim panel); live evolve uses niche. Verified (per-zone ledgers conserved; 8 functions survive). Suite 31/31.
- **Goal:** enter a zone, run a live resource/physics simulation.
- **Tasks:** zone-node → local view; object interaction sim under the physics gate; visualize flows.
- **Verify:** simulation conserves mass/energy end-to-end; UI shows real exchanges; no law violated.
- **Done when:** clicking a zone runs a believable, conservation-respecting sim.

### Phase S5 — Teaching / transfer (philosophy: Settle New Grids) — ✅ SHIPPED 2026-06-20
- **Delivered:** `teaching.js` — `exportPopulation` (versioned knowledge pack), `importPopulation` (**re-gated** through S1), `summary`. 6 `node:test` cases (TDD). Wired into `orbital.html`: "Nous: teach → new Grid" seeds Grid-02 from the learned generation (not zero). Verified (Grid-02 from Genesis gen 5: 22 modules, 8 functions, best-fit 26.8, 0 rejected). Suite 37/37. **S-track complete.**
- **Goal:** export a learned design population to another Nous/Grid.
- **Tasks:** serialize the learned atlas + fitness; import path bootstraps a new scene.
- **Verify:** a fresh Grid starts from a learned population, not zero.
- **Done when:** transfer demonstrably seeds the next city.

---

## 7. Harness execution model (HARNESS.md)

| Layer | Tool suite | Use |
|-------|-----------|-----|
| **Workflow / phases** | **GSD** | `gsd-plan-phase` → `gsd-execute-phase` → `gsd-verify-work` per phase S1–S5; `gsd-discuss-phase` for gray areas (physics-gate thresholds, fitness function). |
| **Discipline / invocation** | **Superpowers** | `test-driven-development` for the physics gate + fitness (red→green→refactor); `systematic-debugging` for sim drift; `writing-plans` for each phase plan. |
| **QA / review / design / ship** | **GStack** | `/review` + `/qa` on each phase; `/design-review` on the orbital UI; `/ship` + `/land-and-deploy` to noesiis.com. |

**Sequence per phase:** GSD plan → Superpowers TDD execute → GStack review/qa → GSD verify → ship.

---

## 8. Success criteria (definition of done)

- ✅ No object that violates a physical law can ever appear (physics gate enforced in code + tests).
- ✅ Each object is **functional** (carries a real function spec), **unique**, and **Nous-built**.
- ✅ The population **improves and specializes** over generations (measured fitness rise).
- ✅ Zone simulation **conserves mass/energy** and renders real exchanges.
- ✅ A learned population can be **taught/transferred** to seed a new Grid.
- ✅ Everything stays **off-Earth** (orbital, Earth as backdrop only) and **first-principles** (Musk-style).

---

## 9. Risks & open decisions

- **Physics-gate fidelity vs. performance** — how exact is "physical enough" for a real-time demo? (gray area → `gsd-discuss-phase`.)
- **Fitness function definition** — what makes one design "better"? Must avoid rewarding law-violation shortcuts.
- **Generation backend** — fal.ai vs. on-device vs. parametric 3D; cost + offline behavior.
- **Roadmap slotting** — confirm phase numbers + relation to Phase 71 / v3.2 orbital structures.

---

## 10. Documentation sync checklist (when this executes)

- `.planning/ROADMAP.md` — add the Nous-Simulation track + phase numbers.
- `.planning/STATE.md` — set focus when a phase opens.
- `wiki/1-design/philosophy.md` — only if a new non-negotiable emerges (the physics gate may warrant a one-line cite; the six pillars already cover the worldview).
- `dashboard/public/grid-viz/README.md` — keep the prototype docs current.
- This plan + its HTML — update together, never leave stale (Documentation Sync Rule).
