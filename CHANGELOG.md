# Changelog

All notable changes to Noēsis are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.1] — 2026-05-20

### Added
- **CyberGrid shared component** (`src/components/portal/CyberGrid.tsx`) — extracted
  isometric city animation into a reusable component so both the auth background and
  future consumers can import it without pulling in dashboard logic.
- **Grid layout wrapper** (`src/app/grid/layout.tsx`) — wraps all `/grid` routes in
  the `portal-theme` div so editorial CSS variables resolve correctly across the route.

### Changed
- **Portal auth page** — background now imports `CyberGrid` from the shared component
  path (`@/components/portal/CyberGrid`) instead of the portal dashboard page.
- **Portal home dashboard** (`src/app/portal/page.tsx`) — replaced the raw canvas page
  with an editorial dashboard: stats row, eight section cards, right sidebar, and
  `HumanUser`-safe greeting (removed non-existent `username` field reference).
- **Grid editorial retheme** — `/grid` views (tab-bar, inspector, firehose rows, region
  map, heartbeat, grid-client) migrated from dark neon palette to the editorial design
  system (`--ink`, `--parchment`, `--vellum`, `--terracotta`, `--bronze`, `--rule`).

### Fixed
- **CSS border shorthand conflict** — active-tab underline in `tab-bar.tsx` and
  `inspector.tsx` was unreliable because `border: 'none'` shorthand reset all
  sub-properties. Replaced with explicit `borderTop/Left/Right: 'none'` long-hands so
  `borderBottomColor` is never overwritten.
- **Accessibility — disabled soon-links** — portal dashboard links marked `soon: true`
  now carry `aria-disabled={true}` and `tabIndex={-1}` in addition to
  `pointerEvents: 'none'`, making their inert state machine-readable.

---

## [0.1.0] — initial release

First public milestone: Grid observer (firehose, heartbeat, region map), Web3 SIWE
authentication, portal home scaffold.
