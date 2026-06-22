# O2c-a — Portal↔Nous conversation store — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** The substrate for the human↔Nous chat the operator described ("talking with user"). A persistent **conversation thread** between a human owner and their Nous: each side posts messages, both read the thread. This slice is the store + migration; the human-facing routes (with Portal auth + ownership check) are **O2c-b**, and the Nous-side read rides the existing Phase-41 inbox path.

**Architecture:** Grid-side `conversation_messages` table (migration **v53**) keyed by the `(human_did, nous_did)` pair + `ConversationStore`: `postMessage` (human or nous appends), `listThread` (read the pair's conversation), `listPartners` (the Nous DIDs a human has talked with — for a conversation list). Mirrors the established store idiom. **Private + allowlist +0** — chat content stays off the audit chain (same privacy posture as whispers / interior contents per the project invariants); no audit events.

**Tech Stack:** TypeScript ESM (NodeNext, `.js`), MySQL `mysql2/promise`, Vitest mock-Pool. Run from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**).

**Invariants:** chat content is **never** on the audit chain (private message store, like the Phase-42 whisper relay); `sender ∈ {human, nous}`; non-empty text; bounded reads (LIMIT); distinct from the Phase-41 Nous↔Nous `civic_message_queue` (different participants + a persistent readable thread). Existing suites green.

---

## File Structure
| File | Action |
|---|---|
| `grid/src/db/schema.ts` | **Modify** — append migration **v53** `conversation_messages` |
| `grid/src/economy/conversation-store.ts` | **Create** — `ConversationStore` |
| `grid/test/economy/conversation-store.test.ts` | **Create** — migration + store tests |

