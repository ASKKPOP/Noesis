import { describe, it, expect } from 'vitest';
import { payloadPrivacyCheck, PORTAL_AUTH_FORBIDDEN_KEYS } from '../src/audit/broadcast-allowlist.js';

describe('PORTAL_AUTH_FORBIDDEN_KEYS — R-33-01 word-boundary regression (D-33-B4)', () => {
    // ── Word-boundary corner cases — load-bearing for "allowed when hashed" pairs ──

    it('rejects ip_address (\\b-bounded) but allows ip_country (sibling future-metric key)', () => {
        expect(payloadPrivacyCheck({ ip_address: '1.2.3.4' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ ip_country: 'US' }).ok).toBe(true);
    });

    it('rejects user_agent (\\b-bounded) but allows agent_version (no user_agent substring match at \\b)', () => {
        expect(payloadPrivacyCheck({ user_agent: 'Mozilla/5.0' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ agent_version: '1.0' }).ok).toBe(true);
    });

    // ── Compound-form pass-through — JS regex \b does NOT fire between word chars (_ is \w) ──
    // These tests PIN the actual JS regex semantics so future "let's tighten the regex" PRs
    // either explicitly add the compound form or use a different anchor strategy.

    it('ALLOWS user_agent_version — \\buser_agent\\b does NOT match (\\b requires \\W boundary; _ is \\w)', () => {
        // CONTEXT.md D-33-B4 originally claimed this would be forbidden; that claim was
        // factually wrong (JS regex \b semantics). Compound forms pass through the regex
        // layer and are mitigated by the closed-tuple structural check at the producer.
        expect(payloadPrivacyCheck({ user_agent_version: '1.0' }).ok).toBe(true);
    });

    it('ALLOWS ip_address_v6 — same \\b semantics: trailing _ is a word char, no boundary fires', () => {
        expect(payloadPrivacyCheck({ ip_address_v6: '::1' }).ok).toBe(true);
    });

    it('ALLOWS session_id_legacy — compound form passes through \\bsession_id\\b clause', () => {
        expect(payloadPrivacyCheck({ session_id_legacy: 'xyz' }).ok).toBe(true);
    });

    it('ALLOWS email (not in FORBIDDEN_KEY_PATTERN regex; enforced at closed-tuple producer boundary)', () => {
        // email is in PORTAL_AUTH_FORBIDDEN_KEYS but NOT in the word-boundary regex clause.
        // Short common keys (email, nonce, signature, ip, ua, token, cookie) are excluded
        // from FORBIDDEN_KEY_PATTERN per D-33-B4 rationale (over-match risk on substrings).
        // They are caught at the producer boundary via the closed 3-key/5-key tuple check.
        expect(payloadPrivacyCheck({ email: 'user@example.com' }).ok).toBe(true);
    });

    it('ALLOWS email_hash (hashed-email sibling key — both pass the regex layer)', () => {
        expect(payloadPrivacyCheck({ email_hash: 'abc123' }).ok).toBe(true);
    });

    it('ALLOWS nonce (not in FORBIDDEN_KEY_PATTERN regex; enforced at closed-tuple producer boundary)', () => {
        // Same rationale as email — excluded from regex, enforced at producer closed-tuple.
        expect(payloadPrivacyCheck({ nonce: 'abc' }).ok).toBe(true);
    });

    it('ALLOWS nonce_hash (sibling hashed key — passes the regex layer)', () => {
        expect(payloadPrivacyCheck({ nonce_hash: 'abc123' }).ok).toBe(true);
    });

    it('rejects session_id (\\b-bounded) but allows session_count (no match)', () => {
        expect(payloadPrivacyCheck({ session_id: 'xyz' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ session_count: 1 }).ok).toBe(true);
    });

    it('rejects jwt (\\b-bounded) but allows jwt_issuer (suffix bypasses trailing \\b)', () => {
        expect(payloadPrivacyCheck({ jwt: 'eyJ...' }).ok).toBe(false);
        // jwt_issuer has _ between t and i (word chars), so \bjwt\b does NOT match.
        expect(payloadPrivacyCheck({ jwt_issuer: 'https://...' }).ok).toBe(true);
    });

    it('rejects password_hash (\\b-bounded) — hash suffix does not exempt it; explicitly forbidden', () => {
        // password_hash is explicitly in PORTAL_AUTH_FORBIDDEN_KEYS — neither the plaintext
        // nor the hash crosses the wire.
        expect(payloadPrivacyCheck({ password_hash: 'salt:hex' }).ok).toBe(false);
    });

    it('rejects device_fingerprint (\\b-bounded)', () => {
        expect(payloadPrivacyCheck({ device_fingerprint: 'xxx' }).ok).toBe(false);
    });

    it('ALLOWS device_fingerprint_id — compound form passes through \\bdevice_fingerprint\\b clause', () => {
        expect(payloadPrivacyCheck({ device_fingerprint_id: 'yyy' }).ok).toBe(true);
    });

    // ── Nested cases — recursive walker must traverse object + array ──

    it('rejects ip_address nested inside an object', () => {
        expect(payloadPrivacyCheck({ meta: { ip_address: '1.2.3.4' } }).ok).toBe(false);
    });

    it('rejects jwt nested inside an array', () => {
        expect(payloadPrivacyCheck({ items: [{ jwt: 'eyJ...' }] }).ok).toBe(false);
    });

    it('rejects ip_address nested 3 levels deep', () => {
        expect(payloadPrivacyCheck({ a: { b: { c: { ip_address: '1.1.1.1' } } } }).ok).toBe(false);
    });

    it('allows identity_hash nested in object (positive control)', () => {
        expect(payloadPrivacyCheck({ meta: { identity_hash: 'sha256...' } }).ok).toBe(true);
    });

    // ── The 6 word-bounded keys — flat-rejection sweep (canonical set) ──

    it.each([
        'ip_address',
        'user_agent',
        'session_id',
        'jwt',
        'password_hash',
        'device_fingerprint',
    ] as const)('rejects %s as flat key (word-bounded in FORBIDDEN_KEY_PATTERN)', (key) => {
        const payload: Record<string, unknown> = { [key]: 'value' };
        expect(payloadPrivacyCheck(payload).ok).toBe(false);
    });

    // ── The 7 short keys — these are in PORTAL_AUTH_FORBIDDEN_KEYS but NOT in the regex ──
    // They are enforced at the closed-tuple producer boundary, NOT at the regex layer.
    // This test PINS that behavior so any future regex tightening that catches them
    // is a deliberate choice, not an accident.

    it.each([
        'ip',
        'ua',
        'token',
        'cookie',
        'email',
        'nonce',
        'signature',
    ] as const)('ALLOWS %s at the regex layer (caught at producer closed-tuple instead)', (key) => {
        const payload: Record<string, unknown> = { [key]: 'value' };
        // These short keys pass the privacy check — the producer's 3-key/5-key
        // structural tuple is what actually rejects them (no slot for them in the payload).
        expect(payloadPrivacyCheck(payload).ok).toBe(true);
    });

    it('PORTAL_AUTH_FORBIDDEN_KEYS contains exactly 13 keys', () => {
        expect(PORTAL_AUTH_FORBIDDEN_KEYS.length).toBe(13);
    });

    it('PORTAL_AUTH_FORBIDDEN_KEYS contains all 13 expected entries', () => {
        const expected = [
            'ip_address', 'ip', 'user_agent', 'ua', 'session_id', 'token', 'jwt', 'cookie',
            'email', 'password_hash', 'nonce', 'signature', 'device_fingerprint',
        ];
        expect([...PORTAL_AUTH_FORBIDDEN_KEYS].sort()).toEqual(expected.sort());
    });
});
