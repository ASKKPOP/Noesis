/**
 * Grid House Objects §14–§15 — the Genesis catalog (Tier 0, "pre-designed by the system").
 *
 * Covers: the counts the sheet names, parity with the reviewed draft YAML, the
 * placement rule, starter sets, the default form of every kind passing the form gate,
 * the environment filter, stable hashes, and immutability.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    ALGORITHMS, FINISHES, KINDS, MATERIALS, NOT_YET_PLACEABLE, SHELL_ELEMENTS, STARTER_SETS,
    GENESIS_CATALOG_VERSION, canonicalJson, catalogEnvironment, genesisCatalogEntries, genesisKind,
} from '../../src/civic/genesis-catalog.js';
import { validateFormDoc } from '../../src/civic/form-dsl.js';
import { createHash } from 'node:crypto';

const DRAFT = fileURLToPath(new URL('../../../docs/plans/2026-11-21-genesis-catalog-seed.draft.yaml', import.meta.url));

/** The ids of each top-level section of the draft, and each kind's class. Line-based: the draft is regular. */
function readDraft(): { ids: Record<string, string[]>; kindClass: Record<string, string> } {
    const ids: Record<string, string[]> = {};
    const kindClass: Record<string, string> = {};
    let section = '';
    let lastKind = '';
    for (const line of readFileSync(DRAFT, 'utf8').split('\n')) {
        const top = /^([a-z_]+):/.exec(line);
        if (top) { section = top[1]; ids[section] = []; continue; }
        const id = /^- id: (\S+)$/.exec(line);
        if (id) { ids[section].push(id[1]); lastKind = id[1]; continue; }
        const st = /^- structure: (\S+)$/.exec(line);
        if (st) { ids[section].push(st[1]); continue; }
        const cls = /^ {2}class: (\S+)$/.exec(line);
        if (cls && section === 'kinds') kindClass[lastKind] = cls[1];
    }
    return { ids, kindClass };
}

describe('Genesis catalog — Tier 0 contents', () => {
    it('has the counts the sheet names: 18 · 12 · 14 · 59 (18 mirror + 41 functional) · 20 · 4', () => {
        expect(MATERIALS).toHaveLength(18);
        expect(FINISHES).toHaveLength(12);
        expect(SHELL_ELEMENTS).toHaveLength(14);
        expect(KINDS).toHaveLength(59);
        expect(KINDS.filter((k) => k.class === 'mirror')).toHaveLength(18);
        expect(KINDS.filter((k) => k.class === 'functional')).toHaveLength(41);
        expect(ALGORITHMS).toHaveLength(20);
        expect(STARTER_SETS).toHaveLength(4);
    });

    it('matches the reviewed draft YAML id for id, in order, and kind for kind by class', () => {
        const { ids, kindClass } = readDraft();
        expect(MATERIALS.map((m) => m.id)).toEqual(ids.materials);
        expect(FINISHES.map((m) => m.id)).toEqual(ids.finishes);
        expect(SHELL_ELEMENTS.map((m) => m.id)).toEqual(ids.shell_elements);
        expect(KINDS.map((m) => m.id)).toEqual(ids.kinds);
        expect(ALGORITHMS.map((m) => m.id)).toEqual(ids.algorithms);
        expect(STARTER_SETS.map((m) => m.structure)).toEqual(ids.starter_sets);
        for (const k of KINDS) expect(k.class).toBe(kindClass[k.id]);
    });

    it('has no duplicate ids within a type and none across types', () => {
        const entries = genesisCatalogEntries('mars');
        expect(new Set(entries.map((e) => e.entryId)).size).toBe(entries.length);
    });

    it('mirror kinds declare no affordances; functional kinds declare at least one', () => {
        for (const k of KINDS) {
            if (k.class === 'mirror') expect(k.affordances).toHaveLength(0);
            else expect(k.affordances.length).toBeGreaterThan(0);
        }
    });

    it('every cross-reference resolves: shell materials, algorithm kinds, starter-set kinds', () => {
        const materials = new Set(MATERIALS.map((m) => m.id));
        for (const s of SHELL_ELEMENTS) for (const m of s.defaultMaterials) expect(materials.has(m), `${s.id} → ${m}`).toBe(true);
        for (const a of ALGORITHMS) expect(genesisKind(a.kind), `${a.id} → ${a.kind}`).toBeDefined();
        for (const s of STARTER_SETS) for (const k of s.kinds) expect(genesisKind(k), `${s.structure} → ${k}`).toBeDefined();
    });

    it('the 13 v1 kinds keep their class and affordances', () => {
        const v1: Record<string, [string, string[]]> = {
            bed: ['mirror', []], closet: ['mirror', []], shelf: ['mirror', []], kitchen: ['mirror', []],
            bathroom: ['mirror', []], decor: ['mirror', []],
            work_desk: ['functional', ['billing', 'accounting']], sim_board: ['functional', ['simulation']],
            meeting_table: ['functional', ['meeting']], game_table: ['functional', ['play']],
            task_board: ['functional', ['task_tracking']], skill_terminal: ['functional', ['skill_practice']],
            shop_counter: ['functional', ['sales']],
        };
        expect(KINDS.filter((k) => k.since === 'v1').map((k) => k.id).sort()).toEqual(Object.keys(v1).sort());
        for (const [id, [cls, aff]] of Object.entries(v1)) {
            expect(genesisKind(id)?.class).toBe(cls);
            expect(genesisKind(id)?.affordances).toEqual(aff);
        }
    });
});

