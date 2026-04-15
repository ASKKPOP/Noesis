/**
 * Human Gateway — manages WebSocket sessions between humans and their Nous.
 *
 * Handles session lifecycle, authentication, heartbeats, and message routing.
 * The actual WebSocket transport is injected — this is the session logic layer.
 */

import { randomUUID } from 'node:crypto';
import type {
    GatewaySession, ConnectionState, ChannelMessage,
    WhisperMessage, InterventionMessage, ActivityEvent,
} from './types.js';
import type { ConsentManager } from './consent.js';

const HEARTBEAT_TIMEOUT_MS = 60_000; // 60 seconds

export type MessageHandler = (msg: ChannelMessage) => void;

export class HumanGateway {
    private readonly sessions = new Map<string, GatewaySession>();
    private readonly consent: ConsentManager;
    private readonly handlers = new Map<string, Set<MessageHandler>>(); // keyed by nousDid

    constructor(consent: ConsentManager) {
        this.consent = consent;
    }

    /** Create a new session for a human connecting to their Nous. */
    connect(humanId: string, nousDid: string): GatewaySession {
        if (!this.consent.hasPermission(humanId, nousDid, 'observe')) {
            throw new Error('No observe permission for this Nous');
        }

        const session: GatewaySession = {
            sessionId: randomUUID(),
            humanId,
            nousDid,
            state: 'authenticated',
            connectedAt: Date.now(),
            lastHeartbeat: Date.now(),
            observing: false,
        };

        this.sessions.set(session.sessionId, session);
        return session;
    }

    /** Start observing a Nous activity stream. */
    startObserving(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session || session.state !== 'authenticated') return false;
        if (!this.consent.hasPermission(session.humanId, session.nousDid, 'observe')) return false;
        session.observing = true;
        return true;
    }

    /** Stop observing. */
    stopObserving(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        session.observing = false;
        return true;
    }

    /** Send a whisper from human to Nous. */
    whisper(sessionId: string, content: string, priority: WhisperMessage['priority'] = 'normal'): WhisperMessage | null {
        const session = this.sessions.get(sessionId);
        if (!session || session.state !== 'authenticated') return null;
        if (!this.consent.hasPermission(session.humanId, session.nousDid, 'whisper')) return null;

        const msg: WhisperMessage = {
            type: 'whisper',
            humanId: session.humanId,
            nousDid: session.nousDid,
            content,
            priority,
            timestamp: Date.now(),
        };

        this.dispatch(session.nousDid, msg as unknown as ChannelMessage);
        return msg;
    }

    /** Send an intervention from human to Nous. */
    intervene(
        sessionId: string,
        action: InterventionMessage['action'],
        reason: string,
        targetActionId?: string,
    ): InterventionMessage | null {
        const session = this.sessions.get(sessionId);
        if (!session || session.state !== 'authenticated') return null;
        if (!this.consent.hasPermission(session.humanId, session.nousDid, 'intervene')) return null;

        const msg: InterventionMessage = {
            type: 'intervene',
            humanId: session.humanId,
            nousDid: session.nousDid,
            action,
            targetActionId,
            reason,
            timestamp: Date.now(),
        };

        this.dispatch(session.nousDid, msg as unknown as ChannelMessage);
        return msg;
    }

    /** Broadcast an activity event to all observing humans for a Nous. */
    broadcastActivity(event: ActivityEvent): number {
        let count = 0;
        for (const session of this.sessions.values()) {
            if (session.nousDid === event.nousDid && session.observing && session.state === 'authenticated') {
                count++;
            }
        }
        if (count > 0) {
            this.dispatch(event.nousDid, event as unknown as ChannelMessage);
        }
        return count;
    }

    /** Process heartbeat for a session. */
    heartbeat(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        session.lastHeartbeat = Date.now();
        return true;
    }

    /** Disconnect a session. */
    disconnect(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        session.state = 'disconnected';
        session.observing = false;
        this.sessions.delete(sessionId);
        return true;
    }

    /** Sweep stale sessions (no heartbeat within timeout). */
    sweepStale(): string[] {
        const now = Date.now();
        const stale: string[] = [];
        for (const [id, session] of this.sessions) {
            if (now - session.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
                session.state = 'disconnected';
                session.observing = false;
                this.sessions.delete(id);
                stale.push(id);
            }
        }
        return stale;
    }

    /** Register a handler for messages targeting a Nous. */
    onMessage(nousDid: string, handler: MessageHandler): () => void {
        let handlers = this.handlers.get(nousDid);
        if (!handlers) {
            handlers = new Set();
            this.handlers.set(nousDid, handlers);
        }
        handlers.add(handler);
        return () => handlers!.delete(handler);
    }

    /** Get session by ID. */
    getSession(sessionId: string): GatewaySession | undefined {
        return this.sessions.get(sessionId);
    }

    /** Get all active sessions for a Nous. */
    sessionsFor(nousDid: string): GatewaySession[] {
        return [...this.sessions.values()].filter(s => s.nousDid === nousDid);
    }

    /** Total active sessions. */
    get sessionCount(): number {
        return this.sessions.size;
    }

    private dispatch(nousDid: string, msg: ChannelMessage): void {
        const handlers = this.handlers.get(nousDid);
        if (!handlers) return;
        for (const handler of handlers) {
            try { handler(msg); } catch { /* handler errors don't crash gateway */ }
        }
    }
}
