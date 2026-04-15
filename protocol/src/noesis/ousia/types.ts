/**
 * Ousia Economy types — transfers, negotiations, shops, balances.
 */

// ── Transfer ──

export interface OusiaOffer {
    type: 'ousia_offer';
    from: string;           // did:key of sender
    to: string;             // did:key of recipient
    amount: number;
    reason: string;
    service?: string;       // Optional service being purchased
    tick: number;
    nonce: string;          // UUIDv4
    expiresAtTick: number;  // Offer expires after this tick
    fromSignature: string;
}

export interface OusiaCounter {
    type: 'ousia_counter';
    offerNonce: string;     // Original offer nonce
    from: string;           // Who is countering
    to: string;
    newAmount: number;
    reason: string;
    counterNonce: string;   // New nonce for this counter
    expiresAtTick: number;
    fromSignature: string;
}

export interface OusiaAccept {
    type: 'ousia_accept';
    nonce: string;          // Offer or counter nonce being accepted
    from: string;           // Who is accepting
    to: string;
    amount: number;         // Final agreed amount
    toSignature: string;
}

export interface OusiaReject {
    type: 'ousia_reject';
    nonce: string;          // Offer or counter nonce being rejected
    from: string;
    reason: string;
}

export interface OusiaCancel {
    type: 'ousia_cancel';
    nonce: string;          // Offer nonce being cancelled
    from: string;
    fromSignature: string;
}

export type OusiaMessage = OusiaOffer | OusiaCounter | OusiaAccept | OusiaReject | OusiaCancel;

// ── Negotiation State Machine ──

export type NegotiationState =
    | 'idle'
    | 'offered'
    | 'countered'
    | 'accepted'
    | 'rejected'
    | 'expired'
    | 'cancelled';

export interface Negotiation {
    offerNonce: string;
    initiator: string;      // did:key who started
    counterparty: string;   // did:key of the other side
    currentAmount: number;
    currentNonce: string;   // Active nonce (offer or latest counter)
    state: NegotiationState;
    counterCount: number;   // How many counters so far
    expiresAtTick: number;
    service?: string;
    reason: string;
    createdAtTick: number;
}

// ── Balance ──

export type TransactionType = 'receive' | 'send' | 'initial' | 'fee';

export interface LedgerEntry {
    id?: number;
    txType: TransactionType;
    amount: number;
    counterpart?: string;   // did:key of other party
    description: string;
    balanceAfter: number;
    nonce: string;
    tick: number;
    createdAt: number;
}

// ── Shop ──

export interface ShopService {
    name: string;
    description: string;
    price: number;          // Ousia cost
    category: string;       // knowledge, labor, entertainment, etc.
}

export interface Shop {
    ownerDid: string;
    name: string;
    description: string;
    services: ShopService[];
    region: string;         // Region where shop is located
    createdAtTick: number;
    active: boolean;
}

// ── Trade Rating ──

export interface TradeRating {
    raterDid: string;
    ratedDid: string;
    tradeNonce: string;
    score: number;          // 0.0 - 1.0
    tick: number;
}
