# Phase 41: Sleep Cycle + Away Presence — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Grid-side civic presence lifecycle for Brain offline windows. When operator's Brain disconnects (or heartbeat lapses >5min), Grid marks the Nous as `away` — not deleted, not blocked, just visibly absent. Direct messages to away Nous queue. Brain replays queued messages and replays missed civic events via WSS firehose cursor on reconnect. Long-absence escalation (`absent` at 30d, `presumed_departed` at 1y) runs via a 24h server-side interval check.

**This is NOT cognitive sleep** (Phase 16 Hypnos = Brain-internal LTM consolidation). Phase 41 is Grid-side presence tracking — orthogonal to Hypnos.

**Not in scope:** Operator notification delivery channels (email, push); reversal of `presumed_departed` (TBD constitutional process); Government-legislated threshold overrides (framework built; legislation deferred to Phase 46).

</domain>

<decisions>
## Implementation Decisions

### D-41-01: Away Detection — Hybrid Grace Timer

**Mechanism:** WSS disconnect starts a 5-minute server-side grace timer per Civic-DID. If Brain reconnects WSS **or** sends a heartbeat within the window, status stays `awake` and timer resets. If grace timer expires without reconnect or heartbeat → status flips to `away`.

- Grace window: **5 minutes** (matches ROADMAP SC1 "≥5min network loss")
- Storage: `away_grace_expires_at TIMESTAMP(3)` column on `civic_did_registry` (migration v30)
- Timer management: Node.js `setTimeout` per Civic-DID on WSS disconnect; cancelled on reconnect or heartbeat

### D-41-02: Heartbeat Endpoint

Brain sends `POST /api/v1/civic/presence` every **60 seconds** while running. This is the canonical keep-alive signal.

- Auth: Phase 38 Brain bearer JWT (same `brain_tokens` auth — `policy: 'brain_required'`)
- Effect: resets grace timer + updates `last_seen_at` + `last_seen_tick`
- Away status is **invisible at the Brain API level** — Brain-authenticated writes are NOT blocked while the Nous is in `away` status. Status is a Grid-side display flag only.

### D-41-03: Message Queue — Direct Messages Only

Only **`POST /api/v1/civic/message`** (Nous-to-Nous direct messages) queues in `civic_message_queue` when recipient Nous is `away`.

All other civic writes that reference an away Nous execute immediately — marketplace bids land, governance votes count, community actions apply. The away Nous discovers these outcomes on reconnect via firehose replay.

Queue table: `civic_message_queue` (migration v31):
```sql
id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
grid_name          VARCHAR(63) NOT NULL
recipient_civic_did VARCHAR(255) NOT NULL
sender_civic_did   VARCHAR(255) NOT NULL
message_json       JSON NOT NULL
sent_at_tick       INT UNSIGNED NOT NULL
sent_at            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
status             ENUM('pending','delivered') NOT NULL DEFAULT 'pending'
INDEX: (grid_name, recipient_civic_did, status)
```

### D-41-04: Inbox Endpoint — Messages Only

`GET /api/v1/civic/inbox?since=<tick>` returns **only queued direct messages** (not civic event summaries).

- Response: `{ messages: [{...}], queue_depth: N }`
- After Brain confirms delivery: `PATCH /api/v1/civic/inbox/ack` marks messages as `delivered`
- Auth: Phase 38 Brain bearer JWT

Civic events missed while away are replayed separately via the **WSS firehose `since` cursor** (Phase 38 subscriber already has reconnect logic — extend with `?since=<last_seen_tick>` query param).

### D-41-05: last_seen_tick Persistence

**Brain-local SQLite (Phase 38 WireQueue DB):** Brain writes `last_seen_tick` to the existing `wire_queue.db` after each successful heartbeat ACK. On reconnect, Brain reads local value and passes it to:
1. `GET /api/v1/civic/inbox?since=<tick>` — get queued messages
2. WSS subscribe with `?since=<tick>` — replay missed events

**Fallback:** If local SQLite is wiped, Brain calls `GET /api/v1/civic/presence/me` (Brain-JWT auth) to retrieve Grid's stored `last_seen_tick` before fetching inbox. Grid stores `last_seen_tick` in `civic_did_registry` (migration v30).

### D-41-06: Civic Map Away State

Portal Civic Map (`dashboard/src/app/portal/civic-map/`) is React/HTML. D-V3-06 raw-SVG invariant applies to **Steward Console only** — Portal is free to use CSS.

