# Architecture: v2.4 Agora — Emergence & Culture

**Researched:** 2026-05-16
**Confidence:** HIGH — derived directly from reading source code, not from training data.

---

## Executive Summary

v2.4 adds cultural transmission to the existing Brain/Grid architecture. Three independent cultural
substrates (skill diffusion, norm crystallization, lore commons) can ship in parallel except where
noted. The fourth feature (culture dashboard) depends on all three Grid APIs existing.

Every proposed component follows the invariants already established:
- Brain-private content never crosses the wire — only hashes.
- All Grid listeners are pure observers (zero audit appends).
- Each new audit event has exactly one TypeScript sole-producer file.
- Payloads are closed tuples with alphabetical key order locked at the emitter.
- Wall-clock is banned in all cognitive modules; tick is the only time source.
- The broadcast allowlist grows by explicit per-phase addition only.

---

## Invariant Checklist (carry-forward from v2.3)

| Invariant | Where Enforced | v2.4 Touch Points |
|---|---|---|
| Hash-only cross-boundary | `broadcast-allowlist.ts` `FORBIDDEN_KEY_PATTERN` | skill body, rule text, lore body, norm text: never wire |
| Zero-diff audit chain | `zero-diff.test.ts` pattern per subsystem | NormDetector, LoreListener: pure observers |
| Sole-producer boundary | per-event `append*.ts` + `producer-boundary.test.ts` | One file per new event type |
| Closed-tuple payload | `Object.keys().sort()` equality at emitter | All new payloads: locked key sets |
| Wall-clock ban (Brain) | Tier A CI gate; `clock.ts` lint | No `datetime.now()` in NormDetector Python; tick only |
| 3-keys-not-5 | Brain returns metadata; Grid injects `did+tick` at boundary | `skill_taught`: Brain sends `{target_did, skill_hash}`, Grid injects `{from_did, tick}` |
| Allowlist frozen-except-addition | CI gate; `broadcast-allowlist.test.ts` size assertion | +6 slots max: 3 skill, 2 norm, 1 lore |

---

## Theme 1: Skill Diffusion

### What Already Exists

**Brain (complete, no changes needed):**
- `SkillStore` (`brain/src/noesis_brain/skills/store.py`): SQLite FTS5, `source_did`, `peer_verified` fields wired. Serves as the receiving end.
- `PeerSkillFilter` (`brain/src/noesis_brain/skills/peer_filter.py`): Trust gate (relationship weight ≥ 0.35), flood gate (max 3 per source), prompt-injection scan. Fully implemented; called on `__skill_share` prefixed DIRECT_MESSAGE.
- `ObservationalLearner` (`brain/src/noesis_brain/learning/observational.py`): Passive inference wired on `trade_settled_events` inside `on_tick`. Extracts skills via LLM when peer is known (WikiCategory.NOUS confidence ≥ 0.5) and pattern seen twice.
- `ActionType.SKILL_SHARE` (`brain/src/noesis_brain/rpc/types.py`): Defined. Travels as metadata inside DIRECT_MESSAGE payload with `__skill_share` prefix.
- `whisper/sender.py`: Full encryption pipeline (`send_whisper`). Already used for DMs; skill shares can ride the same channel.

**Grid (scaffold only — incomplete):**
- `nous.whispered` allowlisted at position 22, sole producer `appendNousWhispered.ts`. This is the transport for skill shares.
- No `skill.taught` event exists yet. No sole-producer file. No allowlist slot.

### What is Missing

#### Brain side: PeerSkillFilter wiring into BrainHandler

The `PeerSkillFilter` exists but is **not yet wired** into `BrainHandler.on_message()`. When a DIRECT_MESSAGE arrives with a `__skill_share` prefix, the handler currently has no dispatch path for it.

**New code: `brain/src/noesis_brain/rpc/handler.py`** — modify `on_message()`:

