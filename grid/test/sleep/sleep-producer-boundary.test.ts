import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendNousSleepEntered, appendNousSleepCompleted } from '../../src/sleep/index.js';
import type { NousSleepPayload } from '../../src/sleep/types.js';

const DID = 'did:noesis:hypnos-test';
const HASH64 = 'a'.repeat(64);

const happy: NousSleepPayload = { nous_did: DID, tick: 100, ltm_snapshot_hash: HASH64 };

describe('appendNousSleepEntered — HYP-04 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('appends well-formed nous.sleep.entered entry', () => {
        const entry = appendNousSleepEntered(chain, DID, happy);
        expect(entry.eventType).toBe('nous.sleep.entered');
        expect(Object.keys(entry.payload as Record<string, unknown>).sort()).toEqual(
            ['ltm_snapshot_hash', 'nous_did', 'tick'],
        );
    });

    it('rejects extra key (4-key payload)', () => {
        expect(() => appendNousSleepEntered(chain, DID, { ...happy, extra: 'bad' } as NousSleepPayload)).toThrow(TypeError);
    });

    it('rejects missing key (2-key payload)', () => {
        const { ltm_snapshot_hash, ...twoKey } = happy;
        expect(() => appendNousSleepEntered(chain, DID, twoKey as NousSleepPayload)).toThrow(TypeError);
    });

    it('rejects non-DID actorDid', () => {
        expect(() => appendNousSleepEntered(chain, 'not-a-did', happy)).toThrow(TypeError);
    });

    it('rejects self-report mismatch', () => {
        expect(() => appendNousSleepEntered(chain, DID, { ...happy, nous_did: 'did:noesis:other' })).toThrow(TypeError);
    });

    it('rejects negative tick', () => {
        expect(() => appendNousSleepEntered(chain, DID, { ...happy, tick: -1 })).toThrow(TypeError);
    });

    it('rejects short hash (not 64 chars)', () => {
        expect(() => appendNousSleepEntered(chain, DID, { ...happy, ltm_snapshot_hash: 'abc' })).toThrow(TypeError);
    });
});

describe('appendNousSleepCompleted — HYP-04 sole producer', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('appends well-formed nous.sleep.completed entry', () => {
        const entry = appendNousSleepCompleted(chain, DID, happy);
        expect(entry.eventType).toBe('nous.sleep.completed');
    });
});
