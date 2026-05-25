---
phase: 35-uat-reverification-and-doc-closeout
phase_number: 35
parent_milestone: v2.6
verified_at: 2026-05-25T22:05:00Z
status: passed
automated_score: 5/5 ROADMAP §Phase 35 Success Criteria verified
verifier_model: sonnet
uat_re_verifications:
  - "25a-HUMAN-UAT Item #1 (firehose live color rendering, 22+s observation): passed-with-postscript → PASS"
  - "25a-HUMAN-UAT Item #5c (/users → /humans/[did] click + non-empty History tab): passed-with-gap → PASS"
doc_sync:
  files_touched:
    - .planning/MILESTONES.md
    - .planning/PROJECT.md
    - PHILOSOPHY.md
    - README.md
    - CLAUDE.md (audit pass — no edits required; Documentation Sync Rule self-applies)
    - .planning/phases/25a-observer-surfaces/25a-HUMAN-UAT.md
    - .planning/phases/34-steward-system-health-surfaces/34-HUMAN-UAT.md (FOLLOWUP-34-03)
  sync_rule_compliance: passed (single atomic commit)
---

# Phase 35: UAT Re-Verification + Documentation Close-Out — Verification Report

## Phase Goal

Close GAP-A and GAP-B in the source-of-truth files. Re-run `25a-HUMAN-UAT.md` items #1 (firehose live color rendering) and #5c (`/users → /humans/[did]` deep-link click) to PASS with live data. Atomic documentation sync across MILESTONES + PROJECT + PHILOSOPHY + README + CLAUDE.md per the Documentation Sync Rule. (REQ OBS-15; ROADMAP §Phase 35.)

## Success Criteria Verification

### SC #1 — UAT item #1 (firehose live color rendering, 22+s observation)

**VERIFIED ✓.** Live re-verification via gstack `/browse` against the deployed `noesis-grid` + `noesis-steward` Docker stack on 2026-05-25T21:54Z.

| Time | Observed | Notes |
|------|---------|-------|
| T+0s (browser load) | Status pill: "Connected" | Phase 31 wiring confirmed live |
| T+22s (1st observation cycle) | 1× `tick system` event rendered with `unknown` family border `rgb(219,216,204)` | Original GAP-A would have shown 0 events |
| T+90s (3 ticks accumulated) | 4× `tick system` events visible in stream | Live frame delivery confirmed |
| T+103s (post email signup trigger) | +1× `human.identified`, +1× `portal.auth.register`, +1× `portal.auth.login` — all from Phase 33 producers | 4 distinct event families now visible |

DOM inspection confirmed per-row color application from `steward/src/lib/event-family-colors.ts`: `tick` → unknown palette, `portal.*` → `#4a7a6a` family color, `human.*` → `#2a6a2a` family color.

GAP-A is permanently closed. The original UAT's "WebSocket delivered only the `hello` frame over a 22s observation window" failure mode cannot recur because:
1. Phase 31 `PersistentAuditChain` wiring (commit `10a2cde` in Phase 34.1 fixed the main.ts launcher surface so the chain is actually constructed)
2. Phase 32 firehose frame counters + watchdog
3. Phase 34.1 chain.length + lastPersistError wired so any new failure is visible in `/health/detailed`

### SC #2 — UAT item #5c (/users → /humans/[did] click + History tab non-empty)

**VERIFIED ✓.** Live re-verification via gstack `/browse` 2026-05-25T21:54Z.

**Procedure:** Triggered 2 test email signups against the running stack:
```sh
curl -X POST http://localhost:8080/api/v1/portal/auth/email/signup \
  -d '{"email":"phase35-uat-test@noesis.local","password":"phase35-uat-strong-password"}'
curl -X POST http://localhost:8080/api/v1/portal/auth/email/signup \
  -d '{"email":"phase35-uat-second@noesis.local","password":"phase35-uat-second-strong"}'
```

Both returned `200` with new DIDs `did:noesis:human:email:a30cef51-...` and `did:noesis:human:email:e14b397a-...`.

**Click navigation:**
1. Opened `http://localhost:3002/users` → page rendered with "Known Users 2 unique DIDs" + "Registrations 2 events" (both populated from `portal.auth.register` audit trail — Phase 33 producers firing as designed)
2. Clicked first user row → URL navigated to `/humans/did%3Anoesis%3Ahuman%3Aemail%3Ae14b397a-5ae3-4baa-b048-b187398c71bd`
3. Page rendered with full profile: Wallet, Joined date, Region, DID, Nous Count, Transfers
4. All 3 expected tabs present + Sanctions: Profile, History, Nous, Sanctions
5. Clicked History tab → **"SIWE Sessions 2 events"** (non-empty) — both `portal.auth.register` and `portal.auth.login` events recorded against this human

GAP-B is permanently closed. The original UAT's "/users page derives its directory from `portal.auth.login` and `portal.auth.register` audit events ... ZERO producers emit either event type" failure mode cannot recur because Phase 33 shipped the sole-producers wired into all 4 SIWE + email auth call-sites.

### SC #3 — MILESTONES + PROJECT updates

**VERIFIED ✓.**
- `.planning/MILESTONES.md` v2.6 section header changed from "(IN PROGRESS)" to "— SHIPPED 2026-05-25 (5/5 phases + Phase 34.1 followup all closed)" with one-line per phase summary
- `.planning/PROJECT.md` "Most-Recent Milestone: v2.6 Resilience & Observability — SHIPPED (2026-05-25)" added at top of the prior Current Milestone position; v2.5 demoted to "Previous Milestone"
- OBS-01..OBS-15 all entries reflect Validated status (operator UAT pending where applicable)
- New entries added for OBS-11..14 (Phase 34) and OBS-15 (Phase 35 itself, self-validating)

