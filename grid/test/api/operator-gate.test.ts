import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { OperatorGrant } from '../../src/api/preHandlers/operatorAuth.js';

const OPERATOR_DID = 'did:noesis:human:0xoperator';
const OP_ID = 'op:11111111-1111-4111-8111-111111111111';
const STRANGER_DID = 'did:noesis:human:0xstranger';

function buildApp(allow: Map<string, OperatorGrant>) {
  return buildServer({
    clock: new WorldClock({ tickRateMs: 100_000 }),
    space: new SpatialMap(),
    logos: new LogosEngine(),
    audit: new AuditChain(),
    gridName: 'genesis',
    operatorAllowlist: allow,
  });
}

async function cookie(did: string): Promise<string> {
  const { privateKey } = await keyPairPromise;
  return new SignJWT({ did, grid_name: 'genesis' })
    .setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
}

const ALLOW = new Map<string, OperatorGrant>([[OPERATOR_DID, { operatorId: OP_ID, tier: 5 }]]);
// A tier-5 route used as the probe. Body/target are irrelevant — we only assert the gate outcome.
const URL = '/api/v1/operator/nous/did:noesis:NONEXISTENT/delete';

describe('operator_only gate', () => {
  it('401 portal_session_required for an anonymous caller', async () => {
    const app = buildApp(ALLOW); await app.ready();
    const res = await app.inject({ method: 'POST', url: URL });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('portal_session_required');
    await app.close();
  });

  it('REGRESSION: 401 for forged x-operator-tier:5 + x-operator-id with NO session cookie (the closed hole)', async () => {
    const app = buildApp(ALLOW); await app.ready();
    const res = await app.inject({
      method: 'POST', url: URL,
      headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
    });
    expect(res.statusCode).toBe(401);
    expect(res.statusCode).not.toBe(200);
    await app.close();
  });

  it('403 not_operator for a logged-in DID that is not on the allowlist', async () => {
    const app = buildApp(ALLOW); await app.ready();
    const res = await app.inject({
      method: 'POST', url: URL,
      cookies: { [COOKIE_NAME]: await cookie(STRANGER_DID) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('not_operator');
    await app.close();
  });

  it('403 not_operator for an allowlisted operator when the allowlist is empty (fail-closed)', async () => {
    const app = buildApp(new Map()); await app.ready();
    const res = await app.inject({
      method: 'POST', url: URL,
      cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('not_operator');
    await app.close();
  });

  it('an allowlisted operator PASSES the gate (no gate-level rejection — reaches the handler)', async () => {
    const app = buildApp(ALLOW); await app.ready();
    const res = await app.inject({
      method: 'POST', url: URL,
      cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
    });
    // Gate rejections are portal_session_required (401) / not_operator (403). Any other
    // outcome means the gate passed and the handler ran. Asserting on the gate's error
    // codes (not the status) keeps this robust whether or not the probe handler has been
    // migrated off the header yet.
    expect(['portal_session_required', 'not_operator']).not.toContain(res.json().error);
    await app.close();
  });
});
