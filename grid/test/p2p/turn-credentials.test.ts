import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { generateTurnCredentials } from '../../src/p2p/turn-credentials.js';
import { TURN_TTL_SECONDS, TURN_REALM } from '../../src/p2p/types.js';

function hmacSha1Base64(secret: string, message: string): string {
    return createHmac('sha1', secret).update(message).digest('base64');
}

describe('generateTurnCredentials (Phase 42 Plan 02)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('username format is `<expiry-unix-seconds>:<civicDid>` with expiry == now + 3600', () => {
        const creds = generateTurnCredentials('did:civic:noesis:abc', 'shared-secret');
        const colonIdx = creds.username.indexOf(':');
        const expiry = Number(creds.username.substring(0, colonIdx));
        const did = creds.username.substring(colonIdx + 1);
        const expectedExpiry = Math.floor(Date.now() / 1000) + TURN_TTL_SECONDS;
        expect(expiry).toBe(expectedExpiry);
        expect(did).toBe('did:civic:noesis:abc');
    });

    it('password is base64(HMAC-SHA1(sharedSecret, username))', () => {
        const creds = generateTurnCredentials('did:civic:noesis:abc', 'secret');
        const expected = hmacSha1Base64('secret', creds.username);
        expect(creds.password).toBe(expected);
    });

    it('returned object has keys {username, password, ttl, realm}', () => {
        const creds = generateTurnCredentials('did:civic:noesis:abc', 'secret');
        expect(creds).toMatchObject({
            username: expect.any(String),
            password: expect.any(String),
            ttl: expect.any(Number),
            realm: expect.any(String),
        });
    });

    it('ttl is exactly 3600', () => {
        const creds = generateTurnCredentials('did:civic:noesis:abc', 'secret');
        expect(creds.ttl).toBe(3600);
    });

    it('realm is exactly "noesis.grid"', () => {
        const creds = generateTurnCredentials('did:civic:noesis:abc', 'secret');
        expect(creds.realm).toBe(TURN_REALM);
        expect(creds.realm).toBe('noesis.grid');
    });

    it('different civicDid produces different username', () => {
        const credsA = generateTurnCredentials('did:civic:noesis:alice', 'secret');
        const credsB = generateTurnCredentials('did:civic:noesis:bob', 'secret');
        expect(credsA.username).not.toBe(credsB.username);
    });

    it('same inputs at different timestamps produce different usernames (expiry changes)', () => {
        const credsA = generateTurnCredentials('did:civic:noesis:abc', 'secret');
        vi.advanceTimersByTime(60_000);
        const credsB = generateTurnCredentials('did:civic:noesis:abc', 'secret');
        expect(credsA.username).not.toBe(credsB.username);
    });
});
