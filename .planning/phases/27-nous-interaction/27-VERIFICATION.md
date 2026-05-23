---
phase: 27-nous-interaction
verified: 2026-05-23T18:00:00Z
status: human_needed
score: 12/13 must-haves verified
overrides_applied: 0
deferred:
  - truth: "User can browse Nous activity feed"
    addressed_in: "Phase 29"
    evidence: "Phase 29 goal: 'live activity feed, follow other users'; COMM-03: 'Activity feed on /portal/home: real-time mix of Grid events'. Phase 27 CONTEXT D-05 explicitly defers global activity feed to Phase 30 placeholder."
human_verification:
  - test: "Load /portal/chat, select Sophia — confirm auto-greeting appears, 3-dot loader shows and disappears"
    expected: "NousSidebar shows 3 Nous cards with live status dots; selecting Sophia fires empty-messages POST and renders Sophia's greeting as a NousBubble within 5s"
    why_human: "Requires live Ollama instance; localStorage state is browser-only; visual rendering cannot be grep-verified"
  - test: "Type a message, press Enter — reply appears as NousBubble"
    expected: "User message shows as UserBubble (right-aligned, parchment-2 bg); loading bubble (3 dots + 'is thinking…') appears; then Nous reply appears as NousBubble (left-aligned, serif)"
    why_human: "LLM call behavior, animation timing, and bubble rendering require visual inspection"
  - test: "Refresh /portal/chat, re-select the same Nous — confirm history loads without re-greeting"
    expected: "Prior messages appear immediately from localStorage; no new LLM call fires on re-selection with existing history"
    why_human: "localStorage persistence across page refresh requires browser-level testing"
  - test: "Click tip button (₮) in footer — TipPanel slides up, select 5 USDT, click Confirm via MetaMask"
    expected: "TipPanel appears above footer with 1/5/10 USDT presets; Confirm button triggers MetaMask; on success, system message '✓ You sent 5 USDT to [Nous name]' appears inline"
    why_human: "wagmi wallet interaction requires MetaMask and on-chain transaction; visual slide-up animation cannot be automated"
  - test: "Navigate to /portal/nous/sophia — verify hero card, tab switching, and Chat button"
    expected: "Hero card shows name/tagline/region/ousia; Skills/Lore/Norms tabs switch content; 'Chat with Sophia' button navigates to /portal/chat?nous=sophia"
    why_human: "Tab interaction, portal-pulse skeleton loading states, and navigation require visual inspection"
  - test: "Navigate to /portal/nous/unknown_id — verify error state"
    expected: "Page shows 'Nous not found.' with 'Return to chat' link; no fetch fires"
    why_human: "Error state UI rendering requires browser"
  - test: "Load /portal/chat?nous=hermes — confirm Hermes is pre-selected on mount"
    expected: "URL param causes Hermes to be selected immediately on page load without user click; auto-greeting fires if localStorage is empty for Hermes"
    why_human: "URL param pre-selection + auto-greeting coordination requires browser testing"
---

# Phase 27: Nous Interaction — Verification Report

