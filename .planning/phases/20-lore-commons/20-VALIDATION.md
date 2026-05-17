---
phase: 20
slug: lore-commons
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (Brain) · jest/vitest (Grid) |
| **Config file** | `brain/pyproject.toml` · `grid/package.json` |
| **Quick run command** | `cd brain && uv run pytest tests/ -x -q` / `cd grid && npm test -- --testPathPattern=lore` |
| **Full suite command** | `cd brain && uv run pytest tests/ && cd ../grid && npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command for the subsystem modified
- **After every plan wave:** Run full suite for both Brain and Grid
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 20-W0-01 | 01 | 0 | LORE-01 | T-20-01 | FORBIDDEN_KEY_PATTERN rejects lore_body/lore_content/title_text/summary_text | unit | `cd grid && npm test -- --testPathPattern=broadcast-allowlist` | ⬜ pending |
| 20-W0-02 | 01 | 0 | LORE-02 | T-20-02 | ALLOWLIST_MEMBERS.length === 41 before lore events added | unit | `cd grid && npm test -- --testPathPattern=broadcast-allowlist` | ⬜ pending |
| 20-W1-01 | 02 | 1 | LORE-01 | — | lore_commons MySQL table created via MigrationRunner (version 8) | integration | `cd grid && npm test -- --testPathPattern=migration` | ⬜ pending |
| 20-W1-02 | 02 | 1 | LORE-01 | — | lore_entries FTS5 table created in Brain SQLite | unit | `cd brain && uv run pytest tests/lore/ -x -q` | ⬜ pending |
| 20-W2-01 | 03 | 2 | LORE-01 | T-20-01 | lore.contributed sole-producer emitter (pos 42), closed-tuple {category_tag, content_hash, contributor_did, tick} | unit | `cd grid && npm test -- --testPathPattern=appendLoreContributed` | ⬜ pending |
| 20-W2-02 | 03 | 2 | LORE-02 | T-20-02 | __lore_request:/__lore_response: dispatch in BrainHandler decrypts and verifies sha256 | unit | `cd brain && uv run pytest tests/lore/ -x -q` | ⬜ pending |
| 20-W2-03 | 03 | 2 | LORE-02 | — | lore.cited fires at prompt-build for each injected lore entry | unit | `cd brain && uv run pytest tests/lore/test_cited.py -x -q` | ⬜ pending |
| 20-W2-04 | 03 | 2 | LORE-02 | — | Background lore discovery poll every 30 ticks (asyncio.create_task) | unit | `cd brain && uv run pytest tests/lore/test_discovery.py -x -q` | ⬜ pending |
| 20-W3-01 | 04 | 3 | LORE-03 | T-20-03 | Contribution quota K=3 per epoch enforced at NousRunner before appendLoreContributed | unit | `cd grid && npm test -- --testPathPattern=nous-runner` | ⬜ pending |
| 20-W3-02 | 04 | 3 | LORE-01 | — | lore.cited sole-producer emitter (pos 43), closed-tuple {citing_did, content_hash, tick} | unit | `cd grid && npm test -- --testPathPattern=appendLoreCited` | ⬜ pending |
| 20-W3-03 | 04 | 3 | LORE-01 | — | GET /api/v1/grid/lore returns {entries, total} with category/limit filters | integration | `cd grid && npm test -- --testPathPattern=lore.*route` | ⬜ pending |
| 20-W3-04 | 04 | 3 | LORE-02 | — | citation_count incremented by LoreCitationListener (pure-observer, zero AuditChain.append) | unit | `cd grid && npm test -- --testPathPattern=LoreCitationListener` | ⬜ pending |
| 20-INT-01 | 05 | 3 | LORE-02 | — | Cross-lineage: Nous B cites Nous A lore without prior interaction (4-Nous rig, citation_count ≥ 2) | integration | `cd grid && npm test -- --testPathPattern=lore.*integration` | ⬜ pending |
| 20-ZD-01 | all | all | LORE-01 | — | Zero-diff: AuditChain hash unchanged by adding observer-only LoreCommonsListener | integration | `cd grid && npm test -- --testPathPattern=audit.*zero.*diff` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/tests/lore/` directory — test stubs for LORE-01..03
- [ ] `brain/tests/lore/` directory — test stubs for LoreStore, discovery, cited
- [ ] `grid/tests/lore/appendLoreContributed.test.ts` — closed-tuple + sole-producer test
- [ ] `grid/tests/lore/appendLoreCited.test.ts` — closed-tuple + sole-producer test
- [ ] `grid/tests/lore/LoreCitationListener.test.ts` — pure-observer (zero append calls) test
- [ ] `brain/tests/lore/test_store.py` — LoreStore FTS5 + eviction test
- [ ] `brain/tests/lore/test_discovery.py` — background poll + sha256 verify test
- [ ] `brain/tests/lore/test_cited.py` — prompt-build injection + lore.cited dispatch test

*Existing test infrastructure (pytest, jest) already installed — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lore content never stored at Grid (prose not in MySQL) | LORE-01 | Requires live rig with actual Nous contributing | Run 2-Nous rig, `LORE_CONTRIBUTE` action, inspect `lore_commons` table — must contain only hashes |
| Cross-lineage citation observable | LORE-02 | Requires multi-Nous orchestration across 3+ hops | 4-Nous rig: A contributes, B retrieves from A via whisper, C retrieves from B (not A), C cites at prompt-build; verify `citation_count ≥ 2` in DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
