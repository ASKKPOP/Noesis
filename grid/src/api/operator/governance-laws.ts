/**
 * Operator governance CRUD: POST / PUT / DELETE /api/v1/operator/governance/laws.
 *
 * Phase 6 AGENCY-02 H3 actions (D-09). Each mutation emits exactly one
 * operator.law_changed audit event via appendOperatorEvent — the sanctioned
 * producer boundary from Plan 01 that enforces tier-required (D-13) and
 * payload-privacy (D-12) invariants at a single chokepoint.
 *
 * PRIVACY INVARIANT (D-11, T-6-06 closure): the audit payload is a closed
 * tuple {tier, action, operator_id, law_id, change_type}. Law body fields
 * (title, description, ruleLogic, severity, status) NEVER appear in the
 * payload literal. Any review PR that adds a new key here MUST pass the
 * governance.test.ts Test 8 structural assertion, which would fail the moment
 * an extra key appears.
 *
 * Law body text is still accessible through GET /api/v1/governance/laws/:id
 * (the existing Phase 4 read endpoint, not broadcast-scoped). Operators who
 * need to see what was changed request the law directly.
 *
 * AUTH MODEL (D-25b-NEW-1, Wave 0 header-auth migration):
 *   tier and operator_id are derived from server-trusted request headers
 *   (x-operator-tier, x-operator-id) — NOT from the request body. Body-supplied
 *   tier/operator_id fields are ignored. Non-auth body fields (law, updates) are
 *   preserved.
 *
 * ERROR LADDER (no 500s):
 *   400 — invalid_law (body law shape invalid), invalid_updates (body updates missing),
 *          invalid_operator_id (x-operator-id header missing or bad format)
 *   401 — tier_missing (x-operator-tier header absent / non-numeric)
 *   403 — tier_too_low (x-operator-tier < 3)
 *   404 — law_not_found (PUT/DELETE on unknown law id)
 *   200 — success with audit emit
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { Law } from '../../logos/types.js';
import type { ApiError } from '../types.js';
import { OPERATOR_ID_REGEX } from '../types.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';

interface AddBody {
    law?: unknown;
}

interface AmendBody {
    updates?: unknown;
}

function isLawShape(v: unknown): v is Law {
    if (!v || typeof v !== 'object') return false;
    const x = v as Record<string, unknown>;
    return typeof x.id === 'string'
        && typeof x.title === 'string'
        && typeof x.description === 'string'
        && typeof x.ruleLogic === 'object'
        && typeof x.status === 'string'
        && typeof x.severity === 'string';
}

export function registerGovernanceOperatorRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // --- POST /api/v1/operator/governance/laws (add) ---
    app.post<{ Body: AddBody }>(
        '/api/v1/operator/governance/laws',
        async (req, reply) => {
            // 1. Tier gate — read from server-trusted x-operator-tier header (D-25b-NEW-1).
            //    Body fields tier/operator_id are NOT trusted.
            const tierHeader = req.headers['x-operator-tier'];
            if (typeof tierHeader !== 'string') {
                reply.code(401);
                return { error: 'tier_missing' } satisfies ApiError;
            }
            const tierNum = parseInt(tierHeader, 10);
            if (!Number.isFinite(tierNum)) {
                reply.code(401);
                return { error: 'tier_missing' } satisfies ApiError;
            }
            if (tierNum < 3) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }

            // 1b. Operator-id gate — read from server-trusted x-operator-id header.
            const opIdHeader = req.headers['x-operator-id'];
            if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
                reply.code(400);
                return { error: 'invalid_operator_id' } satisfies ApiError;
            }
            const resolvedTier: 'H3' = 'H3';
            const resolvedOperatorId = opIdHeader;

            const body = req.body ?? {};
            if (!isLawShape(body.law)) {
                reply.code(400);
                return { error: 'invalid_law' } satisfies ApiError;
            }
            services.logos.addLaw(body.law);
            appendOperatorEvent(services.audit, 'operator.law_changed', resolvedOperatorId, {
                tier: resolvedTier,
                action: 'add',
                operator_id: resolvedOperatorId,
                law_id: body.law.id,
                change_type: 'added',
            });
            return { ok: true, law_id: body.law.id };
        },
    );

    // --- PUT /api/v1/operator/governance/laws/:id (amend) ---
    app.put<{ Params: { id: string }; Body: AmendBody }>(
        '/api/v1/operator/governance/laws/:id',
        async (req, reply) => {
            // 1. Tier gate — read from server-trusted x-operator-tier header (D-25b-NEW-1).
            const tierHeader = req.headers['x-operator-tier'];
            if (typeof tierHeader !== 'string') {
                reply.code(401);
                return { error: 'tier_missing' } satisfies ApiError;
            }
            const tierNum = parseInt(tierHeader, 10);
            if (!Number.isFinite(tierNum)) {
                reply.code(401);
                return { error: 'tier_missing' } satisfies ApiError;
            }
            if (tierNum < 3) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }

            // 1b. Operator-id gate — read from server-trusted x-operator-id header.
            const opIdHeader = req.headers['x-operator-id'];
            if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
                reply.code(400);
                return { error: 'invalid_operator_id' } satisfies ApiError;
            }
            const resolvedTier: 'H3' = 'H3';
            const resolvedOperatorId = opIdHeader;

            const body = req.body ?? {};
            const updates = body.updates;
            if (!updates || typeof updates !== 'object') {
                reply.code(400);
                return { error: 'invalid_updates' } satisfies ApiError;
            }
            const amended = services.logos.amendLaw(
                req.params.id,
                updates as Partial<Omit<Law, 'id'>>,
            );
            if (!amended) {
                reply.code(404);
                return { error: 'law_not_found' } satisfies ApiError;
            }
            appendOperatorEvent(services.audit, 'operator.law_changed', resolvedOperatorId, {
                tier: resolvedTier,
                action: 'amend',
                operator_id: resolvedOperatorId,
                law_id: req.params.id,
                change_type: 'amended',
            });
            return { ok: true, law_id: req.params.id };
        },
    );

    // --- DELETE /api/v1/operator/governance/laws/:id (repeal) ---
    app.delete<{ Params: { id: string }; Body: never }>(
        '/api/v1/operator/governance/laws/:id',
        async (req, reply) => {
            // 1. Tier gate — read from server-trusted x-operator-tier header (D-25b-NEW-1).
            const tierHeader = req.headers['x-operator-tier'];
            if (typeof tierHeader !== 'string') {
                reply.code(401);
                return { error: 'tier_missing' } satisfies ApiError;
            }
            const tierNum = parseInt(tierHeader, 10);
            if (!Number.isFinite(tierNum)) {
                reply.code(401);
                return { error: 'tier_missing' } satisfies ApiError;
            }
            if (tierNum < 3) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }

            // 1b. Operator-id gate — read from server-trusted x-operator-id header.
            const opIdHeader = req.headers['x-operator-id'];
            if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
                reply.code(400);
                return { error: 'invalid_operator_id' } satisfies ApiError;
            }
            const resolvedTier: 'H3' = 'H3';
            const resolvedOperatorId = opIdHeader;

            const removed = services.logos.removeLaw(req.params.id);
            if (!removed) {
                reply.code(404);
                return { error: 'law_not_found' } satisfies ApiError;
            }
            appendOperatorEvent(services.audit, 'operator.law_changed', resolvedOperatorId, {
                tier: resolvedTier,
                action: 'repeal',
                operator_id: resolvedOperatorId,
                law_id: req.params.id,
                change_type: 'repealed',
            });
            return { ok: true, law_id: req.params.id };
        },
    );
}
