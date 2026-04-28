---
phase: 14
plan: 05
wave: 4
status: complete
completed: 2026-04-28
---

# Plan 14-05 Summary — Doc-sync & Prefix Hard-bans

## What Was Built

### Task 1 — Extended `scripts/check-state-doc-sync.mjs`

Added two new prefix hard-ban functions immediately after the existing `checkReplayPrefixBan()`:

```javascript
// 5. chronos.* prefix hard-ban (Phase 14 D-14-08)
function checkChronosPrefixBan() {
  // regex /['"]chronos\./g scans broadcast-allowlist.ts
  // failure cites: "CHRONOS PREFIX HARD-BAN VIOLATION" + 14-CONTEXT.md §D-14-08
}

// 6. rig.* prefix hard-ban (Phase 14 D-14-08)
function checkRigPrefixBan() {
  // regex /['"]rig\./g scans broadcast-allowlist.ts
  // failure cites: "RIG PREFIX HARD-BAN VIOLATION" + 14-CONTEXT.md §D-14-08
}

checkChronosPrefixBan();
checkRigPrefixBan();
```

Header docblock updated to enumerate the Phase 14 additions. The `required[]` array is **unchanged** — Phase 14 adds zero production-allowlist members.

Commit: `84a918b`

### Task 2 — Updated `.planning/STATE.md`

Added Phase 14 subsection to Accumulated Context block with 8 invariants:
1. Allowlist count remains 27 (zero Phase 14 additions)
2. `chronos.rig_closed` isolation (D-14-08) — rig-internal, never broadcast; 5-key tuple
3. `chronos.*` and `rig.*` prefix hard-bans — CI-enforced
4. Zero code divergence (RIG-01) — `rig.mjs` is a config-driven CLI over unchanged GenesisLauncher
5. NOESIS_RIG_PARENT nested-rig rejection (D-14-02) — exit code 2
6. NOESIS_FIXTURE_MODE network refusal (D-14-06) — FixtureBrainAdapter only path
7. `--permissive` is NOT a security bypass (D-14-05) — returns `[UNMATCHED FIXTURE]` stubs only
8. MySQL isolated schema (D-14-01) — `rig_{configName}_{seed8}` naming

Current Focus updated from Phase 14 in-flight → Phase 14 shipped 2026-04-28.

Commit: `772bfbd`

### Task 3 — Reconciled ROADMAP, MILESTONES, README, PROJECT

- **ROADMAP.md**: Phase 14 marked `[x]` complete (shipped 2026-04-28); plans 14-01..14-05 each `[x]`
- **MILESTONES.md**: Phase 14 entry appended with RIG-01..RIG-05, invariants preserved, CI gates added, files shipped
- **README.md**: Researcher Rigs section added with `node scripts/rig.mjs` CLI example
- **PROJECT.md**: RIG-01..RIG-05 moved Active → Validated; D-14-01..D-14-08 added to Key Decisions appendix

Commit: `0f39929`

### Task 4 — Updated PHILOSOPHY.md (conditional — change required)

PHILOSOPHY.md did not previously articulate the zero-divergence principle for researcher tooling.

Added:
- Allowlist count updated from "26 events as of Phase 12" → "27 events frozen as of Phase 14"
- `operator.exported` added to the member enumeration
- New non-negotiable: *Rigs and researcher tooling are configured production code, not forks.* Rigs reuse GenesisLauncher unchanged; `chronos.*`/`rig.*` events live on isolated AuditChains, never broadcast; CI gates enforce both invariants forever. (Phase 14 RIG-01 / D-14-08)

Commit: `34b17c0`

### Task 5 — Human Verification (gate outputs at approval time)

All gates confirmed green before commit:

```
node scripts/check-state-doc-sync.mjs   → EXIT 0 ✅
node scripts/check-rig-invariants.mjs   → EXIT 0 ✅
cd grid && npx vitest run test/rig/     → 27 passed | 6 skipped ✅
```

Sanity test: adding `'chronos.test'` to `broadcast-allowlist.ts` causes gate to exit 1 with:
```
CHRONOS PREFIX HARD-BAN VIOLATION: ... contains a 'chronos.*' token.
  Phase 14 D-14-08 bans chronos.* allowlist members:
  > chronos.rig_closed lives ONLY on the Rig's isolated AuditChain; it is never broadcast.
```
Gate returns to exit 0 after revert. ✅

### Task 6 — Atomic Commit

Tasks 1–4 committed incrementally (84a918b, 772bfbd, 0f39929, 34b17c0).

---

## Gate Outputs (final state)

| Gate | Command | Exit |
|------|---------|------|
| Doc-sync | `node scripts/check-state-doc-sync.mjs` | 0 ✅ |
| Rig invariants | `node scripts/check-rig-invariants.mjs` | 0 ✅ |
| Fast Vitest rig suite | `cd grid && npx vitest run test/rig/` | 0 ✅ (27 passed, 6 skipped) |

---

## Phase 14 — Researcher Rigs SHIPPED

**Allowlist remains 27.** `chronos.*` / `rig.*` isolation CI-enforced forever.

All 5 requirements delivered:
- **RIG-01**: Zero code divergence — `scripts/rig.mjs` wraps `GenesisLauncher` unchanged; `check-rig-invariants.mjs` T-10-12 forbids `httpServer.listen`/`wsHub`
- **RIG-02**: Isolated AuditChain + nested-rig rejection via `NOESIS_RIG_PARENT`; schema `rig_{name}_{seed8}`
- **RIG-03**: `FixtureBrainAdapter` in `brain/src/noesis_brain/llm/fixture.py`; strict/permissive cache-miss modes; `NOESIS_FIXTURE_MODE=1` network refusal
- **RIG-04**: `GridCoordinator.awaitTick()` + direct for-loop (no setInterval overhead); nightly `rig-bench.test.ts` 50×10k smoke gated behind `NOESIS_RUN_NIGHTLY`; p99 emit latency 0.006ms (167× under 1ms budget)
- **RIG-05**: `chronos.rig_closed` 5-key closed tuple `{seed, tick, exit_reason, chain_entry_count, chain_tail_hash}`; `--full-state` consent prompt verbatim-locked; JSONL tarball deterministic
