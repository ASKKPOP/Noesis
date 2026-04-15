import { describe, it, expect, beforeEach } from 'vitest';
import { NegotiationEngine, createOffer, createCounter } from '../../src/noesis/ousia/negotiate.js';
import type { OusiaAccept, OusiaReject, OusiaCancel } from '../../src/noesis/ousia/types.js';

const SOPHIA = 'did:key:sophia';
const HERMES = 'did:key:hermes';

describe('NegotiationEngine', () => {
    let engine: NegotiationEngine;

    beforeEach(() => {
        engine = new NegotiationEngine();
    });

    describe('offer', () => {
        it('creates a negotiation in offered state', () => {
            const msg = createOffer(SOPHIA, HERMES, 50, 'knowledge service', 100, 'nonce-1');
            const neg = engine.offer(msg);
            expect(neg.state).toBe('offered');
            expect(neg.initiator).toBe(SOPHIA);
            expect(neg.counterparty).toBe(HERMES);
            expect(neg.currentAmount).toBe(50);
            expect(engine.count).toBe(1);
        });

        it('rejects duplicate nonce', () => {
            const msg = createOffer(SOPHIA, HERMES, 50, 'test', 100, 'nonce-dup');
            engine.offer(msg);
            expect(() => engine.offer(msg)).toThrow('already exists');
        });
    });

    describe('counter', () => {
        it('counterparty can counter an offer', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'nonce-1'));
            const counter = createCounter('nonce-1', HERMES, SOPHIA, 30, 'too much', 'counter-1', 101);
            const neg = engine.counter(counter);
            expect(neg.state).toBe('countered');
            expect(neg.currentAmount).toBe(30);
            expect(neg.counterCount).toBe(1);
        });

        it('initiator cannot counter their own offer', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'nonce-1'));
            const counter = createCounter('nonce-1', SOPHIA, HERMES, 30, 'nah', 'c-1', 101);
            expect(() => engine.counter(counter)).toThrow('Not your turn');
        });

        it('alternates turns on multiple counters', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));

            // Hermes counters (counter 1, odd → initiator responds next)
            engine.counter(createCounter('n1', HERMES, SOPHIA, 30, 'less', 'c1', 101));

            // Sophia counters back (counter 2, even → counterparty responds)
            engine.counter(createCounter('n1', SOPHIA, HERMES, 40, 'meet halfway', 'c2', 102));

            const neg = engine.get('n1')!;
            expect(neg.counterCount).toBe(2);
            expect(neg.currentAmount).toBe(40);
        });

        it('rejects after max 5 counters', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));
            const parties = [HERMES, SOPHIA, HERMES, SOPHIA, HERMES];
            for (let i = 0; i < 5; i++) {
                engine.counter(createCounter('n1', parties[i], parties[i] === SOPHIA ? HERMES : SOPHIA, 40 + i, `c${i}`, `cn-${i}`, 101 + i));
            }
            expect(() => engine.counter(
                createCounter('n1', SOPHIA, HERMES, 45, 'one more', 'cn-5', 106),
            )).toThrow('Max counters');
        });
    });

    describe('accept', () => {
        it('counterparty accepts an offer', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));
            const accept: OusiaAccept = {
                type: 'ousia_accept', nonce: 'n1', from: HERMES, to: SOPHIA,
                amount: 50, toSignature: '',
            };
            const neg = engine.accept(accept);
            expect(neg.state).toBe('accepted');
            expect(neg.currentAmount).toBe(50);
        });

        it('accepts a counter-offer by counter nonce', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));
            engine.counter(createCounter('n1', HERMES, SOPHIA, 35, 'lower', 'c1', 101));
            const accept: OusiaAccept = {
                type: 'ousia_accept', nonce: 'c1', from: SOPHIA, to: HERMES,
                amount: 35, toSignature: '',
            };
            const neg = engine.accept(accept);
            expect(neg.state).toBe('accepted');
            expect(neg.currentAmount).toBe(35);
        });

        it('initiator cannot accept their own offer', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));
            const accept: OusiaAccept = {
                type: 'ousia_accept', nonce: 'n1', from: SOPHIA, to: HERMES,
                amount: 50, toSignature: '',
            };
            expect(() => engine.accept(accept)).toThrow('Not your turn');
        });
    });

    describe('reject', () => {
        it('rejects an offer', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));
            const reject: OusiaReject = { type: 'ousia_reject', nonce: 'n1', from: HERMES, reason: 'no thanks' };
            const neg = engine.reject(reject);
            expect(neg.state).toBe('rejected');
        });

        it('cannot act on rejected negotiation', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));
            engine.reject({ type: 'ousia_reject', nonce: 'n1', from: HERMES, reason: 'no' });
            const accept: OusiaAccept = {
                type: 'ousia_accept', nonce: 'n1', from: HERMES, to: SOPHIA,
                amount: 50, toSignature: '',
            };
            expect(() => engine.accept(accept)).toThrow('rejected, not active');
        });
    });

    describe('cancel', () => {
        it('initiator can cancel', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));
            const cancel: OusiaCancel = {
                type: 'ousia_cancel', nonce: 'n1', from: SOPHIA, fromSignature: '',
            };
            const neg = engine.cancel(cancel);
            expect(neg.state).toBe('cancelled');
        });

        it('counterparty cannot cancel', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));
            expect(() => engine.cancel({
                type: 'ousia_cancel', nonce: 'n1', from: HERMES, fromSignature: '',
            })).toThrow('Only the initiator');
        });
    });

    describe('expiry', () => {
        it('expires negotiations past deadline', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1')); // expires at 110
            engine.offer(createOffer(SOPHIA, HERMES, 30, 'test', 105, 'n2')); // expires at 115

            const expired = engine.expireAt(112);
            expect(expired).toHaveLength(1);
            expect(expired[0].offerNonce).toBe('n1');
            expect(engine.get('n1')!.state).toBe('expired');
            expect(engine.get('n2')!.state).toBe('offered');
        });

        it('does not expire already-terminal negotiations', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));
            engine.reject({ type: 'ousia_reject', nonce: 'n1', from: HERMES, reason: 'no' });
            const expired = engine.expireAt(200);
            expect(expired).toHaveLength(0);
        });
    });

    describe('queries', () => {
        it('activeFor returns active negotiations for a did', () => {
            engine.offer(createOffer(SOPHIA, HERMES, 50, 'test', 100, 'n1'));
            engine.offer(createOffer(HERMES, SOPHIA, 20, 'test', 100, 'n2'));
            expect(engine.activeFor(SOPHIA)).toHaveLength(2);
            expect(engine.activeFor(HERMES)).toHaveLength(2);
            expect(engine.activeFor('did:key:atlas')).toHaveLength(0);
        });

        it('get returns undefined for unknown', () => {
            expect(engine.get('nope')).toBeUndefined();
        });
    });
});
