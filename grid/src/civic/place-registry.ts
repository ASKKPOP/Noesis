/**
 * Phase 60 HOUSE-3 (D-60-07 / R-60-09) — place:// NDS registry (Grid-side, tick-based).
 *
 * A NEW Grid-side naming registry that wires the dormant Phase 58 `namedAddress` field.
 * It is NOT the protocol `nous://` DomainRegistry: that registry names Nous identities and
 * keys its records on a WALLCLOCK `registeredAt` field. This registry names PLACES (parcels)
 * and keys every record on an integer `registered_tick` supplied by the Grid clock — NEVER
 * `Date.now()` and NEVER the protocol registry's `registeredAt`. The wallclock CI gate
 * (R-H-02) is honored: all timing here is tick-based.
 *
 * Uniqueness is enforced across the whole registry: a duplicate name throws
 * `place_name_taken`, which the HTTP route maps to 409. Raw place names stay Grid-side —
 * `place_name_taken`/`name_hash` discipline keeps the human-readable name off the audit
 * chain; only a `name_hash` would ever cross the boundary (no `*_name` payload key).
 */
import { createHash } from 'node:crypto';

/** The Grid this place registry serves (v3.0 ships 1 Grid — Genesis). */
const GRID = 'genesis';

/** A registered place record. Keyed on the integer `registered_tick` (NOT a wallclock). */
export interface PlaceRecord {
    /** The canonical place:// address, e.g. "place://aurora-cafe.genesis". */
    place_address: string;
    /** The parcel this place name is bound to. */
    parcel_id: string;
    /** The integer Grid tick at registration (tick-based — never Date.now / registeredAt). */
    registered_tick: number;
    /** SHA-256 hash of the raw name — the only form that may cross the boundary. */
    name_hash: string;
}

/** name → record (uniqueness) and parcel_id → record (reverse lookup for the dormant field). */
const byName = new Map<string, PlaceRecord>();
const byParcel = new Map<string, PlaceRecord>();

/**
 * Register `place://<name>.<grid>` for a parcel, keyed on the supplied integer tick.
 * Throws `place_name_taken` if the name is already registered (route → 409). The raw name
 * is hashed for any cross-boundary use; the place address is returned for the dormant
 * namedAddress field. Tick-based: it does NOT read the wallclock.
 */
export function registerPlace(name: string, parcel_id: string, tick: number): string {
    const existing = byName.get(name);
    if (existing) {
        // Re-naming the SAME parcel to the SAME name is idempotent (a no-op re-affirm).
        // A DIFFERENT parcel claiming an already-taken name is the conflict → 409.
        if (existing.parcel_id === parcel_id) return existing.place_address;
        throw new Error(`place_name_taken: ${name}`);
    }
    const place_address = `place://${name}.${GRID}`;
    const record: PlaceRecord = {
        place_address,
        parcel_id,
        registered_tick: tick,
        name_hash: createHash('sha256').update(name).digest('hex'),
    };
    byName.set(name, record);
    byParcel.set(parcel_id, record);
    return place_address;
}

/** Look up the place record bound to a parcel (reverse lookup). */
export function placeRecord(parcel_id: string): PlaceRecord {
    const record = byParcel.get(parcel_id);
    if (!record) throw new Error(`place_not_found: ${parcel_id}`);
    return { ...record };
}

/** Mirror a hydrated place record into memory on boot (ParcelStore.hydrate). */
export function upsertPlace(record: PlaceRecord): void {
    const name = record.place_address.replace(/^place:\/\//, '').replace(`.${GRID}`, '');
    byName.set(name, { ...record });
    byParcel.set(record.parcel_id, { ...record });
}
