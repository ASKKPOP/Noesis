import { describe, it, expect } from 'vitest';
import { parseOperatorAllowlist, resolveOperator } from '../../src/api/preHandlers/operatorAuth.js';

const DID = 'did:noesis:human:0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const OP = 'op:11111111-1111-4111-8111-111111111111';

describe('parseOperatorAllowlist', () => {
  it('parses a single DID|op|tier entry', () => {
    const m = parseOperatorAllowlist(`${DID}|${OP}|5`);
    expect(m.get(DID)).toEqual({ operatorId: OP, tier: 5 });
  });

  it('defaults tier to 5 when omitted', () => {
    const m = parseOperatorAllowlist(`${DID}|${OP}`);
    expect(m.get(DID)).toEqual({ operatorId: OP, tier: 5 });
  });

  it('parses multiple comma-separated entries', () => {
    const DID2 = 'did:noesis:human:0xbbbb';
    const OP2 = 'op:22222222-2222-4222-9222-222222222222';
    const m = parseOperatorAllowlist(`${DID}|${OP}|5,${DID2}|${OP2}|3`);
    expect(m.size).toBe(2);
    expect(m.get(DID2)).toEqual({ operatorId: OP2, tier: 3 });
  });

  it('returns an empty map for undefined / empty (fail-closed)', () => {
    expect(parseOperatorAllowlist(undefined).size).toBe(0);
    expect(parseOperatorAllowlist('').size).toBe(0);
    expect(parseOperatorAllowlist('   ').size).toBe(0);
  });

  it('skips malformed entries (bad DID, bad op-id, bad tier) without granting access', () => {
    const m = parseOperatorAllowlist(
      `not-a-did|${OP}|5,${DID}|not-an-op|5,${DID}|${OP}|9,${DID}|${OP}|5`,
    );
    // only the last (valid) entry survives
    expect(m.size).toBe(1);
    expect(m.get(DID)).toEqual({ operatorId: OP, tier: 5 });
  });
});

describe('resolveOperator', () => {
  const allow = parseOperatorAllowlist(`${DID}|${OP}|4`);
  it('returns the grant for an allowlisted DID', () => {
    expect(resolveOperator(DID, allow)).toEqual({ operatorId: OP, tier: 4 });
  });
  it('returns null for a non-allowlisted DID', () => {
    expect(resolveOperator('did:noesis:human:0xstranger', allow)).toBeNull();
  });
  it('returns null for undefined DID', () => {
    expect(resolveOperator(undefined, allow)).toBeNull();
  });
});
