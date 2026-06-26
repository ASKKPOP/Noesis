/**
 * Phase 48 Library v3 Plan 2 (CIVLIB-03) — curation council payload contracts.
 * Curator DIDs are HASHED on the audit chain (raw DIDs live in library_curators).
 * Closed-tuple payloads, keys alphabetical.
 */

/** The four curation actions a council member may take on an entry. */
export type CurateAction = 'pin' | 'flag' | 'categorize' | 'link';
export const CURATE_ACTIONS: readonly CurateAction[] = ['pin', 'flag', 'categorize', 'link'];

/** library.curator_elected — a curator joins the council (Government-enacted election). */
export interface LibraryCuratorElectedPayload {
    readonly curator_did_hash: string;   // HEX64 — sha256(curator civicDid)
    readonly term_end_tick: number;
    readonly term_start_tick: number;
}
export const LIBRARY_CURATOR_ELECTED_KEYS = ['curator_did_hash', 'term_end_tick', 'term_start_tick'] as const;

/** library.entry_curated — a curator pins / flags / re-categorises / links an entry. */
export interface LibraryEntryCuratedPayload {
    readonly action: CurateAction;
    readonly curator_did_hash: string;   // HEX64
    readonly entry_id: string;           // UUID
    readonly tick: number;
}
export const LIBRARY_ENTRY_CURATED_KEYS = ['action', 'curator_did_hash', 'entry_id', 'tick'] as const;
