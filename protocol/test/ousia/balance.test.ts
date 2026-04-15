import { describe, it, expect, beforeEach } from 'vitest';
import { BalanceTracker } from '../../src/noesis/ousia/balance.js';

describe('BalanceTracker', () => {
    let tracker: BalanceTracker;

    beforeEach(() => {
        tracker = new BalanceTracker();
    });

    it('starts with zero balance', () => {
        expect(tracker.currentBalance).toBe(0);
    });

    it('initialize sets starting balance', () => {
        const entry = tracker.initialize(1000, 0);
        expect(tracker.currentBalance).toBe(1000);
        expect(entry.txType).toBe('initial');
        expect(entry.amount).toBe(1000);
        expect(entry.balanceAfter).toBe(1000);
    });

    it('receive increases balance', () => {
        tracker.initialize(1000, 0);
        const entry = tracker.receive(50, 'did:key:hermes', 'nonce-1', 1);
        expect(tracker.currentBalance).toBe(1050);
        expect(entry.txType).toBe('receive');
        expect(entry.counterpart).toBe('did:key:hermes');
    });

    it('send decreases balance', () => {
        tracker.initialize(1000, 0);
        const entry = tracker.send(200, 'did:key:hermes', 'nonce-2', 1);
        expect(entry).not.toBeNull();
        expect(tracker.currentBalance).toBe(800);
        expect(entry!.txType).toBe('send');
    });

    it('send returns null when insufficient balance', () => {
        tracker.initialize(100, 0);
        const entry = tracker.send(200, 'did:key:hermes', 'nonce-3', 1);
        expect(entry).toBeNull();
        expect(tracker.currentBalance).toBe(100); // Unchanged
    });

    it('canAfford checks balance', () => {
        tracker.initialize(500, 0);
        expect(tracker.canAfford(500)).toBe(true);
        expect(tracker.canAfford(501)).toBe(false);
    });

    it('history returns all ledger entries', () => {
        tracker.initialize(1000, 0);
        tracker.receive(50, 'did:key:a', 'n1', 1);
        tracker.send(30, 'did:key:b', 'n2', 2);
        expect(tracker.history).toHaveLength(3);
    });

    it('recent returns last N entries', () => {
        tracker.initialize(1000, 0);
        tracker.receive(50, 'did:key:a', 'n1', 1);
        tracker.send(30, 'did:key:b', 'n2', 2);
        const last = tracker.recent(2);
        expect(last).toHaveLength(2);
        expect(last[0].txType).toBe('receive');
        expect(last[1].txType).toBe('send');
    });

    describe('nonce dedup', () => {
        it('tracks seen nonces', () => {
            tracker.initialize(1000, 0);
            tracker.receive(50, 'did:key:a', 'nonce-abc', 1);
            expect(tracker.hasNonce('nonce-abc')).toBe(true);
            expect(tracker.hasNonce('unknown')).toBe(false);
        });

        it('registerNonce returns false for duplicate', () => {
            expect(tracker.registerNonce('test-nonce')).toBe(true);
            expect(tracker.registerNonce('test-nonce')).toBe(false);
        });
    });

    describe('sequence numbers', () => {
        it('starts at seq 0', () => {
            expect(tracker.currentSeq).toBe(0);
        });

        it('nextSeq increments', () => {
            expect(tracker.nextSeq()).toBe(1);
            expect(tracker.nextSeq()).toBe(2);
            expect(tracker.currentSeq).toBe(2);
        });

        it('checkPeerSeq rejects replay', () => {
            expect(tracker.checkPeerSeq('did:key:a', 1)).toBe(true);
            expect(tracker.checkPeerSeq('did:key:a', 2)).toBe(true);
            expect(tracker.checkPeerSeq('did:key:a', 2)).toBe(false); // replay
            expect(tracker.checkPeerSeq('did:key:a', 1)).toBe(false); // old
        });

        it('tracks per-peer sequences independently', () => {
            expect(tracker.checkPeerSeq('did:key:a', 1)).toBe(true);
            expect(tracker.checkPeerSeq('did:key:b', 1)).toBe(true);
            expect(tracker.checkPeerSeq('did:key:a', 2)).toBe(true);
            expect(tracker.checkPeerSeq('did:key:b', 1)).toBe(false);
        });
    });
});
