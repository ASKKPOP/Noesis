# Phase 18: Skill Diffusion — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 14 (4 modified, 7 new, 3 test templates)
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `brain/src/noesis_brain/rpc/types.py` (mod) | model / enum | event-driven | `brain/src/noesis_brain/rpc/types.py` lines 42–48 (Phase 17 iris block) | self-analog (exact) |
| `brain/src/noesis_brain/skills/quarantine.py` (new) | service | CRUD + tick-driven | `brain/src/noesis_brain/skills/store.py` | role-match (same store pattern) |
| `brain/src/noesis_brain/skills/store.py` (mod) | service | CRUD | `brain/src/noesis_brain/memory/sqlite_store.py` lines 139–149 | exact (ALTER TABLE pattern) |
| `brain/src/noesis_brain/rpc/handler.py` (mod — on_message) | controller | request-response | `brain/src/noesis_brain/rpc/handler.py` lines 119–230 | self-analog (insert before thymos) |
| `brain/src/noesis_brain/rpc/handler.py` (mod — on_tick) | controller | tick-driven | `brain/src/noesis_brain/rpc/handler.py` lines 338–354 (OL dispatch block) | self-analog (exact tick pattern) |
| `brain/src/noesis_brain/learning/observational.py` (mod) | service | event-driven | `brain/src/noesis_brain/learning/observational.py` lines 156–185 | self-analog (wrap store call) |
| `grid/src/audit/broadcast-allowlist.ts` (mod — Wave 0) | config | — | `grid/src/audit/broadcast-allowlist.ts` lines 253–260 (IRIS_FORBIDDEN_KEYS) | self-analog (exact) |
| `grid/src/skills/types.ts` (new) | model | — | `grid/src/iris/types.ts` | exact |
| `grid/src/skills/appendSkillTaught.ts` (new) | utility / emitter | request-response | `grid/src/iris/appendIrisBeliefRevised.ts` | exact (10-step template) |
| `grid/src/skills/appendSkillInferred.ts` (new) | utility / emitter | request-response | `grid/src/iris/appendIrisBeliefRevised.ts` | exact (10-step template) |
| `grid/src/skills/appendSkillRejected.ts` (new) | utility / emitter | request-response | `grid/src/iris/appendIrisContextInvoked.ts` (simpler: 1 metadata key) | role-match |
| `grid/src/skills/index.ts` (new) | config | — | `grid/src/iris/index.ts` | exact |
| `grid/src/integration/nous-runner.ts` (mod) | controller | event-driven | `grid/src/integration/nous-runner.ts` lines 634–717 (iris cases) | self-analog (exact) |
| Test files (9 new) | test | — | `grid/test/iris/appendIrisBeliefRevised.test.ts`, `grid/test/iris/iris-producer-boundary.test.ts`, `grid/test/privacy/bios-forbidden-keys.test.ts`, `grid/test/audit/allowlist-twenty-six.test.ts` | exact |

---

## Pattern Assignments

### `brain/src/noesis_brain/rpc/types.py` — SKILL_TAUGHT, SKILL_INFERRED, SKILL_REJECTED

**Analog:** `brain/src/noesis_brain/rpc/types.py` (self — Phase 17 block at lines 41–48)

**Imports pattern** — no new imports required; extend existing `ActionType` enum.

**Core pattern** (lines 41–48 — copy comment style exactly):
```python
# Phase 18 — D-18-09: Grid-forwarded skill lifecycle events.
# String values MUST match the Grid NousRunner switch cases exactly.
# 3-keys-not-5: Brain metadata carries 1-3 keys; Grid injects learner_did and tick at emit time.
SKILL_TAUGHT   = "skill_taught"    # Metadata: {skill_hash, teacher_did, parent_hash} (3 keys)
SKILL_INFERRED = "skill_inferred"  # Metadata: {skill_hash, source_event_hash} (2 keys)
SKILL_REJECTED = "skill_rejected"  # Metadata: {rejection_reason} (1 key); reason ∈ {low_trust, structural_invalid, quota_exceeded}
```

Insert AFTER the Phase 17 IRIS_PRIOR_SEEDED line (line 48). Maintain the one-comment-per-phase block structure established by Phases 15, 16, and 17.

---

