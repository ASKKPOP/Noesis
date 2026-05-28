/**
 * Phase 42 P2P-03 — coturn REST API HMAC-SHA1 short-lived credentials.
 * Standard coturn --use-auth-secret mode. NO DB; coturn validates stateless.
 * D-42-03: TURN is FREE in v3.0 (Civic-DID auth only, no Bios deduction).
 * T-42-02-05: TURN_STATIC_AUTH_SECRET env var only; never logged; never echoed in response.
 */
import { createHmac } from 'node:crypto';
import { TURN_TTL_SECONDS, TURN_REALM, type TurnCredentials } from './types.js';

/**
 * Generate short-lived TURN credentials for coturn --use-auth-secret mode.
 *
 * @param civicDid - The caller's Civic-DID (bound into the username)
 * @param sharedSecret - TURN_STATIC_AUTH_SECRET env var value
 * @returns TurnCredentials with username, password (HMAC-SHA1), ttl, realm
 */
export function generateTurnCredentials(
    civicDid: string,
    sharedSecret: string,
): TurnCredentials {
    const expiry = Math.floor(Date.now() / 1000) + TURN_TTL_SECONDS;
    const username = `${expiry}:${civicDid}`;
    const password = createHmac('sha1', sharedSecret).update(username).digest('base64');
    return { username, password, ttl: TURN_TTL_SECONDS, realm: TURN_REALM };
}
