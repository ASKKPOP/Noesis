/**
 * grid-host — the Grid's own web address (D-V3-41 / surfaces re-plan G1).
 *
 * A Grid is entered at grid.<domain>/<grid> (e.g. grid.noesiis.com/genesis), reached
 * from the Portal. The same dashboard app serves both hosts: on the grid host a
 * single-segment path is the Grid's name and is served by the /g/[grid] entry page.
 */
import type { PortalGrid } from '@/components/worldmap/grid-picker';

/** App routes that must never be read as a Grid name on the grid host. */
const RESERVED = new Set(['g', 'grid', 'portal', 'about', 'api', 'apply', 'nous', 'system', 'system-map', 'worldmap', 'docs', 'wiki']);

/** The internal path to serve for `pathname` on `host`, or null to leave it alone. */
export function gridHostRewrite(host: string | null | undefined, pathname: string): string | null {
    if (!host || !host.toLowerCase().startsWith('grid.')) return null;
    const m = /^\/([A-Za-z0-9][A-Za-z0-9-]*)\/?$/.exec(pathname);
    if (!m) return null;
    const name = m[1].toLowerCase();
    if (RESERVED.has(name)) return null;
    return `/g/${name}`;
}

/** Where "Enter <Grid>" leads: the Grid host when configured, else this origin. */
export function gridEntryHref(gridId: string, gridHost: string | undefined): string {
    return gridHost ? `https://${gridHost}/${gridId}` : `/g/${gridId}`;
}

export type GridEntryState =
    | { kind: 'loading' }
    | { kind: 'unreachable' }
    | { kind: 'unknown' }
    | { kind: 'members_only'; grid: PortalGrid }
    | { kind: 'open'; grid: PortalGrid };

/** `grids`: undefined = still loading, null = the registry could not be reached. */
export function gridEntryState(grids: PortalGrid[] | null | undefined, gridId: string): GridEntryState {
    if (grids === undefined) return { kind: 'loading' };
    if (grids === null) return { kind: 'unreachable' };
    const grid = grids.find((g) => g.grid_id === gridId.toLowerCase());
    if (!grid) return { kind: 'unknown' };
    return grid.locked ? { kind: 'members_only', grid } : { kind: 'open', grid };
}
