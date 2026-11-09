/**
 * Tests for the Nous registration client (D-V3-39): URLs built from
 * NEXT_PUBLIC_GRID_ORIGIN, the Portal session cookie is sent, and a refusal
 * surfaces the Grid's own error code.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    claimNous, fetchReviewQueue, fileNousRegistration, prescreenRegistration, refusalText,
} from './nous-registration';

function jsonResp(body: unknown, status = 200): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}
function stub(resp: Response) {
    const fetchMock = vi.fn(async () => resp);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_GRID_ORIGIN', 'http://grid.test');
    return () => fetchMock.mock.calls[0] as unknown as [string, RequestInit];
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('claimNous', () => {
    it('POSTs the claim for an encoded Nous DID with the session cookie', async () => {
        const call = stub(jsonResp({ ok: true }));
        expect((await claimNous('did:noesis:hermes')).ok).toBe(true);
        const [url, init] = call();
        expect(url).toBe('http://grid.test/api/v1/portal/nous/did%3Anoesis%3Ahermes/claim');
        expect(init.method).toBe('POST');
        expect(init.credentials).toBe('include');
    });
});

describe('fileNousRegistration', () => {
    it('sends the Brain public key and returns the request id', async () => {
        const call = stub(jsonResp({ status: 'requested', request_id: 'r1' }, 201));
        const res = await fileNousRegistration('did:noesis:hermes', 'K'.repeat(43));
        expect(res).toEqual({ ok: true, data: { status: 'requested', request_id: 'r1' } });
        const [url, init] = call();
        expect(url).toBe('http://grid.test/api/v1/portal/nous/did%3Anoesis%3Ahermes/registration');
        expect(JSON.parse(init.body as string)).toEqual({ brain_public_key_x: 'K'.repeat(43) });
    });

    it('surfaces the Grid error code on a refusal', async () => {
        stub(jsonResp({ error: 'founding_nous_operator_only' }, 403));
        expect(await fileNousRegistration('did:noesis:hermes', 'K'.repeat(43))).toEqual({ ok: false, code: 'founding_nous_operator_only' });
    });

    it('maps a fetch rejection to network and re-throws AbortError', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        expect(await fileNousRegistration('did:noesis:hermes', 'k')).toEqual({ ok: false, code: 'network' });
        const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
        vi.stubGlobal('fetch', vi.fn(async () => { throw abort; }));
        await expect(fetchReviewQueue()).rejects.toBe(abort);
    });
});

describe('reviewer calls', () => {
    it('fetchReviewQueue GETs the queue, optionally by status', async () => {
        const call = stub(jsonResp({ registrations: [] }));
        await fetchReviewQueue('requested');
        expect(call()[0]).toBe('http://grid.test/api/v1/portal-reviewer/nous-registrations?status=requested');
    });

    it('prescreenRegistration sends the decision, with a reason only on a rejection', async () => {
        let call = stub(jsonResp({ status: 'approved' }, 201));
        await prescreenRegistration('r1', true);
        expect(call()[0]).toBe('http://grid.test/api/v1/portal-reviewer/nous-registrations/r1/prescreen');
        expect(JSON.parse(call()[1].body as string)).toEqual({ pass: true });

        call = stub(jsonResp({ status: 'rejected', reason_code: 'prescreen_sybil' }, 201));
        const res = await prescreenRegistration('r1', false, 'prescreen_sybil');
        expect(JSON.parse(call()[1].body as string)).toEqual({ pass: false, reason: 'prescreen_sybil' });
        expect(res).toEqual({ ok: true, data: { status: 'rejected', reason_code: 'prescreen_sybil' } });
    });

    it('falls back to http_<status> when a refusal carries no error code', async () => {
        stub(jsonResp({}, 500));
        expect(await fetchReviewQueue()).toEqual({ ok: false, code: 'http_500' });
    });
});

describe('refusalText', () => {
    it('explains known codes and still names unknown ones', () => {
        expect(refusalText('civic_did_required')).toMatch(/citizen/);
        expect(refusalText('some_new_code')).toContain('some new code');
    });
});
