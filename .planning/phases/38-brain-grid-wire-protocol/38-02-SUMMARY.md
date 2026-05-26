---
phase: 38
plan: "38-02"
subsystem: brain-wire, grid-api
tags: [wire-protocol, brain, grid, https, tls, WIRE-01, WIRE-02, EdDSA, JWT]
dependency_graph:
  requires:
    - "38-01"  # BrainTokenStore + TokenManager
  provides:
    - brain/src/noesis_brain/wire/client.py
    - grid/src/api/routes/brain-wire.ts
    - ROUTE_DID_POLICY entry for /api/v1/brain/actions
    - tryDid EdDSA Brain-JWT branch
  affects:
    - brain/src/noesis_brain/__main__.py
    - brain/src/noesis_brain/rpc/handler.py
    - grid/src/api/preHandlers/tryDid.ts
    - grid/src/api/preHandlers/requireDid.ts
    - grid/src/api/policy.ts
    - grid/src/api/server.ts
    - grid/src/integration/grid-coordinator.ts
    - grid/src/integration/nous-runner.ts
tech_stack:
  added: []
  patterns:
    - httpx.AsyncClient for Brain HTTPS REST client
    - jose.importJWK + jwtVerify for EdDSA Brain JWT verification
    - asyncio.create_task for fire-and-forget HTTP dispatch from on_tick/on_message
    - Secondary Map<civicDid, NousRunner> index in GridCoordinator
    - NousRunner.executeActions promoted to public (sole-producer path for Brain-wire)
key_files:
  created:
    - brain/src/noesis_brain/wire/client.py
    - brain/test/wire/test_grid_wire_client.py
    - grid/src/api/routes/brain-wire.ts
    - grid/test/api/brain-wire.test.ts
    - grid/test/api/tryDid-brain-token.test.ts
  modified:
    - brain/src/noesis_brain/__main__.py
    - brain/src/noesis_brain/rpc/handler.py
    - brain/src/noesis_brain/whisper/keyring.py
    - brain/src/noesis_brain/wire/__init__.py
    - grid/src/api/preHandlers/tryDid.ts
    - grid/src/api/preHandlers/requireDid.ts
    - grid/src/api/policy.ts
    - grid/src/api/server.ts
    - grid/src/integration/grid-coordinator.ts
    - grid/src/integration/nous-runner.ts
decisions:
  - "Parallel-path discipline (D-38-A2): GRID_URL env var activates HTTPS path; Unix socket preserved verbatim"
  - "TLS enforced at config-load time (before event loop), not at first connection"
  - "tryDid uses decodeProtectedHeader + decodeJwt (unverified peek) before importJWK verify — defensive fall-through if EdDSA fails"
  - "executeActions promoted to public not via thin wrapper to preserve sole-producer invariant documentation"
  - "GridCoordinator.registerCivicDid() late-binding pattern — safe because Brain starts after Civic-DID registration"
  - "requireDid extended to accept full TryDidServices so brainTokenStore reaches tryDid on civic_did_required routes"
metrics:
  duration: "~75 minutes (continuation of prior session)"
  completed_date: "2026-05-26"
  tasks_completed: 3
  files_changed: 16
---

# Phase 38 Plan 02: Brain HTTPS REST client + Grid action endpoint Summary

Brain HTTPS REST channel for action delivery: GridWireClient + TLS enforcement at Brain config-load, EdDSA JWT verification in Grid's tryDid, and POST /api/v1/brain/actions dispatching through NousRunner.executeActions (R-31-01 sole-producer preserved).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | GridWireClient + validate_grid_url + 7 Brain tests | b821b86 |
| 2 Brain | BrainHandler parallel dispatch via _grid_wire_client | da6e680 |
| 2 Grid | tryDid EdDSA branch + TryDidServices + 6 tests | c996faf |
| 3 | POST /api/v1/brain/actions route + coordinator index + 8 tests | adfec2f |

## What Was Built

### Task 1: Brain GridWireClient + TLS validation

- `brain/src/noesis_brain/wire/client.py`: `validate_grid_url()` raises ValueError if scheme not in `{https, wss}`. `GridWireClient` wraps httpx.AsyncClient, calls `get_valid_token()` from TokenManager on each request, posts `{tick, actions}` to `/api/v1/brain/actions`.
- `brain/src/noesis_brain/__main__.py`: `validate_grid_url(grid_url)` called before BrainApp construction in `create_brain_app_from_env()`.
- 7 tests: 5 TLS validation + 2 post_actions correctness (bearer injection, token rotation after 23h).

### Task 2: Brain parallel dispatch + Grid tryDid extension

**Brain side:**
- `brain/src/noesis_brain/rpc/handler.py`: `BrainHandler._grid_wire_client` attribute; `on_tick` and `on_message` dispatch actions via `asyncio.create_task` when wired. Non-2xx logged; exceptions caught.
- `brain/src/noesis_brain/__main__.py`: wires GridWireClient when `GRID_URL` + `CIVIC_DID` + `NOUS_DID` env vars all present.
- `brain/src/noesis_brain/whisper/keyring.py`: added `derive_existence_signing_key(existence_did)` — deterministic Ed25519 SigningKey from SHA-256(existence_did).

**Grid side:**
- `grid/src/api/preHandlers/tryDid.ts`: EdDSA first-pass branch before existing ES256 path. Peeks header (`alg=EdDSA`) + payload (`iss` matches `did:noesis:nous:*`) without verifying, then fetches public JWK from `brainTokenStore.getByDid(iss)` and verifies with `jose.importJWK + jwtVerify`. Returns `{did: sub, tier: 'civic_member', operatorDid: iss}` on success. Revoked iss or sub → null.
- `TryDidServices` interface: `{ didStore?: DidStoreRef; brainTokenStore?: BrainTokenStore }`.
- 6 unit tests: valid row, revoked, missing row, wrong iss pattern, tampered signature, ES256 unchanged.

