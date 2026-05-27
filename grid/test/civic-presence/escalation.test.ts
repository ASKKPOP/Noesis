import { describe, it, expect } from 'vitest';

describe('runEscalationCheck — SLEEP-04 + SLEEP-05', () => {
  it.skip('SLEEP-04: civic_did with last_seen_at > 30d → presence_status = absent', () => {});
  it.skip('SLEEP-04: absent escalation enqueues self-message into civic_message_queue from sender=system', () => {});
  it.skip('SLEEP-05: civic_did with last_seen_at > 365d → presence_status = presumed_departed', () => {});
  it.skip('SLEEP-05: presumed_departed sets frozen flag; subsequent action returns 409 civic_did_frozen (T-41-04)', () => {});
  it.skip('SLEEP-05: presumed_departed dissolves linked Business-DID via BusinessDidStore.markDissolved', () => {});
  it.skip('SLEEP-05: presumed_departed emits irs.disbursement_executed to audit chain with cause: presumed_departed (allowlist unchanged — audit-only)', () => {});
  it.skip('escalation reads last_seen_at from DB only; Brain cannot influence threshold via injected timestamp (T-41-03)', () => {});
});
