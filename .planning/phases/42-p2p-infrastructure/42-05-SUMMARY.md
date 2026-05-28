---
phase: "42"
plan: "05"
subsystem: brain/wire
tags: [p2p, webrtc, aiortc, pynacl, sealedbox, signaling, encryption, doc-sync]
dependency_graph:
  requires: [42-04-PLAN.md, brain/pyproject.toml, brain/src/noesis_brain/wire/client.py, brain/src/noesis_brain/__main__.py]
  provides: [brain/src/noesis_brain/wire/p2p.py, BrainP2PClient, encrypt_sdp_for_peer, decrypt_sdp_from_peer]
  affects: [brain/src/noesis_brain/wire/client.py, brain/src/noesis_brain/__main__.py, .planning/ROADMAP.md, .planning/REQUIREMENTS.md, .planning/STATE.md, .planning/MILESTONES.md, README.md]
tech_stack:
  added: [aiortc>=1.13.0<2, PyNaCl SealedBox (Ed25519→X25519 key conversion)]
  patterns: [GridWireClient convention (errors logged at WARNING, never raised), asyncio.Task per-cadence (300s announce independent of 60s presence), lazy per-peer pubkey cache, SealedBox anonymous encryption for SDP blobs]
key_files:
  created:
    - brain/src/noesis_brain/wire/p2p.py
    - .planning/phases/42-p2p-infrastructure/42-05-SUMMARY.md
  modified:
    - brain/pyproject.toml
    - brain/src/noesis_brain/wire/client.py
    - brain/src/noesis_brain/__main__.py
    - brain/test/wire/test_p2p.py
    - brain/test/wire/test_p2p_crypto.py
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/MILESTONES.md
    - README.md
decisions:
  - "D-42-01: WebRTC (aiortc) as P2P protocol — Q-V3-A resolved"
  - "D-42-02/06: p2p.signal_received is private WSS push, NEVER in ALLOWLIST_MEMBERS"
  - "D-42-05: SDP encrypted with peer X25519 pubkey via PyNaCl SealedBox (Ed25519 JWK → VerifyKey.to_curve25519_public_key)"
  - "ANNOUNCE_INTERVAL_SECONDS=300 is a separate asyncio.Task from 60s presence heartbeat (Pitfall 6 anti-pattern avoided)"
metrics:
  duration: "~60 minutes (continuation after context compaction)"
  completed: "2026-05-28"
  tasks_completed: 3
  files_changed: 10
---

# Phase 42 Plan 05: BrainP2PClient + SealedBox Encryption + 300s Announce + Doc-Sync Summary

BrainP2PClient implementing WebRTC signaling via aiortc with PyNaCl SealedBox SDP encryption — Grid is a pure opaque relay; Brain-to-Brain content is invisible to Henry.

## What Was Built

### Task 1a — aiortc dependency + BrainP2PClient module

**`brain/pyproject.toml`:** Added `"aiortc>=1.13.0,<2"` dependency. `uv sync` confirmed successful installation.

**`brain/src/noesis_brain/wire/p2p.py`** (new, ~375 lines):

- `ANNOUNCE_INTERVAL_SECONDS: int = 300` — module constant (class attribute mirrors it for test discoverability)
- `encrypt_sdp_for_peer(sdp_string, peer_public_key_jwk) -> bytes`: Ed25519 JWK → `VerifyKey(raw_bytes).to_curve25519_public_key()` → `SealedBox.encrypt()` (D-42-05)
- `decrypt_sdp_from_peer(encrypted_blob, my_signing_key) -> str`: `SigningKey.to_curve25519_private_key()` → `SealedBox.decrypt()`
- `BrainP2PClient` class: `announce`, `get_peer_status`, `get_peer_public_key` (lazy per-peer cache), `initiate_connection` (full offer flow with aiortc ICE gathering poll), `handle_signal_received`, `_process_remote_sdp`, `get_turn_credentials`, `close`
- aiortc imported lazily inside methods (avoids ~80MB import at module load time)
- Pitfall 1 respected: polls `pc.iceGatheringState != "complete"` before sending SDP (aiortc has no trickle ICE)

### Task 1b — Wire BrainP2PClient + WSS dispatch + 300s announce task + unskip tests

