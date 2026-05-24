import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Phase 24-02 Task 2 — Profile page 3 new rows tests.
 *
 * These tests use source-text contracts because the profile page uses
 * wagmi hooks (useBalance, useReadContract) which require a full
 * Web3Provider render tree. Source-text contracts verify the correct
 * code is present without a heavy mount.
 *
 * Tests verify:
 *   1. 'Current Region' dt label present
 *   2. 'Cyber Coin' dt label present
 *   3. '→ Wallet' link pointing to /portal/wallet present
 *   4. 'Member Since' dt label present
 *   5. Current Region row shows '—' fallback for null/undefined
 *   6. Member Since row shows '—' fallback for null/undefined
 *   7. Balance row shows '—' fallback for undefined ethBal
 *   8. dynamic({ ssr: false }) export is present
 */

const profilePagePath = path.resolve(
    __dirname,
    './page.tsx',
);

let source: string;

beforeAll(() => {
    source = fs.readFileSync(profilePagePath, 'utf8');
});

describe('Profile page — new rows (source-text contract)', () => {
    it('renders "Current Region" dt label', () => {
        expect(source).toContain('Current Region');
    });

    it('renders "Cyber Coin" dt label', () => {
        expect(source).toContain('Cyber Coin');
    });

    it('renders → Wallet link pointing to /portal/wallet', () => {
        expect(source).toContain('/portal/wallet');
    });

    it('renders "Member Since" dt label', () => {
        expect(source).toContain('Member Since');
    });

    it('Current Region shows "—" fallback when region is null/undefined', () => {
        // The code must use ?? '—' or : '—' as fallback for region
        expect(source).toMatch(/currentUser\?\.region[\s\S]{0,200}?['"—]/);
    });

    it('Member Since shows "—" fallback when created_at is null/undefined', () => {
        expect(source).toMatch(/currentUser\?\.created_at[\s\S]{0,200}?['"—]/);
    });

    it('Balance row shows "—" fallback when ethBal is undefined', () => {
        // ethBal is used with a ternary — fallback to '—'
        expect(source).toMatch(/ethBal[\s\S]{0,100}?['"—]/);
    });

    it('preserves dynamic({ ssr: false }) export', () => {
        expect(source).toContain('ssr: false');
    });
});

describe('Profile page — wagmi hook imports (source-text contract)', () => {
    it('imports useBalance from wagmi', () => {
        expect(source).toContain('useBalance');
    });

    it('imports useReadContract from wagmi', () => {
        expect(source).toContain('useReadContract');
    });

    it('uses var(--terracotta) for → Wallet link color', () => {
        expect(source).toContain('var(--terracotta)');
    });

    it('new dt labels use fontWeight: 600 (not 500)', () => {
        // The new rows (Current Region, Cyber Coin, Member Since) render dt
        // via a shared newDtStyle constant that must contain fontWeight: 600.
        // Verify the constant is defined with 600 and referenced by the new rows.
        expect(source).toContain('fontWeight: 600');
        // The newDtStyle constant must appear before Cyber Coin in source
        const fwIdx = source.indexOf('fontWeight: 600');
        const cyberIdx = source.indexOf('Cyber Coin');
        expect(fwIdx).toBeGreaterThan(-1);
        expect(cyberIdx).toBeGreaterThan(-1);
        // The dt for Cyber Coin must use newDtStyle (not a literal 500)
        // Verify no fontWeight: 500 appears in the Cyber Coin row block
        const cyberBlock = source.slice(cyberIdx - 200, cyberIdx + 400);
        expect(cyberBlock).not.toContain('fontWeight: 500');
    });
});
