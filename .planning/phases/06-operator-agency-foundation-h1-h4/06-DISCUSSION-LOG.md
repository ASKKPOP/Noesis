# Phase 6: Operator Agency Foundation (H1–H4) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 06-operator-agency-foundation-h1-h4
**Mode:** `/gsd-discuss-phase 6 --auto`
**Areas discussed:** 12 gray areas (all auto-resolved with recommended option)

Auto mode accepted the recommended option on every question. Rationale for each is recorded in CONTEXT.md under the corresponding D-## identifier. This log preserves the option landscape the planner chose from.

---

## Agency Indicator — Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| **Client-side, per-operator, localStorage** | Dashboard owns tier state. Grid never holds it. Default H1 on first load. Resolves STATE.md open question #2. | ✓ (D-01) |
| Global sim mode (Grid-held) | Grid stores the active tier and broadcasts it. Enables multi-operator visibility. | Rejected — conflicts with single-operator v2.1 scope; multi-operator problems deferred to OP-MULTI-01 |
| Hybrid (client-primary, Grid-mirror) | Store both; reconcile on reconnect. | Rejected — needless complexity for single-operator phase |

**Rationale:** Single-operator v2.1 means the tier is a UI concept only. Grid only cares about the stamp on each request (D-14). This keeps the frozen-set allowlist invariant and tick determinism untouched by Phase 6 state decisions.

---

## Agency Indicator — Mount Location

| Option | Description | Selected |
|--------|-------------|----------|
| **Root `layout.tsx`** | Indicator renders on every route without per-page plumbing. | ✓ (D-02) |
| Per-page inclusion | Opt-in placement in each page. | Rejected — violates SC#1 ("no dashboard route can be entered without the indicator mounted") |
| Floating portal | Renders over whatever's beneath it. | Rejected — hurts accessibility and risks overlapping inspector drawer |

---

## Agency Indicator — Visual Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| **Pill/chip (top-right)** | Reuses `<Chip />` primitive. Tier label + color coding. Tooltip on hover/click with H1–H5 definitions. | ✓ (D-03) |
| Inline breadcrumb | Embedded in header title area. | Rejected — less scannable |
| Side rail permanent badge | Always-visible vertical tier strip. | Rejected — consumes layout space for low-frequency state change |

---

## Operator Identity — Scheme

| Option | Description | Selected |
|--------|-------------|----------|
| **Session UUID (`op:<uuid-v4>`)** | Generated on first mount, stored in localStorage. Stable across reloads, ephemeral across browsers. | ✓ (D-04) |
| DID format (`did:noesis:op:*`) | Reuses Nous identity scheme. | Rejected — DIDs are reserved for Nous per Phase 1 IDENT-01 semantics |
| Anonymous (no ID) | Audit trail records tier + action only. | Rejected — loses forensic attribution within a session |
| Grid-allocated ID | Grid hands out operator IDs. | Rejected — requires Grid state for single-operator scope, violates D-01 |

---

## Operator Identity — Authentication

| Option | Description | Selected |
|--------|-------------|----------|
| **None in Phase 6** | Trust the client-generated UUID for single-operator v2.1. | ✓ (D-05) |
| Login-backed | Bind `operator_id` to an auth session. | Deferred — OP-MULTI-01 concern |
| Signed header | Ed25519 signature on `operator_id`. | Deferred — over-engineered for single-operator scope |

---

## Elevation Dialog — Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| **Modal dialog with Cancel/Confirm** | Intercepts action before HTTP dispatch. Dialog text per REQ AGENCY-04 verbatim. Auto-downgrades after dispatch. | ✓ (D-06) |
| Inline button confirmation | Two-click widget. | Rejected — too easy to mis-click; doesn't feel like an elevation |
| Session-wide elevation | Stay in H3 for multiple actions. | Rejected explicitly by REQ AGENCY-04 |

---

## Elevation Dialog — Race Handling

| Option | Description | Selected |
|--------|-------------|----------|
| **Tier captured at confirm time, serialized into body before I/O** | Mid-flight downgrade does not affect committed tier. Matches SC#4. | ✓ (D-07) |
| Tier sampled at HTTP arrival | Grid reads latest tier from a header when request arrives. | Rejected — fails SC#4 elevation-race test |
| Tier sampled at audit append time | Grid inspects current tier state server-side. | Rejected — no Grid-side tier state exists (D-01) |

---

## Tier Map — Action Assignments