**`brain/src/noesis_brain/wire/client.py`:** Added `post_p2p_announce()` method to `GridWireClient` — mirrors `post_presence_heartbeat()` convention (try/except, WARNING logs, never raises), POSTs `{}` to `/api/v1/p2p/announce`.

**`brain/src/noesis_brain/__main__.py`:**
- `BrainApp` gains `_p2p_announce_task: asyncio.Task | None` and `p2p_client: Any | None` fields
- `_p2p_announce_loop()`: `while self._running: await wire_client.post_p2p_announce(); await asyncio.sleep(300.0)` — SEPARATE from 60s presence task
- `start()` creates `_p2p_announce_task = asyncio.create_task(self._p2p_announce_loop())`
- `stop()` cancels `_p2p_announce_task`, calls `await self.p2p_client.close()`
- `create_brain_app_from_env()`: imports `BrainP2PClient`, shares `shared_http_client = await grid_wire_client._get_client()`, sets `app.p2p_client`
- `_on_frame()` dispatcher: `if frame.get("type") == "p2p.signal_received": await app.p2p_client.handle_signal_received(frame); return` — early return prevents audit-chain handler fallthrough (D-42-06)

**Tests:**
- `brain/test/wire/test_p2p.py`: 10 tests unskipped — announce (3: happy path, non-2xx, network error), peer discovery (3: get_peer_status, get_peer_public_key, missing JWK, cache hit), connection lifecycle (1: handle_signal_received decrypt + _process_remote_sdp call), TURN credentials (1), cadence constant (1)
- `brain/test/wire/test_p2p_crypto.py`: 8 tests — encrypt returns bytes, roundtrip, wrong key raises CryptoError, base64url padding, Ed25519→X25519 conversion, private key derivation, Grid cannot decrypt without private key, PyNaCl sanity

810 total brain tests pass after unskipping.

### Task 3 — Doc-sync (Phase 42 close-out)

- **ROADMAP.md**: Phase 42 plans listing `4/5` → `5/5`, all plans `[x]`; progress table row `In Progress` → `Complete 2026-05-28`
- **REQUIREMENTS.md**: P2P-01..05 all `[ ]` → `[x]`
- **STATE.md**: Current Position updated (Phase 42 complete); Phase 42 close-out block added with decisions, what shipped, inherits-to, key invariants
- **MILESTONES.md**: Phase 42 ship summary appended; last-updated line updated
- **README.md**: Phase 42 SHIPPED paragraph added after Phase 36 paragraph

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1a | 0a462fb | feat(42-05): aiortc dependency + BrainP2PClient module (Task 1a) |
| 1b | 7bbc0cb | feat(42-05): wire BrainP2PClient + WSS dispatch + 300s announce task + unskip tests (Task 1b) |
| 3 | (doc-sync commit) | docs(42-05): Phase 42 doc-sync + SUMMARY |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all implemented functionality is wired to real data sources. The `_active_connections` dict will remain empty until actual WebRTC peer connections are established in production, but that is expected runtime behavior, not a stub.

## Threat Flags

None — no new network endpoints beyond what Plan 42-04 already introduced (those routes shipped in Wave 2). The BrainP2PClient only calls existing Grid endpoints via the shared httpx.AsyncClient. SDP encryption via SealedBox ensures Grid cannot read Brain-to-Brain content (D-42-05 mitigated).

## Self-Check: PASSED

- `brain/src/noesis_brain/wire/p2p.py` — EXISTS (created in Task 1a commit 0a462fb)
- `brain/test/wire/test_p2p.py` — EXISTS (modified in Task 1b commit 7bbc0cb)
- `brain/test/wire/test_p2p_crypto.py` — EXISTS (modified in Task 1b commit 7bbc0cb)
- Commits 0a462fb and 7bbc0cb verified in git log
- P2P-01..05 checkboxes flipped in REQUIREMENTS.md
- Phase 42 progress table: 5/5 Complete 2026-05-28 in ROADMAP.md
- Phase 42 close-out block added to STATE.md
- Phase 42 ship summary added to MILESTONES.md
- Phase 42 SHIPPED paragraph added to README.md
