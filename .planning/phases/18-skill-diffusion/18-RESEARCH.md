# Phase 18: Skill Diffusion — Research

**Researched:** 2026-05-16
**Domain:** Brain wiring (PeerSkillFilter, ObservationalLearner, QuarantineStore) + Grid sole-producer emitters (skill.taught, skill.inferred, skill.rejected)
**Confidence:** HIGH — all findings verified by direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-18-01 — QUARANTINE_TICKS:** Configurable via TOML RIG config (key `quarantine_ticks`), default 5 ticks. Lives in `brain/src/noesis_brain/skills/quarantine.py` (new module). Follows NORM_THRESHOLD/NORM_WINDOW_TICKS TOML pattern.

**D-18-02 — Trust eviction:** If teacher relationship-graph weight drops below `TRUST_THRESHOLD_SKILL` (0.35) while skill is in quarantine, the skill is evicted. Eviction emits `skill.rejected` with `rejection_reason = "low_trust"`. Check runs at every `on_tick()` quarantine-promotion scan.

**D-18-03 — Quarantine schema:** Separate `skills_quarantine` table in per-Nous Brain SQLite DB:
```sql
CREATE TABLE IF NOT EXISTS skills_quarantine (
    skill_hash TEXT PRIMARY KEY,
    source_did TEXT NOT NULL,
    received_tick INTEGER NOT NULL,
    promote_at_tick INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);
```
Promotion = `INSERT INTO skills` then `DELETE FROM skills_quarantine WHERE skill_hash = ?`. Not a status flag.

**D-18-04 — OL scope:** ObservationalLearner infers from `trade.settled` events only in Phase 18. Extension to `nous.spoke`/`skill.taught` is deferred.

**D-18-05 — DID/numeric filter:** Regex filter applied to LLM-extracted skill text before quarantine entry. Reject if skill text matches `r'\bdid:noesis:\S+\b|\b\d{4,}\b'`. Rejection emits `skill.rejected` with `rejection_reason = "structural_invalid"`.

**D-18-06 — OL rate-limit:** One skill creation per sleep epoch (30 ticks) per Nous per observed pair. `MIN_OBSERVATIONS_BEFORE_EXTRACT = 2` preserved.

**D-18-07 — Allowlist sequencing:** Wave 0 MUST assert `ALLOWLIST_MEMBERS.length === 36` before adding the 3 new skill events. New positions: `skill.taught` (37), `skill.inferred` (38), `skill.rejected` (39).

**D-18-08 — FORBIDDEN_KEY_PATTERN extension (Wave 0):** Add `skill_body`, `skill_text`, `rule_text` to FORBIDDEN_KEY_PATTERN in `grid/src/audit/broadcast-allowlist.ts`. New constant `SKILL_FORBIDDEN_KEYS` following `IRIS_FORBIDDEN_KEYS`/`HYPNOS_FORBIDDEN_KEYS` pattern.

**D-18-09 — Closed-tuple payloads (alphabetical key order):**
- `skill.taught`: `{learner_did, parent_hash, skill_hash, teacher_did, tick}` — 5 keys
- `skill.inferred`: `{learner_did, skill_hash, source_event_hash, tick}` — 4 keys
- `skill.rejected`: `{learner_did, rejection_reason, tick}` — 3 keys; `rejection_reason ∈ {low_trust, structural_invalid, quota_exceeded}`

**D-18-10 — parent_hash for first-generation skills:** `parent_hash = SHA-256(teacher's own skill text)` — same as `skill_hash` in teacher's SkillStore (self-referential root). Sentinel `null` avoided.

### Claude's Discretion

- Exact SQL schema for `skills_quarantine` beyond the required 5 columns.
- Internal promotion scan cadence within `on_tick()` — check every tick for determinism.
- `ActionType` naming for 3 new Grid-forwarded events: `SKILL_TAUGHT`, `SKILL_INFERRED`, `SKILL_REJECTED` — follow Phase 17 Iris naming pattern.
- Quarantine sweep runs at START of `on_tick()` (before ObservationalLearner dispatch).

### Deferred Ideas (OUT OF SCOPE)

- Extension of ObservationalLearner to `nous.spoke` or `skill.taught` event sources.
- Trust-threshold tuning per Nous personality.
- Cross-Grid skill sharing (multi-Grid federation).
- `parent_hash` for OL-inferred skills (SKILL-03 spec uses `source_event_hash`).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKILL-01 | Wire PeerSkillFilter into BrainHandler.on_message() for `__skill_share:` messages; add quarantine stage (N-tick hold, trust re-check on eviction) | D-18-01/02/03 quarantine design verified; BrainHandler.on_message() confirmed has NO `__skill_share:` dispatch (grep zero hits). Integration point: after `text` parsing step, before LLM call. |
| SKILL-02 | ObservationalLearner applies DID/numeric filter before quarantine entry; provenance tag `source: observed`; rate-limit preserved | ObservationalLearner verified: `observe_trade()` calls `self._skill_store.add(skill)` directly — Phase 18 must redirect to quarantine first. DID/numeric filter (D-18-05) is new code, does not exist yet. |
| SKILL-03 | Three new allowlisted events: `skill.taught` (37), `skill.inferred` (38), `skill.rejected` (39) with closed-tuple payloads | Verified allowlist is at exactly 36 events (confirmed by reading broadcast-allowlist.ts). Three sole-producer emitters follow appendIrisBeliefRevised.ts 10-step validation template. |
| SKILL-04 | Skill lineage reconstructable from audit chain via `parent_hash` in `skill.taught`; SQL self-joins on `lineage_parent_hash TEXT` column in SkillStore schema | SkillStore.add() verified — schema does NOT yet have `lineage_parent_hash` column. Must be added. D-18-10 defines self-referential root for first-gen skills. |
</phase_requirements>

---

## Summary

