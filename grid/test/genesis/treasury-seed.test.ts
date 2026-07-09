/**
 * BUG-A regression — genesis must seed the system treasury account.
 *
 * NousRegistry.transferWei requires the recipient to exist. TREASURY_DID
 * (did:noesis:system:treasury) is the recipient of every treasury-collecting
 * transfer (parcel purchase, community/business/type-B fees, blueprint costs).
 * It was never spawned in production genesis — only in individual tests — so on a
 * clean grid every such transfer failed `not_found`. Genesis must now seed it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { GenesisLauncher } from '../../src/genesis/launcher.js';
import { TEST_CONFIG } from '../../src/genesis/presets.js';

const TREASURY_DID = 'did:noesis:system:treasury';

describe('GenesisLauncher — system treasury seed (BUG-A regression)', () => {
    let launcher: GenesisLauncher | undefined;
    afterEach(() => {
        launcher?.stop();
        launcher = undefined;
    });

    it('genesis seeds the treasury account with balance 0', () => {
        launcher = new GenesisLauncher({ ...TEST_CONFIG, tickRateMs: 10 });
        launcher.bootstrap();
        const t = launcher.registry.get(TREASURY_DID);
        expect(t).toBeDefined();
        expect(t?.balance_wei).toBe(0);
    });

    it('a buyer→treasury transfer resolves after genesis (no not_found)', () => {
        launcher = new GenesisLauncher({ ...TEST_CONFIG, tickRateMs: 10 });
        launcher.bootstrap();
        launcher.registry.spawn(
            { name: 'atomic-buyer', did: 'did:civic:noesis:buyer', publicKey: 'pk', region: TEST_CONFIG.regions[0].id },
            'genesis.local',
            0,
            1000,
        );
        const moved = launcher.registry.transferWei('did:civic:noesis:buyer', TREASURY_DID, 400);
        expect(moved.success).toBe(true);
    });

    it('the treasury seed is guarded — it is not placed spatially and does not collide on a pre-seeded registry', () => {
        launcher = new GenesisLauncher({ ...TEST_CONFIG, tickRateMs: 10 });
        launcher.bootstrap();
        // Exactly one treasury record; guard means a pre-existing one is never re-spawned.
        expect(launcher.registry.all().filter((r) => r.did === TREASURY_DID)).toHaveLength(1);
        // Infrastructure account — never given a spatial position.
        expect(launcher.space.allPositions().some((p) => p.did === TREASURY_DID)).toBe(false);
    });
});
