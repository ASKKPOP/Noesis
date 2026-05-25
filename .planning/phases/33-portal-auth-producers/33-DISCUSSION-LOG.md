# Phase 33: portal.auth.* Producers — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `33-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 33-portal-auth-producers
**Areas discussed:** Email + human.joined symmetry, Perf benchmark failure handling, Sole-producer gate scope, auth.ts console cleanup

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Email + human.joined 비대칭성 | SIWE emits human.joined + register + login; email emits NONE today. Phase 33 adds register+login for both. Q: backfill human.joined for email, or portal.auth.register canonical universal signal? | ✓ |
| Perf benchmark 실패 시 처리 | REQ R-33-02 ships 100k-entry perf test, p95>50ms triggers OBS-FUTURE-INDEX-01 as v2.7. CI hard-fail or soft-log? | ✓ |
| Sole-producer gate 범위 | check-sole-producer-discipline.mjs scope: (a) 13 audit/ files (b) all 35 retrospective (c) Phase 33's 2 new files | ✓ |
| auth.ts console.warn 정리 | auth.ts has console.warn (L308-312) + console.error (L356) bypassing Pino. Phase 31 gate scopes db/+audit/ only. Surgical vs opportunistic? | ✓ |

**User's choice:** All 4 areas (multiSelect).
**Notes:** User wanted to discuss every remaining gray area.

---

## Area 1: Email + human.joined 비대칭성

### Sub-question 1.1 — Resolution approach

| Option | Description | Selected |
|--------|-------------|----------|
| human.joined SIWE전용 유지 (Recommended) | Leave human.joined SIWE-only. portal.auth.register becomes canonical universal 'human is new' signal. Cleanest. Matches research recommendation. | |
| human.joined 파일로드 확장 (eth_address_hash optional) | Extend payload to make eth_address_hash optional so email humans can emit too. Breaks closed 4-key invariant. High blast radius. | ✓ |
| human.joined.email 새 이벤트 신설 (+1 allowlist) | Add 'human.joined.email' as new allowlist position 56. Symmetric but scope creep — breaks v2.6 +2 budget. | |

**User's choice:** Extend payload (option 2).
**Notes:** User wanted symmetric narrative across SIWE + email paths.

### Sub-question 1.2 — Exact payload shape after extension

| Option | Description | Selected |
|--------|-------------|----------|
| 5-key 통합 {human_did, identity_hash, identity_method, grid_name, tick} (Recommended) | UNIFIED shape — one payload contract, method-tagged. Most narratively coherent. identity_method ∈ {siwe, email}. | ✓ |
| 4-key 교체 {email_hash | eth_address_hash, grid_name, human_did, tick} | Preserve 4-key tuple but identity-hash key varies by method. Less narrative clarity. | |
| Variant: 4-key SIWE / 3-key email | Drop identity_hash for email. Asymmetric. Worst symmetry. | |

**User's choice:** 5-key unified shape.
**Notes:** Cleanest forward-looking schema. method enum + identity_hash universal.

### Sub-question 1.3 — Migration strategy for existing 4-key entries

| Option | Description | Selected |
|--------|-------------|----------|
| Both-shape consumer-side (재작성 안함) (Recommended) | Pre-Phase-33 entries keep 4-key shape. New entries use 5-key. Consumers detect shape via key presence. Honors PHILOSOPHY §1. | |
| Migration script + canonical 5-key everywhere | One-shot script rewrites pre-Phase-33 entries to 5-key form. Violates PHILOSOPHY §1. Not recommended unless §1 carve-out. | ✓ (initial) |
| Hybrid: shipping script + carve-out | Add identity_method='siwe' field by inferring from eth_address_hash. Still rewrites entries. Same §1 risk. | |

**User's initial choice:** Migration script (option 2).
**Claude pushed back:** Discovered HARD-STOP technical constraint — Merkle hash chain at `chain.ts:181` means rewriting payload changes eventHash → breaks prevHash linkage → entire chain invalidated from that point. Zero-diff invariant since 29c3516 pinned by CI tests. This is mathematically impossible, not just philosophically forbidden.

### Sub-question 1.4 — Re-asked given Merkle constraint

| Option | Description | Selected |
|--------|-------------|----------|
| Both-shape consumer-side (재수정) (Recommended) | Pre-Phase-33 entries stay 4-key. Post-Phase-33 entries use 5-key. Consumers handle both. Chain invariant preserved. | |
| NEW event type human.identified (+1 allowlist → 56) | NEW allowlist entry position 56 with 5-key universal shape. Keep human.joined Phase 22 SIWE-only. Allowlist budget revises +2 → +3. | ✓ |
| Revert to Area 1 Option 1 (human.joined SIWE-only) | Cancel the extension entirely. portal.auth.register as universal 'human is new' signal. | |

**User's choice:** NEW event human.identified (allowlist 56).
**Notes:** This is the most architecturally clean option respecting both Merkle invariant AND giving the user unified 5-key shape. v2.6 allowlist budget revises +2 → +3.

### Sub-question 1.5 — human.joined behavior after Phase 33