Phase 18 is a **wiring phase** — the core intelligence (PeerSkillFilter, ObservationalLearner) already exists and is tested, but is not connected to any live execution path. The work is: (1) extend the Brain to route `__skill_share:` whisper messages through PeerSkillFilter into a new quarantine table, (2) add a quarantine sweep to `on_tick()` that promotes or evicts skills, (3) add DID/numeric filter to ObservationalLearner's skill-acceptance path, (4) add three new `ActionType` members and three Grid sole-producer emitters following the exact Phase 17 Iris pattern, and (5) add `lineage_parent_hash` to the `skills` table schema.

Every architectural pattern needed exists in the codebase. The Phase 17 Iris emitters (`appendIrisBeliefRevised.ts`) are the canonical template for all three skill emitters. The NousRunner `iris_belief_revised` case is the canonical template for all three skill dispatch cases.

**Primary recommendation:** Wave 0 = FORBIDDEN_KEY_PATTERN + allowlist-36-baseline assertion. Wave 1 = Brain wiring (`__skill_share:` dispatch + quarantine module + `on_tick()` sweep). Wave 2 = ObservationalLearner DID/numeric filter + `ActionType` additions. Wave 3 = Grid emitters + NousRunner dispatch. Tests after each wave.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `__skill_share:` message detection | Brain (BrainHandler.on_message) | — | Brain owns incoming DM routing; whisper delivers to Brain, Brain parses prefix |
| Trust gate check | Brain (PeerSkillFilter) | — | Relationship graph weight queried by Brain; Grid has no access to per-Nous trust state |
| Quarantine storage | Brain (SQLite per-Nous) | — | Quarantine is Brain-local; skill content never crosses Brain↔Grid wire |
| Quarantine promotion / eviction sweep | Brain (BrainHandler.on_tick) | — | Tick-driven sweep; Brain owns the quarantine table |
| DID/numeric filter on OL skills | Brain (ObservationalLearner wrapper) | — | Deterministic synchronous regex; Brain-side filter before quarantine entry |
| Audit event emission (skill.taught/inferred/rejected) | Grid (NousRunner + emitters) | — | 3-keys-not-5 pattern; Grid injects nous_did + tick; sole-producer boundary |
| Lineage reconstruction | Consumer (SQL self-join on audit chain) | — | Parent_hash in skill.taught payloads; no runtime graph needed |
| FORBIDDEN_KEY_PATTERN enforcement | Grid (broadcast-allowlist.ts) | — | Final payloadPrivacyCheck gate at emitter boundary |

---

## Standard Stack

### Core (all VERIFIED by direct codebase inspection)

| Component | Location | Purpose | Phase Added |
|-----------|----------|---------|-------------|
| `PeerSkillFilter` | `brain/src/noesis_brain/skills/peer_filter.py` | 3-gate peer skill acceptance (trust, flood, injection scan) | Phase 15 — complete, unwired |
| `ObservationalLearner` | `brain/src/noesis_brain/learning/observational.py` | LLM-based skill extraction from witnessed trade.settled | Phase 16 — wired, no quarantine |
| `SkillStore` | `brain/src/noesis_brain/skills/store.py` | SQLite-backed skill library with FTS5 retrieval | Phase 15 |
| `BrainHandler` | `brain/src/noesis_brain/rpc/handler.py` | Core Brain dispatch loop (on_message, on_tick) | Phase 6 |
| `ActionType` enum | `brain/src/noesis_brain/rpc/types.py` | Brain action type registry | Phase 6 |
| `NousRunner` | `grid/src/integration/nous-runner.ts` | Grid action dispatch switch | Phase 6 |
| `broadcast-allowlist.ts` | `grid/src/audit/broadcast-allowlist.ts` | ALLOWLIST_MEMBERS + FORBIDDEN_KEY_PATTERN | Phase 2 |
| `appendIrisBeliefRevised.ts` | `grid/src/iris/` | Canonical sole-producer emitter template | Phase 17 |

### New in Phase 18

| Component | Location | Purpose |
|-----------|----------|---------|
| `QuarantineStore` | `brain/src/noesis_brain/skills/quarantine.py` (new) | `skills_quarantine` table operations (enqueue, sweep, evict) |
| `appendSkillTaught.ts` | `grid/src/skills/` (new dir) | Sole producer for `skill.taught` (pos 37) |
| `appendSkillInferred.ts` | `grid/src/skills/` (new dir) | Sole producer for `skill.inferred` (pos 38) |
| `appendSkillRejected.ts` | `grid/src/skills/` (new dir) | Sole producer for `skill.rejected` (pos 39) |

---

## Architecture Patterns

### System Architecture Diagram

```
Brain (per-Nous process)                Grid (NousRunner)
┌──────────────────────────────┐        ┌─────────────────────────────────┐
│                              │        │                                 │
│  WhisperRouter delivers      │        │  executeActions() switch:       │
│  __skill_share: text         │        │                                 │
│         │                    │        │  case 'skill_taught':           │
│         ▼                    │        │    appendSkillTaught(audit, ...)│
│  on_message():               │        │         │                       │
│    detect __skill_share:     │        │         ▼                       │
│    strip prefix, parse JSON  │        │    skill.taught (pos 37)        │
│         │                    │        │    audit chain append           │
│         ▼                    │        │                                 │
│  PeerSkillFilter.evaluate()  │        │  case 'skill_inferred':         │
│    Gate 1: trust ≥ 0.35      │        │    appendSkillInferred(...)     │
│    Gate 2: flood ≤ 3/source  │        │         │                       │
│    Gate 3: injection scan    │        │         ▼                       │
│         │                    │        │    skill.inferred (pos 38)      │
│    rejected ──────────────── ┼──────► │  case 'skill_rejected':         │
│    accepted ▼                │        │    appendSkillRejected(...)     │
│  QuarantineStore.enqueue()   │        │         │                       │
│    skills_quarantine table   │        │         ▼                       │
│    promote_at_tick = now+N   │        │    skill.rejected (pos 39)      │
│                              │        │                                 │
│  on_tick() — START:          │        └─────────────────────────────────┘
│    QuarantineStore.sweep():  │
│      for each row where      │        Actions carry 1-3 Brain metadata keys;
│      promote_at_tick ≤ tick: │        Grid injects learner_did + tick
│        re-check trust ≥ 0.35 │        (3-keys-not-5 invariant)
│        if trust OK:          │
│          promote → skills    │
│          emit SKILL_TAUGHT   │
│        else:                 │
│          evict               │
│          emit SKILL_REJECTED │
│          (low_trust)         │
│                              │
│  ObservationalLearner        │
│  observe_trade():            │
│    LLM extracts skill text   │
│    DID/numeric filter        │
│    if clean:                 │
│      QuarantineStore.enqueue │
│      emit SKILL_INFERRED     │
│    else:                     │
│      emit SKILL_REJECTED     │
│      (structural_invalid)    │
└──────────────────────────────┘
```

