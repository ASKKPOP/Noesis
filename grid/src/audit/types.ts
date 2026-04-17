/**
 * Audit types — hash-chained event log entries.
 */

export interface AuditEntry {
    id?: number;
    eventType: string;       // domain.register, ousia.transfer, law.enacted, etc.
    actorDid: string;        // Who performed the action
    targetDid?: string;      // Who was affected (optional)
    payload: Record<string, unknown>;
    prevHash: string;        // SHA-256 hash of previous entry
    eventHash: string;       // SHA-256(prevHash + eventType + actorDid + payload + timestamp)
    createdAt: number;       // Unix timestamp (ms)
}

export interface AuditQuery {
    eventType?: string;
    actorDid?: string;
    targetDid?: string;
    limit?: number;
    offset?: number;
}

export type AppendListener = (entry: AuditEntry) => void;
export type Unsubscribe = () => void;
