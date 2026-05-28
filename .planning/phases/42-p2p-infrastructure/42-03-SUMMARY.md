---
phase: 42
plan: 03
subsystem: grid/audit + docker-compose + planning-docs
tags: [p2p, audit-chain, sole-producer, allowlist, coturn, stun, turn, doc-sync]
dependency_graph:
  requires: [42-01, grid/src/audit/chain.ts, grid/src/audit/broadcast-allowlist.ts]
  provides: [p2p.peer_announced (65), p2p.connection_opened (66), p2p.connection_closed (67), coturn-sidecar, TURN-free-contract]
  affects: [grid/src/audit/broadcast-allowlist.ts, docker-compose.yml, .planning/ROADMAP.md, .planning/REQUIREMENTS.md]
tech_stack:
  added: [coturn/coturn:4.6.3 Docker image, HMAC-SHA1 short-lived TURN credentials]
  patterns: [8-step sole-producer discipline, closed-tuple structural check, payloadPrivacyCheck, closed-enum gate, RFC1918 denied-peer-ip guards]
key_files:
  created:
    - grid/src/audit/append-p2p-peer-announced.ts
    - grid/src/audit/append-p2p-connection-opened.ts
    - grid/src/audit/append-p2p-connection-closed.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/test/audit/broadcast-allowlist.test.ts
    - grid/test/p2p/p2p-producer-boundary.test.ts
    - docker-compose.yml
    - .env.example
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
decisions:
  - D-42-07: exactly +3 allowlist entries (64→67); p2p.signal_received explicitly excluded
  - D-42-06: p2p.signal_received is a private WSS push only, NOT an audit chain event
  - D-42-03: TURN is FREE in v3.0; Civic-DID auth gates access; paid billing deferred to v3.1+
  - test-design: missing-key tests assert TypeError (not /closed-tuple/) because field guards fire before closed-tuple check in 8-step order
metrics:
  duration: 45m
  completed: 2026-05-27
  tasks: 3
  files_changed: 9
---

# Phase 42 Plan 03: Three P2P Sole-Producer Audit Events + coturn + Doc-Sync Summary

**One-liner:** P2P audit chain locked at 64→67 via 3 closed-tuple sole-producers (8-step discipline) + coturn STUN/TURN sidecar + TURN-free contract synchronized to ROADMAP/REQUIREMENTS.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Three sole-producer audit event files + allowlist +3 | dbb1d30 | 3 new append-p2p-*.ts, broadcast-allowlist.ts, 2 test files |
| 2 | coturn STUN/TURN sidecar in docker-compose + env var | 58c96b0 | docker-compose.yml, .env.example |
| 3 | DOC-SYNC: ROADMAP SC3 + REQUIREMENTS P2P-03 TURN free in v3.0 | 9dfc197 | .planning/ROADMAP.md, .planning/REQUIREMENTS.md |

## Sole-Producer Files Created

### `grid/src/audit/append-p2p-peer-announced.ts` (93 lines)
- Sole producer for `p2p.peer_announced` (allowlist position 65)
- Closed 3-key payload `{civic_did_hash, endpoint_hash, tick}` (alphabetical)
- HEX64_RE validates both hash fields; non-negative integer for tick
- actorDid = civic_did_hash (announcing party)

### `grid/src/audit/append-p2p-connection-opened.ts` (102 lines)
- Sole producer for `p2p.connection_opened` (allowlist position 66)
- Closed 4-key payload `{connection_id, from_did_hash, tick, to_did_hash}` (alphabetical)
- UUID_RE validates connection_id; HEX64_RE for hash fields
- actorDid = from_did_hash (initiating party)

### `grid/src/audit/append-p2p-connection-closed.ts` (108 lines)
- Sole producer for `p2p.connection_closed` (allowlist position 67)
- Closed 4-key payload `{close_reason, connection_id, duration_ticks, tick}` (alphabetical)
- CLOSE_REASONS = new Set(['completed', 'timeout', 'error', 'initiated']) — closed-enum gate (step 2)
- actorDid = connection_id (no party-specific actor for close events)

All 3 files implement the full 8-step discipline: type guard → regex/format guards → integer guards → closed-enum gate (where applicable) → closed-tuple structural check → explicit reconstruction (no spread) → payloadPrivacyCheck → audit.append.

## Allowlist Transition: 64 → 67

New entries appended after `'registry.business_did_dissolved'` (position 64):

```typescript
// Phase 42 (P2P-05 / D-42-07) — +3 P2P audit events. Allowlist 64 → 67.
// IMPORTANT: p2p.signal_received is NOT in the allowlist (D-42-06) — it is a
// private WSS push delivered only to the recipient Brain by hub.pushSignalToDid().
'p2p.peer_announced',      // (65) {civic_did_hash, endpoint_hash, tick}
'p2p.connection_opened',   // (66) {connection_id, from_did_hash, tick, to_did_hash}
'p2p.connection_closed',   // (67) {close_reason, connection_id, duration_ticks, tick}
```

