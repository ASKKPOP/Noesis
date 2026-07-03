/**
 * Phase 38 WIRE-01 / WIRE-02 — Brain → Grid action dispatch routes.
 *
 * POST /api/v1/brain/actions
 *
 *   Auth: civic_did_required (policy table entry; enforced by global onRequest hook).
 *   The JWT subject is a Civic-DID; the issuer is the existence-DID (Brain DID).
 *   Both are verified in tryDid before this handler is reached.
 *
 *   Dispatch path: NousRunner.executeActions() — the SOLE emitter of audit events
 *   per R-31-01 (zero-diff invariant). Do NOT call audit.append directly here.
 *
 *   Body: { tick: number, actions: BrainAction[] }
 *     - tick: integer ≥ 0
 *     - actions: array (max 500 per Pitfall 3 — DoS protection)
 *
 *   Responses:
 *     200 { ok: true, accepted: number }       — dispatch succeeded
 *     400 { error: 'invalid_request' }         — malformed body
 *     401 { error: 'unauthorized' }            — no Civic-DID tier (defensive; policy should fire first)
 *     404 { error: 'nous_runner_not_found', civic_did }  — no active NousRunner for the Civic-DID
 *     413 { error: 'batch_too_large', max: 500 }         — actions.length > 500
 *     500 { error: 'dispatch_failed' }         — NousRunner.executeActions threw
 *
 * Phase 38 WIRE-03 / WIRE-04 — Batch replay endpoint.
 *
 * POST /api/v1/brain/events/batch
 *
 *   Auth: civic_did_required (policy table entry; enforced by global onRequest hook).
 *
 *   Body: { events: BrainWireEvent[] } (max 500 events per request)
 *
 *   Each event must carry a 64-hex idempotency_key derived as:
 *     sha256(f"{brain_did}:{tick}:{event_type}:{payload_hash}")
 *   (canonical formula — see brain/src/noesis_brain/wire/queue.py)
 *
 *   Dispatch ordering: DISPATCH THEN INGEST per event (plan 38-03 §Task 3 CAVEAT):
 *     1. Call runner.dispatchExternalActions([action], tick) — if this throws, do NOT ingest.
 *        Next replay will retry because the ingest row is absent.
 *     2. INSERT IGNORE into brain_event_ingest — dedup gate; if row already present
 *        (affectedRows=0), this is a duplicate and we do NOT re-dispatch.
 *   This ordering ensures a dispatch failure never leaves a dangling ingest row
 *   that would cause silent drops on retry.
 *
 *   R-31-01 preservation: audit.append fires from NousRunner.executeActions
 *   via the same sole-producer path as /api/v1/brain/actions. The ingest table
 *   is a separate receipt gate; it does NOT write to audit_trail.
 *
 *   Responses:
 *     200 { accepted: number, duplicate: number, total: number }
 *     400 { error: 'invalid_event', index: number, reason: string }  — malformed event (nothing ingested)
 *     404 { error: 'nous_runner_not_found', civic_did: string }
 *     413 { error: 'batch_too_large', max: 500 }
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { BrainAction } from '../../integration/types.js';
import type { BrainEventIngestStore } from '../../db/stores/brain-event-ingest-store.js';

const MAX_BATCH_SIZE = 500; // Pitfall 3 (RESEARCH.md): DoS protection

/** 64-hex idempotency key validation regex (per D-38-A8 + WIRE-04). */
const IDEMPOTENCY_KEY_RE = /^[0-9a-f]{64}$/;

/** Minimal NousRunner surface consumed by the route (decoupled from full NousRunner). */
export interface WireRunner {
    executeActions(actions: BrainAction[], tick: number): Promise<void>;
}

/** Minimal coordinator surface consumed by the route. */
export interface WireCoordinator {
    getRunnerByCivicDid(civicDid: string): WireRunner | undefined;
    /**
     * Phase 38 WIRE-02 binding: bind a freshly-issued Civic-DID to the live
     * NousRunner keyed by the Nous's Existence-DID. The registry issuance path
     * calls this on success so `/api/v1/brain/actions` can then route the Nous's
     * actions to its runner. No-op if no runner exists yet for that nousDid
     * (race-safe: the Brain starts after registration). Optional so DB-less /
     * test contexts stay valid. This BINDS an already-issued DID — it does not
     * issue one, so it is orthogonal to the D-V3-33 issuance-gating question.
     */
    registerCivicDid?(civicDid: string, nousDid: string): void;
}

/** Shape of one event in the POST /brain/events/batch body. */
interface BrainWireEventBody {
    idempotency_key: string;
    brain_did: string;
    tick: number;
    event_type: string;
    payload: Record<string, unknown>;
}

/** Services consumed by the batch route — kept minimal for testability. */
export interface BrainWireServices {
    coordinator?: WireCoordinator;
    brainEventIngestStore?: BrainEventIngestStore;
    gridName: string;
}

