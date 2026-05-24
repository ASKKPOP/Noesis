# Phase 27: Nous Interaction — Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 27 new/modified files
**Analogs found:** 27 / 27

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `dashboard/src/app/portal/chat/page.tsx` | component (page, replace) | request-response + localStorage | `dashboard/src/app/portal/auth/page.tsx` | role-match (both are 'use client' pages with state) |
| `dashboard/src/app/portal/chat/NousSidebar.tsx` | component | request-response | `dashboard/src/components/portal/WalletPanel.tsx` (BalanceCard sub-comp pattern) | role-match |
| `dashboard/src/app/portal/chat/NousCard.tsx` | component | event-driven (click) | `dashboard/src/components/portal/WalletPanel.tsx` (TxRow sub-comp pattern) | role-match |
| `dashboard/src/app/portal/chat/ConversationPane.tsx` | component | request-response + localStorage | `dashboard/src/components/portal/WalletPanel.tsx` (main layout) | role-match |
| `dashboard/src/app/portal/chat/NousHeader.tsx` | component | display | `dashboard/src/components/portal/WalletPanel.tsx` (BalanceCard) | partial |
| `dashboard/src/app/portal/chat/MessageList.tsx` | component | display | `dashboard/src/components/portal/WalletPanel.tsx` (txRecords list) | partial |
| `dashboard/src/app/portal/chat/NousBubble.tsx` | component | display | `dashboard/src/components/portal/WalletPanel.tsx` (TxRow) | partial |
| `dashboard/src/app/portal/chat/UserBubble.tsx` | component | display | `dashboard/src/components/portal/WalletPanel.tsx` (TxRow) | partial |
| `dashboard/src/app/portal/chat/LoadingBubble.tsx` | component | display | `dashboard/src/components/portal/WalletPanel.tsx` (portal-pulse skeleton) | exact |
| `dashboard/src/app/portal/chat/SystemMessage.tsx` | component | display | `dashboard/src/app/portal/chat/page.tsx` (inline centered text pattern) | partial |
| `dashboard/src/app/portal/chat/ChatFooter.tsx` | component | event-driven | `dashboard/src/components/portal/WalletPanel.tsx` (send form) | role-match |
| `dashboard/src/app/portal/chat/ChatInput.tsx` | component | event-driven | `dashboard/src/components/portal/WalletPanel.tsx` (inputStyle textarea) | exact |
| `dashboard/src/app/portal/chat/TipPanel.tsx` | component (wagmi, ssr:false) | event-driven + EVM chain | `dashboard/src/components/portal/WalletPanel.tsx` (USDT writeContract flow) | exact |
| `dashboard/src/app/portal/nous/[id]/page.tsx` | component (page) | request-response | `dashboard/src/app/portal/auth/page.tsx` | role-match |
| `dashboard/src/app/portal/nous/[id]/HeroCard.tsx` | component | display | `dashboard/src/components/portal/WalletPanel.tsx` (BalanceCard + header) | role-match |
| `dashboard/src/app/portal/nous/[id]/ProfileTabBar.tsx` | component | event-driven | `dashboard/src/components/portal/WalletPanel.tsx` (asset tab switcher) | exact |
| `dashboard/src/app/portal/nous/[id]/SkillsTab.tsx` | component | request-response | `dashboard/src/components/portal/WalletPanel.tsx` (TxRow list) | role-match |
| `dashboard/src/app/portal/nous/[id]/LoreTab.tsx` | component | request-response | `dashboard/src/components/portal/WalletPanel.tsx` (TxRow list + load more) | role-match |
| `dashboard/src/app/portal/nous/[id]/NormsTab.tsx` | component | request-response | `dashboard/src/components/portal/WalletPanel.tsx` (TxRow list) | role-match |
| `dashboard/src/components/portal/avatars/SophiaAvatar.tsx` | component (SVG) | display | `dashboard/src/app/portal/chat/page.tsx` (inline SVG icon) | partial |
| `dashboard/src/components/portal/avatars/HermesAvatar.tsx` | component (SVG) | display | `dashboard/src/app/portal/chat/page.tsx` (inline SVG icon) | partial |
| `dashboard/src/components/portal/avatars/ThemisAvatar.tsx` | component (SVG) | display | `dashboard/src/app/portal/chat/page.tsx` (inline SVG icon) | partial |
| `grid/src/api/portal/chat.ts` | route (extend) | request-response | `grid/src/api/portal/chat.ts` (existing file) | exact |
| `grid/src/api/portal/nous.ts` | route (new) | request-response + CRUD | `grid/src/api/portal/wallet.ts` | exact |
| `grid/src/api/portal/index.ts` | config (extend) | — | `grid/src/api/portal/index.ts` (existing file) | exact |
| `grid/src/audit/append-human-spoke.ts` | utility (sole producer) | event-driven | `grid/src/audit/append-human-transferred.ts` | exact |
| `grid/src/audit/broadcast-allowlist.ts` | config (extend) | — | `grid/src/audit/broadcast-allowlist.ts` (existing file) | exact |
| `brain/src/noesis_brain/skills/store.py` | service (extend) | CRUD | `brain/src/noesis_brain/skills/store.py` `get()` method | exact |
| `brain/src/noesis_brain/http/server.py` | service (extend) | request-response | `brain/src/noesis_brain/http/server.py` `_cognitive_snapshot_route` | exact |
| `brain/src/noesis_brain/http/skills_lookup.py` | service (new) | request-response | `brain/src/noesis_brain/http/cognitive_snapshot.py` | exact |

---

## Pattern Assignments

### `grid/src/api/portal/chat.ts` (route, request-response — extend existing)

