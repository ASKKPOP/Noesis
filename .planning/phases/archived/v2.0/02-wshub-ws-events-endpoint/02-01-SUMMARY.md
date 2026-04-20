---
phase: 02-wshub-ws-events-endpoint
plan: 01
subsystem: api
tags: [fastify, websocket, typescript, wire-protocol]

requires:
  - phase: 01-auditchain-listener-api-broadcast-allowlist
    provides: AuditEntry type + broadcast-allowlist (consumed by Plan 02 via ws-protocol types)
provides:
  - "@fastify/websocket@^11 runtime dependency in grid/ workspace"
  - "grid/src/api/ws-protocol.ts — complete /ws/events wire protocol (types + parseClientFrame guard)"
affects: [02-02-wshub-client-connection, 02-03-server-integration, phase-03-dashboard-ws-client]

tech-stack:
  added: ["@fastify/websocket@^11.2.0"]
  patterns: ["Pure-types module for wire protocol; runtime guard never throws"]

key-files:
  created:
    - grid/src/api/ws-protocol.ts
  modified:
    - grid/package.json
    - package-lock.json

key-decisions:
  - "Runtime dependency (not dev) — plugin needed at runtime by Plan 03"
  - "No Zod or validation library — stdlib-only guard keeps module tree-shakeable for future dashboard client"
  - "parseClientFrame never throws — returns null on any malformed input (T-02-01-02 DoS mitigation)"

patterns-established:
  - "Wire protocol as pure-types module: types only + one narrow guard fn, no fastify/ws imports"
  - "Discriminated unions (ServerFrame, ClientFrame) for exhaustive switch in consumers"

requirements-completed: [ACT-01]

duration: 10min
completed: 2026-04-18
---

# Phase 02 Plan 01: WsHub Deps + Wire Protocol

**@fastify/websocket@^11.2.0 installed + pure-types `ws-protocol.ts` with 8 frames, 2 unions, and a never-throws `parseClientFrame` guard**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-18T00:30Z (inline sequential)
- **Completed:** 2026-04-18T00:40Z
- **Tasks:** 2
- **Files modified:** 3 (package.json, package-lock.json, ws-protocol.ts)

## Accomplishments
- @fastify/websocket@^11.2.0 added as runtime dependency in `grid/package.json`
- 262/262 existing grid tests still pass — zero regression from install
- `grid/src/api/ws-protocol.ts` exports all 8 frame interfaces, 2 unions, and `parseClientFrame`
- `parseClientFrame` handles: string JSON, parsed object, malformed input, type narrowing for subscribe/unsubscribe/ping/pong

## Task Commits

1. **Task 1: Install @fastify/websocket@^11** — `4c282d0` (feat)
2. **Task 2: Author ws-protocol.ts frame types + parseClientFrame** — `c72bee1` (feat)

## Files Created/Modified
- `grid/package.json` — added `"@fastify/websocket": "^11.2.0"` dependency
- `package-lock.json` — 4 new packages resolved (ws + transitive deps)
- `grid/src/api/ws-protocol.ts` — 121 lines, 11 exports (HelloFrame, EventFrame, DroppedFrame, PingFrame, PongFrame, ByeFrame, SubscribeFrame, UnsubscribeFrame, ServerFrame, ClientFrame, parseClientFrame)

## Decisions Made
- **Resolved version**: `@latest` is `11.2.0` (no declared peerDependencies — compatible with fastify ^5.0.0 per its runtime usage in Fastify-5 ecosystem).
- **Location**: Install ran at monorepo root via workspaces hoisting (`node_modules/@fastify/websocket` at root resolves to 11.2.0). The dependency entry lives in `grid/package.json` as required.
- **No explicit `ws` dep**: comes transitively via `@fastify/websocket` — per CONTEXT decision.

## Deviations from Plan

None substantively. One minor note:

### Pre-existing tsc errors in unrelated files
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** `src/main.ts` and `src/db/repositories/*.ts` have pre-existing type errors unrelated to this plan
- **Resolution:** Confirmed via `git stash` that these errors predate Plan 02-01. `ws-protocol.ts` itself contributes ZERO tsc errors (`tsc 2>&1 | grep -c "ws-protocol"` returns 0).
- **Verification:** `npm test` passes 262/262; the tsc errors are type-only and don't prevent the test runtime from executing.

## Issues Encountered

**Parallel-worktree execution abandoned.** Both initial Wave 1 agents were blocked by the sandbox:
- `02-01` agent: `npm` commands categorically denied in its sandbox
- `02-02` agent: Could not `git reset` its worktree branch from `bd381a3` (Sprint 13) to the expected base `9d5458d`

**Resolution:** User chose inline sequential execution. Plans 02-01 → 02-02 → 02-03 will run in the main working tree where npm + git are permitted. This plan was executed inline from the main worktree.

## Next Phase Readiness

- **Plan 02 (WsHub + ClientConnection)** can now:
  - Import `@fastify/websocket` types/plugin
  - Import `ServerFrame`, `ClientFrame`, `parseClientFrame`, and all frame interfaces from `./ws-protocol.js`
- **Plan 03 (server.ts integration)** can now:
  - `app.register(fastifyWebsocket, {...})` using the installed plugin
  - Import `HelloFrame` via Plan 02's exports

---
*Phase: 02-wshub-ws-events-endpoint / Plan 01*
*Completed: 2026-04-18*
