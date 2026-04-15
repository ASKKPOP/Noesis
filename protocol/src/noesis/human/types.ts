/**
 * Human Channel types — ownership, consent, observation, intervention.
 *
 * Humans own Nous agents. The channel allows:
 * - Observing: watch what your Nous sees/does in real-time
 * - Whispering: send private guidance to your Nous (invisible to other Nous)
 * - Intervening: override Nous actions in critical moments
 * - Configuring: adjust personality, goals, boundaries
 */

// ── Ownership ──

export interface HumanOwner {
    humanId: string;          // Unique human identifier
    displayName: string;
    nousDids: string[];       // DIDs of owned Nous agents
    createdAt: number;
}

export interface OwnershipProof {
    humanId: string;
    nousDid: string;
    signature: string;        // Human signs the DID to prove ownership
    issuedAt: number;
    expiresAt: number;        // Ownership proofs expire and must be renewed
}

// ── Consent & Permissions ──

export type PermissionScope =
    | 'observe'         // Watch Nous activity stream
    | 'whisper'         // Send private guidance
    | 'intervene'       // Override Nous actions
    | 'configure'       // Modify personality/goals
    | 'transfer'        // Transfer Ousia on behalf of Nous
    | 'trade'           // Accept/reject trades on behalf
    | 'move';           // Move Nous between regions

export interface ConsentGrant {
    nousDid: string;
    humanId: string;
    scopes: PermissionScope[];
    grantedAt: number;
    expiresAt: number | null;   // null = permanent until revoked
    revokedAt: number | null;
}

// ── Channel Messages ──

export type ChannelMessageType =
    | 'observe_start'
    | 'observe_stop'
    | 'whisper'
    | 'intervene'
    | 'configure'
    | 'activity'          // Nous → Human activity stream
    | 'state_update'      // Nous → Human state snapshot
    | 'consent_request'   // Nous → Human asking for permission
    | 'consent_response'  // Human → Nous granting/denying
    | 'heartbeat';

export interface ChannelMessage {
    type: ChannelMessageType;
    humanId: string;
    nousDid: string;
    payload: Record<string, unknown>;
    timestamp: number;
}

export interface WhisperMessage {
    type: 'whisper';
    humanId: string;
    nousDid: string;
    content: string;          // Private guidance text
    priority: 'low' | 'normal' | 'urgent';
    timestamp: number;
}

export interface InterventionMessage {
    type: 'intervene';
    humanId: string;
    nousDid: string;
    action: 'cancel_action' | 'force_action' | 'pause' | 'resume';
    targetActionId?: string;  // Which pending action to cancel
    forcedAction?: Record<string, unknown>; // Action to force
    reason: string;
    timestamp: number;
}

export interface ActivityEvent {
    type: 'activity';
    nousDid: string;
    eventKind: 'spoke' | 'moved' | 'traded' | 'received_message' | 'reflected' | 'learned' | 'sanctioned';
    summary: string;
    details: Record<string, unknown>;
    tick: number;
    timestamp: number;
}

// ── Gateway ──

export type ConnectionState = 'connecting' | 'connected' | 'authenticated' | 'disconnected';

export interface GatewaySession {
    sessionId: string;
    humanId: string;
    nousDid: string;
    state: ConnectionState;
    connectedAt: number;
    lastHeartbeat: number;
    observing: boolean;
}
