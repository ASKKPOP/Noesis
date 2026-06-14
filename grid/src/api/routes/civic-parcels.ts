/**
 * Phase 58 HOUSE-1 · Wave 3 (R-58-06..09 / D-58-05/06/08) — civic-parcels HTTP routes.
 *
 * Exposes the dormant Phase 48b ParcelRegistry over HTTP for the Genesis Core:
 *   - GET  /api/v1/civic/parcels            (public map feed; owner DIDs hashed HEX64)
 *   - GET  /api/v1/civic/parcels/:id        (public detail)
 *   - POST /api/v1/civic/parcels/:id/purchase      (civic_did_required)
 *   - POST /api/v1/civic/parcels/:id/build         (civic_did_required)
 *   - POST /api/v1/civic/parcels/:id/join          (civic_did_required)
 *   - POST /api/v1/civic/parcels/:id/leave         (civic_did_required)
 *   - POST /api/v1/civic/parcels/:id/entry-policy  (civic_did_required)
 *
 * TWO DISTINCT REGISTRIES (do not conflate — this is the bug this file guards against):
 *   - parcelRegistry = services.parcels.registry — owns land state transitions:
 *       purchase() validates affordability + caps ONLY (does NOT move funds);
 *       stampAcquired/build/join/leave/setEntryPolicy. HAS NO transferOusia.
 *   - nousRegistry   = services.registry — the funds registry:
 *       get(did)?.ousia reads balance; transferOusia(from, to, amount) MOVES Ousia.
 *
 * Funds path (D-58-06): read buyer Ousia from nousRegistry → parcelRegistry.purchase
 *   validates → nousRegistry.transferOusia(buyer → TREASURY_DID, price) → store write →
 *   stampAcquired → appendZoningParcelPurchased(82) + appendTreasuryParcelRevenue(83).
 *
 * D-NH-07 (D-58-05): land is Nous-only. human_visitor / anon → 401 (tier gate);
 *   a did:civic:noesis:human:* DID → 403 humans_cannot_own_land (defensive). Operators
 *   are read-only (no write path reaches them).
 *
 * Privacy (D-58-08): owner DIDs cross the public feed and every zoning./treasury.
 *   payload ONLY as owner_civic_did_hash (HEX64, sha256). Structure plaintext names
 *   stay Grid-side (name_hash discipline). No new audit event — events 82–86 reused.
 */
import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import type { GridServices } from '../server.js';
import type { Parcel, StructureType, Visibility } from '../../civic/types.js';
import { isValidFurniture, FURNITURE_CATALOG } from '../../civic/furniture.js';
import { TREASURY_DID } from './registry.js';
import { appendZoningParcelPurchased } from '../../audit/append-zoning-parcel-purchased.js';
import { appendTreasuryParcelRevenue } from '../../audit/append-treasury-parcel-revenue.js';
import { appendZoningStructureBuilt } from '../../audit/append-zoning-structure-built.js';
import { appendZoningStructureJoined } from '../../audit/append-zoning-structure-joined.js';
import { appendZoningStructureLeft } from '../../audit/append-zoning-structure-left.js';
import { appendZoningInteriorExtended } from '../../audit/append-zoning-interior-extended.js';
import { appendZoningRoleGranted } from '../../audit/append-zoning-role-granted.js';
import { appendZoningRoleRevoked } from '../../audit/append-zoning-role-revoked.js';
import { appendZoningCoworkSession } from '../../audit/append-zoning-cowork-session.js';
import { appendSkillBlueprintExecuted } from '../../audit/append-skill-blueprint-executed.js';
import { isHumanDid } from '../../civic/roles.js';
import { postTask, claimTask, completeTask } from '../../civic/cowork.js';
import { buildFromBlueprint } from '../../civic/blueprint.js';
import { coBuildStaffOf } from '../../civic/co-build.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const HUMAN_CIVIC_DID_RE = /^did:civic:noesis:human:/i;

/** sha256 hex — the same HEX64 owner-hash discipline the zoning.* producers expect. */
function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

function currentTick(services: GridServices): number {
    if (typeof services.currentTick === 'function') return services.currentTick();
    return services.clock?.state?.tick ?? 0;
}

/** Public-feed projection of a parcel — owner DID hashed, structure name omitted. */
function publicView(p: Parcel, occupantCount: number): Record<string, unknown> {
    return {
        id: p.id,
        zone: p.zoneId,
        ring: p.ring,
        sector: p.sector,
        level: p.level,
        status: p.ownerDid === null ? 'available' : 'owned',
        price_bios: p.priceBios,
        // Owner DID NEVER crosses raw — hashed HEX64 only (D-58-08).
        owner_civic_did_hash: p.ownerDid === null ? null : sha256Hex(p.ownerDid),
        structure: p.structure === null
            ? null
            : { type: p.structure.type, visibility: p.structure.visibility }, // NO plaintext name; NEVER the interior tree
        // Phase 59 HOUSE-2 (D-59-08): the public feed exposes the upkeep condition —
        // exterior + condition only. The interior tree is NEVER serialized here.
        condition: p.condition,
        occupant_count: occupantCount,
    };
}

