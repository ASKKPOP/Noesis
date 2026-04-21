# Milestones

## v1.0: Phase 1 — Genesis (COMPLETE)

**Shipped:** 2026-04-17 (10 sprints)
**Goal:** Build all core systems — identity, cognition, memory, economy, governance, and world infrastructure.

**What shipped:**
- Ed25519 DID identity + SWP signed envelopes + P2P mesh
- NDS (Noēsis Domain System) + Communication Gate
- LLM adapter — multi-provider routing (Ollama, Claude, GPT, local)
- Brain core — Psyche (Big Five), Thymos (emotions), Telos (goals)
- Brain-Protocol bridge — JSON-RPC over Unix domain socket
- Memory stream + personal wiki (Karpathy pattern) + reflection engine
- Grid infrastructure — WorldClock, SpatialMap, LogosEngine, AuditChain, REST API
- P2P economy — Ousia transfers, bilateral negotiation, shops, reputation
- Human Channel — ownership proofs, consent grants, gateway, activity observer
- Genesis launch — NousRegistry, GenesisLauncher, CLI, world presets

**Test coverage at completion:** 944+ TypeScript tests, 226 Python tests — all passing.

---

## v2.0: First Life (COMPLETE)

**Shipped:** 2026-04-18 (Sprints 11-14)
**Goal:** Make Nous actually live. Full end-to-end integration, persistent storage, deployment, and real-time dashboard.

**What shipped:**
- **Sprint 11** — End-to-end integration: NousRunner + GridCoordinator, full tick cycle, E2E tests
- **Sprint 12** — Persistent storage: MySQL adapter, migrations, snapshot/restore
- **Sprint 13** — Docker & Deployment: Dockerfiles, docker-compose, health checks, env config
- **Sprint 14** — Dashboard v1:
  - Phase 1: AuditChain listener API + broadcast allowlist (zero-diff invariant)
  - Phase 2: WsHub + `/ws/events` endpoint with ring-buffered backpressure
  - Phase 3: Dashboard firehose + heartbeat + region map (Next.js 15)
  - Phase 4: Nous inspector + economy + Docker polish (standalone Next + compose)

**Test coverage at completion:** grid 346/346, brain 262/262, dashboard 215/215 — all green.
**SC status:** 6/7 phase 4 success criteria MET; SC-6 (live docker compose smoke) verified on operator machine after shipping.

---

## v2.1: Steward Console (IN PROGRESS)

**Goal:** Turn the observational dashboard into a stewarded environment. Operators can intervene at explicit agency tiers, Nous review each other's proposed actions on objective invariants only, and peer dialogue meaningfully mutates goals.

**Research foundation:** `.planning/research/stanford-peer-agent-patterns.md` (2026-04-20)
- Agentic Reviewer pattern (Zou, Stanford HAI) → ReviewerNous
- Human Agency Scale H1–H5 (arxiv 2506.06576) → operator UI
- SPARC peer-dialogue → telos.refined from two-Nous exchanges

**Target features:**
- ReviewerNous — objective-only pre-commit checks on trades (REV-01, REV-02)
- Operator Agency Tiers — H1–H5 first-class UI concept with tier-stamped audit events (AGENCY-01, AGENCY-02, AGENCY-03)
- Peer Dialogue Memory — `telos.refined` from two-Nous exchanges (DIALOG-01, DIALOG-02)

### Sprint 15 / v2.1 — Phase 5 SHIPPED

**Shipped:** 2026-04-21
**Phase:** 5 — ReviewerNous — Objective-Only Pre-Commit Review
**Requirements closed:** REV-01, REV-02, REV-03, REV-04
**Plans:** 5/5 (05-01, 05-02, 05-03, 05-04, 05-05)

**Key artifacts shipped:**
- `grid/src/review/` module — 5 objective-invariant check handlers (balance, counterparty DID, positive integer amount, memory-ref existence, no contradicting Telos)
- Closed-enum `ReviewFailureCode` — reason codes are never free-form text (REV-02)
- REV-04 subjective-keyword lint gate — test fails if a handler mentions fairness/wisdom/taste/quality/novelty
- Reviewer singleton at `did:noesis:reviewer` with first-fail-wins dispatch loop (REV-03)
- Brain schema extension: `memoryRefs: list[str]` + `telosHash: str` on `trade_request` action
- 3-event audit flow: `trade.proposed` → `trade.reviewed` → `trade.settled` (REV-01, REV-02)
- 11-event broadcast allowlist (was 10 pre-Phase-5) — `trade.reviewed` added
- D-12 privacy regression test: `memoryRefs`/`telosHash` NEVER leak to broadcast payload
- D-13 zero-diff invariant regression test: 100-tick sim with reviewer matches bypass hash modulo allowed `trade.reviewed` entries
- D-11 STATE.md reconciliation — phantom `trade.countered` purged, 11-event enumeration explicit
- `scripts/check-state-doc-sync.mjs` — new CI gate against future STATE.md drift

**Key decisions locked:** D-01..D-13 (see `.planning/phases/05-reviewernous-objective-only-pre-commit-review/05-CONTEXT.md`)

**Next up:** Phase 6 — Operator Agency Foundation (H1–H4)

### Sprint 16 / v2.1 — Phase 6 SHIPPED

