import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFighters, computeBattle } from '../src/game/battlePlayer.ts';
import { packLoadout } from '../src/game/data/tokenIds.ts';
import { resultHash } from '../src/game/sim/outcome.ts';
import { BATTLE_STARTED, REWARD_GRANTED } from './events.ts';
import type { Hex } from './types.ts';
import { fakeLog, GAME, OTHER, PLAYER, receiptWith, ZERO } from '../api/testing.ts';

const mocks = vi.hoisted(() => ({ sendAs: vi.fn(), readGame: vi.fn(), readCommunity: vi.fn(), findBattleStarted: vi.fn() }));

vi.mock('./relayer.ts', () => ({ sendAs: mocks.sendAs }));
vi.mock('./contracts.ts', () => ({
    game: () => ({ address: GAME, abi: [] }),
    readGame: mocks.readGame,
    readCommunity: mocks.readCommunity,
    findBattleStarted: mocks.findBattleStarted,
}));

const { runBattle, refinalize } = await import('./battle.ts');

const ATK = packLoadout({ head: 1, body: 2, legs: 3, acc: 201 });
const DEF = packLoadout({ head: 4, body: 5, legs: 6, acc: 0 });
const SEED = 12_345;
const BATTLE_ID = 1n;
const START_TX = `0x${'aa'.repeat(32)}` as Hex;
const FINAL_TX = `0x${'bb'.repeat(32)}` as Hex;

function startedLog(over: Record<string, unknown> = {}) {
    return fakeLog(BATTLE_STARTED, { battleId: BATTLE_ID, attacker: PLAYER, defender: ZERO, mode: 0, ref: 2n, atkLoadout: ATK, defLoadout: 0n, seed: SEED, simVersion: 1, ...over });
}

function rewardLog(over: Record<string, unknown> = {}) {
    return fakeLog(REWARD_GRANTED, { player: PLAYER, battleId: BATTLE_ID, gloo: 20n, eggs: 1, brainDelta: 5, ...over });
}

/** sendAs: startBattle returns the given start log, finalizeBattle runs `finalize` (which may throw). */
function wire(opts: { start?: unknown[]; finalize?: () => unknown; finalizeCalls?: unknown[] } = {}) {
    mocks.sendAs.mockImplementation(async (_player: string, call: { functionName: string; args: unknown[] }) => {
        if (call.functionName === 'startBattle') return receiptWith((opts.start ?? [startedLog()]) as never, START_TX);
        if (call.functionName === 'finalizeBattle') {
            opts.finalizeCalls?.push(call.args);
            if (opts.finalize) return opts.finalize();
            return receiptWith([rewardLog()], FINAL_TX);
        }
        throw new Error(`unexpected send ${call.functionName}`);
    });
}

const noSleep = { sleep: async () => {} };

