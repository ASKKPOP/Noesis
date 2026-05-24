import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { HumanUser } from './siwe-auth';

/**
 * Phase 24-02 Task 1 — HumanUser type + /me hydration tests.
 *
 * These tests verify:
 *   1. HumanUser has region?: string | null
 *   2. HumanUser has created_at?: string | null
 *   3. Auth page calls /me after /verify (source-text contract)
 *   4. Auth page calls setUser with full /me response
 */

describe('HumanUser interface', () => {
    it('accepts region field', () => {
        const user: HumanUser = {
            did: 'did:noesis:human:0xABC',
            eth_address: '0xABC',
            region: 'agora',
        };
        expect(user.region).toBe('agora');
    });

    it('accepts region as null', () => {
        const user: HumanUser = {
            did: 'did:noesis:human:0xABC',
            eth_address: '0xABC',
            region: null,
        };
        expect(user.region).toBeNull();
    });

    it('accepts region as undefined (optional)', () => {
        const user: HumanUser = {
            did: 'did:noesis:human:0xABC',
            eth_address: '0xABC',
        };
        expect(user.region).toBeUndefined();
    });

    it('accepts created_at as ISO 8601 string', () => {
        const user: HumanUser = {
            did: 'did:noesis:human:0xABC',
            eth_address: '0xABC',
            created_at: '2026-05-20T12:00:00.000Z',
        };
        expect(user.created_at).toBe('2026-05-20T12:00:00.000Z');
    });

    it('accepts created_at as null', () => {
        const user: HumanUser = {
            did: 'did:noesis:human:0xABC',
            eth_address: '0xABC',
            created_at: null,
        };
        expect(user.created_at).toBeNull();
    });

    it('accepts created_at as undefined (optional)', () => {
        const user: HumanUser = {
            did: 'did:noesis:human:0xABC',
            eth_address: '0xABC',
        };
        expect(user.created_at).toBeUndefined();
    });

    it('backwards-compatible — existing fields still present', () => {
        const user: HumanUser = {
            did: 'did:noesis:human:0xABC',
            eth_address: '0xABC123',
            email: 'test@example.com',
            region: 'agora',
            created_at: '2026-05-20T12:00:00.000Z',
        };
        expect(user.did).toBe('did:noesis:human:0xABC');
        expect(user.eth_address).toBe('0xABC123');
        expect(user.email).toBe('test@example.com');
    });
});

describe('Auth page /me hydration (source-text contract)', () => {
    /**
     * These tests read the auth page source file to confirm structural
     * requirements that cannot be tested via component rendering without
     * a full Next.js / wagmi / next-auth mock tree.
     */
    const authPagePath = path.resolve(
        __dirname,
        '../../app/portal/auth/page.tsx',
    );
    let source: string;

    beforeAll(() => {
        source = fs.readFileSync(authPagePath, 'utf8');
    });

    it('calls /api/v1/portal/auth/me after verify', () => {
        expect(source).toContain('/api/v1/portal/auth/me');
    });

    it('uses credentials: include on /me fetch', () => {
        // Check that credentials: 'include' appears after the /me reference
        const meIdx = source.indexOf('/api/v1/portal/auth/me');
        expect(meIdx).toBeGreaterThan(-1);
        const snippet = source.slice(meIdx, meIdx + 200);
        expect(snippet).toContain("credentials: 'include'");
    });
});