`p2p.signal_received` is explicitly documented as excluded in both the JSDoc comment block and the code comment block.

## coturn Service

Added to `docker-compose.yml` before `volumes:` section:

- Image: `coturn/coturn:4.6.3`
- Ports: 3478 TCP + UDP (STUN/TURN), 5349 TCP + UDP (TURNS)
- UDP 49152-65535 relay range omitted in dev (macOS Docker Desktop limitation — commented out for production AWS)
- `--use-auth-secret` + `--realm=noesis.grid` for HMAC-SHA1 short-lived credentials
- `--denied-peer-ip` for 10/8, 192.168/16, 172.16/12, 127/8 (RFC1918 + loopback SSRF guards)
- Grid service gains `TURN_STATIC_AUTH_SECRET`, `TURN_HOST`, `TURN_PORT` env passthrough

`.env.example` additions:
```
TURN_STATIC_AUTH_SECRET=changeme-turn-secret
TURN_HOST=coturn
TURN_PORT=3478
```

## ROADMAP/REQUIREMENTS Doc-Sync Diff

### ROADMAP.md — Before/After for SC3 + Goal

**Wave 2 summary line (before):**
`Grid-mediated signaling + DID-to-endpoint discovery + STUN (free) / TURN (paid); Brain-to-Brain content stays direct.`

**Wave 2 summary line (after):**
`Grid-mediated signaling + DID-to-endpoint discovery + STUN/TURN (both free in v3.0; Civic-DID auth gates TURN per D-42-03); Brain-to-Brain content stays direct.`

**Goal block (before):**
`Grid provides signaling, DID-to-endpoint discovery, and NAT traversal (STUN free / TURN paid).`

**Goal block (after):**
`Grid provides signaling, DID-to-endpoint discovery, and NAT traversal (STUN free / TURN free in v3.0 with Civic-DID auth — paid billing deferred to v3.1+ per D-42-03).`

**SC3 (before):**
`TURN relay (paid Bios per session) is opt-in — GET /api/v1/p2p/turn-credentials returns short-lived auth only after the initiating Nous pays the per-session Bios fee.`

**SC3 (after):**
`TURN relay is FREE in v3.0 (paid billing deferred to v3.1+ per D-42-03) — GET /api/v1/p2p/turn-credentials returns short-lived HMAC-SHA1 coturn credentials after Civic-DID auth check; no Bios deduction.`

### REQUIREMENTS.md P2P-03 — Before/After

**Before:**
`Grid runs STUN service for NAT discovery (free); TURN relay service is optional and paid by initiating Nous (Bios fee per session). Reduces Grid bandwidth load.`

**After:**
`Grid runs STUN service for NAT discovery (free); TURN relay service is also free in v3.0 (paid billing deferred to v3.1+ per D-42-03). TURN access requires Civic-DID auth (HMAC-SHA1 short-lived coturn credentials via GET /api/v1/p2p/turn-credentials) to prevent anonymous relay abuse. Reduces Grid bandwidth load.`

## Verification Results

**Stale TURN-paid language check:**
`grep -nE "TURN.*paid|paid.*Bios|Bios.*per.*session" .planning/ROADMAP.md .planning/REQUIREMENTS.md` — 0 matches for the old "TURN (paid)" or "paid by initiating Nous" patterns. Remaining "paid billing deferred" references are the new correct language.

**Test results:**
- `grid/test/audit/broadcast-allowlist.test.ts`: 85 tests passed (includes 5 Phase 42 assertions — unskipped)
- `grid/test/p2p/p2p-producer-boundary.test.ts`: 25 tests passed (fully implemented, 0 skips)
- `cd grid && npm run build`: 0 TypeScript errors

**docker compose config:** Valid (1 pre-existing version-attribute warning, not an error)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectations for missing-key assertions**
- **Found during:** Task 1 — first test run
- **Issue:** The stub tests expected `/closed-tuple/` when a key was missing, but the 8-step discipline validates field format (step 2) before the closed-tuple structural check (step 5). Missing fields hit the regex/enum guards first, not the closed-tuple check.
- **Fix:** Changed missing-key test assertions from `.toThrow(/closed-tuple/)` to `.toThrow(TypeError)` (which is accurate). Added comments explaining the ordering. Extra-key test still correctly asserts `/closed-tuple/`.
- **Files modified:** `grid/test/p2p/p2p-producer-boundary.test.ts`
- **Commit:** dbb1d30

None — plan executed with one auto-fix.

## Known Stubs

None — all 3 sole-producer files are fully implemented with real validation logic. No hardcoded empty values or placeholder text.

## Threat Flags

None — all files created in this plan are within the existing audit chain trust boundary. No new network endpoints, auth paths, or schema changes introduced (coturn is a new infrastructure service but its security surface is documented and mitigated by `--denied-peer-ip` guards in Task 2).

## Self-Check: PASSED
