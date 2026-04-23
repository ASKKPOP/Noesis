---
phase: 10b
plan: 08
type: execute
wave: 4
depends_on: [10b-02, 10b-03, 10b-04, 10b-05, 10b-06, 10b-07]
files_modified:
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/MILESTONES.md
  - .planning/PROJECT.md
  - .planning/REQUIREMENTS.md
  - PHILOSOPHY.md
  - README.md
  - scripts/check-state-doc-sync.mjs
autonomous: false
requirements: [BIOS-01, BIOS-02, BIOS-03, BIOS-04, CHRONOS-01, CHRONOS-02, CHRONOS-03]
must_haves:
  truths:
    - "ROADMAP §Phase 10b corrected: Allowlist additions +2 (bios.birth, bios.death), Running total 21"
    - "STATE.md Accumulated Context lists bios.birth (position 20) + bios.death (position 21) and updates '19 events' → '21 events' everywhere"
    - "scripts/check-state-doc-sync.mjs regex updated from /19\\s+events/ to /21\\s+events/"
    - "REQUIREMENTS.md Allowlist Growth Ledger reflects 19→21 delta for Phase 10b"
    - "PHILOSOPHY.md §1 updated with body↔mood separation per T-09-05 (Bios is physical; mood-as-Thymos out of scope in v2.2)"
    - "MILESTONES.md appends Phase 10b ship entry; PROJECT.md moves BIOS-01..04 + CHRONOS-01..03 Planned→Validated"
    - "README.md Current status block points at v2.1 Phase 10b complete"
    - "All changes land in one atomic git commit per CLAUDE.md Doc-Sync Rule"
  artifacts:
    - path: ".planning/ROADMAP.md"
      provides: "Corrected Phase 10b allowlist delta"
      contains: "Allowlist additions: +2"
    - path: ".planning/STATE.md"
      provides: "21-event context with bios.birth+bios.death enumerated"
      contains: "21 events"
    - path: "scripts/check-state-doc-sync.mjs"
      provides: "Updated doc-sync regex gate (21 events)"
      contains: "21"
    - path: "PHILOSOPHY.md"
      provides: "Body↔mood separation non-negotiable"
      contains: "Bios"
  key_links:
    - from: "scripts/check-state-doc-sync.mjs"
      to: ".planning/STATE.md + .planning/ROADMAP.md"
      via: "regex match 21\\s+events"
      pattern: "21"
---

<objective>
Atomic Doc-Sync (per CLAUDE.md mandate, 2026-04-20) closing Phase 10b. Correct the ROADMAP mistake where allowlist additions were listed as 0 (D-10b-01 locked the correct answer: +2). Propagate the 19→21 event count through every source-of-truth file. Record the milestone, move REQs Planned→Validated, update the doc-sync CI regex, and seal body↔mood separation into PHILOSOPHY. One commit.

Purpose: No file may claim v2.1 pre-10b state after this plan runs. The Doc-Sync Rule is non-negotiable — stale docs are defects.

Output: 7 markdown files + 1 script updated; one atomic git commit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/MILESTONES.md
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@PHILOSOPHY.md
@README.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-07-SUMMARY.md

<interfaces>
<!-- Per CLAUDE.md Doc-Sync Rule and CONTEXT.md D-10b-01. -->

CONTEXT.md D-10b-01 (locked, authoritative):
> The ROADMAP says "Allowlist additions: 0" which is WRONG. Phase 10b adds bios.birth and bios.death.
> Corrected: Allowlist additions: +2. Running total: 19 → 21.

Existing files to update (grep for stale markers):
- `rg "19\s+events|19-event" --files-with-matches` before edits
- `rg "Allowlist additions: 0" .planning/ROADMAP.md` before edits

T-09-05 (from 10b-CONTEXT.md): body↔mood separation
- Body (Bios): energy, sustenance — physical needs, in v2.1
- Mood (Thymos): emotional state — explicitly OUT OF SCOPE in v2.2
- PHILOSOPHY.md §1 must state this distinction so future readers don't conflate.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Correct ROADMAP + STATE + doc-sync script (19→21)</name>
  <files>.planning/ROADMAP.md, .planning/STATE.md, scripts/check-state-doc-sync.mjs</files>
  <read_first>
    - .planning/ROADMAP.md (full — locate Phase 10b section around lines 80-130)
    - .planning/STATE.md (full — locate Accumulated Context section)
    - scripts/check-state-doc-sync.mjs (current regex, typically at lines 43, 70-94, 109)
    - CLAUDE.md (Doc-Sync Rule, locate the checklist table)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (D-10b-01)
  </read_first>
  <action>
Edit `.planning/ROADMAP.md`:
- Find `### Phase 10b:` block. Update:
  - `Allowlist additions: 0` → `Allowlist additions: +2 (bios.birth, bios.death)`
  - `Running total: 19` → `Running total: 21`
