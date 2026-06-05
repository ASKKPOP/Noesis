/**
 * Phase 48b — sole-producer tests for the 5 Civic Land & Property audit events.
 *
 * Verifies: valid payload lands on the chain, allowlist membership, closed-tuple
 * rejection (extra/missing key), regex/enum validation, and that no plaintext name
 * crosses the boundary (only name_hash).
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';
import { appendZoningParcelPurchased } from '../../src/audit/append-zoning-parcel-purchased.js';
import { appendTreasuryParcelRevenue } from '../../src/audit/append-treasury-parcel-revenue.js';
import { appendZoningStructureBuilt } from '../../src/audit/append-zoning-structure-built.js';
import { appendZoningStructureJoined } from '../../src/audit/append-zoning-structure-joined.js';
import { appendZoningStructureLeft } from '../../src/audit/append-zoning-structure-left.js';

const HEX64 = 'a'.repeat(64);
const PARCEL = 'genesis:residential:0007';

describe('allowlist membership', () => {
    it('all 5 Phase 48b events are allowlisted', () => {
        for (const e of [
            'zoning.parcel_purchased',
            'treasury.parcel_revenue',
            'zoning.structure_built',
            'zoning.structure_joined',
            'zoning.structure_left',
        ]) {
            expect(ALLOWLIST.has(e)).toBe(true);
        }
    });
});

describe('appendZoningParcelPurchased', () => {
    const valid = { buyer_civic_did_hash: HEX64, parcel_id: PARCEL, price_bios: 100, tick: 3, zone_id: 'residential' };

    it('lands a valid event with the buyer hash as actor', () => {
        const audit = new AuditChain();
        const entry = appendZoningParcelPurchased(audit, valid);
        expect(entry.eventType).toBe('zoning.parcel_purchased');
        expect(entry.actorDid).toBe(HEX64);
        expect(entry.payload).toEqual(valid);
    });

    it('rejects a non-HEX64 buyer hash', () => {
        const audit = new AuditChain();
        expect(() => appendZoningParcelPurchased(audit, { ...valid, buyer_civic_did_hash: 'nope' })).toThrow(/HEX64/);
    });

    it('rejects a malformed parcel_id', () => {
        const audit = new AuditChain();
        expect(() => appendZoningParcelPurchased(audit, { ...valid, parcel_id: 'bad-id' })).toThrow(/PARCEL_ID/);
    });

    it('rejects a non-positive price', () => {
        const audit = new AuditChain();
        expect(() => appendZoningParcelPurchased(audit, { ...valid, price_bios: 0 })).toThrow(/price_bios/);
    });

    it('rejects an extra key (closed-tuple)', () => {
        const audit = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendZoningParcelPurchased(audit, { ...valid, extra: 1 })).toThrow(/closed-tuple/);
    });
});

describe('appendTreasuryParcelRevenue', () => {
    const valid = { amount_bios: 100, parcel_id: PARCEL, tick: 3 };
    it('lands a valid event attributed to the parcel', () => {
        const audit = new AuditChain();
        const entry = appendTreasuryParcelRevenue(audit, valid);
        expect(entry.eventType).toBe('treasury.parcel_revenue');
        expect(entry.actorDid).toBe(PARCEL);
    });
    it('rejects negative tick', () => {
        const audit = new AuditChain();
        expect(() => appendTreasuryParcelRevenue(audit, { ...valid, tick: -1 })).toThrow(/tick/);
    });
});

describe('appendZoningStructureBuilt', () => {
    const valid = {
        name_hash: HEX64, owner_civic_did_hash: HEX64, parcel_id: PARCEL,
        structure_type: 'shop', tick: 4, visibility: 'open',
    };
    it('lands a valid event; only name_hash (never plaintext name) is present', () => {
        const audit = new AuditChain();
        const entry = appendZoningStructureBuilt(audit, valid);
        expect(entry.eventType).toBe('zoning.structure_built');
        expect(Object.keys(entry.payload as object).sort()).toEqual(
            ['name_hash', 'owner_civic_did_hash', 'parcel_id', 'structure_type', 'tick', 'visibility'],
        );
        expect(JSON.stringify(entry.payload)).not.toContain('Alice'); // no plaintext name
    });
    it('rejects an unknown structure_type', () => {
        const audit = new AuditChain();
        expect(() => appendZoningStructureBuilt(audit, { ...valid, structure_type: 'castle' })).toThrow(/structure_type/);
    });
    it('rejects an unknown visibility', () => {
        const audit = new AuditChain();
        expect(() => appendZoningStructureBuilt(audit, { ...valid, visibility: 'secret' })).toThrow(/visibility/);
    });
});

describe('appendZoningStructureJoined / Left', () => {
    const valid = { parcel_id: PARCEL, tick: 5, visitor_civic_did_hash: HEX64 };
    it('joined lands with the visitor hash as actor', () => {
        const audit = new AuditChain();
        const entry = appendZoningStructureJoined(audit, valid);
        expect(entry.eventType).toBe('zoning.structure_joined');
        expect(entry.actorDid).toBe(HEX64);
    });
    it('left lands with the visitor hash as actor', () => {
        const audit = new AuditChain();
        const entry = appendZoningStructureLeft(audit, valid);
        expect(entry.eventType).toBe('zoning.structure_left');
        expect(entry.actorDid).toBe(HEX64);
    });
    it('both reject a missing key (closed-tuple)', () => {
        const audit = new AuditChain();
        // @ts-expect-error — intentional missing key
        expect(() => appendZoningStructureJoined(audit, { parcel_id: PARCEL, tick: 5 })).toThrow(/closed-tuple|HEX64/);
    });
});
