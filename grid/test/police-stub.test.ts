import { describe, it } from 'vitest';

/**
 * Wave 0 TDD stubs — Police stub endpoint for marketplace disputes (D-44-05).
 *
 * Phase 44 ships a stub POST /police/disputes/:id/review endpoint that returns
 * 501 Not Implemented, preserving the route shape for Phase 47 implementation.
 *
 * These tests are deliberately skipped until Plan 02 adds the stub endpoint.
 * Remove .skip when the stub is in place.
 */

describe.skip('police stub — POST /police/disputes/:id/review (D-44-05)', () => {
    it('returns 501 Not Implemented for any dispute_id', () => {});
    it('response body contains { status: "not_implemented", phase: 47 }', () => {});
    it('emits no audit event (stub does not touch audit chain)', () => {});
    it('is accessible without authentication (stub, no sensitive action)', () => {});
    it('returns 501 even when dispute_id references a real dispute', () => {});
});