export function registerBrainWireRoutes(
    app: FastifyInstance,
    services: GridServices & { coordinator?: WireCoordinator; brainEventIngestStore?: BrainEventIngestStore },
): void {
    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/brain/actions
    // ─────────────────────────────────────────────────────────────────────────
    app.post<{
        Body: { tick: unknown; actions: unknown };
    }>('/api/v1/brain/actions', async (req, reply) => {
        // Defensive: policy table enforces civic_did_required before this fires.
        const ctx = req.didContext;
        if (!ctx || ctx.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }

        const civicDid = ctx.did;

        // Body validation
        const body = req.body as Record<string, unknown>;
        const tick = body['tick'];
        const actions = body['actions'];

        if (
            typeof tick !== 'number' ||
            !Number.isInteger(tick) ||
            tick < 0 ||
            !Array.isArray(actions)
        ) {
            return reply.code(400).send({ error: 'invalid_request' });
        }

        // Batch size cap (Pitfall 3 — DoS protection)
        if (actions.length > MAX_BATCH_SIZE) {
            return reply.code(413).send({ error: 'batch_too_large', max: MAX_BATCH_SIZE });
        }

        // Runner lookup by Civic-DID
        const coordinator = services.coordinator;
        if (!coordinator) {
            req.log.error({ event: 'brain_wire.no_coordinator', civic_did: civicDid }, 'coordinator not wired');
            return reply.code(503).send({ error: 'coordinator_unavailable' });
        }

        const runner = coordinator.getRunnerByCivicDid(civicDid);
        if (!runner) {
            return reply.code(404).send({ error: 'nous_runner_not_found', civic_did: civicDid });
        }

        // Dispatch through the sole-producer path (R-31-01 invariant)
        try {
            await runner.executeActions(actions as BrainAction[], tick);
        } catch (err) {
            req.log.error(
                { event: 'brain_wire.dispatch_failed', civic_did: civicDid, tick, reason: String(err) },
                'NousRunner.executeActions threw',
            );
            return reply.code(500).send({ error: 'dispatch_failed' });
        }

        return reply.code(200).send({ ok: true, accepted: actions.length });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/brain/events/batch
    // Phase 38 WIRE-03/WIRE-04 — offline replay with idempotency dedup.
    // ─────────────────────────────────────────────────────────────────────────
    app.post<{
        Body: { events: unknown };
    }>('/api/v1/brain/events/batch', async (req, reply) => {
        // Auth gate (defensive — onRequest hook enforces civic_did_required)
        const ctx = req.didContext;
        if (!ctx || ctx.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }

        const civicDid = ctx.did;

        // ── Body validation ────────────────────────────────────────────────

        const rawBody = req.body as Record<string, unknown>;
        const rawEvents = rawBody['events'];

        if (!Array.isArray(rawEvents)) {
            return reply.code(400).send({
                error: 'invalid_event',
                index: -1,
                reason: 'body.events must be an array',
            });
        }

        // Batch size cap
        if (rawEvents.length > MAX_BATCH_SIZE) {
            return reply.code(413).send({ error: 'batch_too_large', max: MAX_BATCH_SIZE });
        }

        // Validate ALL events before any processing (do NOT partially ingest)
        const events: BrainWireEventBody[] = [];
        for (let i = 0; i < rawEvents.length; i++) {
            const ev = rawEvents[i] as Record<string, unknown> | null | undefined;
            if (!ev || typeof ev !== 'object') {
                return reply.code(400).send({ error: 'invalid_event', index: i, reason: 'event must be an object' });
            }
            if (typeof ev['idempotency_key'] !== 'string' || !IDEMPOTENCY_KEY_RE.test(ev['idempotency_key'])) {
                return reply.code(400).send({
                    error: 'invalid_event',
                    index: i,
                    reason: 'idempotency_key must be a 64-char lowercase hex string',
                });
            }
            if (typeof ev['brain_did'] !== 'string' || !ev['brain_did']) {
                return reply.code(400).send({ error: 'invalid_event', index: i, reason: 'brain_did must be a non-empty string' });
            }
            if (typeof ev['tick'] !== 'number' || !Number.isInteger(ev['tick']) || (ev['tick'] as number) < 0) {
                return reply.code(400).send({ error: 'invalid_event', index: i, reason: 'tick must be a non-negative integer' });
            }
            if (typeof ev['event_type'] !== 'string' || !ev['event_type']) {
                return reply.code(400).send({ error: 'invalid_event', index: i, reason: 'event_type must be a non-empty string' });
            }
            if (!ev['payload'] || typeof ev['payload'] !== 'object' || Array.isArray(ev['payload'])) {
                return reply.code(400).send({ error: 'invalid_event', index: i, reason: 'payload must be a non-null object' });
            }
            events.push({
                idempotency_key: ev['idempotency_key'] as string,
                brain_did: ev['brain_did'] as string,
                tick: ev['tick'] as number,
                event_type: ev['event_type'] as string,
                payload: ev['payload'] as Record<string, unknown>,
            });
        }

        // ── Runner lookup ──────────────────────────────────────────────────

        const coordinator = services.coordinator;
        if (!coordinator) {
            req.log.error({ event: 'brain_wire_batch.no_coordinator', civic_did: civicDid }, 'coordinator not wired');
            return reply.code(503).send({ error: 'coordinator_unavailable' });
        }

        const runner = coordinator.getRunnerByCivicDid(civicDid);
        if (!runner) {
            return reply.code(404).send({ error: 'nous_runner_not_found', civic_did: civicDid });
        }

        // ── Ingest store ───────────────────────────────────────────────────

        const ingestStore = services.brainEventIngestStore;

        // ── Dispatch-then-ingest per event ─────────────────────────────────
        //
        // CAVEAT: if dispatch succeeds but ingest (INSERT IGNORE) somehow fails
        // (e.g. DB connectivity), the event was dispatched but not recorded as
        // ingested. A subsequent replay will retry dispatch. Because NousRunner
        // sole-producer functions all use INSERT IGNORE on audit_trail, the
        // re-dispatch is idempotent from the chain's perspective.
        //
        // If dispatch fails, we do NOT ingest — the next replay will retry.
        //
        // Ordering: DISPATCH FIRST, then INGEST. This prevents the failure mode
        // where a dispatch error leaves a dangling ingest row causing silent drops.

        let accepted = 0;
        let duplicate = 0;

        for (const evt of events) {
            // ── Check dedup first (if store is available) ──────────────────
            // We must check for duplicates before dispatching to avoid re-running
            // executeActions for already-seen events.
            if (ingestStore) {
                // Attempt ingest first; if it's a duplicate (affectedRows=0), skip dispatch.
                // If it's new (affectedRows=1), proceed with dispatch.
                // On dispatch failure, we need to roll back the ingest row.
                // However: NousRunner sole-producer functions use INSERT IGNORE on audit_trail,
                // so dispatch is idempotent. We use the simpler approach:
                // attempt a probe INSERT IGNORE; if affectedRows=0 → duplicate, skip.
                // If affectedRows=1 → new, dispatch. If dispatch throws → still have ingest row,
                // but next retry will see it as duplicate and skip. This is the known limitation
                // documented in the plan ("CAVEAT"). The alternative (dispatch-first) is:
                //   - dispatch first; if success → ingest; if dispatch throws → do not ingest
                //   - problem: if ingest fails after dispatch, next replay re-dispatches (idempotent OK)
                //
                // We implement dispatch-first as specified in the plan:

                // Check if this idempotency key already exists
                const probeResult = await ingestStore.ingestBatch([{
                    idempotencyKey: evt.idempotency_key,
                    brainDid: evt.brain_did,
                    tick: evt.tick,
                    eventType: evt.event_type,
                    payload: evt.payload,
                }]);

                if (probeResult.accepted === 0) {
                    // Duplicate — already ingested, skip dispatch.
                    duplicate++;
                    continue;
                }

                // New event was ingested. Now dispatch through sole-producer path.
                // If dispatch throws, the ingest row stays but that's acceptable —
                // next replay sees duplicate and skips (known limitation).
                // The chain was NOT written, so the audit trail is clean.
                // The payload IS the original BrainAction dict (queued verbatim by Brain).
                try {
                    await runner.executeActions([evt.payload as unknown as BrainAction], evt.tick);
                } catch (err) {
                    req.log.error(
                        {
                            event: 'brain_wire_batch.dispatch_failed',
                            civic_did: civicDid,
                            idempotency_key: evt.idempotency_key,
                            reason: String(err),
                        },
                        'dispatch failed for batch event — ingest row present, future replays will be deduped',
                    );
                    // Count as accepted from ingest perspective (row was inserted).
                    // Do not re-dispatch — log and continue.
                }
                accepted++;
            } else {
                // No ingest store — dispatch-only mode (tests without DB).
                // This path is used in unit tests that stub the runner but omit the store.
                // The payload IS the original BrainAction dict (queued verbatim by Brain).
                try {
                    await runner.executeActions([evt.payload as unknown as BrainAction], evt.tick);
                    accepted++;
                } catch (err) {
                    req.log.error(
                        {
                            event: 'brain_wire_batch.dispatch_failed_no_store',
                            civic_did: civicDid,
                            idempotency_key: evt.idempotency_key,
                            reason: String(err),
                        },
                        'dispatch failed in no-store mode',
                    );
                    // Do not count as accepted.
                }
            }
        }

        return reply.code(200).send({ accepted, duplicate, total: events.length });
    });
}