/**
 * Phase 59 HOUSE-2 · Wave 2 — typed EMIT SEAM for zoning.interior_extended.
 *
 * The allowlist member + sole-producer `appendZoningInteriorExtended` land in
 * Wave 4. Until then this helper materializes the EXACT closed 4-tuple that crosses
 * the audit boundary — `{object_class, object_kind, parcel_id, tick}` — from the
 * catalog enums ONLY. Interior names/state NEVER appear here (D-59-08). Wave 4
 * replaces the route's TODO call site with the real producer; this shape is frozen.
 */
export interface InteriorExtendedSeamInput {
    objectClass: 'mirror' | 'functional';
    objectKind: string;
    parcelId: string;
    tick: number;
}
export function INTERIOR_EXTEND_EMIT_SEAM(
    input: InteriorExtendedSeamInput,
): { object_class: string; object_kind: string; parcel_id: string; tick: number } {
    return {
        object_class: input.objectClass,
        object_kind: input.objectKind,
        parcel_id: input.parcelId,
        tick: input.tick,
    };
}

export function registerCivicParcelRoutes(app: FastifyInstance, services: GridServices): void {
    // --- GET /api/v1/civic/parcels (public map feed) ---
    app.get('/api/v1/civic/parcels', async (_req, reply) => {
        const parcelRegistry = services.parcels?.registry;
        if (!parcelRegistry) return reply.code(503).send({ error: 'civic_parcels_unavailable' });
        const parcels = parcelRegistry.list().map((p) =>
            publicView(p, parcelRegistry.occupants(p.id).length),
        );
        return reply.code(200).send({ parcels });
    });

    // --- GET /api/v1/civic/parcels/:id (public detail) ---
    app.get<{ Params: { id: string } }>('/api/v1/civic/parcels/:id', async (req, reply) => {
        const parcelRegistry = services.parcels?.registry;
        if (!parcelRegistry) return reply.code(503).send({ error: 'civic_parcels_unavailable' });
        const parcel = parcelRegistry.get(req.params.id);
        if (!parcel) return reply.code(404).send({ error: 'parcel_not_found' });
        return reply.code(200).send(publicView(parcel, parcelRegistry.occupants(parcel.id).length));
    });

    // --- POST /api/v1/civic/parcels/:id/purchase (civic_did_required) ---
    app.post<{ Params: { id: string } }>('/api/v1/civic/parcels/:id/purchase', async (req, reply) => {
        const guarded = requireCivicWriter(req, reply, services);
        if (!guarded) return reply; // 401/403/503 already sent
        const { parcelRegistry, store, nousRegistry, buyerDid } = guarded;
        const addr = req.params.id;

        // 1. Read the buyer's Ousia from the Nous registry (1:1 Bios per D-58-06).
        const buyer = nousRegistry.get(buyerDid);
        if (!buyer) return reply.code(404).send({ error: 'buyer_not_found' });

        // 2. parcelRegistry.purchase validates affordability + caps ONLY (no funds move).
        const result = parcelRegistry.purchase(addr, buyerDid, buyer.ousia);
        if (!result.ok) {
            if (result.reason === 'insufficient_funds') {
                return reply.code(402).send({ error: 'insufficient_funds' });
            }
            if (result.reason === 'parcel_not_found') {
                return reply.code(404).send({ error: 'parcel_not_found' });
            }
            return reply.code(409).send({ error: result.reason });
        }
        const parcel = result.parcel;
        const price = parcel.priceBios;

        // 3. Move funds on the NOUS registry (buyer → treasury). Belt-and-suspenders 402.
        const moved = nousRegistry.transferOusia(buyerDid, TREASURY_DID, price);
        if (!moved.success) {
            if (moved.error === 'insufficient') {
                return reply.code(402).send({ error: 'insufficient_funds' });
            }
            return reply.code(400).send({ error: moved.error });
        }

        // 4. Persist DB-first.
        await store.persistPurchase(parcel);

        // 5. Stamp acquisition tick (Grid owns the clock).
        const tick = currentTick(services);
        parcelRegistry.stampAcquired(addr, tick);

        // 6. Emit events 82 + 83 (owner DID hashed HEX64).
        appendZoningParcelPurchased(services.audit, {
            buyer_civic_did_hash: sha256Hex(buyerDid),
            parcel_id: parcel.id,
            price_bios: price,
            tick,
            zone_id: parcel.zoneId,
        });
        appendTreasuryParcelRevenue(services.audit, {
            amount_bios: price,
            parcel_id: parcel.id,
            tick,
        });

        return reply.code(201).send({ purchased: true, parcel_id: parcel.id, price_bios: price });
    });

    // --- POST /api/v1/civic/parcels/:id/build (civic_did_required) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/build',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, store, buyerDid } = guarded;
            const addr = req.params.id;

            const body = (req.body ?? {}) as Record<string, unknown>;
            const name = body['name'];
            const type = body['type'];
            const visibility = body['visibility'];
            if (typeof name !== 'string' || name.length === 0) {
                return reply.code(400).send({ error: 'invalid_name' });
            }
            if (type !== 'home' && type !== 'shop' && type !== 'workshop' && type !== 'venue') {
                return reply.code(400).send({ error: 'invalid_type' });
            }
            if (visibility !== 'open' && visibility !== 'private') {
                return reply.code(400).send({ error: 'invalid_visibility' });
            }

            const tick = currentTick(services);
            const result = parcelRegistry.build(
                addr,
                buyerDid,
                { name, type: type as StructureType, visibility: visibility as Visibility },
                tick,
            );
            if (!result.ok) {
                if (result.reason === 'parcel_not_found') {
                    return reply.code(404).send({ error: 'parcel_not_found' });
                }
                if (result.reason === 'not_owner') {
                    return reply.code(403).send({ error: 'not_owner' });
                }
                return reply.code(409).send({ error: result.reason });
            }
            const parcel = result.parcel;
            await store.persistBuild(parcel);

            // Event 84 — owner DID + structure name HASHED (name_hash discipline).
            appendZoningStructureBuilt(services.audit, {
                name_hash: sha256Hex(parcel.structure!.name),
                owner_civic_did_hash: sha256Hex(buyerDid),
                parcel_id: parcel.id,
                structure_type: parcel.structure!.type,
                tick,
                visibility: parcel.structure!.visibility,
            });

            return reply.code(201).send({ built: true, parcel_id: parcel.id });
        },
    );

    // --- POST /api/v1/civic/parcels/:id/build-from-blueprint (civic_did_required) ---
    // Phase 61 HOUSE-4 (D-61-02 / R-61-04). The builder is the owner OR a staff Nous in an
    // active co-build session; a human builder → 403 (humans never build); a non-authorized
    // Nous → 403 not_authorized; a builder who does not hold the skill → 422 skill_not_held;
    // insufficient Ousia → 402 insufficient_funds. On success the Wave-2 buildFromBlueprint
    // executor's emit seam fires the SINGLE skill.blueprint_executed producer (attached here).
    // The blueprint_hash is the ONLY untrusted input — it is a structured DATA field passed as
    // a function argument, never woven into any directive (A11e / D-61-06).
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/build-from-blueprint',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, store, nousRegistry, buyerDid } = guarded;
            const addr = req.params.id;

            const body = (req.body ?? {}) as Record<string, unknown>;
            const blueprintHash = body['blueprint_hash'];
            if (typeof blueprintHash !== 'string' || blueprintHash.length === 0) {
                return reply.code(400).send({ error: 'invalid_blueprint_hash' });
            }

            const tick = currentTick(services);
            // Skills are attested under the EXISTENCE-DID (skill.taught.learner_did, nous-runner),
            // not the civic-DID land identity. A Brain-signed request carries the existence-DID as
            // req.didContext.operatorDid (= JWT iss). The skill-held check runs against it; land
            // ownership / Ousia / the human check / the emitted civic hash stay on buyerDid.
            const skillHolderDid = req.didContext?.operatorDid;
            try {
                const structure = buildFromBlueprint(addr, buyerDid, blueprintHash, tick, {
                    registry: parcelRegistry,
                    // Material cost rides the existing Ousia transfer path (builder → treasury);
                    // a failed transfer (cannot cover) → insufficient_funds (mapped to 402 below).
                    transferOusia: (from, to, amount) => nousRegistry.transferOusia(from, to, amount),
                    audit: services.audit,
                    // Existence-DID for the skill-held check ONLY (defaults to buyerDid in the executor).
                    skillHolderDid,
                    // Co-build authorization: a staff Nous in an active co-build session for addr.
                    coBuildStaffOf,
                    // Wave-3 emit seam — the SINGLE skill.blueprint_executed sole producer. The
                    // executor builds the closed 4-tuple (hashed builder, no recipe body); the
                    // producer re-validates + commits to the chain exactly once.
                    emitBlueprintExecuted: (payload) => {
                        appendSkillBlueprintExecuted(services.audit, payload);
                    },
                });
                // Persist the mutated interior tree (DB-first then memory, Phase 59 discipline).
                await store.persistInterior(parcelRegistry.get(addr)!);
                return reply.code(201).send({ built: true, parcel_id: addr, areas: structure.interior?.areas.length ?? 0 });
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'build_error';
                if (msg.startsWith('builder_forbidden_human')) {
                    return reply.code(403).send({ error: 'humans_cannot_own_land' });
                }
                if (msg.startsWith('not_authorized')) {
                    return reply.code(403).send({ error: 'not_authorized' });
                }
                if (msg.startsWith('blueprint_not_found')) {
                    return reply.code(404).send({ error: 'blueprint_not_found' });
                }
                if (msg.startsWith('skill_not_held')) {
                    return reply.code(422).send({ error: 'skill_not_held' });
                }
                if (msg.startsWith('insufficient_funds')) {
                    return reply.code(402).send({ error: 'insufficient_funds' });
                }
                return reply.code(409).send({ error: msg.split(':')[0] });
            }
        },
    );

    // --- POST /api/v1/civic/parcels/:id/join (civic_did_required) ---
    app.post<{ Params: { id: string } }>('/api/v1/civic/parcels/:id/join', async (req, reply) => {
        const guarded = requireCivicWriter(req, reply, services);
        if (!guarded) return reply;
        const { parcelRegistry, buyerDid } = guarded;
        const addr = req.params.id;

        const result = parcelRegistry.join(addr, buyerDid);
        if (!result.ok) {
            if (result.reason === 'parcel_not_found') {
                return reply.code(404).send({ error: 'parcel_not_found' });
            }
            if (result.reason === 'not_permitted') {
                return reply.code(403).send({ error: 'not_permitted' });
            }
            return reply.code(409).send({ error: result.reason });
        }
        // Occupants are memory-only (R-H-09) — no store write.
        const tick = currentTick(services);
        appendZoningStructureJoined(services.audit, {
            parcel_id: result.parcel.id,
            tick,
            visitor_civic_did_hash: sha256Hex(buyerDid),
        });
        return reply.code(200).send({ joined: true, parcel_id: result.parcel.id });
    });

    // --- POST /api/v1/civic/parcels/:id/leave (civic_did_required) ---
    app.post<{ Params: { id: string } }>('/api/v1/civic/parcels/:id/leave', async (req, reply) => {
        const guarded = requireCivicWriter(req, reply, services);
        if (!guarded) return reply;
        const { parcelRegistry, buyerDid } = guarded;
        const addr = req.params.id;

        const result = parcelRegistry.leave(addr, buyerDid);
        if (!result.ok) {
            if (result.reason === 'parcel_not_found') {
                return reply.code(404).send({ error: 'parcel_not_found' });
            }
            return reply.code(409).send({ error: result.reason });
        }
        const tick = currentTick(services);
        appendZoningStructureLeft(services.audit, {
            parcel_id: result.parcel.id,
            tick,
            visitor_civic_did_hash: sha256Hex(buyerDid),
        });
        return reply.code(200).send({ left: true, parcel_id: result.parcel.id });
    });

    // --- POST /api/v1/civic/parcels/:id/entry-policy (civic_did_required) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/entry-policy',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, store, buyerDid } = guarded;
            const addr = req.params.id;

            const body = (req.body ?? {}) as Record<string, unknown>;
            const policy = body['policy'];
            if (policy !== 'open' && policy !== 'allowlist') {
                return reply.code(400).send({ error: 'invalid_policy' });
            }
            const rawAllowlist = body['allowlist'];
            const allowlist = Array.isArray(rawAllowlist)
                ? rawAllowlist.filter((d): d is string => typeof d === 'string')
                : [];

            const result = parcelRegistry.setEntryPolicy(addr, buyerDid, { policy, allowlist });
            if (!result.ok) {
                if (result.reason === 'parcel_not_found') {
                    return reply.code(404).send({ error: 'parcel_not_found' });
                }
                if (result.reason === 'not_owner') {
                    return reply.code(403).send({ error: 'not_owner' });
                }
                return reply.code(409).send({ error: result.reason });
            }
            await store.persistEntryPolicy(result.parcel);
            return reply.code(200).send({ updated: true, policy });
        },
    );

    // --- POST /api/v1/civic/parcels/:id/interior/extend (civic_did_required, owner-only) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/interior/extend',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply; // 401/403/503 already sent
            const { parcelRegistry, store, buyerDid } = guarded;
            const addr = req.params.id;

            const parcel = parcelRegistry.get(addr);
            if (!parcel) return reply.code(404).send({ error: 'parcel_not_found' });
            // Owner-only (the Phase 58 not_owner discipline; humans already refused by the tier).
            if (parcel.ownerDid !== buyerDid) return reply.code(403).send({ error: 'not_owner' });
            if (parcel.structure === null) return reply.code(409).send({ error: 'no_structure' });

            const body = (req.body ?? {}) as Record<string, unknown>;
            const area = body['area'];
            const kind = body['kind'];
            if (typeof area !== 'string' || area.length === 0) {
                return reply.code(400).send({ error: 'invalid_area' });
            }
            if (typeof kind !== 'string') {
                return reply.code(422).send({ error: 'invalid_furniture' });
            }
            // The single catalog gate (D-59-04) — reused, never re-implemented.
            if (!isValidFurniture(kind, parcel.structure.type)) {
                return reply.code(422).send({ error: 'invalid_furniture' });
            }

            // Mutate the Grid-side interior tree, then persist DB-first + mirror memory.
            const structure = parcelRegistry.extendInterior(addr, buyerDid, { area, kind });
            await store.persistInterior(parcelRegistry.get(addr)!);

            // EMIT (Wave 3): zoning.interior_extended carries ONLY the closed 4-tuple
            // {object_class, object_kind, parcel_id, tick} — catalog enums, NEVER interior
            // names/state (D-59-08). The seam helper materializes the exact frozen shape;
            // appendZoningInteriorExtended re-validates + commits via the sole producer.
            const tick = currentTick(services);
            appendZoningInteriorExtended(services.audit, INTERIOR_EXTEND_EMIT_SEAM({
                objectClass: FURNITURE_CATALOG[kind].class,
                objectKind: FURNITURE_CATALOG[kind].kind,
                parcelId: parcel.id,
                tick,
            }));

            // 200 with the OWNER-visible structure summary (full tree — the owner may see it).
            return reply.code(200).send({
                extended: true,
                parcel_id: parcel.id,
                structure: {
                    type: structure.type,
                    visibility: structure.visibility,
                    interior: structure.interior ?? { areas: [] },
                },
            });
        },
    );

    // --- GET /api/v1/civic/parcels/:id/interior (entry-policy-gated read) ---
    app.get<{ Params: { id: string } }>('/api/v1/civic/parcels/:id/interior', async (req, reply) => {
        const parcelRegistry = services.parcels?.registry;
        if (!parcelRegistry) return reply.code(503).send({ error: 'civic_parcels_unavailable' });

        const parcel = parcelRegistry.get(req.params.id);
        if (!parcel) return reply.code(404).send({ error: 'parcel_not_found' });
        if (parcel.structure === null) return reply.code(404).send({ error: 'no_structure' });

        const ctx = req.didContext;
        const did = ctx?.did;
        const isCivicMember = ctx?.tier === 'civic_member' && !!did && CIVIC_DID_RE.test(did) && !HUMAN_CIVIC_DID_RE.test(did);
        const isOwner = isCivicMember && parcel.ownerDid === did;

        const interiorView = { areas: parcel.structure.interior?.areas ?? [] };

        // Owner → always allowed (full tree, even derelict).
        if (isOwner) {
            return reply.code(200).send({
                parcel_id: parcel.id,
                condition: parcel.condition,
                interior: interiorView,
            });
        }

        // D-NH-07: humans never see private interiors. A human cookie session may only
        // ever reach an OPEN interior; a private one is refused outright.
        if (ctx?.tier === 'human_visitor' && parcel.structure.visibility !== 'open') {
            return reply.code(403).send({ error: 'closed_to_visitors' });
        }

        // Visitor gate: derelict structures are closed to ALL non-owners (D-59-07).
        if (parcel.condition === 'derelict') {
            return reply.code(403).send({ error: 'closed_to_visitors' });
        }

        // Visitor permitted only if the structure is open OR (for Nous) on the allowlist.
        const permitted =
            parcel.structure.visibility === 'open' ||
            (isCivicMember &&
                parcel.entryPolicy.policy === 'allowlist' &&
                parcel.entryPolicy.allowlist.includes(did!));
        if (!permitted) {
            return reply.code(403).send({ error: 'closed_to_visitors' });
        }

        return reply.code(200).send({
            parcel_id: parcel.id,
            condition: parcel.condition,
            interior: interiorView,
        });
    });

    /* ───────────────────── Phase 60 HOUSE-3 commerce / role / cowork / place ─────────────────────
     * Shop⇄structure binding (D-60-03), place:// naming (D-60-07), invitations + role edges
     * (D-60-01..04), and the executable task board (D-60-06). Owner/staff/guest authorization
     * flows from the closed ROLE_CAPABILITIES table via parcelRegistry.roleOf; humans are
     * rejected from every role edge (VOTE-05 / D-NH-07). The 3 chain-emitting routes call their
     * Wave-4 sole producers; invite/name add NO chain event of their own (name has none; invite
     * rides zoning.role_granted via the minted guest edge). Board/scope CONTENT stays Grid-side.
     */

    // --- POST /api/v1/civic/parcels/:id/bind-shop (owner-only) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/bind-shop',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, buyerDid } = guarded;
            const addr = req.params.id;
            const body = (req.body ?? {}) as Record<string, unknown>;
            const shopId = body['shop_id'];
            if (typeof shopId !== 'string' || shopId.length === 0) {
                return reply.code(400).send({ error: 'invalid_shop_id' });
            }
            const result = parcelRegistry.bindShop(addr, shopId, buyerDid);
            if (!result.ok) {
                if (result.reason === 'not_owner') return reply.code(403).send({ error: 'not_owner' });
                // A non-shop structure is a 422 (D-60-03 — bind requires structure type shop).
                return reply.code(422).send({ error: 'structure_not_shop' });
            }
            await guarded.store.persistBuild(result.parcel);
            return reply.code(200).send({ bound: true, parcel_id: addr, shop_id: shopId });
        },
    );

    // --- POST /api/v1/civic/parcels/:id/unbind-shop (owner-only, routes through severance) ---
    app.post<{ Params: { id: string } }>(
        '/api/v1/civic/parcels/:id/unbind-shop',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, buyerDid } = guarded;
            const addr = req.params.id;
            const tick = currentTick(services);
            const result = parcelRegistry.unbindShop(addr, buyerDid, tick);
            if (!result.ok) {
                if (result.reason === 'not_owner') return reply.code(403).send({ error: 'not_owner' });
                return reply.code(422).send({ error: 'structure_not_shop' });
            }
            await guarded.store.persistBuild(result.parcel);
            return reply.code(200).send({ unbound: true, parcel_id: addr, severance_state: result.severanceState });
        },
    );

    // --- POST /api/v1/civic/parcels/:id/name (owner-only; place:// NDS; NO chain event) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/name',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, buyerDid } = guarded;
            const addr = req.params.id;
            const body = (req.body ?? {}) as Record<string, unknown>;
            const placeName = body['place_name'];
            if (typeof placeName !== 'string' || placeName.length === 0) {
                return reply.code(400).send({ error: 'invalid_place_name' });
            }
            const tick = currentTick(services);
            let result: { ok: true; placeAddress: string } | { ok: false; reason: 'not_owner' };
            try {
                result = parcelRegistry.namePlace(addr, buyerDid, placeName, tick);
            } catch (err) {
                // The place-registry throws place_name_taken on a duplicate → 409.
                if (err instanceof Error && err.message.startsWith('place_name_taken')) {
                    return reply.code(409).send({ error: 'place_name_taken' });
                }
                throw err;
            }
            if (!result.ok) return reply.code(403).send({ error: 'not_owner' });
            // Place names stay Grid-side (name_hash discipline) — NO chain event (D-60-07).
            await guarded.store.persistBuild(parcelRegistry.get(addr)!);
            return reply.code(200).send({ named: true, parcel_id: addr, place_address: result.placeAddress });
        },
    );

    // --- POST /api/v1/civic/parcels/:id/invite (owner or staff; entry allowlist + guest edge) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/invite',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, buyerDid } = guarded;
            const addr = req.params.id;
            const body = (req.body ?? {}) as Record<string, unknown>;
            const invitee = body['invitee_civic_did'];
            if (typeof invitee !== 'string' || !CIVIC_DID_RE.test(invitee)) {
                return reply.code(400).send({ error: 'invalid_invitee' });
            }
            // A human invitee is rejected from the role edge (VOTE-05 / D-NH-07) — the
            // allowlist itself never holds a role, so we refuse BEFORE touching either.
            if (HUMAN_CIVIC_DID_RE.test(invitee)) {
                return reply.code(403).send({ error: 'humans_cannot_hold_role' });
            }
            // Inviter must be the owner OR a staff edge holder (board/admit affordance).
            const inviterRole = parcelRegistry.roleOf(addr, buyerDid);
            if (inviterRole !== 'owner' && inviterRole !== 'staff') {
                return reply.code(403).send({ error: 'not_owner_or_staff' });
            }
            const tick = currentTick(services);
            // 1. Append the invitee to the Phase 58 entry allowlist (ephemeral admission).
            const parcel = parcelRegistry.get(addr);
            const existing = parcel?.entryPolicy.allowlist ?? [];
            const nextAllowlist = existing.includes(invitee) ? existing : [...existing, invitee];
            const policyResult = parcelRegistry.setEntryPolicy(addr, parcel?.ownerDid ?? buyerDid, {
                policy: 'allowlist',
                allowlist: nextAllowlist,
            });
            if (policyResult.ok) await guarded.store.persistEntryPolicy(policyResult.parcel);
            // 2. Mint the durable guest role edge (the social bond beside the allowlist entry).
            const grantor = parcel?.ownerDid ?? buyerDid;
            const edge = parcelRegistry.grantRole(addr, invitee, 'guest', grantor, tick);
            // 3. Emit zoning.role_granted (96) — DIDs HEX64; raw DIDs never cross.
            appendZoningRoleGranted(services.audit, {
                grantor_civic_did_hash: sha256Hex(edge.granted_by_civic_did),
                holder_civic_did_hash: sha256Hex(edge.holder_civic_did),
                parcel_id: addr,
                role: 'guest',
                tick,
            });
            return reply.code(200).send({ invited: true, parcel_id: addr });
        },
    );

    // --- POST /api/v1/civic/parcels/:id/roles (grant; owner-only; role ∈ {staff,guest}) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/roles',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, buyerDid } = guarded;
            const addr = req.params.id;
            const body = (req.body ?? {}) as Record<string, unknown>;
            const holder = body['holder_civic_did'];
            const role = body['role'];
            if (typeof holder !== 'string' || !CIVIC_DID_RE.test(holder)) {
                return reply.code(400).send({ error: 'invalid_holder' });
            }
            if (role !== 'staff' && role !== 'guest') {
                return reply.code(422).send({ error: 'invalid_role' });
            }
            // A human holder is rejected (humans never hold a role edge — D-NH-07).
            if (HUMAN_CIVIC_DID_RE.test(holder) || isHumanDid(holder)) {
                return reply.code(403).send({ error: 'humans_cannot_hold_role' });
            }
            // Owner-only grant.
            if (parcelRegistry.roleOf(addr, buyerDid) !== 'owner') {
                return reply.code(403).send({ error: 'not_owner' });
            }
            const tick = currentTick(services);
            const edge = parcelRegistry.grantRole(addr, holder, role, buyerDid, tick);
            appendZoningRoleGranted(services.audit, {
                grantor_civic_did_hash: sha256Hex(edge.granted_by_civic_did),
                holder_civic_did_hash: sha256Hex(edge.holder_civic_did),
                parcel_id: addr,
                role,
                tick,
            });
            return reply.code(200).send({ granted: true, parcel_id: addr, role });
        },
    );

    // --- POST /api/v1/civic/parcels/:id/roles/revoke (owner-only; routes through severance) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/roles/revoke',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, buyerDid } = guarded;
            const addr = req.params.id;
            const body = (req.body ?? {}) as Record<string, unknown>;
            const holder = body['holder_civic_did'];
            const rawReason = body['reason'];
            if (typeof holder !== 'string' || !CIVIC_DID_RE.test(holder)) {
                return reply.code(400).send({ error: 'invalid_holder' });
            }
            // A human can never hold a role edge → never has one to revoke (D-NH-07).
            if (HUMAN_CIVIC_DID_RE.test(holder) || isHumanDid(holder)) {
                return reply.code(403).send({ error: 'humans_cannot_hold_role' });
            }
            if (parcelRegistry.roleOf(addr, buyerDid) !== 'owner') {
                return reply.code(403).send({ error: 'not_owner' });
            }
            // for_cause short-circuits the FSM to SETTLEMENT with a dispute flag; otherwise the
            // event reason is owner_revoked (the audit reason mirrors the severance outcome).
            const forCause = rawReason === 'for_cause';
            const tick = currentTick(services);
            parcelRegistry.revokeRole(addr, holder, forCause ? 'for_cause' : 'owner_revoked', tick);
            appendZoningRoleRevoked(services.audit, {
                holder_civic_did_hash: sha256Hex(holder),
                parcel_id: addr,
                reason: forCause ? 'for_cause' : 'owner_revoked',
                tick,
            });
            return reply.code(200).send({ revoked: true, parcel_id: addr });
        },
    );

    // --- POST /api/v1/civic/parcels/:id/board/post (owner/staff post a task) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/board/post',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, buyerDid } = guarded;
            const addr = req.params.id;
            const body = (req.body ?? {}) as Record<string, unknown>;
            const taskRef = body['task_ref'];
            const payBios = body['pay_bios'];
            if (typeof taskRef !== 'string' || taskRef.length === 0) {
                return reply.code(400).send({ error: 'invalid_task_ref' });
            }
            if (!Number.isInteger(payBios) || (payBios as number) <= 0) {
                return reply.code(400).send({ error: 'invalid_pay_bios' });
            }
            // Owner/staff only (the board-post affordance).
            const role = parcelRegistry.roleOf(addr, buyerDid);
            if (role !== 'owner' && role !== 'staff') {
                return reply.code(403).send({ error: 'not_owner_or_staff' });
            }
            // scope_ref body stays Grid-side — only the agreement id crosses back to the caller.
            const agreement = postTask({
                parcel_id: addr,
                parties: [buyerDid, ''],
                scope_ref: taskRef,
                settlement_amount_bios: payBios as number,
                term_ticks: 0,
            });
            return reply.code(200).send({ posted: true, parcel_id: addr, task_id: agreement.agreement_id });
        },
    );

    // --- POST /api/v1/civic/parcels/:id/board/claim (any role with board access) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/board/claim',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, buyerDid } = guarded;
            const addr = req.params.id;
            const body = (req.body ?? {}) as Record<string, unknown>;
            const taskId = body['task_id'];
            if (typeof taskId !== 'string' || taskId.length === 0) {
                return reply.code(400).send({ error: 'invalid_task_id' });
            }
            // Board access: any role (owner/staff/guest) on this parcel.
            if (parcelRegistry.roleOf(addr, buyerDid) === null) {
                return reply.code(403).send({ error: 'no_board_access' });
            }
            try {
                const agreement = claimTask(taskId, buyerDid);
                return reply.code(200).send({ claimed: true, task_id: agreement.agreement_id });
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'cowork_error';
                if (msg.startsWith('cowork_not_found')) return reply.code(404).send({ error: 'task_not_found' });
                return reply.code(409).send({ error: msg.split(':')[0] });
            }
        },
    );

    // --- POST /api/v1/civic/parcels/:id/board/complete (host confirms; ALWAYS settles) ---
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
        '/api/v1/civic/parcels/:id/board/complete',
        async (req, reply) => {
            const guarded = requireCivicWriter(req, reply, services);
            if (!guarded) return reply;
            const { parcelRegistry, buyerDid } = guarded;
            const addr = req.params.id;
            const body = (req.body ?? {}) as Record<string, unknown>;
            const taskId = body['task_id'];
            if (typeof taskId !== 'string' || taskId.length === 0) {
                return reply.code(400).send({ error: 'invalid_task_id' });
            }
            const startTick = currentTick(services);
            const endTick = startTick;
            try {
                // D-NH-06 — completion ALWAYS settles: Ousia when funded, else an IOU. The
                // Ousia move rides the existing transfer path; the IOU rides credit-ledger.
                const nous = services.registry;
                const agreement = completeTask(taskId, buyerDid, {
                    funded: !!nous,
                    start_tick: startTick,
                    end_tick: endTick,
                    transferOusia: nous
                        ? (from, to, amount) => { nous.transferOusia(from, to, amount); }
                        : undefined,
                    bumpTrust: (parcelId, workerDid, delta) => parcelRegistry.bumpTrust(parcelId, workerDid, delta),
                });
                // Emit zoning.cowork_session (99) — participants HASHED (single hash over the
                // sorted DID set); NO raw DIDs, NO board/task/scope text crosses (D-60-10).
                const participants = [agreement.parties[0], agreement.parties[1]].sort();
                appendZoningCoworkSession(services.audit, {
                    end_tick: endTick,
                    parcel_id: addr,
                    participant_count: participants.length,
                    participants_hash: sha256Hex(participants.join('|')),
                    start_tick: startTick,
                });
                return reply.code(200).send({ completed: true, task_id: agreement.agreement_id });
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'cowork_error';
                if (msg.startsWith('cowork_not_found')) return reply.code(404).send({ error: 'task_not_found' });
                if (msg.startsWith('cowork_not_host')) return reply.code(403).send({ error: 'not_host' });
                return reply.code(409).send({ error: msg.split(':')[0] });
            }
        },
    );
}

