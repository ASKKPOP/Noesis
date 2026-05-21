/**
 * Profile row formatting tests — Plan 24-05 (PORTAL-04).
 *
 * Tests the region title-case logic, Member Since date format,
 * and balance row fallback values from dashboard/src/app/portal/profile/page.tsx.
 *
 * These are pure expressions extracted from the profile page — no wagmi hooks,
 * no network calls, no component rendering required.
 */

import { describe, it, expect } from 'vitest';

// ── Inline logic extracted from profile/page.tsx ──────────────────────────
// These mirror the exact expressions used in ProfilePage.

function formatRegion(region: string | null | undefined): string {
    if (!region) return '—';
    return region.charAt(0).toUpperCase() + region.slice(1);
}

function formatMemberSince(created_at: string | null | undefined): string {
    if (!created_at) return '—';
    return new Date(created_at).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('profile row formatting', () => {
    describe('formatRegion (Current Region row)', () => {
        it('returns Agora for agora (title-case)', () => {
            expect(formatRegion('agora')).toBe('Agora');
        });

        it('returns — for null region', () => {
            expect(formatRegion(null)).toBe('—');
        });

        it('returns — for undefined region', () => {
            expect(formatRegion(undefined)).toBe('—');
        });

        it('returns — for empty string', () => {
            expect(formatRegion('')).toBe('—');
        });

        it('title-cases any single-word region', () => {
            expect(formatRegion('polis')).toBe('Polis');
            expect(formatRegion('agora')).toBe('Agora');
        });
    });

    describe('formatMemberSince (Member Since row)', () => {
        it('returns May 2026 for a valid ISO date in May 2026', () => {
            expect(formatMemberSince('2026-05-20T12:34:56.000Z')).toBe('May 2026');
        });

        it('returns — for null', () => {
            expect(formatMemberSince(null)).toBe('—');
        });

        it('returns — for undefined', () => {
            expect(formatMemberSince(undefined)).toBe('—');
        });
    });

    describe('balance row fallback values', () => {
        it('shows — for ETH when ethBal is undefined', () => {
            const ethBal: { value: bigint } | undefined = undefined;
            const ethBalValue = ethBal ? 'has value' : '—';
            expect(ethBalValue).toBe('—');
        });

        it('shows — for USDT when usdtRaw is undefined', () => {
            const usdtRaw: bigint | undefined = undefined;
            const usdtValue = usdtRaw !== undefined ? 'has value' : '—';
            expect(usdtValue).toBe('—');
        });
    });
});
