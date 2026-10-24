import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TARGET_LOCKED, WAR_ACCEPTED, WAR_DECLARED, WAR_SETTLED } from '../server/events.ts';
import type { Hex } from '../server/types.ts';
import { authed, errorCode, fakeLog, OTHER, PLAYER, receiptWith } from './testing.ts';

const COMM = '0x00000000000000000000000000000000000000bb';
const TX = `0x${'66'.repeat(32)}` as Hex;

const mocks = vi.hoisted(() => ({ sendAs: vi.fn(), readGame: vi.fn() }));

vi.mock('../server/relayer.ts', () => ({ sendAs: mocks.sendAs }));
vi.mock('../server/contracts.ts', () => ({ community: () => ({ address: COMM, abi: [] }), readGame: mocks.readGame }));

const { POST: declarePOST } = await import('./war/declare.ts');
const { POST: acceptPOST } = await import('./war/accept.ts');
const { POST: lockPOST } = await import('./war/lock.ts');
const { POST: settlePOST } = await import('./war/settle.ts');
const { POST: claimPOST } = await import('./war/claim.ts');

const ZERO5 = [OTHER, OTHER, OTHER, OTHER, OTHER] as const;

describe('POST /api/war/declare', () => {
    beforeEach(() => vi.clearAllMocks());

    it('declares a war and returns the new war id', async () => {
        mocks.sendAs.mockResolvedValue(receiptWith([fakeLog(WAR_DECLARED, { warId: 9, a: 1, b: 4, expiresAt: 1_800_000_000n })], TX));
        const res = await declarePOST(authed('/api/war/declare', { targetCommunityId: 4 }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: TX, warId: 9 });
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'declareWar', args: [PLAYER, 4] });
    });

    it('maps NotLeader to 403 and SameCommunity to 409', async () => {
        mocks.sendAs.mockRejectedValue(Object.assign(new Error('reverted'), { data: { errorName: 'NotLeader' } }));
        expect(await errorCode(await declarePOST(authed('/api/war/declare', { targetCommunityId: 4 })))).toBe('not_leader');
        mocks.sendAs.mockRejectedValue(Object.assign(new Error('reverted'), { data: { errorName: 'SameCommunity' } }));
        expect(await errorCode(await declarePOST(authed('/api/war/declare', { targetCommunityId: 4 })))).toBe('same_community');
    });
});

describe('POST /api/war/accept', () => {
    beforeEach(() => vi.clearAllMocks());

    it('accepts a war and returns the end time', async () => {
        mocks.sendAs.mockResolvedValue(receiptWith([fakeLog(WAR_ACCEPTED, { warId: 9, endsAt: 1_800_000_300n, teamA: ZERO5, teamB: ZERO5 })], TX));
        const res = await acceptPOST(authed('/api/war/accept', { warId: 9 }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: TX, endsAt: 1_800_000_300 });
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'acceptWar', args: [PLAYER, 9] });
    });
});

describe('POST /api/war/lock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sendAs.mockResolvedValue(receiptWith([fakeLog(TARGET_LOCKED, { warId: 9, side: 0, targetIdx: 2, attacker: PLAYER, lockedUntil: 1_800_000_120n })], TX));
    });

    it('locks a target and returns the lock expiry', async () => {
        const res = await lockPOST(authed('/api/war/lock', { warId: 9, targetIdx: 2 }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: TX, lockedUntil: 1_800_000_120 });
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'lockTarget', args: [PLAYER, 9, 2] });
    });

    it('rejects a target index outside 0–4', async () => {
        for (const targetIdx of [5, -1, 1.5]) {
            const res = await lockPOST(authed('/api/war/lock', { warId: 9, targetIdx }));
            expect(res.status).toBe(400);
            expect(await errorCode(res)).toBe('invalid_request');
        }
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('names the player who holds the lock on TargetTaken', async () => {
        mocks.readGame.mockResolvedValue({ username: 'p1_holder' });
        mocks.sendAs.mockRejectedValue(Object.assign(new Error('reverted'), { data: { errorName: 'TargetTaken', args: [OTHER] } }));

        const res = await lockPOST(authed('/api/war/lock', { warId: 9, targetIdx: 2 }));

        expect(res.status).toBe(409);
        const body = (await res.json()) as { error: { code: string; details?: Record<string, unknown> } };
        expect(body.error.code).toBe('target_taken');
        expect(body.error.details).toEqual({ lockedBy: OTHER, lockedByName: 'p1_holder' });
    });
});

describe('POST /api/war/settle', () => {
    beforeEach(() => vi.clearAllMocks());

    it('lets any signed-in player settle and reports the winner', async () => {
        mocks.sendAs.mockResolvedValue(receiptWith([fakeLog(WAR_SETTLED, { warId: 9, winnerCid: 4, starsA: 7, starsB: 3 })], TX));
        const res = await settlePOST(authed('/api/war/settle', { warId: 9 }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: TX, winnerCid: 4 });
        expect(mocks.sendAs.mock.calls[0][0]).toBe(PLAYER);
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'settleWar', args: [9] });
    });

    it('maps WarNotOver to 409', async () => {
        mocks.sendAs.mockRejectedValue(Object.assign(new Error('reverted'), { data: { errorName: 'WarNotOver' } }));
        expect(await errorCode(await settlePOST(authed('/api/war/settle', { warId: 9 })))).toBe('war_not_over');
    });
});

describe('POST /api/war/claim', () => {
    beforeEach(() => vi.clearAllMocks());

    it('claims the war reward for the session player', async () => {
        mocks.sendAs.mockResolvedValue(receiptWith([], TX));
        const res = await claimPOST(authed('/api/war/claim', { warId: 9 }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: TX });
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'claimWarReward', args: [PLAYER, 9] });
    });
});