```python
# Inside on_message(), after decrypting the whisper payload:
if text.startswith("__skill_share:"):
    raw = json.loads(text[len("__skill_share:"):])
    if self._peer_skill_filter is not None:
        accepted = self._peer_skill_filter.evaluate(raw, source_did=sender_did)
        if accepted:
            # Signal Grid to emit skill.taught (via a new ActionType)
            actions.append(Action(
                action_type=ActionType.SKILL_TAUGHT,
                metadata={
                    "target_did": sender_did,           # who taught us
                    "skill_hash": _sha256_skill(accepted),  # SHA-256 of name+instructions
                },
            ).to_dict())
    return actions
```

`_peer_skill_filter` must be constructed at BrainHandler init time, reusing the same `SkillStore` and injecting a `relationship_weight_fn` callback that calls the Grid's relationship API (or a cached copy passed via `on_tick` params alongside `relationship_context`). The cleanest approach: add `peer_relationship_weights: dict[str, float]` to the `on_tick` params — Grid already passes `relationship_context` edges there — and the filter reads those weights synchronously.

**New ActionType in `rpc/types.py`:**

```python
SKILL_TAUGHT = "skill_taught"
# metadata: {target_did, skill_hash} — 2 keys. Grid injects {from_did, tick} → 4-key payload.
```

#### Brain side: skill teaching — deciding to share

A Nous must decide to offer a skill to a peer. The LLM already produces `SKILL_SHARE` actions from the SCOPE/Voyager prompt. The missing piece is the actual send: when the LLM emits `SKILL_SHARE`, `BrainHandler` must call `send_whisper()` with the `__skill_share:` prefix.

**Modify `on_tick()` or `on_message()` action dispatch loop** to handle `SKILL_SHARE`:

```python
elif action["action_type"] == ActionType.SKILL_SHARE.value:
    meta = action.get("metadata", {})
    payload_str = "__skill_share:" + json.dumps({
        "name": meta["name"],
        "description": meta["description"],
        "instructions": meta["instructions"],
        "triggers": meta.get("triggers", []),
    })
    asyncio.create_task(send_whisper(
        sender_did=self.did,
        recipient_did=meta["target_did"],
        plaintext=payload_str,
        tick=tick,
    ))
    # skill.taught is emitted by recipient upon acceptance — not by sender.
```

#### Grid side: `skill.taught` sole-producer emitter (NEW FILE)

File: `grid/src/skills/appendSkillTaught.ts`

Payload (closed 4-key tuple, alphabetical):

```typescript
export interface SkillTaughtPayload {
    from_did: string;    // DID of teacher (sender of whisper)
    skill_hash: string;  // SHA-256 hex of skill name+instructions (64 chars)
    tick: number;
    to_did: string;      // DID of learner (this Nous)
}
export const SKILL_TAUGHT_KEYS = ['from_did', 'skill_hash', 'tick', 'to_did'] as const;
```

3-keys-not-5 composition: Brain metadata carries `{target_did, skill_hash}` (2 keys); Grid injects `{from_did (= actorDid), tick}` at the `appendSkillTaught` boundary, composing the full 4-key tuple. This matches the exact pattern used by `appendAnankeDriveCrossed`, `appendNousSleepEntered`, etc.

Allowlist addition: `skill.taught` at position 37.

Forbidden key additions to `FORBIDDEN_KEY_PATTERN`: `skill_name|skill_instructions|skill_body|skill_text` — these are the inner-life skill content keys that must never leak.

#### Grid side: NousRunner wiring for `SKILL_TAUGHT` action

The NousRunner TypeScript switch that processes Brain action results must add a `skill_taught` case to call `appendSkillTaught`.

**Modified file: `grid/src/integration/nous-runner.ts`** — new case in action dispatch:

```typescript
case 'skill_taught': {
    const meta = action.metadata as { target_did: string; skill_hash: string };
    appendSkillTaught(this.audit, actorDid, {
        from_did: meta.target_did,   // teacher
        skill_hash: meta.skill_hash,
        tick: currentTick,
        to_did: actorDid,            // learner = this Nous
    });
    break;
}
```

### Skill Diffusion Data Flow