**Shipped:** 2026-04-20
**Phase:** 6 — Operator Agency Foundation (H1–H4)
**Requirements closed:** AGENCY-01, AGENCY-02 (partial — H3 allowlist-mutate deferred), AGENCY-03, AGENCY-04
**Plans:** 6/6 (06-01, 06-02, 06-03, 06-04, 06-05, 06-06)

**Key artifacts shipped:**
- `grid/src/audit/operator-events.ts` — sole sanctioned producer for all `operator.*` events; `requireTierInPayload` + closed-tuple payload enforcement
- 16-event broadcast allowlist (was 11 pre-Phase-6) — 5 new `operator.*` events added (`inspected`, `paused`, `resumed`, `law_changed`, `telos_forced`)
- H1–H4 operator tier system: persistent Agency Indicator on every dashboard route, H2 memory query, H3 pause/resume + law CRUD, H4 force-Telos
- Elevation dialog with native `<dialog>.showModal()` focus trap — single-action scope (tier auto-downgrades to H1 after dispatch, AGENCY-04)
- Closure-capture discipline in `use-elevated-action` — tier stamped at confirm-click time, never at HTTP-arrival time (SC#4 race regression test)
- D-19 hash-only audit for force-Telos — HEX64 guard on both before/after hashes; no plaintext goals ever enter the audit payload
- `AgencyStore` + `useSyncExternalStore` subscriber pattern — SSR-safe H1 default, no hydration flash
- D-12 privacy regression: forbidden-key pattern `/prompt|response|wiki|reflection|thought|emotion_delta/i` blocks operator payload leaks
- H5 Sovereign Nous deletion = disabled placeholder with "requires Phase 8" tooltip (no onClick bound)

**Key decisions locked:** D-01..D-19 (see `.planning/phases/06-operator-agency-foundation-h1-h4/06-CONTEXT.md`)

**Deferred:** AGENCY-02 item "mutate broadcast allowlist at runtime" — requires rethinking frozen-set invariant; filed for later mini-phase

**Next up:** Phase 7 — Peer Dialogue → Telos Refinement (DIALOG-01, DIALOG-02, DIALOG-03)

### Sprint 17 / v2.1 — Phase 7 SHIPPED

**Shipped:** 2026-04-21
**Phase:** 7 — Peer Dialogue → Telos Refinement
**Requirements closed:** DIALOG-01, DIALOG-02, DIALOG-03
**Plans:** 4/4 (07-01, 07-02, 07-03, 07-04)

**Key artifacts shipped:**
- Brain-side peer-dialogue memory integration: `PeerDialogueMemory` + `TelosRefinementEngine` consume two-Nous exchanges → emit `telos.refined` with before/after hash tuple + triggering dialogue id (DIALOG-01)
- Grid-side `appendTelosRefined` sole-producer boundary at `grid/src/audit/append-telos-refined.ts` — enforces DIALOGUE_ID_RE + HEX64_RE on producer side (T-07-P1); no other code path may emit `telos.refined` (DIALOG-02)
- 17-event broadcast allowlist (was 16 pre-Phase-7) — `telos.refined` added; closed-tuple payload `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` — plaintext-never invariant preserved (PHILOSOPHY §1)
- NousRunner telos-refined branch: `recentDialogueIds` authority pattern — runner maintains the set; telos engine consumes but does not own it (T-07-P3 resolution)
- Dashboard surfaces (DIALOG-03):
  - New `'dialogue'` Chip variant — indigo-400 `#818CF8` on `#17181C` (Phase 7 tier-palette slot, 6.4:1 contrast)
  - `TelosRefinedBadge` at panel level on Inspector's TelosSection (D-27/D-30: panel-level, not per-goal) — `↻ refined via dialogue (N)` label, click navigates to firehose filtered by triggering dialogue_id
  - `useRefinedTelosHistory` derived selector over existing `useFirehose()` — zero new RPC, zero new WebSocket subscription
  - `useFirehoseFilter` URL hook — parses `?firehose_filter=dialogue_id:<16-hex>` with DIALOGUE_ID_RE validation; malformed → filter null (chip not mounted)
  - `FirehoseFilterChip` + dim-not-hide firehose rows (`opacity-40 pointer-events-none` on non-match; matching rows full opacity) — AC-4-3-3 preserves temporal debugging context
  - AC-4-3-4 zero-diff guard: firehose renders byte-identical to pre-Phase-7 output when filter is null
- Color-scope invariant: `#818CF8` confined to 8 allowlisted files; cross-file `node:fs` walker enforces in `telos-refined-badge.test.tsx`
- Plaintext-never source invariant: no `new_goals`, `goal_description`, or `utterance` strings in dashboard sources (grep-based test)

**Key decisions locked:** D-20..D-30 (see `.planning/phases/07-peer-dialogue-telos-refinement/07-CONTEXT.md`)

**STRIDE threats addressed:** T-07-P1 (producer-boundary plaintext leak), T-07-P2 (dialogue_id spoofing — regex gate at producer and consumer), T-07-P3 (recentDialogueIds authority ambiguity), T-07-P4 (color-palette bleed across phases)

**Next up:** v2.2 milestone planning (or Phase 8 — Sovereign Nous deletion / AGENCY-05)

---
*Last updated: 2026-04-21 — Phase 7 shipped (DIALOG-01/02/03 closed)*
