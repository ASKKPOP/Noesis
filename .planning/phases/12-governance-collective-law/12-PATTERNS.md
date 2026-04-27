# Phase 12: Governance & Collective Law — Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 22 new/modified files
**Analogs found:** 20 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/governance/types.ts` | model | transform | `grid/src/whisper/types.ts` | exact |
| `grid/src/governance/config.ts` | config | — | `grid/src/whisper/config.ts` | exact |
| `grid/src/governance/appendProposalOpened.ts` | utility (sole-producer) | request-response | `grid/src/whisper/appendNousWhispered.ts` | exact |
| `grid/src/governance/appendBallotCommitted.ts` | utility (sole-producer) | request-response | `grid/src/whisper/appendNousWhispered.ts` | exact |
| `grid/src/governance/appendBallotRevealed.ts` | utility (sole-producer) | request-response | `grid/src/whisper/appendNousWhispered.ts` | exact |
| `grid/src/governance/appendProposalTallied.ts` | utility (sole-producer) | event-driven | `grid/src/whisper/appendNousWhispered.ts` | role-match |
| `grid/src/governance/appendLawTriggered.ts` | utility (sole-producer) | event-driven | `grid/src/whisper/appendNousWhispered.ts` | role-match (NEW — no prior law.triggered emitter) |
| `grid/src/governance/commit-reveal.ts` | utility | transform | `grid/src/whisper/crypto.ts` | role-match |
| `grid/src/governance/tally.ts` | utility | transform | `grid/src/whisper/rate-limit.ts` | role-match |
| `grid/src/governance/GovernanceEngine.ts` | service | event-driven | `grid/src/dialogue/aggregator.ts` | role-match |
| `grid/src/api/governance/routes.ts` | route | request-response | `grid/src/api/whisper/routes.ts` | exact |
| `grid/src/api/governance/propose.ts` | controller | request-response | `grid/src/api/whisper/send.ts` | exact |
| `grid/src/api/governance/commit.ts` | controller | request-response | `grid/src/api/whisper/send.ts` | role-match |
| `grid/src/api/governance/reveal.ts` | controller | request-response | `grid/src/api/whisper/ack.ts` | role-match |
| `grid/src/api/governance/body.ts` | controller | request-response | `grid/src/api/whisper/pending.ts` | role-match |
| `grid/src/api/governance/history.ts` | controller | request-response | `grid/src/api/operator/governance-laws.ts` | role-match (tier-gated) |
| `grid/src/db/schema.ts` (MODIFIED) | config/migration | CRUD | `grid/src/db/schema.ts` itself | exact (extend MIGRATIONS array) |
| `brain/src/noesis_brain/governance/commit_reveal.py` | utility | transform | `brain/src/noesis_brain/whisper/sender.py` | role-match |
| `brain/src/noesis_brain/governance/voter.py` | service | event-driven | `brain/src/noesis_brain/whisper/sender.py` | role-match |
| `dashboard/src/app/grid/governance/page.tsx` | component | request-response | `dashboard/src/app/grid/economy/economy-panel.tsx` | role-match (no relationships/page.tsx exists) |
| `dashboard/src/lib/stores/governanceStore.ts` | store | event-driven | `dashboard/src/lib/stores/whisperStore.ts` | exact |
| `scripts/check-governance-isolation.mjs` | config/CI | — | `scripts/check-whisper-plaintext.mjs` | exact |

---

## Pattern Assignments

### `grid/src/governance/types.ts` (model, transform)

**Analog:** `grid/src/whisper/types.ts`

**Full pattern** (lines 1-39):
```typescript
/**
 * SYNC: mirrors dashboard/src/lib/protocol/governance-types.ts
 *
 * No runtime side-effectful code in this file. Types and tuples only.
 * NO Date.now, NO Math.random (wall-clock ban).
 */

/** Closed 6-key payload for 'proposal.opened' audit event. Keys alphabetical. */
export interface ProposalOpenedPayload {
    readonly deadline_tick: number;
    readonly proposal_id: string;
    readonly proposer_did: string;
    readonly quorum_pct: number;
    readonly supermajority_pct: number;
    readonly title_hash: string;
}
export const PROPOSAL_OPENED_KEYS = [
    'deadline_tick', 'proposal_id', 'proposer_did', 'quorum_pct', 'supermajority_pct', 'title_hash'
] as const;

/** Closed 3-key payload for 'ballot.committed'. Keys alphabetical. */
export interface BallotCommittedPayload {
    readonly commit_hash: string;
    readonly proposal_id: string;
    readonly voter_did: string;
}
export const BALLOT_COMMITTED_KEYS = ['commit_hash', 'proposal_id', 'voter_did'] as const;

/** Closed 4-key payload for 'ballot.revealed'. Keys alphabetical. */
export interface BallotRevealedPayload {
    readonly choice: string;         // 'yes' | 'no' | 'abstain'
    readonly nonce: string;          // 32 hex chars
    readonly proposal_id: string;
    readonly voter_did: string;
}
export const BALLOT_REVEALED_KEYS = ['choice', 'nonce', 'proposal_id', 'voter_did'] as const;

/** Closed 6-key payload for 'proposal.tallied'. Keys alphabetical. */
export interface ProposalTalliedPayload {
    readonly abstain_count: number;
    readonly no_count: number;
    readonly outcome: string;        // 'passed' | 'rejected' | 'quorum_fail'
    readonly proposal_id: string;
    readonly quorum_met: boolean;
    readonly yes_count: number;
}
export const PROPOSAL_TALLIED_KEYS = [
    'abstain_count', 'no_count', 'outcome', 'proposal_id', 'quorum_met', 'yes_count'
] as const;

