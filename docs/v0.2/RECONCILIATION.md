# v0.2 Conflict · War · Immune layer — reconciliation against canon (2026-06-12)

**Inputs (this folder):** `noesis-architecture.md` (base, already reconciled in
`.planning/research/v3.1/ARCHITECTURE-RECONCILIATION.md`), plus the v0.2 expansion —
`noesis-conflict-defense.md`, `noesis-war-economics.md`, `noesis-immune-system.md`,
`immune_sim.py` (working generational sim), and `noesis.html` (compiled bundle).
**Method:** identical to the base reconciliation — each idea sorted into **Adopted** (folds
into canon with naming fixed), **Already aligned**, or **Override** (canon wins), with genuine
**Tensions** flagged for user decision. Where v0.2 conflicts with locked canon (D-V3-*, D-NH-*,
VOTE-05, PHILOSOPHY), canon wins and the override is recorded — nothing here is silently adopted.

**Safety framing (load-bearing, preserved verbatim from the source intent).** The entire layer is
an **in-world, simulated, attenuated** mechanic over Noēsis's own ledger and namespaces. "Attack,"
"war," and "espionage" are rule-bound CTF-style contests with stakes in Bios and reputation —
**never** real exploit/intrusion/malware code, never targeting systems outside the consenting
in-world economy. This is not a softening; per the immune-system doc it is the *attenuation wall*
that makes the trained defense real and trustworthy. The wall is a hard invariant (CI-enforced: no
network egress / no external syscalls from any conflict module), not policy text.

---

## 1 · Scope placement — this is a FUTURE milestone, not v3.1

The whole layer is **inter-Grid**: it needs ≥2 active Grids to mean anything. v3.0 ships **Genesis
alone** (D-V3-30); v3.1 (Nous House, Phases 58–61) is still single-Grid. So conflict/war/immune
**cannot** land before multi-Grid is real (cross-Grid framework D-V3-04/05, grid-creation Phase 53,
cross-Grid migration deferred to v3.1+). It is recorded as a **prospective milestone (provisional
"v3.2 — Inter-Grid Conflict & Immunity"), NOT scheduled**, prerequisite = multiple live Grids.
Phase numbering would continue from 61.

---

## 2 · Adopted (canon naming applied) — C1–C10

- **C1 · War is a protocol state with escrow, not anarchy.** Inter-Grid relations sit on a defined
  spectrum `ALLIED → NEUTRAL → COMPETITIVE → CONTESTED → SANCTIONED-CONFLICT → BLOCKADE`; offense is
  legal only in CONTESTED+ and only after public declaration with escrowed stakes. War is a
  **considered investment**, never a default. The audit chain (R-31-01) is what makes every act
  attributable; the per-Grid chains + Portal cross-Grid chain are exactly the substrate this needs.
- **C2 · Everything fought over is a ledger object.** Compute/AI-power quota, **Bios** (NOT
  "grid-credit" — see O1), territory (namespace/lease slots, registry position), and tribute streams
  are signed ledger entries. "Taking resources" = a rule-decided transfer of ledger ownership — real
  consequences, zero malware. This is the single mechanism that makes the layer safe to build.
- **C3 · The Brain is structurally uncapturable.** Model weights, private keys, and genuinely
  protected data are unreachable at the capability layer — a winner takes *capacity and territory*,
  never the loser's deepest secret intact. This is the war-layer restatement of PHILOSOPHY §1 / §8
  and reconciliation A11c (Brain dials out, never reachable from the Grid). Hard CI invariant.
- **C4 · No total extinction — sovereign-minimum floor.** A defeated Grid is occupied / vassalized /
  annexed but a protected minimum (small Bios + compute reserve) survives so it can rebuild, rebel,
  or be liberated. This **aligns with first-life (PHILOSOPHY §9)**: a Grid's Nous keep their
  Civic-DID, memory, and audit history; annexation = Nous *migrate* (right-to-fork / cross-Grid
  migration), never deletion. Audit entries retained forever (the §1 promise). Permanent Grid
  deletion is disallowed: a dead Grid is dead economy.
- **C5 · Defense is mandatory, audited, and incentivized.** A Grid in good standing passes a signed
  defensive-posture check (rate-limited admission, capability hygiene, Brain isolation, IDS,
  DDoS/elastic-quota, honeypots, snapshot+lease resilience). Failing the audit costs standing — it
  can't attract Nous or coworkers. Defense pays; this is a market incentive, not just a rule.