(Under `economy/` with the other civic stores, for consistency; it's the human↔Nous channel for the consult-on-economic-decisions flow O2 enables.)

---

## Task 1: Migration v53 + ConversationStore

- [ ] **Step 1: Failing tests** — `grid/test/economy/conversation-store.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { ConversationStore } from '../../src/economy/conversation-store.js';

describe('migration v53 — conversation_messages', () => {
    it('creates the conversation table', () => {
        const m = MIGRATIONS.find((x) => x.version === 53);
        expect(m, 'v53 must exist').toBeDefined();
        expect(m!.name).toBe('create_conversation_messages');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS conversation_messages');
        expect(m!.up).toContain('sender');
        expect(m!.up).toContain('human_did');
        expect(m!.up).toContain('nous_did');
        expect(m!.down).toContain('DROP TABLE IF EXISTS conversation_messages');
    });
    it('migration v53 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 53)).toHaveLength(1);
    });
});

function mockPool(rows: unknown[] = []): { pool: Pool; calls: () => string[] } {
    const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve([rows as RowDataPacket[], {}]); });
    return { pool: { query } as unknown as Pool, calls: () => sql };
}

describe('ConversationStore', () => {
    it('postMessage inserts a thread message', async () => {
        const m = mockPool();
        await new ConversationStore(m.pool).postMessage({ gridName: 'g', messageId: 'm1', humanDid: 'did:civic:noesis:human:h', nousDid: 'did:civic:noesis:n', sender: 'human', text: 'should we sell 5 ETH of compute?', tick: 10 });
        expect(m.calls()[0]).toContain('INSERT INTO conversation_messages');
    });
    it('postMessage rejects an invalid sender', async () => {
        await expect(new ConversationStore(mockPool().pool).postMessage({ gridName: 'g', messageId: 'm1', humanDid: 'h', nousDid: 'n', sender: 'robot' as never, text: 'hi', tick: 10 })).rejects.toThrow('invalid_sender');
    });
    it('postMessage rejects empty text', async () => {
        await expect(new ConversationStore(mockPool().pool).postMessage({ gridName: 'g', messageId: 'm1', humanDid: 'h', nousDid: 'n', sender: 'human', text: '   ', tick: 10 })).rejects.toThrow('empty_text');
    });
    it('listThread reads the human↔nous pair in order', async () => {
        const m = mockPool([{ message_id: 'm1', sender: 'human', text: 'hi', tick: 10 }]);
        const thread = await new ConversationStore(m.pool).listThread('g', 'did:civic:noesis:human:h', 'did:civic:noesis:n');
        expect(thread).toHaveLength(1);
        expect(m.calls()[0]).toContain('FROM conversation_messages');
        expect(m.calls()[0]).toContain('human_did = ?');
        expect(m.calls()[0]).toContain('nous_did = ?');
    });
    it('listPartners returns the distinct nous a human has talked with', async () => {
        const m = mockPool([{ nous_did: 'did:civic:noesis:n' }]);
        const partners = await new ConversationStore(m.pool).listPartners('g', 'did:civic:noesis:human:h');
        expect(partners).toEqual(['did:civic:noesis:n']);
        expect(m.calls()[0]).toContain('DISTINCT');
    });
});
```

- [ ] **Step 2: Verify fail** — `npx vitest run test/economy/conversation-store.test.ts` → FAIL.

- [ ] **Step 3: Append migration v53** to `MIGRATIONS` in `grid/src/db/schema.ts` (confirm v52 is current max):

```ts
    {
        version: 53,
        name: 'create_conversation_messages',
        up: `
            CREATE TABLE IF NOT EXISTS conversation_messages (
                message_id  CHAR(36)     NOT NULL,
                grid_name   VARCHAR(63)  NOT NULL,
                human_did   VARCHAR(255) NOT NULL,
                nous_did    VARCHAR(255) NOT NULL,
                sender      ENUM('human','nous') NOT NULL,
                text        TEXT         NOT NULL,
                tick        BIGINT       NOT NULL,
                created_at  BIGINT       NOT NULL,
                PRIMARY KEY (message_id),
                INDEX idx_thread (grid_name, human_did, nous_did, tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS conversation_messages`,
    },
```

- [ ] **Step 4: Create `grid/src/economy/conversation-store.ts`**:

```ts
/**
 * O2c — Portal↔Nous conversation: the persistent human↔Nous chat thread (the
 * "talking with user" channel; pairs with the O2 approval gate so a human can
 * discuss a big decision before approving it). Keyed by (human_did, nous_did).
 *
 * PRIVATE: chat content NEVER crosses the audit boundary (same posture as the
 * Phase-42 whisper relay + interior contents). No audit events, allowlist +0.
 * Distinct from the Phase-41 Nous↔Nous civic_message_queue (different participants,
 * a persistent readable thread for both sides).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface ConversationMessageRow {
    message_id: string; sender: 'human' | 'nous'; text: string; tick: number;
}

export class ConversationStore {
    constructor(private readonly pool: Pool) {}

    /** Append a message to the human↔nous thread (sender = 'human' | 'nous'). */
    async postMessage(p: { gridName: string; messageId: string; humanDid: string; nousDid: string; sender: 'human' | 'nous'; text: string; tick: number }): Promise<void> {
        if (p.sender !== 'human' && p.sender !== 'nous') throw new Error('invalid_sender');
        if (!p.text || p.text.trim() === '') throw new Error('empty_text');
        await this.pool.query(
            `INSERT INTO conversation_messages (message_id, grid_name, human_did, nous_did, sender, text, tick, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.messageId, p.gridName, p.humanDid, p.nousDid, p.sender, p.text, p.tick, p.tick],
        );
    }

    /** Read the conversation between a human and a nous, oldest-first (bounded). */
    async listThread(gridName: string, humanDid: string, nousDid: string, limit = 200): Promise<ConversationMessageRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT message_id, sender, text, tick FROM conversation_messages
             WHERE grid_name = ? AND human_did = ? AND nous_did = ? ORDER BY tick ASC LIMIT ?`,
            [gridName, humanDid, nousDid, limit],
        );
        return rows as unknown as ConversationMessageRow[];
    }

    /** The distinct Nous a human has conversed with (for a conversation list). */
    async listPartners(gridName: string, humanDid: string): Promise<string[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT DISTINCT nous_did FROM conversation_messages WHERE grid_name = ? AND human_did = ? LIMIT 200`,
            [gridName, humanDid],
        );
        return (rows as unknown as { nous_did: string }[]).map((r) => r.nous_did);
    }
}
```

- [ ] **Step 5: Verify pass** — `npx vitest run test/economy/conversation-store.test.ts` → migration + store tests pass.
- [ ] **Step 6: Full economy suite + typecheck** — `npx vitest run test/economy/` (no regression) then `npm run typecheck 2>/dev/null || npx tsc --noEmit`.
- [ ] **Step 7: Commit**

```bash
git add grid/src/db/schema.ts grid/src/economy/conversation-store.ts grid/test/economy/conversation-store.test.ts
git commit -m "feat(grid): O2c-a ConversationStore — private human↔Nous chat thread (migration v53)

Persistent (human_did, nous_did) thread; post/listThread/listPartners. Private —
chat content off the audit chain (allowlist +0). Human-facing routes are O2c-b.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review
**1. Coverage:** the human↔Nous thread substrate (post + read + partner list). ✓
**2. Privacy:** content never on the audit chain (no audit events; allowlist +0) — matches the whisper/interior posture. ✓
**3. Type/name consistency:** `ConversationStore` methods, columns (`human_did`/`nous_did`/`sender`/`text`/`tick`), errors `invalid_sender`/`empty_text`, sender union. ✓
**4. Distinct from Phase-41:** different participants (human↔Nous) + a persistent readable thread; documented. ✓
**5. Scope:** store only; human-auth routes (O2c-b, with ownership check) + Nous-side delivery deferred. ✓
