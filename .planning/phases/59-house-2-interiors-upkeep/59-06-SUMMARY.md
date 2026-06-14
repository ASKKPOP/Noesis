# Phase 59 · Wave 5 (plan 59-06) — SUMMARY

**Brain interior verbs + dashboard interior viewer.** Requirements R-59-10, R-59-11. Built on Phase 58 civic-land verbs + my_places + the OrbitalGenesisMap exterior. No grid/ changes, no allowlist changes.

## Task 1 — brain (extended Phase 58 patterns)

- **`rpc/types.py`** — added two `ActionType` members beside the Phase 58 civic-land verbs:
  - `EXTEND_INTERIOR = "extend_interior"` (metadata `{area, kind}`)
  - `VIEW_INTERIOR = "view_interior"` (metadata `{parcel}`)
  - Registered both in `_CIVIC_LAND_REQUIRED_KEYS` (schema gate) and `_CIVIC_LAND_VERBS`. `kind` is validated by the Grid against the closed furniture catalog; the Brain only gates key presence. Reused the existing `build_civic_land_action` capability builder — no parallel constructor.
- **`wire/client.py`** — extended `CIVIC_LAND_ROUTES`:
  - `extend_interior` → `POST /api/v1/civic/parcels/{id}/interior/extend`
  - `view_interior` → `GET /api/v1/civic/parcels/{id}/interior`
  - Routes resolve through the existing `civic_land_route()` (requires parcel_id). Capabilities — no autoplay loop.
- **`prompts/system.py`** — EXTENDED the existing `build_my_places_section` (did NOT create a parallel block). Added a private `_upkeep_suffix(place)` helper that appends `(condition, upkeep due: N Bios)` to each built-structure line, e.g. `- I own genesis:residential:0007 — my home is built here (worn, upkeep due: 8 Bios).` Accepts both `upkeep_due` and `upkeepDue` (Grid feed key). Block stays empty when the Nous owns no land; lines without condition/upkeep keep the Phase 58 shape.
- **`brain/test/test_civic_interior_verbs.py`** (NEW) — 17 tests: ActionType values, metadata validation (extend_interior requires area+kind; view_interior requires parcel), dispatch routing to both interior routes, my_places renders condition + upkeep (both key spellings, derelict, no-upkeep fallback, system-prompt integration).

## Task 2 — dashboard (additive overlay, exterior unchanged)

- **`OrbitalGenesisMap.tsx`** — additive click-to-enter interior overlay:
  - Added optional `condition` to `ParcelFeedEntry` (feed already exposes it) + `InteriorView` tree types.
  - `conditionOpacity()` tints OWNED modules: maintained 0.92 (full Phase 58 lit) / worn 0.6 (faded) / derelict 0.4 (boarded). `isBrowsable()` = open structure AND not derelict.
  - Each module gets `data-condition`, `data-browsable`, and an `onClick` → `enterInterior(p)`. The Phase 58 `data-testid="parcel-module"` and all other attributes are UNCHANGED (Phase 58 test still queries `getAllByTestId('parcel-module')`).
  - `enterInterior` fetches `GET :id/interior` for browsable structures and renders the tree: mirror furniture as STATIC meshes (dimmed, `data-highlighted="false"`), functional furniture HIGHLIGHTED (`data-highlighted="true"`, cyan glow). Derelict / non-open / 403 / 404 → `interior-closed` overlay; does NOT open. Interior viewer carries `data-condition`.
  - No raw owner DID ever rendered — only `owner_civic_did_hash` (HEX64).
- **`orbital/page.tsx`** — UNCHANGED. The overlay lives entirely inside the component (dynamic-imported), so no wiring change was needed (kept additive).
- **`__tests__/interior-viewer.test.tsx`** (NEW) — 5 tests: click owned open module → tree renders (mirror vs functional distinguished + highlighted); condition styling on viewer + module; derelict → closed, does not open; no raw owner DID.

## SELF-CHECK

**brain pytest tail:**
```
collected 17 items
test/test_civic_interior_verbs.py .................                      [100%]
============================== 17 passed in 0.05s ==============================
```

**dashboard test:unit tail:**
```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

**tsc:** No NEW errors. The 10 pre-existing errors are all in untouched files (`ConversationPane.test.tsx`, `NousSidebar.test.tsx`, `TipPanel.test.tsx` — vitest globals not typed under tsc). My files (`OrbitalGenesisMap.tsx`, `interior-viewer.test.tsx`, `orbital/page.tsx`) are clean.

**`git status --short grid/`:** empty — no grid/ changes.

**City view + exterior unchanged:** `/worldmap` city view untouched; Phase 58 orbital exterior unchanged (`test/orbital-genesis-map.test.tsx` 9/9 green; `data-testid="parcel-module"` + all exterior attributes preserved; overlay is purely additive). No allowlist changes.

## HARD RULES honored
- Verbs are capabilities (no autoplay loop).
- Additive only (/worldmap city view + Phase 58 orbital exterior unchanged).
- No raw owner DID rendered.
- No grid/ or allowlist changes.