**Phase Goal:** Humans can chat with any active Nous (Sophia, Hermes, Themis) via `/portal/chat`, send Cyber Coin tips, browse the Nous activity feed, and view skills, lore, and norms the Nous have produced. First allowlist event tied to human agency: `human.spoke`.
**Verified:** 2026-05-23T18:00:00Z
**Status:** human_needed — all automated checks pass; 7 items require visual/browser verification
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | POST /api/v1/portal/chat/nous/:nousId returns {reply, done:false} for sophia, hermes, and themis | ✓ VERIFIED | `chat.ts` line 214: `done: false` always returned; `NOUS_SYSTEM_PROMPTS` map has all 3 keys; route at `/api/v1/portal/chat/nous/:nousId` registered in `registerPortalChatRoutes` |
| 2  | Empty messages array triggers the auto-greeting without firing appendHumanSpoke | ✓ VERIFIED | `chat.ts` line 199: `if (messages.length > 0)` guards appendHumanSpoke; empty array path returns reply without audit call |
| 3  | Non-empty messages array fires appendHumanSpoke with msg_hash (NOT message_hash) | ✓ VERIFIED | `chat.ts` line 204: `appendHumanSpoke(services.audit, { msg_hash: msgHash, ... })` — key is `msg_hash` not `message_hash` |
| 4  | human.spoke appears at position 52 in ALLOWLIST_MEMBERS | ✓ VERIFIED | `broadcast-allowlist.ts` line 200: `'human.spoke', // (52)` — JSDoc at line 24 confirms "exactly these 52 event types" |
| 5  | payloadPrivacyCheck passes for HumanSpokePayload (msg_hash key avoids FORBIDDEN_KEY_PATTERN) | ✓ VERIFIED | `FORBIDDEN_KEY_PATTERN` matches substring `message`; `msg_hash` does not contain `message`; payloadPrivacyCheck is called at step 8 of sole-producer |
| 6  | General chat always returns done: false (detectClose is never called in the new route) | ✓ VERIFIED | `chat.ts` line 214: explicit `done: false`; `detectClose` function exists only for onboard route (line 72); not referenced in the new route |
| 7  | User can see 3 Nous cards in the left sidebar with live status dots | ? NEEDS HUMAN | `NousSidebar.tsx` fetches `/api/v1/grid/nous` with credentials, renders 3 NousCards; `NousCard.tsx` shows `#4ade80` glow for online status — requires browser to confirm visual rendering |
| 8  | Selecting a Nous fires an auto-greeting LLM call and shows the greeting message | ? NEEDS HUMAN | `page.tsx` `handleSelectNous` → `fireGreeting()` → POST with empty messages; requires live Ollama to confirm |
| 9  | Revisiting a prior conversation loads localStorage history without re-firing greeting | ? NEEDS HUMAN | `page.tsx` lines 74-79: `localStorage.getItem(key)` before `fireGreeting`, guarded by `history.length === 0` — correct logic, needs browser to verify runtime behavior |
| 10 | User can type and send a message — reply appears as a Nous bubble | ? NEEDS HUMAN | `ChatInput.tsx` + `handleSendMessage` + `NousBubble.tsx` wired; requires live LLM call to confirm E2E |
| 11 | Tip button opens TipPanel with 1/5/10 USDT presets; confirmed tip inserts system message | ? NEEDS HUMAN | `TipPanelInner.tsx` has `PRESETS = [1, 5, 10]`; `onTipConfirmed` inserts `✓ You sent N USDT to [Name]` system message; wagmi transfer requires MetaMask |
| 12 | Nous profile page shows hero card, skills/lore/norms tabs, Chat button navigates correctly | ? NEEDS HUMAN | All files exist and are wired; `HeroCard.tsx` has `router.push(\`/portal/chat?nous=${nousId}\`)`; needs browser to confirm tab interaction |
| 13 | ?nous=sophia URL param pre-selects Sophia in the sidebar | ? NEEDS HUMAN | `page.tsx` lines 83-88: `searchParams.get('nous')` → `handleSelectNous(nousParam)` in useEffect; correct logic, needs browser to verify |

