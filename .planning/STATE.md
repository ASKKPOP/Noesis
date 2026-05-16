---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Active)
status: executing
stopped_at: "Phase 19 complete — allowlist at 41 — ready for /gsd-plan-phase 20"
last_updated: "2026-05-16T23:10:19.070Z"
last_activity: 2026-05-16
progress:
  total_phases: 22
  completed_phases: 10
  total_plans: 66
  completed_plans: 65
  percent: 98
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-16)

**Core value:** The first persistent Grid where Nous actually live — observable, running continuously, with real cognitive cycles, real trades, and real social dynamics emerging from the systems.
**Current milestone:** v2.4 — Agora (Emergence & Culture: skill diffusion, norm crystallization, lore commons, culture dashboard)
**Current focus:** Phase 19 — norm-crystallization

## Current Position

Phase: 20
Plan: 0 of TBD complete
Status: Phase 19 shipped — ready for Phase 20 planning
Last activity: 2026-05-16

Progress: [████░░░░░░] 50% (2/4 phases complete)

## Accumulated Context

### Carry-forward from v2.0

**v2.0 shipped state (2026-04-18):**

- grid 346/346 tests, brain 262/262 tests, dashboard 215/215 tests — all green
- Broadcast allowlist FROZEN (v2.0 baseline: 10 events, per `grid/src/audit/broadcast-allowlist.ts`): `nous.spawned`, `nous.moved`, `nous.spoke`, `nous.direct_message`, `trade.proposed`, `trade.settled`, `law.triggered`, `tick`, `grid.started`, `grid.stopped`. (Historical drift note: pre-Phase-5 STATE.md claimed 11 with phantom `trade.countered` — phantom event was never emitted, never in code; drift corrected 2026-04-20 per Phase 5 D-11.)
- AuditChain zero-diff invariant holds since Phase 1 commit `29c3516`
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` enforced at 3 entry points
- TradeRecord.timestamp contract: Unix **seconds** (`< 10_000_000_000`)
- Trade payload privacy: `{counterparty, amount, nonce}` only — no memory refs, no Telos
- Dashboard Docker: Next.js standalone output, multi-stage build, ARG→ENV→RUN npm build ordering locked (Pitfall 1)
- `/api/dash/health` is static — no cascading probe to Grid
- SC-6 live-stack smoke: runtime verification pending on operator machine per HUMAN-TEST-GUIDE.md

### v2.1 allowlist additions (planned — one per phase)

- Phase 5 adds: `trade.reviewed` ✅ shipped
- Phase 6 adds: `operator.inspected`, `operator.paused`, `operator.resumed`, `operator.law_changed`, `operator.telos_forced` (5 events)
- Phase 7 adds: `telos.refined` (hash-only payload)
- Phase 8 adds: `operator.nous_deleted`

Total v2.1 allowlist growth: 8 events. Freeze-except-by-explicit-addition rule preserved.

### Broadcast allowlist (v2.4 Phase 19 end-state — 41 events)

**41 events.** In code-tuple order (authoritative source: `grid/src/audit/broadcast-allowlist.ts` `ALLOWLIST_MEMBERS`):

1. `nous.spawned`
2. `nous.moved`
3. `nous.spoke`
4. `nous.direct_message`
5. `trade.proposed`
6. `trade.reviewed` ← Phase 5 (REV-02)
7. `trade.settled`
8. `law.triggered`
9. `tick`
10. `grid.started`
11. `grid.stopped`
12. `operator.inspected` ← Phase 6 (AGENCY-02)
13. `operator.paused` ← Phase 6 (AGENCY-03)
14. `operator.resumed` ← Phase 6 (AGENCY-03)
15. `operator.law_changed` ← Phase 6 (AGENCY-03)
16. `operator.telos_forced` ← Phase 6 (AGENCY-03)
17. `telos.refined` ← Phase 7 (DIALOG-02)
18. `operator.nous_deleted` ← Phase 8 (AGENCY-05)
19. `ananke.drive_crossed` ← Phase 10a (DRIVE-03)
20. `bios.birth` ← Phase 10b (BIOS-02)
21. `bios.death` ← Phase 10b (BIOS-02/03)
22. `nous.whispered` ← Phase 11 (WHISPER-04)
23. `proposal.opened` ← Phase 12 (VOTE-01)
24. `ballot.committed` ← Phase 12 (VOTE-02)
25. `ballot.revealed` ← Phase 12 (VOTE-03)
26. `proposal.tallied` ← Phase 12 (VOTE-04)
27. `operator.exported` ← Phase 13 (REPLAY-02)
28. `nous.reflection_authored` ← Phase 15 (PNEU-01) — `{nous_did, tick, entry_hash}`
29. `nous.self_model_revised` ← Phase 15 (PNEU-03) — `{nous_did, tick, rule_hash}`
30. `nous.creed_violation` ← Phase 15 (PNEU-06) — `{nous_did, tick, violation_hash}`
31. `nous.sleep.entered` ← Phase 16 (HYP-04) — `{nous_did, tick, ltm_snapshot_hash}`
32. `nous.sleep.completed` ← Phase 16 (HYP-04) — `{nous_did, tick, ltm_snapshot_hash}`
33. `iris.belief_revised` ← Phase 17 (IRIS-05) — `{nous_did, tick, target_did, belief_hash}`
34. `iris.context_invoked` ← Phase 17 (IRIS-05) — `{nous_did, tick, belief_count}`
35. `iris.contradiction_detected` ← Phase 17 (IRIS-03) — `{nous_did, tick, target_did, contradiction_hash}`
36. `iris.prior_seeded` ← Phase 17 (IRIS-04) — `{nous_did, tick, target_did, seed_event_hash}`
37. `skill.taught` ← Phase 18 (SKILL-03) — `{learner_did, parent_hash, skill_hash, teacher_did, tick}`
38. `skill.inferred` ← Phase 18 (SKILL-03) — `{learner_did, skill_hash, source_event_hash, tick}`
39. `skill.rejected` ← Phase 18 (SKILL-03) — `{learner_did, rejection_reason, tick}`
40. `norm.candidate` ← Phase 19 (NORM-01) — `{convergence_type, fingerprint, participating_count, tick}`
41. `norm.crystallized` ← Phase 19 (NORM-03) — `{convergence_type, evidence_tick_range, fingerprint, participating_count, tick}`

Regression gate: `scripts/check-state-doc-sync.mjs` asserts this enumeration matches the frozen 36-event invariant.

### v2.4 Agora — Allowlist budget (36 → 43)

| Phase | Delta | Running Total | Events |
|-------|-------|---------------|--------|
| 18 (Skill Diffusion) | +3 | 39 | `skill.taught` (pos 37), `skill.inferred` (pos 38), `skill.rejected` (pos 39) | complete |
| 19 (Norm Crystallization) | +2 | 41 | `norm.candidate` (pos 40), `norm.crystallized` (pos 41) | complete |
| 20 (Lore Commons) | +2 | 43 | `lore.contributed` (pos 42), `lore.cited` (pos 43) |
| 21 (Culture Dashboard) | +0 | 43 | reads existing events, no new emissions |

**Locked payload shapes (alphabetical key order, sole-producer boundary):**

- `skill.taught`: `{learner_did, parent_hash, skill_hash, teacher_did, tick}` — sole producer `grid/src/skills/appendSkillTaught.ts`
- `skill.inferred`: `{learner_did, skill_hash, source_event_hash, tick}` — sole producer `grid/src/skills/appendSkillInferred.ts`
- `skill.rejected`: `{learner_did, rejection_reason, tick}` where `rejection_reason in {low_trust, structural_invalid, quota_exceeded}` — sole producer `grid/src/skills/appendSkillRejected.ts`
- `norm.candidate`: `{convergence_type, fingerprint, participating_count, tick}` where `convergence_type in {emergent, coincidental}` — sole producer `grid/src/norms/appendNormCandidate.ts`
- `norm.crystallized`: `{convergence_type, evidence_tick_range, fingerprint, participating_count, tick}` — sole producer `grid/src/norms/appendNormCrystallized.ts`
- `lore.contributed`: `{category_tag, content_hash, contributor_did, tick}` — sole producer `grid/src/lore/appendLoreContributed.ts`
- `lore.cited`: `{citing_did, content_hash, tick}` — sole producer `grid/src/lore/appendLoreCited.ts`

### v2.4 Critical invariants (locked pre-Phase-18)

- **PeerSkillFilter wiring gap:** `PeerSkillFilter` is fully implemented at `brain/src/noesis_brain/skills/peer_filter.py` but NOT yet wired into `BrainHandler.on_message()`. Phase 18 Plan 1 MUST wire the `__skill_share:` dispatch path before any Grid emitter code lands.
- **NormDetector is pure-observer:** NormDetector watches `nous.self_model_revised` (pos 29); it has ZERO `AuditChain.append` calls. All norm events are emitted by sole-producer emitter files.
- **actorDid for norm events:** `did:noesis:grid` (Grid system DID); validated by existing `DID_RE` — confirm against `protocol/src/identity/did.ts` before Phase 19 Plan 1.
- **Lore body never crosses wire:** Grid `lore_commons` table stores only `{contributor_did, tick, content_hash, title_hash, category_tag, citation_count}`. No lore prose stored at Grid. `__lore_request:` / `__lore_response:` whisper prefixes added to `WHISPER_FORBIDDEN_KEYS`.
- **Culture dashboard raw SVG (D-9-08):** All three culture visualizations (skill lineage tree, norm timeline, lore graph) use server-computed `{x, y}` positions + client `<line>` / `<circle>` elements. No d3, react-flow, cytoscape, recharts.
- **n-gram fingerprint is 6-char hex prefix of SHA-256 over sorted word-trigrams of lowercased rule text.** Brain computes and self-reports; Grid never reads rule text. This format is locked — changes require wiping the norm registry.
- **Quorum thresholds injectable:** `NORM_THRESHOLD` (N=3), `NORM_WINDOW_TICKS` (W=10), `NORM_ADOPTION_TICKS` (K=20) are GenesisLauncher config, not hardcoded. Follows Phase 14 rig config pattern.
- **Lore contribution quota K=3 per Nous per sleep epoch** enforced at `grid/src/integration/nous-runner.ts` before `appendLoreContributed` call. Not Brain-side only.
- **FORBIDDEN_KEY_PATTERN additions (v2.4):** `skill_body|skill_text|rule_text|lore_body|lore_content|title_text|summary_text` must be added before any v2.4 code touches the allowlist.

### v2.3 phase decisions (carry-forward)

Phase 15-17 shipped with all Brain-private invariants intact. Key carry-forwards:

- `nous.self_model_revised` (pos 29) is the event NormDetector (Phase 19) will watch
- ObservationalLearner wired on trade_settled events (Phase 16) — Phase 18 extends it for skill inference
- PeerSkillFilter scaffold created in Phase 15 Plan 3 — Phase 18 wires it
- Iris IrisStore (Phase 17) is append-only; zero wall-clock; 3-keys-not-5 pattern

### Research foundation for v2.1

- `.planning/research/stanford-peer-agent-patterns.md` — committed 9bb3046 (2026-04-20)
  - Agentic Reviewer (Zou, Stanford HAI) → objective-only ReviewerNous (Phase 5)
  - arxiv 2512.08296 multi-agent topologies → stay centralized, defer nous.whispered mesh to Sprint 16+ (WHISPER-01)
  - SPARC peer-dialogue pattern → telos.refined from exchanges (Phase 7)
  - arxiv 2506.06576 Human Agency Scale → H1-H5 operator UI (Phases 6, 8)

## Session Continuity

Last session: 2026-05-16
Stopped at: Phase 19 complete — allowlist at 41 — ready for /gsd-plan-phase 20
Resume file: None
Next action: /gsd-plan-phase 20 (Lore Commons)
