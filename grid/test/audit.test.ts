import { describe, it, expect, beforeEach, vi } from 'vitest';
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
        const entry = chain.append('domain.register', 'did:noesis:sophia', { name: 'sophia' });
        expect(entry.id).toBe(1);
        expect(entry.eventType).toBe('domain.register');
        expect(entry.actorDid).toBe('did:noesis:sophia');
        expect(entry.prevHash).toBe('0'.repeat(64));
        expect(entry.eventHash).toHaveLength(64);
        expect(chain.length).toBe(1);
    });

    it('chains hashes — each entry links to previous', () => {
        const e1 = chain.append('domain.register', 'did:noesis:sophia', { name: 'sophia' });
        const e2 = chain.append('ousia.transfer', 'did:noesis:hermes', { amount: 50 });
        expect(e2.prevHash).toBe(e1.eventHash);
        expect(chain.head).toBe(e2.eventHash);
    });

    it('verify returns valid for intact chain', () => {
        chain.append('event.a', 'did:noesis:a', { x: 1 });
        chain.append('event.b', 'did:noesis:b', { y: 2 });
        chain.append('event.c', 'did:noesis:c', { z: 3 });
        expect(chain.verify()).toEqual({ valid: true });
    });

    it('verify detects tampered entry', () => {
        chain.append('event.a', 'did:noesis:a', { x: 1 });
        chain.append('event.b', 'did:noesis:b', { y: 2 });
        chain.append('event.c', 'did:noesis:c', { z: 3 });

        // Tamper with middle entry's payload
        const tampered = chain.at(1)!;
        (tampered.payload as any).y = 999;

        const result = chain.verify();
        expect(result.valid).toBe(false);
        expect(result.brokenAt).toBe(1);
    });

    it('verify detects broken prevHash link', () => {
        chain.append('event.a', 'did:noesis:a', { x: 1 });
        chain.append('event.b', 'did:noesis:b', { y: 2 });

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
        const entry = chain.append('sanction.applied', 'did:noesis:admin', { type: 'warning' }, 'did:noesis:hermes');
        expect(entry.targetDid).toBe('did:noesis:hermes');
    });

    it('at() returns entry by index', () => {
        chain.append('event.a', 'did:noesis:a', { x: 1 });
        chain.append('event.b', 'did:noesis:b', { y: 2 });
        expect(chain.at(0)!.eventType).toBe('event.a');
        expect(chain.at(1)!.eventType).toBe('event.b');
        expect(chain.at(99)).toBeUndefined();
    });

    describe('query', () => {
        beforeEach(() => {
            chain.append('domain.register', 'did:noesis:sophia', { name: 'sophia' });
            chain.append('ousia.transfer', 'did:noesis:hermes', { amount: 50 }, 'did:noesis:sophia');
            chain.append('domain.register', 'did:noesis:atlas', { name: 'atlas' });
            chain.append('law.enacted', 'did:noesis:admin', { lawId: 'l1' });
            chain.append('ousia.transfer', 'did:noesis:sophia', { amount: 30 }, 'did:noesis:hermes');
        });

        it('returns all entries when no filter', () => {
            expect(chain.query()).toHaveLength(5);
        });

        it('filters by eventType', () => {
            const results = chain.query({ eventType: 'domain.register' });
            expect(results).toHaveLength(2);
        });

        it('filters by actorDid', () => {
            const results = chain.query({ actorDid: 'did:noesis:sophia' });
            expect(results).toHaveLength(2);
        });

        it('filters by targetDid', () => {
            const results = chain.query({ targetDid: 'did:noesis:sophia' });
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
            const results = chain.query({ eventType: 'ousia.transfer', actorDid: 'did:noesis:hermes' });
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

describe('AuditChain.onAppend', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('fires listener synchronously after commit with the returned entry', () => {
        const received: any[] = [];
        chain.onAppend((e) => received.push(e));
        const entry = chain.append('event.a', 'did:noesis:a', { x: 1 });
        expect(received).toHaveLength(1);
        expect(received[0]).toBe(entry);
    });

    it('listener observes committed chain state (head already updated)', () => {
        let observedHead: string | null = null;
        let observedLength = -1;
        chain.onAppend((e) => {
            observedHead = chain.head;
            observedLength = chain.length;
            expect(e.eventHash).toBe(chain.head);
        });
        const entry = chain.append('event.a', 'did:noesis:a', { x: 1 });
        expect(observedHead).toBe(entry.eventHash);
        expect(observedLength).toBe(1);
    });

    it('unsubscribe closure removes the listener', () => {
        const calls: number[] = [];
        const unsub = chain.onAppend(() => calls.push(1));
        chain.append('event.a', 'did:noesis:a', {});
        unsub();
        chain.append('event.b', 'did:noesis:b', {});
        expect(calls).toHaveLength(1);
    });

    it('multiple listeners all fire in insertion order', () => {
        const order: string[] = [];
        chain.onAppend(() => order.push('first'));
        chain.onAppend(() => order.push('second'));
        chain.onAppend(() => order.push('third'));
        chain.append('event.a', 'did:noesis:a', {});
        expect(order).toEqual(['first', 'second', 'third']);
    });

    it('throwing listener does NOT throw out of append and does NOT corrupt chain', () => {
        chain.onAppend(() => { throw new Error('boom'); });
        const lenBefore = chain.length;
        const headBefore = chain.head;
        const entry = chain.append('event.a', 'did:noesis:a', { x: 1 });
        expect(entry).toBeDefined();
        expect(chain.length).toBe(lenBefore + 1);
        expect(chain.head).toBe(entry.eventHash);
        expect(chain.head).not.toBe(headBefore);
        expect(chain.verify()).toEqual({ valid: true });
    });

    it('throwing listener does NOT prevent subsequent listeners from firing', () => {
        const calls: string[] = [];
        chain.onAppend(() => { calls.push('a'); throw new Error('a-boom'); });
        chain.onAppend(() => { calls.push('b'); });
        chain.onAppend(() => { calls.push('c'); throw new Error('c-boom'); });
        chain.onAppend(() => { calls.push('d'); });
        chain.append('event.a', 'did:noesis:a', {});
        expect(calls).toEqual(['a', 'b', 'c', 'd']);
    });

    it('verify() remains valid with 0, 1, and 10 listeners attached', () => {
        const run = (n: number) => {
            const c = new AuditChain();
            for (let i = 0; i < n; i++) c.onAppend(() => {});
            for (let i = 0; i < 20; i++) c.append('event.x', 'did:noesis:x', { i });
            return c.verify();
        };
        expect(run(0)).toEqual({ valid: true });
        expect(run(1)).toEqual({ valid: true });
        expect(run(10)).toEqual({ valid: true });
    });
});

describe('AuditChain.loadEntries silence', () => {
    it('loadEntries does NOT fire attached listeners', () => {
        const seed = new AuditChain();
        seed.append('event.a', 'did:noesis:a', { x: 1 });
        seed.append('event.b', 'did:noesis:b', { y: 2 });
        const entries = seed.all();

        const restored = new AuditChain();
        const calls: any[] = [];
        restored.onAppend((e) => calls.push(e));
        restored.loadEntries(entries);
        expect(calls).toHaveLength(0);
        expect(restored.length).toBe(2);
    });

    it('subsequent append after loadEntries DOES fire listeners', () => {
        const seed = new AuditChain();
        seed.append('event.a', 'did:noesis:a', { x: 1 });
        const entries = seed.all();

        const restored = new AuditChain();
        const calls: any[] = [];
        restored.onAppend((e) => calls.push(e));
        restored.loadEntries(entries);
        expect(calls).toHaveLength(0);

        const next = restored.append('event.b', 'did:noesis:b', { y: 2 });
        expect(calls).toHaveLength(1);
        expect(calls[0]).toBe(next);
    });
});

describe('AuditChain determinism with listeners', () => {
    it('100 appends with 0 vs 10 listeners produce byte-identical chain.head at every step', () => {
        // Freeze Date.now so createdAt is deterministic across both runs.
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => {
            fakeNow += 1;
            return fakeNow;
        });

        const runSim = (listenerCount: number): string[] => {
            fakeNow = 1_700_000_000_000; // reset before each run
            const c = new AuditChain();
            for (let i = 0; i < listenerCount; i++) c.onAppend(() => {});
            const heads: string[] = [];
            for (let i = 0; i < 100; i++) {
                c.append('tick', 'did:noesis:clock', { tick: i });
                heads.push(c.head);
            }
            return heads;
        };

        const withNone = runSim(0);
        const withTen = runSim(10);
        expect(withTen).toEqual(withNone);
        expect(withTen).toHaveLength(100);
        nowSpy.mockRestore();
    });
});

describe('AuditChain.append p99 overhead', () => {
    const SKIP = process.env.CI_SKIP_BENCH === '1';
    const maybeIt = SKIP ? it.skip : it;

    maybeIt('per-listener p99 overhead < 100µs over 10_000 appends', () => {
        const N = 10_000;
        const measure = (listenerCount: number): number => {
            const c = new AuditChain();
            for (let i = 0; i < listenerCount; i++) c.onAppend(() => {});
            const samples = new Float64Array(N);
            for (let i = 0; i < N; i++) {
                const t0 = performance.now();
                c.append('event.x', 'did:noesis:x', { i });
                samples[i] = performance.now() - t0;
            }
            const sorted = Array.from(samples).sort((a, b) => a - b);
            return sorted[Math.floor(N * 0.99)] * 1000; // ms → µs
        };

        const p99_0 = measure(0);
        const p99_10 = measure(10);
        const perListenerOverheadUs = (p99_10 - p99_0) / 10;
        // Budget per 01-CONTEXT.md: <100µs per listener at p99.
        expect(perListenerOverheadUs).toBeLessThan(100);
    });
});
