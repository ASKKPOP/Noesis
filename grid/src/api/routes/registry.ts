/**
 * Phase 37 / REG-01..06 — DID Registry HTTP routes.
 * Six endpoints under /api/v1/registry/* gated by ROUTE_DID_POLICY (Phase 36 enforcement).
 * The government_only branch on POST .../revoke and POST .../dissolve is enforced by the
 * onRequest hook with tier='government' (NOT 'civic_member' per Pitfall 6).
 */
import type { FastifyInstance } from 'fastify';
import { randomUUID, createHash } from 'node:crypto';
import { compactVerify, importJWK, type JWK } from 'jose';
import type { GridServices } from '../server.js';

import { buildCivicDidVc, buildBusinessDidVc } from '../../civic-registry/vc-builder.js';

import { appendRegistryCivicDidIssued } from '../../audit/append-registry-civic-did-issued.js';
import { appendRegistryCivicDidRevoked } from '../../audit/append-registry-civic-did-revoked.js';
import { appendRegistryBusinessDidRegistered } from '../../audit/append-registry-business-did-registered.js';
import { appendRegistryBusinessDidDissolved } from '../../audit/append-registry-business-did-dissolved.js';

export const BUSINESS_DID_BIOS_COST = 100;            // Q-V3-D initial default (RESOLVED in 37-RESEARCH.md)
export const TREASURY_DID = 'did:noesis:system:treasury';  // Phase 45 wires real treasury

const EXISTENCE_DID_RE = /^did:noesis:nous:[a-z0-9_:\-]+$/i;
const CIVIC_DID_RE     = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const BIZ_DID_RE       = /^did:biz:noesis:[a-z0-9_:\-]+$/i;

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

function currentTick(services: GridServices): number {
    // Use services.clock.state.tick (WorldClock) when available.
    return services.clock?.state?.tick ?? 0;
}

