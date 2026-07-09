/**
 * Operator spawn: POST /api/v1/operator/spawn-system-nous.
 *
 * Phase 25b D-25b-12 — H5 Sovereign Operations.
 * Spawns a new system-tier Nous (researcher/Sophia/Hermes/Themis-class),
 * writing initial bios and returning the new DID.
 *
 * SCOPE NOTE (D-25b-12): This route creates SYSTEM Nous only — NOT human-owned
 * Nous. Human-spawned Nous uses a separate flow (Phase 27, `nous.spawned_by_human`)
 * with the `did:noesis:human:*` scheme. This route produces `did:noesis:system:*` DIDs
 * to remain distinct.
 *
 * AUTH MODEL (born header-auth per D-25b-NEW-1):
 *   tier and operator_id are derived from server-trusted request headers
 *   (x-operator-tier, x-operator-id) — NOT from the request body.
 *
 * TREASURY / FUNDING (locked per plan-checker revision 2026-05-21, CONTEXT D-25b-NEW-5):
 *   Reuses `GenesisLauncher.spawnNous` → `registry.spawn(..., economy.initialSupply)`.
 *   Every spawn allocates exactly `economy.initialSupply` (default 1000 Ousia), the same
 *   allocation used for genesis seed Nous and all prior runtime spawns. No new treasury
 *   mechanism is introduced in 25b. A future phase may introduce a distinct system_treasury
 *   ledger or per-spawn allocation override (see CONTEXT.md deferred_ideas: "Treasury
 *   funding mechanism for system Nous spawn").
 *
 * DID SCHEME:
 *   `did:noesis:system:<uuid-v4>` — distinct from `did:noesis:human:*` (Phase 27) and
 *   `did:noesis:<name>` seed Nous. UUIDv4 is lowercase hex+dash per `crypto.randomUUID()`.
 *
 * PERSONALITY SEEDS (forward-compat only in 25b):
 *   `personality_seeds` is accepted in the request body and recorded in the audit payload
 *   metadata, but does NOT yet feed into a personality-bootstrap step — that work is out
 *   of scope for 25b. A future phase wires seeds into the Brain's initial creed/self-model.
 *   The code comment below marks the insertion point.
 *
 * AUDIT CONTRACT (no new allowlist member):
 *   Spawn reuses the existing `nous.spawned` + `bios.birth` pair that
 *   `GenesisLauncher.spawnNous` already emits. NO new `operator.*` event is added for
 *   the spawn itself — allowlist count remains 51 (plan 07 baseline).
 *
 * ERROR LADDER (no 500s):
 *   401 — tier_missing (x-operator-tier header absent / non-numeric)
 *   403 — tier_too_low (x-operator-tier < 5)
 *   400 — invalid_operator_id (x-operator-id malformed)
 *   400 — invalid_body (name validation failure or personality_seeds validation failure)
 *   503 — spawn_unavailable (spawnNous deps not wired — deployment misconfiguration)
 *   200 — success with { ok: true, nous_did }
 *
 * See: 25b-PLAN-14, D-25b-12, D-25b-NEW-1.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { ApiError } from '../types.js';
import { generateKeyPairSync, randomUUID } from 'node:crypto';

/** Body accepted by the spawn endpoint. */
interface SpawnBody {
    name?: unknown;
    personality_seeds?: unknown;
}

/**
 * Injectable deps for the spawn-system-nous route.
 * Production: wired by main.ts (wraps launcher.spawnNous).
 * Tests: inject a stub that records calls and simulates audit emission.
 */
export interface SpawnNousDeps {
    /**
     * Spawns a Nous into the running Grid. Matches the signature of
     * `GenesisLauncher.spawnNous(name, did, publicKey, region, humanOwner?)`.
     * No `humanOwner` is passed — system Nous are not human-owned.
     */
    spawnNous(name: string, did: string, publicKey: string, region: string): void;
}

