# Phase 60 · Wave 6 (plan 60-07) — Summary

**Scope:** Surface the HOUSE-3 commerce / role / co-work / place capabilities to
the Nous (brain verbs + my_places enrichment) and to humans (additive dashboard
panels on `/worldmap/orbital`). Build on Phase 58/59; capabilities not autoplay;
dashboard additive; no grid/ changes; no allowlist changes.

## Task 1 — Brain (R-60-13)

- `brain/src/noesis_brain/rpc/types.py`: added 8 `ActionType` members
  `grant_role`, `revoke_role`, `invite`, `bind_shop`, `name_place`, `post_task`,
  `claim_task`, `complete_task`; extended `_CIVIC_LAND_REQUIRED_KEYS` (metadata
  presence gate) and `_CIVIC_LAND_VERBS`. The capability builder
  `build_civic_land_action` validates each shape; the Grid validates roles,
  shop type, place uniqueness, board access.
- `brain/src/noesis_brain/wire/client.py`: extended `CIVIC_LAND_ROUTES` so each
  verb dispatches to its Wave-4 route — `.../roles`, `.../roles/revoke`,
  `.../invite`, `.../bind-shop`, `.../name`, `.../board/post`, `.../board/claim`,
  `.../board/complete`. Capabilities — no autoplay loop fires them.
- `brain/src/noesis_brain/prompts/system.py`: new `_commerce_suffix` helper, woven
  into `build_my_places_section` beside the Phase 59 `_upkeep_suffix`. Surfaces
  per owned parcel: bound-shop status (+ `place://<name>`), active role grants
  (staff/guest holders), and outstanding IOU balance — so the Nous feels its
  commercial relationships. camelCase aliases (`boundShop`/`placeName`/
  `outstandingIou`) accepted to match the Grid feed. Phase 58/59 line shape
  intact when commerce fields are absent.
- `brain/test/test_civic_commerce_verbs.py` (NEW): 36 tests — verb existence,
  metadata validation, dispatch routing, my_places enrichment, capabilities
  (no autoplay).

## Task 2 — Dashboard (R-60-14, additive)

- `dashboard/src/components/worldmap/OrbitalGenesisMap.tsx`: extended
  `ParcelFeedEntry` with optional commerce fields + `RoleEdgeView` /
  `BoardSummary` / `IouView` interfaces (all privacy-safe — hashes/counts/totals
  only). New `commerceParcels` memo + an ADDITIVE top-right commerce overlay:
  shop module (`place://` name + bound-shop badge), roles panel (staff/guest +
  trust_score), co-work board panel (posted/claimed/completed status only), and
  an IOU strip (outstanding bilateral balances). The Phase 58 exterior and
  Phase 59 interior viewer are untouched; the overlay renders only when the feed
  serves commerce fields. No raw owner DID / no raw board-task text rendered.
- `dashboard/src/app/worldmap/orbital/page.tsx`: no change needed (the route
  renders the component; panels are self-contained).
- `dashboard/test/commerce-surfaces.test.tsx` (NEW): 10 tests — shop badge +
  place name, roles panel + trust, board status, IOU strip, raw-text + raw-DID
  privacy, Phase 58/59 viewers unchanged.

## Self-check

- `cd brain && .venv/bin/pytest test/test_civic_commerce_verbs.py` → 36 passed.
  (Regression: interior + land verb suites still 46 passed.)
- `cd dashboard && npm run test:unit -- commerce-surfaces` → 10 passed.
  (Regression: orbital-genesis-map → 9 passed.)
- `cd dashboard && npx tsc --noEmit` → no NEW errors from the touched files
  (pre-existing portal/chat vitest-globals errors unrelated).
- `git status --short grid/` → empty.
- Viewers unchanged (exterior + interior additive); verbs are capabilities, no
  autoplay; no allowlist changes.
