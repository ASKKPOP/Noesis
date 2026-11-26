import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    KnowledgePool,
    type KnowledgeType,
    type KnowledgeCard,
    type HybridLogicalClock,
    compareVectorClocks,
    mergeVectorClocks,
    tickHLC,
    receiveHLC,
    compareHLC,
    signCardAuthorship,
} from '../../src/knowledge.js';
import { Storage } from '../../src/storage.js';
import { generateIdentity, type Identity } from '../../src/identity.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('KnowledgePool', () => {
    let testDir: string;
    let storage: Storage;
    let identity: Identity;
    let knowledge: KnowledgePool;

    beforeEach(async () => {
        testDir = join(tmpdir(), `society-knowledge-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
        
        storage = new Storage({ dbPath: join(testDir, 'test.db') });
        identity = generateIdentity('Test User');
        knowledge = new KnowledgePool(storage, identity);
    });

    afterEach(() => {
        try {
            storage.close();
        } catch {}
        rmSync(testDir, { recursive: true, force: true });
    });

    describe('Create Space', () => {
        it('should create knowledge space', async () => {
            const space = await knowledge.createSpace(
                'Test Space',
                'Test Description',
                'team',
                'room'
            );

            expect(space).toBeDefined();
            expect(space.id).toMatch(/^space_/);
            expect(space.name).toBe('Test Space');
            expect(space.description).toBe('Test Description');
            expect(space.owner).toBe(identity.did);
            expect(space.type).toBe('team');
            expect(space.privacy).toBe('room');
        });

        it('should create spaces of all types', async () => {
            const types: Array<'personal' | 'team' | 'federation' | 'public'> = 
                ['personal', 'team', 'federation', 'public'];
            
            for (const type of types) {
                const space = await knowledge.createSpace(
                    `${type} Space`,
                    'Test',
                    type,
                    'room'
                );
                expect(space.type).toBe(type);
            }
        });
    });

    describe('Create Cards', () => {
        let spaceId: string;

        beforeEach(async () => {
            const space = await knowledge.createSpace('Card Test', 'Test', 'team', 'room');
            spaceId = space.id;
        });

        it('should create cards of all types', async () => {
            const types: KnowledgeType[] = ['concept', 'fact', 'insight', 'decision', 'code', 'sop'];
            
            for (const type of types) {
                const card = await knowledge.createCard(
                    spaceId,
                    type,
                    `${type} Card`,
                    `Content for ${type}`
                );
                
                expect(card.type).toBe(type);
                expect(card.title).toBe(`${type} Card`);
                expect(card.id).toMatch(/^know_/);
            }
        });

        it('should auto-generate summary', async () => {
            const card = await knowledge.createCard(
                spaceId,
                'fact',
                'Long Content',
                'This is a very long content that should be summarized automatically by the system'
            );
            
            expect(card.summary).toBeDefined();
            // Summary might be same length if content is already short
            expect(card.summary.length).toBeLessThanOrEqual(card.content.length);
        });

        it('should store tags', async () => {
            const card = await knowledge.createCard(
                spaceId,
                'concept',
                'Tagged Card',
                'Content',
                { tags: ['ai', 'ml', 'important'] }
            );
            
            expect(card.tags).toContain('ai');
            expect(card.tags).toContain('ml');
        });

        it('should set confidence for insights', async () => {
            const card = await knowledge.createCard(
                spaceId,
                'insight',
                'Confident Insight',
                'This is likely true',
                { confidence: 0.95 }
            );
            
            expect(card.confidence).toBe(0.95);
        });
    });

    describe('Update Cards', () => {
        it('should update card content', async () => {
            const space = await knowledge.createSpace('Update Test', 'Test', 'team', 'room');
            const card = await knowledge.createCard(space.id, 'fact', 'Original', 'Content');
            
            const updated = await knowledge.updateCard(
                card.id,
                { title: 'Updated Title', content: 'Updated content' }
            );
            
            expect(updated.title).toBe('Updated Title');
            expect(updated.content).toBe('Updated content');
            expect(updated.version).toBeGreaterThanOrEqual(card.version);
        });
    });

    describe('Links', () => {
        it('should create links between cards', async () => {
            const space = await knowledge.createSpace('Link Test', 'Test', 'team', 'room');
            const card1 = await knowledge.createCard(space.id, 'concept', 'Parent', 'Parent concept');
            const card2 = await knowledge.createCard(space.id, 'concept', 'Child', 'Child concept');
            
            const link = await knowledge.linkCards(card1.id, card2.id, 'supports', 0.9);
            
            expect(link).toBeDefined();
            expect(link.source).toBe(card1.id);
            expect(link.target).toBe(card2.id);
            expect(link.type).toBe('supports');
            expect(link.strength).toBe(0.9);
        });
    });

    describe('Query', () => {
        it('should query cards by type', async () => {
            const space = await knowledge.createSpace('Query Test', 'Test', 'team', 'room');
            
            await knowledge.createCard(space.id, 'fact', 'Fact 1', 'Content');
            await knowledge.createCard(space.id, 'fact', 'Fact 2', 'Content');
            await knowledge.createCard(space.id, 'concept', 'Concept 1', 'Content');
            
            const facts = knowledge.queryCards({ spaceId: space.id, type: 'fact' });
            expect(facts.length).toBe(2);
            
            const concepts = knowledge.queryCards({ spaceId: space.id, type: 'concept' });
            expect(concepts.length).toBe(1);
        });

        it('should query cards by tags', async () => {
            const space = await knowledge.createSpace('Tag Test', 'Test', 'team', 'room');
            
            await knowledge.createCard(space.id, 'fact', 'AI Card', 'Content', { tags: ['ai'] });
            await knowledge.createCard(space.id, 'fact', 'ML Card', 'Content', { tags: ['ml'] });
            await knowledge.createCard(space.id, 'fact', 'Both Card', 'Content', { tags: ['ai', 'ml'] });
            
            const aiCards = knowledge.queryCards({ spaceId: space.id, tags: ['ai'] });
            expect(aiCards.length).toBe(2);
        });

        it('should search cards by query', async () => {
            const space = await knowledge.createSpace('Search Test', 'Test', 'team', 'room');
            
            await knowledge.createCard(space.id, 'fact', 'Machine Learning', 'ML content');
            await knowledge.createCard(space.id, 'fact', 'Blockchain', 'Blockchain content');
            
            const results = knowledge.queryCards({ spaceId: space.id, query: 'machine' });
            expect(results.length).toBe(1);
            expect(results[0].title).toBe('Machine Learning');
        });
    });

    describe('Performance', () => {
        it('should create 100 cards in under 2 seconds', async () => {
            const space = await knowledge.createSpace('Perf Test', 'Test', 'team', 'room');
            const start = Date.now();
            
            for (let i = 0; i < 100; i++) {
                await knowledge.createCard(space.id, 'fact', `Card ${i}`, `Content ${i}`);
            }
            
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(2000);
            console.log(`Created 100 cards in ${elapsed}ms`);
        });
    });

    describe('Persistence Round-trip', () => {
        it('should restore spaces/cards/links after restart', async () => {
            const dbPath = join(testDir, 'test.db');
            const space = await knowledge.createSpace('Persistent Space', 'Persist me', 'team', 'room');
            const cardA = await knowledge.createCard(space.id, 'concept', 'Card A', 'Alpha content');
            const cardB = await knowledge.createCard(space.id, 'fact', 'Card B', 'Beta content');
            await knowledge.linkCards(cardA.id, cardB.id, 'supports', 0.9);

            storage.close();
            storage = new Storage({ dbPath });
            knowledge = new KnowledgePool(storage, identity);

            const cards = knowledge.queryCards({ spaceId: space.id });
            expect(cards).toHaveLength(2);

            const graph = knowledge.getKnowledgeGraph(space.id);
            expect(graph.nodes).toHaveLength(2);
            expect(graph.links).toHaveLength(1);
            expect(graph.links[0].type).toBe('supports');

            const collective = knowledge.getCollectiveUnconscious(space.id);
            expect(collective).toBeDefined();
        });
    });

    // ─── CRDT Merge Tests ────────────────────────────────────────────

    describe('CRDT: Vector Clock Comparison', () => {
        it('should detect equal vector clocks', () => {
            expect(compareVectorClocks({ A: 1, B: 2 }, { A: 1, B: 2 })).toBe('equal');
        });

        it('should detect a < b (before)', () => {
            expect(compareVectorClocks({ A: 1 }, { A: 2 })).toBe('before');
            expect(compareVectorClocks({ A: 1, B: 1 }, { A: 2, B: 2 })).toBe('before');
        });

        it('should detect a > b (after)', () => {
            expect(compareVectorClocks({ A: 3 }, { A: 1 })).toBe('after');
        });

        it('should detect concurrent', () => {
            expect(compareVectorClocks({ A: 2, B: 1 }, { A: 1, B: 2 })).toBe('concurrent');
        });

        it('should handle missing nodes as 0', () => {
            expect(compareVectorClocks({ A: 1 }, { B: 1 })).toBe('concurrent');
            expect(compareVectorClocks({ A: 1 }, { A: 1, B: 1 })).toBe('before');
            expect(compareVectorClocks({ A: 1, B: 1 }, { A: 1 })).toBe('after');
        });
    });

    describe('CRDT: Vector Clock Merge', () => {
        it('should take component-wise maximum', () => {
            const merged = mergeVectorClocks({ A: 2, B: 1 }, { A: 1, B: 3, C: 1 });
            expect(merged).toEqual({ A: 2, B: 3, C: 1 });
        });
    });

    describe('CRDT: Hybrid Logical Clock', () => {
        it('tickHLC should advance logical counter when wall time unchanged', () => {
            const now = Date.now();
            const hlc: HybridLogicalClock = { wallTime: now + 100000, logical: 5, nodeId: 'A' };
            const ticked = tickHLC(hlc);
            // wallTime is far in the future, so logical should increment
            expect(ticked.wallTime).toBe(now + 100000);
            expect(ticked.logical).toBe(6);
            expect(ticked.nodeId).toBe('A');
        });

        it('tickHLC should reset logical when wall time advances', () => {
            const hlc: HybridLogicalClock = { wallTime: 1000, logical: 10, nodeId: 'A' };
            const ticked = tickHLC(hlc);
            // Current time is >> 1000, so wallTime advances and logical resets
            expect(ticked.wallTime).toBeGreaterThan(1000);
            expect(ticked.logical).toBe(0);
        });

        it('receiveHLC should merge local and remote clocks', () => {
            const local: HybridLogicalClock = { wallTime: 1000, logical: 3, nodeId: 'A' };
            const remote: HybridLogicalClock = { wallTime: 1000, logical: 5, nodeId: 'B' };
            const merged = receiveHLC(local, remote);
            // Both wall times are << now, so now wins and logical resets
            expect(merged.wallTime).toBeGreaterThan(1000);
            expect(merged.logical).toBe(0);
            expect(merged.nodeId).toBe('A');
        });

        it('receiveHLC should handle remote with future wallTime', () => {
            const futureTime = Date.now() + 100000;
            const local: HybridLogicalClock = { wallTime: 1000, logical: 0, nodeId: 'A' };
            const remote: HybridLogicalClock = { wallTime: futureTime, logical: 7, nodeId: 'B' };
            const merged = receiveHLC(local, remote);
            expect(merged.wallTime).toBe(futureTime);
            expect(merged.logical).toBe(8); // remote.logical + 1
        });

        it('compareHLC should order by wallTime then logical then nodeId', () => {
            expect(compareHLC(
                { wallTime: 100, logical: 0, nodeId: 'A' },
                { wallTime: 200, logical: 0, nodeId: 'A' }
            )).toBeLessThan(0);

            expect(compareHLC(
                { wallTime: 100, logical: 1, nodeId: 'A' },
                { wallTime: 100, logical: 2, nodeId: 'A' }
            )).toBeLessThan(0);

            expect(compareHLC(
                { wallTime: 100, logical: 0, nodeId: 'A' },
                { wallTime: 100, logical: 0, nodeId: 'B' }
            )).toBeLessThan(0);

            expect(compareHLC(
                { wallTime: 100, logical: 0, nodeId: 'A' },
                { wallTime: 100, logical: 0, nodeId: 'A' }
            )).toBe(0);
        });
    });

    describe('CRDT: Card Merge', () => {
        let spaceId: string;
        const remoteAuthor = generateIdentity('Remote Author');

        /** A card another node authored and signed. */
        function remoteCardBy(author: Identity, space: string, title: string): KnowledgeCard {
            const card: KnowledgeCard = {
                id: `know_remote_${title.replace(/\s+/g, '_')}`,
                spaceId: space,
                type: 'fact',
                title,
                summary: title,
                content: `${title} content`,
                contentFormat: 'markdown',
                author: author.did,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: 1,
                tags: [],
                domain: [],
                entities: [],
                confidence: 0.8,
                verificationStatus: 'unverified',
                verifications: [],
                usage: { views: 0, citations: 0, applications: 0, lastAccessed: Date.now() },
                privacy: 'room',
                crdt: {
                    hlc: { wallTime: Date.now(), logical: 0, nodeId: author.did },
                    vectorClock: { [author.did]: 1 },
                    tombstone: false
                }
            };
            signCardAuthorship(card, author);
            return card;
        }

        beforeEach(async () => {
            const space = await knowledge.createSpace('Merge Test', 'Test', 'team', 'room');
            spaceId = space.id;
        });

        it('should accept new remote card (no local copy)', async () => {
            const remoteIdentity = generateIdentity('Remote');
            const remoteCard: KnowledgeCard = {
                id: 'know_remote_001',
                spaceId,
                type: 'fact',
                title: 'Remote Fact',
                summary: 'Remote summary',
                content: 'Remote content',
                contentFormat: 'markdown',
                author: remoteIdentity.did,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: 1,
                tags: ['remote'],
                domain: [],
                entities: [],
                confidence: 0.8,
                verificationStatus: 'unverified',
                verifications: [],
                usage: { views: 0, citations: 0, applications: 0, lastAccessed: Date.now() },
                privacy: 'room',
                crdt: {
                    hlc: { wallTime: Date.now(), logical: 0, nodeId: remoteIdentity.did },
                    vectorClock: { [remoteIdentity.did]: 1 },
                    tombstone: false
                }
            };

            signCardAuthorship(remoteCard, remoteIdentity);

            const result = knowledge.mergeCard(remoteCard);
            expect(result).not.toBeNull();
            expect(result!.id).toBe('know_remote_001');
            expect(result!.title).toBe('Remote Fact');

            // Should be queryable
            const found = knowledge.queryCards({ query: 'Remote Fact' });
            expect(found).toHaveLength(1);
        });

        it('should discard stale remote (local is newer)', async () => {
            const card = await knowledge.createCard(spaceId, 'fact', 'Original', 'Content');
            await knowledge.updateCard(card.id, { title: 'Updated' });

            // Simulate stale remote with lower vector clock: the author's own first version
            const staleRemote: KnowledgeCard = {
                ...card,
                title: 'Stale Remote',
                version: 1,
                crdt: {
                    hlc: { wallTime: Date.now() - 5000, logical: 0, nodeId: 'stale-node' },
                    vectorClock: { [identity.did]: 1 }, // lower than local (which is 2)
                    tombstone: false
                }
            };
            signCardAuthorship(staleRemote, identity);

            const result = knowledge.mergeCard(staleRemote);
            expect(result).toBeNull(); // Discarded

            // Local should be unchanged
            const found = knowledge.queryCards({ query: 'Updated' });
            expect(found).toHaveLength(1);
        });

        it('should accept strictly newer remote', async () => {
            // A card authored on another node, then a newer version from its author.
            const base = remoteCardBy(remoteAuthor, spaceId, 'Remote Base');
            knowledge.mergeCard(base);

            const newerRemote: KnowledgeCard = {
                ...base,
                title: 'Remote Wins',
                content: 'Remote content wins',
                summary: 'Remote summary',
                version: 5,
                crdt: {
                    hlc: { wallTime: Date.now() + 1000, logical: 0, nodeId: remoteAuthor.did },
                    vectorClock: { [remoteAuthor.did]: 3 },
                    tombstone: false
                }
            };
            signCardAuthorship(newerRemote, remoteAuthor);

            const result = knowledge.mergeCard(newerRemote);
            expect(result).not.toBeNull();
            expect(result!.title).toBe('Remote Wins');
        });

        it('should reject a change to the authored fields by a node that is not the author', async () => {
            const card = await knowledge.createCard(spaceId, 'fact', 'Local', 'Content');

            const forged: KnowledgeCard = {
                ...card,
                title: 'Remote Wins',
                crdt: {
                    hlc: { wallTime: Date.now() + 1000, logical: 0, nodeId: 'remote-node' },
                    vectorClock: { [identity.did]: 1, 'remote-node': 3 },
                    tombstone: false
                }
            };

            expect(() => knowledge.mergeCard(forged)).toThrow(/author signature/);
            expect(knowledge.queryCards({ query: 'Local' })).toHaveLength(1);
            expect(knowledge.queryCards({ query: 'Remote Wins' })).toHaveLength(0);
        });

        it('should let only the author delete a card', async () => {
            const base = remoteCardBy(remoteAuthor, spaceId, 'Not Mine');
            knowledge.mergeCard(base);

            await expect(knowledge.deleteCard(base.id)).rejects.toThrow('No permission to delete');
            expect(knowledge.queryCards({ query: 'Not Mine' })).toHaveLength(1);
        });

        it('should resolve concurrent writes via HLC tie-breaking', async () => {
            const card = await knowledge.createCard(spaceId, 'fact', 'Base', 'Content');
            const firstVersion = structuredClone(card);
            await knowledge.updateCard(card.id, { title: 'Updated By Author' });

            // Concurrent remote: another node, holding the first version, wrote to the
            // fields any node may change, without seeing the author's update.
            const concurrentRemote: KnowledgeCard = {
                ...firstVersion,
                confidence: 0.95,
                crdt: {
                    hlc: { wallTime: Date.now() + 50000, logical: 0, nodeId: 'remote-node' },
                    vectorClock: { [identity.did]: 1, 'remote-node': 1 }, // independent branch
                    tombstone: false
                }
            };

            const result = knowledge.mergeCard(concurrentRemote);
            expect(result).not.toBeNull();
            // Remote has higher wallTime so it wins the LWW tie-break on the open fields
            expect(result!.confidence).toBe(0.95);
            // ...and the author's newer title stays
            expect(result!.title).toBe('Updated By Author');
        });

        it('should respect tombstone-wins semantics', async () => {
            const card = remoteCardBy(remoteAuthor, spaceId, 'Will Die');
            knowledge.mergeCard(card);

            // Simulate the remote author deleting its card
            const tombstonedRemote: KnowledgeCard = {
                ...card,
                crdt: {
                    hlc: { wallTime: Date.now() + 1000, logical: 0, nodeId: remoteAuthor.did },
                    vectorClock: { [remoteAuthor.did]: 2 },
                    tombstone: true
                }
            };
            signCardAuthorship(tombstonedRemote, remoteAuthor);

            const result = knowledge.mergeCard(tombstonedRemote);
            expect(result).not.toBeNull();
            expect(result!.crdt.tombstone).toBe(true);

            // Should not appear in queries
            const found = knowledge.queryCards({ query: 'Will Die' });
            expect(found).toHaveLength(0);
        });

        it('should merge vector clocks on merge', async () => {
            const card = await knowledge.createCard(spaceId, 'fact', 'Merge VC', 'Content');

            const remote: KnowledgeCard = {
                ...card,
                crdt: {
                    hlc: { wallTime: Date.now() + 1000, logical: 0, nodeId: 'remote' },
                    vectorClock: { [identity.did]: 1, remote: 5 },
                    tombstone: false
                }
            };

            const result = knowledge.mergeCard(remote);
            expect(result).not.toBeNull();
            // Merged VC should have max of both
            expect(result!.crdt.vectorClock[identity.did]).toBeGreaterThanOrEqual(1);
            expect(result!.crdt.vectorClock['remote']).toBe(5);
        });

        it('should merge verifications from both copies', async () => {
            const card = await knowledge.createCard(spaceId, 'fact', 'Verified', 'Content');

            const remote: KnowledgeCard = {
                ...card,
                verifications: [
                    { verifier: 'did:key:zRemote', timestamp: 12345, method: 'manual', confidence: 0.9 }
                ],
                crdt: {
                    hlc: { wallTime: Date.now() + 1000, logical: 0, nodeId: 'remote' },
                    vectorClock: { [identity.did]: 1, remote: 1 },
                    tombstone: false
                }
            };

            const result = knowledge.mergeCard(remote);
            expect(result).not.toBeNull();
            expect(result!.verifications).toHaveLength(1);
            expect(result!.verifications[0].verifier).toBe('did:key:zRemote');
        });
    });

    describe('CRDT: Serialization', () => {
        it('should round-trip serialize/deserialize cards', async () => {
            const space = await knowledge.createSpace('Serialize Test', 'Test', 'team', 'room');
            const card = await knowledge.createCard(space.id, 'fact', 'Serialize Me', 'Content');

            const serialized = knowledge.serializeCard(card);
            expect(serialized).toBeInstanceOf(Uint8Array);

            const deserialized = knowledge.deserializeCard(serialized);
            expect(deserialized.id).toBe(card.id);
            expect(deserialized.title).toBe(card.title);
            expect(deserialized.crdt.hlc.nodeId).toBe(card.crdt.hlc.nodeId);
        });
    });

    describe('CRDT: HLC Advancement on Update', () => {
        it('should advance HLC when updating a card', async () => {
            const space = await knowledge.createSpace('HLC Test', 'Test', 'team', 'room');
            const card = await knowledge.createCard(space.id, 'fact', 'HLC Card', 'Content');
            const originalHlc = { ...card.crdt.hlc };

            const updated = await knowledge.updateCard(card.id, { title: 'Updated HLC' });

            // HLC should have advanced
            const cmp = compareHLC(originalHlc, updated.crdt.hlc);
            expect(cmp).toBeLessThan(0); // original < updated
        });
    });
});
