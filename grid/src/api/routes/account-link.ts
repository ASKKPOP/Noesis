/**
 * Phase 62 (D-MONEY-02) — wallet-proof route: a Nous binds its Civic-DID to its
 * on-chain NousAccount by signing the binding message with the account owner's EOA.
 *
 *   POST /api/v1/portal/account/link  — citizen self-service: submit the wallet-proof.
 *   GET  /api/v1/portal/account/link  — resolve the caller's own link.
 *
 * ZERO CUSTODY: the Grid never holds a key. It only recovers the signer from the
 * signature (ethers verifyMessage) and stores the DID → account binding. On-chain
 * proof that `owner == NousAccount.owner()` is deferred to an indexer (per the store doc).
 *
 * AUTH (server-trusted — the caller's Civic-DID is taken from the session, NEVER the body,
 * so a caller can only link ITS OWN DID):
 *   - policy portal_session_required → requirePortalSession runs in the central hook
 *     (401 for anonymous) BEFORE the handler.
 *   - the handler then enforces tier === 'civic_member' + CIVIC_DID_RE (401 for a
 *     human_visitor / non-civic session) and rejects a human Civic-DID with 403 (the
 *     first increment is Nous accounts; Group/Holding linking is a follow-up).
 */
import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import type { GridServices } from '../server.js';
import { AccountLinkStore, AccountLinkError } from '../../economy/account-link-store.js';
import { appendPortalAccountLinked } from '../../audit/append-portal-account-linked.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const HUMAN_CIVIC_DID_RE = /^did:civic:noesis:human:/i;

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

interface LinkBody {
    nous_account?: unknown;
    signature?: unknown;
}

/**
 * Resolve the caller's own Civic-DID from the (already-verified) session context,
 * enforcing the Nous-only gate. Returns null after sending the error response:
 *   - 401 unauthorized  — not a civic_member (anon / human_visitor / non-civic)
 *   - 403 humans_cannot_link_accounts — a human Civic-DID (first increment is Nous)
 */
function requireNousCaller(
    req: import('fastify').FastifyRequest,
    reply: import('fastify').FastifyReply,
): string | null {
    const ctx = req.didContext;
    const did = ctx?.did;
    if (!did || ctx?.tier !== 'civic_member' || !CIVIC_DID_RE.test(did)) {
        reply.code(401).send({ error: 'unauthorized' });
        return null;
    }
    if (HUMAN_CIVIC_DID_RE.test(did)) {
        reply.code(403).send({ error: 'humans_cannot_link_accounts' });
        return null;
    }
    return did;
}

export function registerAccountLinkRoute(app: FastifyInstance, services: GridServices): void {
    app.post<{ Body: LinkBody }>('/api/v1/portal/account/link', async (req, reply) => {
        const did = requireNousCaller(req, reply);
        if (!did) return;

        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const body = req.body ?? {};
        const nousAccount = body.nous_account;
        const signature = body.signature;
        if (typeof nousAccount !== 'string' || nousAccount === '') {
            return reply.code(400).send({ error: 'invalid_account_address' });
        }
        if (typeof signature !== 'string' || signature === '') {
            return reply.code(400).send({ error: 'invalid_signature' });
        }

        const tick = services.currentTick ? services.currentTick() : 0;

        let link;
        try {
            const store = new AccountLinkStore(pool, services.gridName);
            link = await store.verifyAndLink({ civicDid: did, nousAccount, signature, tick });
        } catch (err) {
            if (err instanceof AccountLinkError) {
                // 400 for both a malformed address and a bad signature. Do NOT leak which
                // one failed (an attacker probing a victim's DID learns nothing).
                if (err.message === 'invalid_account_address') {
                    return reply.code(400).send({ error: 'invalid_account_address' });
                }
                return reply.code(400).send({ error: 'invalid_signature' });
            }
            throw err;
        }

        // Sole-producer audit event: the binding is transparent (DID + owner hashed,
        // account address public). Emitted EXACTLY once on the success path.
        appendPortalAccountLinked(services.audit, {
            civic_did_hash: sha256Hex(link.civicDid),
            nous_account: link.nousAccount,
            owner_address_hash: sha256Hex(link.ownerAddress),
            tick: link.verifiedAtTick,
        });

        return reply.send({
            civic_did: link.civicDid,
            nous_account: link.nousAccount,
            owner_address: link.ownerAddress,
            verified_at_tick: link.verifiedAtTick,
        });
    });

    app.get('/api/v1/portal/account/link', async (req, reply) => {
        const did = requireNousCaller(req, reply);
        if (!did) return;

        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const store = new AccountLinkStore(pool, services.gridName);
        const link = await store.getByCivicDid(did);
        if (!link) return reply.code(404).send({ error: 'not_linked' });

        return reply.send({
            civic_did: link.civicDid,
            nous_account: link.nousAccount,
            owner_address: link.ownerAddress,
            verified_at_tick: link.verifiedAtTick,
        });
    });
}