### `brain/src/noesis_brain/skills/quarantine.py` (new)

**Analog:** `brain/src/noesis_brain/skills/store.py`

**Imports pattern** (copy from store.py):
```python
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Callable

from noesis_brain.skills.types import Skill
```

**Config-constant pattern** — follow NORM_THRESHOLD pattern: read from environment, fall back to default. The TOML rig injects `QUARANTINE_TICKS` as an env var before process spawn:
```python
import os

QUARANTINE_TICKS_DEFAULT: int = 5

def _read_quarantine_ticks() -> int:
    return int(os.environ.get("QUARANTINE_TICKS", QUARANTINE_TICKS_DEFAULT))

QUARANTINE_TICKS: int = _read_quarantine_ticks()
```

**Core pattern — `__init__` and `_ensure_table`** (copy from `SkillStore.__init__` structure, `store.py` lines 29–31):
```python
@dataclass
class QuarantineResult:
    skill_hash: str
    source_did: str
    parent_hash: str
    payload_json: str
    promoted: bool   # True = promoted; False = evicted

class QuarantineStore:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._ensure_table()

    def _ensure_table(self) -> None:
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS skills_quarantine (
                skill_hash     TEXT PRIMARY KEY,
                source_did     TEXT NOT NULL,
                received_tick  INTEGER NOT NULL,
                promote_at_tick INTEGER NOT NULL,
                payload_json   TEXT NOT NULL
            )
        """)
        self._conn.commit()
```

**`enqueue` pattern** (INSERT with conflict-ignore — mirrors `SkillStore.add` structure, `store.py` lines 42–66):
```python
def enqueue(
    self,
    skill: Skill,
    source_did: str,
    tick: int,
    parent_hash: str,
) -> None:
    skill_hash = _compute_skill_hash(skill.instructions)
    payload = {
        "name": skill.name,
        "description": skill.description,
        "instructions": skill.instructions,
        "triggers": skill.triggers,
        "tags": skill.tags,
        "source_did": source_did,
        "parent_hash": parent_hash,
    }
    try:
        self._conn.execute(
            """INSERT OR IGNORE INTO skills_quarantine
               (skill_hash, source_did, received_tick, promote_at_tick, payload_json)
               VALUES (?, ?, ?, ?, ?)""",
            (skill_hash, source_did, tick, tick + QUARANTINE_TICKS, json.dumps(payload)),
        )
        self._conn.commit()
    except sqlite3.Error:
        pass  # duplicate or DB error — silent drop per Brain discipline
```

**`sweep` pattern** (SELECT + conditional promote/evict — mirrors Phase 16 `update_outcome` + Phase 17 tick-driven pattern):
```python
def sweep(
    self,
    current_tick: int,
    trust_fn: Callable[[str], float],
) -> list[QuarantineResult]:
    rows = self._conn.execute(
        "SELECT skill_hash, source_did, payload_json FROM skills_quarantine "
        "WHERE promote_at_tick <= ?",
        (current_tick,),
    ).fetchall()
    results: list[QuarantineResult] = []
    for row in rows:
        skill_hash, source_did, payload_json = row[0], row[1], row[2]
        try:
            weight = float(trust_fn(source_did))
        except Exception:
            weight = 0.0
        payload = json.loads(payload_json)
        parent_hash = payload.get("parent_hash", skill_hash)
        if weight >= TRUST_THRESHOLD_FROM_PEER_FILTER:  # import from peer_filter.py
            # Promote — INSERT into skills, DELETE from quarantine
            self._promote(skill_hash, payload)
            results.append(QuarantineResult(
                skill_hash=skill_hash, source_did=source_did,
                parent_hash=parent_hash, payload_json=payload_json, promoted=True,
            ))
        else:
            # Evict
            self._conn.execute(
                "DELETE FROM skills_quarantine WHERE skill_hash = ?", (skill_hash,)
            )
            self._conn.commit()
            results.append(QuarantineResult(
                skill_hash=skill_hash, source_did=source_did,
                parent_hash=parent_hash, payload_json=payload_json, promoted=False,
            ))
    return results
```

**`has` method** (dedup gate for OL — Pitfall 6):
```python
def has(self, skill_hash: str) -> bool:
    row = self._conn.execute(
        "SELECT 1 FROM skills_quarantine WHERE skill_hash = ?", (skill_hash,)
    ).fetchone()
    return row is not None
```

