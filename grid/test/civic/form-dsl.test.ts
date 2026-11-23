/** Grid House Objects §6.2 — the Form DSL gate and bounds. */
import { describe, it, expect } from 'vitest';
import { FORM_GATE_CAPS, formBounds, validateFormDoc, type FormDoc } from '../../src/civic/form-dsl.js';

const FINISHES = new Set(['wood_dark', 'brushed_metal']);

/** The sheet's own example (§6.2), with its legs filled in. */
const DESK: FormDoc = {
    base: 'box', dims: [1.2, 0.6, 0.75], material: { color: '#5b4636', roughness: 0.7 },
    parts: [
        { base: 'cyl', dims: [0.05, 0.05, 0.72], at: [-0.55, -0.25, 0] },
        { base: 'box', dims: [0.4, 0.3, 0.02], at: [0.2, 0, 0.39], material: { emissive: '#46e0d0' } },
    ],
    label: 'Billing desk',
};

describe('Form DSL — gate', () => {
    it('accepts the sheet example', () => {
        expect(validateFormDoc(DESK, FINISHES)).toEqual([]);
    });

    it('accepts a finish from the catalog and refuses one that is not', () => {
        expect(validateFormDoc({ base: 'box', dims: [1, 1, 1], material: { finish: 'wood_dark' } }, FINISHES)).toEqual([]);
        expect(validateFormDoc({ base: 'box', dims: [1, 1, 1], material: { finish: 'gold' } }, FINISHES))
            .toEqual(['form.material.finish: not a catalog finish']);
    });

    it('refuses anything that is not a document', () => {
        for (const v of [null, 'box', 3, [], undefined]) expect(validateFormDoc(v, FINISHES)).toEqual(['form: must be an object']);
    });

    it('refuses unknown keys at every level — no script, no URL, no payload slips in', () => {
        expect(validateFormDoc({ ...DESK, script: 'x' }, FINISHES)).toContain('form.script: unknown key');
        expect(validateFormDoc({ ...DESK, parts: [{ ...DESK.parts![0], uri: 'http://x' }] }, FINISHES))
            .toContain('form.parts[0].uri: unknown key');
        expect(validateFormDoc({ ...DESK, material: { color: '#000000', texture: 'a.png' } }, FINISHES))
            .toContain('form.material.texture: unknown key');
    });

    it('refuses a base outside the closed set', () => {
        expect(validateFormDoc({ base: 'mesh', dims: [1, 1, 1] }, FINISHES)[0]).toMatch(/^form\.base: must be one of box, cyl/);
    });

    it('refuses dims that are missing, too small, too large, or not numbers', () => {
        expect(validateFormDoc({ base: 'box', dims: [1, 1] }, FINISHES)).toEqual(['form.dims: must be three numbers']);
        expect(validateFormDoc({ base: 'box', dims: [0, 1, 1] }, FINISHES)).toHaveLength(1);
        expect(validateFormDoc({ base: 'box', dims: [1, 1, FORM_GATE_CAPS.maxDim + 0.1] }, FINISHES)).toHaveLength(1);
        expect(validateFormDoc({ base: 'box', dims: [1, '1', 1] }, FINISHES)).toHaveLength(1);
        expect(validateFormDoc({ base: 'box', dims: [1, Number.NaN, 1] }, FINISHES)).toHaveLength(1);
    });

    it('refuses a part placed too far away', () => {
        const far = { base: 'box', dims: [1, 1, 1], parts: [{ base: 'box', dims: [1, 1, 1], at: [9, 0, 0] }] };
        expect(validateFormDoc(far, FINISHES)).toEqual([`form.parts[0].at[0]: must be a number from -8 to 8`]);
    });

    it('refuses colours that are not #rrggbb lower case, and roughness outside 0..1', () => {
        expect(validateFormDoc({ base: 'box', dims: [1, 1, 1], material: { color: 'red' } }, FINISHES)).toHaveLength(1);
        expect(validateFormDoc({ base: 'box', dims: [1, 1, 1], material: { color: '#FFFFFF' } }, FINISHES)).toHaveLength(1);
        expect(validateFormDoc({ base: 'box', dims: [1, 1, 1], material: { roughness: 1.5 } }, FINISHES)).toHaveLength(1);
    });

    it('refuses more parts than the cap, and nested parts', () => {
        const part = { base: 'box', dims: [0.1, 0.1, 0.1] };
        const many = { base: 'box', dims: [1, 1, 1], parts: Array(FORM_GATE_CAPS.maxParts + 1).fill(part) };
        expect(validateFormDoc(many, FINISHES)).toContain(`form.parts: at most ${FORM_GATE_CAPS.maxParts} parts`);
        const capped = { base: 'box', dims: [1, 1, 1], parts: Array(FORM_GATE_CAPS.maxParts).fill(part) };
        expect(validateFormDoc(capped, FINISHES)).toEqual([]);
        const nested = { base: 'box', dims: [1, 1, 1], parts: [{ ...part, parts: [part] }] };
        expect(validateFormDoc(nested, FINISHES)).toContain('form.parts[0].parts: unknown key');
    });

    it('refuses an empty or over-long label and a malformed seed', () => {
        expect(validateFormDoc({ ...DESK, label: '' }, FINISHES)).toHaveLength(1);
        expect(validateFormDoc({ ...DESK, label: 'x'.repeat(65) }, FINISHES)).toHaveLength(1);
        expect(validateFormDoc({ ...DESK, seed: 'sha256:abc' }, FINISHES)).toHaveLength(1);
        expect(validateFormDoc({ ...DESK, seed: `sha256:${'a'.repeat(64)}` }, FINISHES)).toEqual([]);
    });
});

describe('Form DSL — bounds', () => {
    it('a single part is its own size', () => {
        expect(formBounds({ base: 'box', dims: [1, 2, 3] })).toEqual([1, 2, 3]);
    });

    it('a part sticking out grows the box on that side only', () => {
        // Screen top at 0.39 + 0.01 = 0.40 over a root half-height of 0.375 → z from -0.375 to 0.40.
        expect(formBounds(DESK)).toEqual([1.2, 0.6, 0.775]);
    });

    it('gives the same answer every time (replay draws the same room)', () => {
        expect(formBounds(DESK)).toEqual(formBounds(JSON.parse(JSON.stringify(DESK))));
    });
});
