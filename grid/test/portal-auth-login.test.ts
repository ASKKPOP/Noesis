import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';
import { appendPortalAuthLogin, LOGIN_METHOD_ENUM } from '../src/audit/append-portal-auth-login.js';

describe('appendPortalAuthLogin — sole-producer discipline (OBS-08)', () => {
    let chain: AuditChain;
    beforeEach(() => {
        chain = new AuditChain();
    });

    it('happy path: appends portal.auth.login with valid SIWE payload', () => {
        const entry = appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:0xabc123',
            method: 'siwe',
            tick: 1,
        });
        expect(entry.eventType).toBe('portal.auth.login');
        expect(entry.actorDid).toBe('did:noesis:human:0xabc123');
        expect(chain.length).toBe(1);
        expect(chain.at(0)?.eventType).toBe('portal.auth.login');
    });

    it('happy path: appends portal.auth.login with valid email payload', () => {
        const entry = appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:email:abc',
            method: 'email',
            tick: 42,
        });
        expect(entry.eventType).toBe('portal.auth.login');
        expect(chain.length).toBe(1);
    });

    it('LOGIN_METHOD_ENUM is exactly ["email", "siwe"]', () => {
        expect(LOGIN_METHOD_ENUM).toEqual(['email', 'siwe']);
    });

    it('throws TypeError for invalid DID (regex guard)', () => {
        expect(() => appendPortalAuthLogin(chain, {
            human_did: 'not-a-did',
            method: 'siwe',
            tick: 1,
        })).toThrow(TypeError);
        expect(chain.length).toBe(0);
    });

    it('throws TypeError for invalid method (enum guard) — "passkey" rejected', () => {
        expect(() => appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'passkey' as never,
            tick: 1,
        })).toThrow(TypeError);
        expect(chain.length).toBe(0);
    });

    it('throws TypeError for negative tick', () => {
        expect(() => appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'siwe',
            tick: -1,
        })).toThrow(TypeError);
    });

    it('throws TypeError for non-integer tick', () => {
        expect(() => appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'siwe',
            tick: 1.5,
        })).toThrow(TypeError);
    });

    it('throws TypeError for extra key (closed-tuple)', () => {
        expect(() => appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'siwe',
            tick: 1,
            ip_address: '1.2.3.4',
        } as never)).toThrow(TypeError);
        expect(chain.length).toBe(0);
    });

    it('throws TypeError for missing key', () => {
        expect(() => appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'siwe',
        } as never)).toThrow(TypeError);
    });

    it('throws TypeError for null payload', () => {
        expect(() => appendPortalAuthLogin(chain, null as never)).toThrow(TypeError);
    });
});
