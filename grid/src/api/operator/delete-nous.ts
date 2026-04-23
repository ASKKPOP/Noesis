/**
 * Operator delete: POST /api/v1/operator/nous/:did/delete.
 *
 * Phase 8 AGENCY-05 — H5 Sovereign Operations. The sole route that
 * tombstones a Nous, despawns it from the spatial map, and emits an
 * operator.nous_deleted audit event.
 *
 * ERROR LADDER (D-33 — no 500s):
 *   400 — malformed tier (not 'H5') or malformed operator_id
 *   400 — malformed DID
 *   410 — DID already tombstoned (tombstoneCheck gate)
 *   404 — DID unknown to registry
 *   503 — Brain RPC failure (unreachable, timeout, malformed body)
 *   200 — success
 *
 * D-30 ORDER (LOCKED):
 *   1. registry.tombstone(did, tick, space)   — soft-delete in registry
 *   2. coordinator.despawnNous(did)            — remove from coord + space
 *   3. appendNousDeleted(audit, ...)           — emit audit event
 *
 * SC#3 invariant: on 503 (Brain failure) the tombstone MUST NOT fire.
 * The Brain fetch happens BEFORE step 1.
 *
 * See: 08-CONTEXT D-30, D-33, SC#3.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
import type { SpatialMap } from '../../space/map.js';
import { validateTierBody, type OperatorBody } from './_validation.js';
import { tombstoneCheck, TombstonedDidError } from '../../registry/tombstone-check.js';
import { appendNousDeleted } from '../../audit/append-nous-deleted.js';
import { appendBiosDeath } from '../../bios/index.js';
import { combineStateHash } from '../../audit/state-hash.js';
import {
    fetchBrainHashState,
    BrainUnreachableError,
    BrainMalformedResponseError,
} from './brain-hash-state-client.js';

/** Minimal coordinator interface needed by the delete route. */
export interface DeleteNousCoordinator {
    despawnNous(did: string): void;
}

/**
 * Injectable deps for the delete-nous route.
 * Production: wired by main.ts / genesis/launcher.
 * Tests: injected via `services._deleteNousDeps` (unknown cast).
 */
export interface DeleteNousDeps {
    /** fetch-compatible function for Brain RPC. Injectable for tests. */
    brainFetch: typeof fetch;
    /** SpatialMap instance (needed by registry.tombstone). */
    space: SpatialMap;
    /** Coordinator to call despawnNous after tombstoning. */
    coordinator: DeleteNousCoordinator;
}

interface DeleteNousBody extends OperatorBody {}

export function registerDeleteNousRoute(
    app: FastifyInstance,
    services: GridServices,
    deps?: DeleteNousDeps,
): void {
    // Allow injectable deps for tests via the `_deleteNousDeps` escape hatch.
    // Production callers pass `deps` explicitly; test fakes use the cast field.
    const resolvedDeps: DeleteNousDeps | undefined =
        deps ?? (services as unknown as { _deleteNousDeps?: DeleteNousDeps })._deleteNousDeps;

    app.post<{ Params: { did: string }; Body: DeleteNousBody }>(
        '/api/v1/operator/nous/:did/delete',
        async (req, reply) => {
            const body = req.body ?? {};

            // 1. Tier + operator_id gate (H5 required for Sovereign Operations).
            const v = validateTierBody(body, 'H5');
            if (!v.ok) {
                reply.code(400);
                return { error: v.error } satisfies ApiError;
            }

            // 2. DID shape gate.
            const targetDid = req.params.did;
            if (!DID_REGEX.test(targetDid)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            const registry = services.registry;
            if (!registry) {
                reply.code(503);
                return { error: 'registry_unavailable' } satisfies ApiError;
            }

            // 3. Tombstone check — 410 if already deleted.
            try {
                tombstoneCheck(registry, targetDid);
            } catch (err) {
                if (err instanceof TombstonedDidError) {
                    reply.code(410);
                    return { error: 'gone', deleted_at_tick: err.deletedAtTick } as ApiError & { deleted_at_tick: number };
                }
                throw err;
            }

            // 4. Registry existence check — 404 if unknown.
            if (!registry.get(targetDid)) {
                reply.code(404);
                return { error: 'unknown_did' } satisfies ApiError;
            }

            // 5. Brain RPC — fetch component hashes BEFORE tombstoning (SC#3).
            if (!resolvedDeps) {
                // Production: deps must be wired; this is a deployment error.
                req.log.error({ targetDid }, 'deleteNous: no deps wired (production misconfiguration)');
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }

            let stateHash: string;
            try {
                // For test injection: brainFetch is used directly; brainBaseUrl
                // is irrelevant when brainFetch is a mock.
                const components = await fetchBrainHashState(
                    'http://brain.local',
                    targetDid,
                    resolvedDeps.brainFetch,
                );
                stateHash = combineStateHash(components);
            } catch (err) {
                if (err instanceof BrainUnreachableError || err instanceof BrainMalformedResponseError) {
                    req.log.warn({ err, targetDid }, 'deleteNous: Brain RPC failed');
                    reply.code(503);
                    return { error: 'brain_unavailable' } satisfies ApiError;
                }
                // BrainUnknownDidError or unexpected error → 503 too.
                req.log.warn({ err, targetDid }, 'deleteNous: Brain RPC error');
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }

            // 6. D-30 ORDER (LOCKED): tombstone → despawn → audit.

            // 6a. Tombstone in registry (marks status='deleted', removes from space).
            const clock = services.clock;
            const currentTick = clock.state.tick;
            registry.tombstone(targetDid, currentTick, resolvedDeps.space);

            // 6b. Despawn from coordinator (removes runner, cleans up resources).
            resolvedDeps.coordinator.despawnNous(targetDid);

            // 6c. Bios lifecycle event precedes operator.nous_deleted (D-10b-03).
            // Wire keys are snake_case per D-10b-01 closed-tuple contract.
            // appendBiosDeath does NOT tombstone internally (B6 fix, plan 10b-03);
            // the tombstone was performed at step 6a above (caller-owned).
            appendBiosDeath(services.audit, targetDid, {
                did: targetDid,
                tick: currentTick,
                cause: 'operator_h5',
                final_state_hash: stateHash,
            });

            // 6d. Emit operator.nous_deleted audit event (sole producer path).
            appendNousDeleted(services.audit, v.operator_id, {
                tier: 'H5',
                action: 'delete',
                operator_id: v.operator_id,
                target_did: targetDid,
                pre_deletion_state_hash: stateHash,
            });

            return {
                ok: true,
                target_did: targetDid,
                pre_deletion_state_hash: stateHash,
            };
        },
    );
}
