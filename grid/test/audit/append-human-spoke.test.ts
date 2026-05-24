/**
 * Phase 27 CHAT-04 — appendHumanSpoke sole-producer boundary tests.
 *
 * Test matrix:
 *   - Valid payload succeeds and returns AuditEntry
 *   - Wrong key name 'message_hash' throws TypeError
 *   - msg_hash with non-hex characters throws TypeError
 *   - Extra key throws TypeError (closed-tuple violation)
 *   - ALLOWLIST_MEMBERS.length === 52 after Phase 27 extension
 *   - ALLOWLIST_MEMBERS[51] === 'human.spoke'
 *   - payloadPrivacyCheck passes for HumanSpokePayload (msg_hash key is safe)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendHumanSpoke } from '../../src/audit/append-human-spoke.js';
import { ALLOWLIST_MEMBERS, payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist.js';

const VALID_HUMAN_DID = 'did:noesis:human_0xabc123';
const VALID_NOUS_DID = 'did:noesis:sophia';
const VALID_MSG_HASH = 'a'.repeat(64); // 64 lowercase hex chars

describe('appendHumanSpoke — 8-step discipline', () => {
    let chain: AuditChain;

    beforeEach(() => {
        chain = new AuditChain();
    });

    it('succeeds with valid payload and returns AuditEntry', () => {
        const entry = appendHumanSpoke(chain, {
            human_did: VALID_HUMAN_DID,
            msg_hash: VALID_MSG_HASH,
            nous_did: VALID_NOUS_DID,
            tick: 100,
        });
        expect(entry).toBeDefined();
        expect(entry.eventType).toBe('human.spoke');
        expect(entry.actorDid).toBe(VALID_HUMAN_DID);
        expect(entry.payload).toMatchObject({
            human_did: VALID_HUMAN_DID,
            msg_hash: VALID_MSG_HASH,
            nous_did: VALID_NOUS_DID,
            tick: 100,
        });
    });

    it('throws TypeError when key is "message_hash" instead of "msg_hash"', () => {
        // The substring 'message' would trigger FORBIDDEN_KEY_PATTERN
        expect(() =>
            appendHumanSpoke(chain, {
                human_did: VALID_HUMAN_DID,
                // @ts-expect-error — intentional wrong key name for test
                message_hash: VALID_MSG_HASH,
                nous_did: VALID_NOUS_DID,
                tick: 100,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when msg_hash contains non-hex characters', () => {
        expect(() =>
            appendHumanSpoke(chain, {
                human_did: VALID_HUMAN_DID,
                msg_hash: 'xyz' + 'a'.repeat(61), // non-hex chars
                nous_did: VALID_NOUS_DID,
                tick: 100,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when msg_hash is uppercase hex (must be lowercase)', () => {
        expect(() =>
            appendHumanSpoke(chain, {
                human_did: VALID_HUMAN_DID,
                msg_hash: 'A'.repeat(64), // uppercase not allowed by HEX64_RE
                nous_did: VALID_NOUS_DID,
                tick: 100,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when msg_hash is too short', () => {
        expect(() =>
            appendHumanSpoke(chain, {
                human_did: VALID_HUMAN_DID,
                msg_hash: 'a'.repeat(63), // 63 chars — must be exactly 64
                nous_did: VALID_NOUS_DID,
                tick: 100,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError with extra key (closed-tuple violation)', () => {
        expect(() =>
            appendHumanSpoke(chain, {
                human_did: VALID_HUMAN_DID,
                msg_hash: VALID_MSG_HASH,
                nous_did: VALID_NOUS_DID,
                tick: 100,
                // @ts-expect-error — extra key not in closed tuple
                extra: 'should not be here',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when human_did does not match DID_RE', () => {
        expect(() =>
            appendHumanSpoke(chain, {
                human_did: 'not-a-did',
                msg_hash: VALID_MSG_HASH,
                nous_did: VALID_NOUS_DID,
                tick: 100,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when nous_did does not match DID_RE', () => {
        expect(() =>
            appendHumanSpoke(chain, {
                human_did: VALID_HUMAN_DID,
                msg_hash: VALID_MSG_HASH,
                nous_did: 'not-a-did',
                tick: 100,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when tick is negative', () => {
        expect(() =>
            appendHumanSpoke(chain, {
                human_did: VALID_HUMAN_DID,
                msg_hash: VALID_MSG_HASH,
                nous_did: VALID_NOUS_DID,
                tick: -1,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when tick is not an integer', () => {
        expect(() =>
            appendHumanSpoke(chain, {
                human_did: VALID_HUMAN_DID,
                msg_hash: VALID_MSG_HASH,
                nous_did: VALID_NOUS_DID,
                tick: 1.5,
            }),
        ).toThrow(TypeError);
    });
});

describe('broadcast-allowlist — Phase 27 end-state (52 events; Phase 28 added 1 more, now 53)', () => {
    it('ALLOWLIST_MEMBERS.length === 53 (Phase 28 SPAWN-04 added nous.spawned_by_human)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(53);
    });

    it('ALLOWLIST_MEMBERS[51] === "human.spoke"', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[51]).toBe('human.spoke');
    });

    it('payloadPrivacyCheck({human_did, msg_hash, nous_did, tick}) returns {ok: true}', () => {
        const result = payloadPrivacyCheck({
            human_did: VALID_HUMAN_DID,
            msg_hash: VALID_MSG_HASH,
            nous_did: VALID_NOUS_DID,
            tick: 100,
        });
        expect(result.ok).toBe(true);
    });

    it('msg_hash key does not trigger FORBIDDEN_KEY_PATTERN', () => {
        // Verify that 'msg_hash' is safe — the substring 'message' would fail
        // This test documents the critical design decision: msg_hash NOT message_hash
        const result = payloadPrivacyCheck({ msg_hash: 'a'.repeat(64) });
        expect(result.ok).toBe(true);
    });
});
