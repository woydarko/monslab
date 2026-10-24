import { beforeAll, describe, expect, it } from 'vitest';
import { issueNonce, readSession, sessionCookie, signJwt, verifyJwt, verifyNonce } from './session.ts';

const A = '0x1111111111111111111111111111111111111111';

describe('session', () => {
    beforeAll(() => {
        process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret!!';
    });

    it('accepts a nonce for 5 minutes', () => {
        const t = 1_760_000_000_000;
        const { nonce, message } = issueNonce(A, t);
        expect(message).toBe(`MONSLAB sign-in\nAddress: ${A}\nNonce: ${nonce}\nIssued: ${new Date(t).toISOString()}`);
        expect(verifyNonce(nonce, t + 299_000)).toBe(true);
        expect(verifyNonce(nonce, t + 301_000)).toBe(false);
    });

    it('rejects a tampered nonce', () => {
        const t = 1_760_000_000_000;
        const { nonce } = issueNonce(A, t);
        const i = 5;
        const flipped = nonce.slice(0, i) + (nonce[i] === 'A' ? 'B' : 'A') + nonce.slice(i + 1);
        expect(verifyNonce(flipped, t + 1000)).toBe(false);
        expect(verifyNonce('garbage', t)).toBe(false);
    });

    it('signs and expires session tokens', () => {
        const t = 1_760_000_000_000;
        const token = signJwt(A, t);
        expect(verifyJwt(token, t + 86_399_000)).toBe(A);
        expect(verifyJwt(token, t + 86_400_000)).toBeNull();
        const [h, p, s] = token.split('.');
        expect(verifyJwt(`${h}.${p}.${s.slice(0, -2)}xx`, t)).toBeNull();
        const forged = Buffer.from(JSON.stringify({ sub: '0x2222222222222222222222222222222222222222', iat: 0, exp: 9e12 })).toString('base64url');
        expect(verifyJwt(`${h}.${forged}.${s}`, t)).toBeNull();
    });

    it('reads the session cookie', () => {
        const token = signJwt(A, Date.now());
        const cookie = sessionCookie(token);
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Lax');
        const req = new Request('http://x/api/me', { headers: { cookie: `other=1; ms_session=${token}` } });
        expect(readSession(req)).toBe(A);
        expect(readSession(new Request('http://x/api/me'))).toBeNull();
    });
});
