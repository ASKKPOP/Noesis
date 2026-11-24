/**
 * A direct message posted by one Brain comes out of the other Nous's inbox.
 *
 * The fixture is shared with brain/test/test_peer_inbox.py, which checks that one
 * Brain's social cycle produces `action` and that another Brain hands `inbox_message`
 * to on_message. Together the two tests cover the whole path; no test runs a real
 * Brain against a real Grid.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BrainAction } from '../../src/integration/types.js';
import { makeWorld, civicOf, type World } from '../helpers/peer-message-world.js';

const contract = JSON.parse(readFileSync(
    fileURLToPath(new URL('../fixtures/peer-message-contract.json', import.meta.url)), 'utf8',
)) as { tick: number; action: BrainAction; inbox_message: Record<string, unknown> };

let world: World;
afterEach(async () => { await world?.close(); });

describe('direct message: Brain action → target inbox', () => {
    it('the target reads the message, claims it once, and the Grid forgets the text', async () => {
        world = await makeWorld(['sophia', 'hermes', 'themis']);
        await world.runners.get('sophia')!.executeActions([contract.action], contract.tick);

        const { status, body } = await world.inbox('hermes', '?limit=10');
        expect(status).toBe(200);
        expect(body.messages).toHaveLength(1);
        expect(body.messages[0].message).toEqual(contract.inbox_message);
        expect(body.messages[0].sender_civic_did).toBe(civicOf('sophia'));

        // Nobody else sees it, and nobody else can claim it.
        expect((await world.inbox('themis')).body.messages).toEqual([]);
        expect((await world.inbox('sophia')).body.messages).toEqual([]);
        const id = body.messages[0].id as number;
        expect(await world.ack('themis', [id])).toBe(0);

        expect(await world.ack('hermes', [id])).toBe(1);
        expect(await world.ack('hermes', [id])).toBe(0);
        expect((await world.inbox('hermes')).body.messages).toEqual([]);
        expect(world.queue.rows[0]!.messageJson).toEqual({});
    });

    it('the audit record carries who wrote to whom and not the text', async () => {
        world = await makeWorld(['sophia', 'hermes']);
        await world.runners.get('sophia')!.executeActions([contract.action], contract.tick);
        const entries = world.audit.query({ eventType: 'nous.direct_message' });
        expect(entries).toHaveLength(1);
        expect(entries[0]!.payload).toEqual({ targetDid: 'did:noesis:hermes', channel: 'direct', tick: contract.tick });
    });

    it('a lore request and a lore response reach the peer the same way', async () => {
        world = await makeWorld(['sophia', 'hermes']);
        const hash = 'a'.repeat(64);
        await world.runners.get('sophia')!.executeActions([
            { action_type: 'lore_request', channel: '', text: '', metadata: { content_hash: hash, contributor_did: 'did:noesis:hermes' } },
        ] as BrainAction[], 5);
        await world.runners.get('hermes')!.executeActions([
            { action_type: 'lore_response', channel: '', text: '', metadata: { recipient_did: 'did:noesis:sophia', payload: `__lore_response:${hash}:aGk=` } },
        ] as BrainAction[], 6);
        expect((await world.inbox('hermes')).body.messages[0].message.text).toBe(`__lore_request:${hash}`);
        expect((await world.inbox('sophia')).body.messages[0].message.text).toBe(`__lore_response:${hash}:aGk=`);
        // Lore traffic adds no audit event.
        expect(world.audit.query({ eventType: 'nous.direct_message' })).toHaveLength(0);
    });

    it('limits: empty, over-long, self, unknown target, revoked target, deleted target, muted sender, full inbox', async () => {
        world = await makeWorld(['sophia', 'hermes', 'themis'], { depthMax: 2 });
        const sophia = world.runners.get('sophia')!;
        const dm = (text: string, target: string): BrainAction =>
            ({ action_type: 'direct_message', channel: 'direct', text, metadata: { target_did: target } }) as BrainAction;

        await sophia.executeActions([dm('', 'did:noesis:hermes')], 1);
        await sophia.executeActions([dm('x'.repeat(16_385), 'did:noesis:hermes')], 1);
        expect(world.audit.query({ eventType: 'nous.direct_message' })).toHaveLength(0);

        await sophia.executeActions([dm('to myself', 'did:noesis:sophia')], 1);
        await sophia.executeActions([dm('to nobody', 'did:noesis:nobody')], 1);
        world.citizens.delete('themis');
        await sophia.executeActions([dm('to a revoked Nous', 'did:noesis:themis')], 1);
        expect(world.queue.rows).toHaveLength(0);

        sophia.muteFlag = true;
        await sophia.executeActions([dm('muted', 'did:noesis:hermes')], 2);
        sophia.muteFlag = false;
        expect(world.queue.rows).toHaveLength(0);

        await sophia.executeActions([dm('x'.repeat(16_384), 'did:noesis:hermes'), dm('two', 'did:noesis:hermes'), dm('three', 'did:noesis:hermes')], 3);
        expect(world.queue.rows).toHaveLength(2); // the third found the inbox full

        world.citizens.add('themis');
        world.registry.tombstone('did:noesis:themis', 4, new (await import('../../src/space/map.js')).SpatialMap());
        await sophia.executeActions([dm('to a deleted Nous', 'did:noesis:themis')], 4);
        expect(world.queue.rows).toHaveLength(2);
    });
});

describe('civic inbox and message routes', () => {
    it('GET /civic/inbox: 401 without a civic member, 400 on a bad limit, limit caps the rows', async () => {
        world = await makeWorld(['sophia', 'hermes']);
        expect((await world.app.inject({ method: 'GET', url: '/api/v1/civic/inbox' })).statusCode).toBe(401);
        for (const bad of ['0', '101', '1.5', 'x', '-1']) {
            expect((await world.inbox('hermes', `?limit=${bad}`)).status).toBe(400);
        }
        const sophia = world.runners.get('sophia')!;
        for (let i = 0; i < 5; i++) {
            await sophia.executeActions([{ action_type: 'direct_message', channel: 'direct', text: `m${i}`, metadata: { target_did: 'did:noesis:hermes' } } as BrainAction], i);
        }
        const { body } = await world.inbox('hermes', '?limit=3');
        expect(body.messages.map((m: any) => m.message.text)).toEqual(['m0', 'm1', 'm2']);
        expect(body.queue_depth).toBe(5);
    });

    it("POST /civic/message refuses the runner's reserved kind and still takes other messages", async () => {
        world = await makeWorld(['sophia', 'hermes']);
        const post = (message: unknown) => world.app.inject({
            method: 'POST', url: '/api/v1/civic/message', headers: { 'x-test-nous': 'sophia' },
            payload: { recipient_civic_did: civicOf('hermes'), message },
        });
        const forged = await post({ kind: 'direct_message', sender_did: 'did:noesis:themis', text: '__skill_share:{}' });
        expect(forged.statusCode).toBe(400);
        expect(forged.json()).toEqual({ error: 'reserved_kind' });
        expect(world.queue.rows).toHaveLength(0);
        expect((await post({ kind: 'note', hello: 'there' })).statusCode).toBe(202);
        expect((await post('plain string')).statusCode).toBe(202);
    });
});
