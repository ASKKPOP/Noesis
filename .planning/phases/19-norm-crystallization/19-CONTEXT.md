# Phase 19: Norm Crystallization — Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 19 delivers `NormDetector` as a pure-observer Grid-side listener on the existing `nous.self_model_revised` audit event (pos 29). When N≥3 distinct Nous share the same `revision_hash` fingerprint within a W-tick sliding window, `norm.candidate` (pos 40) fires. When a candidate cluster remains stable for K ticks, `norm.crystallized` (pos 41) fires. Norms are operator-observable only — never injected, never enforced. Two new allowlist events. Grid-side MySQL tables only. No new dashboard panel (Phase 21).

**What Phase 19 must build:**
1. Wave 0: Audit Brain `rules.py` — verify `revision_hash` is the 6-char n-gram fingerprint; fix if it's full SHA-256. Extend FORBIDDEN_KEY_PATTERN. Assert allowlist count is 39 before norm events land.
2. Wave 1: MySQL migrations for `norm_candidates` + `norm_registry` tables (via MigrationRunner).
3. Wave 2: `NormDetector` class (pure-observer, zero `AuditChain.append` calls) + `appendNormCandidate.ts` + `appendNormCrystallized.ts` sole-producer emitters.
4. Wave 3: Causal lineage gate (RelationshipListener edge lookup for `convergence_type`). REST endpoint `/api/v1/grid/norms`.
5. Wave 4: Startup rebuild (replay last W-tick `nous.self_model_revised` events into `norm_candidates`). Tests: zero-diff, closed-tuple payloads, sole-producer, fingerprint determinism.

</domain>

<decisions>
## Implementation Decisions

### Fingerprint Wire Format (CRITICAL)

- **D-19-01:** `revision_hash` in `nous.self_model_revised` IS the n-gram fingerprint — the 6-char hex prefix of SHA-256 over sorted word-trigrams of lowercased rule text. This was always the design intent. Phase 19 Wave 0 MUST audit `brain/src/noesis_brain/learning/rules.py` `RuleStore.add()` to verify the computation. If Phase 15 implemented it as full SHA-256 of rule content, Phase 19 must fix it to compute the 6-char n-gram fingerprint instead. The `nous.self_model_revised` closed-tuple stays 3 keys — only the hash computation changes. NormDetector receives this fingerprint directly from `revision_hash` and clusters on it; no new Brain action type needed.

- **D-19-02:** NormDetector counts **distinct Nous DIDs** per fingerprint cluster. If Nous A writes 3 rules with the same fingerprint, it counts as 1 participant. The N≥3 threshold (`NORM_THRESHOLD`) counts unique `nous_did` values in the sliding window — not `nous.self_model_revised` event count. Single-Nous inflation is architecturally impossible at the counting layer.

- **D-19-03:** The `revision_hash` fingerprint computation (Brain-side) is:
  ```python
  import hashlib, re
  def compute_norm_fingerprint(rule_text: str) -> str:
      """6-char hex n-gram fingerprint for norm clustering."""
      words = re.findall(r'[a-z]+', rule_text.lower())
      trigrams = sorted({' '.join(words[i:i+3]) for i in range(len(words)-2)})
      return hashlib.sha256(' '.join(trigrams).encode()).hexdigest()[:6]
  ```
  If no trigrams are extractable (rule < 3 words), use SHA-256 of the lowercased words joined by space, truncated to 6 chars. This is deterministic (no wall-clock, no random, no LLM).

### Norm State Persistence

- **D-19-04:** Norm state lives in **two MySQL tables** via `MigrationRunner`. Two-table separation keeps mutable candidate state separate from immutable crystallized records:
  - `norm_candidates` — mutable, tracks active fingerprint clusters. Columns: `fingerprint CHAR(6) NOT NULL`, `participant_dids TEXT NOT NULL` (JSON array of DIDs), `first_seen_tick INT NOT NULL`, `last_updated_tick INT NOT NULL`, `grid_name VARCHAR(255) NOT NULL`. Primary key: `(fingerprint, grid_name)`.
  - `norm_registry` — immutable append-only, records crystallized norms. Columns: `norm_id VARCHAR(64) NOT NULL` (UUID), `fingerprint CHAR(6) NOT NULL`, `crystallized_tick INT NOT NULL`, `participant_count INT NOT NULL`, `convergence_type ENUM('emergent','coincidental') NOT NULL`, `event_hash VARCHAR(64) NOT NULL`, `grid_name VARCHAR(255) NOT NULL`. Primary key: `norm_id`.

- **D-19-05:** On Grid restart, NormDetector **rebuilds** `norm_candidates` from the audit chain by replaying `nous.self_model_revised` events from the last `NORM_WINDOW_TICKS` (W=10) ticks. Pattern clones RelationshipListener's idempotent rebuild (Phase 9). `norm_registry` (crystallized) survives restart as-is — no rebuild needed. Rebuild runs at Grid startup before the first tick is dispatched.