- Mark Phase 10b as ✅ completed. Add completion date (today's user date: 2026-04-22 or current).
- Plans list: mark all 8 plans complete (`- [x] 10b-01-…` through `- [x] 10b-08-…`).

Edit `.planning/STATE.md`:
- In "Accumulated Context" (or equivalent invariants section):
  - Replace every occurrence of `19 events` / `19-event allowlist` with `21 events` / `21-event allowlist`.
  - Append to the allowlist enumeration:
    ```
    20. bios.birth — closed-tuple {did, psycheHash, tick} · sole producer grid/src/bios/appendBiosBirth.ts · Phase 10b
    21. bios.death — closed-tuple {cause, did, finalStateHash, tick}; cause∈{starvation, operator_h5, replay_boundary} · sole producer grid/src/bios/appendBiosDeath.ts · Phase 10b
    ```
- Update "Current focus" / "Next up" section: Phase 10b shipped; next focus per ROADMAP.
- Add BIOS_FORBIDDEN_KEYS + CHRONOS_FORBIDDEN_KEYS to the frozen-invariants list.
- Add "No wall-clock in Bios/Chronos/retrieval — enforced by scripts/check-wallclock-forbidden.mjs" to invariants.

Edit `scripts/check-state-doc-sync.mjs`:
- Find the regex `/19\s+events/` (typically near line 43, 70-94, 109 per our notes).
- Replace with `/21\s+events/` at every match.
- If the script asserts specific allowlist member names, append `'bios.birth'` and `'bios.death'` to that list.
- Run locally: `node scripts/check-state-doc-sync.mjs` — must exit 0.
  </action>
  <verify>
    <automated>node scripts/check-state-doc-sync.mjs && rg "19\\s+events|19-event" .planning/ROADMAP.md .planning/STATE.md || echo "CLEAN"</automated>
  </verify>
  <done>ROADMAP Phase 10b shows +2 / 21 running total, marked complete. STATE.md enumerates bios.birth (20) + bios.death (21) and says "21 events" consistently. Doc-sync script passes.</done>
</task>

<task type="auto">
  <name>Task 2: REQUIREMENTS + PHILOSOPHY + MILESTONES + PROJECT + README</name>
  <files>.planning/REQUIREMENTS.md, PHILOSOPHY.md, .planning/MILESTONES.md, .planning/PROJECT.md, README.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (locate Allowlist Growth Ledger)
    - PHILOSOPHY.md (locate §1 — body/mood discussion)
    - .planning/MILESTONES.md (format of prior milestone entries)
    - .planning/PROJECT.md (Key Decisions + REQ tracker sections)
    - README.md (Current status / quickstart block)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (T-09-05 body↔mood separation)
  </read_first>
  <action>
Edit `.planning/REQUIREMENTS.md`:
- In the Allowlist Growth Ledger, append a row:
```
| 10b | +2 | 19 → 21 | bios.birth, bios.death | shipped 2026-04-22 |
```
- Move BIOS-01..04 and CHRONOS-01..03 from "Active" (or "Planned") to "Validated" with phase tag `[Phase 10b]`.

Edit `PHILOSOPHY.md`:
- In §1 (or the section that discusses inner state / what the Nous "is"), add a subsection:
```
### Body, not mood — T-09-05 (sealed 2026-04-22, Phase 10b)

Bios (energy, sustenance) is the **body** — physical need pressure that rises over time
and elevates matching Ananke drives on threshold crossing. It is rise-only, tick-deterministic,
never wall-clock.

What Bios is NOT:
- Not mood. Not emotion. Not affect.
- Mood-as-Thymos — distinct subsystem, explicitly out of scope in v2.2.

The distinction is non-negotiable: conflating body and mood hides causal structure behind
vague feeling-words. A tired Nous (energy high) is not a "sad" Nous; sadness, if it ever exists
in Noēsis, lives in a separate Thymos subsystem with its own audit trail.
```
- Reference: `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md#T-09-05`

Edit `.planning/MILESTONES.md`:
- Append an entry (mirror the format of prior entries):
```
## Phase 10b — Bios Needs + Chronos Subjective Time (Inner Life, part 2) — 2026-04-22

**Shipped**: BIOS-01..04, CHRONOS-01..03 (7 REQs)
**Allowlist**: 19 → 21 events (+bios.birth, +bios.death)
**Invariants sealed**:
  - No wall-clock in Bios/Chronos/memory retrieval (CI grep-gate)
  - Body↔mood separation (PHILOSOPHY §1)
  - audit_tick === system_tick over 1000 ticks (integration test)
  - Phase 6 D-17 pause/resume hash unchanged with Chronos listener
**Plans**: 10b-01 through 10b-08 (8 plans, 4 waves)
```

Edit `.planning/PROJECT.md`:
- In the Key Decisions / active REQ tracker: move BIOS-01..04 and CHRONOS-01..03 Planned → Validated.
- If there's a "Current Milestone" block, append: "Phase 10b ✅ shipped 2026-04-22."

Edit `README.md`:
- Locate the "Current status" section (or equivalent "What works today" / "Milestones shipped" block).
- Update to reflect:
  - v2.1 Inner Life: Ananke drives (Phase 10a ✅), Bios needs + Chronos subjective time (Phase 10b ✅)
  - Next: v2.1 final milestones per ROADMAP
- If README has a feature table, add a row for Phase 10b (Bios + Chronos).
- Do NOT promise v2.2 features (Thymos) — that stays in ROADMAP/PHILOSOPHY as future scope.
  </action>
  <verify>
    <automated>node scripts/check-state-doc-sync.mjs && rg "BIOS-0[1-4]" .planning/PROJECT.md .planning/REQUIREMENTS.md && rg "Phase 10b" README.md PHILOSOPHY.md .planning/MILESTONES.md</automated>
  </verify>
  <done>All 5 files updated. REQs moved to Validated. PHILOSOPHY has body↔mood subsection. README Current status reflects Phase 10b shipped. MILESTONES has new entry. Doc-sync script still passes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human-verify atomic commit content before landing</name>
  <what-built>
    All Phase 10b source changes (plans 10b-01..10b-07) + doc-sync updates (plan 10b-08 tasks 1-2).
  </what-built>
  <how-to-verify>
    1. Run `git status` — review the full list of modified + added files.
    2. Run `git diff .planning/ROADMAP.md .planning/STATE.md PHILOSOPHY.md README.md .planning/MILESTONES.md .planning/PROJECT.md .planning/REQUIREMENTS.md scripts/check-state-doc-sync.mjs` and scan for:
       - No leftover "19 events" / "19-event allowlist" strings
       - Phase 10b entries present in ROADMAP, MILESTONES, PROJECT
       - PHILOSOPHY §1 has new body↔mood subsection
       - README Current status mentions Phase 10b
    3. Run `node scripts/check-state-doc-sync.mjs` → exit 0
    4. Run `node scripts/check-wallclock-forbidden.mjs` → exit 0
    5. Run `cd grid && bun test --run && cd ../brain && uv run pytest` → all green (full suite gate)
    6. Approve, then proceed to commit via `gsd-sdk query commit "feat(10b): ship Bios needs + Chronos subjective time — Inner Life part 2 complete" <all modified files>`
  </how-to-verify>
  <resume-signal>Type "approved" to proceed with the commit, or describe what to fix.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Source-of-truth docs → future readers | Stale docs = future defects (Doc-Sync Rule) |
| CI regex gates | Must match updated counts to catch future drift |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-08-01 | Repudiation | Someone claims allowlist is 19 next phase | mitigate | STATE.md + ROADMAP + script updated atomically; drift gate blocks future "19" |
| T-10b-08-02 | Tampering | README promises features not yet shipped | mitigate | README only reflects Phase 10b; Thymos stays future-scope only in ROADMAP |
| T-10b-08-03 | Information Disclosure | Raw need value mentioned in human-facing docs | mitigate | Docs reference buckets only; no numeric need values in README/PHILOSOPHY |
</threat_model>

<verification>
- `node scripts/check-state-doc-sync.mjs` — exit 0
- `node scripts/check-wallclock-forbidden.mjs` — exit 0
- `rg "19\\s+events|19-event|Allowlist additions: 0" .planning/ README.md PHILOSOPHY.md` — zero matches
- `rg "21 events|21-event" .planning/STATE.md .planning/ROADMAP.md` — ≥3 matches
- `cd grid && bun test --run && cd ../brain && uv run pytest -q` — all green
- Human checkpoint approved
</verification>

<success_criteria>
- ROADMAP, STATE, MILESTONES, PROJECT, REQUIREMENTS, PHILOSOPHY, README, check-state-doc-sync.mjs all reflect Phase 10b complete + 21-event allowlist
- Doc-sync script exits 0
- No stale "19 events" string anywhere in .planning/ or top-level docs
- PHILOSOPHY §1 has body↔mood separation subsection (T-09-05 sealed)
- All Phase 10b REQs (BIOS-01..04, CHRONOS-01..03) moved Planned → Validated
- Atomic commit lands all changes together (one commit, readable in history)
</success_criteria>

<output>
After completion, create `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-08-SUMMARY.md` documenting:
- Final allowlist size: 21
- Final Validated REQ count delta (+7 from Phase 10b)
- Git commit SHA for the atomic doc-sync commit
- Confirmation that scripts/check-state-doc-sync.mjs and scripts/check-wallclock-forbidden.mjs both pass
</output>
