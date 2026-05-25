import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';
import { appendHumanIdentified, IDENTITY_METHOD_ENUM } from '../src/audit/append-human-identified.js';

const VALID_HASH = 'a'.repeat(64); // 64 hex chars
const VALID_DID = 'did:noesis:human:0xabc123';

describe('appendHumanIdentified — sole-producer discipline (OBS-08b)', () => {
    let chain: AuditChain;
    beforeEach(() => {
        chain = new AuditChain();
    });

    it('happy path: appends human.identified with valid SIWE payload', () => {
        const entry = appendHumanIdentified(chain, {
            grid_name: 'genesis',
            human_did: VALID_DID,
            identity_hash: VALID_HASH,
            identity_method: 'siwe',
            tick: 1,
        });
        expect(entry.eventType).toBe('human.identified');
        expect(entry.actorDid).toBe(VALID_DID);
        expect(chain.length).toBe(1);
        expect(chain.at(0)?.eventType).toBe('human.identified');
    });

    it('happy path: appends human.identified with valid email payload', () => {
        const entry = appendHumanIdentified(chain, {
            grid_name: 'genesis',
            human_did: 'did:noesis:human:email:xyz',
            identity_hash: 'b'.repeat(64),
            identity_method: 'email',
            tick: 42,
        });
        expect(entry.eventType).toBe('human.identified');
        expect(chain.length).toBe(1);
    });

    it('IDENTITY_METHOD_ENUM is exactly ["email", "siwe"]', () => {
        expect(IDENTITY_METHOD_ENUM).toEqual(['email', 'siwe']);
    });

    it('throws TypeError for invalid DID', () => {
        expect(() => appendHumanIdentified(chain, {
            grid_name: 'genesis',
            human_did: 'invalid',
            identity_hash: VALID_HASH,
            identity_method: 'siwe',
            tick: 1,
        })).toThrow(TypeError);
    });

    it('throws TypeError for non-HEX64 identity_hash (too short)', () => {
        expect(() => appendHumanIdentified(chain, {
            grid_name: 'genesis',
            human_did: VALID_DID,
            identity_hash: 'a'.repeat(63),
            identity_method: 'siwe',
            tick: 1,
        })).toThrow(TypeError);
    });

    it('throws TypeError for non-HEX64 identity_hash (non-hex char)', () => {
        expect(() => appendHumanIdentified(chain, {
            grid_name: 'genesis',
            human_did: VALID_DID,
            identity_hash: 'g'.repeat(64),
            identity_method: 'siwe',
            tick: 1,
        })).toThrow(TypeError);
    });

    it('throws TypeError for invalid identity_method ("passkey" rejected)', () => {
        expect(() => appendHumanIdentified(chain, {
            grid_name: 'genesis',
            human_did: VALID_DID,
            identity_hash: VALID_HASH,
            identity_method: 'passkey' as never,
            tick: 1,
        })).toThrow(TypeError);
    });

    it('throws TypeError for empty grid_name', () => {
        expect(() => appendHumanIdentified(chain, {
            grid_name: '',
            human_did: VALID_DID,
            identity_hash: VALID_HASH,
            identity_method: 'siwe',
            tick: 1,
        })).toThrow(TypeError);
    });

    it('throws TypeError for negative tick', () => {
        expect(() => appendHumanIdentified(chain, {
            grid_name: 'genesis',
            human_did: VALID_DID,
            identity_hash: VALID_HASH,
            identity_method: 'siwe',
            tick: -1,
        })).toThrow(TypeError);
    });

    it('throws TypeError for extra key (closed-tuple)', () => {
        expect(() => appendHumanIdentified(chain, {
            grid_name: 'genesis',
            human_did: VALID_DID,
            identity_hash: VALID_HASH,
            identity_method: 'siwe',
            tick: 1,
            email: 'plaintext@example.com',
        } as never)).toThrow(TypeError);
    });

    it('throws TypeError for missing key (identity_hash absent)', () => {
        expect(() => appendHumanIdentified(chain, {
            grid_name: 'genesis',
            human_did: VALID_DID,
            identity_method: 'siwe',
            tick: 1,
        } as never)).toThrow(TypeError);
    });

    it('throws TypeError for null payload', () => {
        expect(() => appendHumanIdentified(chain, null as never)).toThrow(TypeError);
    });
});
