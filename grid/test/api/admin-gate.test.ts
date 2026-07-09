/**
 * SECURITY 2026-07-09 — admin/* routes derive operator tier from the server-trusted
 * allowlist (req.didContext.operatorDid ∈ GRID_OPERATOR_DIDS), NOT from the spoofable
 * x-operator-tier/-id headers. Admin routes stay behind GRID_ADMIN_ENABLED.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
const ALLOW = new Map<string, OperatorGrant>([[OPERATOR_DID, { operatorId: OP_ID, tier: 5 }]]);

function buildApp() {
  return buildServer({
    clock: new WorldClock({ tickRateMs: 100_000 }),
    space: new SpatialMap(),
    logos: new LogosEngine(),
    audit: new AuditChain(),
    gridName: 'genesis',
    operatorAllowlist: ALLOW,
  });
}

async function cookie(did: string): Promise<string> {
  const { privateKey } = await keyPairPromise;
  return new SignJWT({ did, grid_name: 'genesis' })
    .setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
}

describe('admin/* server-trusted gate (GRID_ADMIN_ENABLED=true)', () => {
  const PRIOR = process.env.GRID_ADMIN_ENABLED;
  beforeAll(() => { process.env.GRID_ADMIN_ENABLED = 'true'; });
  afterAll(() => { process.env.GRID_ADMIN_ENABLED = PRIOR; });

  it('REGRESSION: forged x-operator-tier:5 with NO operator session is rejected (403 not_operator)', async () => {
    const app = buildApp(); await app.ready();
    const res = await app.inject({
      method: 'GET', url: '/api/v1/admin/config',
      headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('not_operator');
    await app.close();
  });

  it('403 not_operator for a logged-in DID that is not on the allowlist', async () => {
    const app = buildApp(); await app.ready();
    const res = await app.inject({
      method: 'GET', url: '/api/v1/admin/config',
      cookies: { [COOKIE_NAME]: await cookie(STRANGER_DID) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('not_operator');
    await app.close();
  });

  it('an allowlisted operator PASSES the gate (no gate-level rejection)', async () => {
    const app = buildApp(); await app.ready();
    const res = await app.inject({
      method: 'GET', url: '/api/v1/admin/config',
      cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
    });
    // Gate passed → handler ran (may 500 on missing .env in this env). Never a gate rejection.
    expect(['not_operator', 'tier_too_low', 'admin_disabled']).not.toContain(res.json().error);
    await app.close();
  });
});

describe('admin/* stays gated by GRID_ADMIN_ENABLED', () => {
  const PRIOR = process.env.GRID_ADMIN_ENABLED;
  beforeAll(() => { delete process.env.GRID_ADMIN_ENABLED; });
  afterAll(() => { process.env.GRID_ADMIN_ENABLED = PRIOR; });

  it('denies admin config for a valid operator when the flag is off (no config leaked)', async () => {
    const app = buildApp(); await app.ready();
    const res = await app.inject({
      method: 'GET', url: '/api/v1/admin/config',
      cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
    });
    // Flag off → the admin surface is unreachable. The exact denial code (401 from the
    // default-deny hook on the disabled catch-all, or 503 admin_disabled) is pre-existing
    // behavior; the invariant this asserts is: not served, no config body.
    expect(res.statusCode).not.toBe(200);
    expect(res.json().config).toBeUndefined();
    await app.close();
  });
});
