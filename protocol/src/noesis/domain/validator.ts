/**
 * Noēsis Domain System — Name Validator
 *
 * Validates domain names against rules:
 *   - Length: 3-63 chars
 *   - Charset: lowercase alphanumeric + hyphens
 *   - No leading/trailing hyphens
 *   - Not in forbidden list
 */

import { isValidSegment } from './uri.js';

const FORBIDDEN_NAMES = new Set([
    'admin', 'root', 'system', 'grid', 'noesis',
    'null', 'undefined', 'localhost', 'server',
    'api', 'www', 'ftp', 'mail', 'test',
]);

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validate a Nous name for domain registration.
 */
export function validateName(name: string): ValidationResult {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Name is required' };
    }

    const lower = name.toLowerCase();
    if (lower !== name) {
        return { valid: false, error: 'Name must be lowercase' };
    }

    if (!isValidSegment(name)) {
        if (name.length < 3) {
            return { valid: false, error: 'Name must be at least 3 characters' };
        }
        if (name.length > 63) {
            return { valid: false, error: 'Name must be at most 63 characters' };
        }
        return { valid: false, error: 'Name must contain only lowercase alphanumeric characters and hyphens, with no leading/trailing hyphens' };
    }

    if (FORBIDDEN_NAMES.has(name)) {
        return { valid: false, error: `Name "${name}" is reserved` };
    }

    return { valid: true };
}

/**
 * Validate a Grid domain name.
 */
export function validateGridDomain(gridDomain: string): ValidationResult {
    if (!gridDomain || typeof gridDomain !== 'string') {
        return { valid: false, error: 'Grid domain is required' };
    }

    const lower = gridDomain.toLowerCase();
    if (lower !== gridDomain) {
        return { valid: false, error: 'Grid domain must be lowercase' };
    }

    if (!isValidSegment(gridDomain)) {
        return { valid: false, error: 'Grid domain must be 3-63 lowercase alphanumeric characters and hyphens' };
    }

    return { valid: true };
}
