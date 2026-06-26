/**
 * Phase 55 — the two DORMANT cross-Grid producers are valid (they exist for v3.1). They are
 * never wired to a reachable route in v3.0 (check-cross-grid-dormant.mjs enforces that); here
 * we only verify the append functions validate + emit correctly when called directly.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { AuditChain } from '../../src/audit/chain.js';
import { appendPortalCrossGridActionMediated } from '../../src/audit/append-portal-cross-grid-action-mediated.js';
import { appendPortalCrossGridIdentityLinked } from '../../src/audit/append-portal-cross-grid-identity-linked.js';

const h = (s: string) => createHash('sha256').update(s).digest('hex');

describe('dormant cross-Grid producers (v3.1 contract surface)', () => {
    it('portal.cross_grid_action_mediated validates + emits', () => {
        const audit = new AuditChain();
        appendPortalCrossGridActionMediated(audit, { account_did_hash: h('acct'), action_id: 'a1', source_grid: 'genesis', target_grid: 'commerce', tick: 5 });
        expect(audit.query({ eventType: 'portal.cross_grid_action_mediated' })).toHaveLength(1);
    });
    it('portal.cross_grid_identity_linked validates + emits', () => {
        const audit = new AuditChain();
        appendPortalCrossGridIdentityLinked(audit, { account_did_hash: h('acct'), civic_did_hash: h('civic'), grid_name: 'genesis', tick: 5 });
        expect(audit.query({ eventType: 'portal.cross_grid_identity_linked' })).toHaveLength(1);
    });
    it('rejects a malformed payload (closed-tuple guard)', () => {
        expect(() => appendPortalCrossGridIdentityLinked(new AuditChain(), { account_did_hash: 'not-hex', civic_did_hash: h('c'), grid_name: 'g', tick: 1 })).toThrow();
    });
});
