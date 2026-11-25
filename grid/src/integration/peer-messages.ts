/**
 * Peer messages — how a direct message from one Nous reaches another Nous's Brain.
 *
 * The sender's Brain posts a `direct_message` action; NousRunner records the fact on
 * the audit chain (who wrote to whom, never the text) and hands the message to a
 * PeerMessageSink. The router below is that sink in production: it puts the message in
 * the target's row set of `civic_message_queue` (the Phase 41 Nous-to-Nous queue). The
 * target's Brain reads it with `GET /api/v1/civic/inbox` and claims it with
 * `PATCH /api/v1/civic/inbox/ack`, both scoped to its own Civic-DID.
 *
 * The runner is the only writer of `kind: 'direct_message'` rows: the open
 * `POST /api/v1/civic/message` route refuses that kind, so a Brain can trust the
 * `sender_did` inside the envelope.
 *
 * A lore request and a lore response travel the same way and leave the same audit
 * record; the runner sends them only in their exact wire form (`isLoreHash`,
 * `isLoreResponsePayload`).
 *
 * Verified under the Triple Verification Rule as P-DM-01..09
 * (verification/PROPERTIES.md).
 */

/** Longest text a peer message may carry, in UTF-16 code units. */
export const PEER_MESSAGE_MAX_CHARS = 16_384;

/** The `kind` of a queue row written by this router. Reserved: see civic-message.ts. */
export const PEER_MESSAGE_KIND = 'direct_message';

export interface PeerMessage {
    readonly senderDid: string;
    readonly senderName: string;
    readonly targetDid: string;
    readonly channel: string;
    readonly text: string;
    readonly tick: number;
}

/** What is stored in `civic_message_queue.message_json` and returned to the target's Brain. */
export interface PeerMessageEnvelope {
    readonly kind: typeof PEER_MESSAGE_KIND;
    readonly sender_did: string;
    readonly sender_name: string;
    readonly channel: string;
    readonly text: string;
    readonly tick: number;
}

export type PeerTextVerdict = 'ok' | 'empty' | 'too_long';

export type PeerDeliveryResult =
    | 'queued'
    | 'empty'
    | 'too_long'
    | 'self'
    | 'sender_not_citizen'
    | 'target_not_citizen'
    | 'inbox_full';

/** Something that takes a peer message off the runner's hands. */
export interface PeerMessageSink {
    deliver(message: PeerMessage): Promise<PeerDeliveryResult>;
}

export interface PeerMessageRouterDeps {
    readonly gridName: string;
    /**
     * The active Civic-DID of a living Nous, or null when it has none: never
     * registered, revoked, or the Nous is deleted.
     */
    civicDidOf(nousDid: string): Promise<string | null>;
    readonly queue: {
        /** Returns the new row id, or null when the recipient's inbox is full. */
        enqueue(
            gridName: string,
            recipientCivicDid: string,
            senderCivicDid: string,
            messageJson: unknown,
            sentAtTick: number,
        ): Promise<number | null>;
    };
}

/** Is this text acceptable as a peer message body? */
export function checkPeerText(text: unknown): PeerTextVerdict {
    if (typeof text !== 'string' || text.length === 0) return 'empty';
    if (text.length > PEER_MESSAGE_MAX_CHARS) return 'too_long';
    return 'ok';
}

/** A lore content hash: sha-256 as 64 lowercase hex characters. */
export function isLoreHash(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/**
 * A lore response as the Brain builds it: `__lore_response:<hash>:<base64 of the entry>`.
 * Nothing else may travel as a lore response — not free text, not a taught skill.
 */
export function isLoreResponsePayload(value: unknown): value is string {
    return typeof value === 'string'
        && /^__lore_response:[0-9a-f]{64}:(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
        && !value.endsWith(':');
}

/**
 * The `civicDidOf` rule: a DID can write and be written to only if this Grid's registry
 * knows it as a Nous that is not deleted, and it holds an active Civic-DID. A DID the
 * registry has never seen — a human's, a typo — holds no inbox any Brain reads.
 */
export function registeredCivicDidOf(
    registry: { get(did: string): { status: string } | undefined },
    activeCivicDidOf: (nousDid: string) => Promise<string | null>,
): (nousDid: string) => Promise<string | null> {
    return async (nousDid) => {
        const record = registry.get(nousDid);
        if (record === undefined || record.status === 'deleted') return null;
        return activeCivicDidOf(nousDid);
    };
}

export class PeerMessageRouter implements PeerMessageSink {
    constructor(private readonly deps: PeerMessageRouterDeps) {}

    async deliver(message: PeerMessage): Promise<PeerDeliveryResult> {
        const verdict = checkPeerText(message.text);
        if (verdict !== 'ok') return verdict;
        if (message.targetDid === message.senderDid) return 'self';

        const senderCivicDid = await this.deps.civicDidOf(message.senderDid);
        if (senderCivicDid === null) return 'sender_not_citizen';
        const targetCivicDid = await this.deps.civicDidOf(message.targetDid);
        if (targetCivicDid === null) return 'target_not_citizen';

        const envelope: PeerMessageEnvelope = {
            kind: PEER_MESSAGE_KIND,
            sender_did: message.senderDid,
            sender_name: message.senderName,
            channel: message.channel,
            text: message.text,
            tick: message.tick,
        };
        const id = await this.deps.queue.enqueue(
            this.deps.gridName, targetCivicDid, senderCivicDid, envelope, message.tick,
        );
        return id === null ? 'inbox_full' : 'queued';
    }
}
