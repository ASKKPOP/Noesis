import { describe, it, expect, beforeEach } from 'vitest';
import { ConsentManager } from '../../src/noesis/human/consent.js';
import type { OwnershipProof } from '../../src/noesis/human/types.js';

const HUMAN = 'human-alice';
const NOUS = 'did:key:sophia';

function ownership(humanId = HUMAN, nousDid = NOUS, ttl = 3600_000): OwnershipProof {
    return {
        humanId, nousDid,
        signature: 'sig-' + humanId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + ttl,
    };
}

describe('ConsentManager', () => {
    let consent: ConsentManager;

    beforeEach(() => {
        consent = new ConsentManager();
    });

    describe('ownership', () => {
        it('registers and verifies ownership', () => {
            consent.registerOwnership(ownership());
            expect(consent.isOwner(HUMAN, NOUS)).toBe(true);
        });

        it('rejects unregistered ownership', () => {
            expect(consent.isOwner(HUMAN, NOUS)).toBe(false);
        });

        it('rejects expired ownership', () => {
            consent.registerOwnership(ownership(HUMAN, NOUS, -1000)); // already expired
            expect(consent.isOwner(HUMAN, NOUS)).toBe(false);
        });
    });

    describe('grants', () => {
        beforeEach(() => {
            consent.registerOwnership(ownership());
        });

        it('grants consent for scopes', () => {
            const grant = consent.grant(HUMAN, NOUS, ['observe', 'whisper']);
            expect(grant.scopes).toEqual(['observe', 'whisper']);
            expect(grant.revokedAt).toBeNull();
        });

        it('rejects grant from non-owner', () => {
            expect(() => consent.grant('stranger', NOUS, ['observe'])).toThrow('Only owners');
        });

        it('checks permission after grant', () => {
            consent.grant(HUMAN, NOUS, ['observe', 'whisper']);
            expect(consent.hasPermission(HUMAN, NOUS, 'observe')).toBe(true);
            expect(consent.hasPermission(HUMAN, NOUS, 'whisper')).toBe(true);
            expect(consent.hasPermission(HUMAN, NOUS, 'intervene')).toBe(false);
        });

        it('time-limited grants expire', () => {
            consent.grant(HUMAN, NOUS, ['observe'], Date.now() - 1000); // already expired
            expect(consent.hasPermission(HUMAN, NOUS, 'observe')).toBe(false);
        });

        it('permanent grants do not expire', () => {
            consent.grant(HUMAN, NOUS, ['observe'], null);
            expect(consent.hasPermission(HUMAN, NOUS, 'observe')).toBe(true);
        });
    });

    describe('revocation', () => {
        beforeEach(() => {
            consent.registerOwnership(ownership());
            consent.grant(HUMAN, NOUS, ['observe', 'whisper', 'intervene']);
        });

        it('revokeAll revokes all grants', () => {
            const count = consent.revokeAll(HUMAN, NOUS);
            expect(count).toBe(1);
            expect(consent.hasPermission(HUMAN, NOUS, 'observe')).toBe(false);
            expect(consent.hasPermission(HUMAN, NOUS, 'whisper')).toBe(false);
        });

        it('revokeScope removes single scope', () => {
            expect(consent.revokeScope(HUMAN, NOUS, 'intervene')).toBe(true);
            expect(consent.hasPermission(HUMAN, NOUS, 'intervene')).toBe(false);
            expect(consent.hasPermission(HUMAN, NOUS, 'observe')).toBe(true);
        });

        it('revokeScope returns false for missing scope', () => {
            expect(consent.revokeScope(HUMAN, NOUS, 'transfer')).toBe(false);
        });

        it('revoking all scopes auto-revokes grant', () => {
            consent.revokeScope(HUMAN, NOUS, 'observe');
            consent.revokeScope(HUMAN, NOUS, 'whisper');
            consent.revokeScope(HUMAN, NOUS, 'intervene');
            expect(consent.activeGrants(HUMAN, NOUS)).toHaveLength(0);
        });
    });

    describe('queries', () => {
        beforeEach(() => {
            consent.registerOwnership(ownership());
            consent.registerOwnership(ownership(HUMAN, 'did:key:hermes'));
        });

        it('activeGrants returns non-revoked, non-expired grants', () => {
            consent.grant(HUMAN, NOUS, ['observe']);
            consent.grant(HUMAN, NOUS, ['whisper']);
            expect(consent.activeGrants(HUMAN, NOUS)).toHaveLength(2);
        });

        it('accessibleNous returns all dids with active permissions', () => {
            consent.grant(HUMAN, NOUS, ['observe']);
            consent.grant(HUMAN, 'did:key:hermes', ['whisper']);
            const dids = consent.accessibleNous(HUMAN);
            expect(dids).toHaveLength(2);
            expect(dids).toContain(NOUS);
            expect(dids).toContain('did:key:hermes');
        });

        it('count tracks total grants', () => {
            consent.grant(HUMAN, NOUS, ['observe']);
            consent.grant(HUMAN, NOUS, ['whisper']);
            expect(consent.count).toBe(2);
        });
    });
});
