/**
 * RED stub — becomes GREEN in Plan 03 when appendLoreCited.ts ships.
 * Tests the 10-step validation ladder for lore.cited (pos 43, D-20-12).
 */
import { describe, it, expect, vi } from 'vitest';
import { appendLoreCited } from '../../src/lore/appendLoreCited.js';
import type { AuditChain } from '../../src/audit/chain.js';

const VALID_DID = 'did:noesis:test-nous-01';
const VALID_HASH = 'b'.repeat(64);
const mockAudit = { append: vi.fn().mockReturnValue({ eventType: 'lore.cited' }) } as unknown as AuditChain;

describe('appendLoreCited — 10-step validation ladder', () => {
    it('rejects invalid actorDid', () => {
        expect(() => appendLoreCited(mockAudit, 'bad-did', { citing_did: 'bad-did', content_hash: VALID_HASH, tick: 1 })).toThrow(/actorDid/);
    });
    it('rejects invalid citing_did', () => {
        expect(() => appendLoreCited(mockAudit, VALID_DID, { citing_did: 'bad-did', content_hash: VALID_HASH, tick: 1 })).toThrow(/citing_did/);
    });
    it('rejects self-report violation (citing_did !== actorDid)', () => {
        expect(() => appendLoreCited(mockAudit, VALID_DID, { citing_did: 'did:noesis:other', content_hash: VALID_HASH, tick: 1 })).toThrow(/self-report/);
    });
    it('rejects negative tick', () => {
        expect(() => appendLoreCited(mockAudit, VALID_DID, { citing_did: VALID_DID, content_hash: VALID_HASH, tick: -1 })).toThrow(/tick/);
    });
    it('rejects invalid content_hash (not 64-char hex)', () => {
        expect(() => appendLoreCited(mockAudit, VALID_DID, { citing_did: VALID_DID, content_hash: 'short', tick: 1 })).toThrow(/content_hash/);
    });
    it('rejects extra keys (closed-tuple violation)', () => {
        expect(() => appendLoreCited(mockAudit, VALID_DID, { citing_did: VALID_DID, content_hash: VALID_HASH, tick: 1, extra: 'x' } as any)).toThrow(/closed-tuple/);
    });
    it('calls audit.append with lore.cited on valid payload', () => {
        const result = appendLoreCited(mockAudit, VALID_DID, { citing_did: VALID_DID, content_hash: VALID_HASH, tick: 2 });
        expect(mockAudit.append).toHaveBeenCalledWith('lore.cited', VALID_DID, expect.objectContaining({ citing_did: VALID_DID }));
    });
});
