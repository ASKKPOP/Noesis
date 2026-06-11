/**
 * Human Civic-DID application routes (2026-06-10) — brings Phase 54's HUMAN
 * track forward. D-V3-33 pipeline, all three stages in order:
 *
 *   1. PORTAL pre-screen   — valid portal session, account exists
 *   2. POLIS charter review — reviewHumanCivicApplication (civic-registry/human-charter-review.ts)
 *   3. REGISTRY issuance    — civicDidStore.insert + registry.civic_did_issued_human
 *
 * POST /api/v1/portal/civic/apply        — submit (or re-submit after rejection)
 * GET  /api/v1/portal/civic/application  — own application status + canonical oath
 *
 * Policy: 'public' in ROUTE_DID_POLICY with in-handler cookie verification —
 * the same convention as every other /api/v1/portal/* route (auth.ts, chat.ts).
 * Privacy: the statement stays in human_civic_applications (Grid-side); audit
 * events carry ids/ticks/closed reason codes only.
 */

import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { jwtVerify } from 'jose';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';
import { buildCivicDidVc } from '../../civic-registry/vc-builder.js';
import {
    HUMAN_CIVIC_OATH,
    reviewHumanCivicApplication,
} from '../../civic-registry/human-charter-review.js';
import { appendPortalRegistrationRequested } from '../../audit/append-portal-registration-requested.js';
import { appendPolisRegistrationPending } from '../../audit/append-polis-registration-pending.js';
import { appendPortalRegistrationApproved } from '../../audit/append-portal-registration-approved.js';
import { appendPortalRegistrationRejected } from '../../audit/append-portal-registration-rejected.js';
import { appendRegistryCivicDidIssuedHuman } from '../../audit/append-registry-civic-did-issued-human.js';

const HUMAN_DID_RE = /^did:noesis:human:[a-z0-9_:\-]+$/i;

interface ApplicationRow {
    application_id: string;
    status: 'pending' | 'approved' | 'rejected';
    reason_code: string | null;
    civic_did: string | null;
    requested_at_tick: number;
    decided_at_tick: number | null;
}

function currentTick(services: GridServices): number {
    return services.clock?.state?.tick ?? 0;
}

/** Cookie → verified human operator-DID, or null (caller sends 401). */
async function resolveHumanDid(req: { cookies: unknown }): Promise<string | null> {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) return null;
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        const did = payload['did'];
        if (typeof did !== 'string' || !HUMAN_DID_RE.test(did)) return null;
        return did;
    } catch {
        return null;
    }
}

