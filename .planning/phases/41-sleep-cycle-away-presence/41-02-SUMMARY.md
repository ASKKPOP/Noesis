---
phase: 41
plan: 02
subsystem: grid/civic-presence
tags: [db-migration, presence, message-queue, audit, civic-did]
dependency_graph:
  requires: [41-01]
  provides: [PresenceStore, MessageQueueStore, GraceTimerRegistry, appendIrsDisbursementExecuted, CivicDidStore.markFrozen]
  affects: [grid/src/civic-presence/, grid/src/civic-registry/, grid/src/audit/, grid/src/db/schema.ts]
tech_stack:
  added: []
  patterns: [sole-producer-8-step, parameterized-sql, refcount-grace-timer]
key_files:
  created:
    - grid/src/civic-presence/types.ts
    - grid/src/civic-presence/grace-timer-registry.ts
    - grid/src/civic-presence/presence-store.ts
    - grid/src/civic-presence/message-queue-store.ts
    - grid/src/audit/append-irs-disbursement-executed.ts
  modified:
    - grid/src/db/schema.ts
    - grid/src/civic-registry/types.ts
    - grid/src/civic-registry/civic-did-store.ts
decisions:
  - "appendIrsDisbursementExecuted is audit-chain-only — NOT added to broadcast allowlist (Phase 45 owns +3 delta)"
  - "PresenceStore.isFrozen() is the query Plan 04 requireCivicDid preHandler MUST call for T-41-04"
  - "Migrations v30+v31 committed to schema.ts — auto-apply on next Grid container start (Docker not running)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-27"
  tasks_completed: 3
  files_changed: 8
---

# Phase 41 Plan 02: DB Layer + Civic-Presence Module Summary

DB migration definitions (v30 + v31) appended to schema.ts; four-file civic-presence module created (types, GraceTimerRegistry, PresenceStore, MessageQueueStore); CivicDidStore extended with markFrozen + presence fields; appendIrsDisbursementExecuted sole-producer created (audit-chain-only, allowlist delta=0).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add migrations v30+v31 to schema.ts | e39ac67 | grid/src/db/schema.ts |
| 2 | Create civic-presence module (4 files) | e39ac67 | grid/src/civic-presence/{types,grace-timer-registry,presence-store,message-queue-store}.ts |
| 3 | Extend CivicDidStore + create appendIrsDisbursementExecuted | e39ac67 | grid/src/civic-registry/types.ts, civic-did-store.ts, grid/src/audit/append-irs-disbursement-executed.ts |

## Migration Summary

### Migration v30 — add_presence_to_civic_did_registry

Adds 5 columns to `civic_did_registry`:
- `presence_status ENUM('awake','away','absent','presumed_departed') NOT NULL DEFAULT 'awake'`
- `last_seen_at TIMESTAMP(3) NULL`
- `last_seen_tick INT UNSIGNED NULL`
- `away_grace_expires_at TIMESTAMP(3) NULL`
- `frozen TINYINT(1) NOT NULL DEFAULT 0`

Plus 2 composite indexes: `idx_presence_status (grid_name, presence_status)` and `idx_last_seen_at (grid_name, last_seen_at)`.

**Status:** Committed to schema.ts (version 30). Docker daemon not running — migrations auto-apply on next Grid container start via `MigrationRunner` (main.ts line 85).

### Migration v31 — create_civic_message_queue

Creates new `civic_message_queue` table with columns: `id BIGINT UNSIGNED AUTO_INCREMENT PK`, `grid_name`, `recipient_civic_did`, `sender_civic_did`, `message_json JSON`, `sent_at_tick INT UNSIGNED`, `sent_at TIMESTAMP(3)`, `status ENUM('pending','delivered')`. Two composite indexes for inbox queries and tick-based pagination.

**Status:** Committed to schema.ts (version 31). Auto-applies on next Grid container start.

## Module Exports

### civic-presence/types.ts
- `PresenceStatus` — `'awake' | 'away' | 'absent' | 'presumed_departed'`
- `PresenceRecord` — readonly interface mirroring v30 columns
- `QueuedMessage` — readonly interface mirroring v31 columns
- `GRACE_TIMER_MS = 300_000` (5 min, D-41-01)
- `ABSENT_THRESHOLD_MS = 2_592_000_000` (30 days, D-41-07)
- `PRESUMED_DEPARTED_THRESHOLD_MS = 31_536_000_000` (1 year, D-41-07)
- `QUEUE_DEPTH_MAX = 1000` (T-41-02 mitigation)
- `ESCALATION_INTERVAL_MS = 86_400_000` (24 hours, D-41-07)

