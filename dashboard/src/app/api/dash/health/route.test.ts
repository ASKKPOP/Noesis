import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/dash/health', () => {
    it('returns 200 JSON { ok: true, service: "dashboard" }', async () => {
        const res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, service: 'dashboard' });
    });
});