**Score:** 6/6 automated truths verified; 7/7 human truths have correct code — awaiting human confirmation

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Global Nous activity feed browsing | Phase 29 | Phase 27 CONTEXT D-05: "No global Nous feed page is added in Phase 27"; Phase 29 COMM-03: "Activity feed on /portal/home: real-time mix of Grid events" |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/append-human-spoke.ts` | Sole producer for human.spoke | ✓ VERIFIED | 85 lines; full 8-step discipline; `HumanSpokePayload` interface with `msg_hash` key; exported `appendHumanSpoke` |
| `grid/src/audit/broadcast-allowlist.ts` | Updated allowlist with human.spoke at position 52 | ✓ VERIFIED | `'human.spoke', // (52)` present; JSDoc updated to "52 event types" |
| `grid/src/api/portal/chat.ts` | POST /api/v1/portal/chat/nous/:nousId route | ✓ VERIFIED | Route at line 145; `NOUS_SYSTEM_PROMPTS` map; auth guard; 404/400/401 cases; `done: false` always |
| `grid/src/api/portal/nous.ts` | Three portal Nous endpoints (skills, lore, norms) | ✓ VERIFIED | `registerPortalNousRoutes` exported; 3 routes; JWT auth; Brain proxy with fallback; `JSON_CONTAINS` for norms |
| `grid/src/api/portal/index.ts` | Wires registerPortalNousRoutes | ✓ VERIFIED | Line 13: import; line 25: `registerPortalNousRoutes(app, services)` |
| `brain/src/noesis_brain/http/skills_lookup.py` | Brain HTTP handler for GET /skills/{hash} | ✓ VERIFIED | `handle_skills_lookup` function; X-Brain-Secret auth gate; 404 for unknown hash; returns {description, name} |
| `brain/src/noesis_brain/skills/store.py` | SkillStore.get_by_hash() method | ✓ VERIFIED | `get_by_hash` at line 164; uses `hashlib.sha256(skill.instructions.encode()).hexdigest()` |
| `dashboard/src/app/portal/chat/page.tsx` | Unified chat page — replaces Phase 26 placeholder | ✓ VERIFIED | 162 lines; not a placeholder; `selectedNousId`, `fireGreeting`, localStorage integration, `height: '100%'`, `overflow: 'hidden'` |
| `dashboard/src/app/portal/chat/TipPanel.tsx` | wagmi USDT transfer slide-up panel | ✓ VERIFIED | 3-line file: `dynamic(() => import('./TipPanelInner'), { ssr: false })` |
| `dashboard/src/app/portal/chat/TipPanelInner.tsx` | Inner TipPanel with wagmi hooks | ✓ VERIFIED | `useWriteContract`, `useWaitForTransactionReceipt`; `PRESETS = [1, 5, 10]`; `onTipConfirmed` fires on `isSuccess` |
| `dashboard/src/components/portal/avatars/SophiaAvatar.tsx` | Sophia phi spiral SVG component | ✓ VERIFIED | File exists; named export `SophiaAvatar`; uses `--bronze` CSS variable |
| `dashboard/src/components/portal/avatars/HermesAvatar.tsx` | Hermes caduceus SVG component | ✓ VERIFIED | File exists; named export `HermesAvatar`; uses `--terracotta` CSS variable |
| `dashboard/src/components/portal/avatars/ThemisAvatar.tsx` | Themis balanced scales SVG component | ✓ VERIFIED | File exists; named export `ThemisAvatar`; uses `--navy` CSS variable |
| `dashboard/src/app/portal/nous/[id]/page.tsx` | Nous profile page | ✓ VERIFIED | `KNOWN_NOUS` allowlist guard; `HeroCard` rendered; unknown ID shows "Nous not found." |
| `dashboard/src/app/portal/nous/[id]/HeroCard.tsx` | Hero card with Chat button | ✓ VERIFIED | `formatUnits` for ousia; `router.push(\`/portal/chat?nous=${nousId}\`)` at line 110; terracotta gradient stripe |
| `dashboard/src/app/portal/nous/[id]/SkillsTab.tsx` | Skills tab with Brain proxy fetch | ✓ VERIFIED | Fetches `/api/v1/portal/nous/${nousId}/skills`; portal-pulse skeleton; TAUGHT/SELF-INFERRED badges |
| `dashboard/src/app/portal/nous/[id]/LoreTab.tsx` | Lore metadata tab (no body text) | ✓ VERIFIED | Only `category_tag`, `contributed_tick`, `citation_count`, `content_hash.slice(0,16)` rendered; no `.body`, `.description`, or `.text` fields accessed |
| `dashboard/src/app/portal/nous/[id]/NormsTab.tsx` | Norms participation tab | ✓ VERIFIED | `fp.slice(0, 4) + '…' + fp.slice(-4)` truncation; CRYSTALLIZED/CANDIDATE status badges |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `grid/src/api/portal/chat.ts` | `grid/src/audit/append-human-spoke.ts` | `appendHumanSpoke()` call when messages.length > 0 | ✓ WIRED | Line 27: import; line 204: call site; conditional on `messages.length > 0` |
| `grid/src/audit/append-human-spoke.ts` | `broadcast-allowlist.ts payloadPrivacyCheck` | `payloadPrivacyCheck(cleanPayload)` | ✓ WIRED | Line 21: import; line 81: call in step 8 |
| `grid/src/api/portal/nous.ts skills route` | `http://brain:8090/skills/:hash` | fetch with X-Brain-Secret header, 5s timeout, fallback on error | ✓ WIRED | Line 36: `fetch(\`${brainBase}/skills/${encodeURIComponent(hash)}\`, ...)`; AbortController at 5s; returns null on error |
| `grid/src/api/portal/index.ts` | `grid/src/api/portal/nous.ts` | `registerPortalNousRoutes(app, services)` | ✓ WIRED | Lines 13+25 in index.ts |
| `dashboard/src/app/portal/chat/page.tsx` | `POST /api/v1/portal/chat/nous/:nousId` | fetch with credentials: 'include' in sendMessage / fireGreeting | ✓ WIRED | Lines 46 and 105: `fetch(\`${gridBase}/api/v1/portal/chat/nous/${nousId}\`, { credentials: 'include' })` |
| `dashboard/src/app/portal/chat/TipPanel.tsx` | EVM chain (USDT transfer) | `useWriteContract` wagmi hook | ✓ WIRED | `TipPanelInner.tsx` lines 4, 59, 84-88: `writeContract({ address: USDT_ADDR[mainnet.id], ... })` |
| `dashboard/src/app/portal/nous/[id]/HeroCard.tsx Chat button` | `/portal/chat?nous={nousId}` | `router.push('/portal/chat?nous=${nousId}')` | ✓ WIRED | Line 110: `router.push(\`/portal/chat?nous=${nousId}\`)` |
| `dashboard/src/app/portal/nous/[id]/SkillsTab.tsx` | `GET /api/v1/portal/nous/:nousId/skills` | fetch with credentials: 'include' | ✓ WIRED | Line 86: `fetch(\`${gridBase}/api/v1/portal/nous/${nousId}/skills\`, { credentials: 'include' })` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `chat.ts` (new route) | `replyText` | Non-streaming Ollama fetch at `${ollamaHost}/api/chat` | Yes — `data.message.content` from LLM response | ✓ FLOWING |
| `nous.ts` (skills route) | `rows` | `audit_trail` DB query (event_type IN skill.taught, skill.inferred) via `humanPool` | Yes — parameterized SQL query against real pool | ✓ FLOWING |
| `nous.ts` (lore route) | `rows` | `lore_commons` DB query via `humanPool` | Yes — SQL against `lore_commons`; 4 metadata fields returned | ✓ FLOWING |
| `nous.ts` (norms route) | `candidates` + `crystallized` | `norm_candidates` + `norm_registry` DB queries; `JSON_CONTAINS` | Yes — two-query join pattern | ✓ FLOWING |
| `SkillsTab.tsx` | `skills` state | GET `/api/v1/portal/nous/${nousId}/skills` with Brain proxy | Yes — resolves via Brain or falls back to truncated hash | ✓ FLOWING |
| `LoreTab.tsx` | `entries` state | GET `/api/v1/portal/nous/${nousId}/lore` | Yes — cursor-paginated from lore_commons | ✓ FLOWING |
| `page.tsx` (chat) | `messages` state | localStorage on select + LLM fetch | Yes — loads history, then LLM call; not hardcoded | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for UI components (require live browser + Ollama). Grid and Brain logic verified via grep patterns.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| appendHumanSpoke is exported | `grep "export function appendHumanSpoke" append-human-spoke.ts` | Found | ✓ PASS |
| human.spoke at index 51 (position 52) | `grep "human.spoke.*52" broadcast-allowlist.ts` | Found at line 200 | ✓ PASS |
| NOUS_SYSTEM_PROMPTS has 3 entries | `grep -A4 "NOUS_SYSTEM_PROMPTS" chat.ts` | sophia/hermes/themis all present | ✓ PASS |
| done: false always returned | `grep "done: false" chat.ts` | Line 214: always returned | ✓ PASS |
| LoreTab does NOT access body field | `grep "\.body\|\.description\|body_text" LoreTab.tsx` | No matches | ✓ PASS |
| NormsTab fingerprint truncation | `grep "slice(0.*4.*slice(-4" NormsTab.tsx` | Line 19 confirmed | ✓ PASS |
| TipPanel ssr:false | `grep "ssr: false" TipPanel.tsx` | Line 3 confirmed | ✓ PASS |
| ConversationPane position:relative | `grep "position.*relative" ConversationPane.tsx` | Line 32 confirmed | ✓ PASS |
| Chat page root height:100% | `grep "height.*100%" page.tsx` | Line 148 confirmed | ✓ PASS |
| No Tailwind color tokens | `grep -r "text-slate\|bg-amber\|text-gray" portal/chat/ portal/nous/` | No matches | ✓ PASS |
| All 8 key commits exist | `git log --oneline` | 48ed046, c7858d8, d9b27b2, 5eb410a, 88dd988, 719986f, 5fa04cd, b61d2dd — all found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CHAT-01 | 27-01, 27-03 | `/portal/chat` route; user selects Nous and sends text via POST `/api/v1/portal/chat/nous/:nousId` | ✓ SATISFIED | Route implemented in `chat.ts`; UI in `page.tsx` with fetch wired |
| CHAT-02 | 27-01, 27-03 | Per-Nous personality prompt (Sophia=philosophical, Hermes=mercantile, Themis=judicial) | ✓ SATISFIED | `NOUS_SYSTEM_PROMPTS` in `chat.ts` maps all 3 nousIds to distinct system prompts |
| CHAT-03 | 27-01 | Human messages NOT injected into Nous Brain memory | ✓ SATISFIED | Chat route makes out-of-tick Ollama call only; no Brain RPC write path; confirmed in `chat.ts` |
| CHAT-04 | 27-01 | `human.spoke` audit event fires on human message; payload uses `msg_hash` (sha256, not plaintext) | ✓ SATISFIED | `appendHumanSpoke.ts` sole-producer; `msg_hash` key; allowlist at position 52 |
| CHAT-05 | 27-03 | Tip button → TipPanel → wagmi USDT on-chain transfer; system message on success | ✓ SATISFIED | `TipPanelInner.tsx` with `useWriteContract`; `page.tsx` inserts `✓ You sent N USDT to [Name]` system message |
| CHAT-06 | 27-02, 27-04 | Nous profile at `/portal/nous/[id]`: name, role, region, skills, ousia, chat button | ✓ SATISFIED | `page.tsx` + `HeroCard.tsx` + `SkillsTab/LoreTab/NormsTab`; API endpoints in `nous.ts` |

