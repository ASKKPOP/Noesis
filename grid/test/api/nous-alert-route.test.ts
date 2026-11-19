/**
 * POST /api/v1/portal/nous-alert — the Grid emails the signed-in account that its
 * Local Nous cannot stay running. Recipient and wording are the Grid's, never the caller's.
 */
import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { HumanRegistry } from '../../src/human/HumanRegistry.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import { sesMailerFromEnv, type AlertMailer } from '../../src/api/portal/alert-mailer.js';

interface Mail { to: string; subject: string; text: string }

async function cookie(did: string): Promise<Record<string, string>> {
    const { privateKey } = await keyPairPromise;
    const token = await new SignJWT({ did, grid_name: 'genesis' })
        .setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
    return { [COOKIE_NAME]: token };
}

function setup(mailer: AlertMailer | 'recording' | 'failing' = 'recording'): { app: FastifyInstance; did: string; sent: Mail[]; audit: AuditChain } {
    const sent: Mail[] = [];
    const humans = new HumanRegistry();
    const did = humans.createHuman({ grid_name: 'genesis', email: 'Owner@Example.com', password_hash: 'x' }).did;
    const alertMailer: AlertMailer = mailer === 'recording'
        ? { send: async (to, subject, text) => { sent.push({ to, subject, text }); } }
        : mailer === 'failing' ? { send: async () => { throw new Error('ses down'); } } : mailer;
    const audit = new AuditChain();
    const app = buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }), space: new SpatialMap(),
        logos: new LogosEngine(), audit, gridName: 'genesis', humanRegistry: humans, alertMailer,
    });
    return { app, did, sent, audit };
}
const post = (app: FastifyInstance, cookies: Record<string, string> | undefined, payload: unknown) =>
    app.inject({ method: 'POST', url: '/api/v1/portal/nous-alert', cookies, payload: payload as object });

describe('POST /api/v1/portal/nous-alert', () => {
    it('emails the signed-in account, and only it', async () => {
        const { app, did, sent, audit } = setup();
        const before = audit.length;
        const res = await post(app, await cookie(did), { kind: 'brain_down', nous: 'Sophia', to: 'someone@else.com', text: 'buy now' });
        expect(res.statusCode).toBe(200);
        expect(sent).toHaveLength(1);
        expect(sent[0].to).toBe('owner@example.com');
        expect(sent[0].subject).toBe("Sophia's Brain keeps stopping");
        expect(sent[0].text).not.toContain('buy now');
        expect(audit.length).toBe(before); // a private account notice: no audit event
        await app.close();
    });

    it('401 without a session, and with a forged one', async () => {
        const { app, sent } = setup();
        expect((await post(app, undefined, { kind: 'brain_down' })).statusCode).toBe(401);
        expect((await post(app, { [COOKIE_NAME]: 'forged' }, { kind: 'brain_down' })).statusCode).toBe(401);
        expect(sent).toHaveLength(0);
        await app.close();
    });

    it('400 for a notice the Grid does not have', async () => {
        const { app, did, sent } = setup();
        expect((await post(app, await cookie(did), { kind: 'anything' })).statusCode).toBe(400);
        expect(sent).toHaveLength(0);
        await app.close();
    });

    it('a name that is not a plain name is not put in the mail', async () => {
        const { app, did, sent } = setup();
        await post(app, await cookie(did), { kind: 'local_ai_down', nous: 'http://evil.example/\nclick' });
        expect(sent[0].subject).toBe('Your Nous cannot reach its local AI');
        await app.close();
    });

    it('one mail per kind per account per hour', async () => {
        const { app, did, sent } = setup();
        const c = await cookie(did);
        expect((await post(app, c, { kind: 'brain_down' })).statusCode).toBe(200);
        expect((await post(app, c, { kind: 'brain_down' })).statusCode).toBe(429);
        expect((await post(app, c, { kind: 'local_ai_down' })).statusCode).toBe(200);
        expect(sent).toHaveLength(2);
        await app.close();
    });

    it('409 for an account with no email (wallet sign-in)', async () => {
        const { app, sent } = setup();
        expect((await post(app, await cookie('did:noesis:human:0x' + 'a'.repeat(40)), { kind: 'brain_down' })).statusCode).toBe(409);
        expect(sent).toHaveLength(0);
        await app.close();
    });

    it('502 when the mail service fails, and the next try may send', async () => {
        const { app, did } = setup('failing');
        const c = await cookie(did);
        expect((await post(app, c, { kind: 'brain_down' })).statusCode).toBe(502);
        expect((await post(app, c, { kind: 'brain_down' })).statusCode).toBe(502); // not 429
        await app.close();
    });
});

describe('no mail service configured', () => {
    it('503 and says so', async () => {
        const humans = new HumanRegistry();
        const did = humans.createHuman({ grid_name: 'genesis', email: 'o@example.com', password_hash: 'x' }).did;
        const app = buildServer({
            clock: new WorldClock({ tickRateMs: 100_000 }), space: new SpatialMap(),
            logos: new LogosEngine(), audit: new AuditChain(), gridName: 'genesis', humanRegistry: humans,
        });
        const res = await post(app, await cookie(did), { kind: 'brain_down' });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ error: 'email_not_configured' });
        await app.close();
    });
});

describe('sesMailerFromEnv', () => {
    it('is absent until a sender address is configured', () => {
        expect(sesMailerFromEnv({})).toBeNull();
        expect(sesMailerFromEnv({ ALERT_EMAIL_FROM: 'alerts@noesiis.com' })).not.toBeNull();
    });
});
