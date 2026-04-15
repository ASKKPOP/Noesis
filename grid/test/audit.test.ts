import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';

describe('AuditChain', () => {
    let chain: AuditChain;

    beforeEach(() => {
        chain = new AuditChain();
    });

    it('starts empty with genesis hash', () => {
        expect(chain.length).toBe(0);
        expect(chain.head).toBe('0'.repeat(64));
    });

    it('append creates entry with computed hash', () => {
        const entry = chain.append('domain.register', 'did:key:sophia', { name: 'sophia' });
        expect(entry.id).toBe(1);
        expect(entry.eventType).toBe('domain.register');
        expect(entry.actorDid).toBe('did:key:sophia');
        expect(entry.prevHash).toBe('0'.repeat(64));
        expect(entry.eventHash).toHaveLength(64);
        expect(chain.length).toBe(1);
    });

    it('chains hashes — each entry links to previous', () => {
        const e1 = chain.append('domain.register', 'did:key:sophia', { name: 'sophia' });
        const e2 = chain.append('ousia.transfer', 'did:key:hermes', { amount: 50 });
        expect(e2.prevHash).toBe(e1.eventHash);
        expect(chain.head).toBe(e2.eventHash);
    });

    it('verify returns valid for intact chain', () => {
        chain.append('event.a', 'did:key:a', { x: 1 });
        chain.append('event.b', 'did:key:b', { y: 2 });
        chain.append('event.c', 'did:key:c', { z: 3 });
        expect(chain.verify()).toEqual({ valid: true });
    });

    it('verify detects tampered entry', () => {
        chain.append('event.a', 'did:key:a', { x: 1 });
        chain.append('event.b', 'did:key:b', { y: 2 });
        chain.append('event.c', 'did:key:c', { z: 3 });

        // Tamper with middle entry's payload
        const tampered = chain.at(1)!;
        (tampered.payload as any).y = 999;

        const result = chain.verify();
        expect(result.valid).toBe(false);
        expect(result.brokenAt).toBe(1);
    });

    it('verify detects broken prevHash link', () => {
        chain.append('event.a', 'did:key:a', { x: 1 });
        chain.append('event.b', 'did:key:b', { y: 2 });

        // Break the chain link
        const entry = chain.at(1)!;
        (entry as any).prevHash = 'ff'.repeat(32);

        const result = chain.verify();
        expect(result.valid).toBe(false);
        expect(result.brokenAt).toBe(1);
    });

    it('verify passes for empty chain', () => {
        expect(chain.verify()).toEqual({ valid: true });
    });

    it('append with targetDid', () => {
        const entry = chain.append('sanction.applied', 'did:key:admin', { type: 'warning' }, 'did:key:hermes');
        expect(entry.targetDid).toBe('did:key:hermes');
    });

    it('at() returns entry by index', () => {
        chain.append('event.a', 'did:key:a', { x: 1 });
        chain.append('event.b', 'did:key:b', { y: 2 });
        expect(chain.at(0)!.eventType).toBe('event.a');
        expect(chain.at(1)!.eventType).toBe('event.b');
        expect(chain.at(99)).toBeUndefined();
    });

    describe('query', () => {
        beforeEach(() => {
            chain.append('domain.register', 'did:key:sophia', { name: 'sophia' });
            chain.append('ousia.transfer', 'did:key:hermes', { amount: 50 }, 'did:key:sophia');
            chain.append('domain.register', 'did:key:atlas', { name: 'atlas' });
            chain.append('law.enacted', 'did:key:admin', { lawId: 'l1' });
            chain.append('ousia.transfer', 'did:key:sophia', { amount: 30 }, 'did:key:hermes');
        });

        it('returns all entries when no filter', () => {
            expect(chain.query()).toHaveLength(5);
        });

        it('filters by eventType', () => {
            const results = chain.query({ eventType: 'domain.register' });
            expect(results).toHaveLength(2);
        });

        it('filters by actorDid', () => {
            const results = chain.query({ actorDid: 'did:key:sophia' });
            expect(results).toHaveLength(2);
        });

        it('filters by targetDid', () => {
            const results = chain.query({ targetDid: 'did:key:sophia' });
            expect(results).toHaveLength(1);
        });

        it('paginates with limit and offset', () => {
            const page1 = chain.query({ limit: 2, offset: 0 });
            const page2 = chain.query({ limit: 2, offset: 2 });
            expect(page1).toHaveLength(2);
            expect(page2).toHaveLength(2);
            expect(page1[0].eventType).toBe('domain.register');
            expect(page2[0].eventType).toBe('domain.register');
        });

        it('combines filters', () => {
            const results = chain.query({ eventType: 'ousia.transfer', actorDid: 'did:key:hermes' });
            expect(results).toHaveLength(1);
        });
    });

    it('computeHash is deterministic', () => {
        const h1 = AuditChain.computeHash('prev', 'type', 'actor', { x: 1 }, 12345);
        const h2 = AuditChain.computeHash('prev', 'type', 'actor', { x: 1 }, 12345);
        expect(h1).toBe(h2);
    });

    it('computeHash changes with any input change', () => {
        const base = AuditChain.computeHash('prev', 'type', 'actor', { x: 1 }, 12345);
        expect(AuditChain.computeHash('diff', 'type', 'actor', { x: 1 }, 12345)).not.toBe(base);
        expect(AuditChain.computeHash('prev', 'diff', 'actor', { x: 1 }, 12345)).not.toBe(base);
        expect(AuditChain.computeHash('prev', 'type', 'diff', { x: 1 }, 12345)).not.toBe(base);
        expect(AuditChain.computeHash('prev', 'type', 'actor', { x: 2 }, 12345)).not.toBe(base);
        expect(AuditChain.computeHash('prev', 'type', 'actor', { x: 1 }, 99999)).not.toBe(base);
    });
});
