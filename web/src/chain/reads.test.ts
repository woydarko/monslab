import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { getBalances, getLoadout } from './reads.ts';
import { txUrl } from './config.ts';

const A = '0x00000000000000000000000000000000000000aa' as const;

describe('reads', () => {
    it('getBalances uses one balanceOfBatch call', async () => {
        const readContract = vi.fn(async () => [2n, 1n, 0n]);
        const fake = { readContract } as unknown as PublicClient;
        await expect(getBalances(A, [1, 101, 201], fake)).resolves.toEqual({ 1: 2n, 101: 1n, 201: 0n });
        expect(readContract).toHaveBeenCalledTimes(1);
        expect(readContract.mock.calls[0]).toMatchObject([{ functionName: 'balanceOfBatch', args: [[A, A, A], [1n, 101n, 201n]] }]);
    });

    it('getLoadout reads loadoutOf', async () => {
        const readContract = vi.fn(async () => 7n);
        await expect(getLoadout(A, { readContract } as unknown as PublicClient)).resolves.toBe(7n);
        expect(readContract.mock.calls[0]).toMatchObject([{ functionName: 'loadoutOf', args: [A] }]);
    });
});

describe('txUrl', () => {
    it('rejects malformed hashes', () => {
        expect(txUrl('0x12')).toBe('');
        expect(txUrl(`0x${'a'.repeat(64)}`)).toMatch(/\/tx\/0xa{64}$/);
    });
});