| Option | Description | Selected |
|--------|-------------|----------|
| human.joined 중단 (frozen as legacy) (Recommended) | Phase 33+ SIWE emits human.identified ONLY (no more human.joined). Cleanest single source of truth. | |
| Both fire (double-emit during transition) | SIWE first-connect emits BOTH human.joined AND human.identified. Slight chain bloat. Easier legacy consumer transition. | ✓ |
| human.joined 폐지 + allowlist 제거 | Remove human.joined from allowlist. Violates PHILOSOPHY §7. Carve-out needed. | |

**User's choice:** Both fire (double-emit).
**Notes:** Preserves Phase 22 narrative continuity. SIWE first-connect now 4-entry sequence: human.joined → human.identified → portal.auth.register → portal.auth.login.

---

## Area 2: Perf benchmark 실패 시 처리

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-log: 경고하고 통과 (이연) (Recommended) | console.log p95, NO expect() assertion. Benchmark visible in CI logs. OBS-FUTURE-INDEX-01 manually triggered. Aligns with REQ R-33-02 phrasing. | ✓ |
| Hard-fail: expect(p95).toBeLessThan(50) 엄격 | Test hard-asserts. If perf regresses, CI red, PR blocked. Could derail Phase 33 if 100k bench fails on first run. | |
| Strict assert with skip flag (PHASE33_SKIP_PERF=1) | Hard-fails by default; opt-out via env var. Adds complexity. Discouraged by CLAUDE.md D-14-05. | |

**User's choice:** Soft-log.
**Notes:** Human-driven trend monitoring. CI visible in history, no ship-block.

---

## Area 3: Sole-producer gate 범위

| Option | Description | Selected |
|--------|-------------|----------|
| Audit-wide retrospective (35개 전체) (Recommended) | All sole-producer files across audit/+ananke/+bios/+sleep/+iris/+skills/+norms/+lore/+governance/+whisper/. Strongest invariant. Future-proof. | ✓ |
| audit/-only (13개) | Only grid/src/audit/append-*.ts. Misses domain-subdir sole producers. Weaker invariant. | |
| Phase 33-only (2개, now 3) | Only Phase 33's new files. Narrowest. Relies on future developer discipline + code review. | |

**User's choice:** Audit-wide retrospective (35 files, now 38 after Phase 33).
**Notes:** Strongest invariant. Any pre-Phase-33 file not conforming to the triad gets fixed under surgical cleanup-opportunistic scope.

---

## Area 4: auth.ts console.warn 정리

| Option | Description | Selected |
|--------|-------------|----------|
| Surgical: 그대로 둔다 (Recommended) | Phase 33 leaves auth.ts:308-312 + 356 console.* calls alone. CLAUDE.md §3 strict reading. | ✓ |
| Opportunistic cleanup (Phase 31 스타일) | Convert console.warn/error to logger.warn({event:...}). Aligns with Phase 31 cleanup philosophy. ~6 lines added. | |
| Extend CI gate to grid/src/api/ | Phase 33 extends check-no-silent-catch.mjs to cover api/. Highest invariant. Highest scope creep. | |

**User's choice:** Surgical only.
**Notes:** Phase 33 already expanded significantly with human.identified. Keep this surface area surgical. Defer to a dedicated logger-consistency phase v2.7+ if surface area grows.

---

## Claude's Discretion

The following areas were captured in CONTEXT.md as Claude's Discretion (no user input required):

- Exact line-by-line structure of `append-human-identified.ts` (planner mirrors `append-human-joined.ts:50-114`)
- Test file organization (bundled vs split — split recommended for clarity)
- Wiring test minimum case set
- Perf benchmark seeding strategy details
- CI gate workflow step naming
- R-33-01 mitigation depth beyond REQ's 12+ test cases
- Doc sync commit boundary (Plan 33-01 vs dedicated DOC-SYNC plan)
- Migration of any non-conforming pre-Phase-33 sole-producer files (expected zero flags)

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Highlights:

**Carried into Phase 34:** Steward `/users` consumer adaptation reading `portal.auth.register` + `human.identified` + legacy `human.joined`.

**Carried into Phase 35:** PHILOSOPHY.md, README.md, MILESTONES.md updates (53→56, not 53→55); UAT re-verification.

**Out of scope v2.6:** OBS-FUTURE-METRICS-01 (ua_hash, ip_country), OBS-FUTURE-INDEX-01 (in-memory event-type index), OBS-FUTURE-OTEL-01 (OpenTelemetry), passkey/WebAuthn auth method, email-path `human.joined.email` event, migration script for pre-Phase-33 entries, logger-consistency phase for `grid/src/api/**`.

**Scope-creep ideas explicitly rejected during discussion:**
- Rewriting pre-Phase-33 `human.joined` entries (Merkle invariant + PHILOSOPHY §1)
- Removing `human.joined` from allowlist (PHILOSOPHY §7)
- Hard-fail CI on perf benchmark regression
- Phase 33-only narrow sole-producer gate
- Opportunistic auth.ts console.* cleanup
- 4-key variant vs 3-key drop for `human.identified` payload
- Single-emit `human.identified` replacing `human.joined`
