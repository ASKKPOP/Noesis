/**
 * Phase 60 HOUSE-3 · Wave 5 — Council ring-expansion bill TEMPLATE
 * (D-60-08 / D-NH-09/13 / R-60-10).
 *
 * This is a TEMPLATE, NOT a new governance path. It CONSUMES the EXISTING Phase 46
 * `gov.law_enacted` event: bill drafting → co-sponsorship → VOTE-05 → `gov.law_enacted`
 * is reused VERBATIM. `onLawEnacted` is the fire-and-forget hook the governance dispatch
 * calls with each enacted bill's body; the template fires ONLY on its own body shapes and
 * IGNORES everything else (so an ordinary law enactment is untouched).
 *
 * Body shapes the template recognises (parsed Grid-side from the bill body):
 *
 *   1. {action:'seed_ring', ring:N}
 *      Seed ring N at frontier prices via the Phase 58 `seedZone` + gravity-price formula.
 *      IDEMPOTENT (INSERT IGNORE): if `deps.alreadySeeded(ring)` is true the seed is a
 *      no-op (re-enacting the same ring adds no duplicate parcels).
 *      Emits NO audit event — ring seeding is world-creation per Phase 58. NO new allowlist
 *      member is added by this template.
 *
 *   2. {action:'amend_law'|'amend_constant', key:..., value:...}
 *      Record a Polis override of a founding-law constant (UPKEEP_RATE_BPS / ZONE_TAX_BPS).
 *      The founding-law read-through indirection (getUpkeepRateBps / getZoneTaxBps) picks it
 *      up; the constants remain the DEFAULT FALLBACK (single patch point preserved).
 *
 *   Any other body shape is IGNORED — the template only fires on its own shapes.
 *
 * VOTE-05 Nous-only invariant + tamper-evident audit (R-31-01) are preserved: this module
 * neither votes nor appends to the chain. No `clock.onTick` — the hook is event-driven off
 * the existing governance dispatch (single-onTick R-H-03 preserved).
 */

/** The closed set of constants a Polis amendment bill may override (D-NH-03 amendability). */
export type AmendableConstantKey = 'UPKEEP_RATE_BPS' | 'ZONE_TAX_BPS';

/**
 * Dependencies the governance dispatch injects (and tests stub with pure spies).
 * Every field is optional so a caller may wire only what a given bill needs; a missing
 * dep simply makes the corresponding action a no-op rather than throwing.
 */
export interface RingExpansionDeps {
    /** Phase 58 seeder: add the legislated ring at frontier prices (gravity formula). */
    seedZone?: (ring: number) => void;
    /** Idempotency guard: true when ring N is already seeded (INSERT IGNORE semantics). */
    alreadySeeded?: (ring: number) => boolean;
    /** Record a Polis override of a founding-law constant (read-through indirection). */
    amendConstant?: (key: string, value: number) => void;
    /**
     * Audit chain seam — present ONLY so a test can assert NO append happens. The template
     * NEVER calls anything on it (ring seeding is world-creation; amendments emit nothing).
     */
    audit?: unknown;
}

/** The (deliberately permissive) shape of a parsed bill body the template inspects. */
interface EnactedBillBody {
    action?: unknown;
    ring?: unknown;
    key?: unknown;
    value?: unknown;
}

/** Parse a bill body that may arrive as a JSON string (Phase 46 stores body_text). */
function parseBody(billBody: unknown): EnactedBillBody | null {
    if (billBody == null) return null;
    if (typeof billBody === 'string') {
        try {
            const parsed: unknown = JSON.parse(billBody);
            return parsed && typeof parsed === 'object' ? (parsed as EnactedBillBody) : null;
        } catch {
            return null; // non-JSON law text — not a template bill, ignore.
        }
    }
    if (typeof billBody === 'object') return billBody as EnactedBillBody;
    return null;
}

/**
 * The template hook the governance dispatch fire-and-forgets at the EXISTING
 * `gov.law_enacted` dispatch. Fires only on the template's own body shapes; otherwise no-op.
 */
export function onLawEnacted(billBody: unknown, deps: RingExpansionDeps): void {
    const body = parseBody(billBody);
    if (!body || typeof body.action !== 'string') return;

    if (body.action === 'seed_ring') {
        const ring = body.ring;
        if (typeof ring !== 'number' || !Number.isInteger(ring) || ring < 0) return;
        // Idempotent (INSERT IGNORE): skip if this ring is already seeded.
        if (deps.alreadySeeded?.(ring)) return;
        deps.seedZone?.(ring);
        // NO audit emit — ring seeding is world-creation (Phase 58). NO allowlist member added.
        return;
    }

    if (body.action === 'amend_law' || body.action === 'amend_constant') {
        const key = body.key;
        const value = body.value;
        if (typeof key !== 'string' || typeof value !== 'number') return;
        // Record the Polis override; the founding-law read-through indirection picks it up.
        // Constants remain the default fallback (single patch point preserved).
        deps.amendConstant?.(key, value);
        return;
    }

    // Any other body shape is ignored — the template is NOT a new governance path.
}
