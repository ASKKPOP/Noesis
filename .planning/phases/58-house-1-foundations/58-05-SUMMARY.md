---
phase: 58
plan: 05
type: summary
wave: 4
requirements: [R-58-10]
tags: [nous-house, house-1, brain, action-types, my-places, capabilities]
---

# Phase 58 Wave 4 — Brain civic-land verbs (capabilities, not autoplay)

Brain-side delivery of the six Nous House HOUSE-1 land verbs (D-58-10 / R-58-10).
Verbs are **capabilities** dispatched through the existing generic action wire —
decision pressure stays with the Nous. **Zero `grid/` changes.**

## What shipped

### `brain/src/noesis_brain/rpc/types.py`
- Six new `ActionType` members with documented metadata shapes:
  `LIST_PARCELS` (`list_parcels`), `BUY_PARCEL` (`buy_parcel`, `{zone, max_price}`),
  `BUILD` (`build`, `{parcel, type, name}`), `VISIT` (`visit`, `{parcel}`),
  `LEAVE` (`leave`, no metadata), `SET_ENTRY_POLICY` (`set_entry_policy`,
  `{parcel, policy, allowlist?}`).
- `build_civic_land_action(action_type, **metadata)` — the **schema gate**:
  validates required keys and raises `ValueError` on a malformed shape so a bad
  action fails locally before it ever reaches the Grid. Capability constructor,
  not a script.

### `brain/src/noesis_brain/wire/client.py`
- `CIVIC_LAND_ROUTES: dict[ActionType, (method, path)]` — Brain-side source of
  truth for verb→route routing, mirroring `grid/src/api/routes/civic-parcels.ts`:
  - `buy_parcel` → `POST :id/purchase`
  - `build` → `POST :id/build`
  - `visit` → `POST :id/join`
  - `leave` → `POST :id/leave`
  - `set_entry_policy` → `POST :id/entry-policy`
  - `list_parcels` → `GET /api/v1/civic/parcels`
- `civic_land_route(action_type, parcel_id=None)` resolves a verb to its
  `(method, path)`; per-parcel verbs raise `ValueError` without a `parcel_id`.
- Civic-land Actions ride the existing generic `post_actions` batch to
  `POST /api/v1/brain/actions`; the Grid action handler routes by `action_type`.
  No new dispatch path or autoplay was added to the client.

### `brain/src/noesis_brain/rpc/handler.py`
- `produce_civic_land_action(action_type, **metadata)` — thin routing precedent
  over `build_civic_land_action`. Produces a validated Action **only when the
  Nous asks** — never invoked from `on_tick`/`on_message` autonomous loops.

### `brain/src/noesis_brain/prompts/system.py`
- `build_my_places_section(my_places)` + new `my_places` kwarg on
  `build_system_prompt`. Renders owned parcels + built structures
  ("I own genesis:residential:0007 — my home \"My Home\" is built here."),
  injected before the directives section. Returns `""` (block omitted) when the
  Nous owns no land. Smallville Lesson 2: home anchors routine.

### `brain/test/test_civic_land_verbs.py` (NEW — at `test/`, singular)
29 tests: the 6 ActionType values exist; metadata validation rejects
`buy_parcel` missing `zone`/`max_price` and `build` missing
`parcel`/`type`/`name` (plus visit/set_entry_policy); dispatch routing maps each
verb to the correct civic-parcels route; `my_places` renders when the Nous owns
land and is empty/omitted otherwise (including end-to-end through
`build_system_prompt`).

### `brain/test/ananke/test_loader.py` (orphan fix)
Updated the running `ActionType` member-count assertion 28 → 34 (+6 this phase),
extending the per-phase tally comment. This is the only change my +6 enum
members forced.

## Self-check
- Test location: `brain/test/test_civic_land_verbs.py` (singular `test/`,
  matching `pyproject testpaths=["test"]`). The plan's `brain/tests/...` path
  was corrected.
- `cd brain && .venv/bin/pytest test/test_civic_land_verbs.py` → **29 passed**.
- `cd brain && .venv/bin/pytest test/ -q` → **851 passed, 0 failed**.
- `git status --short grid/` → empty (brain-only).
- No autoplay: the civic-land builders are only reachable via explicit
  Nous-chosen calls; nothing auto-buys or auto-builds.
