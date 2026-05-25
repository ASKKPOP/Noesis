import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';
import { appendPortalAuthRegister, REGISTER_METHOD_ENUM } from '../src/audit/append-portal-auth-register.js';

describe('appendPortalAuthRegister — sole-producer discipline (OBS-09)', () => {
    let chain: AuditChain;
    beforeEach(() => {
        chain = new AuditChain();
    });

    it('happy path: appends portal.auth.register with valid SIWE payload', () => {
        const entry = appendPortalAuthRegister(chain, {
            human_did: 'did:noesis:human:0xabc123',
            method: 'siwe',
            tick: 1,
        });
        expect(entry.eventType).toBe('portal.auth.register');
        expect(entry.actorDid).toBe('did:noesis:human:0xabc123');
        expect(chain.length).toBe(1);
        expect(chain.at(0)?.eventType).toBe('portal.auth.register');
    });

    it('happy path: appends portal.auth.register with valid email payload', () => {
        const entry = appendPortalAuthRegister(chain, {
            human_did: 'did:noesis:human:email:abc',
            method: 'email',
            tick: 42,
        });
        expect(entry.eventType).toBe('portal.auth.register');
        expect(chain.length).toBe(1);
    });

    it('REGISTER_METHOD_ENUM is exactly ["email", "siwe"]', () => {
        expect(REGISTER_METHOD_ENUM).toEqual(['email', 'siwe']);
    });

    it('throws TypeError for invalid DID (regex guard)', () => {
        expect(() => appendPortalAuthRegister(chain, {
            human_did: 'not-a-did',
            method: 'siwe',
            tick: 1,
        })).toThrow(TypeError);
        expect(chain.length).toBe(0);
    });

    it('throws TypeError for invalid method (enum guard) — "passkey" rejected', () => {
        expect(() => appendPortalAuthRegister(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'passkey' as never,
            tick: 1,
        })).toThrow(TypeError);
        expect(chain.length).toBe(0);
    });

    it('throws TypeError for negative tick', () => {
        expect(() => appendPortalAuthRegister(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'siwe',
            tick: -1,
        })).toThrow(TypeError);
    });

    it('throws TypeError for non-integer tick', () => {
        expect(() => appendPortalAuthRegister(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'siwe',
            tick: 1.5,
        })).toThrow(TypeError);
    });

    it('throws TypeError for extra key (closed-tuple)', () => {
        expect(() => appendPortalAuthRegister(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'siwe',
            tick: 1,
            ip_address: '1.2.3.4',
        } as never)).toThrow(TypeError);
        expect(chain.length).toBe(0);
    });

    it('throws TypeError for missing key', () => {
        expect(() => appendPortalAuthRegister(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'siwe',
        } as never)).toThrow(TypeError);
    });

    it('throws TypeError for null payload', () => {
        expect(() => appendPortalAuthRegister(chain, null as never)).toThrow(TypeError);
    });
});