/** Closed 3-key payload for 'law.triggered'. Keys alphabetical. Phase 12 defines this canonical tuple. */
export interface LawTriggeredPayload {
    readonly enacted_by: string;     // 'operator' | 'collective'
    readonly law_id: string;
    readonly title_hash: string;     // sha256(law body)[:32]
}
export const LAW_TRIGGERED_KEYS = ['enacted_by', 'law_id', 'title_hash'] as const;
```

---

### `grid/src/governance/config.ts` (config)

**Analog:** `grid/src/whisper/config.ts` (lines 1-35)

**Full pattern** (lines 1-35):
```typescript
/**
 * Governance constants (Phase 12 / D-12-03 / D-12-08).
 *
 * Quorum defaults are env-overridable. Clones grid/src/whisper/config.ts
 * Object.freeze pattern (Phase 11).
 *
 * NO Date.now, NO Math.random — wall-clock ban.
 */

const envQuorum = Number.parseInt(process.env.GOVERNANCE_DEFAULT_QUORUM_PCT ?? '', 10);
const envSupermajority = Number.parseInt(process.env.GOVERNANCE_DEFAULT_SUPERMAJORITY_PCT ?? '', 10);

export const GOVERNANCE_CONFIG = Object.freeze({
    defaultQuorumPct: Number.isInteger(envQuorum) && envQuorum > 0 && envQuorum <= 100 ? envQuorum : 50,
    defaultSupermajorityPct: Number.isInteger(envSupermajority) && envSupermajority > 0 && envSupermajority <= 100 ? envSupermajority : 67,
} as const);

/**
 * Forbidden keys for governance payloads — proposal body must NEVER appear in
 * any audit payload. D-12-04: 8 flat + nested variants.
 * See: check-governance-plaintext.mjs FORBIDDEN_KEY_PATTERN.
 */
export const GOVERNANCE_FORBIDDEN_KEYS = Object.freeze([
    'text',
    'body',
    'content',
    'description',
    'rationale',
    'proposal_text',
    'law_text',
    'body_text',
] as const);
```

---

### `grid/src/governance/appendProposalOpened.ts` (sole-producer, request-response)

**Analog:** `grid/src/whisper/appendNousWhispered.ts` (full file, 165 lines)

**Imports pattern** (lines 32-35):
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { GOVERNANCE_FORBIDDEN_KEYS } from './config.js';
import { PROPOSAL_OPENED_KEYS, type ProposalOpenedPayload } from './types.js';
```

**DID regex + privacy check** (lines 46-60):
```typescript
// Governance-specific privacy check using exact key matching.
// Clone of whisperPrivacyCheck in appendNousWhispered.ts lines 46-60.
function govPrivacyCheck(payload: Record<string, unknown>): { ok: boolean; offendingPath?: string } {
    const forbidden = new Set<string>(GOVERNANCE_FORBIDDEN_KEYS);
    for (const key of Object.keys(payload)) {
        if (forbidden.has(key)) return { ok: false, offendingPath: key };
        const val = payload[key];
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            const sub = govPrivacyCheck(val as Record<string, unknown>);
            if (!sub.ok) return { ok: false, offendingPath: `${key}.${sub.offendingPath}` };
        }
    }
    return { ok: true };
}

export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
export const HEX32_RE = /^[0-9a-f]{32}$/;  // title_hash is sha256[:32] = 32 hex chars
```

