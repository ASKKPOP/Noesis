---
phase: 36
plan: "03"
subsystem: ws-firehose-redaction
tags: [ws-firehose, redaction, zero-diff, r-31-01, vis-03, per-subscriber]
depends_on: [36-01, 36-02]
provides: [serializeVisitorFrame, serializeFullFrame, per-subscriber-redaction, didContext-at-upgrade]
affects:
  - grid/src/audit/firehose-hub.ts
  - grid/src/audit/firehose-redaction.ts
  - grid/src/api/routes/audit-firehose.ts
  - grid/src/api/server.ts
  - grid/test/api/audit-firehose.test.ts
tech_stack:
  added: []
  patterns: [pure-function-serializer, per-subscriber-egress-redaction, did-context-at-ws-upgrade]
key_files:
  created:
    - grid/src/audit/firehose-redaction.ts
  modified:
    - grid/src/audit/firehose-hub.ts
    - grid/src/api/routes/audit-firehose.ts
    - grid/src/api/server.ts
    - grid/test/api/audit-firehose.test.ts
decisions:
  - "Redaction at egress only: onAuditEvent fan-out loop passes full AuditEntry to every client; trySend branches on tier"
  - "Anonymous WS clients (no bearer) receive event_type (snake_case) + family only — pre-existing audit-firehose test updated to assert new correct behavior"
  - "ServicesWithDidStore structural type inline in audit-firehose.ts to avoid circular import risk from importing GridServices"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-26"
  tasks_completed: 3
  files_count: 5
---

# Phase 36 Plan 03: WS Firehose Per-Subscriber Redaction Summary

Per-subscriber serialization for the WsFirehoseHub: visitor (anonymous / human_visitor) WS clients receive `{tick, event_type, family}` only; civic_member clients receive full audit frames. Audit chain itself is untouched — R-31-01 zero-diff preserved.

## What Was Built

### Task 1 — grid/src/audit/firehose-redaction.ts (NEW)

Pure-function serializer module. **64 lines**, no chain side effects.

**Exports:**
- `VISITOR_STRIPPED_PAYLOAD_KEYS: ReadonlySet<string>` — frozen set of 9 private-key names (`human_did`, `eth_address_hash`, `nonce_hash`, `target_did`, `voter_did`, `proposer_did`, `from_did`, `to_did`, `owner_human_did`). Documents the keys that would exist in payload; the actual egress strategy strips the entire payload for visitor frames.
- `serializeVisitorFrame(frame: ServerFrame): string` — for `type === 'event'` frames, emits `{tick, event_type, family}` only; for all other frame types, passes through via `JSON.stringify`.
- `serializeFullFrame(frame: ServerFrame): string` — pass-through `JSON.stringify` for civic_member subscribers.

Top-of-file comment: `// R-31-01 invariant: this serializer is a PURE FUNCTION.` Imports are type-only (`AuditEntry` from `./types.js`, `ServerFrame` from `../api/ws-protocol.js`) — no chain dependency that could cause circular issues.

### Task 2 — grid/src/audit/firehose-hub.ts (MODIFIED)

Surgical changes to `ClientConnection` and `WsFirehoseHub`:

**ClientConnection additions (lines ~68-100):**
- New `readonly didContext: DIDContext | null` field (after existing fields)
- Constructor gains `didContext: DIDContext | null` as final parameter
- `trySend()` branches: `didContext?.tier === 'civic_member'` → `serializeFullFrame`; otherwise → `serializeVisitorFrame`

**WsFirehoseHub additions (lines ~158-270):**
- `private _visitorCount = 0` field
- `onConnect(socket, didContext: DIDContext | null = null)` — optional default preserves backward compatibility
- After `_clients.add(client)`: increment `_visitorCount` if `didContext === null || tier !== 'civic_member'`
- Inside `socket.on('close', ...)`: decrement `_visitorCount` (`Math.max(0, ...)` clamp) before existing cleanup
- `visitorCountActive(): number` method — NOT part of `FirehoseStats` (Pitfall 6 guard)

**onAuditEvent (line ~265):**
- R-31-01 zero-diff comment added just before the fan-out loop
- Fan-out loop body: **untouched** — `client.enqueue(entry)` still receives the full `AuditEntry`

**FirehoseStats interface: unchanged.** `visitor_count_active` deliberately absent.

### Task 3 — grid/src/api/routes/audit-firehose.ts (MODIFIED)

