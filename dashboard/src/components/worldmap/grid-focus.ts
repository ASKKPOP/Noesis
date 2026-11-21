/**
 * grid-focus — how far the orbital map's camera stands from a Grid so the Grid fills
 * the view ("full zoom").
 *
 * A Grid is a ring system seen from above at an angle: as wide as its radius, and
 * about `FLATTEN` of that tall on screen. The camera stands at whichever distance
 * the tighter of the two needs, so the Grid fills the view on a wide window and still
 * fits on a narrow one.
 */

/** A little air around the Grid. */
const MARGIN = 1.08;
/** On-screen height of a tilted ring system, as a share of its radius. */
const FLATTEN = 0.6;

export function fitDistance(radius: number, fovDeg: number, aspect: number): number {
    const tanV = Math.tan((fovDeg * Math.PI) / 360);
    const tanH = tanV * aspect;
    return Math.max((radius * MARGIN) / tanH, (radius * MARGIN * FLATTEN) / tanV);
}
