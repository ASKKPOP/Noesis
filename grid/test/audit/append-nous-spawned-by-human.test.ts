/**
 * Phase 28 SPAWN-04 — appendNousSpawnedByHuman sole-producer boundary invariant.
 *
 * Verifies:
 *   1. File exists and exports appendNousSpawnedByHuman.
 *   2. Type guards: null/non-object/array payload, DID_RE guards, non-empty string guard,
 *      non-negative integer guard, closed-key-tuple guard, privacy guard.
 *   3. Happy path: returns AuditEntry with eventType 'nous.spawned_by_human'.
 *   4. No spread used (source check).
 *   5. Sole producer: no other file in grid/src/ calls audit.append with 'nous.spawned_by_human'.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuditChain } from '../../src/audit/chain.js';
import {
    appendNousSpawnedByHuman,
    type NousSpawnedByHumanPayload,
} from '../../src/audit/append-nous-spawned-by-human.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-nous-spawned-by-human.ts';

const VALID_PAYLOAD: NousSpawnedByHumanPayload = {
    grid_name: 'genesis',
    nous_did: 'did:noesis:human-nous-henry-eidolon',
    owner_human_did: 'did:noesis:human-0xdeadbeef',
    tick: 5,
};

function makeAudit(): AuditChain {
    return new AuditChain();
}

function walkTs(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walkTs(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

describe('appendNousSpawnedByHuman — happy path', () => {
    let audit: AuditChain;
    beforeEach(() => { audit = makeAudit(); });

    it('returns AuditEntry with eventType nous.spawned_by_human', () => {
        const entry = appendNousSpawnedByHuman(audit, VALID_PAYLOAD);
        expect(entry.eventType).toBe('nous.spawned_by_human');
    });

    it('actor_did in returned entry is the nous_did', () => {
        const entry = appendNousSpawnedByHuman(audit, VALID_PAYLOAD);
        expect(entry.actorDid).toBe(VALID_PAYLOAD.nous_did);
    });

    it('returned entry payload includes all 4 fields', () => {
        const entry = appendNousSpawnedByHuman(audit, VALID_PAYLOAD);
        const p = entry.payload as Record<string, unknown>;
        expect(p.grid_name).toBe(VALID_PAYLOAD.grid_name);
        expect(p.nous_did).toBe(VALID_PAYLOAD.nous_did);
        expect(p.owner_human_did).toBe(VALID_PAYLOAD.owner_human_did);
        expect(p.tick).toBe(VALID_PAYLOAD.tick);
    });

    it('accepts tick = 0', () => {
        expect(() =>
            appendNousSpawnedByHuman(audit, { ...VALID_PAYLOAD, tick: 0 }),
        ).not.toThrow();
    });
});

describe('appendNousSpawnedByHuman — type guards', () => {
    let audit: AuditChain;
    beforeEach(() => { audit = makeAudit(); });

    it('throws TypeError when payload is null', () => {
        expect(() =>
            appendNousSpawnedByHuman(audit, null as unknown as NousSpawnedByHumanPayload),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is a string', () => {
        expect(() =>
            appendNousSpawnedByHuman(audit, 'bad' as unknown as NousSpawnedByHumanPayload),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is an array', () => {
        expect(() =>
            appendNousSpawnedByHuman(audit, [] as unknown as NousSpawnedByHumanPayload),
        ).toThrow(TypeError);
    });

    it('throws TypeError when nous_did does not match DID_RE', () => {
        expect(() =>
            appendNousSpawnedByHuman(audit, { ...VALID_PAYLOAD, nous_did: 'not-a-did' }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when owner_human_did does not match DID_RE', () => {
        expect(() =>
            appendNousSpawnedByHuman(audit, { ...VALID_PAYLOAD, owner_human_did: 'not-a-did' }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when grid_name is empty string', () => {
        expect(() =>
            appendNousSpawnedByHuman(audit, { ...VALID_PAYLOAD, grid_name: '' }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when tick is negative', () => {
        expect(() =>
            appendNousSpawnedByHuman(audit, { ...VALID_PAYLOAD, tick: -1 }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when tick is a float', () => {
        expect(() =>
            appendNousSpawnedByHuman(audit, { ...VALID_PAYLOAD, tick: 1.5 }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload has an extra key', () => {
        expect(() =>
            appendNousSpawnedByHuman(audit, {
                ...VALID_PAYLOAD,
                extra: 'bad',
            } as unknown as NousSpawnedByHumanPayload),
        ).toThrow(TypeError);
    });

    it('throws TypeError when a privacy-violating key is present (via wrong keys check)', () => {
        // content key would violate privacy AND wrong-key tuple
        expect(() =>
            appendNousSpawnedByHuman(audit, {
                grid_name: 'genesis',
                nous_did: VALID_PAYLOAD.nous_did,
                owner_human_did: VALID_PAYLOAD.owner_human_did,
                tick: 5,
                content: 'hello',
            } as unknown as NousSpawnedByHumanPayload),
        ).toThrow(TypeError);
    });
});

describe('appendNousSpawnedByHuman — source invariants', () => {
    const src = readFileSync(join(GRID_SRC, SOLE_PRODUCER_FILE), 'utf8');

    it('EXPECTED_KEYS declares the 4-key closed tuple in alphabetical order', () => {
        expect(src).toContain("'grid_name', 'nous_did', 'owner_human_did', 'tick'");
    });

    it('no spread operator used in implementation', () => {
        // ...payload spread is forbidden; must use explicit reconstruction
        expect(src).not.toMatch(/\.\.\.(payload|cleanPayload)/);
    });

    it('calls audit.append with nous.spawned_by_human', () => {
        expect(src).toMatch(/audit\.append\(['"]nous\.spawned_by_human['"]/);
    });
});

describe('appendNousSpawnedByHuman — sole producer invariant', () => {
    it('no file in grid/src/ except append-nous-spawned-by-human.ts emits nous.spawned_by_human', () => {
        const offenders: string[] = [];
        for (const file of walkTs(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]nous\.spawned_by_human['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });
});
