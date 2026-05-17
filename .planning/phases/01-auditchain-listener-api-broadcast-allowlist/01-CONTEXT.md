# Phase 1: AuditChain Listener API + Broadcast Allowlist - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Source:** Milestone research synthesis (.planning/research/SUMMARY.md)

<domain>
## Phase Boundary

This phase makes the AuditChain observable from outside by adding a `.onAppend()` listener API and defines the default-deny broadcast allowlist module. It is **pure internal plumbing** — no WebSocket, no HTTP route, no UI. The phase is bounded strictly by:

**In scope:**
- Modifications to `grid/src/audit/chain.ts` (add listener set, `onAppend()` method, fire-after-commit semantics)
- New file `grid/src/audit/broadcast-allowlist.ts` (allowlist module with default-deny policy)
- New file `grid/src/util/ring-buffer.ts` (generic bounded FIFO utility)
- Unit tests in `grid/test/audit/` and `grid/test/util/`
- Benchmark test (micro) to confirm `append()` p99 stays within budget

**Explicitly out of scope:**
- Any `@fastify/websocket` install or WS route (Phase 2)
- Any `WsHub`, `ClientConnection`, or broadcast fan-out code (Phase 2)
- Any dashboard scaffolding or UI code (Phase 3)
- Any MySQL persistence changes
- Any brain-side changes

</domain>

<decisions>
## Implementation Decisions (locked from research)

### AuditChain.onAppend() API shape
- **Method signature:** `onAppend(listener: (entry: AuditEntry) => void): () => void` — returns unsubscribe function
- **Storage:** `private readonly appendListeners: Set<AppendListener> = new Set();`
- **Pattern source:** Mirror `WorldClock.onTick()` exactly — already proven in `grid/src/clock/ticker.ts`

### Fire semantics
- **Fire point:** AFTER `this.entries.push(entry)` AND `this.lastHash = eventHash` have committed — never before
- **Synchronous:** No `await`, no `setTimeout`, no `queueMicrotask` — fans out in-place
- **Isolation:** Each listener wrapped in `try { listener(entry); } catch (err) { /* swallowed */ }` — a thrown listener cannot corrupt chain state or reach the caller
- **Error reporting:** For v1, caught errors are silently swallowed (matches `WorldClock.onTick` pattern). Observability of listener errors is deferred to Phase 2+.

### loadEntries() must NOT fire listeners
- The MySQL restore path (`AuditChain.loadEntries()`) is explicitly silent — it reconstructs chain state without triggering observer side effects
- Rationale: on Grid restart, observers reconnect fresh; they must not see historical entries replayed as "new" events

### Determinism invariant
- Attaching listeners must NEVER change the audit chain's byte-identical output
- Regression test: run a 100-tick simulation twice — once with 0 listeners, once with 10 listeners — and assert `audit.head` hash is identical at every step

### append() performance budget
- Per-listener overhead: **<100µs added to p99** measured on an average developer machine
- Micro-benchmark required: append 10,000 entries with 0, 1, and 10 listeners; assert budget

### Broadcast allowlist module
- **Location:** `grid/src/audit/broadcast-allowlist.ts` (new file)
- **Policy:** Default-deny — any event type NOT in the allowlist is NOT broadcast
- **API:** `isAllowlisted(eventType: string): boolean` and `ALLOWLIST: ReadonlySet<string>`
- **Initial allowlist (v1):** `nous.spawned`, `nous.moved`, `nous.spoke`, `nous.direct_message` (metadata only), `trade.proposed`, `trade.settled`, `law.triggered`, `tick`, `grid.started`, `grid.stopped`
- **Privacy invariant (must be tested):** event payload fields matching `/prompt|response|wiki|reflection|thought|emotion_delta/i` MUST trigger a test failure — these are sovereignty violations by construction and should never appear in AuditChain payloads in the first place. The allowlist module provides a `payloadPrivacyCheck(payload)` helper that lints for these forbidden keys.

### RingBuffer<T> utility
- **Location:** `grid/src/util/ring-buffer.ts` (new file)
- **API:**
  ```ts
  class RingBuffer<T> {
    constructor(capacity: number);
    push(item: T): T | null;  // returns dropped item if full, else null
    drain(): T[];              // returns all and clears
    get size(): number;
    get capacity(): number;
    get isFull(): boolean;
  }
  ```
