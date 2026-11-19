/**
 * grid-picker — which Grids the orbital map's picker lists (D-V3-41).
 *
 * The Portal map shows every Grid: the ones in the live Grid registry
 * (GET /api/v1/portal/grids) plus the scene's frontier worlds (Moon, Mars —
 * defined empty base Grids awaiting charter, D-NH-13) that are not registered yet.
 * A private Grid the viewer is not a member of is listed with a lock.
 */

export interface PortalGrid {
    grid_id: string;
    name: string;
    status: string;
    visibility: 'public' | 'private';
    member: boolean;
    locked: boolean;
    /** Sent for a Grid the viewer may see in full (not for a locked private Grid). */
    polis?: string;
    description?: string;
    grid_domain?: string;
    celestial_body?: string;
}

export interface PickerEntry {
    /** Grid name — also the scene's camera-focus key. */
    name: string;
    /** Registry id (e.g. 'genesis') — only for a Grid in the live registry. */
    gridId?: string;
    label: string;
    /** In the live Grid registry (false = a frontier world awaiting charter). */
    registered: boolean;
    member: boolean;
    locked: boolean;
}

/** Worlds the scene itself draws; shown even before a Grid is chartered there. */
const SCENE_GRIDS = ['Genesis', 'Moon', 'Mars'];

const label = (name: string, locked: boolean): string =>
    `${locked ? '🔒 ' : ''}${name === 'Genesis' ? name : `${name} Grid`}`;

/** `grids` is null while the registry feed is loading or unreachable. */
export function pickerEntries(grids: PortalGrid[] | null): PickerEntry[] {
    // The registry may spell a name differently from the scene ("genesis" / "Genesis");
    // it is the same Grid, and the scene's spelling is the camera-focus key.
    const sceneName = (n: string): string => SCENE_GRIDS.find((s) => s.toLowerCase() === n.toLowerCase()) ?? n;
    const registered = (grids ?? []).map((g): PickerEntry => {
        const name = sceneName(g.name);
        return { name, gridId: g.grid_id, label: label(name, g.locked), registered: true, member: g.member, locked: g.locked };
    });
    const have = new Set(registered.map((e) => e.name));
    const frontier = SCENE_GRIDS.filter((n) => !have.has(n)).map((n): PickerEntry => ({
        name: n, label: label(n, false), registered: false, member: false, locked: false,
    }));
    const all = [...registered, ...frontier];
    // Keep the scene's own order (Genesis, Moon, Mars) first; any further Grids follow.
    const rank = (n: string): number => { const i = SCENE_GRIDS.indexOf(n); return i === -1 ? SCENE_GRIDS.length : i; };
    return all.sort((a, b) => rank(a.name) - rank(b.name));
}