**Analog:** `grid/src/api/portal/chat.ts` (lines 1–102 — extend, do not rewrite)

**Imports pattern** (lines 14–18):
```typescript
import { jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';
```
Add to imports for the new route:
```typescript
import crypto from 'crypto';
import { appendHumanSpoke } from '../../audit/append-human-spoke.js';
```

**System prompt constants pattern** (lines 19–34, extend after existing `SOPHIA_ONBOARD_SYSTEM_PROMPT`):
```typescript
const SOPHIA_ONBOARD_SYSTEM_PROMPT = `...`; // existing — do not touch

// NEW: per-Nous personality prompts for general chat (D-18)
const SOPHIA_CHAT_SYSTEM_PROMPT = `...`;   // philosophical/warm, open-ended
const HERMES_CHAT_SYSTEM_PROMPT = `...`;   // mercantile/witty
const THEMIS_CHAT_SYSTEM_PROMPT = `...`;   // judicial/precise

const NOUS_SYSTEM_PROMPTS: Record<string, string> = {
    'sophia': SOPHIA_CHAT_SYSTEM_PROMPT,
    'hermes': HERMES_CHAT_SYSTEM_PROMPT,
    'themis': THEMIS_CHAT_SYSTEM_PROMPT,
};
```

**Auth guard pattern** (lines 52–59 — copy verbatim for new route):
```typescript
const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
if (!token) return reply.status(401).send({ error: 'not_authenticated' });
try {
    const { publicKey } = await keyPairPromise;
    const { payload } = await jwtVerify(token, publicKey);
    humanDid = payload['did'] as string;
} catch {
    return reply.status(401).send({ error: 'invalid_token' });
}
```

**Core route pattern** (lines 48–101 — copy structure for new `POST /api/v1/portal/chat/nous/:nousId`):
```typescript
app.post<{
    Params: { nousId: string };
    Body: { messages?: unknown };
}>('/api/v1/portal/chat/nous/:nousId', async (req, reply) => {
    // 1. Auth guard (verbatim from /onboard)
    // 2. Validate nousId: must be key of NOUS_SYSTEM_PROMPTS
    const { nousId } = req.params;
    const systemPrompt = NOUS_SYSTEM_PROMPTS[nousId];
    if (!systemPrompt) return reply.status(404).send({ error: 'unknown_nous' });
    // 3. Validate messages: Array, cap at 50 (D-04)
    const { messages } = req.body ?? {};
    if (!Array.isArray(messages)) return reply.status(400).send({ error: 'invalid_request' });
    if (messages.length > 50) return reply.status(400).send({ error: 'too_many_messages' });
    // 4. Ollama call — same non-streaming pattern (lines 71–100)
    const ollamaHost = process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
    const ollamaModel = process.env['OLLAMA_MODEL'] ?? 'qwen3:4b';
    const ollamaRes = await fetch(`${ollamaHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: ollamaModel,
            messages: [
                { role: 'system', content: systemPrompt },
                ...(messages as Array<{ role: string; content: string }>),
            ],
            stream: false,
        }),
    });
    if (!ollamaRes.ok) return reply.status(503).send({ error: 'llm_unavailable' });
    const data = await ollamaRes.json() as { message: { content: string } };
    // 5. Audit: fire appendHumanSpoke only if human sent a message (messages.length > 0)
    if (messages.length > 0) {
        const lastHuman = (messages as Array<{ role: string; content: string }>)
            .filter(m => m.role === 'user').at(-1);
        if (lastHuman) {
            const msgHash = crypto.createHash('sha256').update(lastHuman.content).digest('hex');
            appendHumanSpoke(services.audit, {
                human_did: humanDid,
                msg_hash: msgHash,        // CRITICAL: 'msg_hash' not 'message_hash'
                nous_did: `did:noesis:${nousId}`,
                tick: services.clock.state.tick,
            });
        }
    }
    // 6. Return {reply, done} — done is ALWAYS false for general chat (no detectClose)
    return reply.send({ reply: data.message.content, done: false });
});
```

**Error handling pattern** (lines 97–100):
```typescript
} catch (err) {
    console.error('[chat/nous] Ollama unreachable:', err);
    return reply.status(503).send({ error: 'llm_unavailable' });
}
```

---

### `grid/src/api/portal/nous.ts` (route, request-response + CRUD — new file)

**Analog:** `grid/src/api/portal/wallet.ts`

**Imports pattern** (lines 14–18 of wallet.ts — copy structure):
```typescript
import { jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';
```

**Route registration function pattern** (lines 22–24 of wallet.ts):
```typescript
export function registerPortalNousRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // GET /api/v1/portal/nous/:nousId/skills
    // GET /api/v1/portal/nous/:nousId/lore
    // GET /api/v1/portal/nous/:nousId/norms
}
```

**Auth + DID extraction pattern** (lines 30–44 of wallet.ts — copy verbatim):
```typescript
const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
if (!token) return reply.status(401).send({ error: 'not_authenticated' });
let humanDid: string;
try {
    const { publicKey } = await keyPairPromise;
    const { payload } = await jwtVerify(token, publicKey);
    humanDid = payload['did'] as string;
    if (typeof humanDid !== 'string' || !humanDid.startsWith('did:noesis:')) {
        return reply.status(401).send({ error: 'invalid_token' });
    }
} catch {
    return reply.status(401).send({ error: 'invalid_token' });
}
```

**Brain proxy pattern** (from `cognitive-snapshot-client.ts` lines 93–138 — adapt for skills):
```typescript
// GET http://brain:8090/skills/:hash via X-Brain-Secret
const brainBase = process.env['BRAIN_HTTP_BASE_URL'] ?? 'http://brain:8090';
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);
const brainRes = await fetch(`${brainBase}/skills/${encodeURIComponent(hash)}`, {
    signal: controller.signal,
    headers: { 'X-Brain-Secret': process.env['BRAIN_HTTP_SECRET'] ?? '' },
});
if (!brainRes.ok) return null; // fallback to truncated hash — do not throw
const body = await brainRes.json();
// Closed-key validation (D-25a-05 pattern): exactly 2 keys: 'description', 'name'
const actualKeys = Object.keys(body as Record<string, unknown>).sort();
const EXPECTED_SKILL_KEYS = ['description', 'name'];
if (actualKeys.length !== 2 || !actualKeys.every((k, i) => k === EXPECTED_SKILL_KEYS[i])) {
    return null; // malformed — fallback
}
return body as { name: string; description: string };
```

**Lore query pattern** (Grid MySQL — new, follows wallet.ts db access via `services`):
```typescript
// SELECT content_hash, category_tag, contributed_tick, citation_count
// FROM lore_commons WHERE grid_name = ? AND contributor_did = ?
// ORDER BY contributed_tick DESC LIMIT 21
// cursor: ?cursor=<contributed_tick> → AND contributed_tick < cursor
```

---

### `grid/src/api/portal/index.ts` (config, extend)

**Analog:** `grid/src/api/portal/index.ts` (lines 1–24)

**Extension pattern** (lines 9–23 — add one import + one call):
```typescript
import { registerPortalNousRoutes } from './nous.js';   // NEW

