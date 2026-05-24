---
phase: 27-nous-interaction
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - brain/src/noesis_brain/http/server.py
  - brain/src/noesis_brain/http/skills_lookup.py
  - brain/src/noesis_brain/skills/store.py
  - brain/test/test_skills_http.py
  - dashboard/src/app/portal/chat/ChatFooter.tsx
  - dashboard/src/app/portal/chat/ChatInput.tsx
  - dashboard/src/app/portal/chat/ConversationPane.test.tsx
  - dashboard/src/app/portal/chat/ConversationPane.tsx
  - dashboard/src/app/portal/chat/LoadingBubble.tsx
  - dashboard/src/app/portal/chat/MessageList.tsx
  - dashboard/src/app/portal/chat/NousBubble.tsx
  - dashboard/src/app/portal/chat/NousCard.tsx
  - dashboard/src/app/portal/chat/NousHeader.tsx
  - dashboard/src/app/portal/chat/NousSidebar.test.tsx
  - dashboard/src/app/portal/chat/NousSidebar.tsx
  - dashboard/src/app/portal/chat/SystemMessage.tsx
  - dashboard/src/app/portal/chat/TipPanel.test.tsx
  - dashboard/src/app/portal/chat/TipPanel.tsx
  - dashboard/src/app/portal/chat/TipPanelInner.tsx
  - dashboard/src/app/portal/chat/UserBubble.tsx
  - dashboard/src/app/portal/chat/page.tsx
  - dashboard/src/app/portal/nous/[id]/HeroCard.tsx
  - dashboard/src/app/portal/nous/[id]/LoreTab.tsx
  - dashboard/src/app/portal/nous/[id]/NormsTab.tsx
  - dashboard/src/app/portal/nous/[id]/ProfilePage.test.tsx
  - dashboard/src/app/portal/nous/[id]/ProfileTabBar.tsx
  - dashboard/src/app/portal/nous/[id]/SkillsTab.tsx
  - dashboard/src/app/portal/nous/[id]/page.tsx
  - dashboard/src/components/portal/avatars/HermesAvatar.tsx
  - dashboard/src/components/portal/avatars/SophiaAvatar.tsx
  - dashboard/src/components/portal/avatars/ThemisAvatar.tsx
  - grid/src/api/portal/chat.ts
  - grid/src/api/portal/index.ts
  - grid/src/api/portal/nous.ts
  - grid/src/audit/append-human-spoke.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/test/audit/allowlist-forty-five.test.ts
  - grid/test/audit/allowlist-twenty-six.test.ts
  - grid/test/audit/allowlist-twenty-two.test.ts
  - grid/test/audit/append-human-spoke.test.ts
  - grid/test/audit/broadcast-allowlist.test.ts
  - grid/test/audit/operator-exported-allowlist.test.ts
  - grid/test/audit/skill-allowlist.test.ts
  - grid/test/portal/chat-nous.test.ts
  - grid/test/portal/nous-endpoints.test.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 45
**Status:** issues_found

## Summary

Phase 27 introduces the Nous Interaction layer: the per-Nous general chat endpoint, the Brain skills-by-hash HTTP proxy, three portal profile tabs (Skills/Lore/Norms), audit boundary for `human.spoke`, and dashboard UI components. The architecture is coherent and privacy discipline is strong throughout — no sensitive data crosses the wire, closed-key validation is enforced at every boundary, and the 8-step audit discipline pattern is correctly applied to the new `appendHumanSpoke` emitter.

Four warnings are present, none catastrophic. The most significant is a missing validation guard in `TipPanelInner.tsx` that allows a zero-value or negative custom tip amount to reach the blockchain call. A second warning covers a stale React dependency-array comment suppression in `ChatPage`. Two others are correctness edge cases in the Brain skills store and Grid chat route.

---

## Warnings

### WR-01: Custom tip amount negative or fractional — wallet call not guarded against `NaN`

**File:** `dashboard/src/app/portal/chat/TipPanelInner.tsx:62-79`

**Issue:** `selectedAmount` is computed as `parseFloat(customAmount)` when no preset is selected. `parseFloat('')` returns `NaN`, `parseFloat('-1')` returns `-1`, `parseFloat('0')` returns `0`. The `handleConfirm` guard checks `!selectedAmount || selectedAmount <= 0` which correctly blocks `0` and negatives, but `NaN` passes the `!selectedAmount` branch only if `customAmount` is an empty string (because then `selectedAmount` is `null`, not `NaN`). However, entering a non-numeric string such as `"abc"` produces `NaN`; the condition `NaN <= 0` is `false` and `!NaN` is `true`, so the guard does fire — but this is coincidentally correct. More critically: `parseUnits(String(NaN), 6)` would produce a viem error that is not caught. The `writeContract` call has no try/catch around it, meaning a bad parse silently fails with an unhandled Promise rejection from wagmi's internals. There is no user-visible error surfaced.

