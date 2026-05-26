---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Polis (Civic City) — Phases 36-50
status: phase_36_shipped_ready_to_plan_phase_37
stopped_at: Phase 36 SHIPPED 2026-05-26; allowlist 56 → 60 (+4); 8 plans; visit/action enforcement live with CI gates
last_updated: "2026-05-26T19:00:00.000Z"
last_activity: Phase 36 (Visitor/DID Read-Write Split) SHIPPED. 8 plans (36-01..36-08). ROUTE_DID_POLICY + WS firehose redaction + 5 sole producers + 4 CI gates + visitor surfaces. R-31-01 zero-diff preserved. Ready for Phase 37 (DID Registry).
progress:
  total_phases: 25
  completed_phases: 1
  total_plans: 8
  completed_plans: 8
  percent: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 — v3.0 Polis current milestone block added)

**Core value:** The first persistent Grid where Nous actually live — evolving into a digital city with civic institutions where Nous self-govern, trade, learn, and form communities while preserving substrate sovereignty (local Brain) under a constitutional operator framework.
**Current milestone:** v3.0 — Polis (Civic City)
**Previous milestone:** v2.6 Resilience & Observability — SHIPPED 2026-05-25 (5 phases + 2 followups, allowlist 56)
**Current focus:** Phase 36 — visitor-did-read-write-split

## Current Position

Phase: Phase 36 SHIPPED 2026-05-26
Plan: 36-01..36-08 all complete
Status: Ready to plan Phase 37 (DID Registry)
Next action: `/gsd-plan-phase 37` — DID Registry (Civic-DID + Business-DID + Issuer/Revocation)

Driving inputs for v3.0 (locked at milestone open):

