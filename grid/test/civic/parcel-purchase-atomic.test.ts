/**
 * BUG-B regression — parcel purchase must be atomic.
 *
 * ParcelRegistry.purchase() stamps ownership as part of reserving the parcel, then
 * the route charges the buyer. Before the fix, a failed charge (e.g. missing
 * treasury / concurrent drain) left a PHANTOM owner: the parcel read as owned while
 * no funds moved, no audit event fired, and the DB owner was never written. The
 * route must now roll the stamp back via releaseOwnership() whenever the charge
 * fails, so a failed transfer leaves the parcel available.
 */
import { describe, it, expect } from 'vitest';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { buildGenesisCoreParcels } from '../../src/civic/parcel-store.js';

const ADDR = 'genesis:residential:0001'; // a purchasable ring-3 parcel, price 400
const BUYER = 'did:civic:noesis:buyer';

function seeded(): ParcelRegistry {
    const reg = new ParcelRegistry('genesis');
    for (const p of buildGenesisCoreParcels('genesis')) reg.upsert(p);
    return reg;
}

describe('ParcelRegistry — atomic purchase (BUG-B regression)', () => {
    it('releaseOwnership rolls a failed charge back to available — no phantom owner', () => {
        const reg = seeded();
        // Route step 2: purchase() validates + reserves ownership.
        expect(reg.purchase(ADDR, BUYER, 10_000).ok).toBe(true);
        reg.stampAcquired(ADDR, 42);
        expect(reg.get(ADDR)?.ownerDid).toBe(BUYER);
        // Route step 3 fails (transferWei not_found / insufficient) → compensating unwind.
        reg.releaseOwnership(ADDR);
        expect(reg.get(ADDR)?.ownerDid).toBeNull();
        expect(reg.get(ADDR)?.acquiredAtTick).toBeNull();
        expect(reg.list({ available: true }).some((p) => p.id === ADDR)).toBe(true);
    });

    it('a rolled-back parcel can be purchased again (state fully restored)', () => {
        const reg = seeded();
        reg.purchase(ADDR, BUYER, 10_000);
        reg.releaseOwnership(ADDR);
        // A different buyer can now acquire it cleanly.
        const res = reg.purchase(ADDR, 'did:civic:noesis:other', 10_000);
        expect(res.ok).toBe(true);
        expect(reg.get(ADDR)?.ownerDid).toBe('did:civic:noesis:other');
    });

    it('releaseOwnership on an unknown / already-free parcel is a safe no-op', () => {
        const reg = seeded();
        expect(() => reg.releaseOwnership('genesis:nope:9999')).not.toThrow();
        expect(() => reg.releaseOwnership(ADDR)).not.toThrow();
        expect(reg.get(ADDR)?.ownerDid).toBeNull();
    });
});