**Fix:** Validate `customAmount` explicitly before calling `handleConfirm`:
```typescript
function handleConfirm() {
    const parsed = customAmount ? parseFloat(customAmount) : selectedPreset;
    if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) {
        setTipError('Enter a valid positive amount to tip.');
        return;
    }
    setTipError(null);
    writeContract({
        address: USDT_ADDR[mainnet.id],
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [TREASURY_ADDRESS, parseUnits(String(parsed), 6)],
    });
}
```

---

### WR-02: `useEffect` dependency suppression hides stale-closure risk in `ChatPage`

**File:** `dashboard/src/app/portal/chat/page.tsx:89-90`

**Issue:** The effect that reads the `?nous=` query param suppresses the exhaustive-deps lint rule with a comment `// eslint-disable-next-line react-hooks/exhaustive-deps`. The empty dep array `[]` is intentional (run-once on mount), but `handleSelectNous` is not in the dep array. If `handleSelectNous` changes identity between renders before the first mount completes (unlikely but possible in Strict Mode double-invoke), the closure captures the stale version. More practically, this suppression pattern silently allows accidental drift if deps are added to `handleSelectNous` in the future. The comment correctly explains the intent ("Run once on mount only") but the suppression is unconditional.

**Fix:** Use a ref to hold the latest `handleSelectNous` and call through the ref, eliminating the need for the suppression:
```typescript
const handleSelectNousRef = useRef(handleSelectNous);
useEffect(() => { handleSelectNousRef.current = handleSelectNous; });

useEffect(() => {
    const nousParam = searchParams.get('nous');
    if (nousParam && ['sophia', 'hermes', 'themis'].includes(nousParam)) {
        handleSelectNousRef.current(nousParam);
    }
}, []); // safe: ref always current
```

---

### WR-03: `SkillStore.get_by_hash` iterates all skills every call — O(N) with no deduplication cache

**File:** `brain/src/noesis_brain/skills/store.py:164-173`

**Issue:** `get_by_hash` calls `_all_skills()` which issues a full `SELECT *` on every invocation, then iterates computing `hashlib.sha256(...).hexdigest()` for each row. This is documented as "O(N) scan — acceptable for <1000 skills," but the same `_all_skills()` call is also issued in `retrieve()` for the trigger-hit stage. When the portal Skills tab loads, Grid calls this endpoint once per skill hash in the audit log (via `Promise.all`) — up to 50 concurrent HTTP requests, each scanning up to 1000 rows. Under concurrent load the Brain SQLite connection (shared with `MemoryStore`) will serialize these reads, and the CPU cost is O(50 × N) hashes per page load.

This is a scalability concern but not currently a correctness bug. However it becomes a bug if the SQLite connection is ever held in WAL mode without a reader timeout, because a long-running scan blocks writes to the skills table from `on_tick`.

**Fix (minimal):** Add an in-memory LRU cache keyed by `skill_hash` inside `SkillStore`, invalidated on `add()`. This converts repeated lookups to O(1) without schema changes:
```python
from functools import lru_cache

# In __init__:
self._hash_cache: dict[str, Skill] = {}

def add(self, skill: Skill) -> Skill:
    result = ...  # existing logic
    self._hash_cache.clear()  # invalidate on write
    return result

def get_by_hash(self, skill_hash: str) -> "Skill | None":
    if skill_hash in self._hash_cache:
        return self._hash_cache[skill_hash]
    for skill in self._all_skills():
        h = hashlib.sha256(skill.instructions.encode()).hexdigest()
        self._hash_cache[h] = skill
        if h == skill_hash:
            return skill
    return None
```

---

### WR-04: `NousProfilePage` fetches the full roster but matches by `n.did` — DID format mismatch risk

**File:** `dashboard/src/app/portal/nous/[id]/page.tsx:29-31`

**Issue:** The roster fetch at `/api/v1/grid/nous` returns entries with `did` field in the format `did:noesis:sophia`. The code matches with `n.did === \`did:noesis:${nousId}\`` which is correct. However, if the Grid roster ever changes the `did` field shape (e.g., to include the full `human_` prefix pattern used elsewhere in the codebase, such as `did:noesis:human_0xabc`), the match silently fails and all profile fields show `'—'` / `'0'` without any error surfaced to the user. Additionally, `r.json()` is called without checking `r.ok`, meaning a 401 or 500 response from the Grid would attempt to parse an error JSON as a roster array, which causes a silent failure (`.catch(() => null)` swallows it).

