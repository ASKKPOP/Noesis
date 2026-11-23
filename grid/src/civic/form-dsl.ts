/**
 * Form DSL v0 — how a furnishing looks, as data (Grid House Objects sheet §6.2).
 *
 * A form is a small, closed JSON document. It is never code: every key is from a
 * closed list, every value is a number, a colour, a finish id or a short label, and
 * a label is treated as data by every reader (A11e). The same document always
 * yields the same shape, so a replay redraws the same room.
 *
 * Geometry. Units are metres, z is up. A document is one root part plus up to
 * MAX_PARTS child parts. `dims` is the full size [x, y, z] of a part's bounding box
 * whatever its base; `at` is the centre of a child part relative to the root's
 * centre (the root sits at [0, 0, 0]). Children have no children of their own.
 *
 * The closed base set matches GEO_BASES in grid-viz object-gen.js, so one compiler
 * can serve the orbital map and interiors.
 *
 * The caps below are the starting point the sheet names for the form gate (Q8); this
 * gate covers the DSL only. A GLB path, with its own caps, is a later phase.
 */

export const FORM_BASES = Object.freeze([
    'box', 'cyl', 'sphere', 'icosa', 'octa', 'tetra', 'dodeca', 'torusknot',
] as const);
export type FormBase = typeof FORM_BASES[number];

/** Form-gate caps for a DSL document. */
export const FORM_GATE_CAPS = Object.freeze({
    maxParts: 24,
    /** Smallest and largest size of any part along one axis, in metres. */
    minDim: 0.01,
    maxDim: 8,
    /** Largest distance of a part's centre from the root's centre along one axis. */
    maxOffset: 8,
    maxLabelLength: 64,
    /** Size of the document as compact JSON, in bytes. */
    maxBytes: 4096,
});

export interface FormMaterial {
    /** A finish id from the catalog; colour fields given here override it. */
    readonly finish?: string;
    readonly color?: string;
    readonly roughness?: number;
    readonly metalness?: number;
    readonly emissive?: string;
}

export interface FormPart {
    readonly base: FormBase;
    readonly dims: readonly [number, number, number];
    readonly at?: readonly [number, number, number];
    readonly material?: FormMaterial;
}

export interface FormDoc {
    readonly base: FormBase;
    readonly dims: readonly [number, number, number];
    readonly material?: FormMaterial;
    readonly parts?: readonly FormPart[];
    readonly label?: string;
    readonly seed?: string;
}

/** Axis-aligned extent of a form: [x, y, z] size in metres. */
export type FormBounds = readonly [number, number, number];

const HEX_COLOUR = /^#[0-9a-f]{6}$/;
const SEED = /^sha256:[0-9a-f]{64}$/;
const DOC_KEYS = new Set(['base', 'dims', 'material', 'parts', 'label', 'seed']);
const PART_KEYS = new Set(['base', 'dims', 'at', 'material']);
const MATERIAL_KEYS = new Set(['finish', 'color', 'roughness', 'metalness', 'emissive']);

function isObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function unknownKeys(o: Record<string, unknown>, allowed: Set<string>): string[] {
    return Object.keys(o).filter((k) => !allowed.has(k));
}

function checkTriple(v: unknown, path: string, min: number, max: number, errors: string[]): void {
    if (!Array.isArray(v) || v.length !== 3) {
        errors.push(`${path}: must be three numbers`);
        return;
    }
    v.forEach((n, i) => {
        if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) {
            errors.push(`${path}[${i}]: must be a number from ${min} to ${max}`);
        }
    });
}

function checkMaterial(v: unknown, path: string, finishIds: ReadonlySet<string>, errors: string[]): void {
    if (!isObject(v)) {
        errors.push(`${path}: must be an object`);
        return;
    }
    for (const k of unknownKeys(v, MATERIAL_KEYS)) errors.push(`${path}.${k}: unknown key`);
    if (v.finish !== undefined && (typeof v.finish !== 'string' || !finishIds.has(v.finish))) {
        errors.push(`${path}.finish: not a catalog finish`);
    }
    for (const k of ['color', 'emissive'] as const) {
        if (v[k] !== undefined && (typeof v[k] !== 'string' || !HEX_COLOUR.test(v[k] as string))) {
            errors.push(`${path}.${k}: must be #rrggbb in lower case`);
        }
    }
    for (const k of ['roughness', 'metalness'] as const) {
        const n = v[k];
        if (n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)) {
            errors.push(`${path}.${k}: must be a number from 0 to 1`);
        }
    }
}