### civic-presence/grace-timer-registry.ts
- `GraceTimerRegistry` — per-Civic-DID `setTimeout` with WSS connection refcount
  - `incrementConnection(civicDid)` — call on WSS connect; cancels pending timer
  - `decrementConnection(civicDid, onExpired, graceMs)` — call on WSS close; starts timer at count=0
  - `heartbeat(civicDid)` — cancels pending timer (POST /civic/presence)
  - `startGraceTimer` / `cancelGraceTimer` — direct control
  - `clear()` — OBS-R-32-02 shutdown drain
  - `activeTimerCount()` / `connectionCount(civicDid)` — test inspection

### civic-presence/presence-store.ts
- `PresenceStore` — MySQL queries against `civic_did_registry` presence columns
  - `updatePresence(gridName, civicDid, status, lastSeenTick)` — all 4 state transitions
  - `getPresence(gridName, civicDid)` — single-row fetch
  - `listAll(gridName)` — Civic Map polling source
  - `listStaleSince(gridName, olderThan, inStatuses)` — escalation source
  - **`isFrozen(gridName, civicDid)`** — T-41-04 mitigation; Plan 04 MUST call this in requireCivicDid preHandler

### civic-presence/message-queue-store.ts
- `MessageQueueStore` — `civic_message_queue` CRUD
  - `enqueue(...)` — returns `null` if depth >= 1000 (T-41-02)
  - `depth(gridName, recipientCivicDid)` — pending count
  - `listPending(gridName, recipientCivicDid, sinceTick)` — inbox query
  - `markDelivered(gridName, recipientCivicDid, messageIds)` — cross-DID ack prevention (T-41-05)
  - `depthByRecipient(gridName)` — Steward Console / Grid Manager view

### audit/append-irs-disbursement-executed.ts
- `appendIrsDisbursementExecuted(audit, payload)` — sole producer for `irs.disbursement_executed`
- `IrsDisbursementExecutedPayload` — 5-key closed tuple: `{amount_bios, cause, civic_did, grid_name, tick}`
- 8-step discipline: type guard → regex → non-empty strings → non-negative integers → closed-tuple check → explicit reconstruction → privacyCheck → `audit.append`
- **NOT in broadcast allowlist** — audit-chain-only until Phase 45 ships

### civic-registry/civic-did-store.ts (extended)
- `CivicDidStore.markFrozen(gridName, civicDid, frozenAtTick)` — sets `frozen=1, presence_status='presumed_departed'`
- `rowToRecord` extended — maps presence columns (backward-compatible optional fields)

## Allowlist Verification

`grep -c "'irs.disbursement_executed'" grid/src/audit/broadcast-allowlist.ts` → **0** (NOT added)

Allowlist count **unchanged at 64**. Phase 41 allowlist delta = 0 per ROADMAP.

## Known Stubs

None — this plan is pure persistence layer. No UI rendering, no hardcoded data.

## Threat Flags

None — no new network endpoints or auth paths in this plan. All threat mitigations are documented in PLAN.md threat_model:
- T-41-02: MessageQueueStore.enqueue depth cap at 1000
- T-41-04: PresenceStore.isFrozen() ready for Plan 04 requireCivicDid preHandler
- T-41-03: CURRENT_TIMESTAMP(3) used by DB (not caller-provided) for last_seen_at
- T-41-DB-01: All queries use `?` placeholders

## Carry-Forward to Plan 03 (Grace Timer Wiring)

- `GraceTimerRegistry` is instantiated once per Grid; wire it in `WsFirehoseHub` with `incrementConnection` / `decrementConnection` hooks on WSS connect/close events
- `GraceTimerRegistry.clear()` MUST be called in `WsFirehoseHub.close()` (OBS-R-32-02)
- `PresenceStore.updatePresence(gridName, civicDid, 'away', tick)` is the grace timer expiry callback

## Carry-Forward to Plan 04 (Presence Routes)

- `PresenceStore.isFrozen(gridName, civicDid)` is the query `requireCivicDid` preHandler MUST call before every write route to enforce T-41-04 (409 response on frozen DID)
- `MessageQueueStore.enqueue` returns `null` on cap hit — route layer maps to 429

## Self-Check: PASSED

- `/Users/desirey/Programming/src/Noesis/grid/src/civic-presence/types.ts` — EXISTS
- `/Users/desirey/Programming/src/Noesis/grid/src/civic-presence/grace-timer-registry.ts` — EXISTS
- `/Users/desirey/Programming/src/Noesis/grid/src/civic-presence/presence-store.ts` — EXISTS
- `/Users/desirey/Programming/src/Noesis/grid/src/civic-presence/message-queue-store.ts` — EXISTS
- `/Users/desirey/Programming/src/Noesis/grid/src/audit/append-irs-disbursement-executed.ts` — EXISTS
- Commit e39ac67 — EXISTS
- TypeScript `--noEmit` exits 0 — VERIFIED
- Allowlist NOT modified — VERIFIED (grep returns 0)
- Migrations v30+v31 in schema.ts — VERIFIED (grep -c returns 1 each)
