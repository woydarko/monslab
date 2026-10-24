import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api.ts';

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
    it('throws ApiError with the server code and status', async () => {
        vi.stubGlobal('fetch', reply(409, { error: { code: 'username_taken', message: 'taken' } }));
        const err = await api.register('x').catch((e: unknown) => e);
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).code).toBe('username_taken');
        expect((err as ApiError).status).toBe(409);
    });

    it('carries error details', async () => {
        vi.stubGlobal('fetch', reply(409, { error: { code: 'target_taken', message: 'm', details: { lockedBy: '0xP1' } } }));
        const err = (await api.lockTarget(1, 2).catch((e: unknown) => e)) as ApiError;
        expect(err.details).toEqual({ lockedBy: '0xP1' });
    });

    it('maps fetch failure to network', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        const err = (await api.me().catch((e: unknown) => e)) as ApiError;
        expect(err.code).toBe('network');
        expect(err.status).toBe(0);
    });

    it('sends credentials and JSON body on every call', async () => {
        const f = reply(200, { txHash: '0x1' });
        vi.stubGlobal('fetch', f);
        await api.battle({ mode: 'pve', tier: 2 });
        await api.me();
        await api.playerByCode('MONS-AB12CD');
        const calls = f.mock.calls as unknown as [string, RequestInit][];
        expect(calls.map((c) => c[0])).toEqual(['/api/battle', '/api/me', '/api/player/by-code/MONS-AB12CD']);
        for (const [, init] of calls) expect(init.credentials).toBe('include');
        expect(calls[0][1].method).toBe('POST');
        expect(JSON.parse(String(calls[0][1].body))).toEqual({ mode: 'pve', tier: 2 });
        expect(calls[1][1].method).toBe('GET');
    });

    it('maps a non-JSON error page to its status', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502 })));
        const err = (await api.me().catch((e: unknown) => e)) as ApiError;
        expect(err.status).toBe(502);
        expect(err.code).toBe('network');
    });
});
