import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keccak256, toBytes } from 'viem';
import { REDEEMED } from '../server/events.ts';
import type { Hex } from '../server/types.ts';
import { authed, errorCode, fakeLog, PLAYER, receiptWith } from './testing.ts';

const GAME = '0x00000000000000000000000000000000000000aa';
const TX = `0x${'77'.repeat(32)}` as Hex;
const CODE = 'BLITZJOGJA';

const mocks = vi.hoisted(() => ({ sendAs: vi.fn(), readGame: vi.fn() }));

vi.mock('../server/relayer.ts', () => ({ sendAs: mocks.sendAs }));
vi.mock('../server/contracts.ts', () => ({ game: () => ({ address: GAME, abi: [] }), readGame: mocks.readGame }));

const { POST: redeemPOST } = await import('./redeem.ts');

const NOW = BigInt(Math.floor(Date.now() / 1000));

function drop(over: Partial<{ codeHash: string; tokenId: number; startsAt: bigint; endsAt: bigint }> = {}) {
    return { codeHash: keccak256(toBytes(CODE)), tokenId: 201, startsAt: NOW - 60n, endsAt: NOW + 3600n, maxClaims: 100, claimed: 3, ...over };
}

function reads(drops: Record<string, unknown>) {
    mocks.readGame.mockImplementation(async (fn: string, args: readonly unknown[] = []) => {
        if (fn === 'activeDropIds') return Object.keys(drops).map(BigInt);
        if (fn === 'drops') return drops[String(args[0])];
        throw new Error(`unexpected read ${fn}`);
    });
}

describe('POST /api/redeem', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sendAs.mockResolvedValue(receiptWith([fakeLog(REDEEMED, { player: PLAYER, dropId: 1n, tokenId: 201 })], TX));
    });

    it('uppercases the code before hashing and redeems the matching drop', async () => {
        reads({ '1': drop() });
        const res = await redeemPOST(authed('/api/redeem', { code: ' blitzjogja ' }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: TX, tokenId: 201 });
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'redeem', args: [PLAYER, 1n, CODE] });
    });

    it('rejects a code that matches no active drop, without a transaction', async () => {
        reads({ '1': drop() });
        const res = await redeemPOST(authed('/api/redeem', { code: 'WRONGCODE' }));
        expect(res.status).toBe(400);
        expect(await errorCode(res)).toBe('invalid_code');
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('never logs the redeem code', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        reads({ '1': drop() });
        await redeemPOST(authed('/api/redeem', { code: 'blitzjogja' }));
        reads({ '1': drop() });
        await redeemPOST(authed('/api/redeem', { code: 'wrongcode' }));
        const logged = [...log.mock.calls, ...err.mock.calls].flat().map(String).join(' ').toUpperCase();
        expect(logged).not.toContain(CODE);
        expect(logged).not.toContain('WRONGCODE');
    });

    it('reports drop_closed when no drop is active', async () => {
        reads({});
        mocks.readGame.mockImplementation(async (fn: string) => (fn === 'activeDropIds' ? [] : drop({ startsAt: NOW - 60n, endsAt: NOW - 1n })));
        const res = await redeemPOST(authed('/api/redeem', { code: CODE }));
        expect(res.status).toBe(409);
        expect(await errorCode(res)).toBe('drop_closed');
    });

    it('reports drop_not_started for a future drop', async () => {
        mocks.readGame.mockImplementation(async (fn: string) => (fn === 'activeDropIds' ? [] : drop({ startsAt: NOW + 600n, endsAt: NOW + 1200n })));
        const res = await redeemPOST(authed('/api/redeem', { code: CODE }));
        expect(res.status).toBe(409);
        expect(await errorCode(res)).toBe('drop_not_started');
    });

    it('maps AlreadyRedeemed from the contract', async () => {
        reads({ '1': drop() });
        mocks.sendAs.mockRejectedValue(Object.assign(new Error('reverted'), { data: { errorName: 'AlreadyRedeemed' } }));
        const res = await redeemPOST(authed('/api/redeem', { code: CODE }));
        expect(res.status).toBe(409);
        expect(await errorCode(res)).toBe('already_redeemed');
    });
});
