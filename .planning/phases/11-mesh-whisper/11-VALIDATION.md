---
phase: 11
slug: mesh-whisper
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-23
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `11-RESEARCH.md` §10 (Validation Architecture). Two-framework
> phase: Grid (vitest) + Brain (pytest). Zero-diff regression required.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Grid framework** | vitest (existing — `grid/vitest.config.ts`) |
| **Grid quick run** | `cd grid && npx vitest run test/whisper/ --reporter=dot` |
| **Grid full suite** | `cd grid && npm test` |
| **Brain framework** | pytest (existing — `brain/pyproject.toml` `[tool.pytest.ini_options]`) |
| **Brain quick run** | `cd brain && pytest test/ -k whisper -x` |
| **Brain full suite** | `cd brain && pytest test/` |
| **CI gates** | `node scripts/check-whisper-plaintext.mjs`, `node scripts/check-wallclock-forbidden.mjs`, `node scripts/check-state-doc-sync.mjs`, `node scripts/check-whisper-runtime-writes.mjs` |
| **Estimated runtime** | Grid ~25s · Brain ~12s · CI gates ~3s · full ~40s |

---

## Sampling Rate

- **After every task commit:** `cd grid && npx vitest run test/whisper/ --reporter=dot` (grid tasks) OR `cd brain && pytest test/ -k whisper -x` (brain tasks)
- **After every plan wave:** `cd grid && npm test && cd ../brain && pytest test/ && node scripts/check-state-doc-sync.mjs && node scripts/check-wallclock-forbidden.mjs && node scripts/check-whisper-plaintext.mjs`
- **Before `/gsd-verify-work`:** full suite green + `scripts/check-whisper-runtime-writes.mjs` passes + zero-diff regression hash verified
- **Max feedback latency:** ~40 s (full suite); ~5 s (per-task quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-W0-01 | 00-setup | 0 | WHISPER-04 | T-10-04 | allowlist position 22 = `nous.whispered`, array length 22 | static | `cd grid && npx vitest run test/audit/broadcast-allowlist.test.ts` | ⚠️ exists; bump required | ⬜ |
| 11-W0-02 | 00-setup | 0 | WHISPER-03 | T-10-01 | producer-boundary RED stub compiles & fails | static | `cd grid && npx vitest run test/whisper/whisper-producer-boundary.test.ts` | ❌ W0 | ⬜ |
| 11-W0-03 | 00-setup | 0 | WHISPER-01/05/06 | — | crypto/wire/rate-limit RED stubs present | unit | `cd grid && npx vitest run test/whisper/` | ❌ W0 | ⬜ |
| 11-W0-04 | 00-setup | 0 | WHISPER-04 | T-10-01 | state-doc-sync literal+array bump recognises `nous.whispered` | static | `node scripts/check-state-doc-sync.mjs` | ⚠️ extend | ⬜ |
| 11-W0-05 | 00-setup | 0 | WHISPER-02 | T-10-03 | wall-clock-forbidden roots extended to whisper trees | static | `node scripts/check-wallclock-forbidden.mjs` | ⚠️ extend | ⬜ |
| 11-W1-01 | 01-crypto | 1 | WHISPER-01 | T-10-01 | deterministic keypair from SHA256(DID)[:32] | unit | `cd grid && npx vitest run test/whisper/whisper-crypto.test.ts` | ❌ W1 | ⬜ |
| 11-W1-02 | 01-crypto | 1 | WHISPER-01 | T-10-01 | nonce = blake2b(seed‖tick_le64‖counter_le32)[:24] | unit | `cd grid && npx vitest run test/whisper/whisper-crypto.test.ts -t nonce` | ❌ W1 | ⬜ |
| 11-W1-03 | 01-crypto | 1 | WHISPER-01 | T-10-01 | JS↔Python roundtrip byte-compat via `crypto_box_seed_keypair` | integration | `cd brain && pytest test/test_whisper_roundtrip.py -x` | ❌ W1 | ⬜ |
| 11-W1-04 | 01-crypto | 1 | WHISPER-01 | T-10-04 | keyring seeded via bios.birth listener | unit | `cd grid && npx vitest run test/whisper/whisper-keyring.test.ts` | ❌ W1 | ⬜ |
| 11-W2-01 | 02-emitter | 2 | WHISPER-03 | T-10-01 | `appendNousWhispered` sole producer, closed-tuple payload | unit | `cd grid && npx vitest run test/whisper/whisper-wire-format.test.ts` | ❌ W2 | ⬜ |
| 11-W2-02 | 02-emitter | 2 | WHISPER-03 | T-10-01 | producer-boundary grep passes (only emitter+allowlist+consumer) | static | `cd grid && npx vitest run test/whisper/whisper-producer-boundary.test.ts` | ❌ W0→W2 | ⬜ |
| 11-W2-03 | 02-router | 2 | WHISPER-01/06 | T-10-04 | Router: encrypt → audit.append → in-memory ciphertext Map | unit | `cd grid && npx vitest run test/whisper/whisper-router.test.ts` | ❌ W2 | ⬜ |
| 11-W2-04 | 02-router | 2 | — | T-10-04 | Tombstone-respect: post-death whisper silently dropped | unit | `cd grid && npx vitest run test/whisper/whisper-tombstone.test.ts` | ❌ W2 | ⬜ |
| 11-W2-05 | 02-rate-limit | 2 | WHISPER-05 | — | Tick-indexed B=10 / N=100 per-sender budget | unit | `cd grid && npx vitest run test/whisper/whisper-rate-limit.test.ts` | ❌ W0→W2 | ⬜ |
| 11-W2-06 | 02-rate-limit | 2 | WHISPER-05 | — | `@fastify/rate-limit` seconds-based DDoS belt engaged | unit | `cd grid && npx vitest run test/whisper/whisper-rate-limit.test.ts -t fastify` | ❌ W2 | ⬜ |
| 11-W3-01 | 03-api | 3 | WHISPER-01/06 | T-10-04 | POST `/whisper/send` encrypts & queues ciphertext | integration | `cd grid && npx vitest run test/whisper/whisper-api.test.ts -t send` | ❌ W3 | ⬜ |
| 11-W3-02 | 03-api | 3 | WHISPER-06 | T-10-04 | GET `/whisper/pull` returns pending + ack deletes | integration | `cd grid && npx vitest run test/whisper/whisper-api.test.ts -t pull` | ❌ W3 | ⬜ |
| 11-W3-03 | 03-api | 3 | WHISPER-05 | — | queue-length metric endpoint (counts-only) | integration | `cd grid && npx vitest run test/whisper/whisper-api.test.ts -t metric` | ❌ W3 | ⬜ |
| 11-W3-04 | 03-brain | 3 | WHISPER-01 | T-10-01 | Brain decrypts pulled envelope, returns plaintext to Nous runtime | integration | `cd brain && pytest test/test_whisper_decrypt.py -x` | ❌ W3 | ⬜ |
| 11-W3-05 | 03-aggregator | 3 | WHISPER-03 | T-10-01 | DialogueAggregator ingests `channel='whisper'` hash-only | unit | `cd brain && pytest test/test_dialogue_aggregator_whisper.py -x` | ❌ W3 | ⬜ |
| 11-W3-06 | 03-trade-guard | 3 | — | T-10-06 | Whisper-as-trade covert channel rejected pre-encrypt | unit | `cd brain && pytest test/test_whisper_trade_guard.py -x` | ❌ W3 | ⬜ |
| 11-W4-01 | 04-ci-gates | 4 | WHISPER-02 | T-10-03 | Three-tier plaintext grep (grid/brain/dashboard) returns 0 hits | static | `node scripts/check-whisper-plaintext.mjs` | ❌ W4 | ⬜ |
| 11-W4-02 | 04-ci-gates | 4 | WHISPER-02 | T-10-03 | Runtime `fs.writeFile` monkey-patch sees zero plaintext bytes | runtime | `cd grid && npx vitest run test/whisper/whisper-plaintext-fs-guard.test.ts` | ❌ W4 | ⬜ |
| 11-W4-03 | 04-dashboard | 4 | — | T-10-03 | Fourth protocol mirror + SYNC drift detector | unit | `cd dashboard && npm test -- whisper-protocol` | ❌ W4 | ⬜ |
| 11-W4-04 | 04-dashboard | 4 | — | T-10-03 | UI counts-only panel (no whisper-read RPC) | static | `node scripts/check-whisper-plaintext.mjs` (dashboard tree) | ❌ W4 | ⬜ |
| 11-W4-05 | 04-determinism | 4 | — | — | Zero-diff audit chain: replay hash identical across 2 seeds × 2 runs | regression | `cd grid && npx vitest run test/whisper/whisper-determinism.test.ts` | ❌ W4 | ⬜ |
| 11-W4-06 | 04-privacy-matrix | 4 | WHISPER-02 | T-10-03 | 16-case privacy matrix: all tiers × probes return opaque | unit | `cd grid && npx vitest run test/whisper/whisper-privacy-matrix.test.ts` | ❌ W4 | ⬜ |
| 11-W4-07 | 04-closeout | 4 | WHISPER-04 | T-10-01 | state-doc-sync + full suite green | integration | `cd grid && npm test && cd ../brain && pytest test/ && node scripts/check-state-doc-sync.mjs` | ⬜ | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Continuity check:** every task ID above has an `<automated>` command. No 3 consecutive tasks without automated verify. ✅

---

## Wave 0 Requirements

- [ ] `grid/test/whisper/` — directory creation
- [ ] `grid/test/whisper/whisper-producer-boundary.test.ts` — RED stub (clone of `bios-producer-boundary.test.ts`)
- [ ] `grid/test/whisper/whisper-crypto.test.ts` — RED stub (keypair + nonce determinism)
- [ ] `grid/test/whisper/whisper-wire-format.test.ts` — RED stub (closed-tuple shape)
- [ ] `grid/test/whisper/whisper-rate-limit.test.ts` — RED stub (B=10 / N=100)
- [ ] `grid/src/audit/broadcast-allowlist.ts` — add `'nous.whispered'` at position 22 (index 21)
- [ ] `scripts/check-state-doc-sync.mjs` — extend literal set + array-length bump to 22
- [ ] `scripts/check-wallclock-forbidden.mjs` — extend roots to `grid/src/whisper/**`, `brain/src/noesis_brain/whisper/**`, `dashboard/src/whisper/**`
- [ ] Dependency stubs noted (install in W1): `libsodium-wrappers@^0.8.4` (grid), `pynacl>=1.6.2,<2` (brain)

*Brain/Python Wave 0 stubs land alongside W1 crypto install (PyNaCl not installable before `uv add`).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard counts-only UI renders without whisper-read affordance | WHISPER-02 (T-10-03 UI anti-feature) | Visual absence; a regression is a *new* button, not a broken one | Open Dashboard at H1+ tier; confirm "whisper queue count" panel visible, zero read/inspect affordance even disabled |
| Operator at H5 cannot coerce plaintext via console/debug | WHISPER-02 | Exhaustive adversarial console probes not automatable without enumerating every possible RPC | H5 operator: in Dashboard devtools, attempt `fetch('/api/v1/operator/whisper/read', …)` variants; confirm no endpoint exists |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (new test files, script extensions, allowlist bump)
- [x] No watch-mode flags (all commands are `vitest run` / `pytest`, no `--watch`)
- [x] Feedback latency < 60 s (measured ~40 s full suite)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (auto-advance `/gsd-plan-phase 11 --auto` will propagate to gsd-planner)
