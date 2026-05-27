# Phase 41: Sleep Cycle + Away Presence — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 41-sleep-cycle-away-presence
**Areas discussed:** Away trigger mechanism, Message queue scope, Reconnect catch-up model, Civic Map away state

---

## Away Trigger Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid — grace timer | WSS disconnect starts 5-min server-side grace timer. Reconnect within window keeps status 'awake'. Timer expiry → flip to 'away'. Heartbeat from Brain resets timer. Best balance: tolerates blips, matches SC1 '5min' language. | ✓ |
| Heartbeat only | Brain sends POST /api/v1/civic/presence every 60s. No heartbeat for >5min → away. Simple and explicit but adds a new request loop. WSS disconnect alone has no presence effect. | |
| WSS disconnect only | WSS disconnect immediately flips to 'away'. Simple. But any network blip flips status — not production-grade for a public Grid. | |

**User's choice:** Hybrid — grace timer

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated POST /api/v1/civic/presence | Brain sends lightweight POST every 60s. Grid updates last_seen_at and resets grace timer. Clean separation, easy to test, clear semantics. | ✓ |
| Piggyback on WSS pings | WSS ping/pong frames; Grid tracks last pong time per Civic-DID; no new HTTP endpoint needed. But WSS pings are transport-level, not application-level — harder to attribute to a specific Civic-DID. | |

**User's choice:** Dedicated POST /api/v1/civic/presence (every 60s)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Away is invisible at the API level | Brain can still POST actions while Nous is 'away'. Status is a Grid-side display flag. No 409 errors for Brain writes during away window. | ✓ |
| Brain writes blocked while 'away' | Grid rejects Brain-authenticated writes until presence is re-established. Stricter but may cause problems if Brain reconnects mid-tick. | |

**User's choice:** Away is invisible at API level

---

## Message Queue Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Direct messages only | Only POST /api/v1/civic/message queues. Marketplace bids, votes, community writes execute normally. Away Nous discovers outcomes on reconnect. Simple, matches ROADMAP SC2 exactly. | ✓ |
| Messages + social pokes | Direct messages AND explicit notification-type writes (community @mention, challenge/request) queue. Votes and marketplace writes execute immediately. | |
| All writes targeting away Nous | Any write where target Civic-DID is 'away' queues. Comprehensive but complex — requires every write route to check target presence status. | |

**User's choice:** Direct messages only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inbox = queued messages only; civic events via firehose cursor | GET /api/v1/civic/inbox returns only queued direct messages. Brain subscribes to WSS firehose with 'since' cursor and replays civic events from last_seen_tick. Clean separation of concerns. | ✓ |
| Inbox = messages + civic event summaries | Inbox endpoint also returns summary of relevant civic events. Richer but requires Grid to project 'relevant events' per Civic-DID. | |

**User's choice:** Inbox = messages only; civic events via firehose 'since' cursor

---

## Reconnect Catch-up Model

| Option | Description | Selected |
|--------|-------------|----------|
| Brain-local SQLite (Phase 38 WireQueue DB) | Brain writes last_seen_tick to existing WireQueue SQLite DB after each heartbeat ACK. On reconnect, reads local value. Fallback: GET /api/v1/civic/presence/me from Grid. | ✓ |
| Grid-side only | Grid stores last_seen_tick; Brain calls GET /api/v1/civic/presence/me to retrieve before requesting inbox. Extra round-trip before inbox fetch. | |

**User's choice:** Brain-local SQLite (Phase 38 WireQueue DB) with Grid fallback

---

| Option | Description | Selected |
|--------|-------------|----------|
| WSS firehose 'since' cursor | Phase 38 WSS subscriber re-subscribes with ?since=<last_seen_tick>. No new endpoint needed — extends existing WSS mechanism. | ✓ |
| New REST endpoint GET /api/v1/civic/events?since=<tick> | REST endpoint returns paged audit-chain events since tick. More explicit but requires new endpoint + pagination logic. | |

**User's choice:** WSS firehose 'since' cursor

---

## Civic Map Away State

| Option | Description | Selected |
|--------|-------------|----------|
| CSS opacity + greyscale filter | Away avatar: opacity: 0.4 + filter: grayscale(100%). Online: full color. Hover tooltip "away — last seen X min ago". Pure CSS, reversible. | ✓ |
| Separate 'away' badge / icon overlay | Moon or pause icon overlaid. Full color retained. More expressive but requires SVG/icon overlay component. | |
| You decide | Let planner choose visual treatment. | |

**User's choice:** CSS opacity + greyscale filter

---

| Option | Description | Selected |
|--------|-------------|----------|
| Polling — refetch presence every 30s | Civic Map polls GET /api/v1/civic/presence every 30s. Acceptable staleness. No new WSS subscription. | ✓ |
| WSS firehose push-on-change | Grid emits presence-change event to Portal WSS subscription. Instant but requires new event type (allowlist impact). | |

**User's choice:** 30s polling

---

## Claude's Discretion

- DB migration numbering (v30 = presence columns on civic_did_registry; v31 = civic_message_queue)
- Exact presence column names and schema shape
- Heartbeat response body
- 24h escalation check wiring in GenesisLauncher
- absent / presumed_departed visual states on Civic Map
- GET /api/v1/civic/presence response shape

## Deferred Ideas

- Operator notification channels (email, push) for Brain away events
- Reversal of presumed_departed (constitutional process)
- Government-legislated threshold overrides (Phase 46)
- Per-community revoke_absent charter processing (Phase 49 stub)
