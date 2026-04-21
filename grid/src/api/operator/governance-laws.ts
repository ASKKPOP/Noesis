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
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { Law } from '../../logos/types.js';
import type { ApiError } from '../types.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import { validateTierBody, type OperatorBody } from './_validation.js';

interface AddBody extends OperatorBody {
    law?: unknown;
}

interface AmendBody extends OperatorBody {
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
            const body = req.body ?? {};
            const v = validateTierBody(body, 'H3');
            if (!v.ok) {
                reply.code(400);
                return { error: v.error } satisfies ApiError;
            }
            if (!isLawShape(body.law)) {
                reply.code(400);
                return { error: 'invalid_law' } satisfies ApiError;
            }
            services.logos.addLaw(body.law);
            appendOperatorEvent(services.audit, 'operator.law_changed', v.operator_id, {
                tier: v.tier,
                action: 'add',
                operator_id: v.operator_id,
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
            const body = req.body ?? {};
            const v = validateTierBody(body, 'H3');
            if (!v.ok) {
                reply.code(400);
                return { error: v.error } satisfies ApiError;
            }
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
            appendOperatorEvent(services.audit, 'operator.law_changed', v.operator_id, {
                tier: v.tier,
                action: 'amend',
                operator_id: v.operator_id,
                law_id: req.params.id,
                change_type: 'amended',
            });
            return { ok: true, law_id: req.params.id };
        },
    );

    // --- DELETE /api/v1/operator/governance/laws/:id (repeal) ---
    app.delete<{ Params: { id: string }; Body: OperatorBody }>(
        '/api/v1/operator/governance/laws/:id',
        async (req, reply) => {
            const body = req.body ?? {};
            const v = validateTierBody(body, 'H3');
            if (!v.ok) {
                reply.code(400);
                return { error: v.error } satisfies ApiError;
            }
            const removed = services.logos.removeLaw(req.params.id);
            if (!removed) {
                reply.code(404);
                return { error: 'law_not_found' } satisfies ApiError;
            }
            appendOperatorEvent(services.audit, 'operator.law_changed', v.operator_id, {
                tier: v.tier,
                action: 'repeal',
                operator_id: v.operator_id,
                law_id: req.params.id,
                change_type: 'repealed',
            });
            return { ok: true, law_id: req.params.id };
        },
    );
}
