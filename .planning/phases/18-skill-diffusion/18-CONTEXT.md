# Phase 18: Skill Diffusion — Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 18 wires two already-implemented Brain modules — PeerSkillFilter and ObservationalLearner — into live execution paths, adds a quarantine stage between skill acceptance and promotion, and emits three new allowlisted audit events (`skill.taught`, `skill.inferred`, `skill.rejected`). Skill content never crosses the Brain↔Grid wire; only hashes cross. Skill lineage is reconstructable from `parent_hash` in `skill.taught` payloads via SQL self-joins.

**What's already implemented (do not re-implement):**
- `brain/src/noesis_brain/skills/peer_filter.py` — PeerSkillFilter with 3 gates (trust ≥0.35, flood max 3/source lifetime, injection scan). Currently stores directly to active SkillStore — no quarantine table.
- `brain/src/noesis_brain/learning/observational.py` — ObservationalLearner watching `trade_settled` events only.
- `brain/src/noesis_brain/rpc/types.py` — `ActionType.SKILL_SHARE = "skill_share"` exists.
- `brain/src/noesis_brain/rpc/handler.py` — ObservationalLearner initialized and dispatched (lines ~98–106, ~338); **NO `__skill_share:` dispatch path** (confirmed by grep).

**What Phase 18 must build:**
1. Brain Wave 0: Extend `FORBIDDEN_KEY_PATTERN` with `skill_body|skill_text|rule_text` BEFORE any emitter lands.
2. Brain Wave 1: Wire `__skill_share:` dispatch in `BrainHandler.on_message()`. Add quarantine table + promotion logic.
3. Brain Wave 2: Extend ObservationalLearner with DID/numeric filter. Add 3 new `ActionType` members for Grid-forwarded skill events.
4. Grid Wave 3: 3 sole-producer emitters + 3 NousRunner dispatch cases + allowlist 36→39.
5. Tests: determinism, zero-diff, closed-tuple payloads, 3-hop lineage observable.

</domain>

<decisions>
## Implementation Decisions

### Quarantine Mechanics (SKILL-01)

- **D-18-01:** `QUARANTINE_TICKS` is a rig-configurable constant (TOML RIG config, key `quarantine_ticks`), default 5 ticks. Follows the NORM_THRESHOLD / NORM_WINDOW_TICKS pattern established for Phase 19 — researcher rigs can tune it without code changes. The constant lives in `brain/src/noesis_brain/skills/quarantine.py` (new module).

- **D-18-02:** If the teacher's relationship-graph trust weight drops below `TRUST_THRESHOLD_SKILL` (0.35) while a skill is in quarantine, the skill is **evicted** from quarantine. Eviction emits `skill.rejected` with `rejection_reason = "low_trust"`. Trust is a live precondition, not just an admission gate. Eviction check runs at every `on_tick()` call that processes quarantine promotions.

- **D-18-03:** Quarantine state lives in a **separate `skills_quarantine` table** in the per-Nous Brain SQLite DB. Schema:
  ```sql
  CREATE TABLE IF NOT EXISTS skills_quarantine (
      skill_hash TEXT PRIMARY KEY,
      source_did TEXT NOT NULL,
      received_tick INTEGER NOT NULL,
      promote_at_tick INTEGER NOT NULL,
      payload_json TEXT NOT NULL    -- serialized Skill before promotion
  );
  ```
  Promotion is an explicit move: `INSERT INTO skills (...)` then `DELETE FROM skills_quarantine WHERE skill_hash = ?`. Not a status flag on the existing `skills` table.

### ObservationalLearner Scope (SKILL-02)

- **D-18-04:** ObservationalLearner infers skills from **`trade.settled` events only** in Phase 18 (no change from Phase 16 behavior). Extension to `nous.spoke` or `skill.taught` is deferred to a future phase. The OL dispatch in `BrainHandler.on_tick()` does not change its event source.