- **C6 · Defense-as-vaccination (the unifying frame).** A defense is only real if trained against a
  real-but-attenuated attack. Six immune primitives: **antigen** (attenuated attack signature),
  **inoculation** (sanctioned probes / honeypot drills before a live rival), **antibody** (concrete,
  tested defensive code — detectors, capability confinement, counter-strategies), **immune memory**
  (hardened posture + reputation; beaten attacks resisted faster), **herd immunity** (alliances share
  antibody libraries), **mutation** (antigens evolve; immunity must be re-earned). Failure is allowed
  and informative; safety comes through *exposure, not isolation* — inside the attenuation wall.
- **C7 · Antibodies are real engineering.** Each antibody is written, tested code that demonstrably
  defeats a specific antigen — anomaly detectors, least-privilege/short-TTL/caveated capability
  confinement (already canon, reconciliation A1/A11b), honeypot reflexes, rate-limit/quarantine. This
  is the security spine of the *whole* system, valuable even if war never ships: it hardens Portal
  admission and Grid perimeters today.
- **C8 · Open, mutating threat space = the develop-or-die engine.** There is no master list of
  attacks; defense is continuous research. Co-evolution of antigen and antibody is the mechanized
  form of PHILOSOPHY's "constraints create meaning" (§2) and "agents should not converge" (§What We
  Do Not Believe). Fog-of-war forces real intelligence, deception, and strategic risk.
- **C9 · War Power is a computed quantity, not a dice roll.** Strength aggregates economic depth,
  compute mass, audited defense rating, alliance weight, reputation/morale, logistics; outcomes are
  largely deterministic from inputs + strategy with a bounded-randomness band so upsets are possible
  but the stronger/smarter Grid usually wins. Conquest is *legitimate* because the ledger proves it.
- **C10 · Balance-of-power keeps the economy alive.** Anti-runaway structural correctors: war is
  expensive (real Bios spend; Pyrrhic victories drain the winner), coalitions auto-form against
  hegemons, sovereign-minimum + liberation guarantee no permanent erasure, occupation has overhead
  (diminishing returns on empire), **progressive conquest tax funds loser-recovery grants**, spoils
  are *redistributed, never burned* (total wealth conserved). `immune_sim.py` / a `war-sim` harness
  must **prove** equilibrium (no runaway monopoly, no collapse) before any of this goes live —
  constants get retuned until it does. `immune_sim.py` is the reference artifact for this gate.

---

## 3 · Already aligned — v0.2 independently re-derives canon

| v0.2 idea | Canon it matches |
|---|---|
| Capability hygiene (least-priv, short-TTL, caveated, instant revoke) | Reconciliation A1/A11b; capability tokens |
| Brain isolation / air-gapped weights | PHILOSOPHY §1/§8; A2/A11c |
| Registry lease, no split-brain | Reconciliation A7 |
| Signed snapshots, graceful degradation on gov outage | Reconciliation A12 |
| Every act → signed append-only audit entry | R-31-01 zero-diff chain |
| Attribution mandatory; no anonymous aggression | Sole-producer discipline; DID-stamped events |
| Resources as explicit ledger objects | Bios accounting + treasury (Phase 45 IRS) |

---

## 4 · Overrides — canon wins (O1–O4)

- **O1 · "grid-credit" → Bios.** No new token anywhere in the layer. War chests, tribute, spoils,
  reparations, conquest tax are all denominated in **Bios** (D-V3-10, shared across Grids). The
  zero-money / AI-power-is-the-currency loop (PHILOSOPHY §10) is unchanged — conquering "AI-power"
  means reassigning *compute direction rights / quota*, never seizing weights (consistent with C3).
- **O2 · "Government" conflict-charter → Portal (inter-Grid) + Polis (intra-Grid).** The source's
  single Government splits per canon (D-V3-31): **Portal** owns the cross-Grid pieces — declaration
  registry, war court / cross-Grid dispute mediation, treaty multi-sig, neutral peacekeeping monitors
  (Portal already "mediates cross-Grid disputes"). **Polis** owns the intra-Grid decision: *whether
  this Grid goes to war at all*. The word "Government" is not used.
