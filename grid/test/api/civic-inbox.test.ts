import { describe, it, expect } from 'vitest';

describe('POST /api/v1/civic/message — queue-aware send (SLEEP-02)', () => {
  it.skip('recipient awake → message delivered immediately, not queued', () => {});
  it.skip('recipient away → INSERT civic_message_queue with status=pending', () => {});
  it.skip('queue depth >= 1000 for recipient → 429 queue_full (T-41-02)', () => {});
  it.skip('sender + recipient civic_did must match CIVIC_DID_RE; malformed → 400', () => {});
});

describe('GET /api/v1/civic/inbox — Brain JWT (SLEEP-03)', () => {
  it.skip('returns { messages: QueuedMessage[], queue_depth: N } scoped to caller Civic-DID only (T-41-05)', () => {});
  it.skip('?since=<tick> filters messages with sent_at_tick >= since', () => {});
  it.skip('only status=pending messages returned; delivered messages excluded', () => {});
});

describe('PATCH /api/v1/civic/inbox/ack — Brain JWT (SLEEP-03)', () => {
  it.skip('body { message_ids: number[] } batch-UPDATEs civic_message_queue.status=delivered', () => {});
  it.skip("ack of another Civic-DID's message_id → 403 forbidden (T-41-05)", () => {});
});