export function registerPortalCivicRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // ── POST /api/v1/portal/civic/apply ──────────────────────────────────────
    app.post<{ Body: Record<string, unknown> }>(
        '/api/v1/portal/civic/apply',
        async (req, reply) => {
            const pool = services.humanPool;
            const store = services.civicDidStore;
            const audit = services.audit;
            if (!pool || !store || !audit) {
                return reply.code(503).send({ error: 'civic_applications_unavailable' });
            }

            const humanDid = await resolveHumanDid(req);
            if (!humanDid) return reply.code(401).send({ error: 'not_authenticated' });

            const body = (req.body ?? {}) as Record<string, unknown>;
            const statement = body['statement'];
            const oathText = body['oath_text'];
            if (typeof statement !== 'string' || typeof oathText !== 'string') {
                return reply.code(400).send({ error: 'invalid_request' });
            }

            // Portal pre-screen: the account must exist (and carries sanction flags).
            // human_users rows only exist once something persisted them (e.g. operator
            // sanctions) — day-to-day accounts live in the in-memory HumanRegistry
            // (see HumanRegistry.ts), so fall back to it for existence. Absence of a
            // human_users row means no sanctions on record.
            const [userRows] = await pool.query(
                'SELECT frozen, banned FROM human_users WHERE did = ? LIMIT 1',
                [humanDid],
            ) as [Array<{ frozen: 0 | 1; banned: 0 | 1 }>, unknown];
            const user = userRows[0];
            if (!user && !services.humanRegistry?.findByDid(services.gridName, humanDid)) {
                return reply.code(404).send({ error: 'account_not_found' });
            }

            // Approved before? Idempotent answer with the existing Civic-DID.
            const [appRows] = await pool.query(
                `SELECT application_id, status, civic_did FROM human_civic_applications
                 WHERE grid_name = ? AND human_did = ? LIMIT 1`,
                [services.gridName, humanDid],
            ) as [Array<Pick<ApplicationRow, 'application_id' | 'status' | 'civic_did'>>, unknown];
            const existingApp = appRows[0];
            if (existingApp?.status === 'approved') {
                return reply.code(409).send({
                    error: 'already_registered',
                    civic_did: existingApp.civic_did,
                });
            }

            const existingCivic = await store.getByExistenceDid(services.gridName, humanDid);
            const alreadyRegistered = existingCivic?.status === 'active';

            // Record the application (re-apply after rejection reuses the row — uq per human).
            const applicationId = randomUUID();
            const requestedAtTick = currentTick(services);
            await pool.query(
                `INSERT INTO human_civic_applications
                    (application_id, grid_name, human_did, statement, status, requested_at_tick)
                 VALUES (?, ?, ?, ?, 'pending', ?)
                 ON DUPLICATE KEY UPDATE
                    application_id = VALUES(application_id),
                    statement = VALUES(statement),
                    status = 'pending',
                    reason_code = NULL,
                    requested_at_tick = VALUES(requested_at_tick),
                    decided_at_tick = NULL`,
                [applicationId, services.gridName, humanDid, statement, requestedAtTick],
            );

            // Stage 1 — Portal accepted the request.
            appendPortalRegistrationRequested(audit, {
                application_id: applicationId,
                grid_name: services.gridName,
                human_did: humanDid,
                requested_at_tick: requestedAtTick,
            });

            // Stage 2 — forwarded to the Genesis Polis for charter review.
            appendPolisRegistrationPending(audit, {
                application_id: applicationId,
                forwarded_at_tick: requestedAtTick,
                grid_name: services.gridName,
            });

            const verdict = reviewHumanCivicApplication({
                oathText,
                statement,
                frozen: user?.frozen === 1,
                banned: user?.banned === 1,
                alreadyRegistered,
            });

            const decidedAtTick = currentTick(services);

            if (!verdict.approved) {
                await pool.query(
                    `UPDATE human_civic_applications
                     SET status = 'rejected', reason_code = ?, decided_at_tick = ?
                     WHERE application_id = ?`,
                    [verdict.reasonCode, decidedAtTick, applicationId],
                );
                appendPortalRegistrationRejected(audit, {
                    application_id: applicationId,
                    grid_name: services.gridName,
                    reason_code: verdict.reasonCode,
                    rejected_at_tick: decidedAtTick,
                });
                return reply.code(200).send({
                    status: 'rejected',
                    reason_code: verdict.reasonCode,
                });
            }

            // Stage 3 — Registry issuance. The 'human' sub-segment keeps human
            // Civic-DIDs queryably distinct from Nous ones while matching CIVIC_DID_RE.
            const civicDid = `did:civic:noesis:human:${randomUUID()}`;
            const credential = await buildCivicDidVc({
                civicDid,
                existenceDid: humanDid,
                issuedAtTick: decidedAtTick,
                existencePublicKeyJwk: null,
            });
            try {
                await store.insert({
                    gridName: services.gridName,
                    civicDid,
                    existenceDid: humanDid,
                    credentialJson: credential,
                    status: 'active',
                    issuedAtTick: decidedAtTick,
                    existencePublicKeyJwk: null,
                });
            } catch (err) {
                const code = (err as { code?: string }).code;
                if (code === 'ER_DUP_ENTRY') {
                    return reply.code(409).send({ error: 'already_registered' });
                }
                throw err;
            }

            await pool.query(
                `UPDATE human_civic_applications
                 SET status = 'approved', civic_did = ?, decided_at_tick = ?
                 WHERE application_id = ?`,
                [civicDid, decidedAtTick, applicationId],
            );

            appendRegistryCivicDidIssuedHuman(audit, {
                civic_did: civicDid,
                grid_name: services.gridName,
                human_did: humanDid,
                issued_at_tick: decidedAtTick,
            });
            appendPortalRegistrationApproved(audit, {
                application_id: applicationId,
                approved_at_tick: decidedAtTick,
                grid_name: services.gridName,
                human_did: humanDid,
            });

            return reply.code(201).send({
                status: 'approved',
                civic_did: civicDid,
                credential,
            });
        },
    );

    // ── GET /api/v1/portal/civic/application ─────────────────────────────────
    app.get('/api/v1/portal/civic/application', async (req, reply) => {
        const pool = services.humanPool;
        if (!pool) return reply.code(503).send({ error: 'civic_applications_unavailable' });

        const humanDid = await resolveHumanDid(req);
        if (!humanDid) return reply.code(401).send({ error: 'not_authenticated' });

        const [rows] = await pool.query(
            `SELECT application_id, status, reason_code, civic_did, requested_at_tick, decided_at_tick
             FROM human_civic_applications
             WHERE grid_name = ? AND human_did = ? LIMIT 1`,
            [services.gridName, humanDid],
        ) as [ApplicationRow[], unknown];
        const row = rows[0];

        return reply.send({
            oath_text: HUMAN_CIVIC_OATH,
            application: row
                ? {
                    status: row.status,
                    reason_code: row.reason_code,
                    civic_did: row.civic_did,
                    requested_at_tick: row.requested_at_tick,
                    decided_at_tick: row.decided_at_tick,
                }
                : null,
        });
    });
}
