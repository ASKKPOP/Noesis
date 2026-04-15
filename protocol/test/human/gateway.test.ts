import { describe, it, expect, beforeEach } from 'vitest';
import { HumanGateway } from '../../src/noesis/human/gateway.js';
import { ConsentManager } from '../../src/noesis/human/consent.js';
import type { OwnershipProof, ActivityEvent, ChannelMessage } from '../../src/noesis/human/types.js';

const HUMAN = 'human-alice';
const NOUS = 'did:key:sophia';

function setupConsent(): ConsentManager {
    const consent = new ConsentManager();
    const proof: OwnershipProof = {
        humanId: HUMAN, nousDid: NOUS,
        signature: 'sig', issuedAt: Date.now(), expiresAt: Date.now() + 3600_000,
    };
    consent.registerOwnership(proof);
    consent.grant(HUMAN, NOUS, ['observe', 'whisper', 'intervene']);
    return consent;
}

describe('HumanGateway', () => {
    let gateway: HumanGateway;
    let consent: ConsentManager;

    beforeEach(() => {
        consent = setupConsent();
        gateway = new HumanGateway(consent);
    });

    describe('sessions', () => {
        it('connects an authorized human', () => {
            const session = gateway.connect(HUMAN, NOUS);
            expect(session.state).toBe('authenticated');
            expect(session.humanId).toBe(HUMAN);
            expect(session.nousDid).toBe(NOUS);
            expect(gateway.sessionCount).toBe(1);
        });

        it('rejects unauthorized human', () => {
            expect(() => gateway.connect('stranger', NOUS)).toThrow('No observe permission');
        });

        it('disconnects a session', () => {
            const session = gateway.connect(HUMAN, NOUS);
            expect(gateway.disconnect(session.sessionId)).toBe(true);
            expect(gateway.sessionCount).toBe(0);
        });

        it('disconnect returns false for unknown session', () => {
            expect(gateway.disconnect('nonexistent')).toBe(false);
        });

        it('getSession retrieves by id', () => {
            const session = gateway.connect(HUMAN, NOUS);
            expect(gateway.getSession(session.sessionId)?.humanId).toBe(HUMAN);
        });

        it('sessionsFor lists sessions for a Nous', () => {
            gateway.connect(HUMAN, NOUS);
            expect(gateway.sessionsFor(NOUS)).toHaveLength(1);
            expect(gateway.sessionsFor('did:key:other')).toHaveLength(0);
        });
    });

    describe('observing', () => {
        it('starts and stops observing', () => {
            const session = gateway.connect(HUMAN, NOUS);
            expect(session.observing).toBe(false);
            expect(gateway.startObserving(session.sessionId)).toBe(true);
            expect(gateway.getSession(session.sessionId)!.observing).toBe(true);
            expect(gateway.stopObserving(session.sessionId)).toBe(true);
            expect(gateway.getSession(session.sessionId)!.observing).toBe(false);
        });

        it('startObserving returns false for invalid session', () => {
            expect(gateway.startObserving('invalid')).toBe(false);
        });
    });

    describe('whisper', () => {
        it('sends a whisper to Nous', () => {
            const session = gateway.connect(HUMAN, NOUS);
            const messages: ChannelMessage[] = [];
            gateway.onMessage(NOUS, msg => messages.push(msg));

            const whisper = gateway.whisper(session.sessionId, 'Be careful here');
            expect(whisper).not.toBeNull();
            expect(whisper!.content).toBe('Be careful here');
            expect(whisper!.priority).toBe('normal');
            expect(messages).toHaveLength(1);
        });

        it('whisper returns null without permission', () => {
            consent.revokeScope(HUMAN, NOUS, 'whisper');
            const session = gateway.connect(HUMAN, NOUS);
            expect(gateway.whisper(session.sessionId, 'test')).toBeNull();
        });

        it('whisper with priority', () => {
            const session = gateway.connect(HUMAN, NOUS);
            const whisper = gateway.whisper(session.sessionId, 'urgent!', 'urgent');
            expect(whisper!.priority).toBe('urgent');
        });
    });

    describe('intervene', () => {
        it('sends an intervention', () => {
            const session = gateway.connect(HUMAN, NOUS);
            const messages: ChannelMessage[] = [];
            gateway.onMessage(NOUS, msg => messages.push(msg));

            const intervention = gateway.intervene(session.sessionId, 'pause', 'taking a break');
            expect(intervention).not.toBeNull();
            expect(intervention!.action).toBe('pause');
            expect(messages).toHaveLength(1);
        });

        it('intervene returns null without permission', () => {
            consent.revokeScope(HUMAN, NOUS, 'intervene');
            const session = gateway.connect(HUMAN, NOUS);
            expect(gateway.intervene(session.sessionId, 'pause', 'test')).toBeNull();
        });

        it('cancel_action with target', () => {
            const session = gateway.connect(HUMAN, NOUS);
            const msg = gateway.intervene(session.sessionId, 'cancel_action', 'bad trade', 'action-123');
            expect(msg!.targetActionId).toBe('action-123');
        });
    });

    describe('broadcast', () => {
        it('broadcasts activity to observing sessions', () => {
            const session = gateway.connect(HUMAN, NOUS);
            gateway.startObserving(session.sessionId);

            const event: ActivityEvent = {
                type: 'activity', nousDid: NOUS, eventKind: 'spoke',
                summary: 'Said hello', details: {}, tick: 1, timestamp: Date.now(),
            };

            const count = gateway.broadcastActivity(event);
            expect(count).toBe(1);
        });

        it('does not broadcast to non-observing sessions', () => {
            gateway.connect(HUMAN, NOUS); // not observing

            const event: ActivityEvent = {
                type: 'activity', nousDid: NOUS, eventKind: 'moved',
                summary: 'Moved', details: {}, tick: 1, timestamp: Date.now(),
            };

            expect(gateway.broadcastActivity(event)).toBe(0);
        });
    });

    describe('heartbeat and sweep', () => {
        it('heartbeat updates timestamp', () => {
            const session = gateway.connect(HUMAN, NOUS);
            const before = session.lastHeartbeat;
            // Small delay to ensure timestamp changes
            gateway.heartbeat(session.sessionId);
            expect(gateway.getSession(session.sessionId)!.lastHeartbeat).toBeGreaterThanOrEqual(before);
        });

        it('sweepStale removes timed-out sessions', () => {
            const session = gateway.connect(HUMAN, NOUS);
            // Force stale heartbeat
            (session as any).lastHeartbeat = Date.now() - 120_000;
            const swept = gateway.sweepStale();
            expect(swept).toHaveLength(1);
            expect(swept[0]).toBe(session.sessionId);
            expect(gateway.sessionCount).toBe(0);
        });

        it('sweepStale keeps fresh sessions', () => {
            gateway.connect(HUMAN, NOUS);
            const swept = gateway.sweepStale();
            expect(swept).toHaveLength(0);
            expect(gateway.sessionCount).toBe(1);
        });
    });

    describe('message handlers', () => {
        it('unsubscribe removes handler', () => {
            const messages: ChannelMessage[] = [];
            const unsub = gateway.onMessage(NOUS, msg => messages.push(msg));

            const session = gateway.connect(HUMAN, NOUS);
            gateway.whisper(session.sessionId, 'first');
            unsub();
            gateway.whisper(session.sessionId, 'second');

            expect(messages).toHaveLength(1);
        });

        it('handler errors do not crash gateway', () => {
            gateway.onMessage(NOUS, () => { throw new Error('boom'); });
            const messages: ChannelMessage[] = [];
            gateway.onMessage(NOUS, msg => messages.push(msg));

            const session = gateway.connect(HUMAN, NOUS);
            gateway.whisper(session.sessionId, 'test');
            expect(messages).toHaveLength(1);
        });
    });
});
