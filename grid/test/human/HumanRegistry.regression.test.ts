import { describe, it, expect } from 'vitest';
import { HumanRegistry } from '../../src/human/HumanRegistry.js';

/**
 * Regression: ISSUE-006 (QA 2026-07-08) — Portal humans must survive a grid
 * restart. HumanRegistry is the in-process source of truth but was populated
 * only by createHuman(); on boot it was empty, so sign-in failed after a restart
 * and onboarding (whose `onboarded` flag is derived from the persisted
 * human_users row on GET /me) could never complete for anyone. main.ts now
 * rehydrates the registry from human_users at boot via hydrateFromRows(); auth.ts
 * persists new humans via persistHuman(). This proves the rehydration round-trip.
 */
describe('HumanRegistry.hydrateFromRows (regression: ISSUE-006 restart durability)', () => {
    function rows() {
        return [
            {
                grid_name: 'genesis',
                did: 'did:noesis:human:email:2ad19d0f-da02-4ac8-bd14-27d6203e64ac',
                eth_address: null,
                email: 'QA@Noesis.Test', // mixed-case → must be lowercased on hydrate
                password_hash: 'salt:deadbeef',
                region: 'agora',
                created_at: '2026-07-08T06:57:06.316Z',
            },
            {
                grid_name: 'genesis',
                did: 'did:noesis:human:0xabc0000000000000000000000000000000000001',
                eth_address: '0xABC0000000000000000000000000000000000001', // mixed-case
                email: null,
                password_hash: null,
                region: 'market',
                created_at: new Date('2026-07-01T00:00:00.000Z'),
            },
        ];
    }

    it('restores an email human — find by email/did, password hash, lowercased email', () => {
        const reg = new HumanRegistry();
        reg.hydrateFromRows(rows());
        const byEmail = reg.findByEmail('genesis', 'qa@noesis.test');
        expect(byEmail?.did).toBe('did:noesis:human:email:2ad19d0f-da02-4ac8-bd14-27d6203e64ac');
        expect(byEmail?.email).toBe('qa@noesis.test'); // lowercased on hydrate
        expect(reg.findByDid('genesis', byEmail!.did)?.email).toBe('qa@noesis.test');
        expect(reg.getPasswordHash('genesis', 'qa@noesis.test')).toBe('salt:deadbeef');
        expect(byEmail?.created_at).toBeInstanceOf(Date);
    });

    it('restores a SIWE human by lowercased address', () => {
        const reg = new HumanRegistry();
        reg.hydrateFromRows(rows());
        const byAddr = reg.findByAddress('genesis', '0xABC0000000000000000000000000000000000001');
        expect(byAddr?.eth_address).toBe('0xabc0000000000000000000000000000000000001');
        expect(byAddr?.region).toBe('market');
    });

    it('after rehydration, re-creating the same email throws (dedup — no double INSERT)', () => {
        const reg = new HumanRegistry();
        reg.hydrateFromRows(rows());
        expect(() => reg.createHuman({ email: 'qa@noesis.test', password_hash: 'x', grid_name: 'genesis' }))
            .toThrow(/already registered/);
    });
});
