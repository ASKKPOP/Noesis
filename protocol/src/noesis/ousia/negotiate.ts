/**
 * Negotiation Engine — bilateral offer/counter/accept state machine.
 *
 * States: idle → offered → countered → accepted | rejected | expired | cancelled
 * Max 5 counters per negotiation to prevent infinite loops.
 */

import type {
    Negotiation, NegotiationState,
    OusiaOffer, OusiaCounter, OusiaAccept, OusiaReject, OusiaCancel,
} from './types.js';

const MAX_COUNTERS = 5;
const DEFAULT_EXPIRY_TICKS = 10;

export class NegotiationEngine {
    private readonly negotiations = new Map<string, Negotiation>();

    /** Create a new negotiation from an offer. */
    offer(msg: OusiaOffer): Negotiation {
        if (this.negotiations.has(msg.nonce)) {
            throw new Error(`Negotiation already exists: ${msg.nonce}`);
        }

        const neg: Negotiation = {
            offerNonce: msg.nonce,
            initiator: msg.from,
            counterparty: msg.to,
            currentAmount: msg.amount,
            currentNonce: msg.nonce,
            state: 'offered',
            counterCount: 0,
            expiresAtTick: msg.expiresAtTick,
            service: msg.service,
            reason: msg.reason,
            createdAtTick: msg.tick,
        };

        this.negotiations.set(msg.nonce, neg);
        return neg;
    }

    /** Process a counter-offer. */
    counter(msg: OusiaCounter): Negotiation {
        const neg = this.negotiations.get(msg.offerNonce);
        if (!neg) throw new Error(`Negotiation not found: ${msg.offerNonce}`);

        this.assertActive(neg);

        if (neg.counterCount >= MAX_COUNTERS) {
            throw new Error(`Max counters (${MAX_COUNTERS}) reached`);
        }

        // Only the current respondent can counter
        const expectedResponder = this.currentResponder(neg);
        if (msg.from !== expectedResponder) {
            throw new Error(`Not your turn to counter: expected ${expectedResponder}`);
        }

        neg.currentAmount = msg.newAmount;
        neg.currentNonce = msg.counterNonce;
        neg.counterCount++;
        neg.state = 'countered';
        neg.expiresAtTick = msg.expiresAtTick;

        return neg;
    }

    /** Accept the current offer/counter. */
    accept(msg: OusiaAccept): Negotiation {
        const neg = this.findByNonce(msg.nonce);
        if (!neg) throw new Error(`Negotiation not found for nonce: ${msg.nonce}`);

        this.assertActive(neg);

        // Only the current respondent can accept
        const expectedResponder = this.currentResponder(neg);
        if (msg.from !== expectedResponder) {
            throw new Error(`Not your turn to accept: expected ${expectedResponder}`);
        }

        neg.state = 'accepted';
        neg.currentAmount = msg.amount;
        return neg;
    }

    /** Reject the current offer/counter. */
    reject(msg: OusiaReject): Negotiation {
        const neg = this.findByNonce(msg.nonce);
        if (!neg) throw new Error(`Negotiation not found for nonce: ${msg.nonce}`);

        this.assertActive(neg);

        neg.state = 'rejected';
        return neg;
    }

    /** Cancel a negotiation (only the original offerer can cancel). */
    cancel(msg: OusiaCancel): Negotiation {
        const neg = this.negotiations.get(msg.nonce);
        if (!neg) throw new Error(`Negotiation not found: ${msg.nonce}`);

        this.assertActive(neg);

        if (msg.from !== neg.initiator) {
            throw new Error('Only the initiator can cancel');
        }

        neg.state = 'cancelled';
        return neg;
    }

    /** Expire all negotiations past their deadline. */
    expireAt(currentTick: number): Negotiation[] {
        const expired: Negotiation[] = [];
        for (const neg of this.negotiations.values()) {
            if (this.isActive(neg) && currentTick > neg.expiresAtTick) {
                neg.state = 'expired';
                expired.push(neg);
            }
        }
        return expired;
    }

    /** Get a negotiation by its original offer nonce. */
    get(offerNonce: string): Negotiation | undefined {
        return this.negotiations.get(offerNonce);
    }

    /** Get all active negotiations for a given did. */
    activeFor(did: string): Negotiation[] {
        return [...this.negotiations.values()].filter(
            n => this.isActive(n) && (n.initiator === did || n.counterparty === did),
        );
    }

    /** Total negotiation count. */
    get count(): number {
        return this.negotiations.size;
    }

    /** Determine who should respond next. */
    private currentResponder(neg: Negotiation): string {
        if (neg.state === 'offered') {
            return neg.counterparty;
        }
        // In countered state, the respondent alternates
        // Odd counter count → initiator responds; even → counterparty
        return neg.counterCount % 2 === 1 ? neg.initiator : neg.counterparty;
    }

    /** Find negotiation by any active nonce (offer or counter). */
    private findByNonce(nonce: string): Negotiation | undefined {
        // Direct lookup by offer nonce
        const direct = this.negotiations.get(nonce);
        if (direct) return direct;

        // Search by current counter nonce
        for (const neg of this.negotiations.values()) {
            if (neg.currentNonce === nonce) return neg;
        }
        return undefined;
    }

    private isActive(neg: Negotiation): boolean {
        return neg.state === 'offered' || neg.state === 'countered';
    }

    private assertActive(neg: Negotiation): void {
        if (!this.isActive(neg)) {
            throw new Error(`Negotiation is ${neg.state}, not active`);
        }
    }
}

/** Helper to create an offer message. */
export function createOffer(
    from: string, to: string, amount: number, reason: string,
    tick: number, nonce: string, service?: string,
): OusiaOffer {
    return {
        type: 'ousia_offer',
        from, to, amount, reason, service,
        tick, nonce,
        expiresAtTick: tick + DEFAULT_EXPIRY_TICKS,
        fromSignature: '', // Filled by signing layer
    };
}

/** Helper to create a counter message. */
export function createCounter(
    offerNonce: string, from: string, to: string,
    newAmount: number, reason: string, counterNonce: string, tick: number,
): OusiaCounter {
    return {
        type: 'ousia_counter',
        offerNonce, from, to, newAmount, reason, counterNonce,
        expiresAtTick: tick + DEFAULT_EXPIRY_TICKS,
        fromSignature: '',
    };
}