- **Semantics:** `push()` on a full buffer drops the OLDEST entry and returns it, then appends the new item
- **Not used in Phase 1**, but delivered here so Phase 2 has a tested primitive
- **Tests:** empty, partial, full, overflow, drain, capacity boundary

### Restore path must not leak
- After `loadEntries()`, calling `append()` must continue firing listeners as normal
- Test: load 100 entries → attach listener → append new entry → listener fires exactly once with the new entry

### File naming + exports
- `grid/src/audit/chain.ts` — add to existing file (export `AuditChain` class unchanged in name)
- `grid/src/audit/broadcast-allowlist.ts` — new; exports `ALLOWLIST`, `isAllowlisted`, `payloadPrivacyCheck`
- `grid/src/audit/index.ts` (if exists) — re-export new items; if not exists, leave imports explicit from files
- `grid/src/util/ring-buffer.ts` — new; exports `RingBuffer<T>`

### Type additions
- Add to `grid/src/audit/types.ts` (if exists, else inline in chain.ts):
  ```ts
  export type AppendListener = (entry: AuditEntry) => void;
  export type Unsubscribe = () => void;
  ```

### Claude's Discretion
- Exact file paths for tests (convention-match existing `grid/test/` layout)
- Micro-benchmark harness (use existing vitest pattern; benchmark via `performance.now()` loops is fine — no new benchmarking library)
- Whether `payloadPrivacyCheck` is called inside `append()` (recommended: yes, as a dev-mode assert behind `process.env.NODE_ENV !== 'production'` — flag if this adds unacceptable overhead)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (milestone-level)
- `.planning/research/SUMMARY.md` — Full synthesis, decision TL;DR, architecture, pitfalls
- `.planning/research/ARCHITECTURE.md` — Data flow and the critical `append → fan-out` seam (§"The one critical seam")
- `.planning/research/PITFALLS.md` — Critical pitfalls C1 (listener throw), C2 (privacy allowlist), C3 (hot-path latency)
- `.planning/research/FEATURES.md` — Anti-feature list (no population KPIs, no narrator LLM)

### Existing code patterns (MUST match)
- `grid/src/clock/ticker.ts` — `WorldClock.onTick()` listener pattern to mirror exactly
- `grid/src/audit/chain.ts` — current AuditChain implementation to modify
- `grid/src/audit/types.ts` — existing type definitions (AuditEntry, AuditQuery)

### Project philosophy (sovereignty invariants)
- `PHILOSOPHY.md` §1 (sovereign intelligence), §4 (sovereign memory), §7 (human oversight without control) — rationale for the privacy allowlist
- `PROJECT.md` — overall architecture and out-of-scope items

</canonical_refs>

<specifics>
## Specific Ideas

- **Reference implementation:** The entire `WorldClock.onTick()` / `removeTickListener()` pattern in `grid/src/clock/ticker.ts` lines 23-60 is the exact template for `onAppend()` — same `Set<Listener>` field, same try/catch in the fan-out loop, same unsubscribe-returning API.
- **Privacy lint examples:** A payload like `{ prompt: "You are Sophia...", response: "I want to trade" }` must fail `payloadPrivacyCheck`. A payload like `{ amount: 10, currency: "ousia" }` must pass.
- **Determinism test shape:** The test should use a deterministic fake clock and a fixed seed for any randomness, then do `await runSimulation({ listeners: 0 })` and `await runSimulation({ listeners: 10 })` and assert `chain.head` matches at each tick boundary.

</specifics>

<deferred>
## Deferred Ideas

- **Listener error observability** — Phase 2+ may add a counter or log sink for swallowed listener errors. v1 swallows silently to match `WorldClock` precedent.
- **Listener priority ordering** — Current design fires in insertion order. If Phase 2 needs ordered broadcast (e.g., "privacy filter first"), add a priority parameter then. Not needed for v1.
- **Async listener support** — All listeners are sync in v1. Async listeners would require an async fan-out path which changes `append()` semantics.
- **Broadcast allowlist hot-reload** — The allowlist is a frozen `Set` in v1. Dynamic toggling is a Phase 4+ concern.

</deferred>

---

*Phase: 01-auditchain-listener-api-broadcast-allowlist*
*Context gathered: 2026-04-17 from milestone research synthesis*
