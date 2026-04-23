/**
 * Phase 10b Wave 0 RED stub — UI-SPEC §Testing Contract #5, #6.
 *
 * Clone of dashboard/test/privacy/drive-forbidden-keys-dashboard.test.tsx
 * adapted for the Bios needs surface.
 *
 * BIOS_FORBIDDEN_KEYS + CHRONOS_FORBIDDEN_KEYS must be absent from:
 *   (a) the NousStateResponse type shape (introspect.ts source — bios fields
 *       must NEVER appear as type properties)
 *   (b) the rendered DOM of BiosSection (no numeric floats, no need_value /
 *       bios_value attributes, no chronos multipliers anywhere)
 *
 * Allowed exceptions for `energy` / `sustenance`:
 *   - need-name labels in visible text
 *   - data-need="energy" | "sustenance" enum values
 * Forbidden: any numeric float neighbor or property-key form.
 *
 * Extends T-09-02 (render surface is the final leak gate) and T-10b-02 to
 * the Bios surface.
 *
 * RED at Wave 0:
 *   - bios-types.ts does not exist (NEED_ORDER, NEED_BASELINE_LEVEL imports fail)
 *   - use-bios-levels hook does not exist
 *   - BiosSection component does not exist
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import {
    NEED_ORDER,
    type NeedName,
    type NeedLevel,
    type NeedDirection,
    type BiosLevelEntry,
    NEED_BASELINE_LEVEL,
} from '@/lib/protocol/bios-types';

const BIOS_FORBIDDEN_KEYS = [
    'energy',
    'sustenance',
    'need_value',
    'bios_value',
] as const;

const CHRONOS_FORBIDDEN_KEYS = [
    'subjective_multiplier',
    'chronos_multiplier',
    'subjective_tick',
] as const;

// Mutable mock map so we can render with crossing entries.
let mockLevels = new Map<NeedName, BiosLevelEntry>();

vi.mock('@/lib/hooks/use-bios-levels', () => ({
    useBiosLevels: () => mockLevels,
}));

import { BiosSection } from '@/app/grid/components/inspector-sections/bios';

function baselineMap(): Map<NeedName, BiosLevelEntry> {
    const m = new Map<NeedName, BiosLevelEntry>();
    for (const need of NEED_ORDER) {
        m.set(need, { level: NEED_BASELINE_LEVEL[need], direction: null });
    }
    return m;
}

function singletonMap(
    need: NeedName,
    level: NeedLevel,
    direction: NeedDirection | null,
): Map<NeedName, BiosLevelEntry> {
    const m = baselineMap();
    m.set(need, { level, direction });
    return m;
}

beforeEach(() => {
    mockLevels = baselineMap();
});

// Project root is 2 levels up from dashboard/test/privacy.
const REPO_ROOT = resolve(__dirname, '../../..');
const DASHBOARD = resolve(REPO_ROOT, 'dashboard');

describe('BIOS_FORBIDDEN_KEYS + CHRONOS_FORBIDDEN_KEYS absent from dashboard API + DOM', () => {
    it('NousStateResponse shape has no bios-related property field', () => {
        const introspectPath = resolve(DASHBOARD, 'src/lib/api/introspect.ts');
        const src = readFileSync(introspectPath, 'utf8');
        // Strip comments before grepping — bios names may appear in comments
        // as semantic labels; the privacy contract targets PROPERTY KEYS in
        // the exported NousStateResponse type.
        const stripped = src
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
        for (const key of BIOS_FORBIDDEN_KEYS) {
            const asTypeField = new RegExp(`\\b${key}\\s*\\??\\s*:`, 'i');
            expect(
                stripped,
                `forbidden bios key "${key}" leaked into NousStateResponse shape`,
            ).not.toMatch(asTypeField);
        }
        for (const key of CHRONOS_FORBIDDEN_KEYS) {
            const asTypeField = new RegExp(`\\b${key}\\s*\\??\\s*:`, 'i');
            expect(
                stripped,
                `forbidden chronos key "${key}" leaked into NousStateResponse shape`,
            ).not.toMatch(asTypeField);
        }
    });

    it('rendered BiosSection DOM contains no numeric float literal', () => {
        mockLevels = singletonMap('energy', 'high', 'rising');
        const { container } = render(<BiosSection did="did:key:test" />);
        const html = container.innerHTML;
        expect(html, 'no /0\\.[0-9]+/ float in DOM').not.toMatch(/\b0\.[0-9]+\b/);
    });

    it('no chronos forbidden key appears anywhere in rendered DOM', () => {
        mockLevels = singletonMap('sustenance', 'low', 'falling');
        const { container } = render(<BiosSection did="did:key:test" />);
        const html = container.innerHTML;
        for (const key of CHRONOS_FORBIDDEN_KEYS) {
            expect(html, `chronos forbidden key "${key}" leaked into DOM`).not.toMatch(
                new RegExp(`\\b${key}\\b`, 'i'),
            );
        }
    });

    it('no need_value / bios_value attribute or property in rendered DOM', () => {
        mockLevels = singletonMap('energy', 'med', 'rising');
        const { container } = render(<BiosSection did="did:key:test" />);
        const html = container.innerHTML;
        // The numeric-leak attribute names must NEVER appear.
        expect(html).not.toMatch(/\bneed_value=/);
        expect(html).not.toMatch(/\bbios_value=/);
        expect(html).not.toMatch(/\bdata-need-raw=/);
        expect(html).not.toMatch(/\bdata-value=/);
        // No title= attributes carrying a float.
        expect(html).not.toMatch(/title="[^"]*0\.[0-9]+/);
    });

    it('data-need="energy"|"sustenance" enum values are permitted (not a leak)', () => {
        // Sanity invariant: the section MAY render data-need with enum names.
        // This test exists to document the explicit allowlist exception so a
        // future overzealous regex tightening doesn't ban valid usage.
        mockLevels = baselineMap();
        const { container } = render(<BiosSection did="did:key:test" />);
        const html = container.innerHTML;
        // No floats anywhere even when the enum name appears.
        expect(html).not.toMatch(/\b0\.[0-9]+\b/);
        // Energy/sustenance NEVER appears with a numeric neighbor.
        expect(html).not.toMatch(/energy[^a-z]{0,3}\d/i);
        expect(html).not.toMatch(/sustenance[^a-z]{0,3}\d/i);
    });

    it('no aria-label leaks a float for any need', () => {
        mockLevels = singletonMap('sustenance', 'high', 'rising');
        const { container } = render(<BiosSection did="did:key:test" />);
        for (const node of Array.from(container.querySelectorAll('[aria-label]'))) {
            const label = node.getAttribute('aria-label') ?? '';
            expect(label).not.toMatch(/\b0\.[0-9]+\b/);
            for (const key of CHRONOS_FORBIDDEN_KEYS) {
                expect(label.toLowerCase()).not.toContain(key);
            }
        }
    });

    it('no wall-clock or timer in BiosSection or useBiosLevels source', () => {
        const componentPath = resolve(
            DASHBOARD,
            'src/app/grid/components/inspector-sections/bios.tsx',
        );
        const hookPath = resolve(DASHBOARD, 'src/lib/hooks/use-bios-levels.ts');
        expect(existsSync(componentPath), `${componentPath} must exist`).toBe(true);
        expect(existsSync(hookPath), `${hookPath} must exist`).toBe(true);

        for (const p of [componentPath, hookPath]) {
            const src = readFileSync(p, 'utf8');
            const stripped = src
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            expect(stripped, `${p} contains setTimeout`).not.toMatch(/\bsetTimeout\b/);
            expect(stripped, `${p} contains setInterval`).not.toMatch(/\bsetInterval\b/);
            expect(stripped, `${p} contains requestAnimationFrame`).not.toMatch(
                /\brequestAnimationFrame\b/,
            );
            expect(stripped, `${p} contains Date.now`).not.toMatch(/\bDate\.now\b/);
            expect(stripped, `${p} contains performance.now`).not.toMatch(
                /\bperformance\.now\b/,
            );
        }
    });

    it('repo-wide grep: no bios forbidden-key PROPERTY fields in dashboard/src/lib/api', () => {
        const out = execSync(
            `grep -rEn "\\b(energy|sustenance|need_value|bios_value)\\s*\\??:" ` +
                `${DASHBOARD}/src/lib/api || true`,
            { encoding: 'utf8' },
        );
        expect(out.trim()).toBe('');
    });

    it('repo-wide grep: no chronos forbidden-key PROPERTY fields in dashboard/src/lib/api', () => {
        const out = execSync(
            `grep -rEn "\\b(subjective_multiplier|chronos_multiplier|subjective_tick)\\s*\\??:" ` +
                `${DASHBOARD}/src/lib/api || true`,
            { encoding: 'utf8' },
        );
        expect(out.trim()).toBe('');
    });
});
