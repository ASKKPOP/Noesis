---
gsd_state_version: 1.0
milestone: v2.6
milestone_name: — Active)
status: executing
stopped_at: Phase 31 context gathered
last_updated: "2026-05-24T05:20:48.630Z"
last_activity: 2026-05-24 -- Phase 31 execution started
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 6
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-24)

**Core value:** The first persistent Grid where Nous actually live — open to real human users since v2.5. Trust in the audit pipeline and observability surfaces is the foundation for everything that follows.
**Current milestone:** v2.6 — Resilience & Observability
**Previous milestone:** v2.5 Human Portal — SHIPPED 2026-05-24 (181/181 plans, allowlist 53)
**Current focus:** Phase 31 — audit-pipeline-persistence

## Current Position

Phase: 31 (audit-pipeline-persistence) — EXECUTING
Plan: 1 of 6
Status: Executing Phase 31
Last activity: 2026-05-24 -- Phase 31 execution started

Driving inputs for v2.6 (unchanged from milestone open):

- GAP-2026-05-24-A — Audit pipeline silence (MySQL audit_trail flush stalled since 2026-05-22T06:57Z; firehose WS delivers zero event frames despite in-memory chain growth) — Phase 31 root-cause fix
- GAP-2026-05-24-B — Missing portal.auth.login / portal.auth.register producers (read by /users + /humans/history but emitted nowhere; both consumer surfaces always empty) — Phase 33 fix

## v2.6 Phase Plan Summary (created 2026-05-24)

| Phase | Goal | REQs | Allowlist Delta |
|-------|------|------|-----------------|
| 31 — Audit Pipeline Persistence | Wire PersistentAuditChain in production; reconcile loop; Pino structured logging; backfill script | OBS-01..04 | 0 (53) |
| 32 — Firehose Observability | Frame counters; `/health/detailed`; health watchdog | OBS-05..07 | 0 (53) |
| 33 — portal.auth.* Producers | appendPortalAuthLogin/Register sole-producers; SIWE + email wiring; PORTAL_AUTH_FORBIDDEN_KEYS | OBS-08..10 | +2 (55) |
| 34 — Steward `/system` Health Surfaces | Audit Pipeline Health card; Firehose Diagnostics; Events-per-Minute sparkline; client watchdog | OBS-11..14 | 0 (55) |
| 35 — UAT Re-Verification + Doc Close-Out | Re-run 25a-HUMAN-UAT #1 + #5c; sync MILESTONES/PROJECT/PHILOSOPHY/README/CLAUDE | OBS-15 | 0 (55) |

**Total v2.6 allowlist growth:** +2 (Phase 33 only).
**Phase ordering:** Sequential 31 → 32 → 33 → 34 → 35 (forced by dependency chain — see ROADMAP.md Progress section).

## v2.5 Key Decisions (locked 2026-05-20)

| Decision | Choice |
|----------|--------|
| Human auth | SIWE (Sign-In With Ethereum) — wallet signature = identity, no password |
| Cyber Coin | Real EVM crypto (USDT/ETH) — user's own wallet, platform holds zero custody |
| Onboarding AI | Fast-proxy LLM (out-of-tick) — Sophia's voice, ~2s response |
| Personal Nous | In-scope for v2.5 — users spawn their own Nous agent in Genesis Grid |
| Portal location | `/portal/*` routes inside existing Next.js dashboard — no new Docker service |
| Starting Cyber Coin | None assigned by platform — user brings their own wallet funds |
| Human DID scheme | `did:noesis:human:<checksummed-eth-address>` |
| Allowlist growth | 43 → 53 (+10 events across Phases 22-29) |

## v2.6 Key Decisions (locked 2026-05-24)

| Decision | Choice |
|----------|--------|
| Observability stack | Pino structured logging (already Fastify transitive dep) + in-process counters + `/health/detailed` JSON polling. NO Prometheus, NO Datadog/Honeycomb/New Relic SaaS. |
| portal.auth.* payload shape | Closed 3-key tuple `{human_did, method, tick}` where `method ∈ {siwe, email}`. NO IP, NO User-Agent, NO email plaintext, NO session token. PORTAL_AUTH_FORBIDDEN_KEYS enforced. |
| Audit persistence pattern | Wire `PersistentAuditChain` in production (not the plain `AuditChain` currently constructed at launcher.ts:138). Listener fan-out happens first (in-memory commit), then fire-and-forget DB write. Tick-cadenced reconcile loop as belt-and-suspenders. |
| Failure logging | Replace all `.catch(err => console.warn(...))` in `grid/src/db/` and `grid/src/audit/` with Pino structured logs. CI gate enforces. |
| `/health/detailed` constraint | MUST NOT block on DB queries — cached `persisted_max_id` populated by reconcile loop; cache miss returns null. |
| Phase ordering | Strict sequential 31 → 32 → 33 → 34 → 35. No parallel phases — Phase 31 must land first (foundation). |

