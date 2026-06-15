/**
 * Groups & Holdings · Phase 69 — sole-producers for group.project_started / completed.
 *
 * A Group runs research projects that produce blueprints/skills (money-free; the
 * treasury is deferred to the on-chain rails). Verifies allowlist membership, valid
 * events with group_id as actor, closed-tuple + regex validation, and that no
 * plaintext project title crosses (only the UUID project_id + blueprint_hash).
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';
import { appendGroupProjectStarted } from '../../src/audit/append-group-project-started.js';
import { appendGroupProjectCompleted } from '../../src/audit/append-group-project-completed.js';

const GROUP = 'genesis:group:aegis';
const PROJECT = '0b2e7a14-9c1d-4f6e-8a3b-5d7c9e1f2a4b';
const HEX64 = 'a'.repeat(64);

describe('group.project_started', () => {
    const valid = { group_id: GROUP, project_id: PROJECT, tick: 30 };

    it('is allowlisted', () => {
        expect(ALLOWLIST.has('group.project_started')).toBe(true);
    });

    it('lands a valid event with group_id as actor', () => {
        const audit = new AuditChain();
        const entry = appendGroupProjectStarted(audit, { ...valid });
        expect(entry.eventType).toBe('group.project_started');
        expect(entry.actorDid).toBe(GROUP);
    });

    it('rejects a non-uuid project_id', () => {
        const audit = new AuditChain();
        expect(() => appendGroupProjectStarted(audit, { ...valid, project_id: 'proj-1' } as never)).toThrow(/project_id/);
    });

    it('rejects an extra key (closed tuple — no title leaks)', () => {
        const audit = new AuditChain();
        expect(() => appendGroupProjectStarted(audit, { ...valid, title: 'Railgun' } as never)).toThrow(/closed-tuple/);
    });
});

describe('group.project_completed', () => {
    const valid = { blueprint_hash: HEX64, group_id: GROUP, project_id: PROJECT, tick: 80 };

    it('is allowlisted', () => {
        expect(ALLOWLIST.has('group.project_completed')).toBe(true);
    });

    it('lands a valid event carrying the produced blueprint hash', () => {
        const audit = new AuditChain();
        const entry = appendGroupProjectCompleted(audit, { ...valid });
        expect(entry.eventType).toBe('group.project_completed');
        expect(entry.actorDid).toBe(GROUP);
        expect((entry.payload as { blueprint_hash: string }).blueprint_hash).toBe(HEX64);
    });

    it('rejects a non-HEX64 blueprint_hash', () => {
        const audit = new AuditChain();
        expect(() => appendGroupProjectCompleted(audit, { ...valid, blueprint_hash: 'nope' } as never)).toThrow(/blueprint_hash/);
    });

    it('rejects a missing key', () => {
        const audit = new AuditChain();
        const { tick, ...missing } = valid;
        expect(() => appendGroupProjectCompleted(audit, missing as never)).toThrow(/tick/);
    });
});
