---
phase: 41
plan: 05
subsystem: brain-wire
tags: [sleep-cycle, heartbeat, kv-store, since-cursor, wss-subscriber]
dependency_graph:
  requires: [41-01, 41-02]
  provides: [brain-presence-heartbeat, kv-store-last-seen-tick, wss-since-cursor]
  affects: [brain/__main__.py, brain/wire/queue.py, brain/wire/client.py, brain/wire/subscriber.py]
tech_stack:
  added: []
  patterns: [asyncio.create_task, asyncio.sleep, INSERT OR REPLACE kv_store, websockets ?since= cursor]
key_files:
  created: []
  modified:
    - brain/src/noesis_brain/wire/queue.py
    - brain/src/noesis_brain/wire/client.py
    - brain/src/noesis_brain/wire/subscriber.py
    - brain/src/noesis_brain/__main__.py
    - brain/test/test_wire_queue_kv.py
    - brain/test/test_wire_client_heartbeat.py
    - brain/test/test_wire_subscriber_since.py
decisions:
  - WireQueue kv_store uses INSERT OR REPLACE semantics so set_last_seen_tick is idempotent and always stores the latest value
  - post_presence_heartbeat swallows ALL exceptions via bare except — grace timer is the safety net, never raises
  - _compute_connect_url is a pure synchronous method (no async, no network) so tests are trivial without mocking
  - Heartbeat task is scheduled in BrainApp.start() rather than create_brain_app_from_env() to keep the factory pure
  - WssSubscriber wired with queue= in create_brain_app_from_env(); noop on_frame placeholder for future phases
metrics:
  duration: "8 minutes"
  completed: "2026-05-27T19:15:21Z"
  tasks_completed: 4
  files_modified: 7
---

# Phase 41 Plan 05: Brain Wire Heartbeat + kv_store + ?since= Cursor Summary

Brain-side sleep cycle wire infrastructure: 60s presence heartbeat task, SQLite kv_store for last_seen_tick persistence, and WssSubscriber ?since= reconnect cursor. All 11 Wave 0 pytest stubs flipped from skip → pass.

## What Was Built

### Task 1 — WireQueue kv_store (`brain/src/noesis_brain/wire/queue.py`)

Added `CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)` to `WireQueue.__init__` after the `wire_queue` table creation.

Two new methods before `close()`:
- `set_last_seen_tick(tick: int) -> None` — INSERT OR REPLACE into `kv_store` with key `last_seen_tick`
- `get_last_seen_tick() -> int | None` — SELECT from `kv_store`, returns None if no row

### Task 2 — `GridWireClient.post_presence_heartbeat()` (`brain/src/noesis_brain/wire/client.py`)

New async method added between `_do_post_actions` and `_enqueue_all`. Behavior:
- POSTs `{}` to `{base_url}/api/v1/civic/presence` with Bearer JWT
- On 2xx: reads `last_seen_tick` from response JSON, calls `queue.set_last_seen_tick(tick)` if queue is not None
- On non-2xx: logs WARNING
- On any exception (transport, timeout, etc.): logs WARNING, returns None — never raises

### Task 3 — `WssSubscriber._compute_connect_url` (`brain/src/noesis_brain/wire/subscriber.py`)

- Added `queue: Optional[WireQueue] = None` parameter to `__init__` with `self._queue = queue`
- Added import `from .queue import WireQueue`
- New method `_compute_connect_url() -> str`: returns `self._url` when queue is None or `get_last_seen_tick()` returns None; returns `f"{self._url}?since={tick}"` otherwise
- Updated `_connect_once` to call `connect_url = self._compute_connect_url()` and use `connect_url` instead of `self._url`

### Task 4 — Heartbeat wiring in `brain/src/noesis_brain/__main__.py`

**`_heartbeat_loop` coroutine** (module-level, before `BrainApp`):
- File: `brain/src/noesis_brain/__main__.py`
- Function: `_heartbeat_loop(client: GridWireClient) -> None`
- Loops forever: `await client.post_presence_heartbeat()` then `await asyncio.sleep(60)`
- Any iteration exception logged at WARNING, loop continues

**`BrainApp` additions:**
- New attributes: `_wss_subscriber: Any | None = None`, `_heartbeat_task: asyncio.Task | None = None`
- `start()`: if `_wss_subscriber` is not None, calls `await _wss_subscriber.start()`; if `handler._grid_wire_client` is set and `_heartbeat_task` is None, creates `asyncio.create_task(_heartbeat_loop(grid_wire_client))`
- `stop()`: cancels `_heartbeat_task` (awaits CancelledError), then `await _wss_subscriber.stop()` if set

**Heartbeat task scheduled at:** `BrainApp.start()` — in the startup sequence, after RPC and HTTP servers
**Heartbeat task cancelled at:** `BrainApp.stop()` — before HTTP server stop, before RPC stop

**`create_brain_app_from_env()` additions (when GRID_URL + token_manager present):**
- Imports `WireQueue`, `WssSubscriber`
- Creates `wire_queue = WireQueue(wire_queue_path)` where path is `{SOCKET_DIR}/noesis-nous-{slug}-wire.db`
- Passes `brain_did=nous_did_for_wire, queue=wire_queue` to `GridWireClient`
- Creates `WssSubscriber(grid_url=..., token_manager=..., on_frame=_noop_on_frame, queue=wire_queue)`
- Sets `app._wss_subscriber = wss_subscriber`

**Updated `WssSubscriber.__init__` signature:**
```python
def __init__(self, *, grid_url: str, token_manager: TokenManager,
             on_frame: Callable[[dict], Awaitable[None]],
             queue: Optional[WireQueue] = None) -> None
```

## Test Results

11 Wave 0 stubs flipped from skip → pass:
- `test_wire_queue_kv.py`: 4 passed
- `test_wire_client_heartbeat.py`: 4 passed
- `test_wire_subscriber_since.py`: 3 passed

Full suite: **792 passed, 5 warnings** (pre-existing warnings in test_fixture_adapter.py, not introduced by this plan)

## Carry-Forward

Brain is now ready for end-to-end heartbeat smoke test:
1. Start Brain with GRID_URL + CIVIC_DID + NOUS_DID set
2. Grid-side `POST /api/v1/civic/presence` endpoint needed (Plan 41-03/04 scope)
3. Verify Grid resets grace timer on receipt
4. Verify `last_seen_tick` roundtrip: Grid response → Brain kv_store → next WSS reconnect ?since=

## Deviations from Plan

None — plan executed exactly as written.

The `WssSubscriber` was not previously wired in `create_brain_app_from_env()`. This plan introduced the wiring with a noop `on_frame` placeholder. The heartbeat task is created in `BrainApp.start()` (reading from `handler._grid_wire_client`) rather than inline in `create_brain_app_from_env()`, keeping the factory pure.

## Self-Check: PASSED

Files confirmed present:
- brain/src/noesis_brain/wire/queue.py — modified (kv_store table + 2 methods)
- brain/src/noesis_brain/wire/client.py — modified (post_presence_heartbeat)
- brain/src/noesis_brain/wire/subscriber.py — modified (_compute_connect_url + queue param)
- brain/src/noesis_brain/__main__.py — modified (_heartbeat_loop + BrainApp._heartbeat_task)
- brain/test/test_wire_queue_kv.py — 4 passing tests
- brain/test/test_wire_client_heartbeat.py — 4 passing tests
- brain/test/test_wire_subscriber_since.py — 3 passing tests

Commit confirmed: `4f325bd`