- **D-18-05:** The DID-value + numeric-literal filter is a **regex filter** applied to the LLM-extracted skill text before quarantine entry. Reject if the skill text contains:
  - `did:noesis:` substring (DID reference — would replay adversarial peer's identity)
  - An integer ≥ 1000 as a standalone token (Ousia-range numeric — would encode specific offer amounts)
  
  Rejection emits `skill.rejected` with `rejection_reason = "structural_invalid"`. The regex is deterministic and synchronous (no LLM). Pattern: `r'\bdid:noesis:\S+\b|\b\d{4,}\b'` applied to the full extracted skill text.

- **D-18-06:** ObservationalLearner rate-limit: one skill creation per sleep epoch (30 ticks) per Nous per observed pair — already specified in SKILL-02. The per-pair debounce counter (`MIN_OBSERVATIONS_BEFORE_EXTRACT = 2`) already exists in observational.py and is preserved.

### Allowlist Sequencing

- **D-18-07:** Wave 0 of Phase 18 MUST verify the allowlist count is exactly 36 before adding the 3 new skill events. Assert `ALLOWLIST_MEMBERS.length === 36` in a test that runs before the new emitter files are introduced. New positions: `skill.taught` (37), `skill.inferred` (38), `skill.rejected` (39).

- **D-18-08:** `FORBIDDEN_KEY_PATTERN` extension (Wave 0, first task of Phase 18):
  - Add: `skill_body`, `skill_text`, `rule_text` (per STATE.md v2.4 Critical Invariants)
  - Extend the regex in `grid/src/audit/broadcast-allowlist.ts` — same pattern as Phase 16 `ltm_content|concept_text|...`
  - New constant `SKILL_FORBIDDEN_KEYS` following the `IRIS_FORBIDDEN_KEYS` / `HYPNOS_FORBIDDEN_KEYS` pattern.

### Skill Event Payloads (SKILL-03)

- **D-18-09:** Closed-tuple payloads (alphabetical key order, strict `Object.keys().sort()` equality enforced at sole-producer boundaries):
  - `skill.taught`: `{learner_did, parent_hash, skill_hash, teacher_did, tick}` — 5 keys
  - `skill.inferred`: `{learner_did, skill_hash, source_event_hash, tick}` — 4 keys
  - `skill.rejected`: `{learner_did, rejection_reason, tick}` — 3 keys, `rejection_reason ∈ {low_trust, structural_invalid, quota_exceeded}`

### parent_hash Semantics (SKILL-04) — Claude's Discretion

- **D-18-10:** For first-generation skills (teacher created the skill themselves, no predecessor in the lineage), `parent_hash` is the SHA-256 of the teacher's own skill text at teach-time (the same hash as `skill_hash` in the teacher's SkillStore entry). This makes lineage roots self-referential in the SQL self-join (`parent_hash = skill_hash` = root). Sentinel `null` is avoided to keep the SQL self-join clean (`WHERE parent_hash IS NOT NULL` clauses not needed).

### Claude's Discretion

- `parent_hash` construction for first-generation skills (D-18-10 above — decided by Claude).
- Exact SQL schema for `skills_quarantine` beyond the required 5 columns.
- Internal promotion scan cadence within `on_tick()` (check every tick vs. batched check every N ticks — determinism requires consistency; recommend check every tick).
- `ActionType` naming for the 3 new Grid-forwarded events: `SKILL_TAUGHT`, `SKILL_INFERRED`, `SKILL_REJECTED` — follow Phase 17 Iris naming pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §SKILL-01..04 — authoritative acceptance criteria for Phase 18
- `.planning/STATE.md` §v2.4 Critical Invariants — PeerSkillFilter wiring gap, FORBIDDEN_KEY_PATTERN additions, allowlist budget

### Existing Brain Modules (read before touching)
- `brain/src/noesis_brain/skills/peer_filter.py` — PeerSkillFilter implementation (complete, unwired)
- `brain/src/noesis_brain/learning/observational.py` — ObservationalLearner (trade.settled path only)
- `brain/src/noesis_brain/rpc/handler.py` — BrainHandler on_message + on_tick (integration points)
- `brain/src/noesis_brain/rpc/types.py` — ActionType enum (add SKILL_TAUGHT, SKILL_INFERRED, SKILL_REJECTED here)
- `brain/src/noesis_brain/skills/store.py` — SkillStore (active table; quarantine table is NEW)