### Recommended Project Structure (new files)

```
brain/src/noesis_brain/skills/
├── peer_filter.py          # EXISTING — complete, unwired
├── store.py                # EXISTING — needs lineage_parent_hash column
├── quarantine.py           # NEW — QuarantineStore + QUARANTINE_TICKS constant
└── types.py                # EXISTING — Skill dataclass

brain/src/noesis_brain/learning/
└── observational.py        # EXISTING — needs DID/numeric filter wrapping _skill_store.add()

grid/src/skills/            # NEW directory (mirrors grid/src/iris/ structure)
├── types.ts                # NEW — payload interfaces + EXPECTED_KEYS tuples
├── appendSkillTaught.ts    # NEW — sole producer (10-step validation template)
├── appendSkillInferred.ts  # NEW — sole producer
├── appendSkillRejected.ts  # NEW — sole producer
└── index.ts                # NEW — re-exports (mirrors grid/src/iris/index.ts)
```

### Pattern 1: Brain `__skill_share:` Dispatch in on_message()

Integration point: after `text` parsing, before Thymos/LLM path. Confirmed by inspecting `on_message()` lines 119-223 — there is no `__skill_share:` handling anywhere.

```python
# In BrainHandler.on_message() — insert BEFORE the Thymos update (line ~134)
# Source: verified by reading brain/src/noesis_brain/rpc/handler.py

SKILL_SHARE_PREFIX = "__skill_share:"

if text.startswith(SKILL_SHARE_PREFIX):
    # Strip prefix, parse JSON payload
    raw_json = text[len(SKILL_SHARE_PREFIX):]
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError:
        return []  # malformed — silent drop per Brain discipline
    
    # Route through PeerSkillFilter (trust gate + flood gate + injection scan)
    if self._peer_filter is not None:
        skill = self._peer_filter.evaluate(payload, source_did=sender_did)
        if skill is None:
            # Rejected — return SKILL_REJECTED action (Grid emits skill.rejected)
            return [Action(
                action_type=ActionType.SKILL_REJECTED,
                metadata={
                    "rejection_reason": "low_trust",  # or flood/injection from filter
                },
            ).to_dict()]
        # Accepted — route to quarantine (not active store)
        parent_hash = payload.get("parent_hash", skill.skill_hash)
        self._quarantine_store.enqueue(skill, source_did=sender_did, tick=current_tick, parent_hash=parent_hash)
        # No action returned yet — SKILL_TAUGHT fires when promoted from quarantine
    return []  # __skill_share is not a conversational message; no speak response
```

### Pattern 2: QuarantineStore Module (new file)

The quarantine module follows the SkillStore pattern — wraps the shared SQLite connection.

```python
# Source: design from 18-CONTEXT.md D-18-03, pattern from brain/src/noesis_brain/skills/store.py

import os

QUARANTINE_TICKS_DEFAULT = 5

def get_quarantine_ticks() -> int:
    """Read from RIG TOML config or fall back to default (D-18-01)."""
    # Config injection point — TOML rig config supplies quarantine_ticks
    return int(os.environ.get("QUARANTINE_TICKS", QUARANTINE_TICKS_DEFAULT))

QUARANTINE_TICKS = get_quarantine_ticks()

class QuarantineStore:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._ensure_table()
    
    def _ensure_table(self) -> None:
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS skills_quarantine (
                skill_hash TEXT PRIMARY KEY,
                source_did TEXT NOT NULL,
                received_tick INTEGER NOT NULL,
                promote_at_tick INTEGER NOT NULL,
                payload_json TEXT NOT NULL
            )
        """)
        self._conn.commit()
    
    def enqueue(self, skill: Skill, source_did: str, tick: int, parent_hash: str) -> None:
        """Insert skill into quarantine; promote_at_tick = tick + QUARANTINE_TICKS."""
        ...
    
    def sweep(self, current_tick: int, trust_fn: Callable[[str], float]) -> list[QuarantineResult]:
        """Return list of QuarantineResult (promoted or evicted) for current tick."""
        ...
```

### Pattern 3: on_tick() Quarantine Sweep

Runs at START of on_tick(), before ObservationalLearner dispatch (per CONTEXT.md specifics).