| Action | Tier | Audit Event | Notes |
|--------|------|-------------|-------|
| Firehose read / region map / heartbeat / inspect (presence) | H1 | none | Observation only |
| Read Nous memory | H2 | `operator.inspected` | REQ AGENCY-02 |
| Pause simulation | H3 | `operator.paused` | REQ AGENCY-02 |
| Resume simulation | H3 | `operator.resumed` | REQ AGENCY-02 |
| Change a Grid law | H3 | `operator.law_changed` | REQ AGENCY-02 |
| **Mutate broadcast allowlist** | H3 | *(deferred)* | D-09a — frozen-set invariant redesign required; not in Phase 6 |
| Force-mutate Nous Telos | H4 | `operator.telos_forced` | REQ AGENCY-02 |
| Delete a Nous | H5 | `operator.nous_deleted` | Phase 8 only; disabled affordance in Phase 6 |

**User choice:** Accepted the REQ-locked map verbatim. The "mutate broadcast allowlist" item is carved out via D-09a with explicit partial-coverage flag in VERIFICATION.

---

## Broadcast Allowlist — Event Order

| Option | Description | Selected |
|--------|-------------|----------|
| **Append 5 `operator.*` events after `grid.stopped` in ALLOWLIST_MEMBERS** | Code-tuple order: inspected → paused → resumed → law_changed → telos_forced. Count 11 → 16. | ✓ (D-10) |
| Interleave with existing events | Group by domain. | Rejected — breaks the "phase-by-phase append-only" allowlist discipline |

---

## Payload Shape — Shared Fields

| Option | Description | Selected |
|--------|-------------|----------|
| **`{tier, action, operator_id, target_did?}` shared; event-specific extensions documented per event** | Tier required on all; target_did optional; H4 carries hash-only telos_hash_before/after. | ✓ (D-11, D-12) |
| Unique schema per event | Each event has a distinct shape. | Rejected — breaks the SC#2 "every operator.* event has `tier`" contract test |

**Privacy check (D-12):** All 5 event payload variants pass `payloadPrivacyCheck()` against `FORBIDDEN_KEY_PATTERN = /prompt|response|wiki|reflection|thought|emotion_delta/i`.

---

## Server-Side Enforcement Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| **Grid validates `{tier}` presence only; client enforces tier rules** | Middleware rejects 400 if tier missing/malformed. Hierarchy enforcement is UI-side. | ✓ (D-14, D-15) |
| Grid enforces tier-to-endpoint mapping | Reject H4 requests at Grid if tier is lower. | Rejected — couples tier to endpoint; future H-tier reassignment becomes harder |
| Grid enforces tier with per-tier rate limits | Deferred — OP-MULTI-01 |

---

## H4 Force-Telos — Payload Privacy

| Option | Description | Selected |
|--------|-------------|----------|
| **Hash-only broadcast (`telos_hash_before`, `telos_hash_after`)** | Mirrors Phase 7 `telos.refined` privacy discipline; full Telos stays in Brain. | ✓ (D-19) |
| Full Telos content in broadcast | Operator sees what they forced. | Rejected — violates sovereignty + privacy invariants; goal contents must never leak to the broadcast |
| No audit event, only Grid-internal log | Minimizes broadcast surface. | Rejected — fails AGENCY-03 (must emit `operator.telos_forced`) |

---

## H5 Surface

| Option | Description | Selected |
|--------|-------------|----------|
| **Disabled button + tooltip "Requires Phase 8"** | Visible but unclickable. Satisfies SC#5. | ✓ (D-20) |
| Hidden entirely in Phase 6 | Only appears when Phase 8 ships. | Rejected — SC#5 requires visible-but-disabled affordance |
| Enabled with "not yet implemented" error | Surfaces a runtime failure. | Rejected — confusing UX; violates first-life gravity |

---

## Claude's Discretion

- Chip color palette (D-03) — tier → color mapping inside Tailwind theme
- Exact mount strategy for `<AgencyIndicator />` inside root layout (server/client boundary)
- File layout for operator API endpoints (`grid/src/api/operator/*.ts` subtree vs inline in `server.ts`)
- `operator_id` UUID generation (`crypto.randomUUID()` is fine)
- Dialog animation style — match existing Inspector drawer polish
- Error handling when Brain is unreachable (503, no audit event emitted)
- Test file layout under `grid/test/api/operator/` subtree

## Deferred Ideas

- Broadcast allowlist runtime mutation (AGENCY-02 H3 item #2) — new mini-phase or OP-MULTI-01
- H5 Sovereign deletion — Phase 8 (AGENCY-05)
- Multi-operator conflict resolution — OP-MULTI-01
- Server-side tier hierarchy enforcement — OP-MULTI-01
- Authenticated `operator_id` — future
- Cross-device session sync — out of scope
- Session-wide elevation — rejected by AGENCY-04
- Operator DID identity — rejected by D-04
- WHISPER-01 regional peer channel — Sprint 16+
- AI-judged operator actions — rejected by REV-04
