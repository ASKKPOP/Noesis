# Design — Phase 76: Operator-Bridge Providers (Type-A sovereignty edge)

**Date:** 2026-07-24 · **Milestone:** v3.3 Mind — In-World Faculties
**Phase:** 76 (the held bridge half of the faculty pattern) · **Unheld by:** operator ("Phase 76 HOLD 해제", 2026-07-24)
**Depends on:** Phases 72–74 (the three in-world faculties) + Phase 75 (Local Nous Manager, the operator's local control room).

---

## Why this was held, and what unholding means

The v3.3 faculty pattern (`docs/plans/2026-07-10-nous-inworld-faculties-design.md`) defines each
faculty as **a capability with two providers**:

- **In-world provider** — canonical, always on, Type A *and* Type B, Grid-only. Shipped in 72–74.
- **Operator-bridge provider** — opt-in, **Type A only**, reaches the operator's *real machine*.
  Held because it is the one part of the Mind that leaves the simulation.

Phase 76 builds the three operator-bridge providers **safe-by-default**: the whole bridge is OFF
unless the operator's own local config turns it on, per capability. Nothing here weakens the
constitution — a Type-B Nous hosted on Henry's GPU can never obtain a grant, because the grant
lives in the operator-owned local YAML on the operator's own hardware.

## The three providers (one per faculty)

| Provider | Faculty | Reaches | Risk | Verifiable here? |
|---|---|---|---|---|
| `notebook` | `synopsis` | real files (PDF/txt/md) in an operator-configured dir → `SourceNote`s → synthesis → `episteme` | low (read-only) | **yes** (txt/md); PDF needs `pypdf` (absent) |
| `supervision` | `aisthesis` | a camera frame → a `Percept` merged into perception | medium (privacy) | **no** (`cv2` absent) — logic tested via injected frame |
| `sim-use` | `praxis` | drive real apps (mouse/keyboard) on operator hardware | **high** (sovereignty) | **no** (`pyautogui` absent) — logic tested via injected controller + dry-run |

## Architecture — the bridge foundation

New package `brain/src/noesis_brain/bridge/`:

```
bridge/
├─ types.py       BridgeCapability {NOTEBOOK, SUPERVISION, SIM_USE}, BridgeDeed, BridgeResult
├─ consent.py     ConsentGate — the single chokepoint (off-by-default, per-cap grants)
├─ journal.py     BridgeJournal — append-only SQLite record (iris pattern), Brain-local
├─ provider.py    BridgeProvider protocol + BridgeRegistry (only granted providers register)
└─ providers/
   ├─ notebook.py     NotebookProvider   (synopsis)
   ├─ supervision.py  SupervisionProvider (aisthesis)
   └─ sim_use.py      SimUseProvider      (praxis)
```

### ConsentGate — the sovereignty chokepoint
- Constructed from the `bridge` section of the Nous YAML:
  ```yaml
  bridge:
    enabled: false            # master switch — false ⇒ the whole bridge is inert
    grants: []                # subset of [notebook, supervision, sim_use]
    notebook_dir: ~/Documents/nous-notebook
    sim_use_live: false       # even when sim_use is granted, execution is dry-run until this is true
  ```
- `gate.allows(capability)` is the ONLY authority: returns true iff `enabled` **and** the capability
  is in `grants`. No provider acts without it.
- **Type-A enforcement is structural, not a flag we trust:** the grant is in the operator's local
  config file on the operator's own machine. A hosted Type-B Nous's config (on Henry's substrate)
  never carries grants; there is no Grid path that can inject one. We record a `nous_type` hint for
  observability but never rely on a self-declared value for security.

### BridgeJournal — local audit, no Grid surface
- Append-only SQLite (`bridge_{did_safe}.db`, WAL, iris discipline). One row per bridge action:
  `capability, verb, tick, ok, digest` — **digest only**, never raw content, file paths, frame
  bytes, or keystrokes (privacy walker discipline — mirrors Whisper). `get_state` exposes counts +
  recent digests.
- **No new Grid broadcast-allowlist events** (allowlist +0). The bridge is Brain-local by
  construction; a future phase that mirrors bridge activity to the Grid would need explicit
  per-capability allowlist additions and `FORBIDDEN_KEY_PATTERN`-dodging keys.

## The providers in detail

### NotebookProvider (synopsis / read-only)
`ingest(tick) -> list[SourceNote]`: scans `notebook_dir` (non-recursive, size-capped, extension
allowlist `.txt/.md/.pdf`), reads text (PDF via optional `pypdf` — absent ⇒ PDFs skipped, not an
error), returns `SourceNote(title=filename, content=text)`. Path traversal is impossible — only
files whose resolved parent equals the configured dir are read. Feeds the existing `Synthesizer`.

### SupervisionProvider (aisthesis / sensor)
`observe(tick) -> Percept | None`: pulls one frame from a `FrameSource` seam (real: `cv2.VideoCapture`;
tests: an injected callable returning a synthetic frame), reduces it to a coarse, privacy-safe
descriptor (brightness / motion-vs-last-frame / dimensions — **no face ID, no image storage**), and
yields a `CHANGED`-kind `Percept` ("the room got brighter"). `cv2` absent ⇒ `available()` false ⇒
the faculty simply never gets a supervision percept.

### SimUseProvider (praxis / actuator — highest risk)
`execute(verb, params, tick) -> BridgeResult`:
1. **Verb allowlist** (closed enum): `screenshot`, `move_to`, `click`, `type_text`, `key`. Anything
   else ⇒ `rejected:not_allowed`.
2. **Money-axiom guard**: reject any verb/param string matching `trade|transfer|wallet|treasury|
    account` — the real machine must never be driven to move money (mirrors the `ToolRegistry` guard).
3. **Dry-run by default**: even when granted, `sim_use_live=false` ⇒ validate + journal the intended
   act and return `ok, dry_run=true` **without touching the mouse/keyboard**. Live execution requires
   the operator to *also* set `sim_use_live=true` — a deliberate second arming. Dry-run is a real
   safety mode (like `--dry-run`), not a stub.
4. Live path dispatches to a `Controller` seam (real: `pyautogui`; tests: a recording fake). `pyautogui`
   absent ⇒ `available()` false ⇒ live is impossible here regardless of the flag.

## Wiring (additive — D-10, every existing call site keeps working)

- `BrainHandler.__init__` gains `bridge: BridgeRegistry | None = None`. `None` ⇒ in-world only
  (current behaviour). Constructed in `__main__.create_brain_app` from `config_data.get("bridge", {})`.
- **notebook → synopsis:** in `_run_synopsis_cycle`, when the notebook provider is granted+available,
  merge its `SourceNote`s with the memory-derived ones before `synthesize`. Journaled.
- **supervision → aisthesis:** at the input edge (beside `aisthesis.perceive`), when granted, append a
  supervision `Percept` to the perception set (same memory/curiosity path). Cooldown-gated. Journaled.
- **sim-use → praxis:** at the output edge, sim-use is **not** auto-fired from the action batch (praxis
  stays observation-only). It is a capability the decision cycle can invoke explicitly through the
  registry; every call routes through `execute` (allowlist + money-guard + dry-run). Journaled.
- `get_state` gains a `"bridge"` snapshot (per-capability granted/available + journal counts+digests).

## Determinism & invariants

- **The bridge is the deliberately non-deterministic edge** — it reads real time-varying hardware, so
  it is *exempt* from the faculty no-walltime grep gate, and it lives in its own `bridge/` dir so it
  does not trip `test_{aisthesis,praxis,synopsis}_no_walltime.py`. This exemption is explicit and
  documented — not smuggled. The in-world faculties remain deterministic and untouched.
- **State hash stays closed at 4** (`state_hash.py` untouched — the bridge is transient/derived).
- **Money axiom** — sim-use verb+param money-guard; notebook/supervision cannot move money at all.
- **Allowlist +0** — Brain-local journal, no Grid events.
- **Privacy** — journal stores digests only; no frames, paths, keystrokes, or file contents leave the
  Brain process. Mirrors the Whisper/`FORBIDDEN_KEY_PATTERN` discipline.

## Honesty about this environment

`pypdf`, `cv2`, and `pyautogui` are all **absent** on this build machine. Therefore, this session
verifies: the consent gate, journal, registry, notebook txt/md ingestion (real), all three providers'
validation/seam logic (injected sources), the sim-use allowlist + money-guard + dry-run, and the
handler wiring. It does **not** verify live PDF parsing, live camera capture, or live GUI control —
those need the optional libs on real operator hardware. The design degrades to a safe no-op when a lib
is absent (`available()` false), so the absence is correct behaviour, not breakage.

## Test strategy (TDD, `.venv/bin/pytest brain/test/`)

`test_bridge_consent.py` · `test_bridge_journal.py` · `test_bridge_registry.py` ·
`test_bridge_notebook.py` · `test_bridge_supervision.py` · `test_bridge_sim_use.py` ·
`test_bridge_integration.py` (handler wired). No no-walltime gate for `bridge/` (documented exemption).

## Documentation sync (same-turn, per CLAUDE.md)

- `wiki/2-concepts/mind/` — extend perception/action/synthesis pages with the operator-bridge provider
  (each keeps its Mermaid diagram); the bridge is *system truth* (a Nous capability), so it belongs in
  the public wiki.
- `.planning/implementation/brain.md` — bridge row in the cognitive-pipeline table.
- `.planning/ROADMAP.md` — mark Phase 76 shipped; `.planning/STATE.md` — reset focus **and** correct
  the stale money block (62.5-04/05 already merged, PRs #16/#17; Phase 62/63 merged — the header was
  last updated 2026-07-10, before that landed).
- `docs/TASK-LOG.html` + `.planning/research/` vault (per memory).