**Fix:** Add `r.ok` check before `.json()`:
```typescript
fetch(`${gridBase}/api/v1/grid/nous`, { credentials: 'include' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`roster ${r.status}`)))
    .then((roster: Array<{ did: string; status: string; region: string; ousia: string }>) => {
        const entry = roster.find(n => n.did === `did:noesis:${nousId}`);
        if (entry) setNousData({ status: entry.status, region: entry.region, ousia: entry.ousia });
    })
    .catch(() => null);
```

---

## Info

### IN-01: Duplicated `AVATAR_MAP` / `NOUS_METADATA` constants across six files

**File:** `dashboard/src/app/portal/chat/LoadingBubble.tsx:11-21`, `NousBubble.tsx:12-16`, `NousCard.tsx:20-24`, `NousHeader.tsx:17-21`, `NousSidebar.tsx:11-14`, `dashboard/src/app/portal/nous/[id]/HeroCard.tsx:22-26`

**Issue:** The same `AVATAR_MAP` constant (mapping `sophia/hermes/themis` to avatar components) and `NOUS_METADATA` / `NOUS_NAMES` records are copy-pasted across six separate files. This is intentional for simplicity at this phase size (three fixed Nous), but means adding a fourth Nous requires touching six files. This is noted, not flagged as a bug.

**Fix:** Extract to a shared `portal/nous-registry.ts` module when the Nous roster grows beyond three.

---

### IN-02: `LoreTab.tsx` `loadMore` does not set `loading` state during pagination

**File:** `dashboard/src/app/portal/nous/[id]/LoreTab.tsx:88-103`

**Issue:** The initial fetch sets `setLoading(true)` and shows skeleton rows, but the `loadMore` function issues a second fetch without any loading indicator. Users clicking "Load more lore" get no feedback while the request is in flight. This is a UX gap rather than a correctness bug.

**Fix:** Add `const [loadingMore, setLoadingMore] = useState(false)` and toggle it around the `loadMore` fetch, then reflect it in the button state.

---

### IN-03: `chat-nous.test.ts` — `appendHumanSpoke NOT called` assertion is fragile

**File:** `grid/test/portal/chat-nous.test.ts:170-183`

**Issue:** The test asserts that no new `human.spoke` events were appended by checking `spokeEvents.filter(e => audit.at(e.id - 1) === undefined || e.id > priorLength)`. The `audit.at(e.id - 1)` branch is an unclear heuristic (checking if the previous entry exists) that does not correspond to any documented meaning. If `audit.at` returns `undefined` for the first entry (id=1), this could incorrectly count pre-existing events as "new." The straightforward check would be `spokeEvents.filter(e => e.id > priorLength)`.

**Fix:**
```typescript
const spokeEvents = audit.query({ eventType: 'human.spoke' });
expect(spokeEvents.filter(e => e.id > priorLength).length).toBe(0);
```

---

### IN-04: `NousSidebar.test.tsx` — `vi.fn()` without `vi` import

**File:** `dashboard/src/app/portal/chat/NousSidebar.test.tsx:8`

**Issue:** The test calls `vi.fn()` but does not import `vi` from `vitest`. This works in vitest's global mode (if configured) but is fragile — if the project ever changes vitest config to not use globals, this test silently breaks. All other test files in this phase explicitly import test utilities.

**Fix:**
```typescript
import { describe, it, expect, vi } from 'vitest';
```

---

### IN-05: `TipPanelInner.tsx` — `USDT_ADDR` map has only mainnet, but `mainnet.id` is hardcoded in `writeContract`

**File:** `dashboard/src/app/portal/chat/TipPanelInner.tsx:10-11`, `84-88`

**Issue:** `USDT_ADDR[mainnet.id]` is used directly. If the app is connected to a testnet wallet (Sepolia, etc.), `USDT_ADDR[chainId]` would be `undefined` and wagmi's `writeContract` would receive `address: undefined`, likely producing a confusing runtime error rather than a user-facing validation message. This is acceptable for a mainnet-only product but worth noting for any testnet QA.

**Fix:** Guard the address lookup explicitly:
```typescript
const usdtAddress = USDT_ADDR[mainnet.id];
if (!usdtAddress) {
    setTipError('Unsupported network — please switch to Ethereum mainnet.');
    return;
}
writeContract({ address: usdtAddress, ... });
```

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