### NormDetector Architecture

- **D-19-06:** NormDetector is a Grid-side class in `grid/src/norms/` (new directory) that registers via `AuditChain.onAppend()`. It is a **pure observer** — zero `AuditChain.append` calls inside `NormDetector.ts`. All norm event emissions delegate to sole-producer emitter files (`appendNormCandidate.ts`, `appendNormCrystallized.ts`). Pattern is identical to `RelationshipListener` from Phase 9.

- **D-19-07:** `actorDid` for norm events is `did:noesis:grid` (Grid system DID). This is architecturally novel (all prior events used Nous DIDs as actorDid). The sole-producer emitters hardcode this value. Downstream CI grep gate must confirm `did:noesis:grid` passes `DID_RE` validation — verify against `protocol/src/identity/did.ts` before Wave 2.

- **D-19-08:** Causal lineage gate: to classify `convergence_type`, NormDetector uses the **RelationshipListener in-memory edge map** (Phase 9). If any pair of converging Nous has `edge.weight > 0`, the cluster is `"emergent"`. If all pairs have zero-weight or missing edges (no RelationshipListener record), the cluster is `"coincidental"`. This avoids audit-chain scanning; the RelationshipListener already maintains this efficiently.

### Thresholds and Configuration (Locked)

- **D-19-09:** Thresholds are GenesisLauncher config keys (injectable via TOML rig config):
  - `NORM_THRESHOLD` = 3 (minimum distinct Nous in cluster to fire `norm.candidate`)
  - `NORM_WINDOW_TICKS` = 10 (sliding window width for candidate detection)
  - `NORM_ADOPTION_TICKS` = 20 (stability duration required before `norm.crystallized`)
  These follow the Phase 14 rig config pattern exactly.

### Allowlist Events (Locked from STATE.md)

- **D-19-10:** Two new events, positions 40 and 41:
  - `norm.candidate` (pos 40): `{convergence_type, fingerprint, participating_count, tick}` — 4 keys, alphabetical
  - `norm.crystallized` (pos 41): `{convergence_type, evidence_tick_range, fingerprint, participating_count, tick}` — 5 keys, alphabetical
  - `evidence_tick_range` is a 2-element array `[first_seen_tick, crystallized_tick]`
  - Both use `Object.keys().sort()` strict equality at sole-producer boundary

### Wave 0 Safety Gate

- **D-19-11:** Wave 0 must:
  1. Audit Brain `rules.py` `RuleStore.add()` and fix fingerprint computation if wrong (D-19-03)
  2. Extend `FORBIDDEN_KEY_PATTERN` with `norm_text|fingerprint_text|rule_content` (norm-specific forbidden keys; Brain-private rule text MUST NOT cross the wire via any norm event)
  3. Assert `ALLOWLIST_MEMBERS.length === 39` before `norm.candidate`/`norm.crystallized` are added
  4. Export `NORM_FORBIDDEN_KEYS` constant (follows `SKILL_FORBIDDEN_KEYS` / `HYPNOS_FORBIDDEN_KEYS` pattern)

### REST API Endpoint

- **D-19-12:** `GET /api/v1/grid/norms` returns **crystallized norms only** from `norm_registry`. Response shape (follows existing Grid API patterns):
  ```json
  {
    "norms": [
      {
        "norm_id": "uuid",
        "fingerprint": "a1b2c3",
        "crystallized_tick": 450,
        "participant_count": 4,
        "convergence_type": "emergent",
        "evidence_tick_range": [410, 450]
      }
    ]
  }
  ```
  Candidate norms are not exposed via REST (they are transient; observable only via the audit firehose `norm.candidate` events).

### Claude's Discretion

- Exact SQL schema beyond the required columns (indexes, NULL constraints, default values).
- Whether NormDetector's in-memory sliding window accumulates fingerprint→Set<DID> in a `Map<string, Map<string, Set<string>>>` (window_tick_bucket → fingerprint → Set<DID>) or a flat structure — recommend flat Map<fingerprint, {dids: Set<DID>, ticks: number[]}> for simplicity.
- Defection handling: if a Nous rewrites a rule (new fingerprint) during the K-tick crystallization window, the old cluster loses that DID. If participant count drops below N, `norm.candidate` is NOT re-emitted (no defection event). The candidate evicts from `norm_candidates` silently.
- Whether the startup rebuild runs synchronously or as an async task at Grid init.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §NORM-01..03 — authoritative acceptance criteria for Phase 19
- `.planning/STATE.md` §v2.4 Critical Invariants — `norm.candidate`/`norm.crystallized` locked payloads, actorDid, NormDetector pure-observer constraint
- `.planning/STATE.md` §v2.4 Agora Allowlist budget — running total 39→41

### Research Foundations
- `.planning/research/v2.4/STACK.md` §Norm Crystallization — n-gram fingerprint design rationale, why no semantic embedding
- `.planning/research/v2.4/ARCHITECTURE.md` §NormDetector — component design, sliding window structure, MySQL table sketch

