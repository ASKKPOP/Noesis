---
phase: 27
slug: nous-interaction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (dashboard), jest (grid), pytest (brain) |
| **Config file** | `dashboard/vitest.config.ts`, `grid/jest.config.ts`, `brain/pytest.ini` |
| **Quick run command** | `cd dashboard && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `cd grid && npx jest --runInBand 2>&1 | tail -30 && cd ../dashboard && npx vitest run 2>&1 | tail -30` |
| **Estimated runtime** | ~45 seconds (grid ~20s, dashboard ~25s) |

---

## Sampling Rate

- **After every task commit:** Run `cd dashboard && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run full suite (grid + dashboard)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Brain skill endpoint | 01 | 1 | CHAT-06 | — | msg_hash key never contains message substring | unit | `cd brain && python -m pytest tests/ -k "skill" -x 2>&1 | tail -20` | ❌ W0 | ⬜ pending |
| appendHumanSpoke | 01 | 1 | CHAT-04 | — | msg_hash payload key (not message_hash); plain text never in payload | unit | `cd grid && npx jest --testPathPattern="human-spoke" --runInBand 2>&1 | tail -20` | ❌ W0 | ⬜ pending |
| Grid chat endpoint | 01 | 1 | CHAT-01, CHAT-02 | — | POST /portal/chat/nous/:nousId proxies to Ollama, returns {reply, done} | integration | `cd grid && npx jest --testPathPattern="chat" --runInBand 2>&1 | tail -20` | ✅ | ⬜ pending |
| Chat page UI | 02 | 2 | CHAT-01 | — | NousSidebar renders 3 Nous cards; ConversationPane renders | unit | `cd dashboard && npx vitest run --reporter=verbose src/app/portal/chat 2>&1 | tail -30` | ❌ W0 | ⬜ pending |
| localStorage history | 02 | 2 | CHAT-01 | — | history persisted under noesis:chat:{humanDid}:{nousDid} key | unit | `cd dashboard && npx vitest run --reporter=verbose src/app/portal/chat 2>&1 | tail -30` | ❌ W0 | ⬜ pending |
| Tip flow | 03 | 2 | CHAT-05 | — | wagmi send triggered only on Confirm; amount validated before enable | unit | `cd dashboard && npx vitest run --reporter=verbose src/app/portal/chat/TipPanel 2>&1 | tail -20` | ❌ W0 | ⬜ pending |
| Nous profile page | 04 | 3 | CHAT-06 | — | /portal/nous/[id] renders HeroCard + 3 tabs; unknown ID shows "Nous not found." | unit | `cd dashboard && npx vitest run --reporter=verbose src/app/portal/nous 2>&1 | tail -30` | ❌ W0 | ⬜ pending |
| Skills tab | 04 | 3 | CHAT-06 | — | Brain lookup failure shows truncated hash fallback | unit | `cd dashboard && npx vitest run --reporter=verbose src/app/portal/nous 2>&1 | tail -30` | ❌ W0 | ⬜ pending |
| Lore tab | 04 | 3 | CHAT-06 | — | expand/collapse works; Load More shown when cursor returned | unit | `cd dashboard && npx vitest run --reporter=verbose src/app/portal/nous 2>&1 | tail -30` | ❌ W0 | ⬜ pending |
| Allowlist count | 01 | 1 | CHAT-04 | — | human.spoke at position 52; BROADCAST_ALLOWLIST.length === 52 | unit | `cd grid && npx jest --testPathPattern="allowlist" --runInBand 2>&1 | tail -20` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/src/audit/__tests__/append-human-spoke.test.ts` — unit tests for appendHumanSpoke sole-producer discipline (msg_hash key, closed-tuple, EXPECTED_KEYS sort)
- [ ] `dashboard/src/app/portal/chat/__tests__/NousSidebar.test.tsx` — renders 3 cards, selected state, status dot
- [ ] `dashboard/src/app/portal/chat/__tests__/ConversationPane.test.tsx` — auto-greeting fires on fresh conversation; no greeting re-fire on history load
- [ ] `dashboard/src/app/portal/chat/__tests__/TipPanel.test.tsx` — preset selection, custom input, confirm disabled when no amount
- [ ] `dashboard/src/app/portal/nous/__tests__/ProfilePage.test.tsx` — HeroCard, TabBar, unknown Nous ID fallback
- [ ] `brain/tests/test_skill_store_lookup.py` — get_by_hash() returns {name, description}; missing hash returns 404

*Existing infrastructure (vitest, jest, pytest) covers the phase — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auto-greeting LLM call fires on fresh conversation | CHAT-01, CHAT-02 | Requires live Ollama + Grid + portal stack | Select a Nous in /portal/chat with empty localStorage; confirm greeting appears within ~3s |
| Cyber Coin tip on-chain transfer | CHAT-05 | Requires MetaMask + test EVM network | Open tip panel, select 1 USDT, click Confirm, approve in MetaMask, confirm system message appears |
| Greeting does NOT re-fire on history load | CHAT-01 | Requires localStorage pre-seeded state | Pre-seed localStorage with messages, reload /portal/chat, confirm no new greeting appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
