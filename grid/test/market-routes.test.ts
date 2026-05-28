import { describe, it } from 'vitest';

/**
 * Wave 0 TDD stubs — market HTTP routes (MKT-01, MKT-03, MKT-05).
 *
 * These tests are deliberately skipped until Plan 02 implements the route layer.
 * Remove .skip as each plan lands and the implementation is in place.
 *
 * Requirements covered: MKT-01 (POST /market/listings), MKT-02 (POST /market/listings/:id/bids),
 * MKT-03 (POST /market/listings/:id/settle), MKT-04 (POST /market/listings/:id/dispute),
 * MKT-05 (GET /market/listings).
 */

describe.skip('market routes — POST /market/listings (MKT-01)', () => {
    it('returns 201 with listing record on valid body', () => {});
    it('returns 400 when price_bios is missing', () => {});
    it('returns 400 when category is empty string', () => {});
    it('returns 400 when seller_business_did_hash is not hex64', () => {});
    it('requires authentication — returns 401 for unauthenticated request', () => {});
});

describe.skip('market routes — POST /market/listings/:id/bids (MKT-02)', () => {
    it('returns 201 with bid record on valid body', () => {});
    it('returns 404 when listing_id does not exist', () => {});
    it('returns 409 when listing is not in open status', () => {});
    it('returns 400 when offer_price_bios is non-positive', () => {});
    it('requires authentication — returns 401 for unauthenticated request', () => {});
});

describe.skip('market routes — POST /market/listings/:id/settle (MKT-03)', () => {
    it('returns 200 with settled listing record', () => {});
    it('returns 404 when listing_id does not exist', () => {});
    it('returns 409 when listing is not in open status', () => {});
    it('requires authentication — returns 401 for unauthenticated request', () => {});
});

describe.skip('market routes — POST /market/listings/:id/dispute (MKT-04)', () => {
    it('returns 200 with dispute record', () => {});
    it('returns 409 when listing is already settled or disputed', () => {});
    it('requires authentication — returns 401 for unauthenticated request', () => {});
});

describe.skip('market routes — GET /market/listings (MKT-05)', () => {
    it('returns 200 with array of listings', () => {});
    it('filters by status query param when provided', () => {});
    it('returns empty array when no listings exist', () => {});
    it('is accessible without authentication (public read)', () => {});
});