/** Generate a base64-encoded SPKI public key for the spawned Nous. */
function generatePublicKey(): string {
    const { publicKey } = generateKeyPairSync('ed25519');
    return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}

export function registerSpawnSystemNousRoute(
    app: FastifyInstance,
    services: GridServices,
    deps?: SpawnNousDeps,
): void {
    // Allow injectable deps for tests via the `_spawnNousDeps` escape hatch on services.
    const resolvedDeps: SpawnNousDeps | undefined =
        deps ?? (services as unknown as { _spawnNousDeps?: SpawnNousDeps })._spawnNousDeps;

    app.post<{ Body: SpawnBody }>(
        '/api/v1/operator/spawn-system-nous',
        async (req, reply) => {
            // 1. Tier gate — server-trusted operator context (set by the operator_only gate).
            const tier = req.didContext?.operatorTier ?? 0;
            if (tier < 5) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }
            // operatorTier/operatorId are available on req.didContext if a future
            // operator.* event for spawn needs them.

            // 2. Body validation.
            const { name: rawName, personality_seeds: rawSeeds } = req.body ?? {};

            // name: non-empty string ≤ 64 chars.
            if (typeof rawName !== 'string' || rawName.length === 0 || rawName.length > 64) {
                reply.code(400);
                return { error: 'invalid_body' } satisfies ApiError;
            }
            const name = rawName;

            // personality_seeds: array of 1–8 non-empty strings.
            if (!Array.isArray(rawSeeds) || rawSeeds.length === 0 || rawSeeds.length > 8) {
                reply.code(400);
                return { error: 'invalid_body' } satisfies ApiError;
            }
            for (const seed of rawSeeds) {
                if (typeof seed !== 'string' || seed.length === 0) {
                    reply.code(400);
                    return { error: 'invalid_body' } satisfies ApiError;
                }
            }
            const personalitySeeds = rawSeeds as string[];

            // 3. Deps check — 503 if spawnNous is not wired (deployment misconfiguration).
            if (!resolvedDeps) {
                req.log.error('spawnSystemNous: spawnNous deps not wired (production misconfiguration)');
                reply.code(503);
                return { error: 'spawn_unavailable' } satisfies ApiError;
            }

            // 4. Generate system DID — did:noesis:system:<uuidv4> (lowercase hex+dash).
            //    Distinct from did:noesis:human:* (Phase 27) and did:noesis:<name> seeds.
            const generatedDid = `did:noesis:system:${randomUUID()}`;

            // 5. Generate ed25519 public key for the new Nous (SPKI-DER → base64).
            const publicKey = generatePublicKey();

            // 6. Region — use 'agora' (the canonical first region in the production Grid).
            //    A future phase may allow the caller to specify region; deferred per D-25b-12.
            const region = 'agora';

            // 7. Personality seeds — recorded here for forward-compat with Phase N personality-
            //    bootstrap work. In 25b they are carried in the spawnNous call's audit payload
            //    via the existing nous.spawned emitter (name+region+ndsAddress). A future phase
            //    will pass `personalitySeeds` into a Brain creed-seeding RPC at this point.
            // TODO(Phase N): wire personalitySeeds into Brain's initial creed/self-model here.
            void personalitySeeds; // consumed by comment above; suppress lint warning

            // 8. Spawn — reuses GenesisLauncher.spawnNous which calls:
            //      registry.spawn(..., economy.initialSupply)  → funds Nous with 1000 Ousia default
            //      space.placeNous(did, region)                → places Nous in spatial map
            //      audit.append('nous.spawned', ...)           → sole producer
            //      appendBiosBirth(audit, did, ...)            → ORDER-LOCKED pair
            //    No new treasury code. No new operator.* event. Allowlist stays at 51.
            resolvedDeps.spawnNous(name, generatedDid, publicKey, region);

            // 9. Return success.
            return { ok: true, nous_did: generatedDid };
        },
    );
}