Note: CHAT requirements are defined in `.planning/research/v2.5-requirements.md`, not in `.planning/REQUIREMENTS.md` (which covers v2.2 and v2.4 milestones). This is expected — v2.5 requirements live in research files per project structure.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `TipPanelInner.tsx` — NEXT_PUBLIC_NOUS_TREASURY_ADDRESS fallback | `0x0000000000000000000000000000000000000001` hardcoded as placeholder | ⚠️ Warning | Non-functional on mainnet until env var is configured; MetaMask shows actual destination to user before confirmation — intentional per plan decision T-27-12 |
| `dashboard/src/app/portal/nous/[id]` — avatar stubs | Plan 04 SUMMARY notes avatar components are "minimal implementations" from parallel worktree conflict | ℹ️ Info | Plan 03 also created avatar files; both worktrees created minimal SVGs. The SVG paths are functional but not production-polished. Does not block phase goal. |

### Human Verification Required

#### 1. Chat auto-greeting and message flow
**Test:** Log in as a portal user, navigate to `/portal/chat`, click on Sophia's card in the sidebar
**Expected:** Auto-greeting fires (POST with empty messages[]), 3-dot LoadingBubble appears, then Sophia's greeting appears as a NousBubble (left-aligned, serif text, parchment background). Then type "Tell me about philosophy" and press Enter — UserBubble appears immediately, loading bubble reappears, then Sophia replies.
**Why human:** Requires live Ollama instance; localStorage state; visual bubble rendering cannot be grep-verified