function checkBase(v: unknown, path: string, errors: string[]): void {
    if (typeof v !== 'string' || !(FORM_BASES as readonly string[]).includes(v)) {
        errors.push(`${path}: must be one of ${FORM_BASES.join(', ')}`);
    }
}

/**
 * The form gate for a DSL document. Returns every reason it is refused; an empty
 * list means the document may be stored and drawn. Nothing is coerced or repaired.
 */
export function validateFormDoc(doc: unknown, finishIds: ReadonlySet<string>): string[] {
    const errors: string[] = [];
    if (!isObject(doc)) return ['form: must be an object'];
    for (const k of unknownKeys(doc, DOC_KEYS)) errors.push(`form.${k}: unknown key`);
    checkBase(doc.base, 'form.base', errors);
    checkTriple(doc.dims, 'form.dims', FORM_GATE_CAPS.minDim, FORM_GATE_CAPS.maxDim, errors);
    if (doc.material !== undefined) checkMaterial(doc.material, 'form.material', finishIds, errors);
    if (doc.label !== undefined
        && (typeof doc.label !== 'string' || doc.label.length === 0 || doc.label.length > FORM_GATE_CAPS.maxLabelLength)) {
        errors.push(`form.label: must be 1 to ${FORM_GATE_CAPS.maxLabelLength} characters`);
    }
    if (doc.seed !== undefined && (typeof doc.seed !== 'string' || !SEED.test(doc.seed))) {
        errors.push('form.seed: must be sha256:<64 lower-case hex>');
    }
    if (doc.parts !== undefined) {
        if (!Array.isArray(doc.parts)) {
            errors.push('form.parts: must be a list');
        } else {
            if (doc.parts.length > FORM_GATE_CAPS.maxParts) {
                errors.push(`form.parts: at most ${FORM_GATE_CAPS.maxParts} parts`);
            }
            doc.parts.forEach((p, i) => {
                const path = `form.parts[${i}]`;
                if (!isObject(p)) {
                    errors.push(`${path}: must be an object`);
                    return;
                }
                for (const k of unknownKeys(p, PART_KEYS)) errors.push(`${path}.${k}: unknown key`);
                checkBase(p.base, `${path}.base`, errors);
                checkTriple(p.dims, `${path}.dims`, FORM_GATE_CAPS.minDim, FORM_GATE_CAPS.maxDim, errors);
                if (p.at !== undefined) {
                    checkTriple(p.at, `${path}.at`, -FORM_GATE_CAPS.maxOffset, FORM_GATE_CAPS.maxOffset, errors);
                }
                if (p.material !== undefined) checkMaterial(p.material, `${path}.material`, finishIds, errors);
            });
        }
    }
    if (errors.length === 0 && Buffer.byteLength(JSON.stringify(doc), 'utf8') > FORM_GATE_CAPS.maxBytes) {
        errors.push(`form: larger than ${FORM_GATE_CAPS.maxBytes} bytes`);
    }
    return errors;
}

/** Round to the millimetre, so bounds never carry floating-point noise. */
const mm = (n: number): number => Math.round(n * 1000) / 1000;

/** The axis-aligned size of a valid form: the union of the root and every part. */
export function formBounds(doc: FormDoc): FormBounds {
    const lo = [-doc.dims[0] / 2, -doc.dims[1] / 2, -doc.dims[2] / 2];
    const hi = [doc.dims[0] / 2, doc.dims[1] / 2, doc.dims[2] / 2];
    for (const p of doc.parts ?? []) {
        const at = p.at ?? [0, 0, 0];
        for (let a = 0; a < 3; a++) {
            lo[a] = Math.min(lo[a], at[a] - p.dims[a] / 2);
            hi[a] = Math.max(hi[a], at[a] + p.dims[a] / 2);
        }
    }
    return [mm(hi[0] - lo[0]), mm(hi[1] - lo[1]), mm(hi[2] - lo[2])];
}
