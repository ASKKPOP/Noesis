import { describe, it, expect, beforeEach } from 'vitest';
import { HumanObserver } from '../../src/noesis/human/observer.js';
import type { ActivityEvent } from '../../src/noesis/human/types.js';

const NOUS = 'did:key:sophia';

describe('HumanObserver', () => {
    let observer: HumanObserver;

    beforeEach(() => {
        observer = new HumanObserver(NOUS);
    });

    it('converts speak action to activity', () => {
        const event = observer.observe({ actionType: 'speak', content: 'Hello world' }, 1);
        expect(event.eventKind).toBe('spoke');
        expect(event.summary).toContain('Hello world');
        expect(event.nousDid).toBe(NOUS);
        expect(event.tick).toBe(1);
    });

    it('converts direct_message action', () => {
        const event = observer.observe({
            actionType: 'direct_message', content: 'Secret', target: 'did:key:hermes',
        }, 2);
        expect(event.eventKind).toBe('spoke');
        expect(event.summary).toContain('DM to did:key:hermes');
    });

    it('converts move action', () => {
        const event = observer.observe({ actionType: 'move', location: 'market' }, 3);
        expect(event.eventKind).toBe('moved');
        expect(event.summary).toContain('market');
    });

    it('converts trade_request action', () => {
        const event = observer.observe({
            actionType: 'trade_request', amount: 50, target: 'did:key:hermes',
        }, 4);
        expect(event.eventKind).toBe('traded');
        expect(event.summary).toContain('50');
    });

    it('converts reflect action', () => {
        const event = observer.observe({ actionType: 'reflect', content: 'I should be kinder' }, 5);
        expect(event.eventKind).toBe('reflected');
        expect(event.summary).toContain('kinder');
    });

    it('converts wiki_update action', () => {
        const event = observer.observe({ actionType: 'wiki_update', content: 'Hermes page' }, 6);
        expect(event.eventKind).toBe('learned');
        expect(event.summary).toContain('Hermes page');
    });

    it('handles unknown action type', () => {
        const event = observer.observe({ actionType: 'custom_thing' }, 7);
        expect(event.eventKind).toBe('spoke');
        expect(event.summary).toContain('custom_thing');
    });

    it('truncates long content', () => {
        const long = 'A'.repeat(200);
        const event = observer.observe({ actionType: 'speak', content: long }, 1);
        expect(event.summary.length).toBeLessThan(200);
        expect(event.summary).toContain('...');
    });

    it('broadcasts to listeners', () => {
        const events: ActivityEvent[] = [];
        observer.onActivity(e => events.push(e));
        observer.observe({ actionType: 'speak', content: 'hi' }, 1);
        expect(events).toHaveLength(1);
    });

    it('unsubscribe removes listener', () => {
        const events: ActivityEvent[] = [];
        const unsub = observer.onActivity(e => events.push(e));
        observer.observe({ actionType: 'speak', content: 'first' }, 1);
        unsub();
        observer.observe({ actionType: 'speak', content: 'second' }, 2);
        expect(events).toHaveLength(1);
    });

    it('listener errors do not crash observer', () => {
        observer.onActivity(() => { throw new Error('boom'); });
        const events: ActivityEvent[] = [];
        observer.onActivity(e => events.push(e));
        observer.observe({ actionType: 'speak', content: 'test' }, 1);
        expect(events).toHaveLength(1);
    });
});
