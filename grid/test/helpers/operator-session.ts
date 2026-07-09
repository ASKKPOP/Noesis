/**
 * Test helper — simulates the operator_only gate for per-route unit tests that
 * register a single handler on a bare Fastify instance (no global onRequest hook).
 * Install BEFORE registering the route so the preHandler applies. Sets the same
 * server-trusted fields the real gate sets (operatorTier + operatorId).
 *
 * End-to-end gate behavior (401/403, allowlist, forged-header regression) is
 * covered by grid/test/api/operator-gate.test.ts against the full buildServer.
 */
import type { FastifyInstance } from 'fastify';

/** Default fixture identity. Matches the `OPERATOR` constant used by legacy operator tests. */
export const TEST_OPERATOR_ID = 'op:11111111-1111-4111-8111-111111111111';
export const TEST_OPERATOR_DID = 'did:noesis:human:0xoperator';

export function withOperatorContext(
    app: FastifyInstance,
    opts?: { tier?: number; operatorId?: string; operatorDid?: string },
): void {
    const tier = opts?.tier ?? 5;
    const operatorId = opts?.operatorId ?? TEST_OPERATOR_ID;
    const operatorDid = opts?.operatorDid ?? TEST_OPERATOR_DID;
    app.addHook('preHandler', async (req) => {
        req.didContext = {
            did: operatorDid,
            tier: 'human_visitor',
            operatorDid,
            operatorTier: tier,
            operatorId,
        };
    });
}