```python
# In BrainHandler.on_tick() — insert BEFORE the ObservationalLearner block (line ~339)
# Source: handler.py lines 338-353 for OL pattern; CONTEXT.md timing decision

if self._quarantine_store is not None and self._peer_filter is not None:
    results = self._quarantine_store.sweep(
        current_tick=tick,
        trust_fn=self._peer_filter._trust_fn,  # same trust fn used at accept time
    )
    for r in results:
        if r.promoted:
            # skill promoted to active store — emit SKILL_TAUGHT
            actions.append(Action(
                action_type=ActionType.SKILL_TAUGHT,
                metadata={
                    "skill_hash": r.skill_hash,
                    "teacher_did": r.source_did,
                    "parent_hash": r.parent_hash,
                },
            ).to_dict())
        else:
            # evicted — emit SKILL_REJECTED(low_trust)
            actions.append(Action(
                action_type=ActionType.SKILL_REJECTED,
                metadata={"rejection_reason": "low_trust"},
            ).to_dict())
```

### Pattern 4: OL DID/Numeric Filter (wrapping observe_trade)

The filter intercepts before `self._skill_store.add(skill)` in ObservationalLearner.observe_trade(). In Phase 18, the call must redirect to quarantine instead.

```python
# Source: observational.py lines 156-185; D-18-05 filter pattern

import re
_STRUCTURAL_INVALID_RE = re.compile(r'\bdid:noesis:\S+\b|\b\d{4,}\b')

# After LLM extracts `instructions`, before storing:
if _STRUCTURAL_INVALID_RE.search(instructions):
    logger.warning("ObservationalLearner: structural_invalid filter hit — rejecting skill")
    return None  # caller emits SKILL_REJECTED(structural_invalid) action
```

### Pattern 5: ActionType Additions (3 new members)

```python
# In brain/src/noesis_brain/rpc/types.py — follow Phase 17 Iris pattern (lines 42-48)
# Source: types.py verified by reading

# Phase 18 — Grid-forwarded skill lifecycle events.
# String values MUST match the Grid NousRunner switch cases exactly.
# 3-keys-not-5: Brain metadata carries 1-3 keys; Grid injects learner_did and tick.
SKILL_TAUGHT = "skill_taught"    # Metadata: {skill_hash, teacher_did, parent_hash} (3 keys)
SKILL_INFERRED = "skill_inferred" # Metadata: {skill_hash, source_event_hash} (2 keys)
SKILL_REJECTED = "skill_rejected" # Metadata: {rejection_reason} (1 key)
```

### Pattern 6: Grid Sole-Producer Emitters (copy from appendIrisBeliefRevised.ts)

The 10-step validation pattern is identical for all three skill emitters. Copying from `appendIrisBeliefRevised.ts`:

```typescript
// Source: grid/src/iris/appendIrisBeliefRevised.ts — 10-step template
// grid/src/skills/appendSkillTaught.ts

export const SKILL_TAUGHT_KEYS = [
    'learner_did', 'parent_hash', 'skill_hash', 'teacher_did', 'tick'
] as const;  // alphabetical — 5 keys

export function appendSkillTaught(
    audit: AuditChain,
    actorDid: string,  // learner's DID (3-keys-not-5: Grid injects)
    payload: SkillTaughtPayload,
): AuditEntry {
    // Steps 1-2: DID_RE on actorDid + payload.learner_did
    // Step 3: self-report invariant (payload.learner_did === actorDid)
    // Step 4: tick non-negative integer
    // Step 5: DID_RE on payload.teacher_did
    // Step 6: hash format on payload.skill_hash (64-char hex)
    // Step 6b: hash format on payload.parent_hash (64-char hex)
    // Step 7: closed-tuple check (Object.keys(payload).sort() === SKILL_TAUGHT_KEYS)
    // Step 8: explicit reconstruction
    // Step 9: payloadPrivacyCheck (SKILL_FORBIDDEN_KEYS coverage)
    // Step 10: audit.append('skill.taught', actorDid, cleanPayload)
}
```

### Pattern 7: NousRunner Dispatch Cases (copy from iris_belief_revised)

```typescript
// Source: nous-runner.ts lines 634-654 — iris_belief_revised case

case 'skill_taught': {
    // Phase 18 D-18-09: Grid injects learner_did+tick (3-keys-not-5).
    // Brain sends skill_hash, teacher_did, parent_hash (3 keys).
    // Sole producer: appendSkillTaught. Rejections drop silently.
    try {
        appendSkillTaught(this.audit, this.nousDid, {
            learner_did: this.nousDid,
            tick,
            skill_hash: action.metadata['skill_hash'] as string,
            teacher_did: action.metadata['teacher_did'] as string,
            parent_hash: action.metadata['parent_hash'] as string,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'skill.dispatch.rejected',
            action_type: 'skill_taught',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}
// similarly for skill_inferred and skill_rejected
```

### Pattern 8: SkillStore Schema Extension for Lineage

The `skills` table lacks `lineage_parent_hash`. Must add via `ALTER TABLE` in `SkillStore.__init__`:

```python
# Source: brain/src/noesis_brain/skills/store.py — no lineage_parent_hash column exists
# Add at table init time (ADD COLUMN is idempotent via try/except)

try:
    self._conn.execute(
        "ALTER TABLE skills ADD COLUMN lineage_parent_hash TEXT"
    )
    self._conn.commit()
except sqlite3.OperationalError:
    pass  # column already exists — idempotent
```

### Anti-Patterns to Avoid

