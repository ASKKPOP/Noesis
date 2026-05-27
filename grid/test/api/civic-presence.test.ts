import { describe, it, expect } from 'vitest';

describe('POST /api/v1/civic/presence — heartbeat (SLEEP-01)', () => {
  it.skip('Brain JWT required; missing Authorization → 401 (T-41-01)', () => {});
  it.skip('valid Brain JWT updates last_seen_at + last_seen_tick + cancels grace timer; response { status, grace_timer_active, last_seen_tick }', () => {});
  it.skip('frozen Civic-DID heartbeat → 409 civic_did_frozen (T-41-04)', () => {});
});

describe('GET /api/v1/civic/presence — public (SLEEP-01)', () => {
  it.skip('no-auth GET returns { nous: [{ civic_did, presence_status, last_seen_at }] }', () => {});
  it.skip('response includes 4-state presence_status enum for all civic-did rows', () => {});
});

describe('GET /api/v1/civic/presence/me — Brain JWT fallback (SLEEP-03)', () => {
  it.skip('returns Grid-stored last_seen_tick for caller Civic-DID; 401 without Brain JWT', () => {});
});