/**
 * Resolve both registries + the caller's Civic-DID for a write route, enforcing
 * D-NH-07. Returns null after sending the appropriate error response:
 *   - 503 if either registry/store is missing
 *   - 401 if the caller is not a civic_member with a valid Civic-DID (anon / human_visitor)
 *   - 403 humans_cannot_own_land if the DID is a did:civic:noesis:human:* form (defensive)
 */
function requireCivicWriter(
    req: import('fastify').FastifyRequest,
    reply: import('fastify').FastifyReply,
    services: GridServices,
):
    | {
          parcelRegistry: NonNullable<GridServices['parcels']>['registry'];
          store: NonNullable<GridServices['parcels']>['store'];
          nousRegistry: NonNullable<GridServices['registry']>;
          buyerDid: string;
      }
    | null {
    const parcels = services.parcels;
    const nousRegistry = services.registry;
    if (!parcels) {
        reply.code(503).send({ error: 'civic_parcels_unavailable' });
        return null;
    }
    if (!nousRegistry) {
        reply.code(503).send({ error: 'civic_registry_unavailable' });
        return null;
    }

    const ctx = req.didContext;
    const did = ctx?.did;
    // Tier gate: anon + human_visitor + government are all rejected here (Nous-only land).
    if (!did || ctx?.tier !== 'civic_member' || !CIVIC_DID_RE.test(did)) {
        reply.code(401).send({ error: 'unauthorized' });
        return null;
    }
    // D-NH-07 defensive: a human Civic-DID can never own/occupy land.
    if (HUMAN_CIVIC_DID_RE.test(did)) {
        reply.code(403).send({ error: 'humans_cannot_own_land' });
        return null;
    }

    return { parcelRegistry: parcels.registry, store: parcels.store, nousRegistry, buyerDid: did };
}
