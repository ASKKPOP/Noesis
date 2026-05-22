/**
 * Phase 25b (SANCTION-01..06 / D-25b-07/08/09/11) — 6 operator sanction emitter tests.
 *
 * Each emitter is a sole-producer closed-tuple emitter mirroring append-nous-deleted.ts.
 * Tests cover:
 *   - Happy baseline (well-formed payload appends)
 *   - Tier literal guard
 *   - Action literal guard
 *   - operator_id format guard (OPERATOR_ID_RE)
 *   - target_did / human_did format guard (DID_RE)
 *   - reason_hash format guard (HEX64_RE)
 *   - tick guard (non-negative integer)
 *   - Self-report invariant (payload.operator_id === operatorId arg)
 *   - Closed-tuple structural check (extra key rejected, missing key rejected)
 *   - amount guard for slashed only (positive integer)
 *   - Plaintext reason field names MUST NOT appear in the file source
 *
 * See: 25b-CONTEXT D-25b-07/08/09/11, PATTERNS.md Wave 1.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuditChain } from '../../src/audit/chain.js';
import { appendOperatorMuted } from '../../src/audit/append-operator-muted.js';
import { appendOperatorSlashed } from '../../src/audit/append-operator-slashed.js';
import { appendOperatorQuarantined } from '../../src/audit/append-operator-quarantined.js';
import { appendOperatorForcedSleep } from '../../src/audit/append-operator-forced-sleep.js';
import { appendOperatorHumanBanned } from '../../src/audit/append-operator-human-banned.js';
import { appendOperatorHumanFrozen } from '../../src/audit/append-operator-human-frozen.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GRID_SRC = join(__dirname, '..', '..', 'src', 'audit');

const OPERATOR = 'op:11111111-1111-4111-8111-111111111111';
const TARGET   = 'did:noesis:alpha';
const HUMAN    = 'did:noesis:human:0xabc';
const HASH64   = 'a'.repeat(64);

// ─── operator.muted ────────────────────────────────────────────────────────

const happyMuted = {
    tier:        'H3' as const,
    action:      'mute' as const,
    operator_id: OPERATOR,
    target_did:  TARGET,
    tick:        42,
    reason_hash: HASH64,
};

describe('appendOperatorMuted — operator.muted (D-25b-07)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('happy baseline — well-formed payload appends', () => {
        expect(() => appendOperatorMuted(chain, OPERATOR, happyMuted)).not.toThrow();
        const last = chain.all().at(-1);
        expect(last?.eventType).toBe('operator.muted');
        expect(Object.keys(last!.payload as Record<string, unknown>).sort()).toEqual(
            ['action', 'operator_id', 'reason_hash', 'target_did', 'tick', 'tier'],
        );
    });

    it('rejects tier !== H3', () => {
        expect(() => appendOperatorMuted(chain, OPERATOR, { ...happyMuted, tier: 'H4' } as unknown as typeof happyMuted))
            .toThrow(/tier/i);
    });

    it('rejects action !== mute', () => {
        expect(() => appendOperatorMuted(chain, OPERATOR, { ...happyMuted, action: 'slash' } as unknown as typeof happyMuted))
            .toThrow(/action/i);
    });

    it('rejects invalid operator_id', () => {
        expect(() => appendOperatorMuted(chain, 'bad', { ...happyMuted, operator_id: 'bad' }))
            .toThrow(/operator_id/i);
    });

    it('rejects invalid target_did', () => {
        expect(() => appendOperatorMuted(chain, OPERATOR, { ...happyMuted, target_did: 'not-a-did' }))
            .toThrow(/target_did|did/i);
    });

    it('rejects invalid reason_hash', () => {
        expect(() => appendOperatorMuted(chain, OPERATOR, { ...happyMuted, reason_hash: 'nothex' }))
            .toThrow(/reason_hash|hex/i);
    });

    it('rejects negative tick', () => {
        expect(() => appendOperatorMuted(chain, OPERATOR, { ...happyMuted, tick: -1 }))
            .toThrow(/tick/i);
    });

    it('rejects non-integer tick', () => {
        expect(() => appendOperatorMuted(chain, OPERATOR, { ...happyMuted, tick: 1.5 }))
            .toThrow(/tick/i);
    });

    it('rejects self-report invariant violation', () => {
        const other = 'op:22222222-2222-4222-8222-222222222222';
        expect(() => appendOperatorMuted(chain, other, happyMuted)).toThrow(/operator_id/i);
    });

    it('rejects extra key (closed-tuple)', () => {
        expect(() => appendOperatorMuted(chain, OPERATOR, { ...happyMuted, extra: 'x' } as unknown as typeof happyMuted))
            .toThrow(/unexpected|key/i);
    });

    it('rejects missing key (closed-tuple or field validation)', () => {
        const { reason_hash: _, ...missing } = happyMuted;
        // Missing reason_hash: may throw from field validation or closed-tuple check
        expect(() => appendOperatorMuted(chain, OPERATOR, missing as unknown as typeof happyMuted))
            .toThrow(/reason_hash|unexpected|key/i);
    });
});

// ─── operator.slashed ─────────────────────────────────────────────────────

const happySlashed = {
    tier:        'H4' as const,
    action:      'slash' as const,
    operator_id: OPERATOR,
    target_did:  TARGET,
    tick:        42,
    reason_hash: HASH64,
    amount:      100,
};

describe('appendOperatorSlashed — operator.slashed (D-25b-07)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('happy baseline — well-formed payload appends', () => {
        expect(() => appendOperatorSlashed(chain, OPERATOR, happySlashed)).not.toThrow();
        const last = chain.all().at(-1);
        expect(last?.eventType).toBe('operator.slashed');
        expect(Object.keys(last!.payload as Record<string, unknown>).sort()).toEqual(
            ['action', 'amount', 'operator_id', 'reason_hash', 'target_did', 'tick', 'tier'],
        );
    });

    it('rejects tier !== H4', () => {
        expect(() => appendOperatorSlashed(chain, OPERATOR, { ...happySlashed, tier: 'H3' } as unknown as typeof happySlashed))
            .toThrow(/tier/i);
    });

    it('rejects action !== slash', () => {
        expect(() => appendOperatorSlashed(chain, OPERATOR, { ...happySlashed, action: 'mute' } as unknown as typeof happySlashed))
            .toThrow(/action/i);
    });

    it('rejects invalid reason_hash', () => {
        expect(() => appendOperatorSlashed(chain, OPERATOR, { ...happySlashed, reason_hash: 'bad' }))
            .toThrow(/reason_hash|hex/i);
    });

    it('rejects negative amount', () => {
        expect(() => appendOperatorSlashed(chain, OPERATOR, { ...happySlashed, amount: -1 }))
            .toThrow(/amount/i);
    });

    it('rejects non-integer amount', () => {
        expect(() => appendOperatorSlashed(chain, OPERATOR, { ...happySlashed, amount: 1.5 }))
            .toThrow(/amount/i);
    });

    it('rejects self-report invariant violation', () => {
        const other = 'op:22222222-2222-4222-8222-222222222222';
        expect(() => appendOperatorSlashed(chain, other, happySlashed)).toThrow(/operator_id/i);
    });

    it('rejects extra key (closed-tuple)', () => {
        expect(() => appendOperatorSlashed(chain, OPERATOR, { ...happySlashed, extra: 'x' } as unknown as typeof happySlashed))
            .toThrow(/unexpected|key/i);
    });
});

// ─── operator.quarantined ─────────────────────────────────────────────────

const happyQuarantined = {
    tier:        'H4' as const,
    action:      'quarantine' as const,
    operator_id: OPERATOR,
    target_did:  TARGET,
    tick:        42,
    reason_hash: HASH64,
};

describe('appendOperatorQuarantined — operator.quarantined (D-25b-07)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('happy baseline — well-formed payload appends', () => {
        expect(() => appendOperatorQuarantined(chain, OPERATOR, happyQuarantined)).not.toThrow();
        const last = chain.all().at(-1);
        expect(last?.eventType).toBe('operator.quarantined');
        expect(Object.keys(last!.payload as Record<string, unknown>).sort()).toEqual(
            ['action', 'operator_id', 'reason_hash', 'target_did', 'tick', 'tier'],
        );
    });

    it('rejects tier !== H4', () => {
        expect(() => appendOperatorQuarantined(chain, OPERATOR, { ...happyQuarantined, tier: 'H3' } as unknown as typeof happyQuarantined))
            .toThrow(/tier/i);
    });

    it('rejects action !== quarantine', () => {
        expect(() => appendOperatorQuarantined(chain, OPERATOR, { ...happyQuarantined, action: 'mute' } as unknown as typeof happyQuarantined))
            .toThrow(/action/i);
    });

    it('rejects invalid reason_hash', () => {
        expect(() => appendOperatorQuarantined(chain, OPERATOR, { ...happyQuarantined, reason_hash: 'bad' }))
            .toThrow(/reason_hash|hex/i);
    });

    it('rejects self-report invariant violation', () => {
        const other = 'op:22222222-2222-4222-8222-222222222222';
        expect(() => appendOperatorQuarantined(chain, other, happyQuarantined)).toThrow(/operator_id/i);
    });

    it('rejects extra key (closed-tuple)', () => {
        expect(() => appendOperatorQuarantined(chain, OPERATOR, { ...happyQuarantined, extra: 'x' } as unknown as typeof happyQuarantined))
            .toThrow(/unexpected|key/i);
    });
});

// ─── operator.forced_sleep ────────────────────────────────────────────────

const happyForcedSleep = {
    tier:        'H3' as const,
    action:      'force_sleep' as const,
    operator_id: OPERATOR,
    target_did:  TARGET,
    tick:        42,
    reason_hash: HASH64,
};

describe('appendOperatorForcedSleep — operator.forced_sleep (D-25b-07)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('happy baseline — well-formed payload appends', () => {
        expect(() => appendOperatorForcedSleep(chain, OPERATOR, happyForcedSleep)).not.toThrow();
        const last = chain.all().at(-1);
        expect(last?.eventType).toBe('operator.forced_sleep');
        expect(Object.keys(last!.payload as Record<string, unknown>).sort()).toEqual(
            ['action', 'operator_id', 'reason_hash', 'target_did', 'tick', 'tier'],
        );
    });

    it('rejects tier !== H3', () => {
        expect(() => appendOperatorForcedSleep(chain, OPERATOR, { ...happyForcedSleep, tier: 'H4' } as unknown as typeof happyForcedSleep))
            .toThrow(/tier/i);
    });

    it('rejects action !== force_sleep', () => {
        expect(() => appendOperatorForcedSleep(chain, OPERATOR, { ...happyForcedSleep, action: 'mute' } as unknown as typeof happyForcedSleep))
            .toThrow(/action/i);
    });

    it('rejects invalid reason_hash', () => {
        expect(() => appendOperatorForcedSleep(chain, OPERATOR, { ...happyForcedSleep, reason_hash: 'bad' }))
            .toThrow(/reason_hash|hex/i);
    });

    it('rejects self-report invariant violation', () => {
        const other = 'op:22222222-2222-4222-8222-222222222222';
        expect(() => appendOperatorForcedSleep(chain, other, happyForcedSleep)).toThrow(/operator_id/i);
    });

    it('rejects extra key (closed-tuple)', () => {
        expect(() => appendOperatorForcedSleep(chain, OPERATOR, { ...happyForcedSleep, extra: 'x' } as unknown as typeof happyForcedSleep))
            .toThrow(/unexpected|key/i);
    });
});

// ─── operator.human_banned ────────────────────────────────────────────────

const happyHumanBanned = {
    tier:        'H5' as const,
    action:      'ban_human' as const,
    operator_id: OPERATOR,
    human_did:   HUMAN,
    tick:        42,
    reason_hash: HASH64,
};

describe('appendOperatorHumanBanned — operator.human_banned (D-25b-08)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('happy baseline — well-formed payload appends', () => {
        expect(() => appendOperatorHumanBanned(chain, OPERATOR, happyHumanBanned)).not.toThrow();
        const last = chain.all().at(-1);
        expect(last?.eventType).toBe('operator.human_banned');
        expect(Object.keys(last!.payload as Record<string, unknown>).sort()).toEqual(
            ['action', 'human_did', 'operator_id', 'reason_hash', 'tick', 'tier'],
        );
    });

    it('rejects tier !== H5', () => {
        expect(() => appendOperatorHumanBanned(chain, OPERATOR, { ...happyHumanBanned, tier: 'H4' } as unknown as typeof happyHumanBanned))
            .toThrow(/tier/i);
    });

    it('rejects action !== ban_human', () => {
        expect(() => appendOperatorHumanBanned(chain, OPERATOR, { ...happyHumanBanned, action: 'mute' } as unknown as typeof happyHumanBanned))
            .toThrow(/action/i);
    });

    it('rejects invalid human_did', () => {
        expect(() => appendOperatorHumanBanned(chain, OPERATOR, { ...happyHumanBanned, human_did: 'not-a-did' }))
            .toThrow(/human_did|did/i);
    });

    it('rejects invalid reason_hash', () => {
        expect(() => appendOperatorHumanBanned(chain, OPERATOR, { ...happyHumanBanned, reason_hash: 'bad' }))
            .toThrow(/reason_hash|hex/i);
    });

    it('rejects self-report invariant violation', () => {
        const other = 'op:22222222-2222-4222-8222-222222222222';
        expect(() => appendOperatorHumanBanned(chain, other, happyHumanBanned)).toThrow(/operator_id/i);
    });

    it('rejects extra key (closed-tuple)', () => {
        expect(() => appendOperatorHumanBanned(chain, OPERATOR, { ...happyHumanBanned, extra: 'x' } as unknown as typeof happyHumanBanned))
            .toThrow(/unexpected|key/i);
    });
});

// ─── operator.human_frozen ────────────────────────────────────────────────

const happyHumanFrozen = {
    tier:        'H5' as const,
    action:      'freeze_wallet' as const,
    operator_id: OPERATOR,
    human_did:   HUMAN,
    tick:        42,
    reason_hash: HASH64,
};

describe('appendOperatorHumanFrozen — operator.human_frozen (D-25b-08)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('happy baseline — well-formed payload appends', () => {
        expect(() => appendOperatorHumanFrozen(chain, OPERATOR, happyHumanFrozen)).not.toThrow();
        const last = chain.all().at(-1);
        expect(last?.eventType).toBe('operator.human_frozen');
        expect(Object.keys(last!.payload as Record<string, unknown>).sort()).toEqual(
            ['action', 'human_did', 'operator_id', 'reason_hash', 'tick', 'tier'],
        );
    });

    it('rejects tier !== H5', () => {
        expect(() => appendOperatorHumanFrozen(chain, OPERATOR, { ...happyHumanFrozen, tier: 'H4' } as unknown as typeof happyHumanFrozen))
            .toThrow(/tier/i);
    });

    it('rejects action !== freeze_wallet', () => {
        expect(() => appendOperatorHumanFrozen(chain, OPERATOR, { ...happyHumanFrozen, action: 'mute' } as unknown as typeof happyHumanFrozen))
            .toThrow(/action/i);
    });

    it('rejects invalid human_did', () => {
        expect(() => appendOperatorHumanFrozen(chain, OPERATOR, { ...happyHumanFrozen, human_did: 'not-a-did' }))
            .toThrow(/human_did|did/i);
    });

    it('rejects invalid reason_hash', () => {
        expect(() => appendOperatorHumanFrozen(chain, OPERATOR, { ...happyHumanFrozen, reason_hash: 'bad' }))
            .toThrow(/reason_hash|hex/i);
    });

    it('rejects self-report invariant violation', () => {
        const other = 'op:22222222-2222-4222-8222-222222222222';
        expect(() => appendOperatorHumanFrozen(chain, other, happyHumanFrozen)).toThrow(/operator_id/i);
    });

    it('rejects extra key (closed-tuple)', () => {
        expect(() => appendOperatorHumanFrozen(chain, OPERATOR, { ...happyHumanFrozen, extra: 'x' } as unknown as typeof happyHumanFrozen))
            .toThrow(/unexpected|key/i);
    });
});

// ─── Cross-cutting: no plaintext reason field names in emitter sources ─────

describe('Phase 25b sanction emitters — no plaintext reason field names (D-25b-11)', () => {
    const FORBIDDEN = ['reason_text', 'reason_plaintext', 'plaintext_reason', 'reason_body'];
    const EMITTER_FILES = [
        'append-operator-muted.ts',
        'append-operator-slashed.ts',
        'append-operator-quarantined.ts',
        'append-operator-forced-sleep.ts',
        'append-operator-human-banned.ts',
        'append-operator-human-frozen.ts',
    ];

    it.each(EMITTER_FILES)('%s contains no plaintext reason field names', (filename) => {
        const src = readFileSync(join(GRID_SRC, filename), 'utf8');
        for (const forbidden of FORBIDDEN) {
            expect(src).not.toContain(forbidden);
        }
    });
});

// ─── Producer-boundary tests (sole-producer per event type) ────────────────

import { readdirSync, statSync } from 'node:fs';
import { relative } from 'node:path';

const GRID_SRC_ROOT = join(__dirname, '..', '..', 'src');

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

const SANCTION_EVENTS = [
    { event: 'operator.muted',        producer: 'audit/append-operator-muted.ts' },
    { event: 'operator.slashed',      producer: 'audit/append-operator-slashed.ts' },
    { event: 'operator.quarantined',  producer: 'audit/append-operator-quarantined.ts' },
    { event: 'operator.forced_sleep', producer: 'audit/append-operator-forced-sleep.ts' },
    { event: 'operator.human_banned', producer: 'audit/append-operator-human-banned.ts' },
    { event: 'operator.human_frozen', producer: 'audit/append-operator-human-frozen.ts' },
];

describe('Phase 25b sanction events — sole-producer boundary (D-25b-09)', () => {
    for (const { event, producer } of SANCTION_EVENTS) {
        it(`no file in grid/src/ except ${producer} emits ${event}`, () => {
            const escapedEvent = event.replace(/\./g, '\\.').replace(/_/g, '_');
            const pattern = new RegExp(
                `\\b(audit|chain|this\\.audit|this\\.chain)\\.append[^;]{0,200}['"]${escapedEvent}['"]`,
                's',
            );
            const offenders: string[] = [];
            for (const file of walk(GRID_SRC_ROOT)) {
                const rel = relative(GRID_SRC_ROOT, file).replace(/\\/g, '/');
                if (rel === producer) continue;
                const src = readFileSync(file, 'utf8');
                if (pattern.test(src)) offenders.push(rel);
            }
            expect(offenders).toEqual([]);
        });

        it(`${producer} calls audit.append with '${event}'`, () => {
            const src = readFileSync(join(GRID_SRC_ROOT, producer), 'utf8');
            expect(src).toMatch(new RegExp(`audit\\.append\\(['"]${event.replace(/\./g, '\\.').replace(/_/g, '_')}['"]`));
        });
    }
});