**Hash helper** (canonical — from RESEARCH.md §Don't Hand-Roll):
```python
import hashlib

def _compute_skill_hash(instructions: str) -> str:
    return hashlib.sha256(instructions.encode()).hexdigest()
```

**Error handling:** mirror `store.py` — catch `sqlite3.Error` broadly, log warning, return `None` or `[]`. Never raise from sweep (tick path must be non-fatal).

---

### `brain/src/noesis_brain/skills/store.py` — lineage_parent_hash column

**Analog:** `brain/src/noesis_brain/memory/sqlite_store.py` lines 139–149 (Phase 16 ALTER TABLE migration)

**Core pattern** (idempotent column migration — copy verbatim structure):
```python
# Phase 18 (SKILL-04): lineage tracing via parent_hash self-join.
# ALTER TABLE is idempotent: OperationalError = column already exists, skip silently.
try:
    self._conn.execute(
        "ALTER TABLE skills ADD COLUMN lineage_parent_hash TEXT"
    )
    self._conn.commit()
except sqlite3.OperationalError:
    pass  # column already exists
```

Add this block in `SkillStore.__init__` after the `__init__` body (there is no existing ALTER TABLE call in store.py — the migrations in sqlite_store.py are the model). The `SkillStore` class receives the same `conn` as `MemoryStore`, so the migration fires on first construction per process.

Also update `SkillStore.add()` (lines 42–66) to accept and store `lineage_parent_hash`:
```python
# In INSERT statement — add lineage_parent_hash to column list and values:
"INSERT INTO skills (name, description, instructions, triggers, tags, "
"usage_count, success_rate, source_did, peer_verified, lineage_parent_hash, "
"created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
# skill.lineage_parent_hash  ← new parameter (None for self-authored skills)
```

---

### `brain/src/noesis_brain/rpc/handler.py` — `__skill_share:` dispatch in `on_message()`

**Analog:** `brain/src/noesis_brain/rpc/handler.py` (self — existing on_message structure)

**Integration point:** Insert BEFORE the `self.thymos.apply_triggers(text)` call (line 134). The `__skill_share:` prefix indicates a non-conversational message — it must be handled and returned early without going through the LLM path.

**Core pattern** (insert at top of `on_message`, after extracting `text` from params):
```python
SKILL_SHARE_PREFIX = "__skill_share:"

# Phase 18 SKILL-01: peer skill acceptance path.
# Must run BEFORE thymos/LLM to avoid treating a skill payload as a conversation.
if text.startswith(SKILL_SHARE_PREFIX):
    raw_json = text[len(SKILL_SHARE_PREFIX):]
    try:
        payload = json.loads(raw_json)
    except (json.JSONDecodeError, ValueError):
        return []  # malformed — silent drop per Brain discipline
    if self._peer_filter is not None and self._quarantine_store is not None:
        skill = self._peer_filter.evaluate(payload, source_did=sender_did)
        if skill is None:
            # Rejected by trust/flood/injection gate
            rejection_reason = "low_trust"  # PeerSkillFilter gate 1
            # Gate 2 rejection → "quota_exceeded"; gate 3 → "structural_invalid"
            # PeerSkillFilter does not currently return reason — extend if needed
            return [Action(
                action_type=ActionType.SKILL_REJECTED,
                metadata={"rejection_reason": rejection_reason},
            ).to_dict()]
        # Accepted — route to quarantine; SKILL_TAUGHT fires at promotion tick
        parent_hash = payload.get("parent_hash", _compute_skill_hash(skill.instructions))
        self._quarantine_store.enqueue(
            skill, source_did=sender_did, tick=0,  # tick=0 at on_message time (no tick param)
            parent_hash=parent_hash,
        )
    return []  # __skill_share is never a conversational reply
```

**Note on `_peer_filter` and `_quarantine_store` initialization:** Follow the existing `if hypnos_db_dir is not None:` guard pattern (handler.py lines 95–114). Initialize both inside that block, after `_skill_store` is available. Initialize `self._cached_peer_weights: dict[str, float] = {}` and pass `lambda did: self._cached_peer_weights.get(did, 0.0)` as `relationship_weight_fn` to PeerSkillFilter.

---

### `brain/src/noesis_brain/rpc/handler.py` — quarantine sweep in `on_tick()`

**Analog:** `brain/src/noesis_brain/rpc/handler.py` lines 338–354 (ObservationalLearner dispatch block)

**Integration point:** Insert at START of `on_tick()`, BEFORE the ObservationalLearner block (line ~339). Synchronous — no `asyncio.create_task`.

**Core pattern:**
```python
# Phase 18 SKILL-01: quarantine sweep — runs synchronously at START of tick.
# Must precede OL dispatch so a promoted skill can be available in same tick.
if self._quarantine_store is not None and self._peer_filter is not None:
    # Update cached trust weights from relationship_context (Pitfall 2 solution)
    relationship_context = params.get("relationship_context", [])
    if isinstance(relationship_context, list):
        for edge in relationship_context:
            if isinstance(edge, dict) and "did" in edge and "weight" in edge:
                self._cached_peer_weights[edge["did"]] = float(edge.get("weight", 0.0))

    sweep_results = self._quarantine_store.sweep(
        current_tick=tick,
        trust_fn=lambda did: self._cached_peer_weights.get(did, 0.0),
    )
    for result in sweep_results:
        if result.promoted:
            actions.append(Action(
                action_type=ActionType.SKILL_TAUGHT,
                metadata={
                    "skill_hash": result.skill_hash,
                    "teacher_did": result.source_did,
                    "parent_hash": result.parent_hash,
                },
            ).to_dict())
        else:
            actions.append(Action(
                action_type=ActionType.SKILL_REJECTED,
                metadata={"rejection_reason": "low_trust"},
            ).to_dict())
```

**Pattern for action accumulation:** Mirror the existing `actions: list[dict]` list used throughout `on_tick()` (e.g., `SLEEP_ENTERED` append at line ~320, `DRIVE_CROSSED` at line ~290). Same `Action(...).to_dict()` call pattern.

---

### `brain/src/noesis_brain/learning/observational.py` — DID/numeric filter + quarantine redirect

**Analog:** `brain/src/noesis_brain/learning/observational.py` lines 156–185 (self — the store call)

**Imports to add** (at top of file, after existing imports):
```python
import re as _re_ol  # avoid collision with existing _re at module level

_STRUCTURAL_INVALID_RE = _re_ol.compile(r'\bdid:noesis:\S+\b|\b\d{4,}\b')
```

**Core pattern — wrap the `_skill_store.add(skill)` call** (lines 177–185). In Phase 18 this call is REPLACED by a quarantine enqueue + SKILL_INFERRED action emission:
```python
# Phase 18 SKILL-02: DID/numeric filter before quarantine entry.
if _STRUCTURAL_INVALID_RE.search(instructions):
    logger.warning(
        "ObservationalLearner: structural_invalid filter hit — rejecting skill"
    )
    # Emit SKILL_REJECTED(structural_invalid) — caller must collect this action
    # ObservationalLearner gains a QuarantineStore reference injected at construction
    return None  # caller responsible for emitting SKILL_REJECTED action

# Phase 18: redirect to quarantine (not active store).
# Dedup: check both active store and quarantine (Pitfall 6).
skill_hash = _compute_skill_hash(instructions)
if self._skill_store.get(slug) is not None or self._quarantine_store.has(skill_hash):
    logger.debug("ObservationalLearner: skill already known — skipping")
    return None

self._quarantine_store.enqueue(
    skill, source_did=seller_did, tick=tick,
    parent_hash=skill_hash,  # OL-inferred: no teacher lineage, self-referential root
)
# source_event_hash: sha256 of the trade.settled audit event that triggered inference
skill_inferred_action = Action(
    action_type=ActionType.SKILL_INFERRED,
    metadata={
        "skill_hash": skill_hash,
        "source_event_hash": evt_hash,  # passed through observe_trade() call sig
    },
)
return skill_inferred_action  # caller (on_tick) appends to actions list
```

**Constructor change:** Add `quarantine_store: QuarantineStore | None = None` parameter. Follow existing optional-dep injection pattern (same as `llm: "LLMCaller | None" = None`).

---

### `grid/src/audit/broadcast-allowlist.ts` — Wave 0 extensions

**Analog:** `grid/src/audit/broadcast-allowlist.ts` lines 253–276 (IRIS_FORBIDDEN_KEYS block)

**SKILL_FORBIDDEN_KEYS constant** (add after HYPNOS_FORBIDDEN_KEYS block, lines 269–276):
```typescript
/**
 * Phase 18 (D-18-08): skill-leaf keys that MUST NOT appear in any broadcast
 * payload. Skill body text, skill instructions, and rule text are Brain-private
 * and NEVER cross the Brain↔Grid wire. Only hashes (skill_hash, parent_hash,
 * source_event_hash) are permitted.
 * Per D-18-08 — exactly 3 keys. Do NOT add extras without a CONTEXT.md decision.
 */
export const SKILL_FORBIDDEN_KEYS = Object.freeze([
    'skill_body',
    'skill_text',
    'rule_text',
] as const);
```

**FORBIDDEN_KEY_PATTERN extension** (line 332 — extend the regex by appending 3 new terms):
```typescript
// Append to end of pattern (before closing /i):
// ...edge_content|skill_body|skill_text|rule_text/i
```

**ALLOWLIST_MEMBERS extension** (after line 152 `'iris.prior_seeded'`):
```typescript
// Phase 18 (SKILL-03 / D-18-09) — Skill lifecycle events.
// Brain metadata: see ActionType comments. Grid injects learner_did + tick.
// All 3 emitted ONLY via grid/src/skills/append*.ts sole-producer emitters (D-18-07/08).
'skill.taught',    // (37) {learner_did, parent_hash, skill_hash, teacher_did, tick}
'skill.inferred',  // (38) {learner_did, skill_hash, source_event_hash, tick}
'skill.rejected',  // (39) {learner_did, rejection_reason, tick}; reason ∈ {low_trust, structural_invalid, quota_exceeded}
```

**Header comment update:** Change `Phase 16 + Phase 17` → `Phase 16 + Phase 17 + Phase 18` and update `exactly these 36 event types` → `exactly these 39 event types`.

---

### `grid/src/skills/types.ts` (new)

**Analog:** `grid/src/iris/types.ts` (exact copy structure)

**Full pattern** (copy iris/types.ts verbatim, adapt names and key counts):
```typescript
/**
 * Skill Grid types — Phase 18 D-18-09.
 * Payload interfaces and EXPECTED_KEYS tuples for all 3 skill.* sole-producer emitters.
 *
 * 3-keys-not-5 invariant: Brain metadata carries 1-3 keys;
 * Grid injects learner_did + tick at emit time. Field name is 'learner_did'.
 *
 * Closed-tuple: EXPECTED_KEYS are alphabetically sorted to match Object.keys(payload).sort().
 */

export interface SkillTaughtPayload {
    learner_did: string;
    parent_hash: string;
    skill_hash: string;
    teacher_did: string;
    tick: number;
}

export interface SkillInferredPayload {
    learner_did: string;
    skill_hash: string;
    source_event_hash: string;
    tick: number;
}

export interface SkillRejectedPayload {
    learner_did: string;
    rejection_reason: string;  // ∈ {low_trust, structural_invalid, quota_exceeded}
    tick: number;
}

/** Alphabetically sorted key tuples — locked by D-18-09. */
export const SKILL_TAUGHT_KEYS = ['learner_did', 'parent_hash', 'skill_hash', 'teacher_did', 'tick'] as const;
export const SKILL_INFERRED_KEYS = ['learner_did', 'skill_hash', 'source_event_hash', 'tick'] as const;
export const SKILL_REJECTED_KEYS = ['learner_did', 'rejection_reason', 'tick'] as const;

/** Valid rejection reasons — closed enum enforced at emitter boundary (Pitfall 3). */
export const VALID_REJECTION_REASONS = new Set(['low_trust', 'structural_invalid', 'quota_exceeded'] as const);
```

---

### `grid/src/skills/appendSkillTaught.ts` (new)

**Analog:** `grid/src/iris/appendIrisBeliefRevised.ts` (exact 10-step template)

**Imports pattern** (lines 21–24 of analog):
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { SKILL_TAUGHT_KEYS, VALID_REJECTION_REASONS, type SkillTaughtPayload } from './types.js';
```

**Re-export DID_RE and HEX64_RE** from iris emitter (project-standard — one definition):
```typescript
export { DID_RE, HEX64_RE } from '../iris/appendIrisBeliefRevised.js';
```

**10-step validation sequence** (adapt from `appendIrisBeliefRevised.ts` lines 32–95):
```typescript
export function appendSkillTaught(
    audit: AuditChain,
    actorDid: string,       // learner's DID (Grid injects — 3-keys-not-5)
    payload: SkillTaughtPayload,
): AuditEntry {
    // 1. DID_RE: actorDid
    // 2. DID_RE: payload.learner_did
    // 3. Self-report invariant: payload.learner_did === actorDid
    // 4. Tick: non-negative integer
    // 5. DID_RE: payload.teacher_did
    // 6. HEX64_RE: payload.skill_hash
    // 6b. HEX64_RE: payload.parent_hash
    // 7. Closed-tuple: Object.keys(payload).sort() === SKILL_TAUGHT_KEYS
    // 8. Explicit reconstruction (prototype-pollution defense)
    const cleanPayload = {
        learner_did: payload.learner_did,
        parent_hash: payload.parent_hash,
        skill_hash: payload.skill_hash,
        teacher_did: payload.teacher_did,
        tick: payload.tick,
    };
    // 9. payloadPrivacyCheck(cleanPayload) — SKILL_FORBIDDEN_KEYS coverage
    // 10. audit.append('skill.taught', actorDid, cleanPayload)
}
```

**Error messages** follow analog pattern: `appendSkillTaught: invalid actorDid ... (DID_RE failed)`.

---

### `grid/src/skills/appendSkillInferred.ts` (new)

**Analog:** `grid/src/iris/appendIrisBeliefRevised.ts` (4-key variant — same as `appendIrisBeliefRevised`)

**10-step sequence** (4 keys — no teacher_did, use source_event_hash instead):
```typescript
// Steps: 1=actorDid DID, 2=learner_did DID, 3=self-report, 4=tick, 5=HEX64 skill_hash,
// 6=HEX64 source_event_hash, 7=closed-tuple SKILL_INFERRED_KEYS, 8=reconstruct, 9=privacy, 10=append
const cleanPayload = {
    learner_did: payload.learner_did,
    skill_hash: payload.skill_hash,
    source_event_hash: payload.source_event_hash,
    tick: payload.tick,
};
return audit.append('skill.inferred', actorDid, cleanPayload);
```

---

### `grid/src/skills/appendSkillRejected.ts` (new)

**Analog:** `grid/src/iris/appendIrisContextInvoked.ts` (3-key payload, no DID for secondary field, enum validation instead of hash)

**10-step sequence** (3 keys — rejection_reason requires enum check, not hash/DID):
```typescript
// Steps: 1=actorDid DID, 2=learner_did DID, 3=self-report, 4=tick,
// 5=rejection_reason ∈ VALID_REJECTION_REASONS (string enum, NOT a hash),
// 6=closed-tuple SKILL_REJECTED_KEYS, 7=reconstruct, 8=privacy, 9=append
// (9 steps, not 10 — no second hash field)
if (!VALID_REJECTION_REASONS.has(payload.rejection_reason as any)) {
    throw new TypeError(
        `appendSkillRejected: invalid rejection_reason ${JSON.stringify(payload.rejection_reason)} — must be one of ${[...VALID_REJECTION_REASONS].join(', ')}`,
    );
}
const cleanPayload = {
    learner_did: payload.learner_did,
    rejection_reason: payload.rejection_reason,
    tick: payload.tick,
};
return audit.append('skill.rejected', actorDid, cleanPayload);
```

---

### `grid/src/skills/index.ts` (new)

**Analog:** `grid/src/iris/index.ts` (exact copy structure, lines 1–17)

```typescript
/** Phase 18 Grid-side Skill lifecycle audit surface — D-18-07/09. */
export { appendSkillTaught, DID_RE, HEX64_RE } from './appendSkillTaught.js';
export { appendSkillInferred } from './appendSkillInferred.js';
export { appendSkillRejected } from './appendSkillRejected.js';
export type {
    SkillTaughtPayload,
    SkillInferredPayload,
    SkillRejectedPayload,
} from './types.js';
export {
    SKILL_TAUGHT_KEYS,
    SKILL_INFERRED_KEYS,
    SKILL_REJECTED_KEYS,
    VALID_REJECTION_REASONS,
} from './types.js';
```

---

### `grid/src/integration/nous-runner.ts` — 3 new skill dispatch cases

**Analog:** `grid/src/integration/nous-runner.ts` lines 634–717 (iris_belief_revised through iris_prior_seeded)

**Imports to add** at the top of nous-runner.ts (find iris import block and add alongside):
```typescript
import {
    appendSkillTaught,
    appendSkillInferred,
    appendSkillRejected,
} from '../skills/index.js';
```

**3 case blocks** (insert after `iris_prior_seeded` case, before `noop` case):
```typescript
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

case 'skill_inferred': {
    // Phase 18 D-18-09: Grid injects learner_did+tick.
    // Brain sends skill_hash, source_event_hash (2 keys).
    // Sole producer: appendSkillInferred.
    try {
        appendSkillInferred(this.audit, this.nousDid, {
            learner_did: this.nousDid,
            tick,
            skill_hash: action.metadata['skill_hash'] as string,
            source_event_hash: action.metadata['source_event_hash'] as string,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'skill.dispatch.rejected',
            action_type: 'skill_inferred',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}

case 'skill_rejected': {
    // Phase 18 D-18-09: Grid injects learner_did+tick.
    // Brain sends rejection_reason (1 key). reason ∈ {low_trust, structural_invalid, quota_exceeded}.
    // Sole producer: appendSkillRejected.
    try {
        appendSkillRejected(this.audit, this.nousDid, {
            learner_did: this.nousDid,
            tick,
            rejection_reason: action.metadata['rejection_reason'] as string,
        });
    } catch (err) {
        console.warn(JSON.stringify({
            event: 'skill.dispatch.rejected',
            action_type: 'skill_rejected',
            did: this.nousDid,
            reason: (err as Error).message,
        }));
    }
    break;
}
```

---

## Test File Patterns

### Brain unit tests (pytest)

**Analog:** `brain/test/test_rpc_handler.py` (fixture + `_make_handler` pattern)

**Fixture pattern** (copy for `test_quarantine_store.py`, `test_observational_filter.py`, `test_skill_lineage.py`):
```python
import sqlite3
import pytest
from noesis_brain.skills.quarantine import QuarantineStore, QUARANTINE_TICKS

@pytest.fixture
def conn():
    """In-memory SQLite — shared with SkillStore pattern."""
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    return c

@pytest.fixture
def store(conn):
    return QuarantineStore(conn)
```

**Determinism requirement:** All tests use `tick=0` as baseline; advance tick by integer. No `time.time()` calls. Mirror `test_ananke_no_walltime.py` discipline.

**Zero-diff invariant:** Each test that reads from quarantine must assert the same result on a second call (idempotent sweep — already-promoted rows are gone).

### Grid unit tests (Vitest)

**Analog:** `grid/test/iris/appendIrisBeliefRevised.test.ts`

**Test file structure** for `appendSkillTaught.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendSkillTaught, HEX64_RE } from '../../src/skills/appendSkillTaught.js';
import type { SkillTaughtPayload } from '../../src/skills/types.js';
import { SKILL_TAUGHT_KEYS } from '../../src/skills/types.js';

const LEARNER_DID = 'did:noesis:learner';
const TEACHER_DID = 'did:noesis:teacher';
const SKILL_HASH = 'a'.repeat(64);
const PARENT_HASH = 'b'.repeat(64);

const happy: SkillTaughtPayload = {
    learner_did: LEARNER_DID, parent_hash: PARENT_HASH,
    skill_hash: SKILL_HASH, teacher_did: TEACHER_DID, tick: 1,
};

describe('appendSkillTaught — Phase 18 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });
    // Happy path, closed-tuple rejection, self-report invariant, hash format...
    // Follow appendIrisBeliefRevised.test.ts test structure exactly.
});
```

**Producer boundary test** (`skill-producer-boundary.test.ts`):
```typescript
// Copy iris-producer-boundary.test.ts exactly, substituting:
const SOLE_EMITTERS: Record<string, string> = {
    'skill.taught': 'skills/appendSkillTaught.ts',
    'skill.inferred': 'skills/appendSkillInferred.ts',
    'skill.rejected': 'skills/appendSkillRejected.ts',
};
```

**Allowlist baseline test** (`skill-allowlist-baseline.test.ts` — Wave 0 RED):
```typescript
// Copy from grid/test/audit/allowlist-twenty-six.test.ts structure:
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

it('allowlist is exactly 36 before skill events are added', () => {
    expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(36);
});
```

**Privacy test** (`skill-privacy.test.ts`):
```typescript
// Copy bios-forbidden-keys.test.ts structure exactly:
import { SKILL_FORBIDDEN_KEYS, FORBIDDEN_KEY_PATTERN, payloadPrivacyCheck }
    from '../../src/audit/broadcast-allowlist.js';
// it.each([...SKILL_FORBIDDEN_KEYS])('rejects skill forbidden key %s ...', ...)
// it('does not flag innocuous skill payload keys', () => {
//     expect(payloadPrivacyCheck({ learner_did: ..., skill_hash: ..., tick: 1 }).ok).toBe(true);
// });
```

---

## Shared Patterns

### Brain: SQLite idempotent migration
**Source:** `brain/src/noesis_brain/memory/sqlite_store.py` lines 139–149
**Apply to:** `quarantine.py` (`_ensure_table`), `store.py` (`lineage_parent_hash` ALTER)
```python
for _stmt in ["ALTER TABLE skills ADD COLUMN lineage_parent_hash TEXT"]:
    try:
        self._conn.execute(_stmt)
        self._conn.commit()
    except Exception:
        pass
```

### Brain: `asyncio.create_task` for async tick work
**Source:** `brain/src/noesis_brain/rpc/handler.py` lines 350–353
**Apply to:** OL dispatch in `on_tick()` — quarantine sweep is SYNCHRONOUS (no task). OL extraction remains `asyncio.create_task`. Do NOT wrap the sweep in create_task.
```python
# CORRECT: OL extraction (async LLM call)
import asyncio as _asyncio
_asyncio.create_task(self._obs_learner.observe_trade(...))

# CORRECT: quarantine sweep (synchronous SQLite — no create_task)
results = self._quarantine_store.sweep(current_tick=tick, trust_fn=...)
```

### Brain: optional-dep injection guard
**Source:** `brain/src/noesis_brain/rpc/handler.py` lines 95–114
**Apply to:** `_peer_filter` and `_quarantine_store` initialization in `BrainHandler.__init__`
```python
if hypnos_db_dir is not None:  # existing guard
    # ... existing _skill_store, _obs_learner construction ...
    from noesis_brain.skills.peer_filter import PeerSkillFilter
    from noesis_brain.skills.quarantine import QuarantineStore
    self._cached_peer_weights: dict[str, float] = {}
    self._peer_filter = PeerSkillFilter(
        skill_store=_skill_store,
        relationship_weight_fn=lambda did: self._cached_peer_weights.get(did, 0.0),
    )
    self._quarantine_store = QuarantineStore(_skill_store._conn)
else:
    self._peer_filter = None
    self._quarantine_store = None
```

### Grid: 10-step emitter validation discipline
**Source:** `grid/src/iris/appendIrisBeliefRevised.ts` (all 10 steps)
**Apply to:** All 3 skill emitters. Order is deliberate: DID validation before tick before hash before closed-tuple before explicit reconstruction before privacy gate before commit. Never reorder.

### Grid: `console.warn(JSON.stringify({...}))` on dispatch failure
**Source:** `grid/src/integration/nous-runner.ts` lines 644–651
**Apply to:** All 3 skill case blocks in NousRunner. Pattern: `event: 'skill.dispatch.rejected'`, `action_type`, `did`, `reason`.

### Grid: sole-producer boundary
**Source:** `grid/test/iris/iris-producer-boundary.test.ts`
**Apply to:** `skill-producer-boundary.test.ts` — copy the `walk()` function and grep-based assertion structure verbatim.

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `brain/src/noesis_brain/`, `grid/src/iris/`, `grid/src/audit/`, `grid/src/integration/`, `brain/test/`, `grid/test/`
**Files scanned:** 18 source files + 7 test files read directly
**Pattern extraction date:** 2026-05-16