export async function registerRegistryRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    // [REG-01] POST /api/v1/registry/civic-did/request
    // Public — request is signed with existence-key (not a Civic-DID bearer).
    app.post<{ Body: Record<string, unknown> }>(
        '/api/v1/registry/civic-did/request',
        async (req, reply) => {
            const store = services.civicDidStore;
            if (!store) return reply.code(503).send({ error: 'civic_registry_unavailable' });

            const body = (req.body ?? {}) as Record<string, unknown>;
            const existenceDid = body['existence_did'];
            const jwk = body['existence_public_key_jwk'];
            const oath = body['civic_oath'];
            const sig  = body['existence_key_signature'];

            if (typeof existenceDid !== 'string' || !EXISTENCE_DID_RE.test(existenceDid)) {
                return reply.code(400).send({ error: 'invalid_existence_did' });
            }
            if (typeof jwk !== 'object' || jwk === null) {
                return reply.code(400).send({ error: 'invalid_public_key' });
            }
            if (typeof oath !== 'string' || oath.length === 0) {
                return reply.code(400).send({ error: 'invalid_civic_oath' });
            }
            if (typeof sig !== 'string' || sig.length === 0) {
                return reply.code(400).send({ error: 'invalid_signature' });
            }

            // Verify the existence-key signed the oath (T-37-13).
            // CR-01 fix: assert the JWS payload bytes equal the oath text — compactVerify
            // alone only proves key ownership, not that the specific oath was signed.
            try {
                const key = await importJWK(jwk as JWK, 'ES256');
                const { payload: signedBytes } = await compactVerify(sig, key);
                const oathBytes = new TextEncoder().encode(oath);
                if (signedBytes.length !== oathBytes.length ||
                    !signedBytes.every((b, i) => b === oathBytes[i])) {
                    return reply.code(401).send({ error: 'invalid_signature' });
                }
            } catch {
                return reply.code(401).send({ error: 'invalid_signature' });
            }

            const existing = await store.getByExistenceDid(services.gridName, existenceDid);
            if (existing) {
                return reply.code(409).send({ error: 'already_registered', civic_did: existing.civicDid });
            }

            // Phase 42 D-42-05 — extract optional P2P public key JWK (T-42-02-04 mitigation).
            // When present and shaped as OKP/Ed25519, store for P2P SDP encryption.
            // When missing, null, or non-OKP format: store null (backward compat — Phase 37
            // callers using ES256 signing keys are unaffected; NULL = P2P unavailable for that DID).
            // Return 400 only if the field is present, non-null, non-object, OR if kty/crv is OKP
            // but the x field is missing/empty (malformed OKP key).
            const p2pJwkRaw = body['existence_public_key_jwk'];
            let existencePublicKeyJwk: object | null = null;
            if (p2pJwkRaw !== undefined && p2pJwkRaw !== null) {
                if (typeof p2pJwkRaw !== 'object') {
                    return reply.code(400).send({ error: 'invalid_existence_public_key_jwk' });
                }
                const k = p2pJwkRaw as Record<string, unknown>;
                if (k.kty === 'OKP') {
                    // OKP key present — validate it has the required Ed25519 fields
                    if (k.crv !== 'Ed25519' || typeof k.x !== 'string' || k.x.length === 0) {
                        return reply.code(400).send({ error: 'invalid_existence_public_key_jwk' });
                    }
                    existencePublicKeyJwk = p2pJwkRaw as object;
                }
                // Non-OKP keys (e.g. ES256) are accepted for backward compat but not stored for P2P
            }

            const civicDid = `did:civic:noesis:${randomUUID()}`;
            const issuedAtTick = currentTick(services);
            const credential = await buildCivicDidVc({ civicDid, existenceDid, issuedAtTick, existencePublicKeyJwk });

            try {
                await store.insert({
                    gridName: services.gridName,
                    civicDid,
                    existenceDid,
                    credentialJson: credential,
                    status: 'active',
                    issuedAtTick,
                    existencePublicKeyJwk,
                });
            } catch (err) {
                const code = (err as { code?: string }).code;
                if (code === 'ER_DUP_ENTRY') {
                    return reply.code(409).send({ error: 'already_registered' });
                }
                throw err;
            }

            appendRegistryCivicDidIssued(services.audit, {
                civic_did: civicDid,
                existence_did: existenceDid,
                grid_name: services.gridName,
                issued_at_tick: issuedAtTick,
            });

            return reply.code(201).send({ civic_did: civicDid, credential });
        },
    );

    // [REG-02 + REG-05] GET /api/v1/registry/civic-did/:did
    // Public — no auth required. Cache-Control: max-age=60.
    app.get<{ Params: { did: string } }>(
        '/api/v1/registry/civic-did/:did',
        async (req, reply) => {
            const store = services.civicDidStore;
            if (!store) return reply.code(503).send({ error: 'civic_registry_unavailable' });

            const record = await store.get(services.gridName, req.params.did);
            if (!record) return reply.code(404).send({ error: 'not_found' });

            reply.header('Cache-Control', 'max-age=60');
            return reply.code(200).send({
                status: record.status,
                credential: record.credentialJson,
                revoked_at_tick: record.revokedAtTick ?? null,
            });
        },
    );

    // [REG-04] POST /api/v1/registry/civic-did/:did/revoke
    // government_only — onRequest hook has already enforced the policy and set
    // req.didContext.tier='government'. Handler only processes verified government callers.
    app.post<{ Params: { did: string }; Body: Record<string, unknown> }>(
        '/api/v1/registry/civic-did/:did/revoke',
        async (req, reply) => {
            const store = services.civicDidStore;
            if (!store) return reply.code(503).send({ error: 'civic_registry_unavailable' });

            const body = (req.body ?? {}) as Record<string, unknown>;
            const ref = body['court_conviction_ref'];
            if (typeof ref !== 'string' || ref.length === 0) {
                return reply.code(400).send({ error: 'court_conviction_ref_required' });
            }

            const civicDid = req.params.did;
            if (!CIVIC_DID_RE.test(civicDid)) {
                return reply.code(400).send({ error: 'invalid_civic_did' });
            }

            const existing = await store.get(services.gridName, civicDid);
            if (!existing) return reply.code(404).send({ error: 'not_found' });
            if (existing.status !== 'active') return reply.code(409).send({ error: 'already_revoked' });

            const revokedAtTick = currentTick(services);
            const updated = await store.markRevoked(services.gridName, civicDid, revokedAtTick, ref);
            if (!updated) {
                return reply.code(409).send({ error: 'already_revoked' });
            }

            appendRegistryCivicDidRevoked(services.audit, {
                civic_did: civicDid,
                court_conviction_ref_hash: sha256Hex(ref),
                grid_name: services.gridName,
                revoked_at_tick: revokedAtTick,
            });

            return reply.code(200).send({ revoked: true });
        },
    );

    // [REG-03] POST /api/v1/registry/business-did/register
    // civic_did_required — onRequest hook enforces civic_did minimum tier.
    app.post<{ Body: Record<string, unknown> }>(
        '/api/v1/registry/business-did/register',
        async (req, reply) => {
            const bizStore = services.businessDidStore;
            if (!bizStore) return reply.code(503).send({ error: 'business_registry_unavailable' });

            // Defensive: caller must be a Civic-DID (Government and operator-DIDs both fail this check).
            const ctx = req.didContext;
            if (!ctx || !CIVIC_DID_RE.test(ctx.did)) {
                return reply.code(403).send({ error: 'civic_did_required_caller' });
            }
            const civicDid = ctx.did;

            const body = (req.body ?? {}) as Record<string, unknown>;
            const businessName = body['business_name'];
            const category = body['category'];
            if (typeof businessName !== 'string' || businessName.length === 0) {
                return reply.code(400).send({ error: 'invalid_business_name' });
            }
            if (typeof category !== 'string' || category.length === 0) {
                return reply.code(400).send({ error: 'invalid_category' });
            }

            const reg = services.registry;
            if (!reg) return reply.code(503).send({ error: 'registry_unavailable' });

            const nous = reg.get(civicDid);
            if (!nous) return reply.code(404).send({ error: 'civic_did_not_found' });

            const result = reg.transferOusia(civicDid, TREASURY_DID, BUSINESS_DID_BIOS_COST);
            if (!result.success) {
                if (result.error === 'insufficient') {
                    return reply.code(402).send({
                        error: 'insufficient_bios',
                        required: BUSINESS_DID_BIOS_COST,
                        available: nous.ousia,
                    });
                }
                return reply.code(400).send({ error: result.error });
            }

            const businessDid = `did:biz:noesis:${randomUUID()}`;
            const registeredAtTick = currentTick(services);
            const credential = await buildBusinessDidVc({
                businessDid,
                civicDid,
                businessName,
                category,
                issuedAtTick: registeredAtTick,
            });

            await bizStore.insert({
                gridName: services.gridName,
                businessDid,
                civicDid,
                businessName,
                category,
                credentialJson: credential,
                status: 'active',
                issuedAtTick: registeredAtTick,
                biosCostPaid: BUSINESS_DID_BIOS_COST,
            });

            appendRegistryBusinessDidRegistered(services.audit, {
                business_did: businessDid,
                civic_did: civicDid,
                grid_name: services.gridName,
                registered_at_tick: registeredAtTick,
            });

            return reply.code(201).send({ business_did: businessDid, credential });
        },
    );

    // [REG-05] GET /api/v1/registry/business-did/:did
    // Public — no auth required. Cache-Control: max-age=60.
    app.get<{ Params: { did: string } }>(
        '/api/v1/registry/business-did/:did',
        async (req, reply) => {
            const bizStore = services.businessDidStore;
            if (!bizStore) return reply.code(503).send({ error: 'business_registry_unavailable' });

            const record = await bizStore.get(services.gridName, req.params.did);
            if (!record) return reply.code(404).send({ error: 'not_found' });

            reply.header('Cache-Control', 'max-age=60');
            return reply.code(200).send({
                status: record.status,
                credential: record.credentialJson,
                dissolved_at_tick: record.dissolvedAtTick ?? null,
            });
        },
    );

    // [REG-06] POST /api/v1/registry/business-did/:did/dissolve
    // government_only — SOLE caller of appendRegistryBusinessDidDissolved (Plan 02 producer).
    // Same court-order discipline as civic-did revoke (constitutional invariant D-V3-18).
    app.post<{ Params: { did: string }; Body: Record<string, unknown> }>(
        '/api/v1/registry/business-did/:did/dissolve',
        async (req, reply) => {
            const bizStore = services.businessDidStore;
            if (!bizStore) return reply.code(503).send({ error: 'business_registry_unavailable' });

            const body = (req.body ?? {}) as Record<string, unknown>;
            const ref = body['court_conviction_ref'];
            // court_conviction_ref is required (court-order discipline) even though the
            // dissolution audit payload omits it per Plan 02 EXPECTED_KEYS closed-tuple.
            if (typeof ref !== 'string' || ref.length === 0) {
                return reply.code(400).send({ error: 'court_conviction_ref_required' });
            }

            const businessDid = req.params.did;
            if (!BIZ_DID_RE.test(businessDid)) {
                return reply.code(400).send({ error: 'invalid_business_did' });
            }

            const existing = await bizStore.get(services.gridName, businessDid);
            if (!existing) return reply.code(404).send({ error: 'not_found' });
            if (existing.status !== 'active') return reply.code(409).send({ error: 'already_dissolved' });

            const dissolvedAtTick = currentTick(services);
            const updated = await bizStore.markDissolved(services.gridName, businessDid, dissolvedAtTick);
            if (!updated) {
                return reply.code(409).send({ error: 'already_dissolved' });
            }

            // Closed-tuple audit payload: civic_did is the OWNER (from BusinessDidRecord),
            // NOT the caller (caller is Government). court_conviction_ref intentionally NOT
            // in the audit payload per Plan 02 EXPECTED_KEYS (4-key closed tuple, privacy).
            appendRegistryBusinessDidDissolved(services.audit, {
                business_did: businessDid,
                civic_did: existing.civicDid,
                dissolved_at_tick: dissolvedAtTick,
                grid_name: services.gridName,
            });

            return reply.code(200).send({ dissolved: true });
        },
    );
}