export function registerPortalRoutes(app, services) {
    registerPortalAuthRoutes(app, services);
    registerFrozenCheck(app, services);
    registerPortalWalletRoutes(app, services);
    registerPortalChatRoutes(app, services);
    registerPortalNousRoutes(app, services);             // NEW — add at end
}
```

---

### `grid/src/audit/append-human-spoke.ts` (utility, sole producer — new file)

**Analog:** `grid/src/audit/append-human-transferred.ts` (lines 1–106 — replicate 8-step discipline exactly)

**File header comment pattern** (lines 1–17):
```typescript
/**
 * appendHumanSpoke — SOLE producer boundary for `human.spoke` audit events.
 *
 * Phase 27 (CHAT-04): fires when a human sends a message to any Nous via the portal.
 * The plain message text is NEVER stored — only its sha256 hash.
 *
 * 8-step discipline (mirrors appendHumanTransferred exactly):
 *   1. Type guard (plain object check).
 *   2. Regex guard: human_did (DID_RE).
 *   3. Regex guard: nous_did (DID_RE).
 *   4. Format guard: msg_hash (HEX64_RE — 64 lowercase hex chars).
 *   5. Non-negative integer guard: tick.
 *   6. Closed 4-key tuple check (alphabetical).
 *   7. Explicit reconstruction — no spread.
 *   8. payloadPrivacyCheck before chain.append.
 */
```

**Imports pattern** (lines 19–22 of append-human-transferred.ts):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';
```

**Payload interface and EXPECTED_KEYS pattern** (lines 28–36):
```typescript
export interface HumanSpokePayload {
    readonly human_did: string;  // DID_RE
    readonly msg_hash: string;   // sha256(plaintext) — 64-char hex CRITICAL: NOT 'message_hash'
    readonly nous_did: string;   // DID_RE
    readonly tick: number;       // non-negative integer
}
// Alphabetical — matches closed-tuple check (step 6):
const EXPECTED_KEYS = ['human_did', 'msg_hash', 'nous_did', 'tick'] as const;
```

**Regex guard for msg_hash** (new — step 4, replace the `ALLOWED_ASSETS` pattern from transferred):
```typescript
const HEX64_RE = /^[0-9a-f]{64}$/;
// Step 4:
if (typeof payload.msg_hash !== 'string' || !HEX64_RE.test(payload.msg_hash)) {
    throw new TypeError(`appendHumanSpoke: msg_hash must be 64 lowercase hex chars`);
}
```

**8-step function body** (lines 44–106 of append-human-transferred.ts — copy structure exactly, adapt key names):
```typescript
export function appendHumanSpoke(
    audit: AuditChain,
    payload: HumanSpokePayload,
): AuditEntry {
    // 1. Type guard
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendHumanSpoke: payload must be a plain object`);
    }
    // 2. human_did regex
    // 3. nous_did regex
    // 4. msg_hash format (HEX64_RE)
    // 5. tick non-negative integer
    // 6. Closed-tuple check (alphabetical — lines 80–86 of transferred)
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendHumanSpoke: unexpected key set ...`);
    }
    // 7. Explicit reconstruction — NO SPREAD (lines 89–94 of transferred)
    const cleanPayload = {
        human_did: payload.human_did,
        msg_hash: payload.msg_hash,
        nous_did: payload.nous_did,
        tick: payload.tick,
    };
    // 8. Privacy gate — then append
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) throw new TypeError(`appendHumanSpoke: privacy violation ...`);
    return audit.append('human.spoke', payload.human_did, cleanPayload);
}
```

**CRITICAL INVARIANT (from research Pitfall 1):** The payload key MUST be `msg_hash`, NOT `message_hash`. The substring `message` matches `FORBIDDEN_KEY_PATTERN` in `broadcast-allowlist.ts` and will cause `payloadPrivacyCheck` to throw. This has been verified against the allowlist source. `msg_hash` does not contain the forbidden substring.

---

### `grid/src/audit/broadcast-allowlist.ts` (config, extend)

**Analog:** `grid/src/audit/broadcast-allowlist.ts` (lines 189–195 — append after position 51)