## Accumulated Context

### Carry-forward from v2.0

**v2.0 shipped state (2026-04-18):**

- grid 346/346 tests, brain 262/262 tests, dashboard 215/215 tests — all green
- Broadcast allowlist FROZEN (v2.0 baseline: 10 events, per `grid/src/audit/broadcast-allowlist.ts`): `nous.spawned`, `nous.moved`, `nous.spoke`, `nous.direct_message`, `trade.proposed`, `trade.settled`, `law.triggered`, `tick`, `grid.started`, `grid.stopped`. (Historical drift note: pre-Phase-5 STATE.md claimed 11 with phantom `trade.countered` — phantom event was never emitted, never in code; drift corrected 2026-04-20 per Phase 5 D-11.)
- AuditChain zero-diff invariant holds since Phase 1 commit `29c3516`
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` enforced at 3 entry points
- TradeRecord.timestamp contract: Unix **seconds** (`< 10_000_000_000`)
- Trade payload privacy: `{counterparty, amount, nonce}` only — no memory refs, no Telos
- Dashboard Docker: Next.js standalone output, multi-stage build, ARG→ENV→RUN npm build ordering locked (Pitfall 1)
- `/api/dash/health` is static — no cascading probe to Grid
- SC-6 live-stack smoke: runtime verification pending on operator machine per HUMAN-TEST-GUIDE.md

### Broadcast allowlist (v2.5 end-state — 53 events)

**53 events.** In code-tuple order (authoritative source: `grid/src/audit/broadcast-allowlist.ts` `ALLOWLIST_MEMBERS`):

1. `nous.spawned`
2. `nous.moved`
3. `nous.spoke`
4. `nous.direct_message`
5. `trade.proposed`
6. `trade.reviewed` ← Phase 5 (REV-02)
7. `trade.settled`
8. `law.triggered`
9. `tick`
10. `grid.started`
11. `grid.stopped`
12. `operator.inspected` ← Phase 6 (AGENCY-02)
13. `operator.paused` ← Phase 6 (AGENCY-03)
14. `operator.resumed` ← Phase 6 (AGENCY-03)
15. `operator.law_changed` ← Phase 6 (AGENCY-03)
16. `operator.telos_forced` ← Phase 6 (AGENCY-03)
17. `telos.refined` ← Phase 7 (DIALOG-02)
18. `operator.nous_deleted` ← Phase 8 (AGENCY-05)
19. `ananke.drive_crossed` ← Phase 10a (DRIVE-03)
20. `bios.birth` ← Phase 10b (BIOS-02)
21. `bios.death` ← Phase 10b (BIOS-02/03)
22. `nous.whispered` ← Phase 11 (WHISPER-04)
23. `proposal.opened` ← Phase 12 (VOTE-01)
24. `ballot.committed` ← Phase 12 (VOTE-02)
25. `ballot.revealed` ← Phase 12 (VOTE-03)
26. `proposal.tallied` ← Phase 12 (VOTE-04)
27. `operator.exported` ← Phase 13 (REPLAY-02)
28. `nous.reflection_authored` ← Phase 15 (PNEU-01)
29. `nous.self_model_revised` ← Phase 15 (PNEU-03)
30. `nous.creed_violation` ← Phase 15 (PNEU-06)
31. `nous.sleep.entered` ← Phase 16 (HYP-04)
32. `nous.sleep.completed` ← Phase 16 (HYP-04)
33. `iris.belief_revised` ← Phase 17 (IRIS-05)
34. `iris.context_invoked` ← Phase 17 (IRIS-05)
35. `iris.contradiction_detected` ← Phase 17 (IRIS-03)
36. `iris.prior_seeded` ← Phase 17 (IRIS-04)
37. `skill.taught` ← Phase 18
38. `skill.inferred` ← Phase 18
39. `skill.rejected` ← Phase 18
40. `norm.candidate` ← Phase 19
41. `norm.crystallized` ← Phase 19
42. `lore.contributed` ← Phase 20
43. `lore.cited` ← Phase 20
44. `human.joined` ← Phase 22 (v2.5 begin)
45. `human.transferred` ← Phase 24 (wiring landed for Phase 23)
46. `operator.muted` ← Phase 25b
47. `operator.slashed` ← Phase 25b
48. `operator.quarantined` ← Phase 25b
49. `operator.forced_sleep` ← Phase 25b
50. `operator.human_banned` ← Phase 25b
51. `operator.human_frozen` ← Phase 25b
52. `human.spoke` ← Phase 27
53. `nous.spawned_by_human` ← Phase 28

### v2.6 allowlist additions (planned — Phase 33 only)

- Phase 31 adds: *(none — wiring + reconcile + logging only)*
- Phase 32 adds: *(none — `/health/detailed` is a route, not an audit event)*
- Phase 33 adds: `portal.auth.login` (pos 54) `{human_did, method, tick}`; `portal.auth.register` (pos 55) `{human_did, method, tick}`
- Phase 34 adds: *(none — UI cards consume existing data via REST)*
- Phase 35 adds: *(none — documentation + UAT only)*

Total v2.6 allowlist growth: **+2 (53 → 55)**. Freeze-except-by-explicit-addition rule preserved.

### v2.6 forbidden-key additions (Phase 33)

`PORTAL_AUTH_FORBIDDEN_KEYS` (13 keys) declared in Phase 33:

- `ip_address`, `ip`, `user_agent`, `ua`, `session_id`, `token`, `jwt`, `cookie`
- `email` (plaintext — vs `email_hash` allowed), `password_hash`
- `nonce` (vs `nonce_hash` allowed), `signature`, `device_fingerprint`

`FORBIDDEN_KEY_PATTERN` extended with word-boundary-anchored alternation `\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b`. Test cases for `email_hash` (allowed) vs `email` (forbidden) AND `nonce_hash` (allowed) vs `nonce` (forbidden) are mandatory.

### v2.5 critical invariants (carry-forward)

- Zero-custody for human funds — platform never holds USDT/ETH; sanctions are Grid-side flags only (PHILOSOPHY §8)
- `eth_address_hash` (SHA-256 of lowercased address) is the only ETH-address representation in the audit chain
- Sanction reason discipline (D-25b-11): plaintext in `sanction_reasons` table; `reason_hash` only in audit payloads
- Human DID scheme: `did:noesis:human:<lowercased-eth-address>` (SIWE) or `did:noesis:human:email:<uuid>` (email path)
- Operators read-only on governance (VOTE-05 from v2.2) — write-actions added in Phase 25b are sanctions, not governance

### v2.4 critical invariants (carry-forward)

- **PeerSkillFilter** trust gate locked at relationship weight ≥ 0.35 + structural validity + FTS5 dedup
- **NormDetector** is pure-observer (zero `AuditChain.append` calls); rebuildFromChain uses `applyEntry`
- **Lore body never crosses wire** — Grid stores only `{contributor_did, tick, content_hash, title_hash, category_tag, citation_count}`
- **Culture dashboard raw SVG** — no d3, no react-flow, no cytoscape, no recharts
- **n-gram fingerprint** = 6-char hex prefix of SHA-256 over sorted word-trigrams of lowercased rule text (format locked — changes require wiping norm registry)
- **Quorum thresholds injectable** via GenesisLauncher config (N=3, W=10, K=20 defaults)
- **Lore contribution quota** K=3 per Nous per sleep epoch (30 ticks)

### v2.3 critical invariants (carry-forward)

- Working Memory cap=7 (Miller's Law); Hebbian η=0.01 + SHY σ=0.95
- IrisStore is append-only with superseded_by FK chain
- 3-keys-not-5 pattern: Brain returns cognitive metadata, Grid injects `{did, tick}` at producer boundary
- Wall-clock permanently forbidden in `brain/src/noesis_brain/hypnos/`, `iris/`, `bios/`, `chronos/`, `ananke/`

### v2.2 critical invariants (carry-forward)

- Drive-float-never-crosses-wire: only bucketed `{drive, level, direction}` keys cross
- Three-tier privacy grep (Grid emitter + Brain wire + Dashboard render)
- Bios = body (energy, sustenance); Thymos = mood (deferred). Non-negotiable separation (PHILOSOPHY §1).
- `audit_tick === system_tick` strictly across all event types
- WHISPER_FORBIDDEN_KEYS (13 keys): plaintext / content / message / utterance / amount / etc.
- Operators cannot read whispers at any tier including H5
- Operators cannot vote/propose/tally governance at any tier including H5

### Research foundation for v2.6

- `.planning/research/v2.6/OBSERVABILITY-HARDENING.md` — committed `3e1fbe6`
  - Direct read of `grid/src/genesis/launcher.ts:138` confirmed plain `AuditChain` construction (root cause of GAP-A)
  - Direct read of `grid/src/db/persistent-chain.ts` confirmed `PersistentAuditChain` exists but is never reached in production boot path
  - Direct read of `grid/src/api/portal/auth.ts:125-131, 217, 265` mapped wiring points for new producers
  - Pino v10.1.0 confirmed via Context7 as sovereignty-compatible (already Fastify transitive dep)
  - Prometheus / Datadog / Honeycomb / New Relic explicitly rejected (sovereignty)

### Roadmap Evolution

- v2.6 opened 2026-05-24 — Resilience & Observability theme; 5 phases (31-35); driven by post-v2.5 UAT gaps (GAP-A audit pipeline silence + GAP-B missing portal.auth.* producers)

## Session Continuity

Last session: 2026-05-24T04:24:03.747Z
Stopped at: Phase 31 context gathered
Resume file: .planning/phases/31-audit-pipeline-persistence/31-CONTEXT.md