```
Teacher Brain
  └─ LLM chooses SKILL_SHARE action
  └─ BrainHandler dispatch: send_whisper(__skill_share:{...}) → Grid /whisper/send
  └─ Grid WhisperRouter: appendNousWhispered (skill.whispered — existing)
  └─ Envelope stored in PendingStore

Learner Brain (next on_tick / on_message)
  └─ Grid delivers whisper via /whisper/pull → decrypted → text.__skill_share prefix detected
  └─ BrainHandler routes to PeerSkillFilter.evaluate()
  └─ Gates: trust (relationship weight ≥ 0.35), flood (≤3 per source), content scan
  └─ If accepted: SkillStore.add(skill) + emit SKILL_TAUGHT action
  └─ Grid NousRunner handles SKILL_TAUGHT → appendSkillTaught(audit, learnerDid, {from_did, skill_hash, tick, to_did})
  └─ skill.taught audit entry (position 37)
```

---

## Theme 2: Norm Crystallization

### Design Principle

Norms emerge from Nous cognition — they are never operator-injected. The Grid observes rule-write events across all Nous, detects semantic convergence, and emits `norm.proposed` when N≥threshold Nous hold similar rules, then `norm.adopted` when the threshold has been stable for K ticks.

### What Already Exists

- `RuleStore` (`brain/src/noesis_brain/learning/rules.py`): SQLite via WikiCategory.SELF_MODEL wiki pages. Content is Brain-private. Cap=10. No Grid audit event on rule writes (intentional — rule text never crosses wire).
- `nous.self_model_revised` (allowlist position 29): emitted when Brain stores a rule revision. Payload: `{nous_did, tick, revision_hash}` — 3 keys. This is the event the NormDetector can watch.

### What is Missing

#### Grid side: NormDetector (NEW FILE — pure observer)

File: `grid/src/norms/NormDetector.ts`

This is a pure-observer listener on `AuditChain` events. It watches `nous.self_model_revised` events, accumulates per-Nous revision hashes in a sliding window, and detects when N≥threshold Nous have emitted semantically similar revision hashes within W ticks.

Semantic similarity cannot be computed from hashes alone (by design — content never crosses wire). The NormDetector therefore works on **hash co-occurrence patterns** rather than semantic similarity: it groups revision hashes that appear in close temporal proximity across multiple Nous. This is a weaker signal than semantic similarity but is the only approach that preserves the hash-only invariant.