- `import { tryDid } from '../preHandlers/tryDid.js'` added
- `ServicesWithDidStore` structural type declared inline (avoids circular import)
- `registerAuditFirehoseRoute` signature: `(instance, firehoseHub, services?: ServicesWithDidStore)`
- Handler made `async`; resolves `didContext = req.didContext ?? await tryDid(req, { didStore: services?.didStore })`
- `firehoseHub.onConnect(adapter, didContext)` — passes resolved context

**grid/src/api/server.ts:** single-line change at line 702: `registerAuditFirehoseRoute(instance, firehoseHub, services)` (was 2-arg, now 3-arg).

## Per-Subscriber Serializer Insertion Point

The tier branch lives in `ClientConnection.trySend()`. In the final file, the relevant block is around lines 83-100:

```typescript
const wire = this.didContext?.tier === 'civic_member'
    ? serializeFullFrame(frame)
    : serializeVisitorFrame(frame);
this.socket.send(wire);
```

`onAuditEvent` fan-out (around line 265) is untouched — the R-31-01 comment is the only addition there.

## R-31-01 Zero-Diff Confirmation

`firehose-hub-zero-diff.test.ts` passes GREEN:
- Scenario A (0 subscribers): `chain.head = X`
- Scenario B (1 anonymous subscriber): `chain.head = X`
- Scenario C (1 civic_member + 1 anonymous): `chain.head = X`

Chain head hash is byte-identical across all three scenarios. Redaction is at egress only; the chain never sees subscriber composition.

## Tests Turned GREEN by This Plan

| Test File | Tests | Was | Now |
|-----------|-------|-----|-----|
| `test/audit/firehose-hub-redaction.test.ts` | 1 | RED (onConnect signature mismatch) | GREEN |
| `test/audit/firehose-hub-zero-diff.test.ts` | 1 | GREEN (regression guard, stays green) | GREEN |

## Pre-Existing Zero-Diff Regression Tests

| Test File | Tests | Status |
|-----------|-------|--------|
| `test/audit/zero-diff-bios.test.ts` | 2 | GREEN (no regression) |
| `test/audit/zero-diff-ananke.test.ts` | 1 | GREEN (no regression) |
| `test/api/audit-firehose.test.ts` | 5 | GREEN (1 assertion updated — see Deviations) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing audit-firehose integration test assertion updated**
- **Found during:** Task 2 verification
- **Issue:** `test/api/audit-firehose.test.ts` line 129 asserted `ev.entry.eventType === 'nous.moved'`. After Plan 03, anonymous WS clients (no bearer token) receive visitor-redacted frames with `event_type` (snake_case) not `eventType` (camelCase), and no `actorDid`/`payload`. The old assertion was correct for pre-Plan-03 behavior (all clients got full frames), but Plan 03 changes this intentionally.
- **Fix:** Updated assertion to check `ev.entry.event_type === 'nous.moved'` + `ev.entry.family === 'nous'` + absence of `actorDid`/`payload`. The test now validates the new correct behavior.
- **Files modified:** `grid/test/api/audit-firehose.test.ts`
- **Commit:** `90e268f`

**2. [Rule 2 - Missing] Used inline structural type for ServicesWithDidStore**
- **Found during:** Task 3
- **Issue:** Plan specified `import type { GridServices } from '../server.js'` but this would create a circular dependency (server.ts imports from audit-firehose.ts; audit-firehose.ts importing from server.ts). Plan explicitly noted: "use type-only import to avoid circular concerns; if circular, declare a structural type inline."
- **Fix:** Declared `type ServicesWithDidStore = { didStore?: { isRevoked(did: string): boolean | Promise<boolean> } }` inline. No circular dependency.
- **Files modified:** `grid/src/api/routes/audit-firehose.ts`
- **Commit:** `d461dcc`

## Known Stubs

None — the redaction logic is fully operational. `VISITOR_STRIPPED_PAYLOAD_KEYS` serves as documentation but the actual visitor egress strips the entire payload (not individual keys), which is the correct and more conservative approach.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan specifies. The changes are egress-only serialization — the threat model entries T-36-VIS03 and T-36-R3101 are both now mitigated per plan.

## Self-Check: PASSED

Files verified:
- `grid/src/audit/firehose-redaction.ts` — FOUND
- `grid/src/audit/firehose-hub.ts` — FOUND (modified)
- `grid/src/api/routes/audit-firehose.ts` — FOUND (modified)
- `grid/src/api/server.ts` — FOUND (modified)

Commits verified:
- `0af20e7` — Task 1: firehose-redaction.ts
- `90e268f` — Task 2: hub extension + test fix
- `d461dcc` — Task 3: route DIDContext wiring
