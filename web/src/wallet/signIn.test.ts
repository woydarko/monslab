import { describe, expect, it, vi } from 'vitest';
import { api } from '../chain/api.ts';
import { signIn } from './signIn.ts';

describe('signIn', () => {
    it('verifies exactly the message it signed', async () => {
        const A = '0x00000000000000000000000000000000000000aa' as const;
        vi.spyOn(api, 'nonce').mockResolvedValue({ nonce: 'n', message: 'MONSLAB sign-in\nAddress: A\nNonce: n' });
        const verify = vi.spyOn(api, 'verify').mockResolvedValue({ ok: true });
        const signer = vi.fn(async (m: string) => `0x${m.length.toString(16)}` as `0x${string}`);
        await signIn(A, signer);
        expect(api.nonce).toHaveBeenCalledWith(A);
        expect(signer).toHaveBeenCalledWith('MONSLAB sign-in\nAddress: A\nNonce: n');
        expect(verify).toHaveBeenCalledTimes(1);
        expect(verify).toHaveBeenCalledWith(A, 'MONSLAB sign-in\nAddress: A\nNonce: n', await signer.mock.results[0].value);
    });
});
