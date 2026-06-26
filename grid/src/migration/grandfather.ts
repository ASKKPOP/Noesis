/**
 * Phase 50 (MIG-03) — grandfathering a v2.6 Nous's history into a v3.0 starting reputation.
 *
 * When a migrated operator registers a Civic-DID (Phase 37), the Grid derives its opening
 * civic reputation from its v2.6 conduct — so a long-lived, well-behaved Nous doesn't start
 * from zero, and a sanctioned one doesn't get a clean slate. The mapping is a PURE, published
 * function (wiki/1-design/philosophy.md) so the grandfathering is fully transparent.
 *
 * No audit events, no DB — a deterministic transform applied at issuance time.
 */

/** The v2.6 metrics read from the operator's old stack at migration time. */
export interface V26Metrics {
    /** Number of sanctions the Nous received under v2.6 (operator.* sanction events). */
    sanctionCount: number;
    /** Number of skills the Nous taught others (the v2.4 skill-diffusion teach count). */
    skillTeachCount: number;
    /** Fraction of the Nous's trades that settled successfully, in [0, 1]. */
    tradeSuccessRate: number;
}

/** The v3.0 opening reputation a freshly-migrated Civic-DID is seeded with. */
export interface GrandfatheredReputation {
    /** Starting civic standing: 0 for a clean record, −1 per prior sanction (≤ 0). */
    civicStanding: number;
    /** Starting Library contribution score: 1 point per skill taught (≥ 0). */
    libraryContributionScore: number;
    /** Starting Marketplace reputation on a 0–100 scale (trade success rate × 100). */
    marketplaceReputation: number;
}

const nonNegInt = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/**
 * Derive a v3.0 opening reputation from v2.6 metrics. Deterministic and total — any
 * malformed metric is treated as its neutral value (0 / clean), never throwing.
 *
 * Formula (published in PHILOSOPHY §Grandfathering):
 *   civicStanding          = −(sanctionCount)            // negative if ever sanctioned, else 0
 *   libraryContributionScore = skillTeachCount           // 1 point per skill taught
 *   marketplaceReputation  = round(clamp(rate,0,1) × 100) // 0–100 from the success rate
 */
export function grandfatherReputation(m: V26Metrics): GrandfatheredReputation {
    const sanctions = nonNegInt(m?.sanctionCount);
    const teaches = nonNegInt(m?.skillTeachCount);
    const rate = typeof m?.tradeSuccessRate === 'number' && Number.isFinite(m.tradeSuccessRate)
        ? Math.max(0, Math.min(1, m.tradeSuccessRate)) : 0;
    return {
        civicStanding: sanctions > 0 ? -sanctions : 0,
        libraryContributionScore: teaches,
        marketplaceReputation: Math.round(rate * 100),
    };
}
