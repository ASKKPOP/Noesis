#!/usr/bin/env node
/**
 * scripts/uat-half-close-socket.mjs
 *
 * Phase 32 OBS-05 UAT Step 3 helper (D-32-D3 + Claude's Discretion).
 *
 * Connects to the grid firehose WebSocket, waits for the hello frame, then
 * calls ws.terminate() — a hard TCP reset with no graceful CLOSE handshake.
 * The server-side socket enters a half-open state; the next socket.send
 * attempt throws → ClientConnection.trySend's catch swallows → counter
 * never increments. R-32-03 mitigation verified in production.
 *
 * Usage:
 *   node scripts/uat-half-close-socket.mjs [ws-url]
 *
 *   Default URL: ws://localhost:8080/api/v1/audit/firehose
 *
 * Expected operator workflow:
 *   1. curl http://localhost:8080/health/detailed | jq '.firehose'
 *      → record frames_sent_total + frames_dropped_total
 *   2. Run this script.
 *   3. Wait 5s for buffer to fill.
 *   4. curl http://localhost:8080/health/detailed | jq '.firehose'
 *      → assert frames_dropped_total INCREASED (overflow on the half-open client)
 *      → assert other clients continued receiving (frames_sent_total to other
 *        connections kept advancing — observable via Steward /firehose tab).
 */

import { WebSocket } from 'ws';

const DEFAULT_URL = 'ws://localhost:8080/api/v1/audit/firehose';
const url = process.argv[2] ?? DEFAULT_URL;

console.log(`[uat-half-close] connecting to ${url} ...`);

const ws = new WebSocket(url);

ws.on('open', () => {
    console.log('[uat-half-close] connected — waiting for hello frame');
});

ws.on('message', (data) => {
    let frame;
    try {
        frame = JSON.parse(data.toString());
    } catch {
        console.log('[uat-half-close] received non-JSON frame, ignoring');
        return;
    }
    console.log(`[uat-half-close] received: ${frame.type}`);
    if (frame.type === 'hello') {
        console.log('[uat-half-close] hard-terminating (ws.terminate) — server send will throw on next frame');
        ws.terminate();
        console.log('');
        console.log('Next steps:');
        console.log('  1. Wait 5s for buffer overflow.');
        console.log('  2. curl http://localhost:8080/health/detailed | jq .firehose');
        console.log('     - frames_dropped_total should have INCREASED (Phase 32 OBS-05 R-32-03).');
        console.log('     - frames_sent_total to other clients should still be advancing.');
        process.exit(0);
    }
});

ws.on('error', (err) => {
    console.error('[uat-half-close] websocket error:', err.message);
    process.exit(1);
});

ws.on('close', (code, reason) => {
    console.log(`[uat-half-close] socket closed (code=${code}, reason=${reason ?? '<empty>'})`);
});

// Safety timeout — exit after 30s if hello never arrives.
setTimeout(() => {
    console.error('[uat-half-close] timeout — no hello frame after 30s');
    process.exit(2);
}, 30_000);