describe('Genesis catalog — placement and starter sets', () => {
    it('every mirror kind is placeable; a functional kind with a new subsystem is not', () => {
        for (const k of KINDS) {
            if (k.class === 'mirror') expect(k.placeable, k.id).toBe(true);
            if (k.class === 'functional' && k.subsystemStatus === 'new') expect(k.placeable, k.id).toBe(false);
        }
    });

    it('exactly 8 kinds wait: the 7 functional kinds with a new subsystem, and display_case', () => {
        const waiting = KINDS.filter((k) => !k.placeable).map((k) => k.id).sort();
        expect(waiting).toEqual([...NOT_YET_PLACEABLE].sort());
        expect(waiting).toHaveLength(8);
        expect(KINDS.filter((k) => k.placeable)).toHaveLength(51);
    });

    it('starter sets offer only placeable kinds and leave out exactly the three the sheet names', () => {
        const left = new Set<string>();
        for (const s of STARTER_SETS) {
            for (const k of s.offered) expect(genesisKind(k)?.placeable, k).toBe(true);
            for (const k of s.kinds) if (!s.offered.includes(k)) left.add(k);
        }
        expect([...left].sort()).toEqual(['display_case', 'notice_board', 'storage_locker']);
        expect(STARTER_SETS.map((s) => [s.structure, s.offered.length])).toEqual([
            ['home', 8], ['shop', 3], ['workshop', 4], ['venue', 5],
        ]);
    });

    it('a mirror kind in a starter set only appears in the home set', () => {
        for (const s of STARTER_SETS) {
            if (s.structure === 'home') continue;
            for (const k of s.kinds) expect(genesisKind(k)?.class, `${s.structure} → ${k}`).toBe('functional');
        }
    });
});

describe('Genesis catalog — default forms (catalog v2)', () => {
    const finishIds = new Set(FINISHES.map((f) => f.id));

    it('every kind has a default form that passes the form gate', () => {
        for (const k of KINDS) expect(validateFormDoc(k.form, finishIds), k.id).toEqual([]);
    });

    it('every default form has a positive, room-sized bounding box', () => {
        for (const k of KINDS) {
            for (const n of k.bounds) {
                expect(n, k.id).toBeGreaterThan(0);
                expect(n, k.id).toBeLessThanOrEqual(3.5);
            }
        }
    });

    it('a desk on legs is as tall as it was asked to be', () => {
        expect(genesisKind('work_desk')!.bounds[2]).toBeGreaterThanOrEqual(0.75);
        expect(genesisKind('table')!.bounds).toEqual([1.2, 0.8, 0.75]);
    });
});

