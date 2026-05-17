/**
 * RED stub — becomes GREEN in Plan 03 when appendLoreContributed.ts ships.
 * Tests the 10-step validation ladder for lore.contributed (pos 42, D-20-12).
 */
import { describe, it, expect, vi } from 'vitest';
import { appendLoreContributed } from '../../src/lore/appendLoreContributed.js';
import type { AuditChain } from '../../src/audit/chain.js';

const VALID_DID = 'did:noesis:test-nous-01';
const VALID_HASH = 'a'.repeat(64);
const mockAudit = { append: vi.fn().mockReturnValue({ eventType: 'lore.contributed' }) } as unknown as AuditChain;

describe('appendLoreContributed — 10-step validation ladder', () => {
    it('rejects invalid actorDid', () => {
        expect(() => appendLoreContributed(mockAudit, 'bad-did', { category_tag: 'observation', content_hash: VALID_HASH, contributor_did: 'bad-did', tick: 1 })).toThrow(/actorDid/);
    });
    it('rejects invalid contributor_did', () => {
        expect(() => appendLoreContributed(mockAudit, VALID_DID, { category_tag: 'observation', content_hash: VALID_HASH, contributor_did: 'bad-did', tick: 1 })).toThrow(/contributor_did/);
    });
    it('rejects self-report violation (contributor_did !== actorDid)', () => {
        expect(() => appendLoreContributed(mockAudit, VALID_DID, { category_tag: 'observation', content_hash: VALID_HASH, contributor_did: 'did:noesis:other', tick: 1 })).toThrow(/self-report/);
    });
    it('rejects negative tick', () => {
        expect(() => appendLoreContributed(mockAudit, VALID_DID, { category_tag: 'observation', content_hash: VALID_HASH, contributor_did: VALID_DID, tick: -1 })).toThrow(/tick/);
    });
    it('rejects invalid content_hash (not 64-char hex)', () => {
        expect(() => appendLoreContributed(mockAudit, VALID_DID, { category_tag: 'observation', content_hash: 'tooshort', contributor_did: VALID_DID, tick: 1 })).toThrow(/content_hash/);
    });
    it('rejects unknown category_tag', () => {
        expect(() => appendLoreContributed(mockAudit, VALID_DID, { category_tag: 'unknown_cat', content_hash: VALID_HASH, contributor_did: VALID_DID, tick: 1 })).toThrow(/category_tag/);
    });
    it('rejects extra keys (closed-tuple violation)', () => {
        expect(() => appendLoreContributed(mockAudit, VALID_DID, { category_tag: 'observation', content_hash: VALID_HASH, contributor_did: VALID_DID, tick: 1, extra: 'bad' } as any)).toThrow(/closed-tuple/);
    });
    it('calls audit.append with lore.contributed on valid payload', () => {
        const result = appendLoreContributed(mockAudit, VALID_DID, { category_tag: 'observation', content_hash: VALID_HASH, contributor_did: VALID_DID, tick: 1 });
        expect(mockAudit.append).toHaveBeenCalledWith('lore.contributed', VALID_DID, expect.objectContaining({ category_tag: 'observation' }));
    });
});
