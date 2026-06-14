# Phase 61 Wave 4 (61-05) — Summary

HOUSE-4 skill-construction capabilities surfaced to the Nous (brain verbs +
my_places enrichment) and to humans (dashboard construction surfaces). Additive
on the dashboard; capabilities, not scripts (no autoplay).

## Task 1 — Brain
- `brain/src/noesis_brain/rpc/types.py`: 4 new `ActionType` members —
  `LEARN_BLUEPRINT="learn_blueprint"` `{blueprint_hash}`,
  `BUILD_FROM_BLUEPRINT="build_from_blueprint"` `{parcel, blueprint_hash}`,
  `CO_BUILD="co_build"` `{parcel, node_id}`,
  `TEACH_HERE="teach_here"` `{parcel, skill_hash}`. `build_civic_land_action`
  schema gate validates all 4 metadata shapes (required-keys map + verb set).
- `brain/src/noesis_brain/wire/client.py`: `CIVIC_LAND_ROUTES` gains
  `BUILD_FROM_BLUEPRINT → POST :id/build-from-blueprint` and
  `CO_BUILD → POST :id/board/claim`. `LEARN_BLUEPRINT` + `TEACH_HERE` ride the
  EXISTING skill/teach dispatch (no new diffusion route, D-61-04) — deliberately
  NOT in the route table.
- `brain/src/noesis_brain/prompts/system.py`: new `_construction_suffix` enriches
  the my_places block with held blueprint hashes (short labels), buildable /
  co-build-open status, and teach-here (school) context.
- `brain/test/ananke/test_loader.py`: ActionType count assertion bumped 44 → 48
  with the `+ 4 (Phase 61: ...)` comment line (orphan guard — the bump that bit
  59/60).
- `brain/test/test_civic_construction_verbs.py` (new): mirrors
  test_civic_commerce_verbs.py.

## Task 2 — Dashboard (additive)
- `dashboard/src/components/worldmap/OrbitalGenesisMap.tsx`: feed shape gains
  `held_blueprints` / `build` / `cobuild`; new construction overlay (bottom-right)
  with a blueprint library panel, a build panel (skill-held status + material
  cost), and a co-build DAG board (per-node claim/complete + DAG-weighted
  attribution); a teach-here indicator on `workshop` modules.
- `dashboard/src/app/worldmap/orbital/page.tsx`: docstring note only.
- `dashboard/test/construction-surfaces.test.tsx` (new): mirrors
  commerce-surfaces.test.tsx.

The Phase 58 exterior, Phase 59 interior viewer, and Phase 60 commerce overlay
are UNCHANGED — verified by re-running commerce-surfaces + orbital-genesis-map.

## Verification
- `pytest test/test_civic_construction_verbs.py test/ananke/test_loader.py` — 30 passed (count == 48).
- `pytest test/` (full brain suite) — 928 passed.
- `npm run test:unit -- construction-surfaces` — 13 passed.
- `npm run test:unit -- commerce-surfaces orbital-genesis-map` — 19 passed (additive confirmed).