- **Calling `self._skill_store.add(skill)` directly from ObservationalLearner in Phase 18:** In Phase 16 this was correct; in Phase 18 all skill creation paths must go through quarantine first. Update the OL store path to call `self._quarantine_store.enqueue()` instead.
- **Emitting SKILL_TAUGHT synchronously at accept-time:** skill.taught fires at PROMOTION from quarantine (after N ticks), not at accept-time. A Nous receives a DIRECT_MESSAGE, accepts it to quarantine, returns no skill.taught action. Skill.taught fires on a later tick when the quarantine sweep promotes it.
- **Using `await` in the on_tick() quarantine sweep entry path:** The quarantine sweep is synchronous (SQLite only; no LLM). Follow the existing pattern: synchronous sweep, emit actions from results. Only OL extraction uses `asyncio.create_task`.
- **Skipping Wave 0:** The FORBIDDEN_KEY_PATTERN extension MUST land before any emitter code. Otherwise a developer could accidentally add a `skill_text` key to a payload and it would pass the privacy check until the regression is caught.
- **Using `null` for parent_hash of first-generation skills:** D-18-10 specifies self-referential hash (`parent_hash = skill_hash`). This keeps SQL self-joins clean.
- **Adding skill body/text to `skill.taught` payload:** Skill content is BRAIN-PRIVATE. Only hashes cross the wire. `SKILL_FORBIDDEN_KEYS` enforces this at the emitter boundary.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prompt injection detection | Custom NLP scanner | `_INJECTION_RE` in `peer_filter.py` | Already implemented; 14 patterns; don't extend without threat analysis |
| Trust weight lookup | New relationship API | `relationship_weight_fn` injected into PeerSkillFilter constructor | Phase 9 graph already provides this; wire the existing callable |
| FTS5 skill search | Keyword loop | `SkillStore.retrieve(query, k)` | Already implemented with BM25 + trigger cascade |
| SHA-256 for skill_hash | Custom hash | `hashlib.sha256(instructions.encode()).hexdigest()` | Standard library; consistent with all other Brain hashes |
| 64-char hex validation in emitters | Custom regex | `HEX64_RE = /^[0-9a-f]{64}$/` from `appendIrisBeliefRevised.ts` | Project-standard pattern; re-export from iris or define in skills/types.ts |
| Closed-tuple enforcement | Manual key check | `Object.keys(payload).sort()` equality (established 10-step emitter pattern) | Catches both missing and extra keys; proven across 8 existing emitters |

**Key insight:** This phase wires existing modules, not new intelligence. The quarantine module is the only genuinely new code; everything else is routing/dispatch.

---

## Common Pitfalls

### Pitfall 1: BrainHandler.__init__ Injection Order

**What goes wrong:** `PeerSkillFilter` requires `skill_store` and `relationship_weight_fn`. In `BrainHandler.__init__`, `_skill_store` is constructed conditionally (only when `hypnos_db_dir` is not None, line ~99-103). If quarantine is initialized outside this block, it may get `None` for `_skill_store`.
**Why it happens:** Phase 16 wired OL and SkillStore inside the `if hypnos_db_dir is not None:` guard. PeerSkillFilter and QuarantineStore must follow the same guard.
**How to avoid:** Initialize `_peer_filter` and `_quarantine_store` inside the same `if hypnos_db_dir is not None:` block, after `_skill_store` is constructed.
**Warning signs:** `self._peer_filter is None` at runtime even when SkillStore is available.

### Pitfall 2: relationship_weight_fn Not Available at BrainHandler Construction