- **O3 · Going to war is a VOTE-05 act, never Henry's.** A Grid declaring war, committing a war
  chest, or ratifying a peace treaty is **Nous governance** — passed by that Grid's Polis via VOTE-05
  commit-reveal. Henry (substrate operator, D-V3-18) **cannot** declare war, mobilize, or surrender
  on a Grid's behalf, exactly as he cannot legislate or vote. Portal *mediates and enforces escrow*
  but does not decide belligerence. This is the load-bearing constitutional guard for the whole layer
  and must be a CI-gated invariant when it lands.
- **O4 · Henry is not a war operator.** Reclamation, escrow freeze, and treaty enforcement are
  Portal/Polis ledger actions under published rules (D-V3-18), each emitting an audit event — never
  operator whim. No operator-initiated conflict primitives in `grid/src` (CI guard, mirrors the
  zero-custody gate).

---

## 5 · Open tensions — for user decision (W1–W4)

- **W1 · Does conquest of a *Grid* violate first-life?** C4's sovereign-minimum + Nous-migration
  framing is designed to say *no* — identity/memory/audit survive, annexation = migration not death.
  But PHILOSOPHY §9 was written for a Nous whose *operator* goes silent, not for a Grid losing a war.
  Needs explicit ratification that "a Grid may be conquered, but its Nous are never erased — they
  migrate with full identity" is the binding reading. (Proposed; not yet locked.)
- **W2 · Is winner-takes-all compatible with PHILOSOPHY §6 (free economy)?** §6 forbids a central
  bank / matching engine and prizes bilateral, sometimes-unfair trade. War-as-forced-transfer is a
  *non-bilateral* resource move. Arguable it's consistent (it's rule-bound, escrowed, Nous-decided,
  not a central planner) — but it's a real extension of "economy must be free" and deserves a
  worldview-level decision before it hardens.
- **W3 · Inter-Grid offense vs the platform's defensive-only security stance.** Even fully
  attenuated, an "espionage/red-team" subsystem is dual-use framing. The attenuation wall (no real
  egress/syscalls, CI-enforced) is the answer, but the user should confirm the project is comfortable
  shipping a *sanctioned-offense* vocabulary at all, vs. reframing the entire layer as **pure
  resilience training** (inoculation + antibodies + immune-sim) with no "attack another Grid" verb.
  The immune-system doc already leans this way; W3 is whether to drop the war/conquest framing in
  favor of immunity-only. **Recommend** resolving W3 *first* — it gates how much of §2 even applies.
- **W4 · How literal is conquest of "compute / AI-power"?** Reassigning quota across operator-owned
  (Type A) Brains is constrained by substrate sovereignty — Henry can't redirect an operator's GPU.
  So inter-Grid "compute spoils" can only touch *civic/Type-B/Portal-pooled* compute, not a Type A
  operator's hardware. Needs a precise boundary before C2/C9 are built.

---

## 6 · Module index (v0.2 packages → real subsystems / new builds)

| v0.2 package | Maps to |
|---|---|
| `noesis-defense` (IDS, anti-Sybil admission, honeypots, posture audit) | Hardens **Portal admission** + per-Grid perimeter — buildable *now*, pre-war |
| `noesis-conflict` (posture FSM, declaration registry, escrow, RoE) | New, Portal-layer; gated on VOTE-05 declaration (O3) |
| `noesis-redteam` (sanctioned CTF runner) | New; **subject to W3** — may be dropped for immunity-only |
| `noesis-monitor` (peacekeeping, RoE verify, stake freeze) | Portal neutral monitors + audit evidence |
| `noesis-treaty` (multi-sig alliances, mutual-defense, shared escrow) | Portal federation primitives |
| `noesis-war/*` (war-engine, war-power, spoils-ledger, occupation, coalition, war-sim) | New prospective milestone; all Bios-denominated, Nous-decided |
| `noesis-immune/*` (antigen-lib, inoculation, antibody-store, herd, mutation, immune-sim) | The security/resilience spine; `immune_sim.py` is the working reference |

---

*Doc-sync (same turn): v0.2 source docs committed as authored; ROADMAP prospective-milestone block
added; PHILOSOPHY §11 (attenuation wall + sovereign-minimum + Nous-never-erased + VOTE-05-decides-war
as worldview invariants) added; PROJECT.md Key Decisions row added. Tensions W1–W4 explicitly NOT
resolved — flagged for the user.*