### Existing Code to Read Before Touching
- `brain/src/noesis_brain/learning/rules.py` — `RuleStore.add()` — MUST audit hash computation in Wave 0
- `grid/src/audit/broadcast-allowlist.ts` — FORBIDDEN_KEY_PATTERN + ALLOWLIST_MEMBERS (extend both Wave 0)
- `grid/src/relationships/listener.ts` — RelationshipListener pure-observer pattern (clone for NormDetector)
- `grid/src/relationships/canonical.ts` — Phase 9 edge key / sort patterns
- `grid/src/relationships/storage.ts` — MigrationRunner table creation pattern for Phase 9
- `grid/src/integration/nous-runner.ts` — NousRunner action dispatch (no new cases needed; NormDetector hooks via AuditChain.onAppend)
- `grid/src/skills/appendSkillTaught.ts` — sole-producer emitter template for `appendNormCandidate.ts`

### Phase Patterns
- `.planning/phases/09-relationship-graph-derived-view/09-CONTEXT.md` — pure-observer listener, MySQL derived table, idempotent rebuild pattern
- `.planning/phases/18-skill-diffusion/18-CONTEXT.md` — Wave 0 safety gate discipline, FORBIDDEN_KEY_PATTERN extension pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RelationshipListener` (`grid/src/relationships/listener.ts`) — direct structural clone for `NormDetector`. Constructor takes `AuditChain`; registers `onAppend`. Zero `audit.append` calls.
- `RelationshipListener.getEdge()` — available for causal lineage lookups (D-19-08). If `getEdge(didA, didB)` returns undefined or weight=0, pair has no interaction history → `"coincidental"`.
- `MigrationRunner` — existing MySQL migration runner; clone the Phase 9 migration file for `norm_candidates`/`norm_registry` tables.
- `appendSkillTaught.ts` (Phase 18) — sole-producer emitter template with `Object.keys().sort()` payload validation.
- `HYPNOS_FORBIDDEN_KEYS` / `SKILL_FORBIDDEN_KEYS` export pattern in `broadcast-allowlist.ts` — copy for `NORM_FORBIDDEN_KEYS`.

### Established Patterns
- Wave 0 = FORBIDDEN_KEY_PATTERN extension + allowlist baseline assertion FIRST (Phase 18 discipline)
- Pure-observer = register via `AuditChain.onAppend()`, never call `audit.append` inside the listener
- Sole-producer boundary = one emitter file per event, emitter imported only by NormDetector
- `actorDid = did:noesis:grid` is new for norm events — verify DID_RE accepts it before emitting
- GenesisLauncher config injection: follow `NORM_THRESHOLD`, `NORM_WINDOW_TICKS`, `NORM_ADOPTION_TICKS` pattern from Phase 14 rig config

### Integration Points
- `NormDetector` wired at `GenesisLauncher` startup (after `RelationshipListener` is wired), receives same `AuditChain` reference
- `NormDetector` constructor takes `RelationshipListener` reference (for causal lineage) + MySQL pool + config thresholds
- REST endpoint `GET /api/v1/grid/norms` added to existing Fastify API router (`grid/src/api/`)
- Startup rebuild: `NormDetector.rebuild(fromTick: number)` called by GenesisLauncher after RelationshipListener rebuild

</code_context>

<specifics>
## Specific Ideas

- **Fingerprint computation location**: The n-gram fingerprint must be computed in `RuleStore.add()` in `brain/src/noesis_brain/learning/rules.py`, replacing whatever hash was previously used for `revision_hash`. The exact regex `r'[a-z]+'` (only alphabetic tokens, no punctuation) keeps the trigram set stable regardless of punctuation variation — "trade first" and "trade, first" produce the same trigrams.
- **Zero-diff test**: After NormDetector wires to AuditChain, verify that registering its `onAppend` listener does NOT change any existing entry's `eventHash` in the chain. Clone `grid/test/relationships/zero-diff.test.ts` as `grid/test/norms/zero-diff.test.ts`.
- **Emergent vs coincidental edge case**: Nous that have traded with each other (weight > 0 via `trade.settled`) count as "emergent" even if they never spoke. RelationshipListener already tracks trade events as positive-valence interactions.

</specifics>

<deferred>
## Deferred Ideas

- Causal lineage via direct audit-chain scan (O(N) over event log) — RelationshipListener edge lookup is sufficient and O(1).
- REST endpoint for candidates (transient state; observable via audit firehose instead).
- Defection events (`norm.weakened` or similar) — norms that drop below threshold after crystallization are observable via absence of updates in `norm_registry`, not via a new event.
- `norm.candidate` REST exposure — deferred; candidates are transient and discoverable via the audit firehose WebSocket.

</deferred>

---

*Phase: 19-norm-crystallization*
*Context gathered: 2026-05-16*