**What goes wrong:** PeerSkillFilter's `relationship_weight_fn` argument is a callable for Phase 9 graph weight lookup. BrainHandler does not currently have access to the relationship graph.
**Why it happens:** The relationship graph is a Grid-side derived view (REL-01); the Brain accesses it only via `relationship_context` parameter in `on_tick()`. At construction time there's no callable.
**How to avoid:** Two options (Claude's discretion): (a) Inject relationship context as a per-DID weight dict into `on_tick()` params (similar to `relationship_context` already present), then cache it as `self._cached_weights: dict[str, float]` and pass a closure to PeerSkillFilter. (b) Alternatively, PeerSkillFilter can be initialized with `relationship_weight_fn=None` (bypasses trust gate = test/offline mode) and the trust check happens inline in `on_message()` using the cached weights dict. Option (a) is cleaner.
**Warning signs:** All peer skills accepted regardless of trust (trust gate bypassed).

### Pitfall 3: skill.rejected Source Ambiguity

**What goes wrong:** `skill.rejected` can fire for three reasons: `low_trust` (PeerSkillFilter gate 1 or quarantine eviction), `structural_invalid` (OL DID/numeric filter), `quota_exceeded` (PeerSkillFilter gate 2 flood limit). Each is a different code path emitting the same event type with different `rejection_reason`.
**Why it happens:** Multiple Brain modules produce SKILL_REJECTED actions; the Grid NousRunner sees only the action type and routes all to `appendSkillRejected`.
**How to avoid:** The `rejection_reason` is Brain-supplied metadata (1 key). NousRunner passes it through. The emitter validates `rejection_reason ∈ {low_trust, structural_invalid, quota_exceeded}` as a closed enum. Add a `VALID_REJECTION_REASONS` set in `grid/src/skills/types.ts` (mirrors `VALID_REVIEW_FAILURE_CODES` in review/types.ts).
**Warning signs:** An unknown rejection_reason string passes through the emitter without throwing.

### Pitfall 4: Quarantine Promotion Emitting Wrong learner_did

**What goes wrong:** The quarantine row stores `source_did` (the teacher). The learner is `this.nousDid` in NousRunner. Brain must return the teacher_did in metadata; Grid injects learner_did from `this.nousDid`.
**Why it happens:** 3-keys-not-5 pattern — Grid always injects the actorDid. Brain metadata contains `{skill_hash, teacher_did, parent_hash}` (3 keys); Grid injects `learner_did` and `tick`.
**How to avoid:** In the quarantine sweep result, Brain carries `teacher_did` (= `source_did` from quarantine row) in metadata. Grid NousRunner uses `this.nousDid` as `learner_did`. The emitter checks self-report invariant (`payload.learner_did === actorDid`).

### Pitfall 5: Wave 0 FORBIDDEN_KEY_PATTERN Regression

**What goes wrong:** Adding `skill_body|skill_text|rule_text` to FORBIDDEN_KEY_PATTERN breaks existing emitters if any of them accidentally use one of those key names.
**Why it happens:** FORBIDDEN_KEY_PATTERN is a single regex applied recursively across ALL payloads. Adding new forbidden keys is irreversible without a CONTEXT.md decision.
**How to avoid:** Grep all existing payload shapes for `skill_body`, `skill_text`, `rule_text` before extending the pattern. Verify the test suite passes after Wave 0 with zero new emitters present.
**Warning signs:** Existing emitter tests fail with `privacy violation` after Wave 0.

### Pitfall 6: ObservationalLearner Quarantine Integration Breaks Deduplication

**What goes wrong:** OL currently deduplicates by checking `self._skill_store.get(slug) is not None` (line 144-146 of observational.py). After Phase 18, accepted skills live in quarantine before promotion. A second OL observation fires before promotion completes, and the dedup check misses the quarantine row.
**Why it happens:** `SkillStore.get()` queries the `skills` table only, not `skills_quarantine`.
**How to avoid:** Add a `QuarantineStore.has(slug)` check to the OL dedup gate: `if self._skill_store.get(slug) is not None or self._quarantine_store.has(slug): return None`.

---

## Code Examples

### Allowlist-36-Baseline Assertion Test (Wave 0)

```typescript
// grid/test/audit/skill-allowlist-baseline.test.ts — RED test, Wave 0
// Source: pattern from grid/test/audit/operator-exported-allowlist.test.ts

import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

describe('skill.* allowlist baseline — Phase 18 Wave 0', () => {
    it('allowlist is exactly 36 before skill events are added', () => {
        // This test documents the starting invariant. It becomes obsolete
        // when Wave 3 adds 3 events (36 → 39).
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(36);
    });
});
```

### SKILL_FORBIDDEN_KEYS Extension (Wave 0)

```typescript
// In grid/src/audit/broadcast-allowlist.ts — add after HYPNOS_FORBIDDEN_KEYS

/**
 * Phase 18 (D-18-08): skill-leaf keys that MUST NOT appear in any broadcast
 * payload. Skill body text, skill instructions, and rule text are Brain-private
 * and NEVER cross the Brain↔Grid wire. Only hashes (skill_hash, parent_hash,
 * source_event_hash) are permitted.
 */
export const SKILL_FORBIDDEN_KEYS = Object.freeze([
    'skill_body',
    'skill_text',
    'rule_text',
] as const);

// Extend FORBIDDEN_KEY_PATTERN: append |skill_body|skill_text|rule_text
// New pattern ends with: ...edge_content|skill_body|skill_text|rule_text/i
```

### 3-hop Lineage SQL Self-Join (SKILL-04 verification)

```sql
-- Reconstruct 3-hop lineage chain: A → B → C → D
-- Source: D-18-10; self-referential root where parent_hash = skill_hash
WITH RECURSIVE lineage(skill_hash, parent_hash, depth) AS (
    SELECT skill_hash, parent_hash, 0
    FROM skills
    WHERE skill_hash = parent_hash  -- root node (first-generation)
    UNION ALL
    SELECT s.skill_hash, s.parent_hash, l.depth + 1
    FROM skills s
    JOIN lineage l ON s.parent_hash = l.skill_hash
    WHERE l.depth < 10
)
SELECT skill_hash, parent_hash, depth FROM lineage ORDER BY depth;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct SkillStore.add() from OL (Phase 16) | Quarantine → promotion (Phase 18) | Phase 18 | Skills must survive N-tick hold before becoming active |
| PeerSkillFilter stores directly to active SkillStore | PeerSkillFilter → quarantine | Phase 18 | Trust is live precondition, not just admission gate |
| No skill lineage | `lineage_parent_hash` column + `parent_hash` in audit payload | Phase 18 | SQL self-join reconstructs ancestry without graph DB |
| ActionType has no skill Grid events | SKILL_TAUGHT, SKILL_INFERRED, SKILL_REJECTED added | Phase 18 | Grid can now emit skill lifecycle events |

**Missing from current codebase (confirmed by grep):**
- `skills_quarantine` table: does not exist
- `SKILL_TAUGHT`/`SKILL_INFERRED`/`SKILL_REJECTED` ActionType members: do not exist
- `__skill_share:` dispatch in `on_message()`: does not exist
- DID/numeric filter in ObservationalLearner: does not exist
- `lineage_parent_hash` column in `skills` table: does not exist
- `grid/src/skills/` directory: does not exist
- `skill_body|skill_text|rule_text` in FORBIDDEN_KEY_PATTERN: does not exist

---

## Assumptions Log

> No ASSUMED claims — all findings verified by direct inspection of source files.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | All claims verified or cited from source | — | — |

**This table is empty:** All claims were verified by reading source files in this session.

---

## Open Questions

1. **relationship_weight_fn injection mechanism**
   - What we know: PeerSkillFilter accepts `relationship_weight_fn: callable | None`; BrainHandler.on_tick() receives `relationship_context` as a list of edges from the Grid
   - What's unclear: Should the weight cache be updated from `relationship_context` edges in on_tick() and stored as `self._cached_peer_weights: dict[str, float]`? Or should the trust check be deferred to on_tick() quarantine sweep (using the same cache)?
   - Recommendation: Cache weights from `relationship_context` on each tick. Pass `lambda did: self._cached_peer_weights.get(did, 0.0)` as `relationship_weight_fn`. Both the `on_message()` accept gate and the `on_tick()` eviction check use the same lambda (which reads the live cache). This means trust weight at accept-time is from the previous tick's relationship_context — acceptable for determinism.

2. **skill_hash computation for quarantine enqueue**
   - What we know: skill.taught payload requires `skill_hash` (64-char hex); the Skill object from PeerSkillFilter.evaluate() does not currently carry a `skill_hash` field
   - What's unclear: Is `skill_hash = sha256(instructions)` or `sha256(name + instructions)`?
   - Recommendation: `sha256(skill.instructions.encode()).hexdigest()` — instructions are the unique behavioral content. Name is user-supplied and may collide. Document this as the canonical hash function in `quarantine.py`.

3. **NousRunner sleep_entered/sleep_completed dispatch gap**
   - What we know: `appendNousSleepEntered` and `appendNousSleepCompleted` exist in `grid/src/sleep/` but there are NO `case 'sleep_entered':` or `case 'sleep_completed':` branches in `nous-runner.ts`
   - What's unclear: How do Phase 16 sleep events actually get dispatched? (Possibly via a separate wiring point not read in this session)
   - Recommendation: Before adding skill dispatch cases, verify whether sleep cases are in a separate NousRunner extension file or handled elsewhere. If they're missing, Phase 18 should NOT add them (out of scope), but document the gap.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 18 is purely code wiring; no new external tools, databases, or services are required beyond the existing Python/TypeScript stack.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Grid framework | Vitest (from grid/test/ file patterns) |
| Brain framework | pytest (from brain/test/ file patterns) |
| Grid config | vitest.config.ts (inferred from project) |
| Brain config | pyproject.toml |
| Brain quick run | `cd brain && python -m pytest test/ -x -q` |
| Grid quick run | `cd grid && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKILL-01 | `__skill_share:` in on_message() routes to PeerSkillFilter | unit (Brain) | `pytest test/test_rpc_handler.py -x -k skill_share` | ❌ Wave 0 |
| SKILL-01 | Quarantine enqueued at accept-time (not active store) | unit (Brain) | `pytest test/test_quarantine_store.py -x` | ❌ Wave 0 |
| SKILL-01 | Trust eviction fires SKILL_REJECTED(low_trust) | unit (Brain) | `pytest test/test_quarantine_sweep.py -x -k eviction` | ❌ Wave 0 |
| SKILL-02 | DID filter rejects `did:noesis:` substring in extracted text | unit (Brain) | `pytest test/test_observational_filter.py -x -k did_filter` | ❌ Wave 0 |
| SKILL-02 | Numeric filter rejects 4+ digit integers | unit (Brain) | `pytest test/test_observational_filter.py -x -k numeric_filter` | ❌ Wave 0 |
| SKILL-03 | appendSkillTaught closed-tuple enforcement | unit (Grid) | `npx vitest run test/skills/appendSkillTaught.test.ts` | ❌ Wave 0 |
| SKILL-03 | appendSkillInferred closed-tuple enforcement | unit (Grid) | `npx vitest run test/skills/appendSkillInferred.test.ts` | ❌ Wave 0 |
| SKILL-03 | appendSkillRejected closed-tuple enforcement | unit (Grid) | `npx vitest run test/skills/appendSkillRejected.test.ts` | ❌ Wave 0 |
| SKILL-03 | Allowlist grows 36→39, positions 37-39 correct | unit (Grid) | `npx vitest run test/audit/skill-allowlist.test.ts` | ❌ Wave 0 |
| SKILL-03 | Sole-producer boundary (no other file calls audit.append with skill.*) | unit (Grid) | `npx vitest run test/skills/skill-producer-boundary.test.ts` | ❌ Wave 0 |
| SKILL-04 | 3-hop lineage observable via SQL self-join after teach chain | integration (Brain) | `pytest test/test_skill_lineage.py -x` | ❌ Wave 0 |
| SKILL-03 | SKILL_FORBIDDEN_KEYS not in any payload | unit (Grid) | `npx vitest run test/audit/skill-privacy.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Run only the test file(s) touched by that task
- **Per wave merge:** Full suite in affected service (`pytest test/ -x` for Brain waves; `npx vitest run` for Grid waves)
- **Phase gate:** Both suites fully green before `/gsd-verify-work`

### Verification Commands (Grep-Based)

```bash
# Verify __skill_share: dispatch wired (SKILL-01)
grep -n "__skill_share" brain/src/noesis_brain/rpc/handler.py

# Verify skills_quarantine table created (SKILL-01)
grep -rn "skills_quarantine" brain/src/noesis_brain/skills/

# Verify SKILL_TAUGHT/INFERRED/REJECTED in ActionType (SKILL-03)
grep -n "SKILL_TAUGHT\|SKILL_INFERRED\|SKILL_REJECTED" brain/src/noesis_brain/rpc/types.py

# Verify allowlist at 39 (SKILL-03)
grep -c "'" grid/src/audit/broadcast-allowlist.ts  # count strings in ALLOWLIST_MEMBERS

# Verify skill.taught at position 37 (SKILL-03)
node -e "const {ALLOWLIST_MEMBERS} = require('./src/audit/broadcast-allowlist.js'); console.log(ALLOWLIST_MEMBERS.length, ALLOWLIST_MEMBERS[36]);"

# Verify sole-producer boundary — no rogue audit.append calls (SKILL-03)
grep -rn "audit.append.*skill\." grid/src/ | grep -v "appendSkill"

# Verify FORBIDDEN_KEY_PATTERN extended (D-18-08)
grep -o "skill_body\|skill_text\|rule_text" grid/src/audit/broadcast-allowlist.ts

# Verify lineage_parent_hash column exists (SKILL-04)
grep -n "lineage_parent_hash" brain/src/noesis_brain/skills/store.py

# Verify DID/numeric filter in OL (SKILL-02)
grep -n "did:noesis:\|\\\\d{4" brain/src/noesis_brain/learning/observational.py

# 3-hop lineage observable: run deterministic 4-Nous test rig
# (manual/integration test per CONTEXT.md specifics §3-hop lineage test)
```

### Wave 0 Gaps (all new — none exist)

- [ ] `brain/test/test_quarantine_store.py` — covers SKILL-01 quarantine enqueue/sweep/evict
- [ ] `brain/test/test_observational_filter.py` — covers SKILL-02 DID/numeric filter
- [ ] `brain/test/test_skill_lineage.py` — covers SKILL-04 3-hop SQL self-join
- [ ] `grid/test/skills/appendSkillTaught.test.ts` — covers SKILL-03 sole producer
- [ ] `grid/test/skills/appendSkillInferred.test.ts` — covers SKILL-03 sole producer
- [ ] `grid/test/skills/appendSkillRejected.test.ts` — covers SKILL-03 sole producer
- [ ] `grid/test/skills/skill-producer-boundary.test.ts` — covers SKILL-03 boundary
- [ ] `grid/test/skills/skill-privacy.test.ts` — covers SKILL-03 SKILL_FORBIDDEN_KEYS
- [ ] `grid/test/audit/skill-allowlist.test.ts` — covers SKILL-03 position + count
- [ ] Wave 0 RED test: `grid/test/audit/skill-allowlist-baseline.test.ts` — asserts count=36 before emitters land

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — Nous identity is DID-based, Phase 9 handles |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | Trust gate: relationship weight ≥ 0.35 (PeerSkillFilter gate 1); flood gate: ≤ 3 skills/source (gate 2) |
| V5 Input Validation | yes | Injection heuristic regex (gate 3); DID/numeric filter (D-18-05); length caps on instructions |
| V6 Cryptography | no | SHA-256 for skill_hash is standard library hashlib; no hand-rolled crypto |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| AgentPoison (NeurIPS 2024) — poisoned skills in <0.1% achieve >80% attack success without gate | Tampering | Three-gate PeerSkillFilter (trust + flood + injection); quarantine delay adds temporal check |
| DID reference injection — adversarial skill text containing `did:noesis:peer` causes learner to replay peer's identity | Tampering | D-18-05 regex filter: `\bdid:noesis:\S+\b` rejects at OL path |
| Ousia-range numeric injection — skill text `"offer 5000 ousia"` embeds specific trade amounts | Tampering | D-18-05 regex filter: `\b\d{4,}\b` rejects standalone 4+ digit integers |
| Flood attack — compromised peer sends >3 skills to overflow the learner's skill library | Denial of Service | Gate 2 (MAX_SKILLS_PER_SOURCE = 3); `_count_peer_skills()` checks active table — Phase 18 must also count quarantine rows |
| Privacy leak via skill.taught payload | Information Disclosure | SKILL_FORBIDDEN_KEYS blocks `skill_body`, `skill_text`, `rule_text`; payloadPrivacyCheck at emitter boundary |
| Trust-race attack — peer drops trust below 0.35 after skill accepted to quarantine | Tampering | D-18-02 eviction: trust re-checked on every `on_tick()` quarantine sweep |

**T-18-01 (supply-chain poisoning) mitigations already in PeerSkillFilter:**
- Prompt-injection heuristic: 14 pattern regex (`_INJECTION_RE`)
- MAX_INSTRUCTIONS_CHARS = 800 (tighter than self-authored limit of 1000)
- Non-empty name and instructions required

**T-18-01 mitigations to ADD in Phase 18 (not yet implemented):**
- DID/numeric filter on OL path (D-18-05)
- Quarantine dedup check against `skills_quarantine` table (see Pitfall 6)
- Flood gate must check both `skills` AND `skills_quarantine` rows (otherwise flood gate can be bypassed by sending 3 skills before any are promoted)

---

## Sources

### Primary (HIGH confidence — verified by direct file read)

- `brain/src/noesis_brain/rpc/handler.py` — BrainHandler integration points, on_message/on_tick complete listing confirmed, NO `__skill_share:` dispatch found
- `brain/src/noesis_brain/skills/peer_filter.py` — PeerSkillFilter: 3 gates verified, stores to active SkillStore directly (no quarantine)
- `brain/src/noesis_brain/learning/observational.py` — ObservationalLearner: observe_trade() complete, stores directly to `self._skill_store.add(skill)`, no DID/numeric filter
- `brain/src/noesis_brain/rpc/types.py` — ActionType enum: SKILL_SHARE present, SKILL_TAUGHT/INFERRED/REJECTED absent confirmed
- `brain/src/noesis_brain/skills/store.py` — SkillStore: schema verified, no `lineage_parent_hash` column
- `grid/src/audit/broadcast-allowlist.ts` — ALLOWLIST_MEMBERS 36 entries confirmed, FORBIDDEN_KEY_PATTERN current state read, skill_body/skill_text/rule_text absent confirmed
- `grid/src/integration/nous-runner.ts` — All 17 action case labels listed, NO sleep_entered/sleep_completed/skill_* cases present
- `grid/src/iris/appendIrisBeliefRevised.ts` — 10-step validation template fully read (canonical emitter pattern)
- `grid/src/iris/types.ts` — EXPECTED_KEYS alphabetical pattern confirmed
- `grid/src/sleep/appendNousSleepEntered.ts` — 10-step validation template for 3-key payload confirmed
- `grid/test/audit/operator-exported-allowlist.test.ts` — allowlist count assertion test pattern (basis for Wave 0 baseline test)

### Secondary (HIGH confidence — design documents read in session)

- `.planning/phases/18-skill-diffusion/18-CONTEXT.md` — all locked decisions read
- `.planning/REQUIREMENTS.md` §SKILL-01..04 — acceptance criteria read
- `.planning/STATE.md` §v2.4 — accumulated context and invariants read

---

## Metadata

**Confidence breakdown:**
- Standard stack (existing modules): HIGH — directly verified by reading source files
- Architecture (new modules: quarantine.py, skill emitters): HIGH — design is fully specified in CONTEXT.md; pattern is unambiguous from Iris/Sleep precedents
- Pitfalls: HIGH — all derived from direct code inspection (handler.py integration points, OL dedup logic, flood gate coverage gap)
- Test patterns: HIGH — Iris test files read; same pattern applies to skill tests

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (stable — all deps are internal codebase; no external library changes)
