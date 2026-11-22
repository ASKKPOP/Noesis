/** D-V3-40 — sole producer for zoning.zone_set_changed: closed tuple, hashed DID, validated fields. */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendZoningZoneSetChanged } from '../../src/audit/append-zoning-zone-set-changed.js';

const H = 'a'.repeat(64);
const ok = { action: 'added', changed_by_did_hash: H, label_hash: H, tick: 3, zone_id: 'harbor' } as const;

describe('appendZoningZoneSetChanged', () => {
    it('appends a clean 5-key payload with the legislator hash as actor', () => {
        const audit = new AuditChain();
        const e = appendZoningZoneSetChanged(audit, ok);
        expect(e.eventType).toBe('zoning.zone_set_changed');
        expect(e.actorDid).toBe(H);
        expect(Object.keys(e.payload as object).sort()).toEqual(['action', 'changed_by_did_hash', 'label_hash', 'tick', 'zone_id']);
    });
    it.each([
        ['an unknown action', { action: 'renamed' }],
        ['an unhashed DID', { changed_by_did_hash: 'did:gov:noesis:polis' }],
        ['an unhashed label', { label_hash: 'Harbor' }],
        ['a negative tick', { tick: -1 }],
        ['a malformed zone id', { zone_id: 'Bad Id' }],
        ['an extra key', { label: 'Harbor' }],
    ])('rejects %s', (_name, over) => {
        expect(() => appendZoningZoneSetChanged(new AuditChain(), { ...ok, ...over } as never)).toThrow(TypeError);
    });
});