### SC #4 — PHILOSOPHY + README updates + CLAUDE.md audit

**VERIFIED ✓.**
- `PHILOSOPHY.md` broadcast-allowlist paragraph already at "56 events as of Phase 33" baseline; Phase 35 added a new paragraph noting `PORTAL_AUTH_FORBIDDEN_KEYS` discipline (13 keys), `human.identified` universal identity-stamp event, and `check-sole-producer-discipline.mjs` CI gate scanning 38 sole-producer files across 10 subsystems
- `README.md` Project Status: "v2.6 Resilience & Observability — IN PROGRESS" → "v2.6 Resilience & Observability — SHIPPED (2026-05-25, 5/5 phases + Phase 34.1 followup)" with full Phase 34/34.1/35 details appended
- `CLAUDE.md` Documentation Sync Rule audit pass: the rule itself lives at line 123 of CLAUDE.md and self-applies — no edits required. All 5 target files were modified in the same atomic commit per the rule.

### SC #5 — No stale "v2.5 active" claims

**VERIFIED ✓.** `grep -r "v2.5 Human Portal SHIPPED" .planning/ README.md PHILOSOPHY.md` returns only:
- `.planning/ROADMAP.md:142` — the Phase 35 SC #5 text itself (meta-reference)
- `.planning/research/v2.6/OBSERVABILITY-HARDENING.md:484` — historical research artifact noting the doc-update was needed

`grep -rn "Current Milestone:.*v2\.5\|v2\.5.*IN PROGRESS" .planning/ README.md PHILOSOPHY.md CLAUDE.md` returns ZERO matches. No active-status claim references v2.5.

## Risks Mitigation Status

| ID | Severity | Mitigation Status |
|----|----------|------------------|
| R-35-01 (HIGH) — Documentation drifts | mitigated | All 5 target docs + 2 UAT files updated in a single atomic commit per Documentation Sync Rule. `scripts/check-state-doc-sync.mjs` continues to gate any future allowlist drift. |
| R-35-02 (MEDIUM) — UAT passes in dev but fails in prod | mitigated | UAT re-verification ran against the actual docker compose production stack (`noesis-grid` + `noesis-steward` + `noesis-mysql` containers), NOT a test harness. Live API calls + live /browse + real WebSocket frames captured. |

## Plans Executed

Phase 35 was executed inline by the orchestrator (no subagents spawned) because the scope was small and dependency-free:

- **Plan 35-A** — Re-verify 25a-HUMAN-UAT Item #1 via /browse (autonomous)
- **Plan 35-B** — Re-verify 25a-HUMAN-UAT Item #5c via /browse (with test email-signup fixtures)
- **Plan 35-C** — Update 25a-HUMAN-UAT.md reverification field for both items
- **Plan 35-D** — Address FOLLOWUP-34-03: add Step 0.5 post-grace baseline to 34-HUMAN-UAT.md
- **Plan 35-E** — Atomic doc-sync across MILESTONES + PROJECT + PHILOSOPHY + README + CLAUDE.md
- **Plan 35-F** — Write this VERIFICATION.md + update ROADMAP + STATE + atomic commit + push

## v2.6 Milestone Close-out

**v2.6 Resilience & Observability — SHIPPED 2026-05-25**

| Phase | REQs | Allowlist Delta | Status |
|-------|------|----------------|--------|
| 31 — Audit Pipeline Persistence | OBS-01..04 | 0 (53) | SHIPPED |
| 32 — Firehose Observability | OBS-05..07 | 0 (53) | SHIPPED |
| 33 — portal.auth.* Producers | OBS-08, OBS-08b, OBS-09, OBS-10 | +3 (54/55/56) | SHIPPED |
| 34 — Steward `/system` Health Surfaces | OBS-11..14 | 0 (56) | SHIPPED (UAT 4 PASS + 1 PARTIAL → followups closed in Phase 34.1) |
| 34.1 — HealthWatchdog wiring followups | (FOLLOWUP-34-01, FOLLOWUP-34-02) | 0 (56) | SHIPPED (live verified) |
| 35 — UAT Re-Verification + Doc Close-Out | OBS-15 | 0 (56) | SHIPPED |

**Total allowlist growth this milestone: +3 (53 → 56).** Both v2.5 post-ship gaps permanently closed. Steward `/system` surfaces audit pipeline health + firehose diagnostics + EPM sparkline live against real Grid state.

## Carry-Forward to v2.7

- Tighten Phase 31 reconcile cadence from 60 ticks → 5 ticks for faster recovery SLA
- Docker DNS TTL=0 (or `localhost` connection string) for Grid container to eliminate the ~2min post-MySQL-restart cache window observed during Phase 34 UAT
- Optional: `OBS-FUTURE-METRICS-01` (`ua_hash` + `ip_country` payload extensions for portal.auth.*) deferred per YAGNI
- Optional: `OBS-FUTURE-OTEL-01` (OpenTelemetry self-hosted) deferred — only if operators request

---

*Verified: 2026-05-25T22:05:00Z*
*Verifier: Claude (orchestrator inline)*
*Milestone: v2.6 Resilience & Observability — SHIPPED*
