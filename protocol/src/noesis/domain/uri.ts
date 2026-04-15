/**
 * Noēsis Domain System — URI Parser & Builder
 *
 * Format: nous://name.grid_domain
 *
 * Rules:
 *   - name: 3-63 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen
 *   - grid_domain: 3-63 chars, same rules as name
 *   - Total URI: max 131 chars (nous:// + name + . + grid_domain)
 */

import type { NousAddress } from './types.js';

export const NOUS_SCHEME = 'nous://';
export const MIN_SEGMENT_LENGTH = 3;
export const MAX_SEGMENT_LENGTH = 63;
export const MAX_URI_LENGTH = 131;

// Lowercase alphanumeric + hyphens, no leading/trailing hyphen
const SEGMENT_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Parse a nous:// URI into its components.
 * Returns null if the URI is invalid.
 */
export function parseNousUri(uri: string): NousAddress | null {
    if (!uri.startsWith(NOUS_SCHEME)) return null;
    if (uri.length > MAX_URI_LENGTH) return null;

    const path = uri.slice(NOUS_SCHEME.length);
    const dotIndex = path.indexOf('.');
    if (dotIndex === -1) return null;

    const name = path.slice(0, dotIndex);
    const gridDomain = path.slice(dotIndex + 1);

    // No additional dots allowed
    if (gridDomain.includes('.')) return null;

    if (!isValidSegment(name) || !isValidSegment(gridDomain)) return null;

    return {
        name,
        gridDomain,
        fullAddress: uri,
    };
}

/**
 * Build a nous:// URI from name and grid domain.
 * Returns null if the resulting URI would be invalid.
 */
export function buildNousUri(name: string, gridDomain: string): string | null {
    if (!isValidSegment(name) || !isValidSegment(gridDomain)) return null;

    const uri = `${NOUS_SCHEME}${name}.${gridDomain}`;
    if (uri.length > MAX_URI_LENGTH) return null;

    return uri;
}

/**
 * Validate a single segment (name or grid_domain).
 */
export function isValidSegment(segment: string): boolean {
    if (segment.length < MIN_SEGMENT_LENGTH) return false;
    if (segment.length > MAX_SEGMENT_LENGTH) return false;
    return SEGMENT_REGEX.test(segment);
}