**Extension pattern** (after line 194, before the `] as const` close on line 195):
```typescript
    // Phase 27 (CHAT-04) — Human-to-Nous message audit. Closed 4-key payload:
    // {human_did, msg_hash, nous_did, tick}. Plain message text NEVER crosses the wire —
    // only sha256(plaintext). Emitted ONLY via appendHumanSpoke()
    // (grid/src/audit/append-human-spoke.ts). Running allowlist total: 52.
    'human.spoke',   // (52)
```

**JSDoc comment update** (line 24 — update count from 51 to 52):
```typescript
/** Locked allowlist (...Phase 25b + Phase 27) — exactly these 52 event types. */
// Also update: "Phase 27 (CHAT-04): +1 human.spoke at position 52"
```

---

### `brain/src/noesis_brain/skills/store.py` (service, CRUD — extend)

**Analog:** `brain/src/noesis_brain/skills/store.py` `get()` method (lines 156–161)

**Existing `get()` pattern to extend from** (lines 156–161):
```python
def get(self, name: str) -> Skill | None:
    """Get a single skill by name."""
    row = self._conn.execute(
        "SELECT * FROM skills WHERE name = ?", (name,)
    ).fetchone()
    return Skill.from_row(row) if row else None
```

**New `get_by_hash()` method** — add after `get()` in the Reads section:
```python
import hashlib  # stdlib — already available in Python

def get_by_hash(self, skill_hash: str) -> 'Skill | None':
    """Lookup a skill by sha256(instructions). O(N) scan — acceptable for <1000 skills.

    Phase 27 (D-07/D-15): supports Brain→Grid skill-name proxy for portal Skills tab.
    No new columns or migrations required — computes hash on-the-fly from stored rows.
    """
    for skill in self._all_skills():
        if hashlib.sha256(skill.instructions.encode()).hexdigest() == skill_hash:
            return skill
    return None
```

**`_all_skills()` pattern it calls** (lines 172–176):
```python
def _all_skills(self) -> list[Skill]:
    rows = self._conn.execute(
        "SELECT * FROM skills ORDER BY last_used_at DESC"
    ).fetchall()
    return [Skill.from_row(r) for r in rows]
```

---

### `brain/src/noesis_brain/http/skills_lookup.py` (service, request-response — new file)

**Analog:** `brain/src/noesis_brain/http/cognitive_snapshot.py` (lines 1–140 — exact structural match)

**File header + imports pattern** (lines 1–33 of cognitive_snapshot.py):
```python
"""Skills-by-hash HTTP endpoint handler.

Serves GET /skills/{hash} — returns name and description for a skill given its
sha256(instructions) hash. Used by Grid portal Skills tab proxy (D-07/D-15).

Response contract — exactly 2 keys:
    { "name": str, "description": str }

Auth: X-Brain-Secret header must equal shared secret (same as cognitive_snapshot).
Returns 404 JSON if hash not found.
"""
from __future__ import annotations
from typing import TYPE_CHECKING
from aiohttp import web
from ..skills.store import SkillStore
if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler
```

**Handler function pattern** (lines 43–81 of cognitive_snapshot.py — copy auth gate + response shape):
```python
async def handle_skills_lookup(
    request: web.Request,
    handler: "BrainHandler",
    secret: str,
) -> web.Response:
    # Auth gate (same as cognitive_snapshot lines 53-55)
    if request.headers.get("X-Brain-Secret", "") != secret:
        raise web.HTTPUnauthorized()

    skill_hash = request.match_info["hash"]

    # Access SkillStore via same pattern as _get_skill_titles_topk (lines 92-101)
    memory = getattr(handler, "memory", None)
    if memory is None:
        return web.json_response({"error": "unavailable"}, status=503)
    store_conn = getattr(getattr(memory, "_store", None), "_conn", None)
    if store_conn is None:
        return web.json_response({"error": "unavailable"}, status=503)
    skill_store = SkillStore(store_conn)
    skill = skill_store.get_by_hash(skill_hash)
    if skill is None:
        return web.json_response({"error": "not_found"}, status=404)

    # Exactly 2 keys — matching Grid's closed-key validation
    return web.json_response({
        "description": skill.description,
        "name": skill.name,
    })
```

---

### `brain/src/noesis_brain/http/server.py` (service, extend)

**Analog:** `brain/src/noesis_brain/http/server.py` (lines 40–50 — add route alongside existing `_cognitive_snapshot_route`)

**Route registration pattern** (lines 40–50 of server.py — add after existing route):
```python
# Existing pattern (lines 41-50):
from .cognitive_snapshot import handle_cognitive_snapshot  # noqa: PLC0415
_h = self._handler
_s = self._secret

async def _cognitive_snapshot_route(req: web.Request) -> web.Response:
    return await handle_cognitive_snapshot(req, _h, _s)
self._app.router.add_get("/cognitive-snapshot/{did}", _cognitive_snapshot_route)

# NEW — add directly after (same __init__ block):
from .skills_lookup import handle_skills_lookup  # noqa: PLC0415

async def _skills_lookup_route(req: web.Request) -> web.Response:
    return await handle_skills_lookup(req, _h, _s)
self._app.router.add_get("/skills/{hash}", _skills_lookup_route)
```

---

### `dashboard/src/app/portal/chat/page.tsx` (component/page, replace)

**Analog:** `dashboard/src/app/portal/auth/page.tsx` for `'use client'` + `dynamic({ ssr: false })` pattern

**Top-of-file pattern** (lines 1–3 of auth/page.tsx — adapt for chat):
```typescript
'use client';
// Chat page manages its own height — must NOT use dynamic({ ssr: false }) on the page itself
// (TipPanel alone uses dynamic). useSearchParams for ?nous= param.
```