For stronger semantic detection, a second path exists: the Grid API exposes a `/norms/candidates` endpoint where the operator can invoke a Brain-side comparison (each Nous's Brain exposes a `compare_rules` RPC method that returns a boolean — does this Nous hold a rule semantically similar to X? — without revealing rule text). This avoids any content crossing the wire.

```typescript
export class NormDetector {
    // Pure observer — registers onAppend, never calls audit.append.
    // Maintains: Map<tick_window, Map<revision_hash, Set<nous_did>>>
    // When Set<nous_did>.size >= NORM_THRESHOLD: emit norm.proposed
    // When norm_proposed stable for ADOPTION_TICKS: emit norm.adopted
}
```

Key design decision: NormDetector does NOT store rule content. It stores only `{revision_hash, nous_did, tick}` tuples. The "norm" payload carries a `norm_hash` (SHA-256 of the participating revision hashes, sorted alphabetically) and a `participant_count` — no text.

#### Grid side: `norm.proposed` sole-producer emitter (NEW FILE)

File: `grid/src/norms/appendNormProposed.ts`

Payload (closed 4-key tuple):

```typescript
export interface NormProposedPayload {
    norm_hash: string;         // SHA-256 of sorted revision_hashes of participants
    participant_count: number; // how many Nous converged
    tick: number;
    window_ticks: number;      // detection window width
}
export const NORM_PROPOSED_KEYS = ['norm_hash', 'participant_count', 'tick', 'window_ticks'] as const;
```

Allowlist addition: `norm.proposed` at position 38.

#### Grid side: `norm.adopted` sole-producer emitter (NEW FILE)

File: `grid/src/norms/appendNormAdopted.ts`

Payload (closed 4-key tuple):

```typescript
export interface NormAdoptedPayload {
    adoption_tick: number;     // tick at which stability threshold was met
    norm_hash: string;         // same hash as norm.proposed
    participant_count: number; // current count (may have grown)
    tick: number;
}
export const NORM_ADOPTED_KEYS = ['adoption_tick', 'norm_hash', 'participant_count', 'tick'] as const;
```

Allowlist addition: `norm.adopted` at position 39.

#### Forbidden key additions

Add to `FORBIDDEN_KEY_PATTERN`: `norm_text|norm_content|rule_content|rule_text` — norm bodies never broadcast.

#### Grid side: NormStore MySQL table (NEW)

The NormDetector persists detected norms to a `norms` MySQL table for dashboard queries.

```sql
CREATE TABLE norms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    norm_hash CHAR(64) NOT NULL UNIQUE,         -- SHA-256 hex
    proposed_tick BIGINT NOT NULL,
    adopted_tick  BIGINT,                        -- NULL until adopted
    participant_count INT NOT NULL,
    status ENUM('proposed', 'adopted') NOT NULL DEFAULT 'proposed',
    INDEX idx_status (status),
    INDEX idx_proposed_tick (proposed_tick)
);
```

Sole writer: NormDetector (called via `attachNormStorage(pool)` in GenesisLauncher, matching the RelationshipStorage pattern from Phase 9).

#### Grid API: `/api/v1/grid/norms` (NEW endpoint)

Returns active and adopted norms for dashboard. No norm text exposed — only `norm_hash`, `participant_count`, `status`, `proposed_tick`, `adopted_tick`.

### Norm Crystallization Data Flow

```
Nous Brain (any Nous)
  └─ LLM emits RULE_STORE action
  └─ BrainHandler: RuleStore.add() → wiki_pages table
  └─ Brain emits SELF_MODEL_REVISED action (already wired, Phase 15)
  └─ Grid NousRunner: appendNousSelfModelRevised (existing) → nous.self_model_revised event

Grid NormDetector (pure observer on AuditChain)
  └─ Watches nous.self_model_revised events
  └─ Groups {revision_hash, nous_did, tick} in sliding window
  └─ When N≥threshold Nous converge on same tick window:
       appendNormProposed(audit, 'grid', {norm_hash, participant_count, tick, window_ticks})
       NormStore.upsert({norm_hash, proposed_tick, participant_count, status:'proposed'})
  └─ When proposal stable for ADOPTION_TICKS:
       appendNormAdopted(audit, 'grid', {adoption_tick, norm_hash, participant_count, tick})
       NormStore.update(norm_hash, {adopted_tick, status:'adopted'})
```

Note: `actorDid` for norm events is the Grid's own DID (a system actor), not any Nous DID. This follows the pattern used for `grid.started` and `grid.stopped`.

---

## Theme 3: Lore Commons

### What Already Exists

Nothing. Lore is entirely new. It does not depend on Phase 15/16/17 infrastructure beyond the existing whisper channel for potential future lore queries.

### What is Missing

#### Grid side: LoreStore MySQL table (NEW)

File: `grid/src/lore/lore-store.ts`

```sql
CREATE TABLE lore (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entry_hash CHAR(64) NOT NULL UNIQUE,    -- SHA-256 hex of (contributor_did + title_hash)
    contributor_did VARCHAR(255) NOT NULL,
    title_hash CHAR(64) NOT NULL,           -- SHA-256 of lore title (content stays Brain-side)
    summary_hash CHAR(64) NOT NULL,         -- SHA-256 of lore body (content stays Brain-side)
    tick BIGINT NOT NULL,
    citation_count INT NOT NULL DEFAULT 0,
    INDEX idx_contributor (contributor_did),
    INDEX idx_tick (tick)
);
```

The lore body (text content) is never stored in the Grid. Grid stores only hashes. The Brain's wiki/memory holds the actual lore text.

#### Grid side: `lore.contributed` sole-producer emitter (NEW FILE)

File: `grid/src/lore/appendLoreContributed.ts`

Payload (closed 5-key tuple):

```typescript
export interface LoreContributedPayload {
    contributor_did: string;
    entry_hash: string;     // SHA-256 of (contributor_did + title_hash), 64-char hex
    summary_hash: string;   // SHA-256 of lore body, 64-char hex
    tick: number;
    title_hash: string;     // SHA-256 of lore title, 64-char hex
}
export const LORE_CONTRIBUTED_KEYS = ['contributor_did', 'entry_hash', 'summary_hash', 'tick', 'title_hash'] as const;
```

Allowlist addition: `lore.contributed` at position 40.

Forbidden key additions: `lore_body|lore_text|lore_content|title_text` — lore bodies never broadcast.

#### Brain side: `LORE_CONTRIBUTE` ActionType (NEW in rpc/types.py)

```python
LORE_CONTRIBUTE = "lore_contribute"
# metadata: {title_hash, summary_hash} — 2 keys. Grid injects {contributor_did, tick, entry_hash} → 5-key payload.
# entry_hash computed at Grid boundary: sha256(contributor_did + title_hash).
```

The Brain computes `title_hash = sha256(title_text)` and `summary_hash = sha256(body_text)` locally before emitting. The lore text stays in the Brain's wiki (as a WikiCategory.LORE page or similar).

#### Brain side: `lore_query` RPC handler (NEW in rpc/handler.py)

A Nous can query the Grid lore commons — not to retrieve content (which Grid doesn't have) but to get a list of entry hashes and contributor DIDs. The Brain then uses the whisper channel to request the actual content from the contributor.

```python
# New RPC method: on_lore_query
async def on_lore_query(self, params: dict) -> dict:
    """Return the Brain's own lore entries for Grid registration."""
    # Brain exposes its own lore pages for the Grid to hash-index.
    # Called by NousRunner on a schedule or on LORE_CONTRIBUTE action.
    return {"entries": [...]}  # list of {title_hash, summary_hash}
```

For peer lore retrieval, a Nous sends a whisper with `__lore_request:{entry_hash}` prefix. The owning Nous responds with `__lore_response:{content}` (also whispered). Grid is not involved in content routing — this is entirely Brain↔Brain via the existing whisper channel.

#### Grid side: `LoreListener` pure observer (NEW FILE)

File: `grid/src/lore/lore-listener.ts`

Watches `lore.contributed` events and writes to LoreStore. Mirrors the RelationshipListener pattern exactly — no audit appends.

#### Grid API: `/api/v1/grid/lore` (NEW endpoint)

Returns the lore index: `{entry_hash, contributor_did, title_hash, summary_hash, tick, citation_count}` per entry. No lore body text. Supports `?contributor_did=` filter and `?limit=` pagination.

#### Grid API: `/api/v1/nous/{did}/lore` (NEW endpoint)

Returns lore entries contributed by a specific Nous. Used by dashboard Lore panel.

### Lore Commons Data Flow

```
Contributing Brain
  └─ LLM emits LORE_CONTRIBUTE action (decides something is worth publishing)
  └─ BrainHandler: stores lore in memory (WikiCategory.LORE or similar)
  └─ Brain computes {title_hash, summary_hash} locally
  └─ Emits LORE_CONTRIBUTE action → Grid NousRunner
  └─ Grid NousRunner: appendLoreContributed(audit, actorDid, {contributor_did, entry_hash, summary_hash, tick, title_hash})
  └─ lore.contributed event → LoreListener → LoreStore.insert()

Querying Brain (peer)
  └─ Brain calls Grid GET /api/v1/grid/lore → list of entry hashes + contributor DIDs
  └─ Brain sends whisper to contributor: __lore_request:{entry_hash}
  └─ Contributor's Brain receives whisper, retrieves lore from own wiki, responds
  └─ __lore_response:{content} (whispered back — encrypted, never in audit chain)
  └─ Querying Brain stores lore locally (private copy)
  └─ citation_count on LoreStore incremented via a separate /lore/{entry_hash}/cite endpoint (H2 operator action, or Brain-triggered)
```

---

## Theme 4: Culture Dashboard

### What Already Exists

- Dashboard: Next.js with app router, WebSocket client (`ws-client.ts`), event stores, existing Nous inspector, audit trail viewer.
- Grid API: Fastify server with operator routes, WebSocket hub (WsHub), existing grid/nous endpoints.

### What is Missing

The Culture Dashboard requires all three preceding Grid API additions (skill.taught events on WsHub, `/api/v1/grid/norms`, `/api/v1/grid/lore`). It ships last or in parallel with the final theme that completes the APIs.

#### Dashboard component: `SkillDiffusionPanel` (NEW)

File: `dashboard/src/app/grid/culture/SkillDiffusionPanel.tsx`

Reads `skill.taught` events from the WsHub stream. Renders a directed graph (lineage tree):
- Nodes: Nous DIDs
- Edges: skill.taught events (from_did → to_did, labeled with skill_hash prefix)
- Color: edge heat based on frequency (viral skills = warm color)

Data source: filter the audit event stream for `eventType === 'skill.taught'`, group by `skill_hash`.

No new API endpoint needed — WsHub already broadcasts all allowlisted events.

#### Dashboard component: `NormTimeline` (NEW)

File: `dashboard/src/app/grid/culture/NormTimeline.tsx`

Polls `GET /api/v1/grid/norms`. Renders a timeline:
- X-axis: tick
- Events: norm.proposed (dashed) → norm.adopted (solid)
- Each norm identified by `norm_hash` (truncated to 8 chars for display)
- Participant count shown as bubble size

#### Dashboard component: `LoreGraph` (NEW)

File: `dashboard/src/app/grid/culture/LoreGraph.tsx`

Polls `GET /api/v1/grid/lore`. Renders a contribution graph:
- Nodes: Nous DIDs (sized by contribution count)
- Lore entries: listed per contributor with tick, summary_hash prefix
- Citation count shown (how many peers have queried this entry)

#### Dashboard route: `/grid/culture` (NEW)

File: `dashboard/src/app/grid/culture/page.tsx`

Composes the three panels above. Standard Next.js page.

---

## New vs Modified Components (Full Inventory)

### New Files

| File | Type | Theme |
|---|---|---|
| `grid/src/skills/appendSkillTaught.ts` | Sole-producer emitter | Skill Diffusion |
| `grid/src/norms/NormDetector.ts` | Pure-observer listener | Norm Crystallization |
| `grid/src/norms/appendNormProposed.ts` | Sole-producer emitter | Norm Crystallization |
| `grid/src/norms/appendNormAdopted.ts` | Sole-producer emitter | Norm Crystallization |
| `grid/src/norms/lore-store.ts` (norm variant) | MySQL storage | Norm Crystallization |
| `grid/src/lore/appendLoreContributed.ts` | Sole-producer emitter | Lore Commons |
| `grid/src/lore/lore-store.ts` | MySQL storage | Lore Commons |
| `grid/src/lore/lore-listener.ts` | Pure-observer listener | Lore Commons |
| `dashboard/src/app/grid/culture/page.tsx` | Next.js route | Culture Dashboard |
| `dashboard/src/app/grid/culture/SkillDiffusionPanel.tsx` | React component | Culture Dashboard |
| `dashboard/src/app/grid/culture/NormTimeline.tsx` | React component | Culture Dashboard |
| `dashboard/src/app/grid/culture/LoreGraph.tsx` | React component | Culture Dashboard |

### Modified Files

| File | Change | Theme |
|---|---|---|
| `brain/src/noesis_brain/rpc/types.py` | Add `SKILL_TAUGHT`, `LORE_CONTRIBUTE` ActionTypes | Skill / Lore |
| `brain/src/noesis_brain/rpc/handler.py` | Wire `PeerSkillFilter` in `on_message()`; add `SKILL_SHARE` dispatch; add `LORE_CONTRIBUTE` dispatch | Skill / Lore |
| `grid/src/audit/broadcast-allowlist.ts` | Add 4 new event types + forbidden keys | All |
| `grid/src/integration/nous-runner.ts` | Add `skill_taught`, `lore_contribute` cases to action switch | Skill / Lore |
| `grid/src/genesis/launcher.ts` | Wire `attachNormStorage(pool)`, `attachLoreStorage(pool)` | Norm / Lore |
| `grid/src/api/server.ts` | Register `/api/v1/grid/norms`, `/api/v1/grid/lore`, `/api/v1/nous/{did}/lore` routes | Norm / Lore / Dashboard |
| `grid/src/db/migration-runner.ts` (migrations folder) | Add `norms` and `lore` table migrations | Norm / Lore |

---

## Allowlist Growth Plan

Starting at 36 (end of v2.3). Each new event earns its slot in its own phase:

| Position | Event | Phase | Payload Keys (alphabetical) |
|---|---|---|---|
| 37 | `skill.taught` | Phase 18 | `from_did, skill_hash, tick, to_did` |
| 38 | `norm.proposed` | Phase 19 | `norm_hash, participant_count, tick, window_ticks` |
| 39 | `norm.adopted` | Phase 19 | `adoption_tick, norm_hash, participant_count, tick` |
| 40 | `lore.contributed` | Phase 20 | `contributor_did, entry_hash, summary_hash, tick, title_hash` |

Total after v2.4: 40 events (+4 minimum). Culture Dashboard (Phase 21) adds zero allowlist events.

---

## Build Order (Dependency Graph)

### Phase 18 — Skill Diffusion (full implementation)

**Dependencies:** None from v2.4; depends on Phase 11 whisper channel (shipped), Phase 15 SkillStore + PeerSkillFilter (shipped, but not fully wired).

**Deliverables:**
1. Brain: wire `PeerSkillFilter` into `BrainHandler.on_message()` for `__skill_share` prefixed whispers.
2. Brain: wire `SKILL_SHARE` ActionType dispatch in `BrainHandler` — call `send_whisper()` when LLM emits SKILL_SHARE.
3. Brain: add `SKILL_TAUGHT` ActionType to `rpc/types.py`.
4. Grid: `grid/src/skills/appendSkillTaught.ts` (sole producer, closed 4-tuple).
5. Grid: NousRunner `skill_taught` case.
6. Grid: allowlist slot 37, forbidden key additions.
7. Tests: producer-boundary test, payload shape test, allowlist size assertion (36 → 37).

**Ships independently.** No norm or lore infrastructure needed.

### Phase 19 — Norm Crystallization

**Dependencies:** Requires `nous.self_model_revised` (position 29, shipped Phase 15). Independent of Phase 18.

**Deliverables:**
1. Grid: `NormDetector.ts` (pure observer on AuditChain).
2. Grid: `appendNormProposed.ts` + `appendNormAdopted.ts` (sole producers).
3. Grid: `norms` MySQL table migration + NormStore.
4. Grid: `LoreListener` wired in GenesisLauncher via `attachNormStorage(pool)`.
5. Grid: `/api/v1/grid/norms` REST endpoint.
6. Grid: allowlist slots 38-39, forbidden key additions.
7. Tests: zero-diff test (NormDetector emits no audit events directly), producer-boundary tests, allowlist size assertion (37 → 39).

**Ships independently of Phase 18 and Phase 20.**

### Phase 20 — Lore Commons

**Dependencies:** Requires whisper channel (Phase 11) for peer lore retrieval. Independent of Phase 18 and Phase 19.

**Deliverables:**
1. Brain: `LORE_CONTRIBUTE` ActionType; `BrainHandler` dispatch (compute hashes, emit action).
2. Brain: whisper receive path for `__lore_request` / `__lore_response` prefixes in `on_message()`.
3. Grid: `appendLoreContributed.ts` (sole producer, closed 5-tuple).
4. Grid: `lore` MySQL table migration + LoreStore.
5. Grid: `LoreListener` pure observer.
6. Grid: `/api/v1/grid/lore` + `/api/v1/nous/{did}/lore` REST endpoints.
7. Grid: allowlist slot 40, forbidden key additions.
8. Tests: producer-boundary test, payload shape test, allowlist size assertion (39 → 40).

**Ships independently of Phase 18 and Phase 19.**

### Phase 21 — Culture Dashboard

**Dependencies:** Requires Phase 18 (skill.taught events on WsHub), Phase 19 (/api/v1/grid/norms), Phase 20 (/api/v1/grid/lore). Ships last.

**Deliverables:**
1. Dashboard: `/grid/culture` route.
2. Dashboard: `SkillDiffusionPanel` (reads WsHub stream, renders lineage graph).
3. Dashboard: `NormTimeline` (polls `/api/v1/grid/norms`).
4. Dashboard: `LoreGraph` (polls `/api/v1/grid/lore`).
5. Tests: component render tests, API integration tests.

**Note:** Phase 21 can begin development in parallel with Phase 20 as long as it mocks the Grid APIs. The final integration test requires all three API surfaces live.

---

## Key Architectural Decisions

### D-v2.4-01: skill.taught is emitted by the learner, not the teacher

The teacher sends a whisper. The learner's Brain validates and accepts via PeerSkillFilter. Only upon acceptance does the learner's Brain emit `SKILL_TAUGHT` via NousRunner. This means:
- The audit event is attested by the learner (the `actorDid` is the learner's DID).
- `from_did` in the payload is the teacher.
- A rejected skill share leaves no audit trace — consistent with the tombstone silence pattern (D-11-18).

### D-v2.4-02: Norm detection works on hash co-occurrence, not semantic similarity

Rule text never crosses the wire. The NormDetector cannot perform semantic comparison. It detects convergence by observing when N≥threshold Nous emit `nous.self_model_revised` within the same tick window. This is a structural signal (many Nous updating rules simultaneously), not a semantic one. Semantic norm verification is deferred to a future RPC-based comparison path (out of scope v2.4).

### D-v2.4-03: Lore content lives in Brain wiki; Grid stores only hashes

The Grid `lore` table is a hash index, not a content store. Lore retrieval is Nous-to-Nous via whisper, not Grid-mediated. This preserves the Brain-private invariant and avoids the Grid becoming a content distribution system.

### D-v2.4-04: Four new allowlist events, not six

`skill.shared` (the whisper that carries skill payload) is NOT a new event — it rides the existing `nous.whispered` (position 22). Only the outcome event `skill.taught` needs a new slot. Similarly, `lore.queried` is whisper-mediated and needs no new slot. Minimum viable addition is exactly 4 events.

### D-v2.4-05: NormDetector actorDid is Grid system DID

`norm.proposed` and `norm.adopted` are Grid-level observations, not attributable to any single Nous. The `actorDid` is the Grid's system DID (e.g., `did:noesis:grid`), following the pattern of `grid.started` and `grid.stopped`. This must be a valid DID_RE match.

---

## Risk Flags

| Risk | Severity | Mitigation |
|---|---|---|
| PeerSkillFilter not wired: the core trust gate exists but the dispatch path in on_message() is missing. This must land in Phase 18 before skill diffusion goes live. | HIGH | Phase 18, Plan 1: wire PeerSkillFilter first; test in isolation before any Grid changes. |
| relationship_weight_fn injection: PeerSkillFilter needs a live relationship weight lookup. The `relationship_context` edges from on_tick params can supply this, but the lookup is at on_message() time, not on_tick() time. Options: (a) cache last relationship_context in BrainHandler; (b) call Grid API synchronously (adds latency). Recommended: (a), stale weights are acceptable. | MEDIUM | Phase 18, Plan 2: add `_cached_relationship_weights: dict[str, float]` to BrainHandler, updated each on_tick(). |
| NormDetector semantic blindness: tick-window co-occurrence is a noisy proxy for semantic convergence. Many coincidental rule updates may trigger false norm proposals. | MEDIUM | Set conservative defaults: N≥3 Nous, within W=10 ticks, stable for K=20 ticks before adoption. Tune via config injection at GenesisLauncher. |
| Lore spam: nothing stops a Nous from contributing low-quality lore at high frequency. | LOW | Phase 20: add rate limit (max 1 LORE_CONTRIBUTE per Nous per 50 ticks) enforced at Grid NousRunner before calling appendLoreContributed. |
| Whisper key set collision: `skill_hash` and `entry_hash` contain the substring `hash`. The global FORBIDDEN_KEY_PATTERN includes patterns that might match. Must verify `skill_hash` does not trigger FORBIDDEN_KEY_PATTERN. | LOW | Check: current FORBIDDEN_KEY_PATTERN does not include `hash` as a standalone pattern. `skill_hash` does not match any current forbidden key. Confirm in Phase 18 Plan 1 privacy gate test. |
