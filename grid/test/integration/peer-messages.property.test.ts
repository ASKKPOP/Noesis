/**
 * Peer-message properties — the code leg of the Triple Verification Rule for P-DM-01..08.
 *
 * Model legs: verification/tla/PeerMessages.tla, verification/lean/Verification/PeerMessages.lean.
 * Registry:   verification/PROPERTIES.md.
 *
 * Inputs are generated. Set PBT_SEED to replay a run, PBT_RUNS to change the case count.
 *
 * What runs for real: NousRunner, AuditChain, NousRegistry, PeerMessageRouter,
 * PresenceService and the civic inbox routes. The database is replaced by
 * InMemoryMessageQueue. The Brain side here is the claim loop written out in this file
 * (poll, ack one id, hand over only when the ack reports one row); the Python loop
 * itself is tested in brain/test/test_peer_inbox_properties.py.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import {
    PeerMessageRouter, checkPeerText, isLoreHash, isLoreResponsePayload, registeredCivicDidOf,
    PEER_MESSAGE_MAX_CHARS, PEER_MESSAGE_KIND,
} from '../../src/integration/peer-messages.js';
import type { BrainAction } from '../../src/integration/types.js';
import { makeWorld, civicOf, didOf, displayName, GRID, OUTSIDER } from '../helpers/peer-message-world.js';

const seed = process.env.PBT_SEED ? Number(process.env.PBT_SEED) : Date.now() | 0;
const numRuns = process.env.PBT_RUNS ? Number(process.env.PBT_RUNS) : 1000;
console.log(`[peer-messages.property] seed=${seed} numRuns=${numRuns}`);
const params = { seed, numRuns };

// The runner logs every message it does not deliver; thousands of generated cases would flood the output.
beforeAll(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterAll(() => { vi.restoreAllMocks(); });

const NAMES = ['a', 'b', 'c'] as const;
const DEPTH_MAX = 3;

// Lore wire forms, valid and nearly valid.
const HEX = '0123456789abcdef';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const arbHash = fc.string({ unit: fc.constantFrom(...HEX), minLength: 64, maxLength: 64 });
const arbLoreResponse = fc.tuple(arbHash, fc.uint8Array({ minLength: 1, maxLength: 30 }))
    .map(([h, bytes]) => `__lore_response:${h}:${Buffer.from(bytes).toString('base64')}`);
const arbLoreNearMiss: fc.Arbitrary<string> = fc.oneof(
    arbHash.map((h) => h.toUpperCase()),
    arbHash.map((h) => h.slice(1)),
    arbHash.map((h) => `${h}0`),
    arbHash.map((h) => `${h}\n`),
    arbHash.map((h) => `__lore_response:${h}:`),
    arbHash.map((h) => `__lore_response:${h}:aGk`),
    arbHash.map((h) => `__lore_response:${h}:aGk=:x`),
    arbHash.map((h) => `__lore_response:${h}:a b=`),
    arbHash.map((h) => `__lore_response:${h.slice(2)}:aGk=`),
    arbHash.map((h) => `__lore_request:${h}`),
    // A well-formed response that is over the text limit.
    arbHash.map((h) => `__lore_response:${h}:${'QUJD'.repeat(PEER_MESSAGE_MAX_CHARS / 4)}`),
    fc.constantFrom('__skill_share:{"name":"x"}', 'a private word'),
);
// Written out apart from the code under test.
const hashOk = (t: unknown): t is string => typeof t === 'string' && t.length === 64 && [...t].every((c) => HEX.includes(c));
const loreResponseOk = (t: unknown): t is string => {
    if (typeof t !== 'string') return false;
    const parts = t.split(':');
    if (parts.length !== 3 || parts[0] !== '__lore_response' || !hashOk(parts[1])) return false;
    const pad = parts[2]!.endsWith('==') ? 2 : parts[2]!.endsWith('=') ? 1 : 0;
    const data = parts[2]!.slice(0, parts[2]!.length - pad);
    return data.length > 0 && [...data].every((c) => B64.includes(c)) && (data.length + pad) % 4 === 0;
};

// Texts: empty, one character, the limit, one over it, unicode (also astral, two code
// units each), the Brain's own payload prefixes, and free text.
const arbText: fc.Arbitrary<string> = fc.oneof(
    { weight: 6, arbitrary: fc.string({ minLength: 1, maxLength: 40 }) },
    { weight: 2, arbitrary: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 20 }) },
    { weight: 2, arbitrary: fc.constantFrom('__skill_share:{"name":"x"}', '__lore_response:ab:aGk=', '__lore_request:ab', '안녕 🌍') },
    { weight: 3, arbitrary: fc.oneof(arbHash, arbLoreResponse, arbLoreNearMiss) },
    { weight: 1, arbitrary: fc.constantFrom('', 'x', 'x'.repeat(PEER_MESSAGE_MAX_CHARS), 'x'.repeat(PEER_MESSAGE_MAX_CHARS + 1), '🌍'.repeat(PEER_MESSAGE_MAX_CHARS / 2), '🌍'.repeat(PEER_MESSAGE_MAX_CHARS / 2 + 1)) },
);
// What a broken or hostile Brain might put where the text belongs.
const arbHostileText: fc.Arbitrary<unknown> = fc.oneof(
    fc.constant(undefined), fc.constant(null), fc.integer(), fc.boolean(),
    fc.array(fc.string(), { maxLength: 2 }), fc.object({ maxDepth: 1 }),
);
const textOk = (t: unknown): t is string => typeof t === 'string' && t.length >= 1 && t.length <= PEER_MESSAGE_MAX_CHARS;

describe('peer message text check', () => {
    it('P-DM-04: a text is accepted only if it is a string of 1 to 16,384 code units', () => {
        fc.assert(
            fc.property(fc.oneof(arbText, arbHostileText), (text) => {
                const verdict = checkPeerText(text);
                expect(verdict === 'ok').toBe(textOk(text));
                if (typeof text === 'string' && text.length > PEER_MESSAGE_MAX_CHARS) expect(verdict).toBe('too_long');
            }),
            params,
        );
    });
});

describe('lore wire forms', () => {
    it('P-DM-08: a lore hash is 64 lowercase hex characters; a lore response is __lore_response:<hash>:<base64>', () => {
        fc.assert(
            fc.property(fc.oneof(arbText, arbHash, arbLoreResponse, arbLoreNearMiss, arbHostileText), (value) => {
                expect(isLoreHash(value)).toBe(hashOk(value));
                expect(isLoreResponsePayload(value)).toBe(loreResponseOk(value));
            }),
            params,
        );
    });
});

describe('registeredCivicDidOf', () => {
    it('P-DM-04: only a Nous the registry knows, and has not deleted, has a Civic-DID to write to', async () => {
        const arbStatus = fc.constantFrom('active', 'suspended', 'exiled', 'deleted', undefined);
        await fc.assert(
            fc.asyncProperty(fc.string({ maxLength: 12 }), arbStatus, fc.option(fc.string({ minLength: 1, maxLength: 12 }), { nil: null }), async (did, status, civic) => {
                let asked = 0;
                const lookup = registeredCivicDidOf(
                    { get: (d) => (d === did && status !== undefined ? { status } : undefined) },
                    async () => { asked++; return civic; },
                );
                const known = status !== undefined && status !== 'deleted';
                expect(await lookup(did)).toBe(known ? civic : null);
                expect(asked).toBe(known ? 1 : 0);
            }),
            params,
        );
    });
});

describe('PeerMessageRouter.deliver', () => {
    const arbDid = fc.constantFrom(didOf('a'), didOf('b'), didOf('c'), 'did:noesis:nobody', '', 'not a did', 'did:civic:noesis:a');
    it('P-DM-04: a message is queued only for another Nous when sender and target both hold an active Civic-DID', async () => {
        await fc.assert(
            fc.asyncProperty(
                arbDid, arbDid, fc.oneof(arbText, arbHostileText), fc.subarray([...NAMES]), fc.boolean(), fc.nat({ max: 1_000_000 }),
                async (senderDid, targetDid, text, citizens, full, tick) => {
                    const calls: unknown[][] = [];
                    const router = new PeerMessageRouter({
                        gridName: GRID,
                        civicDidOf: async (did) => {
                            const name = NAMES.find((n) => didOf(n) === did);
                            return name !== undefined && citizens.includes(name) ? civicOf(name) : null;
                        },
                        queue: { enqueue: async (...args) => { calls.push(args); return full ? null : 1; } },
                    });
                    const result = await router.deliver({ senderDid, senderName: 'S', targetDid, channel: 'direct', text: text as string, tick });

                    const senderName = NAMES.find((n) => didOf(n) === senderDid && citizens.includes(n));
                    const targetName = NAMES.find((n) => didOf(n) === targetDid && citizens.includes(n));
                    const allowed = textOk(text) && senderDid !== targetDid && senderName !== undefined && targetName !== undefined;

                    expect(calls.length).toBe(allowed ? 1 : 0);
                    expect(result === 'queued').toBe(allowed && !full);
                    if (allowed) {
                        // P-DM-02: the row is addressed to the target's Civic-DID and to nobody else.
                        expect(calls[0]).toEqual([GRID, civicOf(targetName!), civicOf(senderName!), {
                            kind: PEER_MESSAGE_KIND, sender_did: senderDid, sender_name: 'S', channel: 'direct', text, tick,
                        }, tick]);
                        if (full) expect(result).toBe('inbox_full');
                    }
                },
            ),
            params,
        );
    });
});

// ── Stateful: random sequences of the TLA+ actions against the real Grid pieces ──────────

type Op =
    | { t: 'SetMute'; n: number; on: boolean }
    | { t: 'Retire'; n: number }
    | { t: 'Send'; via: 'dm' | 'lore_request' | 'lore_response'; s: number; to: number; text: unknown }
    | { t: 'Poll'; p: number }
    | { t: 'Claim'; p: number; fromSeen: boolean; pick: number }
    | { t: 'Crash'; p: number };

// Brain processes: one per Nous, and a second one for Nous 0 (two machines, or a restart that overlaps).
const PROC_OWNER = [0, 1, 2, 0];
const arbNous = fc.nat({ max: NAMES.length - 1 });
const arbProc = fc.nat({ max: PROC_OWNER.length - 1 });
const arbOp: fc.Arbitrary<Op> = fc.oneof(
    { weight: 2, arbitrary: fc.record({ t: fc.constant('SetMute' as const), n: arbNous, on: fc.boolean() }) },
    { weight: 1, arbitrary: fc.record({ t: fc.constant('Retire' as const), n: arbNous }) },
    // `to` 3 is a DID nobody holds; `to` 4 holds an active Civic-DID but is not a Nous.
    { weight: 8, arbitrary: fc.record({ t: fc.constant('Send' as const), via: fc.constantFrom('dm' as const, 'dm' as const, 'lore_request' as const, 'lore_response' as const), s: arbNous, to: fc.nat({ max: NAMES.length + 1 }), text: fc.oneof({ weight: 9, arbitrary: arbText }, { weight: 1, arbitrary: arbHostileText }) }) },
    { weight: 5, arbitrary: fc.record({ t: fc.constant('Poll' as const), p: arbProc }) },
    { weight: 8, arbitrary: fc.record({ t: fc.constant('Claim' as const), p: arbProc, fromSeen: fc.boolean(), pick: fc.nat({ max: 40 }) }) },
    { weight: 1, arbitrary: fc.record({ t: fc.constant('Crash' as const), p: arbProc }) },
);

describe('peer messages over time', () => {
    it('P-DM-01 P-DM-02 P-DM-03 P-DM-04 P-DM-05 P-DM-06 P-DM-07 P-DM-08: any sequence of mute, retire, send, poll, claim and crash keeps every invariant', async () => {
        await fc.assert(
            fc.asyncProperty(fc.array(arbOp, { maxLength: 40 }), async (ops) => {
                const world = await makeWorld(NAMES, { depthMax: DEPTH_MAX });
                try {
                    const seen: Map<number, unknown>[] = PROC_OWNER.map(() => new Map());
                    /** Every hand-over to on_message: message id → the Nous whose Brain got it, once per hand-over. */
                    const handed = new Map<number, number[]>();
                    /** What each queued id was when it was sent. */
                    const sent = new Map<number, { to: number; text: string }>();
                    let dmAudits = 0;
                    let tick = 0;

                    const claim = async (p: number, id: number): Promise<void> => {
                        const changed = await world.ack(NAMES[PROC_OWNER[p]!]!, [id]);
                        expect([0, 1]).toContain(changed);
                        if (changed === 1) handed.set(id, [...(handed.get(id) ?? []), PROC_OWNER[p]!]);
                        seen[p]!.delete(id);
                    };
                    const check = (): void => {
                        for (const [id, owners] of handed) {
                            expect(owners.length).toBe(1);                               // P-DM-01
                            expect(owners[0]).toBe(sent.get(id)!.to);                    // P-DM-02
                        }
                        for (const row of world.queue.rows) {
                            expect(sent.has(row.id)).toBe(true);                         // P-DM-03 / P-DM-04: no row we did not expect
                            if (row.status === 'delivered') expect(row.messageJson).toEqual({}); // P-DM-05
                        }
                    };

                    for (const op of ops) {
                        tick++;
                        if (op.t === 'SetMute') {
                            world.runners.get(NAMES[op.n]!)!.muteFlag = op.on;
                        } else if (op.t === 'Retire') {
                            world.citizens.delete(NAMES[op.n]!);
                        } else if (op.t === 'Send') {
                            const sender = NAMES[op.s]!;
                            const runner = world.runners.get(sender)!;
                            const targetName: string | undefined = NAMES[op.to];
                            const targetDid = targetName !== undefined ? didOf(targetName) : op.to === NAMES.length ? 'did:noesis:nobody' : didOf(OUTSIDER);
                            const before = world.queue.rows.length;
                            const depth = targetName !== undefined ? await world.queue.depth(GRID, civicOf(targetName)) : 0;
                            // A direct message, or the two lore actions that travel the same way.
                            const action = op.via === 'dm'
                                ? { action_type: 'direct_message', channel: 'direct', text: op.text, metadata: { target_did: targetDid } }
                                : op.via === 'lore_request'
                                    ? { action_type: 'lore_request', channel: '', text: '', metadata: { content_hash: op.text, contributor_did: targetDid } }
                                    : { action_type: 'lore_response', channel: '', text: '', metadata: { recipient_did: targetDid, payload: op.text } };
                            const carried: unknown = op.via === 'lore_request' && typeof op.text === 'string' ? `__lore_request:${op.text}` : op.text;
                            // P-DM-08: a lore request or response goes out only in its exact wire form.
                            const formOk = op.via === 'dm' ? true : op.via === 'lore_request' ? hashOk(op.text) : loreResponseOk(op.text);
                            const auditChannel = op.via === 'dm' ? 'direct' : op.via;
                            // P-DM-07: every message that may be queued is audited first, whichever of the three it is.
                            const audited = !runner.muteFlag && textOk(carried) && formOk;
                            const queued = audited
                                && op.to !== op.s && targetName !== undefined
                                && world.citizens.has(sender) && world.citizens.has(targetName) && depth < DEPTH_MAX;

                            await runner.executeActions([action as unknown as BrainAction], tick);

                            // P-DM-03 / P-DM-04: queued exactly when every check passes; a muted sender queues nothing.
                            expect(world.queue.rows.length).toBe(before + (queued ? 1 : 0));
                            if (queued) {
                                const row = world.queue.rows[world.queue.rows.length - 1]!;
                                expect(row.recipientCivicDid).toBe(civicOf(targetName!));
                                expect(row.senderCivicDid).toBe(civicOf(sender));
                                expect(row.messageJson).toEqual({
                                    kind: PEER_MESSAGE_KIND, sender_did: didOf(sender), sender_name: displayName(sender),
                                    channel: 'direct', text: carried, tick,
                                });
                                sent.set(row.id, { to: op.to, text: carried as string });
                            }
                            // P-DM-05: the audit record is { targetDid, channel, tick } and nothing else.
                            const audits = world.audit.query({ eventType: 'nous.direct_message' });
                            if (audited) dmAudits++;
                            expect(audits.length).toBe(dmAudits);
                            expect(queued && !audited).toBe(false);                      // P-DM-07
                            if (audited) {
                                const last = audits[audits.length - 1]!;
                                expect(last.actorDid).toBe(didOf(sender));
                                expect(last.payload).toEqual({ targetDid, channel: auditChannel, tick });
                            }
                        } else if (op.t === 'Poll') {
                            const owner = NAMES[PROC_OWNER[op.p]!]!;
                            const { status, body } = await world.inbox(owner, '?limit=10');
                            expect(status).toBe(200);
                            for (const m of body.messages as { id: number; message: { text: string } }[]) {
                                // P-DM-02: a poll shows a Brain only its own Nous's messages, with the text as sent.
                                expect(sent.get(m.id)!.to).toBe(PROC_OWNER[op.p]);
                                expect(m.message.text).toBe(sent.get(m.id)!.text);
                                seen[op.p]!.set(m.id, m.message);
                            }
                        } else if (op.t === 'Claim') {
                            const ids = [...seen[op.p]!.keys()];
                            // Either an id this process read, or any id at all — also one that is not its own.
                            const id = op.fromSeen && ids.length > 0 ? ids[op.pick % ids.length]! : op.pick + 1;
                            await claim(op.p, id);
                        } else {
                            seen[op.p]!.clear();
                        }
                        check();
                    }

                    // P-DM-06: once every Brain polls and claims until its inbox is empty, every queued message has been handed over.
                    for (let p = 0; p < NAMES.length; p++) {
                        for (;;) {
                            const { body } = await world.inbox(NAMES[p]!, '?limit=2');
                            if (body.messages.length === 0) break;
                            for (const m of body.messages as { id: number }[]) await claim(p, m.id);
                        }
                    }
                    check();
                    for (const id of sent.keys()) expect(handed.get(id)?.length).toBe(1);
                    expect(world.queue.rows.every((r) => r.status === 'delivered')).toBe(true);
                } finally {
                    await world.close();
                }
            }),
            params,
        );
    }, 300_000);
});