**Core sole-producer pattern** (lines 74-165 of analog — adapt to 6-key proposal.opened):
```typescript
export function appendProposalOpened(
    audit: AuditChain,
    actorDid: string,
    payload: ProposalOpenedPayload,
): AuditEntry {
    // 1. DID regex guard on actorDid.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendProposalOpened: invalid actorDid (DID_RE failed)`);
    }

    // 2. Closed-tuple — exactly 6 keys, alphabetical. Run BEFORE individual checks.
    const actualKeys = Object.keys(payload).sort();
    const expectedKeys = [...PROPOSAL_OPENED_KEYS].sort();
    if (actualKeys.length !== expectedKeys.length || !actualKeys.every((k, i) => k === expectedKeys[i])) {
        throw new TypeError(
            `appendProposalOpened: unexpected key set — expected ${JSON.stringify(expectedKeys)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 3. DID regex guard on payload.proposer_did.
    if (typeof payload.proposer_did !== 'string' || !DID_RE.test(payload.proposer_did)) {
        throw new TypeError(`appendProposalOpened: invalid payload.proposer_did (DID_RE failed)`);
    }

    // 4. Self-report invariant — proposer_did must equal actorDid.
    if (payload.proposer_did !== actorDid) {
        throw new TypeError(`appendProposalOpened: payload.proposer_did must equal actorDid`);
    }

    // 5. proposal_id — non-empty string (UUID v4 format not enforced here — caller provides).
    if (typeof payload.proposal_id !== 'string' || payload.proposal_id.length === 0) {
        throw new TypeError(`appendProposalOpened: invalid proposal_id`);
    }

    // 6. title_hash — 32-char lowercase hex (sha256(body_text)[:32]).
    if (typeof payload.title_hash !== 'string' || !HEX32_RE.test(payload.title_hash)) {
        throw new TypeError(`appendProposalOpened: invalid title_hash (expected 32-char lowercase hex)`);
    }

    // 7. quorum_pct — integer 1-100.
    if (!Number.isInteger(payload.quorum_pct) || payload.quorum_pct < 1 || payload.quorum_pct > 100) {
        throw new TypeError(`appendProposalOpened: quorum_pct must be integer 1-100`);
    }

    // 8. supermajority_pct — integer 1-100.
    if (!Number.isInteger(payload.supermajority_pct) || payload.supermajority_pct < 1 || payload.supermajority_pct > 100) {
        throw new TypeError(`appendProposalOpened: supermajority_pct must be integer 1-100`);
    }

    // 9. deadline_tick — non-negative integer.
    if (!Number.isInteger(payload.deadline_tick) || payload.deadline_tick < 0) {
        throw new TypeError(`appendProposalOpened: deadline_tick must be non-negative integer`);
    }

    // 10. Explicit reconstruction — prototype-pollution defense. Alphabetical insertion order.
    const cleanPayload = {
        deadline_tick: payload.deadline_tick,
        proposal_id: payload.proposal_id,
        proposer_did: payload.proposer_did,
        quorum_pct: payload.quorum_pct,
        supermajority_pct: payload.supermajority_pct,
        title_hash: payload.title_hash,
    };

    // 11. Privacy gate — governance-specific exact-key check.
    const privacy = govPrivacyCheck(cleanPayload as unknown as Record<string, unknown>);
    if (!privacy.ok) {
        throw new TypeError(`appendProposalOpened: privacy violation — path=${privacy.offendingPath}`);
    }

    // 12. Commit to chain (sole producer).
    return audit.append('proposal.opened', actorDid, cleanPayload);
}
```

**Key divergences from appendNousWhispered for other 3 emitters:**
- `appendBallotCommitted`: 3-key tuple `{commit_hash, proposal_id, voter_did}`. Add `ballotExists(proposal_id, voter_did)` check (D-12-06) BEFORE any chain append. commit_hash is 64-char hex (HEX64_RE from appendNousWhispered.ts line 66).
- `appendBallotRevealed`: 4-key tuple `{choice, nonce, proposal_id, voter_did}`. choice ∈ {yes, no, abstain}. nonce is 32-char hex. Hash-verify `sha256(choice+'|'+nonce+'|'+voter_did) === stored_commit_hash` BEFORE append; mismatch → log + throw (422 from caller, no emit).
- `appendProposalTallied`: 6-key tuple `{abstain_count, no_count, outcome, proposal_id, quorum_met, yes_count}`. outcome ∈ {passed, quorum_fail, rejected}. On `outcome === 'passed'`, call `appendLawTriggered(...)` and `LogosEngine.addLaw(...)`.

---

### `grid/src/governance/appendLawTriggered.ts` (sole-producer, event-driven)

**Analog:** `grid/src/whisper/appendNousWhispered.ts` (structural clone, new closed tuple)

**Critical note:** `law.triggered` has NO existing sole-producer in the codebase (verified by research grep). This file is Phase 12's responsibility to create. The `law.triggered` event is currently in `broadcast-allowlist.ts` lines 62-63 with no emitter.

**Imports pattern:**
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { LAW_TRIGGERED_KEYS, type LawTriggeredPayload } from './types.js';
```

**Core pattern** (adapt appendNousWhispered, 3-key tuple):
```typescript
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
export const HEX32_RE = /^[0-9a-f]{32}$/;

export function appendLawTriggered(
    audit: AuditChain,
    actorDid: string,
    payload: LawTriggeredPayload,
): AuditEntry {
    // 1. actorDid DID regex.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendLawTriggered: invalid actorDid (DID_RE failed)`);
    }
    // 2. Closed-tuple — exactly 3 keys: enacted_by, law_id, title_hash.
    const actualKeys = Object.keys(payload).sort();
    const expectedKeys = [...LAW_TRIGGERED_KEYS].sort();
    if (actualKeys.length !== expectedKeys.length || !actualKeys.every((k, i) => k === expectedKeys[i])) {
        throw new TypeError(`appendLawTriggered: unexpected key set`);
    }
    // 3. enacted_by ∈ {operator, collective}.
    if (payload.enacted_by !== 'operator' && payload.enacted_by !== 'collective') {
        throw new TypeError(`appendLawTriggered: enacted_by must be 'operator' or 'collective'`);
    }
    // 4. law_id — non-empty string.
    if (typeof payload.law_id !== 'string' || payload.law_id.length === 0) {
        throw new TypeError(`appendLawTriggered: invalid law_id`);
    }
    // 5. title_hash — 32-char lowercase hex.
    if (typeof payload.title_hash !== 'string' || !HEX32_RE.test(payload.title_hash)) {
        throw new TypeError(`appendLawTriggered: invalid title_hash`);
    }
    // 6. Explicit reconstruction.
    const cleanPayload = {
        enacted_by: payload.enacted_by,
        law_id: payload.law_id,
        title_hash: payload.title_hash,
    };
    // 7. Commit (sole producer).
    return audit.append('law.triggered', actorDid, cleanPayload);
}
```

---

### `grid/src/governance/commit-reveal.ts` (utility, transform)

**Analog:** `grid/src/whisper/crypto.ts` (sha256 using `node:crypto`, lines 27-57)

**Core pattern** (lines 27-57 of analog, adapted):
```typescript
import { createHash } from 'node:crypto';

/** 32 hex chars = 16 bytes (Brain nonce format). */
export const HEX32_RE = /^[0-9a-f]{32}$/;
/** 64 hex chars = SHA-256 output. */
export const HEX64_RE = /^[0-9a-f]{64}$/;
/** Valid vote choices. */
export const VALID_CHOICES = new Set(['yes', 'no', 'abstain']);

/**
 * Compute the commit hash for ballot verification at reveal time.
 * Formula: sha256(choice + '|' + nonce + '|' + voter_did) — pipe delimiters
 * prevent chosen-plaintext ambiguity. D-12-02.
 *
 * NO Date.now, NO Math.random — wall-clock ban.
 */
export function computeCommitHash(choice: string, nonce: string, voterDid: string): string {
    return createHash('sha256')
        .update(`${choice}|${nonce}|${voterDid}`)
        .digest('hex');
}

/**
 * Verify a revealed ballot matches the stored commit hash.
 * Returns true if valid; false on mismatch.
 */
export function verifyCommitHash(
    choice: string,
    nonce: string,
    voterDid: string,
    storedCommitHash: string,
): boolean {
    return computeCommitHash(choice, nonce, voterDid) === storedCommitHash;
}
```

---

### `grid/src/governance/tally.ts` (utility, transform)

**Analog:** `grid/src/whisper/rate-limit.ts` (pure logic class, no side effects, lines 42-80)

**Pattern** (pure deterministic class, no wall-clock, no imports of chain):
```typescript
/**
 * Pure tally computation — no MySQL, no wall-clock, no audit.
 * Clones TickRateLimiter pure-logic pattern from whisper/rate-limit.ts.
 *
 * NO Date.now, NO Math.random.
 */

export type TallyOutcome = 'passed' | 'rejected' | 'quorum_fail';

export interface TallyCounts {
    revealed: number;
    unrevealed_committed: number;
    yes_count: number;
    no_count: number;
    abstain_count: number;
    total_nous_count: number;
}

export interface TallyResult {
    outcome: TallyOutcome;
    yes_count: number;
    no_count: number;
    abstain_count: number;
    quorum_met: boolean;
}

/**
 * Pessimistic quorum: (revealed + unrevealed_committed) / total_nous_count >= quorum_pct/100.
 * D-12-03: unrevealed committed ballots count toward quorum denominator.
 */
export function computeTally(counts: TallyCounts, quorumPct: number, supermajorityPct: number): TallyResult {
    const participatingCount = counts.revealed + counts.unrevealed_committed;
    const quorum_met = total > 0 && (participatingCount / counts.total_nous_count) >= (quorumPct / 100);

    const yes_count = counts.yes_count;
    const no_count = counts.no_count;
    const abstain_count = counts.abstain_count;

    let outcome: TallyOutcome;
    if (!quorum_met) {
        outcome = 'quorum_fail';
    } else {
        const votingTotal = yes_count + no_count;  // abstain excluded from pass/fail
        const passed = votingTotal > 0 && (yes_count / votingTotal) >= (supermajorityPct / 100);
        outcome = passed ? 'passed' : 'rejected';
    }

    return { outcome, yes_count, no_count, abstain_count, quorum_met };
}
```

---

### `grid/src/governance/GovernanceEngine.ts` (service, event-driven)

**Analog:** `grid/src/dialogue/aggregator.ts` (tick-wired engine, lines 60-80)

**Constructor/field pattern** (lines 60-80 of analog, adapted):
```typescript
import type { Pool } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import type { LogosEngine } from '../logos/engine.js';
import type { NousRegistry } from '../registry/registry.js';

export class GovernanceEngine {
    constructor(
        private readonly audit: AuditChain,
        private readonly logos: LogosEngine,
        private readonly registry: NousRegistry,
        private readonly pool: Pool,
    ) {}

    /**
     * Tick hook — called by GenesisLauncher.clock.onTick() on every tick.
     * Fire-and-forget: awaited but tick is never blocked on MySQL I/O.
     * Pattern from launcher.ts lines 246-253 (RelationshipStorage snapshot).
     *
     * NO Date.now — tick is the world-clock tick from the event. D-12-03.
     */
    async onTick(currentTick: number): Promise<void> {
        // Query all open proposals whose deadline_tick <= currentTick
        // AND that have at least one revealed ballot. Then computeTally() and
        // call appendProposalTallied(). If outcome === 'passed', call
        // LogosEngine.addLaw() + appendLawTriggered().
    }
}
```

**GenesisLauncher wiring** — copy this construction pattern from launcher.ts lines 80-113:

Wire in constructor (after `this.relationships = new RelationshipListener(...)`):
```typescript
// Phase 12: GovernanceEngine construction AFTER audit + logos + registry exist.
// Pool injected at construction time (GovernanceEngine has no in-memory fallback).
// Must be constructed BEFORE bootstrap() and start() per D-9-04 ordering discipline.
// this.governance = new GovernanceEngine(this.audit, this.logos, this.registry, pool);
```

Wire in bootstrap() inside `this.clock.onTick(event => { ... })` callback (after the existing relationship snapshot block, lines 246-253):
```typescript
// Phase 12 tally trigger — fire-and-forget per OQ-2 discipline.
// Never block tick on MySQL I/O. Same pattern as relationshipStorage.scheduleSnapshot().
if (this.governance) {
    this.governance.onTick(event.tick).catch((err) => {
        console.error(JSON.stringify({ event: 'governance.tick.error', tick: event.tick, err: String(err) }));
    });
}
```

---

### `grid/src/api/governance/routes.ts` (route, request-response)

**Analog:** `grid/src/api/whisper/routes.ts` (full file, 128 lines)

**Imports + deps interface pattern** (lines 40-56):
```typescript
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { proposeHandler } from './propose.js';
import { commitHandler } from './commit.js';
import { revealHandler } from './reveal.js';
import { bodyHandler } from './body.js';
import { historyHandler } from './history.js';

export interface GovernanceRouteDeps {
    readonly audit: AuditChain;
    readonly registry: NousRegistry;  // for tombstone + DID membership checks
    readonly logos: LogosEngine;
    readonly pool: Pool;
    readonly worldClock: { currentTick(): number };
}
```

**Plugin registration pattern** (lines 84-128 of analog):
```typescript
export const governanceRoutes: FastifyPluginAsync<{ deps: GovernanceRouteDeps }> = async (
    fastify,
    { deps },
) => {
    // POST /api/v1/governance/proposals
    fastify.post('/api/v1/governance/proposals', proposeHandler(deps));

    // POST /api/v1/governance/proposals/:id/commit
    fastify.post<{ Params: { id: string } }>('/api/v1/governance/proposals/:id/commit', commitHandler(deps));

    // POST /api/v1/governance/proposals/:id/reveal
    fastify.post<{ Params: { id: string } }>('/api/v1/governance/proposals/:id/reveal', revealHandler(deps));

    // GET /api/v1/governance/proposals/:id/body (H2+ tier-gated)
    fastify.get<{ Params: { id: string } }>('/api/v1/governance/proposals/:id/body', bodyHandler(deps));

    // GET /api/v1/governance/proposals/:id/ballots/history (H5 tier-gated)
    fastify.get<{ Params: { id: string } }>('/api/v1/governance/proposals/:id/ballots/history', historyHandler(deps));
};
```

**Note:** Governance routes are NOT loopback-only (unlike whisper). Operators need read access. Brain POSTs from loopback. No per-route rate-limit decorator needed in v2.2.

---

### `grid/src/api/governance/propose.ts` (controller, request-response)

**Analog:** `grid/src/api/whisper/send.ts` (full file, 147 lines)

**DID validation + tombstone pattern** (lines 34-89 of analog):
```typescript
import { createHash, randomUUID } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { GovernanceRouteDeps } from './routes.js';

const DID_RE = /^did:noesis:[a-zA-Z0-9_\-]+$/;

interface ProposeBody {
    proposer_did?: unknown;
    body_text?: unknown;
    quorum_pct?: unknown;
    supermajority_pct?: unknown;
    deadline_tick?: unknown;
}

export function proposeHandler(deps: GovernanceRouteDeps) {
    return async (req: FastifyRequest<{ Body: ProposeBody }>, reply: FastifyReply) => {
        const body = (req.body ?? {}) as ProposeBody;

        // Validate proposer_did shape.
        const proposerDid = body.proposer_did;
        if (typeof proposerDid !== 'string' || !DID_RE.test(proposerDid)) {
            reply.code(400); return { error: 'invalid_did' };
        }

        // D-12-05: Tombstone check on proposer (registry.get(did)?.status === 'deleted').
        if (deps.registry.get(proposerDid)?.status === 'deleted') {
            reply.code(410); return { error: 'proposer_tombstoned' };
        }

        // D-12-06: Voter must be in NousRegistry (not operator ID).
        if (!deps.registry.get(proposerDid)) {
            reply.code(403); return { error: 'not_a_nous' };
        }

        // Validate body_text — required non-empty string.
        if (typeof body.body_text !== 'string' || body.body_text.length === 0) {
            reply.code(400); return { error: 'invalid_body_text' };
        }

        const proposal_id = randomUUID();  // crypto.randomUUID() — no extra dep
        const title_hash = createHash('sha256').update(body.body_text).digest('hex').slice(0, 32);
        const quorum_pct = typeof body.quorum_pct === 'number' ? body.quorum_pct : 50;
        const supermajority_pct = typeof body.supermajority_pct === 'number' ? body.supermajority_pct : 67;

        // INSERT into governance_proposals, then appendProposalOpened(...)
        // Return { proposal_id }
    };
}
```

---

### `grid/src/api/governance/reveal.ts` (controller, request-response)

**Analog:** `grid/src/api/whisper/ack.ts` (full file, 54 lines)

**Pattern** (adapted — same DID param validation + body validation):
```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { GovernanceRouteDeps } from './routes.js';
import { verifyCommitHash } from '../../governance/commit-reveal.js';

const DID_RE = /^did:noesis:[a-zA-Z0-9_\-]+$/;

interface RevealBody {
    voter_did?: unknown;
    choice?: unknown;
    nonce?: unknown;
}

export function revealHandler(deps: GovernanceRouteDeps) {
    return async (req: FastifyRequest<{ Params: { id: string }; Body: RevealBody }>, reply: FastifyReply) => {
        const proposalId = req.params.id;
        const body = (req.body ?? {}) as RevealBody;

        const voterDid = body.voter_did;
        if (typeof voterDid !== 'string' || !DID_RE.test(voterDid)) {
            reply.code(400); return { error: 'invalid_did' };
        }

        // D-12-05: Dead voter reveal rejected with 410.
        if (deps.registry.get(voterDid)?.status === 'deleted') {
            reply.code(410); return { error: 'voter_tombstoned' };
        }

        // Fetch stored commit_hash from MySQL, then:
        const storedCommitHash = /* SELECT commit_hash from governance_ballots */ '';
        const choice = body.choice as string;
        const nonce = body.nonce as string;

        // D-12-02 hash mismatch: log + 422 + NO emit.
        if (!verifyCommitHash(choice, nonce, voterDid, storedCommitHash)) {
            console.warn(JSON.stringify({ event: 'ballot_reveal_mismatch', proposal_id: proposalId, voter_did: voterDid }));
            reply.code(422); return { error: 'hash_mismatch' };
        }

        // appendBallotRevealed(...) — UPDATE revealed=1, nonce, choice in MySQL
        return { ok: true };
    };
}
```

---

### `grid/src/api/governance/body.ts` (controller, request-response)

**Analog:** `grid/src/api/whisper/pending.ts` (full file, 42 lines)

**Pattern** (DID param validation → tier gate → DB fetch):
```typescript
// Clone pendingHandler pattern. DID_RE validate → H2+ tier gate → return body_text.
// Tier gate clones governance-laws.ts validateTierBody pattern lines 33-41.
export function bodyHandler(deps: GovernanceRouteDeps) {
    return async (req: FastifyRequest<{ Params: { id: string }; Body: { tier?: unknown; operator_id?: unknown } }>, reply: FastifyReply) => {
        const { tier, operator_id } = req.body ?? {};
        // validateTierBody(body, 'H2') — must return ok before returning body_text.
        // Clone grid/src/api/operator/_validation.ts validateTierBody lines 33-41.
        // ...
        // SELECT body_text FROM governance_proposals WHERE proposal_id = req.params.id
        return { body_text: '...' };
    };
}
```

---

### `grid/src/api/governance/history.ts` (controller, request-response, tier-gated H5)

**Analog:** `grid/src/api/operator/governance-laws.ts` (tier-gated CRUD, lines 47-75)

**Tier validation pattern** (lines 54-74 of analog):
```typescript
import { validateTierBody } from '../operator/_validation.js';

export function historyHandler(deps: GovernanceRouteDeps) {
    return async (req: FastifyRequest<{ Params: { id: string }; Body: OperatorBody }>, reply: FastifyReply) => {
        const body = req.body ?? {};
        const v = validateTierBody(body, 'H5');
        if (!v.ok) {
            reply.code(400); return { error: v.error };
        }
        // SELECT all ballots for proposal_id — reveal voter_did, choice, nonce, committed_tick, revealed_tick
        return { ballots: [] };
    };
}
```

---

### `grid/src/db/schema.ts` (MODIFIED — migration version 6)

**Analog:** `grid/src/db/schema.ts` itself (full file, 103 lines)

**Append pattern** — add after version 5 entry (line 101), before closing `]`:
```typescript
{
    version: 6,
    name: 'create_governance_tables',
    up: `
        CREATE TABLE IF NOT EXISTS governance_proposals (
            grid_name         VARCHAR(63)  NOT NULL,
            proposal_id       VARCHAR(36)  NOT NULL,
            proposer_did      VARCHAR(255) NOT NULL,
            title_hash        VARCHAR(32)  NOT NULL,
            body_text         TEXT         NOT NULL,
            quorum_pct        TINYINT      NOT NULL DEFAULT 50,
            supermajority_pct TINYINT      NOT NULL DEFAULT 67,
            deadline_tick     INT UNSIGNED NOT NULL,
            status            VARCHAR(32)  NOT NULL DEFAULT 'open',
            outcome           VARCHAR(32),
            opened_at_tick    INT UNSIGNED NOT NULL,
            tallied_at_tick   INT UNSIGNED,
            PRIMARY KEY (grid_name, proposal_id),
            INDEX idx_status (grid_name, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS governance_ballots (
            grid_name       VARCHAR(63)  NOT NULL,
            proposal_id     VARCHAR(36)  NOT NULL,
            voter_did       VARCHAR(255) NOT NULL,
            commit_hash     VARCHAR(64)  NOT NULL,
            revealed        TINYINT(1)   NOT NULL DEFAULT 0,
            choice          VARCHAR(16),
            nonce           VARCHAR(32),
            committed_tick  INT UNSIGNED NOT NULL,
            revealed_tick   INT UNSIGNED,
            PRIMARY KEY (grid_name, proposal_id, voter_did),
            INDEX idx_proposal (grid_name, proposal_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    down: `
        DROP TABLE IF EXISTS governance_ballots;
        DROP TABLE IF EXISTS governance_proposals;
    `,
},
```

---

### `brain/src/noesis_brain/governance/commit_reveal.py` (utility, transform)

**Analog:** `brain/src/noesis_brain/whisper/sender.py` (hashlib + secrets pattern, lines 37-45 and 121-124)

**Pattern** (SHA-256 + nonce generation, lines 37-45 of analog adapted):
```python
"""governance/commit_reveal.py — commit-reveal hash helpers.

Phase 12 D-12-02. Clones hashlib pattern from whisper/sender.py lines 121-124.

NO datetime, NO time.time, NO random — wall-clock ban.
"""
import hashlib
import secrets

__all__ = ["make_commit_hash", "generate_nonce"]


def generate_nonce() -> str:
    """Return 32 hex chars (16 bytes) — cryptographically secure. secrets.token_hex(16).
    D-12-02: Brain generates nonce; Grid never generates nonces.
    """
    return secrets.token_hex(16)


def make_commit_hash(choice: str, nonce: str, voter_did: str) -> str:
    """sha256(choice + '|' + nonce + '|' + voter_did).hexdigest().

    Pipe delimiters prevent chosen-plaintext ambiguity (D-12-02).
    choice ∈ {yes, no, abstain}. nonce = 32 hex chars. voter_did = DID string.

    Byte-compatible with Grid TypeScript: createHash('sha256').update(raw).digest('hex').
    """
    raw = f"{choice}|{nonce}|{voter_did}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
```

---

### `brain/src/noesis_brain/governance/voter.py` (service, event-driven)

**Analog:** `brain/src/noesis_brain/whisper/sender.py` (HTTP POST + state management pattern, lines 68-153)

**ActionType enum additions pattern** (`brain/src/noesis_brain/rpc/types.py` lines 10-19):
```python
class ActionType(str, Enum):
    # ... existing entries (SPEAK, DIRECT_MESSAGE, MOVE, TRADE_REQUEST, etc.) ...
    PROPOSE = "governance_propose"       # Phase 12 D-12-07
    VOTE_COMMIT = "governance_vote_commit"  # Phase 12 D-12-07
    VOTE_REVEAL = "governance_vote_reveal"  # Phase 12 D-12-07
```

**Nonce state storage pattern** (between commit and reveal ticks):
```python
# Brain stores (proposal_id → nonce) in local state between VOTE_COMMIT and VOTE_REVEAL.
# No wall-clock — reveal fires on any tick before deadline_tick.
# Clone sender.py _counter_state dict pattern (lines 63-65) for nonce state.
_pending_reveals: dict[str, str] = {}  # proposal_id → nonce
```

**HTTP POST pattern** (clone sender.py lines 131-152):
```python
async def commit_ballot(
    *,
    voter_did: str,
    proposal_id: str,
    choice: str,
    tick: int,
    grid_base_url: str = "http://127.0.0.1:8080",
    http_client: httpx.AsyncClient | None = None,
) -> dict:
    nonce = generate_nonce()
    commit_hash = make_commit_hash(choice, nonce, voter_did)
    _pending_reveals[proposal_id] = nonce  # store for reveal tick

    body = {"voter_did": voter_did, "commit_hash": commit_hash}
    # POST to /api/v1/governance/proposals/{proposal_id}/commit
    # ... clone sender.py httpx pattern lines 141-152 ...
```

---

### `dashboard/src/app/grid/governance/page.tsx` (component, request-response)

**Analog:** `dashboard/src/app/grid/economy/economy-panel.tsx` (fetch + state + useEffect pattern, lines 1-60)

**Note:** `dashboard/src/app/grid/relationships/page.tsx` does NOT exist in the codebase. The economy panel is the closest match — it uses `fetch` + `useEffect` + per-section `Slot` state pattern. SWR is not used in any existing dashboard page; the `refreshInterval` pattern from D-12-09 must be implemented via `setInterval` + `useEffect` (the economy panel uses `useEffect` for data invalidation).

**Imports + 'use client' pattern** (lines 1-45):
```typescript
'use client';
import { useEffect, useState } from 'react';
import type { HumanAgencyTier } from '@/lib/protocol/agency-types';
import { useStores } from '../use-stores';

// Tier-gating: useStores().agency.getSnapshot() gives current H-tier.
// H2+ can see body_text; H5 can see per-Nous ballot history.
// H1 sees only title_hash + status + aggregate counts.
```

**Polling pattern** (adapt economy panel `useEffect` for 2s interval per D-12-09):
```typescript
useEffect(() => {
    let alive = true;
    async function load() {
        // fetch('/api/v1/governance/proposals')
    }
    load();
    const id = setInterval(load, 2000);  // D-12-09 refreshInterval: 2000
    return () => { alive = false; clearInterval(id); };
}, []);
```

---

### `dashboard/src/lib/stores/governanceStore.ts` (store, event-driven)

**Analog:** `dashboard/src/lib/stores/whisperStore.ts` (full file, 130 lines)

**Full pattern** (lines 1-130 of analog — adapt state shape):
```typescript
/**
 * GovernanceStore — SSR-safe singleton for governance proposal state.
 * Clone of dashboard/src/lib/stores/whisperStore.ts (Phase 11).
 * Implements subscribe/getSnapshot triad for React useSyncExternalStore.
 *
 * PRIVACY (D-12-04):
 *   - NO body_text stored here (body is H2+ tier-gated RPC, not firehose)
 *   - Stores only title_hash, status, outcome, counts from proposal.opened / proposal.tallied
 *   - NO localStorage persistence
 *
 * NO Date.now, NO Math.random.
 */

export interface ProposalSummary {
    readonly proposal_id: string;
    readonly proposer_did: string;
    readonly title_hash: string;
    readonly status: string;        // 'open' | 'tallied'
    readonly outcome?: string;      // 'passed' | 'rejected' | 'quorum_fail'
    readonly opened_at_tick: number;
    readonly deadline_tick: number;
    readonly commit_count: number;
    readonly reveal_count: number;
}

export interface GovernanceState {
    readonly proposals: readonly ProposalSummary[];
}

// subscribe/getSnapshot/notify pattern — copy verbatim from whisperStore.ts lines 55-67
```

---

### `scripts/check-governance-isolation.mjs` (CI gate)

**Analog:** `scripts/check-whisper-plaintext.mjs` (full file, 277 lines)

**Walk + scan skeleton** (lines 46-115 of analog — structural clone):
```javascript
#!/usr/bin/env node
/**
 * Phase 12 D-12-11 — Governance isolation check.
 * Three invariants:
 *   1. No import from grid/src/audit/operator-events.ts into grid/src/governance/**
 *   2. No operator.* event literal in grid/src/governance/**
 *   3. No law.triggered call from any file that imports operator-events.ts
 *
 * Clones scripts/check-whisper-plaintext.mjs skeleton (Phase 11 / Plan 11-04).
 * Exit 0: clean. Exit 1: violations printed to stderr.
 *
 * Run from repo root: node scripts/check-governance-isolation.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Patterns to check (clone FORBIDDEN_KEY_PATTERN approach):
const OPERATOR_EVENTS_IMPORT_RE = /from\s+['"][^'"]*audit\/operator-events['"]/;
const OPERATOR_EVENT_LITERAL_RE = /['"]operator\.[a-z_]+['"]/;
```

**For `check-governance-plaintext.mjs`:** Clone the full check-whisper-plaintext.mjs, replacing:
- `FORBIDDEN_KEY_PATTERN` with the governance 8-key pattern: `text|body|content|description|rationale|proposal_text|law_text|body_text`
- Scan paths: `grid/src/governance/**` + `brain/src/noesis_brain/governance/**` + `dashboard/src/app/grid/governance/**`
- Tier label: `'governance'` instead of `'grid'`, `'brain'`, `'dashboard'`

---

## Shared Patterns

### DID Validation
**Source:** `grid/src/whisper/appendNousWhispered.ts` line 63 + `grid/src/api/whisper/send.ts` line 38
**Apply to:** All governance emitter files, all governance API route handlers
```typescript
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;  // in emitters
const DID_RE = /^did:noesis:[a-zA-Z0-9_\-]+$/;       // in API route handlers
```

### Tombstone Check Pattern
**Source:** `grid/src/api/whisper/send.ts` lines 80-92
**Apply to:** `propose.ts`, `commit.ts`, `reveal.ts`
```typescript
// NousRegistry.get(did)?.status === 'deleted' is the check.
// No isTombstoned() method exists on NousRegistry (verified research pitfall 1).
// Use inline check: deps.registry.get(did)?.status === 'deleted'
if (deps.registry.get(voterDid)?.status === 'deleted') {
    reply.code(410); return { error: 'voter_tombstoned' };
}
```

### Tier Validation for Operator-Read Routes
**Source:** `grid/src/api/operator/_validation.ts` lines 33-41 + `grid/src/api/operator/governance-laws.ts` lines 54-59
**Apply to:** `body.ts` (H2+), `history.ts` (H5)
```typescript
import { validateTierBody } from '../operator/_validation.js';

const v = validateTierBody(body, 'H2');  // or 'H5'
if (!v.ok) { reply.code(400); return { error: v.error }; }
```

### Closed-Tuple Enforcement
**Source:** `grid/src/whisper/appendNousWhispered.ts` lines 90-99
**Apply to:** All 5 sole-producer emitters (appendProposalOpened, appendBallotCommitted, appendBallotRevealed, appendProposalTallied, appendLawTriggered)
```typescript
const actualKeys = Object.keys(payload).sort();
const expectedKeys = [...EXPECTED_KEYS].sort();
if (actualKeys.length !== expectedKeys.length || !actualKeys.every((k, i) => k === expectedKeys[i])) {
    throw new TypeError(`appendXxx: unexpected key set — expected ${JSON.stringify(expectedKeys)}, got ${JSON.stringify(actualKeys)}`);
}
```

### Explicit Reconstruction (Prototype-Pollution Defense)
**Source:** `grid/src/whisper/appendNousWhispered.ts` lines 145-150
**Apply to:** All 5 sole-producer emitters
```typescript
// Never spread. Always reconstruct key-by-key, alphabetical insertion order.
const cleanPayload = {
    key_a: payload.key_a,
    key_b: payload.key_b,
    // ...
};
```

### NousRunner Switch Case (Brain Action Dispatch)
**Source:** `grid/src/integration/nous-runner.ts` lines 383-404 (drive_crossed case)
**Apply to:** Three new cases in NousRunner.executeActions: `governance_propose`, `governance_vote_commit`, `governance_vote_reveal`
```typescript
case 'governance_propose': {
    // Extract individual keys from action.metadata (NEVER spread).
    // Grid injects proposer_did = this.nousDid, tick = currentTick.
    // Silent drop on missing required fields (no throw, break).
    // Try/catch wraps the openProposal call; catch logs and continues.
    // Pattern: lines 388-403 of nous-runner.ts drive_crossed case.
    break;
}
```

### Producer-Boundary Test Structure
**Source:** `grid/test/whisper/whisper-producer-boundary.test.ts` (full file, 105 lines)
**Apply to:** `grid/test/governance/governance-producer-boundary.test.ts` (x5: one per sole-producer + appendLawTriggered)
```typescript
// Clone verbatim, replacing:
// - SOLE_EMITTER_WHISPERED → 'governance/appendProposalOpened.ts'
// - /nous\.whispered/ → /proposal\.opened/
// - KNOWN_CONSUMERS list (initially empty for each governance emitter)
```

### Allowlist Extension
**Source:** `grid/src/audit/broadcast-allowlist.ts` lines 55-100 (ALLOWLIST_MEMBERS array)
**Apply to:** Extend with 4 new entries at positions 23-26 (append after `'nous.whispered'` line 99)
```typescript
// Phase 12 (VOTE-01..04): +4 governance events at positions 23-26.
'proposal.opened',   // closed 6-key payload: {deadline_tick, proposal_id, proposer_did, quorum_pct, supermajority_pct, title_hash}
'ballot.committed',  // closed 3-key payload: {commit_hash, proposal_id, voter_did}
'ballot.revealed',   // closed 4-key payload: {choice, nonce, proposal_id, voter_did}
'proposal.tallied',  // closed 6-key payload: {abstain_count, no_count, outcome, proposal_id, quorum_met, yes_count}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `dashboard/src/app/grid/governance/page.tsx` | component | request-response | `relationships/page.tsx` does NOT exist in codebase. Use `economy-panel.tsx` fetch+useEffect pattern instead. SWR is not installed — implement polling with `setInterval` in `useEffect`. |

---

## Metadata

**Analog search scope:** `grid/src/`, `grid/test/`, `brain/src/`, `dashboard/src/`, `scripts/`
**Files scanned:** ~35 analog files read
**Pattern extraction date:** 2026-04-23

**Key findings for planner:**
1. `law.triggered` has NO existing sole-producer — `appendLawTriggered.ts` must be created from scratch following the appendNousWhispered structural pattern with the new 3-key tuple `{enacted_by, law_id, title_hash}`.
2. `NousRegistry` does NOT have `isTombstoned()` — use `registry.get(did)?.status === 'deleted'` inline in all governance routes.
3. `dashboard/src/app/grid/relationships/page.tsx` does NOT exist — economy panel is the closest analog.
4. `@noble/hashes` is NOT in dependencies — use `node:crypto` `createHash('sha256')` throughout Grid; `hashlib.sha256` in Brain.
5. `MIGRATIONS` array ends at version 5 — append version 6 at line 102 (before closing `]`).
6. The allowlist `ALLOWLIST_MEMBERS` array must grow from 22 to 26 entries; the doc-sync obligation (STATE.md, ROADMAP.md, PHILOSOPHY.md, check-state-doc-sync.mjs) must be in the SAME commit as the allowlist change.
