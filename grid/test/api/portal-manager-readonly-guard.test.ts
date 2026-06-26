/**
 * Portal Manager v1 — READ-ONLY / allowlist-frozen guard.
 *
 * v1 is strictly observe-only (D-V3-36, VOTE-05). These guards prove it adds NO
 * broadcast event and emits no audit entries:
 *   1. The broadcast allowlist length is unchanged (no new portal.* prefix).
 *   2. The route module imports NO audit producer (no `append*` import, no
 *      reference to services.audit) — it can only SELECT.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const SRC = readFileSync(
    fileURLToPath(new URL('../../src/api/portal/portal-manager.ts', import.meta.url)),
    'utf8',
);

describe('Portal Manager v1 — allowlist frozen', () => {
    it('ALLOWLIST_MEMBERS length is unchanged by v1 (no new broadcast event)', () => {
        // Portal Manager v1 adds zero events. The canonical count lives in
        // broadcast-allowlist.test.ts (117 after L1b due.* + L2b procurement.* + L3b orbital.*);
        // this guard only asserts v1 itself added nothing.
        expect(ALLOWLIST_MEMBERS.length).toBe(139);
    });
});

describe('Portal Manager v1 — module is observe-only', () => {
    it('imports no audit producer (no append* import)', () => {
        expect(SRC).not.toMatch(/import[^\n]*append/i);
    });

    it('never references services.audit (cannot emit audit entries)', () => {
        expect(SRC).not.toContain('services.audit');
        expect(SRC).not.toContain('.audit');
    });

    it('issues no INSERT / UPDATE / DELETE SQL — SELECT-only', () => {
        // SQL keywords are upper-cased in this file; lower-case `.update()` is the
        // crypto hash call, not a mutation, so the match is case-sensitive.
        expect(SRC).not.toMatch(/\bINSERT\b/);
        expect(SRC).not.toMatch(/\bUPDATE\b/);
        expect(SRC).not.toMatch(/\bDELETE\b/);
    });
});
