import { beforeAll, describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';

vi.mock('../server/contracts.ts', () => ({
    readMe: vi.fn(async (address: string) => ({ address, registered: true, username: 'demo', pendingEggs: ['12'] })),
}));

import { GET as nonceGET } from './auth/nonce.ts';
import { POST as verifyPOST } from './auth/verify.ts';
import { POST as logoutPOST } from './auth/logout.ts';
import { GET as meGET } from './me.ts';
import { signJwt } from '../server/session.ts';

const signer = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const other = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');

async function signIn(sigAccount = signer) {
    const res = await nonceGET(new Request(`http://x/api/auth/nonce?address=${signer.address}`));
    const { message } = (await res.json()) as { message: string };
    const signature = await sigAccount.signMessage({ message });
    return verifyPOST(new Request('http://x/api/auth/verify', { method: 'POST', body: JSON.stringify({ address: signer.address, message, signature }) }));
}

describe('auth endpoints', () => {
    beforeAll(() => {
        process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret!!';
    });

    it('rejects a bad address for a nonce', async () => {
        const res = await nonceGET(new Request('http://x/api/auth/nonce?address=0x12'));
        expect(res.status).toBe(400);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invalid_address');
    });

    it('signs in with a valid signature', async () => {
        const res = await signIn();
        expect(res.status).toBe(200);
        const cookie = res.headers.get('set-cookie') ?? '';
        expect(cookie).toContain('ms_session=');
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Lax');
    });

    it('rejects a signature from another wallet', async () => {
        const res = await signIn(other);
        expect(res.status).toBe(401);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invalid_signature');
    });

    it('clears the cookie on logout', async () => {
        const res = await logoutPOST(new Request('http://x/api/auth/logout', { method: 'POST' }));
        expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    });

    it('requires a session for /api/me and returns pending eggs untouched', async () => {
        expect((await meGET(new Request('http://x/api/me'))).status).toBe(401);
        const token = signJwt(signer.address, Date.now());
        const res = await meGET(new Request('http://x/api/me', { headers: { cookie: `ms_session=${token}` } }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ address: signer.address, registered: true, username: 'demo', pendingEggs: ['12'] });
    });
});
