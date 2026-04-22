# Phase 10b — Discussion Log (`--auto` mode)

**Date:** 2026-04-22
**Mode:** `--auto` — all gray areas auto-selected with recommended defaults; single-pass.

## Auto-selected gray areas

`[--auto] Selected all gray areas: [Allowlist reconciliation, Bios→Ananke elevation rule, Satiation mechanism, Death-cause triggers, Subjective-time formula, Chronos application point, epoch_since_spawn surface, Privacy matrix scope, Determinism grep gate scope, Death → drive cessation]`

---

## Per-area auto-selections

### 1. Allowlist reconciliation (ROADMAP vs. code)
- **Q:** "ROADMAP claims Phase 10b adds zero allowlist events (assuming `bios.birth`/`bios.death` pre-exist), but `grid/src/audit/broadcast-allowlist.ts` has exactly 19 events with no `bios.*` entry. How does Phase 10b reconcile?"
- **Options:**
  1. **(recommended)** Add `bios.birth` and `bios.death` as +2 new allowlist members (positions 20, 21); update ROADMAP + STATE in same commit as emitter.
  2. Defer birth/death to a future phase (blocks BIOS-02/04 closed-enum test and Phase 11 Whisper keypair bootstrap).
  3. Interpret "already exist" loosely as "implicit in `nous.spawned`" and ship with no new events (breaks BIOS-03 closed payload contract).
- **Selected:** Option 1 (recommended default). → **D-10b-01**. Running total 19→21. Doc-sync obligation propagates to ROADMAP and STATE.md.

### 2. Bios→Ananke elevation rule (ROADMAP Open Question #3)
- **Q:** "Does Bios elevate the matching Ananke drive once per threshold crossing, or every tick while the need is over threshold?"
- **Options:**
  1. **(recommended)** Once per crossing — one-shot bucket bump; if already at `high`, no-op.
  2. Every tick while over threshold — continuous pressure; risks audit bloat T-09-01.
  3. Hybrid (once at crossing + decay re-elevation after N ticks).
- **Selected:** Option 1 (recommended default). → **D-10b-02**.

### 3. Satiation mechanism
- **Q:** "BIOS-01 says needs rise monotonically in absence of satiating action — what's the satiation mechanism in 10b?"
- **Options:**
  1. **(recommended)** Rise-only + passive baseline decay (clones 10a D-10a-01); no action-based reducers.
  2. Action-based reducers now (requires canonical action→need map, not scoped in 10b).
  3. Purely monotonic rise, no relaxation (saturates at 1.0 within ~N ticks under RIG test load).
- **Selected:** Option 1 (recommended default). → **D-10b-03**.

### 4. Death-cause trigger semantics
- **Q:** "Who/what emits `bios.death` for each `cause ∈ {starvation, operator_h5, replay_boundary}`?"
- **Options:**
  1. **(recommended)** Deterministic mapping — `starvation` auto-emitted by Bios at max saturation; `operator_h5` piggybacks existing `operator.nous_deleted` handler; `replay_boundary` emitted during deterministic replay at tombstone cursor.
  2. Operator explicitly supplies cause in every H5 delete (breaks replay determinism).
  3. Cause inferred at query time rather than emission time (violates closed-tuple payload invariant).
- **Selected:** Option 1 (recommended default). → **D-10b-04**.

### 5. Subjective-time formula (CHRONOS-01)
- **Q:** "Which drive(s) feed the subjective-time multiplier, and what is the closed-form function?"
- **Options:**
  1. **(recommended)** Curiosity amplifies, boredom compresses; others neutral. `multiplier = clamp(1.0 + curiosity_boost(L) - boredom_penalty(L), 0.25, 4.0)`.
  2. All five drives contribute (hunger/safety/loneliness weights require design decisions not in scope).
  3. Single-drive (curiosity only) — matches PHILOSOPHY phenomenology but loses the "boredom → time feels fast" signal.
- **Selected:** Option 1 (recommended default). → **D-10b-05**.

### 6. Chronos application point in Stanford retrieval
- **Q:** "Where does the subjective multiplier apply in the Stanford retrieval score?"
- **Options:**
  1. **(recommended)** Multiply the recency term: `β·(recency · subjective_multiplier)` — Brain-side, read-time.
  2. Multiply the whole score (boosts salience but distorts relevance/importance — not what PHILOSOPHY §6 implies).
  3. Multiply the tick-delta input to recency (equivalent to Option 1 at linear recency, but breaks non-linear decays).
