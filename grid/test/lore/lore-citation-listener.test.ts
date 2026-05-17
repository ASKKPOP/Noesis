/**
 * RED stub — becomes GREEN in Plan 04 when LoreCitationListener.ts ships.
 * Verifies pure-observer invariant: zero audit.append calls in listener.
 */
import { describe, it, expect, vi } from 'vitest';
import { LoreCitationListener } from '../../src/lore/LoreCitationListener.js';
import type { AuditChain } from '../../src/audit/chain.js';

describe('LoreCitationListener — pure-observer invariant', () => {
    it('does not call audit.append when lore.cited fires', () => {
        const handlers: ((e: any) => void)[] = [];
        const mockAudit = {
            onAppend: vi.fn((h) => handlers.push(h)),
            append: vi.fn(),
        } as unknown as AuditChain;
        const mockStorage = { incrementCitationCount: vi.fn().mockResolvedValue(undefined) } as any;
        new LoreCitationListener(mockAudit, mockStorage, 'test-grid');

        // Fire a lore.cited entry
        handlers.forEach((h) => h({ eventType: 'lore.cited', payload: { content_hash: 'a'.repeat(64), citing_did: 'did:noesis:x', tick: 1 } }));

        expect(mockAudit.append).not.toHaveBeenCalled();
        expect(mockStorage.incrementCitationCount).toHaveBeenCalledWith('test-grid', 'a'.repeat(64));
    });

    it('ignores non-lore.cited events', () => {
        const handlers: ((e: any) => void)[] = [];
        const mockAudit = {
            onAppend: vi.fn((h) => handlers.push(h)),
            append: vi.fn(),
        } as unknown as AuditChain;
        const mockStorage = { incrementCitationCount: vi.fn().mockResolvedValue(undefined) } as any;
        new LoreCitationListener(mockAudit, mockStorage, 'test-grid');

        handlers.forEach((h) => h({ eventType: 'skill.taught', payload: {} }));
        expect(mockStorage.incrementCitationCount).not.toHaveBeenCalled();
    });
});
