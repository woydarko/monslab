import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMUNITY_CREATED } from '../server/events.ts';
import type { Hex } from '../server/types.ts';
import { authed, errorCode, fakeLog, PLAYER, receiptWith } from './testing.ts';

const COMM = '0x00000000000000000000000000000000000000bb';
const TX = `0x${'55'.repeat(32)}` as Hex;

const mocks = vi.hoisted(() => ({ sendAs: vi.fn(), readCommunity: vi.fn() }));

vi.mock('../server/relayer.ts', () => ({ sendAs: mocks.sendAs }));
vi.mock('../server/contracts.ts', () => ({ community: () => ({ address: COMM, abi: [] }), readCommunity: mocks.readCommunity }));

const { POST: createPOST } = await import('./community/create.ts');
const { POST: joinPOST } = await import('./community/join.ts');
const { POST: leavePOST } = await import('./community/leave.ts');
const { POST: claimPOST } = await import('./community/claim.ts');

function revertedTo(errorName: string, args: unknown[] = []) {
    return Promise.reject(Object.assign(new Error(`reverted: ${errorName}`), { data: { errorName, args } }));
}

describe('POST /api/community/create', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sendAs.mockResolvedValue(receiptWith([fakeLog(COMMUNITY_CREATED, { cid: 3, leader: PLAYER, name: 'Indonads' })], TX));
    });

    it('creates a community and returns its id from the event', async () => {
        const res = await createPOST(authed('/api/community/create', { name: 'Indonads' }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: TX, communityId: 3 });
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'create', args: [PLAYER, 'Indonads'] });
    });

    it('rejects an invalid name without a transaction', async () => {
        for (const name of ['ab', 'x'.repeat(21), 'bad$name']) {
            const res = await createPOST(authed('/api/community/create', { name }));
            expect(res.status).toBe(400);
            expect(await errorCode(res)).toBe('invalid_name');
        }
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('maps a NameTaken revert', async () => {
        mocks.sendAs.mockImplementation(() => revertedTo('NameTaken'));
        const res = await createPOST(authed('/api/community/create', { name: 'Indonads' }));
        expect(res.status).toBe(409);
        expect(await errorCode(res)).toBe('name_taken');
    });
});

describe('POST /api/community/join and leave', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sendAs.mockResolvedValue(receiptWith([], TX));
    });

    it('joins by community id', async () => {
        const res = await joinPOST(authed('/api/community/join', { communityId: 4 }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: TX });
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'join', args: [PLAYER, 4] });
    });

    it('maps a CommunityFull revert to 409', async () => {
        mocks.sendAs.mockImplementation(() => revertedTo('CommunityFull'));
        const res = await joinPOST(authed('/api/community/join', { communityId: 4 }));
        expect(res.status).toBe(409);
        expect(await errorCode(res)).toBe('community_full');
    });

    it('leaves with the session player', async () => {
        const res = await leavePOST(authed('/api/community/leave', {}));
        expect(res.status).toBe(200);
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'leave', args: [PLAYER] });
    });
});

describe('POST /api/community/claim', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sendAs.mockResolvedValue(receiptWith([], TX));
        mocks.readCommunity.mockResolvedValue(true);
    });

    it('claims gold on the hatch task with task 1 and tier 2', async () => {
        const res = await claimPOST(authed('/api/community/claim', { week: 42, task: 'hatch', tier: 'gold' }));
        expect(res.status).toBe(200);
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'claimWeekly', args: [PLAYER, 42, 1, 2] });
        expect(await res.json()).toEqual({ txHash: TX, rewards: { eggs: 0, rareEggs: 1, accessory: 202 } });
    });

    it('claims bronze on the theme task', async () => {
        mocks.readCommunity.mockResolvedValue(false);
        const res = await claimPOST(authed('/api/community/claim', { week: 42, task: 'theme', tier: 'bronze' }));
        expect(res.status).toBe(200);
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ args: [PLAYER, 42, 0, 0] });
        expect(await res.json()).toEqual({ txHash: TX, rewards: { eggs: 1, rareEggs: 0, accessory: null } });
    });

    it('rejects unknown tasks and tiers', async () => {
        for (const body of [
            { week: 42, task: 'war', tier: 'gold' },
            { week: 42, task: 'theme', tier: 'platinum' },
            { week: -1, task: 'theme', tier: 'gold' },
        ]) {
            const res = await claimPOST(authed('/api/community/claim', body));
            expect(res.status).toBe(400);
            expect(await errorCode(res)).toBe('invalid_request');
        }
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('maps a NoContribution revert', async () => {
        mocks.sendAs.mockImplementation(() => revertedTo('NoContribution'));
        const res = await claimPOST(authed('/api/community/claim', { week: 42, task: 'hatch', tier: 'bronze' }));
        expect(res.status).toBe(409);
        expect(await errorCode(res)).toBe('no_contribution');
    });
});