**State + useEffect pattern** (auth page lines 77–114 — mirror for Nous selection and localStorage):
```typescript
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

// Nous selection state
const [selectedNousId, setSelectedNousId] = useState<string | null>(null);
const [messages, setMessages] = useState<Message[]>([]);
const [isLoading, setIsLoading] = useState(false);
const searchParams = useSearchParams();

// ?nous= param pre-selection (D-13 Chat button + D-01)
useEffect(() => {
    const nousParam = searchParams.get('nous');
    if (nousParam && ['sophia', 'hermes', 'themis'].includes(nousParam)) {
        setSelectedNousId(nousParam);
    }
}, [searchParams]);
```

**localStorage read pattern** (from D-04 and Pitfall 4):
```typescript
// Load history when Nous is selected — BEFORE deciding to fire greeting
useEffect(() => {
    if (!selectedNousId || !humanDid) return;
    const key = `noesis:chat:${humanDid}:did:noesis:${selectedNousId}`;
    const stored = localStorage.getItem(key);
    const history: Message[] = stored ? JSON.parse(stored) : [];
    setMessages(history);
    // Fire greeting ONLY if conversation is genuinely empty (Pitfall 4)
    if (history.length === 0) {
        void fireGreeting(selectedNousId);
    }
}, [selectedNousId, humanDid]);
```

**Grid fetch pattern** (from auth page lines 119–131 — adapt for chat):
```typescript
const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
const res = await fetch(`${gridBase}/api/v1/portal/chat/nous/${nousId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',   // noesis_portal_token cookie
    body: JSON.stringify({ messages }),
});
```

**Root layout pattern** (from RESEARCH.md Pattern 9 + Pitfall 2):
```typescript
// Chat page root — height constraint is CRITICAL (Pitfall 2: message scroll breaks otherwise)
<div style={{
    display: 'flex',
    flexDirection: 'row',
    height: '100%',
    overflow: 'hidden',
}}>
    <NousSidebar ... />                {/* 256px fixed */}
    <ConversationPane ... />           {/* flex: 1, position: 'relative' for TipPanel anchor */}
</div>
```

**Export pattern** (line 681 of auth page):
```typescript
// Chat page does NOT need dynamic({ ssr: false }) on itself — it's 'use client'
// Only TipPanel (wagmi) needs dynamic({ ssr: false })
export default function ChatPage() { ... }
```

---

### `dashboard/src/app/portal/chat/TipPanel.tsx` (component, wagmi + EVM — new file, ssr:false)

**Analog:** `dashboard/src/components/portal/WalletPanel.tsx` (lines 17–48, 269–394)

**Dynamic import wrapper pattern** (line 681 of auth/page.tsx — same technique):
```typescript
import dynamic from 'next/dynamic';
// TipPanel is exported as dynamic to prevent SSR (wagmi requires browser context)
export default dynamic(() => import('./TipPanelInner'), { ssr: false });
```

**wagmi imports pattern** (lines 17–23 of WalletPanel.tsx):
```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
```

**USDT constants pattern** (lines 28–48 of WalletPanel.tsx — copy verbatim):
```typescript
const USDT_ADDR: Record<number, `0x${string}`> = {
    [mainnet.id]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};
const ERC20_ABI = [
    { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
      inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
      outputs: [{ type: 'bool' }] },
] as const;
```

**USDT transfer hook pattern** (lines 283–290 of WalletPanel.tsx):
```typescript
const { writeContract, data: usdtTxHash, isPending: sendingUsdt } = useWriteContract();
const { isSuccess, isError } = useWaitForTransactionReceipt({ hash: usdtTxHash });