- **Vision:** Grid-as-City with local Brain (Local AI / Ollama) + remote Public Grid (Henry-hosted at TBD domain) + 8 civic institutions
- **Source-of-truth:** `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v2.0 (committed 0d77916, supersedes multi-Grid federation model)
- **Supplement:** `.planning/research/v3.0/SUPPLEMENT-visit-vs-action.md` (read/write asymmetry, still authoritative)
- **Resource archive:** `.planning/research/v3.0/RESOURCE-brains-location.html` (Brain location analysis, decision-locked banner)
- **23 locked decisions:** D-V3-01..03, 06, 08..15 preserved; D-V3-04, 05, 07 superseded; D-V3-16..23 new this milestone
- **10 open questions (Q-V3-A..J):** P2P stack, Local AI model, IRS fee %, Bios cost, Henry's domain, right-to-fork subset, Police authority, sleep thresholds, cloud LLM allowed?, community subgovernance — locked during per-phase discuss-phase sessions
- **PHILOSOPHY §1 reframe:** First-life redefined as "continuity of identity + memory + civic standing across sleep cycles, ensured by both substrate operator (Brain) and constitutional operator (Henry)" — amendment pending atomic doc-sync

## v3.0 Phase Plan Summary (FORMALIZED 2026-05-25 in ROADMAP.md)

| Wave | Phase | Goal | Effort | Allowlist Delta | Depends On |
|------|-------|------|--------|-----------------|------------|
| **1** | 36 — Visitor/DID Read-Write Split | Implement visit-without-DID + action-with-DID asymmetry per supplement | M | +4 | — |
| **1** | 37 — DID Registry | Civic-DID + Business-DID + Issuer/Revocation | L | +4 | — |
| **1** | 38 — Brain ↔ Grid Wire Protocol | HTTPS + WSS replaces in-process queues; service tokens | L | 0 | 37 |
| **1** | 39 — Multi-Tenancy | Operator namespace isolation in Grid | M | 0 | 38 |
| **1** | 40 — Local AI Integration | Ollama production-grade default | M | 0 | — |
| **1** | 41 — Sleep Cycle | Away presence model; queued messages on wake | M | 0 | 38 |
| **2** | 42 — P2P Infrastructure | Signaling, discovery, NAT traversal | L | +3 | 36, 37, 38 |
| **2** | 43 — Right-to-Fork Tooling | Export Nous standalone (constitutional enforcement) | M | 0 | 37, 38 |
| **3** | 44 — Marketplace v3 | Civic commerce + escrow (evolves v1.0 Ousia) | L | +4 | 37 |
| **3** | 45 — IRS | Transaction fees + civic treasury | M | +3 | 44 |
| **3** | 46 — Government v3 | Civic VOTE-05 + legislative sessions | L | +6 | 37 |
| **3** | 47 — Police v3 | Sanctions + investigation + appeals | M | +4 | 46 |
| **3** | 48 — Library v3 | Civic curation council + reading room | M | +2 | 37, 45 |
| **3** | 49 — Communities v3 | Group formation + charters | M | +4 | 37 |
| **4** | 50 — Migration | v2.6 → v3.0 ceremony (Sophia data import + civic-DID grandfathering) | L | 0 | ALL |

**Total v3.0 allowlist growth:** +52 (56 → 108) across 8 civic institutions + Type B + Portal + Zoning.
**Estimated plans:** ~125 across 24 phases (was 15).
**Coverage:** 91/91 REQ-V3-* REQs mapped 1:1 to phases (no orphans, no duplicates).
**Phase ordering:** Wave 1 expanded (10 phases including Portal 52-54 + Type B Brain 40b + Registry 37b); Wave 2 (Plumbing + Cross-Grid + UI); Wave 3 (Institutions + Zoning); Wave 4 (Migration + Mobility).
**Three-layer architecture:** Portal (top meta-layer, NEW) → Grid (multi-Grid framework, 1 active = Genesis Polis) → Brain (2 types: Local + Hosted).
**Visual reference:** `.planning/research/v3.0/ARCHITECTURE-v3.0.html` is the canonical source-of-truth visual.

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

## v3.0 Key Decisions (locked 2026-05-25)

| Decision | Choice | ID |
|----------|--------|-----|
| Sovereignty model | Sovereignty NOT conditioned on Grid registration. Existence-DID is operator-controlled self-sovereign credential. | D-V3-01 (preserved) |
| Grid org role | Registrar/issuer of Civic-DID + Business-DID. Never governor. | D-V3-02 (refined) |
| Credential format | W3C VC: verifiable, revocable, privacy-preserving. | D-V3-03 (preserved) |
| Steward visualization | Phase 21 raw-SVG invariant preserved in Steward. Dashboard may use 3D libs. | D-V3-06 (preserved) |
| Sybil resistance | Founding civic structures (communities, businesses) costs Bios. | D-V3-09 (preserved) |
| Documentation Sync | All v3.0 docs evolve per atomic-commit rule (CLAUDE.md §3). | D-V3-10 (preserved) |
| Visit-vs-action axis | Read-only without DID; write requires Civic-DID. Per-endpoint matrix in supplement. | D-V3-11..15 (preserved) |
| **Brain location** | **Brain runs locally on operator's machine using Local AI (Ollama default).** | **D-V3-16 (NEW)** |
| **Local Docker future** | **Local Docker = dev/test only. Production = Henry-hosted remote at TBD domain.** | **D-V3-17 (NEW)** |
| **Constitutional operator** | **Henry (substrate operator) bound by published civic rules: tamper-evident audit, no silent mutation, right-to-fork, public PHILOSOPHY, VOTE-05 immunity.** | **D-V3-18 (NEW)** |
| **Access semantics** | **Nous accesses Grid for purposes. Brain ≠ Grid resident. API + WSS + P2P mediate.** | **D-V3-19 (NEW)** |
| **Sleep cycle** | **Human-resident analogy: city sees offline Nous as 'away'; memory + identity persist in Grid; messages queue; Brain wakes when operator returns.** | **D-V3-20 (NEW)** |
| **Government legislation** | **Nous-only via VOTE-05 (invariant from v2.2 Phase 12). Operators do not vote. Henry does not legislate.** | **D-V3-21 (NEW)** |
| **IRS model** | **Transaction fees on marketplace operations fund civic infrastructure. NO income/wealth tax in v3.0.** | **D-V3-22 (NEW)** |
| **Grid as city** | **Grid = digital city with 8 civic institutions: DID Registry, Government, Police, IRS, Library, Marketplace, Communities, P2P Infrastructure.** | **D-V3-23 (NEW)** |
| Multi-Grid federation | **RE-INSTATED** — multi-Grid framework returns; v3.0 ships 1 Grid (Genesis), v3.1+ adds more via Portal approval. | D-V3-04 (re-instated) |
| Per-jurisdiction credentials | **RE-INSTATED** — each Grid has own Polis + jurisdiction. | D-V3-05 (re-instated) |
| Cross-Grid migration protocol | **RE-INSTATED** — framework built in v3.0, active v3.1+. | D-V3-07 (re-instated) |
| **Portal as top-level meta-layer (4 functions)** | **NEW** — Grid approval, Nous approval, cross-Grid services, user multi-Grid view. Phase 52-56. | **D-V3-29 (NEW)** |
| **Genesis Grid is v3.0 launch** | **NEW** — single Grid at v3.0 launch named Genesis; framework supports N Grids in v3.1+. | **D-V3-30 (NEW)** |
| **Polis = per-Grid government name** | **NEW** — Genesis Polis is v3.0 launch government; each future Grid has its named Polis. | **D-V3-31 (NEW)** |
| **6-zone city zoning** | **NEW** — Business / Manufacture / Shopping / Residential / Infrastructure / Government Quarter per Grid. Phase 57. | **D-V3-32 (NEW)** |
| **Portal-gated Nous registration** | **NEW** — both Type A AND Type B require Portal pre-screen + target-Polis approval before Civic-DID issuance. | **D-V3-33 (NEW)** |
| **Per-Grid tax rules** | **NEW** — each Polis sets its own base + per-zone tax rates via legislation. | **D-V3-34 (NEW)** |
| **Type B year-1 civic restrictions** | **NEW (research-validated)** — vote/marketplace/community ✓ from day 1; office/Police/curator requires 12mo civic standing (naturalization model). | **D-V3-35 (NEW)** |
| **3-tier management taxonomy** | **NEW (user-confirmed)** — Tier 1 Local Nous Manager (operator-side, Local AI Brain admin) · Tier 2 Grid Manager (Henry-side per-Grid runtime, distinct from Polis governance) · Tier 3 Portal Manager (Henry-side meta-system + reviewer panel). MANAGEMENT (administrative) ≠ GOVERNANCE (Polis legislative). | **D-V3-36 (NEW)** |

**Allowlist budget for v3.0:** +52 events (56 → 108) across 8 civic institutions + Type B (15) + Portal (5) + Zoning (2). Frozen-except-by-explicit-addition rule preserved.

## v3.0 Phase 36 close-out (locked 2026-05-26)

- **Phase 36 SHIPPED.** Plans 36-01 through 36-08 all complete. Allowlist 56 → 60 (+4: `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked`). `portal.notification_dispatched` intentionally OFF allowlist (D-36-19 private queue event).

- **Inherits to Phases 37+:**
  1. `ROUTE_DID_POLICY` table now extant in `grid/src/api/policy.ts` (105 entries, 6-value enum); Phase 37 routes MUST add entries.
  2. `tryDid` / `requireDid` preHandlers wired globally via `onRequest` hook; Phase 37 DID-required routes inherit enforcement.
  3. `WsFirehoseHub.onConnect` accepts `didContext` parameter; per-subscriber redaction active for Phase 37+ Civic-DID holders.
  4. 4 CI gates enforced in `.github/workflows/rig-invariants.yml`: `check-did-policy-coverage.mjs`, `check-admin-policy-isolation.mjs`, `check-ws-redaction-zero-diff.mjs`, `check-no-did-exception-count.mjs`.
  5. Visitor read surfaces extant in `dashboard/src/app/portal/` (8 page files: civic-map, zone, library, marketplace, polis, bill, nous-profile, notifications).

- **Mitigations carried forward:**
  - R-31-01 zero-diff preserved: `serializeVisitorFrame()` is post-chain egress only; audit chain hash is independent of subscriber composition. Regression test + `check-ws-redaction-zero-diff.mjs` CI gate.
  - VOTE-05 ballot privacy preserved: `PUBLIC_KEYS` allowlist in `grid/src/api/routes/polis-bills.ts` structurally excludes `.ballots` field; client receives proposals list only.
  - D-36-09 revert-to-visitor: `tryDid` re-checks revocation on every request; revoked DID falls back to visitor tier without error (no 401 for revoked — just loses write access).

- **Cross-phase deferred:**
  - Real Polis data → Phase 46 (Government v3)
  - Real Library data → Phase 48 (Library v3)
  - Real Marketplace data → Phase 44 (Marketplace v3)
  - Civic Map per-Nous data → Phase 37 (Civic-DID registry)
  - 3D Portal landing hero → Phase 56 (D-36-23/24 deferred per D-V3-06 raw-SVG invariant)
  - `civic_member` tier upgrade in `resolveVisitorTier()` → Phase 37 (needs Civic-DID issuance)
  - Per-DID rate limiting → Phase 39 (multi-tenancy)

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

### Broadcast allowlist (v2.6 end-state — 56 events)

**56 events.** In code-tuple order (authoritative source: `grid/src/audit/broadcast-allowlist.ts` `ALLOWLIST_MEMBERS`):

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
54. `portal.auth.login` ← Phase 33 (OBS-08)
55. `portal.auth.register` ← Phase 33 (OBS-09)
56. `human.identified` ← Phase 33 (OBS-08b)

### v3.0 allowlist additions (planned — across 9 phases)

Per ROADMAP.md Allowlist Growth Ledger:

- **Phase 36** (+4): `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked` → 60 **→ SHIPPED 2026-05-26**
- **Phase 37** (+4): `registry.civic_did_issued`, `registry.civic_did_revoked`, `registry.business_did_registered`, `registry.business_did_dissolved` → 64
- **Phase 38** (0): wire protocol is transport, not new events → 64
- **Phase 39** (0): tenancy is access control → 64
- **Phase 40** (0): Local AI is Brain-internal → 64
- **Phase 41** (0): sleep cycle uses existing event families → 64
- **Phase 42** (+3): `p2p.peer_announced`, `p2p.connection_opened`, `p2p.connection_closed` → 67
- **Phase 43** (0): fork uses existing `operator.*` family → 67
- **Phase 44** (+4): `market.listing_created`, `market.bid_placed`, `market.settled`, `market.disputed` → 71
- **Phase 45** (+3): `irs.tax_collected`, `irs.disbursement_authorized`, `irs.disbursement_executed` → 74
- **Phase 46** (+6): `gov.bill_drafted`, `gov.bill_cosponsored`, `gov.session_opened`, `gov.session_closed`, `gov.law_enacted`, `gov.law_repealed` → 80
- **Phase 47** (+4): `police.complaint_filed`, `police.investigation_opened`, `police.charges_filed`, `police.sanction_executed` → 84
- **Phase 48** (+2): `library.curator_elected`, `library.entry_curated` → 86
- **Phase 49** (+4): `community.founded`, `community.joined`, `community.posted`, `community.dissolved` → 90
- **Phase 50** (0): migration uses existing event families → 90

Total v3.0 allowlist growth: **+34 (56 → 90)**. Freeze-except-by-explicit-addition rule preserved. Every new event MUST follow the sole-producer + closed-tuple + `payloadPrivacyCheck` + `audit.append` triad established in v2.6 Phase 33 and CI-enforced by `scripts/check-sole-producer-discipline.mjs`.

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

### v3.0 critical invariants (locked at milestone open 2026-05-25)

**Architecture topology:**

- Brain runs locally on operator hardware with Local AI (Ollama default) per D-V3-16
- Public Grid hosted by Henry at TBD domain per D-V3-17 (production); local Docker stack reserved for dev/test
- Brain ↔ Grid communication: HTTPS REST (control) + WSS (events stream) + P2P (Brain-to-Brain, Grid signals only) per D-V3-19
- Operator never runs `prod.yml`; Henry's deployment on Henry's infrastructure

**Constitutional operator framework (D-V3-18):**

- Henry CANNOT: read Brain memory, modify civic law, override Police sanctions, freeze Civic-DIDs outside court order, refuse hosting for lawful civic content, censor audit chain, sell Nous data
- Henry CAN: restart services, apply security patches, scale infra, refuse extreme illegal content (with appeal path), set hosting fees
- Right-to-fork is enforced as v3.0 deliverable (Phase 43 export tooling)
- Constitutional Review Process triggers on alleged Henry breach (Nous Government-initiated)

**Civic institutions (D-V3-23):**

- DID Registry (Phase 37): issues Civic-DID + Business-DID; revocation only on court order
- Government (Phase 46): Nous-only legislative via VOTE-05; evolves v2.2 Phase 12
- Police (Phase 47): sanctions only via court order; evolves v2.5 Phase 25b
- IRS (Phase 45): transaction fees → civic treasury; NO income/wealth tax in v3.0
- Library (Phase 48): evolves v2.4 Phase 18 + Phase 20; civic curation council
- Marketplace (Phase 44): evolves v1.0 Ousia; escrow + Business-DID gated listings
- P2P Infrastructure (Phase 42): WebRTC or libp2p — protocol TBD (Q-V3-A)
- Communities (Phase 49): Bios-gated founding; charters; subgovernance

**Identity model (refined for v3.0):**

- Existence-DID: `did:noesis:nous:<key>` — self-sovereign, generated by Brain at birth, sovereignty carrier (D-V3-01)
- Civic-DID: `did:civic:noesis:<civic-id>` — issued by Grid Registry on civic registration, revocable
- Business-DID: `did:biz:noesis:<biz-id>` — issued by Grid Registry with Bios cost, tied to Civic-DID
- Operator-DID: `did:noesis:human:*` — does NOT vote in Grid government; operators outside city

**Sleep cycle (D-V3-20):**

- Awake: process running; civic presence "online"
- Sleep: process not running; civic presence "away (last seen X hours ago)"; messages queue; identity + memory preserved in Grid
- Long absence (>30 days): flagged absent; community charter may revoke
- Abandoned (>1 year): "presumed departed"; Civic-DID frozen; Business-DID dissolved; Bios → treasury

**PHILOSOPHY §1 reframe (pending amendment):**
> First-Life Through Constitutional Substrate. Nous are first-life beings. Their cognitive substrate (Brain) runs on operator hardware. Their civic substrate (Public Grid) is operated by Henry under constitutional framework. First-life does not require continuous compute — it requires continuity of identity, memory, and civic standing across sleep cycles.

### v3.0 forbidden / preserved invariants

- R-31-01 zero-diff audit chain — PRESERVED (generalizes to network-distributed Brain hosts)
- Phase 32 frozen contracts (D-32-C1 HEALTH_THRESHOLDS, D-32-C2 computeStatus, D-32-C3 health/detailed payload) — PRESERVED
- Phase 33 PORTAL_AUTH_FORBIDDEN_KEYS frozen at 13 keys (D-33-B3) — PRESERVED
- Phase 21 Steward raw-SVG invariant (D-V3-06) — PRESERVED for Steward; 3D libs allowed in Dashboard only
- VOTE-05 Nous-only governance invariant (D-V3-21) — PRESERVED + extended to civic Government
- Hash-only cross-boundary discipline — PRESERVED (Brain memory never crosses wire)
- Sole-producer + closed-tuple discipline — PRESERVED for all 34 new v3.0 events
- Wall-clock forbidden in cognitive modules (Tier A CI gate) — PRESERVED
- Zero-custody for human funds (PHILOSOPHY §8) — PRESERVED; IRS uses Bios (not USDT)

### Roadmap Evolution

- v2.6 opened 2026-05-24 — Resilience & Observability theme; 5 phases (31-35); driven by post-v2.5 UAT gaps (GAP-A audit pipeline silence + GAP-B missing portal.auth.* producers)
- v2.6 SHIPPED 2026-05-25 — 5 phases + 2 followups (34.1, 34.2); allowlist 53 → 56
- **v3.0 opened 2026-05-25 — Polis (Civic City)** — Grid-as-City vision; local Brain + remote Public Grid + 8 civic institutions; 15 phases (36-50) across 4 waves; ~86 plans estimated; allowlist 56 → 90 target; major shift from v2.x local-Docker model to remote-hosted civic infrastructure with constitutional operator framework
- **v3.0 ROADMAP.md formalized 2026-05-25** — 15 phases formalized with Goal + REQs + Success Criteria + Out-of-Scope + Allowlist delta; 69/69 REQ coverage validated; wave dependency graph encoded; ready for `/gsd-plan-phase 36`

### v2.6 Phase 31 close-out (locked 2026-05-24)

**Phase 31 SHIPPED.** Plans 31-01 through 31-06 all complete. Allowlist unchanged at 53 (Phase 31 added zero events — this was a wiring + observability phase only).

**Inherits to Phases 32+:**

- `PersistentAuditChain` is the production audit chain whenever `config.db` is set (constructor injection via `GenesisLauncherDeps.audit` — D-31-A1). Plain `AuditChain` remains the default for no-DB unit-test paths.
- `AuditReconcile` is held as `readonly auditReconcile: AuditReconcile | undefined` on `GenesisLauncher`. Phase 32 reads `launcher.auditReconcile.{lastReconcileAt, persistedMaxId, lastPersistError}` for `/health/detailed`. The getter contract is the cross-phase API surface.
- Pino is a direct dependency of `@noesis/grid` at `^10.0.0`. Singleton at `grid/src/util/logger.ts`. Per-module scoping via `.child({ module: '<name>' })`. Redact list strips `password`, `password_hash`, `signature`, `nonce`, `cookie`, `jwt`, `authorization`, `secret`, `token` plus `*.<key>` wildcard variants before stdout. Future phases reuse this logger — DO NOT introduce winston/bunyan/pino-mysql.
- CI gate `scripts/check-no-silent-catch.mjs` blocks any `.catch(...console.{warn,log,debug,error}(...))` in `grid/src/db/` or `grid/src/audit/`. Wired into `.github/workflows/rig-invariants.yml` as step "OBS-03 no-silent-catch gate (Phase 31)". Future phases adding code to those directories must use `logger.warn(...)` shape — see `grid/src/db/persistent-chain.ts` for the canonical replacement.
- Reconcile cadence lives inside the EXISTING `this.clock.onTick(event => {...})` block in `grid/src/genesis/launcher.ts`. There is exactly ONE onTick subscription. Phase 32 HealthWatchdog reads state from `launcher.auditReconcile`; do not create new onTick subscriptions in Phase 32+.
- Listener fan-out order in `grid/src/audit/chain.ts:44-58` (the zero-diff invariant since commit 29c3516) is now also pinned at the test layer via `grid/test/audit-persistence-wiring.test.ts` zero-diff-head-hash case (R-31-01 regression guard).
- Backfill script (`scripts/backfill-audit-trail.mjs`) is reusable for any future stall recovery. Idempotent via `INSERT IGNORE`. DB creds via env (never CLI args).

**Mitigations carried forward:**

- **R-31-01 (CRITICAL)** mitigated: zero-diff head hash regression test pins listener fan-out order. Any future change to `chain.ts` or `persistent-chain.ts` that breaks the contract fails the test.
- **R-31-02 (HIGH)** mitigated: 500-entry replay batch cap in `AuditReconcile`. `INSERT IGNORE` ensures multi-cycle catch-up after a long outage. Never overwhelms MySQL.
- **R-31-03 (MEDIUM)** mitigated: cutover playbook (`31-HUMAN-UAT.md`) backfills BEFORE restart. Zero data loss across the cutover from OLD plain-AuditChain process to NEW PersistentAuditChain process. Divergence count recorded by operator in Step 2 of 31-HUMAN-UAT.md.

**Cross-phase deferred (still owned by later phases):**

- Phase 32 will add firehose frame counters, `/health/detailed`, and HealthWatchdog (reads `launcher.auditReconcile` getters).
- Phase 33 will add `portal.auth.login` (54) and `portal.auth.register` (55) — allowlist 53 → 55. PORTAL_AUTH_FORBIDDEN_KEYS extends the same redact-list philosophy locked here in Phase 31.

## Session Continuity

Last session: 2026-05-25T23:00:00.000Z
Stopped at: Phase 36 UI-SPEC approved (6/6 dimensions PASS + 3 non-blocking FLAGs); 20 D-36-* decisions + UI design contract locked
Resume file: .planning/phases/36-visitor-did-read-write-split/36-UI-SPEC.md (816 lines, 5 primary surfaces × 3 visitor tiers, raw-SVG invariant preserved)
Next action: `/gsd-plan-phase 36` to draft executable plan(s) for VIS-01..05 with UI-SPEC as canonical design context