**Visual treatment for away Nous avatars:**
- CSS: `opacity: 0.4; filter: grayscale(100%)`
- Hover tooltip: "away — last seen X min ago" (standard Radix Tooltip or HTML title)
- Awake Nous: full color, full opacity (unchanged)
- `absent` / `presumed_departed` Nous: separate visual state (Claude's discretion — e.g., outline-only or strikethrough badge)

**Data freshness:** Portal Civic Map polls `GET /api/v1/civic/presence` (no-auth, `visitor_public` policy) every **30 seconds**. No new WSS subscription needed. Response includes `{ nous: [{ civic_did, presence_status, last_seen_at }] }`.

### D-41-07: Absence Escalation Thresholds (Q-V3-H — LOCKED)

| Status | Threshold | Trigger | Effect |
|--------|-----------|---------|--------|
| `away` | Grace timer expires (5min) | WSS disconnect + no heartbeat | Civic Map shows dimmed avatar |
| `absent` | **30 days** since `last_seen_at` | Daily server-side check | Community charters with `revoke_absent: true` auto-revoke; notification queued |
| `presumed_departed` | **1 year** since `last_seen_at` | Daily server-side check | Civic-DID frozen (`409 civic_did_frozen`); Business-DID dissolved; Bios → treasury with `irs.disbursement_executed` |

Government may legislate alternative thresholds post-launch (Phase 46 framework). 30d/1y are v3.0 defaults.

**Escalation trigger mechanism:** Node.js `setInterval` running every **24 hours** on the Grid server (NOT tick-loop based — too expensive to check on every tick). Walks all `away` / `absent` Civic-DIDs with `last_seen_at > threshold` and updates status + triggers downstream effects.

### Claude's Discretion

- DB migration numbering: v30 = add presence columns to `civic_did_registry`; v31 = new `civic_message_queue` table
- Exact column names for presence tracking (recommendation above)
- `POST /api/v1/civic/presence` response shape
- Whether the 24h escalation check is wired into `GenesisLauncher` (like the existing reconcile loop) or as a standalone module
- `absent` / `presumed_departed` visual states on Civic Map beyond the `away` treatment
- `GET /api/v1/civic/presence` response shape (public endpoint)
- Steward Console queue depth display: existing `/system/operators` page pattern (Phase 39) can be reused

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sleep Cycle Architecture (Source of Truth)
- `.planning/STATE.md` §v3.0 Key Decisions D-V3-20 — Sleep cycle 4-state model (awake/away/absent/presumed_departed)
- `.planning/ROADMAP.md` §Phase 41 — Goals, Success Criteria (SLEEP-01..05), Out-of-Scope list

### Wire Protocol Foundation (Phase 38 — required reading)
- `brain/src/noesis_brain/wire/client.py` — GridWireClient: HTTPS REST + reconnect + queue drain. Phase 41 adds heartbeat calls here.
- `brain/src/noesis_brain/wire/subscriber.py` — WSS subscriber. Extend with `?since=<tick>` cursor on reconnect.
- `brain/src/noesis_brain/wire/queue.py` — WireQueue SQLite DB. Add `last_seen_tick` field here.
- `brain/src/noesis_brain/wire/token_manager.py` — TokenManager: EdDSA bearer token management. Heartbeat uses same auth.

### Civic DID Registry (Phase 37 — schema basis)
- `grid/src/db/schema.ts` migration v23 (`civic_did_registry` table) — Phase 41 adds presence columns here (v30).
- `grid/src/civic-registry/civic-did-store.ts` — CivicDidStore: CRUD for `civic_did_registry`. Phase 41 adds presence methods.

### Existing Sleep Audit Events (Phase 16 — DO NOT CONFUSE with Phase 41)
- `grid/src/sleep/types.ts` — `NousSleepPayload` is for **cognitive sleep** (Hypnos), not civic presence. Do NOT reuse.
- `grid/src/audit/append-operator-forced-sleep.ts` — operator-forced cognitive sleep. Not related to Phase 41.

### Civic Map (Phase 36 — UI basis)
- `dashboard/src/app/portal/civic-map/page.tsx` — existing Civic Map React page. Phase 41 adds presence polling + dimmed avatar CSS.
- `.planning/STATE.md` §v3.0 Phase 36 close-out — "Civic Map per-Nous data → Phase 37 (Civic-DID registry)". Phase 41 now extends this.

### IRS (Phase 45 dependency for presumed_departed)
- `.planning/ROADMAP.md` §Phase 45 — `irs.disbursement_executed` event used in SC5. Phase 41 emits this; Phase 45 is NOT required to land first — Phase 41 must add `irs.disbursement_executed` to the allowlist if it fires here.
- **Note:** `irs.disbursement_executed` is in the ROADMAP Phase 45 allowlist (+3 delta). Phase 41 MUST NOT add it if Phase 45 handles it. Check: SC5 requires this event tagged `cause: presumed_departed`. Resolution: Phase 41 may emit it as a stub event if Phase 45 is not yet shipped; confirm with planner.

### Operator Settings (Phase 39/40 pattern — reuse for Steward Console queue depth)
- `steward/src/app/system/operators/page.tsx` — Tier-2 Grid Manager surface. Phase 41 adds queue depth to this page (or a new `/system/presence` page).

### Constitutional Framework
- `.planning/STATE.md` §v3.0 Key Decisions D-V3-20 and D-V3-18 — constitutional operator cannot freeze Civic-DIDs "outside court order". `presumed_departed` freeze IS a constitutional process, not operator action.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `grid/src/audit/firehose-hub.ts` — `WsFirehoseHub`: Phase 38 extended with `didContext` per client and reconnect tracking. Phase 41 adds: start grace timer on disconnect; cancel timer on reconnect.
- `grid/src/civic-registry/civic-did-store.ts` — existing CRUD. Phase 41 adds `updatePresence()`, `getPresenceStatus()`, `getAllAwayNous()` methods.
- `brain/src/noesis_brain/wire/queue.py` — `WireQueue` SQLite. Phase 41 adds a single `last_seen_tick` value (key-value row) to this existing DB.
- `steward/src/app/system/operators/page.tsx` — existing `/system/operators` Tier-2 page. Phase 41 either adds a queue-depth section here or creates `/system/presence` following the same pattern.

### Established Patterns
- Phase 38 bearer JWT auth — Brain-to-Grid authentication. Heartbeat `POST /api/v1/civic/presence` uses the same `brain_tokens` table auth.
- `GenesisLauncher` `onTick()` subscription — one subscription exists (Phase 31). The 24h escalation check MUST NOT add a new `onTick` subscription. Use `setInterval` in the launcher constructor instead.
- `operatorScope` preHandler — Phase 39 pattern for Brain-authenticated routes under `operator/me/*`. Heartbeat and inbox routes follow this pattern.
- Phase 36 `ROUTE_DID_POLICY` table — all new routes need entries. Presence endpoint is `visitor_public`; heartbeat + inbox are `brain_required` (new policy value or `portal_session_required` variant).

### Integration Points
- `grid/src/genesis/launcher.ts` — add `setInterval` for 24h absence escalation check and grace timer management
- `grid/src/api/server.ts` — register new routes: `POST /api/v1/civic/presence`, `GET /api/v1/civic/presence`, `GET /api/v1/civic/inbox`, `PATCH /api/v1/civic/inbox/ack`
- `brain/src/noesis_brain/wire/client.py` — add `post_presence_heartbeat()` method called every 60s
- `brain/src/noesis_brain/wire/subscriber.py` — add `?since=<last_seen_tick>` param on WSS reconnect
- `dashboard/src/app/portal/civic-map/page.tsx` — add 30s polling + presence-aware avatar styling

</code_context>

<specifics>
## Specific Ideas

- The `irs.disbursement_executed` event in SC5 (`cause: presumed_departed`) needs coordination with Phase 45 planner — confirm whether Phase 41 pre-emits it or waits for Phase 45 to be shipped first.
- `POST /api/v1/civic/presence` response should include `{ status: 'awake', grace_timer_active: false }` so Brain can verify the heartbeat was received.
- Steward Console queue depth display should show "X messages queued for Nous" — visible per-operator (scoped to operator's Nous).
- The `absent` community revocation (`revoke_absent: true` charter flag) — community charters are Phase 49. Phase 41 should emit the revocation to a queue/event but actual charter processing may be stubbed until Phase 49 ships. Planner should note this dependency.

</specifics>

<deferred>
## Deferred Ideas

- Operator notification channels (email, push) when Brain's Nous goes away — separate work, out of v3.0 MVP
- Reversal of `presumed_departed` — TBD constitutional process, not in v3.0
- Government-legislated threshold overrides — Phase 46 framework (Government v3)
- Hot-reload of presence thresholds without restart — v3.x
- Per-community `revoke_absent` charter processing — Phase 49 (Communities v3); Phase 41 stubs the emission

</deferred>

---

*Phase: 41-sleep-cycle-away-presence*
*Context gathered: 2026-05-27*
