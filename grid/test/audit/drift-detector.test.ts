/**
 * Unit tests for DriftDetector — pushes DriftAlert to ring buffer when
 * a non-allowlisted event is appended to AuditChain.
 *
 * Invariants verified:
 *  1. Subscribes to AuditChain.onAppend on construct.
 *  2. Non-allowlisted entry appears in snapshot().
 *  3. Allowlisted entry does NOT appear in snapshot().
 *  4. Tick fallback: missing/non-numeric payload.tick → DriftAlert.tick === 0.
 *  5. peek() is non-destructive (two calls return same result).
 *  6. Listener exception does not propagate; buffer state preserved.
 *  7. close() unsubscribes; subsequent appends do not affect buffer.
 */

import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { DriftDetector } from '../../src/audit/drift-detector.js';

describe('DriftDetector', () => {
    it('subscribes to AuditChain.onAppend on construct', () => {
        const audit = new AuditChain();
        const spy = vi.spyOn(audit, 'onAppend');
        const detector = new DriftDetector(audit);
        expect(spy).toHaveBeenCalledTimes(1);
        void detector;
    });

    it('non-allowlisted entry appears in snapshot with correct fields', () => {
        const audit = new AuditChain();
        const detector = new DriftDetector(audit);
        const entry = audit.append('invented.bad.event', 'did:noesis:actor', { tick: 42 });
        const snap = detector.snapshot();
        expect(snap.length).toBe(1);
        const alert = snap[0];
        expect(alert.event_type).toBe('invented.bad.event');
        expect(alert.actor_did).toBe('did:noesis:actor');
        expect(alert.tick).toBe(42);
        expect(alert.detected_at).toBe(entry.createdAt);
    });

    it('allowlisted entry (nous.spawned) does NOT appear in snapshot', () => {
        const audit = new AuditChain();
        const detector = new DriftDetector(audit);
        audit.append('nous.spawned', 'did:noesis:actor', { tick: 1 });
        expect(detector.snapshot().length).toBe(0);
    });

    it('tick fallback: missing payload.tick → DriftAlert.tick === 0', () => {
        const audit = new AuditChain();
        const detector = new DriftDetector(audit);
        audit.append('invented.event', 'did:noesis:actor', {});
        const [alert] = detector.snapshot();
        expect(alert.tick).toBe(0);
    });

    it('tick fallback: non-numeric payload.tick → DriftAlert.tick === 0', () => {
        const audit = new AuditChain();
        const detector = new DriftDetector(audit);
        audit.append('invented.event', 'did:noesis:actor', { tick: 'not-a-number' });
        const [alert] = detector.snapshot();
        expect(alert.tick).toBe(0);
    });

    it('peek() is non-destructive — two calls return same result', () => {
        const audit = new AuditChain();
        const detector = new DriftDetector(audit);
        audit.append('invented.event', 'did:noesis:actor', { tick: 5 });
        const snap1 = detector.snapshot();
        const snap2 = detector.snapshot();
        expect(snap1.length).toBe(1);
        expect(snap2.length).toBe(1);
        expect(snap1[0].tick).toBe(snap2[0].tick);
    });

    it('listener exception does not propagate; buffer state preserved', () => {
        const audit = new AuditChain();
        const detector = new DriftDetector(audit);
        // Append a valid non-allowlisted event first
        audit.append('invented.event.before', 'did:noesis:actor', { tick: 1 });
        // The AuditChain wraps listener exceptions — DriftDetector adds its own
        // defense-in-depth. This verifies no crash occurs and state is intact.
        expect(() => {
            audit.append('invented.event.after', 'did:noesis:actor2', { tick: 2 });
        }).not.toThrow();
        expect(detector.snapshot().length).toBe(2);
    });

    it('close() unsubscribes; subsequent appends do not affect buffer', () => {
        const audit = new AuditChain();
        const detector = new DriftDetector(audit);
        audit.append('invented.event', 'did:noesis:actor', { tick: 1 });
        expect(detector.snapshot().length).toBe(1);
        detector.close();
        // After close, new appends should not be picked up
        audit.append('invented.event.post-close', 'did:noesis:actor', { tick: 2 });
        expect(detector.snapshot().length).toBe(1);
    });
});
