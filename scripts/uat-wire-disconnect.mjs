#!/usr/bin/env node
/**
 * scripts/uat-wire-disconnect.mjs
 *
 * UAT harness for Phase 38 WIRE-03/WIRE-04 — exactly-once delivery across
 * a 60-second network sever.
 *
 * Phase 38 success criterion 3:
 *   Brain enqueues events offline (up to 10K), replays via
 *   POST /api/v1/brain/events/batch on reconnect, and each event lands
 *   exactly once in brain_event_ingest.
 *
 * Usage:
 *   node scripts/uat-wire-disconnect.mjs              # full UAT (requires running Grid)
 *   node scripts/uat-wire-disconnect.mjs --dry-run    # prints steps without waiting
 *
 * Environment variables:
 *   GRID_URL          — Grid base URL (default: http://localhost:8080)
 *   UAT_CIVIC_DID     — Civic-DID to use for JWT sub  (default: did:civic:noesis:uat-001)
 *   UAT_BRAIN_DID     — Brain existence-DID for JWT iss (default: did:noesis:nous:uat-brain-001)
 *   UAT_JWT_BEARER    — Pre-minted bearer token (required for non-dry-run)
 *
 * The full 60s sever test (Step 4) requires an operator-level action to stop
 * and restart the Grid container. See scripts/38-HUMAN-UAT.md for the manual
 * UAT playbook.
 *
 * Operator instructions live alongside this script in:
 *   .planning/phases/38-brain-grid-wire-protocol/38-HUMAN-UAT.md
 */

import { createHash, randomBytes } from 'node:crypto';

const DRY_RUN = process.argv.includes('--dry-run');
const GRID_URL = process.env['GRID_URL'] ?? 'http://localhost:8080';
const CIVIC_DID = process.env['UAT_CIVIC_DID'] ?? 'did:civic:noesis:uat-001';
const BRAIN_DID = process.env['UAT_BRAIN_DID'] ?? 'did:noesis:nous:uat-brain-001';
const BEARER = process.env['UAT_JWT_BEARER'] ?? null;

// ── Idempotency key derivation (CANONICAL FORMULA — mirrors queue.py) ─────────
// sha256(f"{brain_did}:{tick}:{event_type}:{payload_hash}")
// payload_hash = sha256(canonical_json(payload))
// canonical_json = JSON.stringify(payload, Object.keys(payload).sort())

function canonicalJson(payload) {
    return JSON.stringify(payload, Object.keys(payload).sort(), undefined)
        .replace(/\s/g, '');
}