### Task 3: POST /api/v1/brain/actions route

- `grid/src/api/routes/brain-wire.ts`: `registerBrainWireRoutes`. Validates body shape (`tick: integer, actions: array`), caps batch at 500, looks up NousRunner via `coordinator.getRunnerByCivicDid(civicDid)`, dispatches via `runner.executeActions()`, returns `{ok: true, accepted: N}`.
- `grid/src/integration/grid-coordinator.ts`: `civicDidIndex` Map, `registerCivicDid()`, `getRunnerByCivicDid()`. `removeRunner()` cleaned up secondary index.
- `grid/src/integration/nous-runner.ts`: `executeActions` promoted from `private` to `public`.
- `grid/src/api/policy.ts`: `'POST /api/v1/brain/actions': 'civic_did_required'` added.
- `grid/src/api/server.ts`: `registerBrainWireRoutes` registered; `brainTokenStore` passed to both `tryDid` and `requireDid` in the onRequest hook.
- `grid/src/api/preHandlers/requireDid.ts`: `requireDid` and `requirePortalSession` extended to accept `TryDidServices` so `brainTokenStore` flows through to `tryDid` on all policy paths.
- 8 integration tests: happy path, no bearer, no runner, batch overflow, malformed body, error isolation (audit chain unchanged on dispatch failure), R-31-01 sole-producer parity (noop actions produce identical empty audit output via both paths), policy entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript `JsonWebKey` global not available in Node**
- **Found during:** Task 2 Grid compile check
- **Issue:** `tryDid.ts` line `rec.publicKeyJwk as JsonWebKey` — `JsonWebKey` is a DOM global not available in Node.js TypeScript compilation.
- **Fix:** Changed cast to `rec.publicKeyJwk as Parameters<typeof importJWK>[0]` — uses the library's own parameter type.
- **Files modified:** `grid/src/api/preHandlers/tryDid.ts`
- **Commit:** c996faf

**2. [Rule 2 - Missing critical functionality] `requireDid` did not forward `brainTokenStore` to `tryDid`**
- **Found during:** Task 3 test run (all EdDSA token tests returned 401)
- **Issue:** `server.ts` onRequest hook called `requireDid(req, reply, { didStore })` without `brainTokenStore`. The `requireDid` function called `tryDid(req, services)` with only `didStore`, so the EdDSA branch was never entered.
- **Fix:** Extended `TryDidServices` import in `requireDid.ts`; changed parameter types of `requireDid` and `requirePortalSession` to `TryDidServices`; updated `server.ts` to pass `brainTokenStore` in both the `public` path (`tryDid`) and the `civic_did_required` path (`requireDid`).
- **Files modified:** `grid/src/api/preHandlers/requireDid.ts`, `grid/src/api/server.ts`
- **Commit:** adfec2f

**3. [Rule 3 - Blocking] `SpatialMap.placeNous` requires region to be pre-registered**
- **Found during:** Task 3 sole-producer parity test
- **Issue:** `SpatialMap.placeNous(did, regionId)` throws "Region not found" if `addRegion()` was not called first.
- **Fix:** Added `space.addRegion({...})` call before `placeNous` in the sole-producer parity test.
- **Files modified:** `grid/test/api/brain-wire.test.ts`
- **Commit:** adfec2f

**4. [Rule 3 - Blocking] `NousRegistry.register` does not exist — correct method is `spawn()`**
- **Found during:** Task 3 sole-producer parity test
- **Issue:** Test called `registry.register({did, name, region})` which doesn't exist; the API is `registry.spawn({did, name, publicKey, region}, gridDomain, tick, initialOusia)`.
- **Fix:** Updated test to use correct `spawn()` signature.
- **Files modified:** `grid/test/api/brain-wire.test.ts`
- **Commit:** adfec2f

## Known Stubs

None. All implemented functionality is fully wired.

## Threat Flags

None. No new network endpoints beyond what the plan specified. `POST /api/v1/brain/actions` is protected by `civic_did_required` policy and requires a valid EdDSA JWT verified against the `brain_tokens` store — no new unguarded surface introduced.

## Self-Check

### Files created exist:
- `brain/src/noesis_brain/wire/client.py` — exists (committed b821b86)
- `grid/src/api/routes/brain-wire.ts` — exists (committed adfec2f)
- `grid/test/api/brain-wire.test.ts` — exists (committed adfec2f)
- `grid/test/api/tryDid-brain-token.test.ts` — exists (committed c996faf)

### Commits exist:
- b821b86 feat(brain/38-02): GridWireClient + GRID_URL TLS validation at config-load
- da6e680 feat(brain/38-02): branch BrainHandler on GRID_URL — parallel Unix-socket + HTTPS paths
- c996faf feat(grid/38-02): tryDid recognizes EdDSA Brain JWTs via brain_tokens
- adfec2f feat(grid/38-02): POST /api/v1/brain/actions + NousRunner civic_did lookup + policy entry

### Test results:
- Brain: `python -m pytest brain/test/wire/ -x -q` → 12 passed
- Grid: `npx vitest run test/api/brain-wire.test.ts test/api/tryDid-brain-token.test.ts` → 14 tests pass (suite-level WS cleanup noise is pre-existing in all server tests)
- TypeScript: `npx tsc --noEmit` → clean
- CI gates: `check-did-policy-coverage.mjs` → OK, `check-no-silent-catch.mjs` → OK

## Self-Check: PASSED
