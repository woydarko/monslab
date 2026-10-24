import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits, take } from './rateLimit.ts';
import { withApi } from './http.ts';
import { signJwt } from './session.ts';

const PLAYER = '0x1234567890abcdef1234567890abcdef12345678';

process.env.SESSION_SECRET ??= 'test-secret-that-is-long-enough-32';

function post(path: string, headers: Record<string, string> = {}): Request {
    return new Request(`http://localhost${path}`, { method: 'POST', headers });
}

function session(): Record<string, string> {
    return { cookie: `ms_session=${signJwt(PLAYER)}`, 'content-type': 'application/json' };
}

describe('take', () => {
    beforeEach(resetRateLimits);

    it('allows exactly the limit inside the window', () => {
        for (let i = 0; i < 20; i += 1) expect(take('a', 20, 1_000).allowed).toBe(true);
        expect(take('a', 20, 1_000).allowed).toBe(false);
    });

    it('reopens after the window', () => {
        for (let i = 0; i < 20; i += 1) take('a', 20, 1_000);
        expect(take('a', 20, 60_999).allowed).toBe(false);
        expect(take('a', 20, 61_000).allowed).toBe(true);
    });
});

describe('withApi rate limits', () => {
    beforeEach(resetRateLimits);

    it('returns 429 on the 21st write for one session address', async () => {
        const handler = withApi(async () => new Response('{"ok":true}', { status: 200 }));
        const silent = vi.spyOn(console, 'log').mockImplementation(() => {});
        for (let i = 0; i < 20; i += 1) {
            expect((await handler(post('/api/loadout', session()))).status).toBe(200);
        }
        const blocked = await handler(post('/api/loadout', session()));
        expect(blocked.status).toBe(429);
        expect((await blocked.json()).error.code).toBe('rate_limited');
        silent.mockRestore();
    });

    it('limits register to 5 per minute per IP', async () => {
        const handler = withApi(async () => new Response('{"ok":true}', { status: 200 }));
        const silent = vi.spyOn(console, 'log').mockImplementation(() => {});
        const headers = { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' };
        for (let i = 0; i < 5; i += 1) expect((await handler(post('/api/register', headers))).status).toBe(200);
        expect((await handler(post('/api/register', headers))).status).toBe(429);
        silent.mockRestore();
    });

    it('does not limit reads', async () => {
        const handler = withApi(async () => new Response('{"ok":true}', { status: 200 }));
        const silent = vi.spyOn(console, 'log').mockImplementation(() => {});
        for (let i = 0; i < 30; i += 1) {
            expect((await handler(new Request('http://localhost/api/me', { headers: session() }))).status).toBe(200);
        }
        silent.mockRestore();
    });
});

describe('request log', () => {
    beforeEach(resetRateLimits);

    it('logs one line with a shortened address and no secret fields', async () => {
        const lines: string[] = [];
        const spy = vi.spyOn(console, 'log').mockImplementation((line: string) => lines.push(line));
        const handler = withApi(async () => new Response('{"txHash":"0xabc"}', { status: 200 }));

        await handler(post('/api/loadout', session()));

        expect(lines).toHaveLength(1);
        const entry = JSON.parse(lines[0]);
        expect(entry.player).toBe('0x1234…5678');
        expect(entry.txHash).toBe('0xabc');
        expect(entry.route).toBe('/api/loadout');
        expect(lines[0]).not.toContain('cookie');
        expect(lines[0]).not.toContain('signature');
        spy.mockRestore();
    });
});