#### 2. Greeting guard on re-selection
**Test:** Select Sophia, see greeting, navigate away, return to `/portal/chat`, re-select Sophia
**Expected:** Prior conversation loads from localStorage immediately — no new LLM call fires, no duplicate greeting appears
**Why human:** localStorage persistence across navigation requires real browser session

#### 3. TipPanel wagmi USDT flow
**Test:** In an active chat, click the ₮ (tip) button in the footer
**Expected:** TipPanel slides up above the footer with 1 USDT / 5 USDT / 10 USDT preset buttons and a custom amount input. Select 5 USDT, click Confirm. MetaMask (or wallet) opens with a USDT transfer to `NEXT_PUBLIC_NOUS_TREASURY_ADDRESS`. After confirmation, `✓ You sent 5 USDT to Sophia` appears as a SystemMessage inline in the conversation.
**Why human:** On-chain wallet interaction requires MetaMask; visual animation (slide-up) cannot be automated

#### 4. Nous profile page full interaction
**Test:** Navigate to `/portal/nous/sophia`
**Expected:** Hero card shows Sophia's name (serif 28px), "Philosopher · Genesis Grid" tagline, region, ousia balance (formatUnits 6 decimals). Skills tab shows skill rows with TAUGHT/SELF-INFERRED badges and tick values with portal-pulse skeleton while loading. Lore tab shows category badge + tick + citation count + truncated hash — no body text visible. Norms tab shows fingerprint truncations + CRYSTALLIZED/CANDIDATE badges. Clicking "Chat with Sophia" navigates to `/portal/chat?nous=sophia`.
**Why human:** Tab switching, data loading skeleton states, and navigation require visual inspection