// On Confirm Tip:
writeContract({
    address: usdtAddr,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [nousWalletAddress as `0x${string}`, parseUnits(selectedAmount.toString(), 6)],
});
```

**State pattern for pending/confirmed** (lines 292–340 of WalletPanel.tsx — useEffect tracking):
```typescript
useEffect(() => {
    if (isSuccess) {
        onClose();  // close panel
        onTipConfirmed(selectedAmount);  // insert system message in thread
    }
    if (isError) setTipError('Transaction failed — please try again.');
}, [isSuccess, isError]);
```

**Panel positioning pattern** (from UI-SPEC Pitfall 3 + ConversationPane must have `position: relative`):
```typescript
// TipPanel root:
<div style={{
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    background: 'var(--parchment)',
    borderTop: '1px solid var(--rule)',
    padding: '24px 16px 16px',
    boxShadow: '0 -4px 20px rgba(11,18,32,0.08)',
    // Slide-up animation: translateY(100%) → translateY(0), 200ms ease-out
    transform: 'translateY(0)',
    transition: 'transform 0.2s ease-out',
}}>
```

---

### `dashboard/src/app/portal/chat/ChatInput.tsx` (component, event-driven)

**Analog:** `dashboard/src/components/portal/WalletPanel.tsx` (lines 228–239, 551–558)

**inputStyle pattern** (lines 228–239 of WalletPanel.tsx — adapt for textarea):
```typescript
const inputStyle: React.CSSProperties = {
    flex: 1,
    background: 'var(--vellum)',
    border: '1px solid var(--rule)',
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 16,
    fontFamily: 'var(--sans-portal)',
    color: 'var(--ink)',
    outline: 'none',
    resize: 'none',
    minHeight: 44,
    maxHeight: 120,
    overflowY: 'auto',
};
// Focus border: 'var(--terracotta-2)' — set via onFocus/onBlur state toggle
// Disabled: opacity: 0.50, cursor: 'not-allowed'
```

---

### `dashboard/src/app/portal/chat/LoadingBubble.tsx` (component, display)

**Analog:** `dashboard/src/components/portal/WalletPanel.tsx` (lines 128–136 — portal-pulse skeleton)

**portal-pulse animation pattern** (lines 128–136 of WalletPanel.tsx):
```typescript
<div style={{
    height: 28,
    width: 100,
    borderRadius: 4,
    background: 'var(--parchment-2)',
    animation: 'portal-pulse 1.4s ease-in-out infinite',
}} />
```

**3-dot loading pattern** (from RESEARCH.md Pattern 8 + globals.css line 86 `portal-pulse` keyframe):
```typescript
// Three 6px circles with staggered portal-pulse animation
{[0, 0.15, 0.30].map((delay, i) => (
    <div key={i} style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--muted)',
        animation: `portal-pulse 0.8s ease-in-out ${delay}s infinite`,
    }} />
))}
// Below dots: "[Name] is thinking…" — sans 13px 400 italic, var(--muted)
```

---

### `dashboard/src/app/portal/chat/NousCard.tsx` (component, event-driven)

**Analog:** `dashboard/src/components/portal/WalletPanel.tsx` (lines 165–224 — TxRow sub-component pattern)

**Sub-component function signature pattern** (lines 165–168 of WalletPanel.tsx):
```typescript
function NousCard({ nous, isSelected, onClick }: {
    nous: NousRosterEntry;
    isSelected: boolean;
    onClick: () => void;
}) { ... }
```

**Selected state border pattern** (from UI-SPEC NousCard states):
```typescript
style={{
    padding: '12px 16px',
    borderRadius: 8,
    border: isSelected ? `1px solid var(--rule)` : '1px solid transparent',
    borderLeft: isSelected ? `3px solid var(--${nousAccentVar})` : '1px solid transparent',
    background: isSelected ? 'var(--parchment-2)' : 'transparent',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s',
}}
```
Where `nousAccentVar` is `'bronze'` for Sophia, `'terracotta'` for Hermes, `'navy'` for Themis.

---

### `dashboard/src/app/portal/nous/[id]/ProfileTabBar.tsx` (component, event-driven)

**Analog:** `dashboard/src/components/portal/WalletPanel.tsx` (lines 524–547 — asset tab switcher)

**Tab switcher pattern** (lines 524–547 of WalletPanel.tsx — exact structure):
```typescript
// Existing pattern (ETH / USDT asset toggle):
<div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
    {(['ETH', 'USDT'] as Asset[]).map(a => (
        <button
            key={a}
            onClick={() => setAsset(a)}
            style={{
                padding: '6px 16px',
                borderRadius: 4,
                border: '1px solid',
                borderColor: asset === a ? 'var(--terracotta)' : 'var(--rule)',
                background: asset === a ? 'var(--terracotta)' : 'transparent',
                color: asset === a ? '#faf6ec' : 'var(--muted)',
                fontFamily: 'var(--mono-portal)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
            }}
        >
            {a}
        </button>
    ))}
</div>

// Phase 27 adaptation (Skills / Lore / Norms tabs per UI-SPEC):
// - Tab: sans 13px 600, var(--muted) → var(--ink) on active
// - Active indicator: borderBottom: '2px solid var(--terracotta-2)'
// - Container: display: flex; borderBottom: '1px solid var(--rule)'
```

---

### `dashboard/src/components/portal/avatars/SophiaAvatar.tsx` (component/SVG, display)

**Analog:** `dashboard/src/app/portal/chat/page.tsx` (lines 47–49 — inline SVG pattern)

**Inline SVG component pattern** (lines 47–49 of placeholder chat page):
```typescript
<svg width={22} height={22} viewBox="0 0 24 24" fill="none"
     stroke="currentColor" strokeWidth={1.5}
     style={{ color: 'var(--bronze)' }}>
    <path ... />
</svg>
```

**Props pattern** (from UI-SPEC avatar section):
```typescript
// All three avatars share this interface
interface AvatarProps {
    size?: number;         // default 44 (sidebar), also used at 20px (bubble) and 80px (hero)
    style?: React.CSSProperties;
}