describe('Genesis catalog — seed rows', () => {
    it('names Tier 0 entries core:<id> at the catalog version, level standard', () => {
        for (const e of genesisCatalogEntries('earth_orbit')) {
            expect(e.entryId).toMatch(/^core:[a-z0-9_:]+$/);
            expect(e.tier).toBe(0);
            expect(e.version).toBe(GENESIS_CATALOG_VERSION);
            expect(e.level).toBe('standard');
            expect(e.bodyHash).toMatch(/^[0-9a-f]{64}$/);
        }
    });

    it('filters in-situ materials by environment: none in orbit, regolith on the Moon, both on Mars', () => {
        const mats = (env: 'earth_orbit' | 'moon' | 'mars') =>
            genesisCatalogEntries(env).filter((e) => e.type === 'material').map((e) => e.entryId);
        expect(mats('earth_orbit')).toHaveLength(16);
        expect(mats('moon')).toContain('core:sintered_regolith');
        expect(mats('moon')).not.toContain('core:sulfur_concrete');
        expect(mats('mars')).toEqual(expect.arrayContaining(['core:sintered_regolith', 'core:sulfur_concrete']));
        expect(mats('mars')).toHaveLength(18);
        // 16 + 12 + 14 + 59 + 20 + 4 = 125 rows in orbit.
        expect(genesisCatalogEntries('earth_orbit')).toHaveLength(125);
    });

    it('maps Grid environment names to catalog environments, Genesis by default', () => {
        expect(catalogEnvironment('Earth-orbit')).toBe('earth_orbit');
        expect(catalogEnvironment('Moon')).toBe('moon');
        expect(catalogEnvironment('Mars')).toBe('mars');
        expect(catalogEnvironment('anything else')).toBe('earth_orbit');
    });

    it('hashes are stable: the same body gives the same hash on every call', () => {
        const a = genesisCatalogEntries('earth_orbit');
        const b = genesisCatalogEntries('earth_orbit');
        expect(a.map((e) => e.bodyHash)).toEqual(b.map((e) => e.bodyHash));
    });

    it('no number in any body needs more than 6 decimals (a database prints it the same way back)', () => {
        const bad: string[] = [];
        const walk = (v: unknown, path: string): void => {
            if (typeof v === 'number' && Number(v.toFixed(6)) !== v) bad.push(`${path} = ${v}`);
            else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
            else if (v !== null && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
        };
        for (const e of genesisCatalogEntries('mars')) walk(e.body, e.entryId);
        expect(bad).toEqual([]);
    });

    it('canonical JSON does not depend on key order', () => {
        expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }));
    });
});

/**
 * The digest of every Tier 0 body at this version. A Grid that already seeded a version
 * refuses to boot if any of its bodies changes (catalog_tier0_drift), so a change here
 * MUST come with a new GENESIS_CATALOG_VERSION — and then a new pinned digest.
 */
const PINNED: Record<string, string> = {
    '1.0.0': 'f2163b5e5516c8e4b297605769266fdb1f92f8629798e11a5b3207a599d5fe9e',
};

describe('Genesis catalog — pinned per version', () => {
    it('the bodies of this version are the ones that were released (bump the version to change any)', () => {
        const digest = createHash('sha256')
            .update(genesisCatalogEntries('mars').map((e) => `${e.entryId}=${e.bodyHash}`).join('\n'))
            .digest('hex');
        expect(PINNED[GENESIS_CATALOG_VERSION], `no pinned digest for ${GENESIS_CATALOG_VERSION}`).toBeDefined();
        expect(digest).toBe(PINNED[GENESIS_CATALOG_VERSION]);
    });
});

describe('Genesis catalog — immutable within a version', () => {
    it('kinds, forms and starter sets are frozen', () => {
        const k = genesisKind('bed')!;
        expect(() => { (k as { placeable: boolean }).placeable = false; }).toThrow(TypeError);
        expect(() => { (k.form.dims as number[])[0] = 9; }).toThrow(TypeError);
        expect(() => { (KINDS as unknown[]).push({}); }).toThrow(TypeError);
        expect(() => { (STARTER_SETS[0].offered as string[]).push('x'); }).toThrow(TypeError);
        expect(() => { (MATERIALS[0] as { name: string }).name = 'x'; }).toThrow(TypeError);
    });
});
