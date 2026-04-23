import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';

describe('debug', () => {
  it('top-level rate-limit inject', async () => {
    const app = Fastify({ logger: false });

    await app.register(fastifyRateLimit, {
      max: 60,
      timeWindow: '1 minute',
      keyGenerator: (req) => (req.params as { did?: string }).did ?? req.ip,
    });

    app.post<{ Params: { did: string } }>(
      '/api/v1/nous/:did/whisper/send',
      async (req) => {
        return { did: req.params.did };
      }
    );

    await app.ready();
    console.log('ready, injecting...');
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/nous/did:noesis:alice/whisper/send',
      remoteAddress: '127.0.0.1',
      payload: {},
    });
    console.log('done:', r.statusCode, r.body);
    await app.close();
    expect(r.statusCode).toBe(200);
  }, 10000);
});
