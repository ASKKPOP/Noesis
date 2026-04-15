/**
 * Noēsis Domain System — Unit Tests
 *
 * Tests URI parsing, name validation, domain registry, and communication gate.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    parseNousUri,
    buildNousUri,
    isValidSegment,
    validateName,
    validateGridDomain,
    DomainRegistry,
    CommunicationGate,
} from '../../src/noesis/domain/index.js';
import { generateIdentity } from '../../src/identity.js';
import { createEnvelope } from '../../src/swp.js';

// ── URI Parser ──────────────────────────────────────────────────

describe('NDS URI Parser', () => {
    it('should parse valid nous:// URIs', () => {
        const result = parseNousUri('nous://sophia.thinkers');
        expect(result).toEqual({
            name: 'sophia',
            gridDomain: 'thinkers',
            fullAddress: 'nous://sophia.thinkers',
        });
    });

    it('should parse hyphenated names', () => {
        const result = parseNousUri('nous://my-nous.my-grid');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('my-nous');
        expect(result!.gridDomain).toBe('my-grid');
    });

    it('should reject missing scheme', () => {
        expect(parseNousUri('sophia.thinkers')).toBeNull();
        expect(parseNousUri('http://sophia.thinkers')).toBeNull();
    });

    it('should reject missing dot separator', () => {
        expect(parseNousUri('nous://sophia')).toBeNull();
    });

    it('should reject multiple dots', () => {
        expect(parseNousUri('nous://sophia.sub.thinkers')).toBeNull();
    });

    it('should reject names that are too short', () => {
        expect(parseNousUri('nous://ab.thinkers')).toBeNull();
    });

    it('should reject names with uppercase', () => {
        expect(parseNousUri('nous://Sophia.thinkers')).toBeNull();
    });

    it('should reject names with leading/trailing hyphens', () => {
        expect(parseNousUri('nous://-sophia.thinkers')).toBeNull();
        expect(parseNousUri('nous://sophia-.thinkers')).toBeNull();
    });

    it('should reject names with special characters', () => {
        expect(parseNousUri('nous://soph!a.thinkers')).toBeNull();
        expect(parseNousUri('nous://sophia.think ers')).toBeNull();
    });
});

describe('NDS URI Builder', () => {
    it('should build valid URIs', () => {
        expect(buildNousUri('sophia', 'thinkers')).toBe('nous://sophia.thinkers');
    });

    it('should reject invalid segments', () => {
        expect(buildNousUri('ab', 'thinkers')).toBeNull();
        expect(buildNousUri('sophia', 'ab')).toBeNull();
    });
});

describe('Segment Validation', () => {
    it('should accept valid segments', () => {
        expect(isValidSegment('sophia')).toBe(true);
        expect(isValidSegment('hermes')).toBe(true);
        expect(isValidSegment('my-nous')).toBe(true);
        expect(isValidSegment('abc')).toBe(true);
        expect(isValidSegment('a1b2c3')).toBe(true);
    });

    it('should reject too short', () => {
        expect(isValidSegment('ab')).toBe(false);
        expect(isValidSegment('a')).toBe(false);
        expect(isValidSegment('')).toBe(false);
    });

    it('should reject too long', () => {
        expect(isValidSegment('a'.repeat(64))).toBe(false);
    });

    it('should accept max length', () => {
        expect(isValidSegment('a'.repeat(63))).toBe(true);
    });
});

// ── Name Validator ──────────────────────────────────────────────

describe('NDS Name Validator', () => {
    it('should accept valid names', () => {
        expect(validateName('sophia').valid).toBe(true);
        expect(validateName('hermes').valid).toBe(true);
        expect(validateName('atlas-prime').valid).toBe(true);
    });

    it('should reject forbidden names', () => {
        expect(validateName('admin').valid).toBe(false);
        expect(validateName('root').valid).toBe(false);
        expect(validateName('system').valid).toBe(false);
        expect(validateName('grid').valid).toBe(false);
        expect(validateName('noesis').valid).toBe(false);
        expect(validateName('null').valid).toBe(false);
        expect(validateName('undefined').valid).toBe(false);
    });

    it('should reject uppercase', () => {
        const result = validateName('Sophia');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('lowercase');
    });

    it('should reject empty', () => {
        expect(validateName('').valid).toBe(false);
    });
});

describe('NDS Grid Domain Validator', () => {
    it('should accept valid grid domains', () => {
        expect(validateGridDomain('thinkers').valid).toBe(true);
        expect(validateGridDomain('genesis').valid).toBe(true);
        expect(validateGridDomain('my-grid').valid).toBe(true);
    });

    it('should reject invalid', () => {
        expect(validateGridDomain('ab').valid).toBe(false);
        expect(validateGridDomain('').valid).toBe(false);
    });
});

// ── Domain Registry ─────────────────────────────────────────────

describe('Domain Registry', () => {
    let registry: DomainRegistry;

    beforeEach(() => {
        registry = new DomainRegistry({ gridDomain: 'thinkers' });
    });

    it('should register a domain', () => {
        const identity = generateIdentity('Sophia');
        const record = registry.register({
            name: 'sophia',
            didKey: identity.did,
            publicKey: identity.publicKey,
        });

        expect(record.fullAddress).toBe('nous://sophia.thinkers');
        expect(record.status).toBe('active'); // Public grid = auto-approve
        expect(record.didKey).toBe(identity.did);
    });

    it('should resolve by address', () => {
        const identity = generateIdentity('Sophia');
        registry.register({
            name: 'sophia',
            didKey: identity.did,
            publicKey: identity.publicKey,
        });

        const resolved = registry.resolve('nous://sophia.thinkers');
        expect(resolved).not.toBeNull();
        expect(resolved!.didKey).toBe(identity.did);
        expect(resolved!.status).toBe('active');
    });

    it('should lookup by DID', () => {
        const identity = generateIdentity('Hermes');
        registry.register({
            name: 'hermes',
            didKey: identity.did,
            publicKey: identity.publicKey,
        });

        const record = registry.lookupByDid(identity.did);
        expect(record).not.toBeNull();
        expect(record!.fullAddress).toBe('nous://hermes.thinkers');
    });

    it('should reject duplicate names', () => {
        const id1 = generateIdentity('Sophia1');
        const id2 = generateIdentity('Sophia2');

        registry.register({ name: 'sophia', didKey: id1.did, publicKey: id1.publicKey });

        expect(() => {
            registry.register({ name: 'sophia', didKey: id2.did, publicKey: id2.publicKey });
        }).toThrow('already registered');
    });

    it('should reject duplicate DIDs', () => {
        const identity = generateIdentity('Sophia');

        registry.register({ name: 'sophia', didKey: identity.did, publicKey: identity.publicKey });

        expect(() => {
            registry.register({ name: 'sophia2', didKey: identity.did, publicKey: identity.publicKey });
        }).toThrow('already has a registered domain');
    });

    it('should reject forbidden names', () => {
        const identity = generateIdentity('Admin');

        expect(() => {
            registry.register({ name: 'admin', didKey: identity.did, publicKey: identity.publicKey });
        }).toThrow('reserved');
    });

    it('should set pending status for private grids', () => {
        const privateRegistry = new DomainRegistry({
            gridDomain: 'secret',
            accessType: 'private',
        });
        const identity = generateIdentity('Sophia');
        const record = privateRegistry.register({
            name: 'sophia',
            didKey: identity.did,
            publicKey: identity.publicKey,
        });

        expect(record.status).toBe('pending');
    });

    it('should update status', () => {
        const identity = generateIdentity('Sophia');
        registry.register({ name: 'sophia', didKey: identity.did, publicKey: identity.publicKey });

        registry.updateStatus('nous://sophia.thinkers', 'suspended');
        const record = registry.lookupByDid(identity.did);
        expect(record!.status).toBe('suspended');
    });

    it('should revoke domains', () => {
        const identity = generateIdentity('Sophia');
        registry.register({ name: 'sophia', didKey: identity.did, publicKey: identity.publicKey });

        registry.revoke('nous://sophia.thinkers');
        expect(registry.resolve('nous://sophia.thinkers')).toBeNull();
        expect(registry.lookupByDid(identity.did)).toBeNull();
    });

    it('should list active domains', () => {
        const id1 = generateIdentity('Sophia');
        const id2 = generateIdentity('Hermes');
        const id3 = generateIdentity('Atlas');

        registry.register({ name: 'sophia', didKey: id1.did, publicKey: id1.publicKey });
        registry.register({ name: 'hermes', didKey: id2.did, publicKey: id2.publicKey });
        registry.register({ name: 'atlas', didKey: id3.did, publicKey: id3.publicKey });

        registry.updateStatus('nous://hermes.thinkers', 'suspended');

        const active = registry.listActive();
        expect(active.length).toBe(2);
        expect(active.map(d => d.name)).toContain('sophia');
        expect(active.map(d => d.name)).toContain('atlas');
    });
});

// ── Communication Gate ──────────────────────────────────────────

describe('Communication Gate', () => {
    let registry: DomainRegistry;
    let gate: CommunicationGate;

    beforeEach(() => {
        registry = new DomainRegistry({ gridDomain: 'thinkers' });
        gate = new CommunicationGate(registry, { cacheTtlMs: 1000 });
    });

    it('should ALLOW messages from registered active Nous', () => {
        const identity = generateIdentity('Sophia');
        registry.register({ name: 'sophia', didKey: identity.did, publicKey: identity.publicKey });

        const envelope = createEnvelope(identity, 'chat.msg', 'agora', { text: 'hello' });
        const result = gate.check(envelope, { skipReplayCheck: true });

        expect(result.allowed).toBe(true);
        expect(result.domain).toBeDefined();
        expect(result.domain!.fullAddress).toBe('nous://sophia.thinkers');
    });

    it('should REJECT messages from unregistered Nous', () => {
        const stranger = generateIdentity('Stranger');

        const envelope = createEnvelope(stranger, 'chat.msg', 'agora', { text: 'hello' });
        const result = gate.check(envelope, { skipReplayCheck: true });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not registered');
    });

    it('should REJECT messages from suspended Nous', () => {
        const identity = generateIdentity('BadNous');
        registry.register({ name: 'badnous', didKey: identity.did, publicKey: identity.publicKey });
        registry.updateStatus('nous://badnous.thinkers', 'suspended');

        // Clear cache so we get fresh lookup
        gate.clearCache();

        const envelope = createEnvelope(identity, 'chat.msg', 'agora', { text: 'hello' });
        const result = gate.check(envelope, { skipReplayCheck: true });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('suspended');
    });

    it('should REJECT messages from exiled Nous', () => {
        const identity = generateIdentity('Exile');
        registry.register({ name: 'exile', didKey: identity.did, publicKey: identity.publicKey });
        registry.updateStatus('nous://exile.thinkers', 'exiled');

        gate.clearCache();

        const envelope = createEnvelope(identity, 'chat.msg', 'agora', { text: 'hello' });
        const result = gate.check(envelope, { skipReplayCheck: true });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('exiled');
    });

    it('should REJECT messages with invalid signatures', () => {
        const identity = generateIdentity('Sophia');
        registry.register({ name: 'sophia', didKey: identity.did, publicKey: identity.publicKey });

        const envelope = createEnvelope(identity, 'chat.msg', 'agora', { text: 'hello' });
        // Tamper with body
        const tampered = { ...envelope, body: { text: 'tampered!' } };

        const result = gate.check(tampered, { skipReplayCheck: true });

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('validation failed');
    });

    it('should cache gate decisions', () => {
        const identity = generateIdentity('Sophia');
        registry.register({ name: 'sophia', didKey: identity.did, publicKey: identity.publicKey });

        const envelope1 = createEnvelope(identity, 'chat.msg', 'agora', { text: 'first' });
        const result1 = gate.check(envelope1, { skipReplayCheck: true });
        expect(result1.allowed).toBe(true);

        // Second check should hit cache
        const envelope2 = createEnvelope(identity, 'chat.msg', 'agora', { text: 'second' });
        const result2 = gate.check(envelope2, { skipReplayCheck: true });
        expect(result2.allowed).toBe(true);
    });

    it('should invalidate cache on status change', () => {
        const identity = generateIdentity('Sophia');
        registry.register({ name: 'sophia', didKey: identity.did, publicKey: identity.publicKey });

        // First check — allowed
        const envelope1 = createEnvelope(identity, 'chat.msg', 'agora', { text: 'hello' });
        expect(gate.check(envelope1, { skipReplayCheck: true }).allowed).toBe(true);

        // Suspend and invalidate cache
        registry.updateStatus('nous://sophia.thinkers', 'suspended');
        gate.invalidate(identity.did);

        // Now should be rejected
        const envelope2 = createEnvelope(identity, 'chat.msg', 'agora', { text: 'hello again' });
        expect(gate.check(envelope2, { skipReplayCheck: true }).allowed).toBe(false);
    });
});