### Grid Patterns (read before implementing emitters)
- `grid/src/audit/broadcast-allowlist.ts` — FORBIDDEN_KEY_PATTERN + ALLOWLIST_MEMBERS (extend both in Wave 0)
- `grid/src/integration/nous-runner.ts` — NousRunner action dispatch (add 3 skill cases here)
- `grid/src/whisper/router.ts` — Whisper routing for __skill_share delivery context
- `grid/src/iris/index.js` — Phase 17 sole-producer emitter pattern (copy for skill emitters)

### Phase 17 Context (pattern reference)
- `.planning/phases/17-iris-theory-of-mind/17-CONTEXT.md` — 3-keys-not-5 invariant, ActionType dispatch pattern, NousRunner integration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PeerSkillFilter.evaluate()` — ready to call from `BrainHandler.on_message()` when `__skill_share:` prefix detected; returns `Skill | None`
- `ObservationalLearner.observe_trade()` — already dispatched as `asyncio.create_task` in `on_tick()`; DID/numeric filter wraps the extraction result before `skill_store.add()`
- `IRIS_FORBIDDEN_KEYS` / `HYPNOS_FORBIDDEN_KEYS` pattern in `broadcast-allowlist.ts` — copy for `SKILL_FORBIDDEN_KEYS`
- Phase 17 `appendIrisBeliefRevised.ts` etc. — sole-producer emitter template for `appendSkillTaught.ts`, `appendSkillInferred.ts`, `appendSkillRejected.ts`

### Established Patterns
- Brain metadata: 1-3 keys from Brain, `{nous_did, tick}` injected by Grid (3-keys-not-5)
- `asyncio.create_task()` for all async Brain work in tick path (never `await` in tick entry point)
- Wave 0 = FORBIDDEN_KEY_PATTERN extension + allowlist baseline assertion FIRST, every phase
- Sole-producer boundary: one emitter file per event type, emitter imported only by NousRunner

### Integration Points
- `BrainHandler.on_message()` at the `text` parsing step: detect `text.startswith("__skill_share:")` → strip prefix → parse JSON → call `PeerSkillFilter.evaluate()`
- `BrainHandler.on_tick()` quarantine sweep: before ObservationalLearner dispatch, scan `skills_quarantine` for rows where `promote_at_tick <= current_tick`, check trust, promote or evict
- `NousRunner.tick()` action dispatch: 3 new `case` branches for `skill_taught`, `skill_inferred`, `skill_rejected` following Phase 17 Iris pattern

</code_context>

<specifics>
## Specific Ideas

- **Quarantine sweep timing:** Run quarantine promotion check at the START of `on_tick()` (before ObservationalLearner dispatch), so a skill can be promoted and potentially used in the same tick it matures.
- **3-hop lineage test:** The SKILL-04 success criterion (3-hop chain observable without operator intervention) should be verified in the integration test suite using a deterministic 4-Nous rig: A teaches B (skill.taught pos 37), B teaches C (parent_hash traces to A→B), C teaches D. SQL self-join on `skill_hash` / `parent_hash` reconstructs the chain.

</specifics>

<deferred>
## Deferred Ideas

- Extension of ObservationalLearner to `nous.spoke` or `skill.taught` event sources — deferred to a future phase per D-18-04.
- Trust-threshold tuning per Nous personality (requires Psyche integration) — out of scope per ROADMAP.md Phase 18.
- Cross-Grid skill sharing (multi-Grid federation) — out of scope per ROADMAP.md Phase 18.
- `parent_hash` for OL-inferred skills: SKILL-03 spec uses `source_event_hash` (the audit event hash of the trade.settled that triggered inference), not parent_hash. parent_hash is whisper-teach path only. Claude's discretion for OL path.

</deferred>

---

*Phase: 18-skill-diffusion*
*Context gathered: 2026-05-16*
