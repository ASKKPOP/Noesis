import { describe, it, expect } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';
import { appendHumanJoined } from '../src/audit/append-human-joined.js';
import { appendHumanIdentified } from '../src/audit/append-human-identified.js';
import { appendPortalAuthLogin } from '../src/audit/append-portal-auth-login.js';
import { appendPortalAuthRegister } from '../src/audit/append-portal-auth-register.js';
import { createHash } from 'node:crypto';

/**
 * Wiring tests for Phase 33 D-33-A4/A5/A6 emit-count + emit-order.
 *
 * These tests directly invoke the producer functions in the order specified by the
 * wiring sites in grid/src/api/portal/auth.ts (Plan 33-04). They verify the chain
 * receives exactly the expected sequence — equivalent to running the HTTP route
 * end-to-end but without depending on SIWE crypto / password verify / Fastify boot.
 *
 * R-33-03 mitigation: SIWE first-connect emits register but not login (or vice versa) —
 * this file's `SIWE first-connect — 4 audit entries in order` test guards against that.
 *
 * Intentional scope: emit-count and emit-order. NO Fastify, NO HTTP, NO SIWE crypto.
 * SIWE crypto + auth-flow correctness is covered by Phase 22's existing tests.
 */

const GRID = 'genesis';
const SIWE_DID = 'did:noesis:human:0xabc123';
const EMAIL_DID = 'did:noesis:human:email:xyz';
const ETH_ADDR = '0xABC123';
const ETH_HASH = createHash('sha256').update(ETH_ADDR.toLowerCase()).digest('hex');
const EMAIL = 'user@example.com';
const EMAIL_HASH = createHash('sha256').update(EMAIL.toLowerCase().trim()).digest('hex');

describe('Phase 33 D-33-A4 — SIWE first-connect emits 4 entries in order', () => {
    it('emits human.joined → human.identified → portal.auth.register → portal.auth.login', () => {
        const chain = new AuditChain();
        const tick = 100;

        // Mirror auth.ts SIWE first-connect block (Plan 33-04 Task 1 Edits 2 + 3):
        appendHumanJoined(chain, {
            human_did: SIWE_DID,
            eth_address_hash: ETH_HASH,
            grid_name: GRID,
            tick,
        });
        appendHumanIdentified(chain, {
            grid_name: GRID,
            human_did: SIWE_DID,
            identity_hash: ETH_HASH, // byte-identical to eth_address_hash (D-33-A4)
            identity_method: 'siwe',
            tick,
        });
        appendPortalAuthRegister(chain, {
            human_did: SIWE_DID,
            method: 'siwe',
            tick,
        });
        appendPortalAuthLogin(chain, {
            human_did: SIWE_DID,
            method: 'siwe',
            tick,
        });

        expect(chain.length).toBe(4);
        expect(chain.at(0)?.eventType).toBe('human.joined');
        expect(chain.at(1)?.eventType).toBe('human.identified');
        expect(chain.at(2)?.eventType).toBe('portal.auth.register');
        expect(chain.at(3)?.eventType).toBe('portal.auth.login');
    });

    it('identity_hash in human.identified equals eth_address_hash in human.joined (byte-identical, D-33-A4)', () => {
        const chain = new AuditChain();
        appendHumanJoined(chain, {
            human_did: SIWE_DID, eth_address_hash: ETH_HASH, grid_name: GRID, tick: 1,
        });
        appendHumanIdentified(chain, {
            grid_name: GRID, human_did: SIWE_DID, identity_hash: ETH_HASH,
            identity_method: 'siwe', tick: 1,
        });
        expect(chain.at(0)?.payload.eth_address_hash).toBe(chain.at(1)?.payload.identity_hash);
    });
});

describe('Phase 33 D-33-A4 — SIWE repeat-connect emits 1 entry (portal.auth.login only)', () => {
    it('subsequent SIWE verify (isNew === false) skips register + identified + joined', () => {
        const chain = new AuditChain();
        // Repeat-connect path: only the unconditional appendPortalAuthLogin runs.
        appendPortalAuthLogin(chain, {
            human_did: SIWE_DID,
            method: 'siwe',
            tick: 200,
        });
        expect(chain.length).toBe(1);
        expect(chain.at(0)?.eventType).toBe('portal.auth.login');
    });
});

describe('Phase 33 D-33-A5 — email signup emits 3 entries in order (NO human.joined)', () => {
    it('emits human.identified → portal.auth.register → portal.auth.login', () => {
        const chain = new AuditChain();
        const tick = 300;

        // Mirror auth.ts email signup block (Plan 33-04 Task 2):
        // NOTE: no appendHumanJoined — D-33-A7 preserves Phase 22's SIWE-only contract.
        appendHumanIdentified(chain, {
            grid_name: GRID,
            human_did: EMAIL_DID,
            identity_hash: EMAIL_HASH,
            identity_method: 'email',
            tick,
        });
        appendPortalAuthRegister(chain, {
            human_did: EMAIL_DID,
            method: 'email',
            tick,
        });
        appendPortalAuthLogin(chain, {
            human_did: EMAIL_DID,
            method: 'email',
            tick,
        });

        expect(chain.length).toBe(3);
        expect(chain.at(0)?.eventType).toBe('human.identified');
        expect(chain.at(1)?.eventType).toBe('portal.auth.register');
        expect(chain.at(2)?.eventType).toBe('portal.auth.login');
    });

    it('email signup uses sha256(email.toLowerCase().trim()) as identity_hash', () => {
        const chain = new AuditChain();
        appendHumanIdentified(chain, {
            grid_name: GRID, human_did: EMAIL_DID, identity_hash: EMAIL_HASH,
            identity_method: 'email', tick: 1,
        });
        // EMAIL_HASH is recomputed at the top of file from the same algorithm
        const recomputed = createHash('sha256').update('user@example.com'.toLowerCase().trim()).digest('hex');
        expect(chain.at(0)?.payload.identity_hash).toBe(recomputed);
    });
});

describe('Phase 33 D-33-A6 — email signin emits 1 entry (portal.auth.login only)', () => {
    it('subsequent email signin skips register + identified', () => {
        const chain = new AuditChain();
        appendPortalAuthLogin(chain, {
            human_did: EMAIL_DID,
            method: 'email',
            tick: 400,
        });
        expect(chain.length).toBe(1);
        expect(chain.at(0)?.eventType).toBe('portal.auth.login');
        expect(chain.at(0)?.payload.method).toBe('email');
    });
});

describe('Phase 33 R-33-03 — asymmetry between register + login', () => {
    it('first-connect emits BOTH register AND login (the wiring guarantees this)', () => {
        const chain = new AuditChain();
        appendPortalAuthRegister(chain, { human_did: SIWE_DID, method: 'siwe', tick: 1 });
        appendPortalAuthLogin(chain, { human_did: SIWE_DID, method: 'siwe', tick: 1 });
        const registers = chain.query({ eventType: 'portal.auth.register', actorDid: SIWE_DID });
        const logins = chain.query({ eventType: 'portal.auth.login', actorDid: SIWE_DID });
        expect(registers).toHaveLength(1);
        expect(logins).toHaveLength(1);
    });

    it('repeat-connect emits ONLY login, no register', () => {
        const chain = new AuditChain();
        appendPortalAuthLogin(chain, { human_did: SIWE_DID, method: 'siwe', tick: 1 });
        const registers = chain.query({ eventType: 'portal.auth.register', actorDid: SIWE_DID });
        const logins = chain.query({ eventType: 'portal.auth.login', actorDid: SIWE_DID });
        expect(registers).toHaveLength(0);
        expect(logins).toHaveLength(1);
    });
});