describe('runBattle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.readGame.mockResolvedValue({ registered: true, highestTier: 5, username: 'me' });
    });

    it('finalizes a PVE battle with the sim outcome and its hash, then reports rewards', async () => {
        const finalizeCalls: unknown[] = [];
        wire({ finalizeCalls });
        const [a, b] = buildFighters({ mode: 'pve', atk: ATK, def: null, tier: 2, atkName: '', defName: '' });
        const expected = computeBattle(a, b, SEED, 1).outcome;

        const view = await runBattle(PLAYER, { mode: 'pve', tier: 2 }, noSleep);

        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'startBattle', args: [PLAYER, 0, 2n] });
        expect(mocks.sendAs.mock.calls[1][1]).toMatchObject({
            functionName: 'finalizeBattle',
            args: [BATTLE_ID, { ...expected, resultHash: resultHash(BATTLE_ID, SEED, expected) }],
        });
        expect(view).toMatchObject({
            battleId: '1',
            seed: SEED,
            simVersion: 1,
            mode: 'pve',
            defender: { tier: 2 },
            rewards: { gloo: 20, eggs: 1, brainDelta: 5 },
            txStart: START_TX,
            txFinal: FINAL_TX,
            status: 'final',
        });
        expect(view.outcome).toEqual(expected);
        expect(view.attacker.loadout).toEqual({ head: 1, body: 2, legs: 3, acc: 201 });
    });

    it('retries the finalize and succeeds on the third attempt', async () => {
        const finalizeCalls: unknown[] = [];
        let n = 0;
        wire({
            finalizeCalls,
            finalize: () => {
                if (++n < 3) throw new Error('network blip');
                return receiptWith([rewardLog()], FINAL_TX);
            },
        });

        const view = await runBattle(PLAYER, { mode: 'pve', tier: 2 }, noSleep);

        expect(finalizeCalls).toHaveLength(3);
        expect(view.status).toBe('final');
        expect(view.txFinal).toBe(FINAL_TX);
    });

    it('reports finalize_pending instead of throwing when all three attempts fail', async () => {
        const finalizeCalls: unknown[] = [];
        wire({
            finalizeCalls,
            finalize: () => {
                throw new Error('relayer down');
            },
        });

        const view = await runBattle(PLAYER, { mode: 'pve', tier: 2 }, noSleep);

        expect(finalizeCalls).toHaveLength(3);
        expect(view.status).toBe('finalize_pending');
        expect(view.txFinal).toBeNull();
        expect(view.battleId).toBe('1');
    });

    it('refuses a tier the player has not reached', async () => {
        mocks.readGame.mockResolvedValue({ registered: true, highestTier: 1 });
        await expect(runBattle(PLAYER, { mode: 'pve', tier: 3 }, noSleep)).rejects.toMatchObject({ status: 400, code: 'tier_locked' });
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('refuses a PvP fight against your own code', async () => {
        mocks.readGame.mockResolvedValue({ registered: true, highestTier: 5 });
        mocks.readGame.mockImplementation(async (fn: string) => (fn === 'codeOwner' ? PLAYER : { registered: true, highestTier: 5 }));
        await expect(runBattle(PLAYER, { mode: 'pvp', code: 'MONS-AB12CD' }, noSleep)).rejects.toMatchObject({ status: 400, code: 'self_battle' });
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('starts a PvP battle against the code owner', async () => {
        mocks.readGame.mockImplementation(async (fn: string) => (fn === 'codeOwner' ? OTHER : { registered: true, highestTier: 5 }));
        wire({ start: [startedLog({ defender: OTHER, mode: 1, ref: BigInt(OTHER), defLoadout: DEF })] });

        const view = await runBattle(PLAYER, { mode: 'pvp', code: 'MONS-AB12CD' }, noSleep);

        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'startBattle', args: [PLAYER, 1, BigInt(OTHER)] });
        expect(view.mode).toBe('pvp');
        expect(view.defender).toMatchObject({ address: OTHER, loadout: { head: 4, body: 5, legs: 6, acc: 0 } });
    });

    it('refuses a war battle without a lock held by the player', async () => {
        mocks.readCommunity.mockResolvedValue({ a: 1, b: 2, status: 1, lockedBy: [[ZERO, ZERO, ZERO, ZERO, ZERO], [ZERO, ZERO, ZERO, ZERO, ZERO]], lockedUntil: [[0n, 0n, 0n, 0n, 0n], [0n, 0n, 0n, 0n, 0n]] });
        await expect(runBattle(PLAYER, { mode: 'war', warId: 7, targetIdx: 1 }, noSleep)).rejects.toMatchObject({ status: 409, code: 'not_locked_by_you' });
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('encodes a war battle ref as warId<<8 | targetIdx', async () => {
        const soon = BigInt(Math.floor(Date.now() / 1000) + 60);
        mocks.readCommunity.mockResolvedValue({ a: 1, b: 2, status: 1, lockedBy: [[ZERO, PLAYER, ZERO, ZERO, ZERO], [ZERO, ZERO, ZERO, ZERO, ZERO]], lockedUntil: [[0n, soon, 0n, 0n, 0n], [0n, 0n, 0n, 0n, 0n]] });
        wire({ start: [startedLog({ mode: 2, ref: 1_793n, defender: OTHER, defLoadout: DEF })] });

        const view = await runBattle(PLAYER, { mode: 'war', warId: 7, targetIdx: 1 }, noSleep);

        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'startBattle', args: [PLAYER, 2, 1_793n] });
        expect(view.mode).toBe('war');
    });
});

describe('refinalize', () => {
    beforeEach(() => vi.clearAllMocks());

    it('rebuilds the battle from its start log and finalizes it', async () => {
        mocks.findBattleStarted.mockResolvedValue({ battleId: BATTLE_ID, attacker: PLAYER, defender: ZERO, mode: 0, ref: 2n, atkLoadout: ATK, defLoadout: 0n, seed: SEED, simVersion: 1 });
        wire();

        const view = await refinalize(BATTLE_ID, noSleep);

        expect(mocks.sendAs.mock.calls[0][0]).toBe(PLAYER);
        expect(mocks.sendAs.mock.calls[0][1]).toMatchObject({ functionName: 'finalizeBattle', args: [BATTLE_ID, expect.objectContaining({ resultHash: expect.stringMatching(/^0x[0-9a-f]{64}$/) })] });
        expect(view.status).toBe('final');
        expect(view.battleId).toBe('1');
    });

    it('404s a battle id with no start log', async () => {
        mocks.findBattleStarted.mockResolvedValue(null);
        await expect(refinalize(99n, noSleep)).rejects.toMatchObject({ status: 404, code: 'battle_not_found' });
        expect(mocks.sendAs).not.toHaveBeenCalled();
    });

    it('maps an already finalized battle to 409', async () => {
        mocks.findBattleStarted.mockResolvedValue({ battleId: BATTLE_ID, attacker: PLAYER, defender: ZERO, mode: 0, ref: 2n, atkLoadout: ATK, defLoadout: 0n, seed: SEED, simVersion: 1 });
        mocks.sendAs.mockRejectedValue(Object.assign(new Error('reverted'), { data: { errorName: 'AlreadyFinalized' } }));

        await expect(refinalize(BATTLE_ID, noSleep)).rejects.toMatchObject({
            status: 409,
            code: 'already_finalized',
        });
    });
});
