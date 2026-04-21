/**
 * Phase 8 AGENCY-05 — deletion NEVER purges prior audit chain entries.
 *
 * AGENCY-05 acceptance criterion: "Deletion never purges audit chain entries."
 *
 * Verifies that after tombstoning a Nous and emitting operator.nous_deleted,
 * all prior entries for that DID remain in the audit chain with their original
 * IDs, hashes, and payloads intact. Chain integrity (verify()) must still pass.
 */

import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { SpatialMap } from '../../src/space/map.js';
import { appendNousDeleted } from '../../src/audit/append-nous-deleted.js';
import { combineStateHash } from '../../src/audit/state-hash.js';

const OPERATOR = 'op:11111111-1111-4111-8111-111111111111';
const ALPHA    = 'did:noesis:alpha';
const AGORA    = 'agora';

const BRAIN_HASHES = {
    psyche_hash:        'a'.repeat(64),
    thymos_hash:        'b'.repeat(64),
    telos_hash:         'c'.repeat(64),
    memory_stream_hash: 'd'.repeat(64),
};
const STATE_HASH = combineStateHash(BRAIN_HASHES);

describe('AGENCY-05 audit-no-purge: deletion preserves all prior entries', () => {
    it('all prior entries survive tombstone + appendNousDeleted', () => {
        const chain    = new AuditChain();
        const registry = new NousRegistry();
        const space    = new SpatialMap();

        registry.spawn(
            { did: ALPHA, name: 'Alpha', publicKey: 'pk', region: AGORA },
            'test.grid', 0, 100,
        );

        // Emit several events on behalf of the Nous
        chain.append('nous.spawned', ALPHA, { name: 'Alpha', region: AGORA, tick: 0 });
        chain.append('nous.spoke',   ALPHA, { name: 'Alpha', channel: AGORA, text: 'hello', tick: 5 });
        chain.append('nous.moved',   ALPHA, { name: 'Alpha', fromRegion: AGORA, toRegion: 'market', tick: 10 });
        chain.append('nous.spoke',   ALPHA, { name: 'Alpha', channel: 'market', text: 'buying', tick: 15 });

        const priorCount = chain.length;
        const priorHeads = chain.all().map(e => e.eventHash);

        // Tombstone the Nous
        registry.tombstone(ALPHA, 20, space);

        // Emit the deletion event
        appendNousDeleted(chain, OPERATOR, {
            tier: 'H5',
            action: 'delete',
            operator_id: OPERATOR,
            target_did: ALPHA,
            pre_deletion_state_hash: STATE_HASH,
        });

        // Chain grew by exactly 1 (the deletion event)
        expect(chain.length).toBe(priorCount + 1);

        // All prior entries still present with identical hashes
        const allEntries = chain.all();
        for (let i = 0; i < priorCount; i++) {
            expect(allEntries[i].eventHash).toBe(priorHeads[i]);
        }

        // The last entry is the deletion event
        const last = allEntries[allEntries.length - 1];
        expect(last.eventType).toBe('operator.nous_deleted');
        expect((last.payload as { target_did: string }).target_did).toBe(ALPHA);

        // Chain integrity passes (no tampering)
        expect(chain.verify().valid).toBe(true);

        // Registry record is tombstoned
        expect(registry.get(ALPHA)?.status).toBe('deleted');
    });

    it('prior entries for OTHER DIDs are also unaffected', () => {
        const chain    = new AuditChain();
        const registry = new NousRegistry();
        const space    = new SpatialMap();

        const BETA = 'did:noesis:beta';

        registry.spawn({ did: ALPHA, name: 'Alpha', publicKey: 'pk', region: AGORA }, 'test.grid', 0, 100);
        registry.spawn({ did: BETA,  name: 'Beta',  publicKey: 'pk', region: AGORA }, 'test.grid', 0, 100);

        chain.append('nous.spawned', ALPHA, { name: 'Alpha', region: AGORA, tick: 0 });
        chain.append('nous.spawned', BETA,  { name: 'Beta',  region: AGORA, tick: 0 });
        chain.append('nous.spoke',   ALPHA, { name: 'Alpha', channel: AGORA, text: 'hi', tick: 5 });
        chain.append('nous.spoke',   BETA,  { name: 'Beta',  channel: AGORA, text: 'yo', tick: 5 });

        const betaEntriesBefore = chain.query({ actorDid: BETA }).length;
        const totalBefore = chain.length;

        registry.tombstone(ALPHA, 10, space);
        appendNousDeleted(chain, OPERATOR, {
            tier: 'H5',
            action: 'delete',
            operator_id: OPERATOR,
            target_did: ALPHA,
            pre_deletion_state_hash: STATE_HASH,
        });

        // Beta entries unchanged
        expect(chain.query({ actorDid: BETA })).toHaveLength(betaEntriesBefore);
        // Total grew by 1
        expect(chain.length).toBe(totalBefore + 1);
        // Chain integrity intact
        expect(chain.verify().valid).toBe(true);
    });
});
