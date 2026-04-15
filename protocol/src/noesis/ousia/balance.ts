/**
 * Balance Tracker — local Ousia ledger with sequence-based double-spend prevention.
 */

import type { LedgerEntry, TransactionType } from './types.js';

export class BalanceTracker {
    private balance = 0;
    private readonly ledger: LedgerEntry[] = [];
    private seq = 0;                              // Monotonic sequence counter
    private readonly peerSeqs = new Map<string, number>(); // Last-seen seq per peer
    private readonly seenNonces = new Set<string>();       // Nonce dedup

    /** Initialize with starting balance (e.g., faucet grant). */
    initialize(amount: number, tick: number): LedgerEntry {
        this.balance = amount;
        return this.record('initial', amount, 'Initial Ousia grant', `init-${tick}`, tick);
    }

    /** Record receiving Ousia from another Nous. */
    receive(amount: number, fromDid: string, nonce: string, tick: number, description = ''): LedgerEntry {
        this.balance += amount;
        return this.record('receive', amount, description || `Received from ${fromDid}`, nonce, tick, fromDid);
    }

    /** Record sending Ousia to another Nous. Returns null if insufficient balance. */
    send(amount: number, toDid: string, nonce: string, tick: number, description = ''): LedgerEntry | null {
        if (amount > this.balance) return null;
        this.balance -= amount;
        return this.record('send', amount, description || `Sent to ${toDid}`, nonce, tick, toDid);
    }

    /** Check if a nonce has been seen (replay prevention). */
    hasNonce(nonce: string): boolean {
        return this.seenNonces.has(nonce);
    }

    /** Register a nonce as seen. Returns false if already seen. */
    registerNonce(nonce: string): boolean {
        if (this.seenNonces.has(nonce)) return false;
        this.seenNonces.add(nonce);
        return true;
    }

    /** Check peer sequence number. Returns false if replay detected. */
    checkPeerSeq(peerDid: string, peerSeq: number): boolean {
        const lastSeen = this.peerSeqs.get(peerDid) ?? -1;
        if (peerSeq <= lastSeen) return false;
        this.peerSeqs.set(peerDid, peerSeq);
        return true;
    }

    /** Get current outgoing sequence number (for inclusion in offers). */
    get currentSeq(): number {
        return this.seq;
    }

    /** Increment and return next sequence number. */
    nextSeq(): number {
        return ++this.seq;
    }

    /** Current balance. */
    get currentBalance(): number {
        return this.balance;
    }

    /** Check if balance is sufficient for an amount. */
    canAfford(amount: number): boolean {
        return this.balance >= amount;
    }

    /** Full ledger history. */
    get history(): readonly LedgerEntry[] {
        return this.ledger;
    }

    /** Recent transactions. */
    recent(count: number): LedgerEntry[] {
        return this.ledger.slice(-count);
    }

    private record(
        txType: TransactionType,
        amount: number,
        description: string,
        nonce: string,
        tick: number,
        counterpart?: string,
    ): LedgerEntry {
        const entry: LedgerEntry = {
            id: this.ledger.length + 1,
            txType,
            amount,
            counterpart,
            description,
            balanceAfter: this.balance,
            nonce,
            tick,
            createdAt: Date.now(),
        };
        this.ledger.push(entry);
        this.seenNonces.add(nonce);
        return entry;
    }
}