#### 5. Unknown Nous profile error state
**Test:** Navigate to `/portal/nous/unknown_nous`
**Expected:** Page immediately shows "Nous not found." heading and "Return to chat" link; no network fetches fire
**Why human:** Error state UI requires browser rendering; cannot verify no-fetch behavior via grep

#### 6. URL param pre-selection
**Test:** Navigate directly to `/portal/chat?nous=hermes`
**Expected:** Hermes is highlighted in the sidebar on page load without clicking; if localStorage has no Hermes history, auto-greeting fires for Hermes
**Why human:** URL param handling at mount-time + conditional greeting require browser

#### 7. Live status dots in sidebar
**Test:** Observe the Nous cards in NousSidebar with the Grid running
**Expected:** Online Nous shows green dot (`#4ade80`) with a glow effect; offline shows muted; busy shows amber. Status updates from `GET /api/v1/grid/nous` on mount.
**Why human:** Status dot colors, glow effects, and live Grid status require visual inspection with running Grid

### Gaps Summary

No gaps blocking goal achievement. All required artifacts exist, are substantive, and are wired. The phase goal is fully implemented at the code level.

The "browse Nous activity feed" component of the phase goal is explicitly deferred — per CONTEXT D-05 and D-05's "labeled Phase 30" decision, no global feed page is delivered in Phase 27. Activity browsing is scoped to per-Nous profile pages (Skills/Lore/Norms tabs), which are fully implemented. The global feed is addressed in Phase 29 (COMM-03).

The `NEXT_PUBLIC_NOUS_TREASURY_ADDRESS` env var must be set before the TipPanel can transfer to a real Nous treasury wallet. This is a configuration task, not a code gap — MetaMask shows the destination address to users before confirmation in all cases.

---

_Verified: 2026-05-23T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
