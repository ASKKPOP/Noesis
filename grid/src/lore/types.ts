/**
 * Lore Grid types — Phase 20 D-20-12.
 * Payload interfaces and EXPECTED_KEYS tuples for lore.contributed + lore.cited sole-producer emitters.
 *
 * 3-keys-not-5 invariant: Brain metadata carries 1-2 keys;
 * Grid injects contributor_did/citing_did + tick at emit time.
 *
 * Closed-tuple: EXPECTED_KEYS are alphabetically sorted to match Object.keys(payload).sort().
 */

export interface LoreContributedPayload {
    category_tag: string;    // alphabetical — locked by D-20-12
    content_hash: string;
    contributor_did: string;
    tick: number;
}

export interface LoreCitedPayload {
    citing_did: string;      // alphabetical — locked by D-20-12
    content_hash: string;
    tick: number;
}

/** Alphabetically sorted key tuples — locked by D-20-12. */
export const LORE_CONTRIBUTED_KEYS = [
    'category_tag', 'content_hash', 'contributor_did', 'tick',
] as const;

export const LORE_CITED_KEYS = [
    'citing_did', 'content_hash', 'tick',
] as const;

/** Default valid category tags — D-20-04. */
export const DEFAULT_LORE_CATEGORIES = new Set([
    'cultural',
    'historical',
    'observation',
    'synthesis',
] as const);

/**
 * Mutable at startup — GenesisLauncher overwrites from TOML lore_categories key (D-20-03).
 * Grid validates category_tag against this set at the appendLoreContributed boundary.
 */
export let VALID_LORE_CATEGORIES: Set<string> = new Set(DEFAULT_LORE_CATEGORIES);
