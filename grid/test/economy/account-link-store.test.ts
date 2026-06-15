import { describe, it, expect, vi } from 'vitest';
import { Wallet, getAddress } from 'ethers';
import type { Pool } from 'mysql2/promise';
import {
    AccountLinkStore,
    AccountLinkError,
    accountLinkMessage,
} from '../../src/economy/account-link-store.js';

function makeMockPool(selectRows: unknown[] = []): { pool: Pool; calls: { sql: string; params: unknown[] }[] } {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query = vi.fn(async (sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        if (/^\s*select/i.test(sql)) return [selectRows, []];
        return [{ affectedRows: 1 }, []];
    });
    return { pool: { query } as unknown as Pool, calls };
}

describe('AccountLinkStore', () => {
    const civicDid = 'did:civic:noesis:sophia';

    it('verifies the owner signature and persists the link', async () => {
        const owner = Wallet.createRandom();
        const account = Wallet.createRandom().address;
        const signature = await owner.signMessage(accountLinkMessage(civicDid, account));

        const { pool, calls } = makeMockPool();
        const store = new AccountLinkStore(pool);
        const link = await store.verifyAndLink({ civicDid, nousAccount: account, signature, tick: 7 });

        expect(link.ownerAddress).toBe(owner.address);
        expect(link.nousAccount).toBe(getAddress(account));
        expect(link.verifiedAtTick).toBe(7);
        expect(calls[0].sql).toContain('INSERT INTO civic_account_links');
        expect(calls[0].sql).toContain('ON DUPLICATE KEY UPDATE'); // idempotent re-proof
    });

    it('rejects a malformed signature', async () => {
        const account = Wallet.createRandom().address;
        const { pool } = makeMockPool();
        const store = new AccountLinkStore(pool);
        await expect(
            store.verifyAndLink({ civicDid, nousAccount: account, signature: '0xdeadbeef', tick: 1 }),
        ).rejects.toBeInstanceOf(AccountLinkError);
    });

    it('rejects an invalid account address', async () => {
        const { pool } = makeMockPool();
        const store = new AccountLinkStore(pool);
        await expect(
            store.verifyAndLink({ civicDid, nousAccount: 'not-an-address', signature: '0x00', tick: 1 }),
        ).rejects.toBeInstanceOf(AccountLinkError);
    });

    it('resolves a link by Civic-DID', async () => {
        const account = getAddress(Wallet.createRandom().address);
        const owner = Wallet.createRandom().address;
        const { pool } = makeMockPool([
            { civic_did: civicDid, nous_account: account, owner_address: owner, verified_at_tick: 9 },
        ]);
        const store = new AccountLinkStore(pool);
        const link = await store.getByCivicDid(civicDid);
        expect(link?.nousAccount).toBe(account);
        expect(link?.ownerAddress).toBe(owner);
        expect(link?.verifiedAtTick).toBe(9);
    });

    it('returns null when no link exists', async () => {
        const { pool } = makeMockPool([]);
        const store = new AccountLinkStore(pool);
        expect(await store.getByCivicDid('did:civic:noesis:nobody')).toBeNull();
    });
});
