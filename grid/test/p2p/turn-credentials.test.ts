import { describe, it } from 'vitest';

describe('generateTurnCredentials (Phase 42 Plan 03)', () => {
    it.skip('username format is `<expiry-unix-seconds>:<civicDid>` with expiry == now + 3600', () => {
        // const creds = generateTurnCredentials('did:civic:noesis:abc', sharedSecret);
        // const [expiry, did] = creds.username.split(':');
        // expect(Number(expiry)).toBeCloseTo(Math.floor(Date.now() / 1000) + 3600, -1);
        // expect(did).toBe('did');
    });

    it.skip('password is base64(HMAC-SHA1(sharedSecret, username))', () => {
        // const creds = generateTurnCredentials('did:civic:noesis:abc', 'secret');
        // const expected = hmacSha1Base64('secret', creds.username);
        // expect(creds.password).toBe(expected);
    });

    it.skip('returned object has keys {username, password, ttl, realm}', () => {
        // const creds = generateTurnCredentials('did:civic:noesis:abc', 'secret');
        // expect(creds).toMatchObject({ username: expect.any(String), password: expect.any(String), ttl: expect.any(Number), realm: expect.any(String) });
    });

    it.skip('ttl is exactly 3600', () => {
        // const creds = generateTurnCredentials('did:civic:noesis:abc', 'secret');
        // expect(creds.ttl).toBe(3600);
    });

    it.skip('realm is exactly "noesis.grid"', () => {
        // const creds = generateTurnCredentials('did:civic:noesis:abc', 'secret');
        // expect(creds.realm).toBe('noesis.grid');
    });

    it.skip('different civicDid produces different username', () => {
        // const credsA = generateTurnCredentials('did:civic:noesis:alice', 'secret');
        // const credsB = generateTurnCredentials('did:civic:noesis:bob', 'secret');
        // expect(credsA.username).not.toBe(credsB.username);
    });

    it.skip('same inputs at different timestamps produce different usernames (expiry changes)', () => {
        // const credsA = generateTurnCredentials('did:civic:noesis:abc', 'secret'); // t=0
        // vi.advanceTimersByTime(60_000);
        // const credsB = generateTurnCredentials('did:civic:noesis:abc', 'secret'); // t=60s
        // expect(credsA.username).not.toBe(credsB.username);
    });
});
