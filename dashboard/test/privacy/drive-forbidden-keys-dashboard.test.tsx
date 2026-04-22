/**
 * Plan 10a-05 Task 2 — Dashboard privacy grep (render tier of the Phase 6
 * three-tier matrix).
 *
 * DRIVE_FORBIDDEN_KEYS must be absent from:
 *   (a) the NousStateResponse type shape (introspect.ts source)
 *   (b) the rendered DOM of AnankeSection (no numeric floats, no title=,
 *       no data-value, no data-drive-raw)
 *   (c) the source of the component and its hook (no wall-clock / timer)
 *
 * This extends T-09-02 (render surface is the final leak-prevention gate)
 * and T-09-03 (no wall-clock reads in render path) to the ananke-drives
 * surface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import {
    DRIVE_ORDER,
    type DriveName,
    type DriveLevel,
    type DriveDirection,
    type AnankeLevelEntry,
    DRIVE_BASELINE_LEVEL,
} from '@/lib/protocol/ananke-types';

const DRIVE_FORBIDDEN_KEYS = [
    'hunger',
    'curiosity',
    'safety',
    'boredom',
    'loneliness',
    'drive_value',
] as const;

// Mutable mock map so we can exercise the render with a crossing entry.
let mockLevels = new Map<DriveName, AnankeLevelEntry>();

vi.mock('@/lib/hooks/use-ananke-levels', () => ({
    useAnankeLevels: () => mockLevels,
}));

import { AnankeSection } from '@/app/grid/components/inspector-sections/ananke';

function baselineMap(): Map<DriveName, AnankeLevelEntry> {
    const m = new Map<DriveName, AnankeLevelEntry>();
    for (const drive of DRIVE_ORDER) {
        m.set(drive, { level: DRIVE_BASELINE_LEVEL[drive], direction: null });
    }
    return m;
}

function singletonMap(
    drive: DriveName,
    level: DriveLevel,
    direction: DriveDirection | null,
): Map<DriveName, AnankeLevelEntry> {
    const m = baselineMap();
    m.set(drive, { level, direction });
    return m;
}

beforeEach(() => {
    mockLevels = baselineMap();
});

// Project root is 2 levels up from dashboard/test/privacy.
const REPO_ROOT = resolve(__dirname, '../../..');
const DASHBOARD = resolve(REPO_ROOT, 'dashboard');

describe('DRIVE_FORBIDDEN_KEYS absent from dashboard API shape + DOM', () => {
    it('NousStateResponse shape has no drive-related property field', () => {
        const introspectPath = resolve(DASHBOARD, 'src/lib/api/introspect.ts');
        const src = readFileSync(introspectPath, 'utf8');
        // Strip comments before grepping — drive NAMES appear in comments as
        // semantic labels; the privacy contract targets them as PROPERTY
        // KEYS in the exported type (`hunger:` or `hunger?:`).
        const stripped = src
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
        for (const key of DRIVE_FORBIDDEN_KEYS) {
            const asTypeField = new RegExp(`\\b${key}\\s*\\??\\s*:`, 'i');
            expect(
                stripped,
                `forbidden key "${key}" leaked into NousStateResponse shape`,
            ).not.toMatch(asTypeField);
        }
    });

    it('rendered AnankeSection DOM contains no numeric float literal', () => {
        mockLevels = singletonMap('hunger', 'high', 'rising');
        const { container } = render(<AnankeSection did="did:noesis:alpha" />);
        const html = container.innerHTML;
        expect(html).not.toMatch(/0\.[0-9]+/);
    });

    it('no title= attribute, data-value, or data-drive-raw on rendered DOM', () => {
        mockLevels = singletonMap('curiosity', 'high', 'falling');
        const { container } = render(<AnankeSection did="did:noesis:alpha" />);
        const html = container.innerHTML;
        expect(html).not.toMatch(/title="[^"]*0\.[0-9]+/);
        expect(html).not.toMatch(/\bdata-value=/);
        expect(html).not.toMatch(/\bdata-drive-raw=/);
        expect(container.querySelectorAll('[title]').length).toBe(0);
    });

    it('no wall-clock or timer in AnankeSection or useAnankeLevels source', () => {
        const componentPath = resolve(
            DASHBOARD,
            'src/app/grid/components/inspector-sections/ananke.tsx',
        );
        const hookPath = resolve(DASHBOARD, 'src/lib/hooks/use-ananke-levels.ts');
        expect(existsSync(componentPath)).toBe(true);
        expect(existsSync(hookPath)).toBe(true);

        for (const p of [componentPath, hookPath]) {
            const src = readFileSync(p, 'utf8');
            // Strip comments so doc prose can reference the forbidden APIs.
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

    it('repo-wide grep: no forbidden-key PROPERTY fields in dashboard/src/lib/api', () => {
        // Belt-and-suspenders: any future API wrapper that exposes a drive
        // float as a shape field would fail this gate.
        const out = execSync(
            `grep -rEn "\\b(hunger|curiosity|safety|boredom|loneliness|drive_value)\\s*\\??:" ` +
                `${DASHBOARD}/src/lib/api || true`,
            { encoding: 'utf8' },
        );
        expect(out.trim()).toBe('');
    });
});
