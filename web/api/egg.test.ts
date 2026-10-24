import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EGG_REQUESTED } from '../server/events.ts';
import { authed, errorCode, fakeLog, get, GAME, OTHER, PLAYER, receiptWith, ZERO } from './testing.ts';

const mocks = vi.hoisted(() => ({ sendAs: vi.fn(), readGame: vi.fn(), findHatched: vi.fn() }));

vi.mock('../server/relayer.ts', () => ({ sendAs: mocks.sendAs }));
vi.mock('../server/contracts.ts', () => ({ game: () => ({ address: GAME, abi: [] }), readGame: mocks.readGame, findHatched: mocks.findHatched }));

const { POST: openPOST } = await import('./egg/open.ts');
const { POST: buyPOST } = await import('./egg/buy.ts');
const { GET: statusGET } = await import('./egg/status.ts');

describe('POST /api/egg/open', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.readGame.mockImplementation(async (fn: string) => (fn === 'entropyFee' ? 128_159_999_999_100_001n : null));
        mocks.sendAs.mockResolvedValue(receiptWith([fakeLog(EGG_REQUESTED, { player: PLAYER, sequence: 7n, eggType: 1 })]));
    });

    it('pays the entropy fee and returns the sequence from the receipt', async () => {
        const res = await openPOST(authed('/api/egg/open', { eggType: 'rare' }));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: `0x${'33'.repeat(32)}`, sequence: '7' });
        expect(mocks.sendAs.mock.calls[0][0]).toBe(PLAYER);
        const call = mocks.sendAs.mock.calls[0][1] as { functionName: string; args: unknown[]; value: bigint };
        expect(call.functionName).toBe('openEgg');
        expect(call.args).toEqual([PLAYER, 1]);
        expect(call.value).toBe(128_159_999_999_100_001n);
    });

    it('rejects an unknown egg type', async () => {
        const res = await openPOST(authed('/api/egg/open', { eggType: 'golden' }));
        expect(res.status).toBe(400);
        expect(await errorCode(res)).toBe('invalid_request');
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });
});

describe('POST /api/egg/buy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sendAs.mockResolvedValue(receiptWith([]));
        mocks.readGame.mockResolvedValue({ eggs: 3, gloo: 700, registered: true });
    });

    it('buys eggs and returns fresh balances', async () => {
        const res = await buyPOST(authed('/api/egg/buy', { count: 2 }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ txHash: `0x${'33'.repeat(32)}`, eggs: 3, gloo: 700 });
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'buyEgg', args: [PLAYER, 2] });
    });

    it('rejects counts outside 1–10', async () => {
        for (const count of [0, 11, 1.5, '2']) {
            const res = await buyPOST(authed('/api/egg/buy', { count }));
            expect(res.status).toBe(400);
            expect(await errorCode(res)).toBe('invalid_request');
        }
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });
});

describe('GET /api/egg/status', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reports a hatched egg with its part', async () => {
        mocks.findHatched.mockResolvedValue({ tokenId: 5, rarity: 1, txHash: `0x${'44'.repeat(32)}` });
        const res = await statusGET(get('/api/egg/status?sequence=7'));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: 'hatched', tokenId: 5, rarity: 1, txHash: `0x${'44'.repeat(32)}` });
    });

    it('reports a pending egg while the callback is missing', async () => {
        mocks.findHatched.mockResolvedValue(null);
        mocks.readGame.mockResolvedValue({ player: PLAYER, eggType: 0 });
        const res = await statusGET(get('/api/egg/status?sequence=7'));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: 'pending' });
        expect(mocks.readGame).toHaveBeenCalledWith('pendingEgg', [7n]);
    });

    it('404s an unknown sequence and 400s a malformed one', async () => {
        mocks.findHatched.mockResolvedValue(null);
        mocks.readGame.mockResolvedValue({ player: ZERO, eggType: 0 });
        const missing = await statusGET(get('/api/egg/status?sequence=9'));
        expect(missing.status).toBe(404);
        expect(await errorCode(missing)).toBe('egg_not_found');

        const bad = await statusGET(get('/api/egg/status?sequence=abc'));
        expect(bad.status).toBe(400);
        expect(await errorCode(bad)).toBe('invalid_request');
    });
});