- **Selected:** Option 1 (recommended default). → **D-10b-06**.

### 7. `epoch_since_spawn` surface (CHRONOS-03)
- **Q:** "Is `epoch_since_spawn` a new RPC verb, a Brain-local derived read, or a context-injection primitive?"
- **Options:**
  1. **(recommended)** Brain-local derived read — `current_tick - bios_birth_tick(did)` over AuditChain cache; injected via existing Psyche context pattern. No new RPC, no new allowlist event.
  2. New RPC verb `get_epoch_since_spawn(did)` — unnecessary transport overhead; violates CHRONOS-03's "no new event" constraint at the RPC boundary.
  3. New audit event `chronos.epoch_checked` — violates CHRONOS-03 and the zero-allowlist-growth goal more directly.
- **Selected:** Option 1 (recommended default). → **D-10b-07**.

### 8. Privacy matrix scope (clones 10a D-10a-07)
- **Q:** "Which keys belong in BIOS_FORBIDDEN_KEYS and CHRONOS_FORBIDDEN_KEYS?"
- **Options:**
  1. **(recommended)** `BIOS_FORBIDDEN_KEYS = {energy, sustenance, need_value, bios_value}`; `CHRONOS_FORBIDDEN_KEYS = {subjective_multiplier, chronos_multiplier, subjective_tick}`. Extend shared regex; three-tier grep.
  2. Bios keys only (Chronos is Brain-local so theoretically safe); risk: future Dashboard wiring leaks.
  3. No new classes; reuse DRIVE_FORBIDDEN_KEYS (wrong — different semantic class).
- **Selected:** Option 1 (recommended default). → **D-10b-10**.

### 9. Determinism grep gate scope
- **Q:** "Which paths get the `Date.now`/`performance.now`/`setInterval`/`Math.random` forbidden grep extended to in 10b?"
- **Options:**
  1. **(recommended)** `grid/src/bios/**`, `grid/src/chronos/**`, `brain/src/noesis_brain/bios/**`, `brain/src/noesis_brain/chronos/**`. Clones 10a gate pattern.
  2. Bios paths only (Chronos is read-side so "no writes" means "can't leak determinism"); wrong — Chronos still reads tick → can still read wall-clock wrongly.
  3. Project-wide — blanket ban (breaks existing intentional wall-clock reads in tests, operator CLI, etc.).
- **Selected:** Option 1 (recommended default). → **D-10b-09**.

### 10. Death → drive / need cessation
- **Q:** "After `bios.death` appends, does the Nous continue accruing drives/needs for replay correctness, or stop?"
- **Options:**
  1. **(recommended)** Stop — tombstoneCheck short-circuits Bios + Ananke per-tick step for that DID; no post-death `ananke.drive_crossed` for a tombstoned DID.
  2. Continue (replay-symmetric but semantically violates BIOS-04 tombstone and pollutes audit with post-mortem drives).
  3. Emit one `chronos.ceased` event (adds unneeded allowlist event; violates 10b zero-growth goal beyond the +2 death/birth).
- **Selected:** Option 1 (recommended default). → **D-10b-12**.

---

## Deferred-idea confirmations (auto-accepted from 10a inheritance + ROADMAP out-of-scope)

- Action-based satiation → deferred (mirrors 10a)
- LLM-driven subjective time → deferred (ROADMAP out-of-scope)
- Thymos categorical emotions → v2.3
- Dashboard Chronos visualization → deferred (internal-only in 10b)
- GDPR-style erasure → out of scope (PHILOSOPHY §1 I-6)
- Additional drives in subjective-time formula → deferred
- `bios.death{cause}` enum extension → requires its own phase action

---

## User-input pause points

None — `--auto` mode runs single-pass; no `AskUserQuestion` calls issued.

## Auto-advance

After CONTEXT.md + DISCUSSION-LOG.md commit and STATE.md update, invoke `Skill(skill="gsd-plan-phase", args="10b --auto")`.

---

*Generated: 2026-04-22 (--auto mode, single-pass, zero interactive prompts)*