function deriveIdempotencyKey(brainDid, tick, eventType, payload) {
    const payloadStr = JSON.stringify(payload, Object.keys(payload).sort());
    const payloadHash = createHash('sha256').update(payloadStr).digest('hex');
    const material = `${brainDid}:${tick}:${eventType}:${payloadHash}`;
    return createHash('sha256').update(material).digest('hex');
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeEvent(tick, seq) {
    const payload = {
        action_type: 'noop',
        channel: '',
        text: `uat-event-${seq}`,
        metadata: { seq, uat: true },
    };
    return {
        idempotency_key: deriveIdempotencyKey(BRAIN_DID, tick, 'noop', payload),
        brain_did: BRAIN_DID,
        tick,
        event_type: 'noop',
        payload,
    };
}

async function postBatch(events, bearer) {
    const url = `${GRID_URL}/api/v1/brain/events/batch`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearer}`,
        },
        body: JSON.stringify({ events }),
    });
    return { status: res.status, body: await res.json() };
}

function assert(condition, message) {
    if (!condition) {
        console.error(`\nFAIL: ${message}`);
        process.exit(1);
    }
}

// ── Dry-run mode ───────────────────────────────────────────────────────────────

if (DRY_RUN) {
    console.log('=== uat-wire-disconnect.mjs — DRY RUN ===');
    console.log('');
    console.log('Steps that would execute:');
    console.log('');
    console.log('  Step 1: Generate 3 unique events with deterministic idempotency keys.');
    console.log(`          POST to ${GRID_URL}/api/v1/brain/events/batch`);
    console.log('          Assert: status=200, accepted=3, duplicate=0');
    console.log('');
    console.log('  Step 2: Resubmit the same 3 events.');
    console.log('          Assert: status=200, accepted=0, duplicate=3');
    console.log('');
    console.log('  Step 3: Mixed batch — 2 new events + 1 already submitted.');
    console.log('          Assert: status=200, accepted=2, duplicate=1');
    console.log('');
    console.log('  Step 4 (MANUAL — requires running Brain + Grid):');
    console.log('    a. Sever Grid network for 60 seconds (stop docker container or block port).');
    console.log('    b. Brain emits N events — all go to SQLite wire_queue (capacity 10 000).');
    console.log('    c. Restore network.');
    console.log('    d. Brain replays via /brain/events/batch automatically.');
    console.log('    e. Query brain_event_ingest: COUNT = N events, no duplicates.');
    console.log('    f. Query audit_trail: chain head matches N accepted events through sole-producer path.');
    console.log('');
    console.log('  Expected output: emitted=N, received=N, queued_peak=N, duplicate_count=0');
    console.log('');
    console.log('Full operator UAT playbook:');
    console.log('  .planning/phases/38-brain-grid-wire-protocol/38-HUMAN-UAT.md');
    console.log('');
    console.log('PASS (dry-run)');
    process.exit(0);
}

// ── Live mode ──────────────────────────────────────────────────────────────────

if (!BEARER) {
    console.error('ERROR: UAT_JWT_BEARER env var must be set to a valid Civic-DID bearer JWT.');
    console.error('       Run with --dry-run to verify script syntax without a live Grid.');
    process.exit(1);
}

console.log('=== uat-wire-disconnect.mjs — LIVE UAT ===');
console.log(`GRID_URL:   ${GRID_URL}`);
console.log(`CIVIC_DID:  ${CIVIC_DID}`);
console.log(`BRAIN_DID:  ${BRAIN_DID}`);
console.log('');

// Step 1: 3 unique events → accepted=3, duplicate=0
console.log('Step 1: POST 3 unique events ...');
const events1 = [makeEvent(1001, 0), makeEvent(1001, 1), makeEvent(1001, 2)];
const r1 = await postBatch(events1, BEARER);
console.log(`  → status=${r1.status} body=${JSON.stringify(r1.body)}`);
assert(r1.status === 200, `expected 200, got ${r1.status}`);
assert(r1.body.accepted === 3, `expected accepted=3, got ${r1.body.accepted}`);
assert(r1.body.duplicate === 0, `expected duplicate=0, got ${r1.body.duplicate}`);
console.log('  PASS');

// Step 2: Same 3 events → accepted=0, duplicate=3
console.log('Step 2: Resubmit same 3 events ...');
const r2 = await postBatch(events1, BEARER);
console.log(`  → status=${r2.status} body=${JSON.stringify(r2.body)}`);
assert(r2.status === 200, `expected 200, got ${r2.status}`);
assert(r2.body.accepted === 0, `expected accepted=0, got ${r2.body.accepted}`);
assert(r2.body.duplicate === 3, `expected duplicate=3, got ${r2.body.duplicate}`);
console.log('  PASS');

// Step 3: Mixed batch (2 new + 1 dup)
console.log('Step 3: Mixed batch (2 new + 1 dup) ...');
const events3 = [
    events1[0],             // dup
    makeEvent(1002, 10),    // new
    makeEvent(1002, 11),    // new
];
const r3 = await postBatch(events3, BEARER);
console.log(`  → status=${r3.status} body=${JSON.stringify(r3.body)}`);
assert(r3.status === 200, `expected 200, got ${r3.status}`);
assert(r3.body.accepted === 2, `expected accepted=2, got ${r3.body.accepted}`);
assert(r3.body.duplicate === 1, `expected duplicate=1, got ${r3.body.duplicate}`);
console.log('  PASS');

console.log('');
console.log('All automated assertions: PASS');
console.log('');
console.log('Step 4 (60s sever + replay) requires manual execution.');
console.log('See: .planning/phases/38-brain-grid-wire-protocol/38-HUMAN-UAT.md');
console.log('');
console.log('PASS');