export function SophiaAvatar({ size = 44, style }: AvatarProps) {
    return (
        <svg
            viewBox="0 0 44 44"
            width={size}
            height={size}
            style={style}
            aria-hidden="true"
        >
            {/* Background circle: fill: rgba(138,106,59,0.10), r=20 */}
            {/* Outer arc: stroke: var(--bronze), strokeWidth: 2, fill: none */}
            {/* Inner arc: stroke: var(--bronze), strokeWidth: 2, fill: none */}
            {/* Vertical staff: stroke: var(--bronze), strokeWidth: 2 */}
            {/* Small circle at intersection: fill: var(--bronze), r=2 */}
        </svg>
    );
}
```

**Color binding pattern** (CSS variables in SVG — no hardcoded hex):
```typescript
// Sophia: stroke="var(--bronze)" / fill="var(--bronze)"
// Hermes: stroke="var(--terracotta)" / fill="var(--terracotta)"
// Themis: stroke="var(--navy)" / fill="var(--navy)"
// Background tint circle: rgba of the same color at 0.10 opacity
```

---

### `dashboard/src/app/portal/nous/[id]/SkillsTab.tsx` (component, request-response)

**Analog:** `dashboard/src/components/portal/WalletPanel.tsx` (lines 165–224 — TxRow list with fetch)

**Fetch-on-mount pattern** (from auth page useEffect lines 97–113 — adapt for skills):
```typescript
const [skills, setSkills] = useState<SkillEntry[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
    const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
    fetch(`${gridBase}/api/v1/portal/nous/${nousId}/skills`, { credentials: 'include' })
        .then(r => r.json())
        .then((data: { skills: SkillEntry[] }) => setSkills(data.skills))
        .catch(() => setSkills([]))
        .finally(() => setLoading(false));
}, [nousId]);
```

**Skeleton loading pattern** (WalletPanel.tsx lines 128–136 — portal-pulse):
```typescript
// Loading: 3 skeleton rows
{loading && Array.from({ length: 3 }).map((_, i) => (
    <div key={i} style={{
        background: 'var(--parchment-2)',
        borderRadius: 4,
        height: 20,
        animation: 'portal-pulse 1.2s infinite',
        marginBottom: 8,
    }} />
))}
```

**Row pattern** (WalletPanel.tsx TxRow lines 169–224 — adapt columns):
```typescript
// SkillRow: flex, space-between, borderBottom: '1px solid var(--rule)', padding: '13px 0'
// Left: source badge (mono 13px 600) + skill name (sans 16px 400)
// Right: tick value (mono 13px 400, var(--muted))
```

---

### `dashboard/src/app/portal/nous/[id]/LoreTab.tsx` (component, request-response)

**Analog:** `dashboard/src/components/portal/WalletPanel.tsx` (TxRow list + pagination)

**"Load more" button pattern** (from UI-SPEC — adapt WalletPanel load-more concept):
```typescript
// Cursor-based: API returns { entries: [...], cursor?: string }
const [cursor, setCursor] = useState<string | null>(null);
const [hasMore, setHasMore] = useState(false);

// Load more:
<button
    onClick={() => loadMore(cursor)}
    style={{
        padding: '10px 20px',
        borderRadius: 8,
        border: '1px solid var(--rule)',
        background: 'transparent',
        fontFamily: 'var(--sans-portal)',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--muted)',
        cursor: 'pointer',
        display: 'block',
        margin: '16px auto 0',
    }}
>
    Load more lore
</button>
```

**Expand/collapse chevron pattern** (inline — no external icon library):
```typescript
// Chevron SVG (16x16, rotates 180° when expanded)
<svg width={16} height={16} viewBox="0 0 24 24" fill="none"
     stroke="currentColor" strokeWidth={2}
     style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: 'var(--muted)' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
</svg>
```

**CRITICAL — Lore body constraint:** `lore_commons` stores only `{content_hash, category_tag, contributed_tick, citation_count}` — NO prose body. The Grid endpoint returns only metadata. The Lore tab cannot show body text without a Brain proxy endpoint. Display: category badge + tick + citation count + truncated hash. Planner must resolve the body text gap (Open Question 1 from RESEARCH.md).

---

### `dashboard/src/app/portal/nous/[id]/NormsTab.tsx` (component, request-response)

**Analog:** `dashboard/src/components/portal/WalletPanel.tsx` (TxRow list)

**Badge pattern** (from UI-SPEC NormRow — same style as SkillRow source badge):
```typescript
// Convergence badge: mono 13px 600, var(--parchment) bg, var(--rule) border
// Status badge (CRYSTALLIZED): color: var(--terracotta-2), borderColor: var(--terracotta-2)
// Status badge (CANDIDATE): color: var(--muted)
const badgeBase: React.CSSProperties = {
    fontFamily: 'var(--mono-portal)',
    fontSize: 13,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--rule)',
    background: 'var(--parchment)',
    textTransform: 'uppercase',
};
```

**NormRow column layout** (from UI-SPEC Norms Tab):
```typescript
// Row: display: flex, alignItems: center, gap: 12, padding: '13px 0',
//      borderBottom: '1px solid var(--rule)', flexWrap: wrap
// 1. Fingerprint: mono 13px 400, var(--muted) — first4 + "…" + last4
// 2. Convergence badge
// 3. Status badge
// 4. "{N} Nous" — sans 13px 400, var(--muted)
// 5. "T{start}–T{end}" — mono 13px 400, var(--muted)
const truncFingerprint = (fp: string) => `${fp.slice(0, 4)}…${fp.slice(-4)}`;
```

---

## Shared Patterns

### CSS Variables — Portal Light Palette
**Source:** `dashboard/src/components/portal/WalletPanel.tsx` (throughout), `dashboard/src/app/globals.css`
**Apply to:** ALL Phase 27 dashboard components

```typescript
// Correct — always inline style with CSS vars:
style={{ color: 'var(--ink)', fontFamily: 'var(--serif)' }}

// FORBIDDEN — never raw hex, never Tailwind color tokens:
// style={{ color: '#0b1220' }}
// className="text-slate-700 bg-amber-100"
```

Key variables for Phase 27:
- `--ink` `#0b1220` — primary text
- `--muted` `rgba(11,18,32,0.50)` — secondary text, metadata
- `--parchment` `#f1ead8` — sidebar, cards, headers, tip panel
- `--parchment-2` `#e8dfc8` — selected card, hover, skeleton
- `--vellum` `#faf6ec` — page background, conversation pane, inputs
- `--rule` `rgba(11,18,32,0.12)` — borders, dividers
- `--terracotta-2` `#d97a4f` — primary CTA buttons, active tab underline, focus ring
- `--terracotta` `#b8542f` — Hermes avatar, error state text
- `--bronze` `#8a6a3b` — Sophia avatar
- `--navy` `#16213d` — Themis avatar
- `--serif` `"Cormorant Garamond", Georgia, serif` — Nous names, chat bubbles
- `--sans-portal` `"Inter Tight", "Helvetica Neue", Arial, sans-serif` — chrome, buttons
- `--mono-portal` `"JetBrains Mono", ui-monospace, monospace` — ticks, hashes, badges

