# Phase 13: Operator Replay & Export — Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 delivers three tightly-coupled capabilities:

1. **ReplayGrid** — a sandboxed `GenesisLauncher` variant with an isolated in-memory chain
   (better-sqlite3), isolated MySQL schema, isolated WsHub port, and fake Brain bridges.
   Constructor-injected readonly chain contract; zero `.append(` calls permitted inside
   `grid/src/replay/**` (CI grep gate).

2. **Deterministic tarball export** — JSONL audit-chain slice + registry state snapshots at
   start/end ticks + manifest with chain-tail hash. Fixed mtime, sorted entries, canonical
   JSON. One new allowlisted event: `operator.exported` (26→27). Export is H5-consent-gated
   via an `IrreversibilityDialog`-style surface.

3. **Steward Console Rewind panel** — `/grid/replay` route. H3+ operators scrub a chain slice,
   inspecting firehose + inspector + map state at any replayed tick. Read-only — no writes back
   to the live Grid.

</domain>

<decisions>
## Implementation Decisions

### Rewind Panel Placement

- **D-13-01:** Route is `/grid/replay` — a dedicated new Next.js page. Not a tab or drawer on
  the existing `/grid` page. URL is bookmarkable and clearly distinguishes live-grid state from
  historical replay state.

- **D-13-02:** Nav entry — H3+ operators see a `Replay` link in the existing top nav alongside
  `Grid` and `Governance`. H1/H2 operators do not see the link (tier-gated in nav, same pattern
  as the existing agency-indicator tier chip). Nav entry added to `DASHBOARD_ROUTES` in the E2E
  spec (clones Phase 6 SC#1 coverage discipline).

- **D-13-03:** Component reuse — the replay page reuses the existing `<Firehose>`,
  `<Inspector>`, and `<RegionMap>` components. Each component receives a `replayMode` prop (or
  equivalent flag) to suppress write-back affordances and hide live-only controls. No replay-
  specific component variants. Replay inherits future improvements to these components
  automatically.

### Scrubber UX

- **D-13-04:** Navigation controls — a timeline slider spanning `start_tick`–`end_tick` plus a
  numeric jump-to-tick input field. No step buttons required. The slider is the primary
  navigation affordance for long chain slices; the input field handles precise tick targeting.

- **D-13-05:** No auto-play. Manual step only — no play button, no speed multiplier, no wall-
  clock timer in the replay UI. This preserves the determinism discipline and avoids
  `Date.now`/`setInterval` coupling (extends Phase 10a–11 wall-clock grep gates to
  `dashboard/src/app/grid/replay/**`).

### Replay Tier Elevation

- **D-13-06:** Inline redaction with on-demand elevation. Telos-revealing fields (require H4)
  and whisper-revealing fields (require H5) render as inline placeholders
  (`— Requires H4` / `— Requires H5`) within the Inspector and Firehose components when the
  operator's current tier is insufficient. The operator clicks an `Elevate` affordance beside
  the redacted field, which opens the existing `<ElevationDialog>` without pausing the replay
  scrubber. This is the least-friction path and does not interrupt scrubbing flow.

- **D-13-07:** Tier reset on route exit. Any H4/H5 elevation granted inside `/grid/replay`
  resets to H1 when the operator navigates away from the replay route. Clones the Phase 6/8
  auto-downgrade pattern (`agencyStore.setTier('H1')` on component unmount / route change).
  Elevation never leaks from the replay context into the live grid.

### Export Consent Gate

- **D-13-08:** Export is H5-consent-gated. Clones `<IrreversibilityDialog>` (Phase 8) —
  paste-suppressed typed confirmation, verbatim copy locked in test assertions (D-04/D-05
  pattern). Suggested copy (to be verbatim-locked by the planner):
  - Title: `Export audit chain slice`
  - Warning body: `This export is permanent and cannot be undone. The tarball will contain the
    complete audit chain for the selected tick range. Anyone with the file can verify the chain.`
  - Confirm label: `Export forever`
  - Cancel label: `Keep private`
  - Typed confirmation: operator types the **Grid-ID** (the grid's canonical name string, exposed
    at `GET /api/v1/grid/info`). This field must be typed manually — paste is suppressed.

- **D-13-09:** Allowlist event `operator.exported` — closed-tuple payload
  `{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}` (from ROADMAP).
  `requested_at` is a Unix timestamp in **seconds** (< 10_000_000_000, matching Phase 5
  TradeRecord contract). Sole-producer file: `grid/src/audit/append-operator-exported.ts`.
  Privacy matrix: no `body`, `entries`, `text`, `chain_data` in the payload — only the 6
  closed-tuple keys.

### Claude's Discretion

- ReplayGrid SQLite vs MySQL schema isolation strategy — planner chooses based on the
  better-sqlite3 integration approach already used in the test suite.
- Tarball format details (manifest field ordering, JSONL line structure) — planner defines,
  must satisfy the REPLAY-01 determinism criterion.
- `replay-verify` CLI ergonomics — planner designs command interface; success/failure exit
  codes are implementation decisions.
- Whether to add a `replay.* event` hard-ban in `scripts/check-state-doc-sync.mjs` or a
  separate CI gate — planner chooses the enforcement mechanism.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ROADMAP — Phase 13 specification
- `.planning/ROADMAP.md` §"Phase 13: Operator Replay & Export" — goal, success criteria
  (REPLAY-01..05), risks (T-10-07..T-10-10), allowlist addition, out-of-scope list.

### Prior phase patterns (must clone, not reinvent)
- `.planning/phases/archived/v2.1/08-h5-sovereign-operations-nous-deletion/08-CONTEXT.md`
  — `IrreversibilityDialog` verbatim-copy pattern (D-04/D-05), paste-suppression, H5 consent
  surface. Export consent gate is a direct clone.
- `.planning/phases/archived/v2.1/06-operator-agency-foundation-h1-h4/06-CONTEXT.md`
  — `appendOperatorEvent` sole-producer boundary (D-13), closed-tuple payload discipline (D-11),
  tier-reset auto-downgrade (D-07), agency nav and tier-gated visibility.

### Grid — core system files
- `grid/src/genesis/launcher.ts` — GenesisLauncher; ReplayGrid is a configuration-over-fork of
  this class. Constructor injection order and service wiring must be preserved.
- `grid/src/audit/chain.ts` — AuditChain; ReplayGrid's isolated chain uses this class with
  better-sqlite3 backing instead of MySQL.
- `grid/src/db/persistent-chain.ts` — PersistentAuditChain extension pattern; ReplayGrid may
  need a read-only variant that loads from JSONL instead of appending.
- `grid/src/audit/broadcast-allowlist.ts` — current 26-event allowlist; Phase 13 bumps to 27
  with `operator.exported`.

### Dashboard — component reuse
- `dashboard/src/components/agency/irreversibility-dialog.tsx` — verbatim copy source for
  export consent gate.
- `dashboard/src/components/agency/elevation-dialog.tsx` — existing ElevationDialog used for
  inline tier elevation within the replay viewer.
- `dashboard/src/app/grid/page.tsx` — live grid page; Replay route is a sibling, not a child.
- `dashboard/src/app/grid/governance/governance-dashboard.tsx` — reference for how tier-aware
  read-only dashboard pages are structured (SWR polling, tier prop, H5 affordances).

### CI gates (must update, not create from scratch)
- `scripts/check-state-doc-sync.mjs` — asserts 26-event allowlist literal; must be bumped to 27
  in the same commit as the allowlist addition. Hard-ban on `replay.*` event prefix must be
  added here.
- `scripts/check-replay-readonly.mjs` — **does not exist yet**; planner must create this gate
  to enforce zero `.append(` calls inside `grid/src/replay/**`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GenesisLauncher` (`grid/src/genesis/launcher.ts`) — constructor-injectable, full service
  graph. ReplayGrid is a configuration variant of this class with `{transport: 'in-memory'}`.
- `AuditChain` (`grid/src/audit/chain.ts`) — loadEntries() path does NOT fire listeners (safe
  for replay restoration without side effects).
- `PersistentAuditChain` (`grid/src/db/persistent-chain.ts`) — extension pattern shows how to
  override `append()`; ReplayGrid needs a `ReadOnlyAuditChain` that throws on `append()`.
- `<IrreversibilityDialog>` (`dashboard/src/components/agency/irreversibility-dialog.tsx`) —
  paste-suppressed typed confirmation. Direct clone for export consent.
- `<ElevationDialog>` (`dashboard/src/components/agency/elevation-dialog.tsx`) — existing
  elevation surface; reused inline in replay viewer for on-demand H4/H5 elevation.
- `<GovernanceDashboard>` — shows the SWR + tier-prop + read-only pattern for H3+ dashboard
  pages; `/grid/replay` follows this same structure.
- `<Firehose>`, `<Inspector>`, `<RegionMap>` — all receive a `replayMode` prop; no variants.

### Established Patterns
- **Sole-producer boundary** (Phase 6+): one file per new event type calls `chain.append`.
  `append-operator-exported.ts` will be created following this.
- **Closed-tuple payloads**: `Object.keys(payload).sort()` strict-equality assertions required
  for `operator.exported`.
- **Privacy matrix**: 6+ forbidden keys × flat + nested cases required.
- **Doc-sync script**: allowlist literal bump (26→27) must co-commit with allowlist addition.
- **Auto-downgrade H4/H5→H1**: `agencyStore.setTier('H1')` on unmount/route change, established
  in Phase 6 D-07 and cloned in Phase 8.
- **DASHBOARD_ROUTES extension** (Phase 6 SC#1 discipline): any new top-level route must be
  added to the E2E `DASHBOARD_ROUTES` constant in the same commit.
- **Wall-clock grep gate** (`scripts/check-wallclock-forbidden.mjs`): extend to cover
  `dashboard/src/app/grid/replay/**` — no `Date.now`/`setInterval`/`setTimeout` in replay UI.

### Integration Points
- `/grid/replay` route: new `app/grid/replay/` Next.js directory alongside `app/grid/governance/`.
- Nav: top-nav component (wherever `Grid` and `Governance` links live) gains a `Replay` link,
  tier-gated to H3+.
- `GET /api/v1/grid/info` (or equivalent): must expose the Grid-ID string consumed by the
  export consent gate.
- `grid/src/audit/broadcast-allowlist.ts` ALLOWLIST_MEMBERS: `'operator.exported'` appended at
  position 27.
- `scripts/check-state-doc-sync.mjs`: literal `26` → `27` + `replay.*` hard-ban.

</code_context>

<specifics>
## Specific Ideas

- Slider spans `start_tick`–`end_tick` of the chain slice being replayed; tick range is chosen
  when the operator initiates the replay session (before the export consent gate if they proceed
  to export, or independently for inspection-only replay).
- "— Requires H4" / "— Requires H5" placeholder copy is the redaction text shown inline in
  the Inspector and Firehose for sensitive frames. Exact copy can be adjusted in planning but
  should follow the same verbatim-lock pattern as other sensitive UX copy.
- `replay-verify` is a CLI tool (likely in `scripts/`) that takes a tarball path and reproduces
  the hash to confirm integrity. Success exits 0; hash mismatch exits 1. User does not need to
  specify the exact implementation — planner designs the ergonomics.

</specifics>

<deferred>
## Deferred Ideas

- Decision-level replay (re-running Brain prompts) — explicitly anti-feature per ROADMAP.
  LLM non-determinism makes this impossible in v2.2.
- Parquet export format — deferred to RIG-PARQUET-01 per ROADMAP out-of-scope list.
- Witness-bundle plaintext export with H5 consent — WITNESS-BUNDLE-01 deferred to v2.3.
- Auto-play / speed multiplier for the scrubber — ruled out in discussion (D-13-05). If
  needed post-v2.2, it would require revisiting the wall-clock grep gate discipline.
- Mutating rewind (writing back to the live Grid) — anti-feature per ROADMAP.
- `replay.*` allowlist events — hard-banned. ReplayGrid runs its own isolated chain; nothing
  it does reaches the production allowlist.

</deferred>

---

*Phase: 13-operator-replay-export*
*Context gathered: 2026-04-27*