### Authentication Guard (Grid Routes)
**Source:** `grid/src/api/portal/chat.ts` (lines 52–59), `grid/src/api/portal/wallet.ts` (lines 30–44)
**Apply to:** All new Grid portal routes (`nous.ts`, extended `chat.ts`)

```typescript
const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
if (!token) return reply.status(401).send({ error: 'not_authenticated' });
let humanDid: string;
try {
    const { publicKey } = await keyPairPromise;
    const { payload } = await jwtVerify(token, publicKey);
    humanDid = payload['did'] as string;
    if (typeof humanDid !== 'string' || !humanDid.startsWith('did:noesis:')) {
        return reply.status(401).send({ error: 'invalid_token' });
    }
} catch {
    return reply.status(401).send({ error: 'invalid_token' });
}
```

### Sole Producer Discipline (Audit Chain)
**Source:** `grid/src/audit/append-human-transferred.ts` (lines 1–106)
**Apply to:** `grid/src/audit/append-human-spoke.ts`

8 mandatory steps, verified against source:
1. Type guard: plain object check (`null` + `typeof` + `Array.isArray`)
2. Regex guard: `human_did` against `DID_RE` (imported from `append-human-joined.ts`)
3. Regex guard: `nous_did` against `DID_RE`
4. Format guard: `msg_hash` against `HEX64_RE` (64 lowercase hex chars)
5. Non-negative integer guard: `tick`
6. Closed-tuple check: `Object.keys(payload).sort()` vs `EXPECTED_KEYS` (alphabetical)
7. Explicit reconstruction: named key assignment — NO `...spread`
8. `payloadPrivacyCheck(cleanPayload)` before `audit.append()`

### Brain HTTP Auth Gate
**Source:** `brain/src/noesis_brain/http/cognitive_snapshot.py` (lines 53–55)
**Apply to:** `brain/src/noesis_brain/http/skills_lookup.py`

```python
if request.headers.get("X-Brain-Secret", "") != secret:
    raise web.HTTPUnauthorized()
```

### Brain Closed-Key Response Validation (Grid Client)
**Source:** `grid/src/api/operator/cognitive-snapshot-client.ts` (lines 126–138)
**Apply to:** Grid proxy call in `nous.ts` skill lookup

```typescript
const actualKeys = Object.keys(body as Record<string, unknown>).sort();
if (actualKeys.length !== EXPECTED_SKILL_KEYS.length ||
    !actualKeys.every((k, i) => k === EXPECTED_SKILL_KEYS[i])) {
    return null; // fallback to truncated hash — do not propagate
}
```

### Grid Fetch from Dashboard
**Source:** `dashboard/src/components/portal/WalletPanel.tsx` (lines 86–98), `dashboard/src/app/portal/auth/page.tsx` (lines 119–131)
**Apply to:** All dashboard fetch calls to Grid

```typescript
const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
await fetch(`${gridBase}/api/v1/portal/...`, {
    method: 'POST',  // or GET
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // sends noesis_portal_token cookie
    body: JSON.stringify({ ... }),  // only for POST
});
```

### portal-pulse Loading Animation
**Source:** `dashboard/src/components/portal/WalletPanel.tsx` (lines 128–136), `dashboard/src/app/globals.css` (line 86)
**Apply to:** `LoadingBubble.tsx`, `SkillsTab.tsx` skeleton rows, `HeroCard.tsx` loading skeleton

```typescript
animation: 'portal-pulse 1.4s ease-in-out infinite'
// or staggered for 3-dot:
animation: `portal-pulse 0.8s ease-in-out ${delay}s infinite`
```

### wagmi SSR Prevention
**Source:** `dashboard/src/app/portal/auth/page.tsx` (line 681)
**Apply to:** `TipPanel.tsx` (wagmi hooks require browser context)

```typescript
export default dynamic(() => import('./TipPanelInner'), { ssr: false });
// Or the auth page pattern:
export default dynamic(() => Promise.resolve({ default: TipPanelInner }), { ssr: false });
```

---

## No Analog Found

All files have close analogs. No entries.

---

## Critical Anti-Patterns to Flag for Planner

| Anti-Pattern | File Affected | Source of Truth |
|---|---|---|
| Using `message_hash` as audit payload key | `append-human-spoke.ts` | `broadcast-allowlist.ts` FORBIDDEN_KEY_PATTERN — `message` substring matches; use `msg_hash` |
| `detectClose()` in general chat route | `chat.ts` (extended) | `detectClose` is onboarding-only; general chat always returns `done: false` |
| Missing `position: relative` on ConversationPane | `ConversationPane.tsx` | TipPanel uses `position: absolute; bottom: 100%` — parent must be `position: relative` |
| Auto-greeting re-fires on localStorage re-open | `chat/page.tsx` | Check `messages.length === 0` AFTER loading localStorage; fire greeting only on empty |
| Lore body text fetched from Grid | `LoreTab.tsx`, `nous.ts` | `lore_commons` has no prose body — "lore body never crosses wire" STATE.md invariant |
| `height: 100%; overflow: hidden` missing on chat root | `chat/page.tsx` | PortalShell `<main>` has `overflow-y: auto`; chat page must own its scroll context |
| Tailwind color class tokens | any dashboard component | Use `style={{ color: 'var(--ink)' }}` — never `className="text-slate-700"` |

---

## Metadata

**Analog search scope:** `dashboard/src/`, `grid/src/`, `brain/src/`
**Files scanned:** 9 primary analog files read in full
**Pattern extraction date:** 2026-05-23
