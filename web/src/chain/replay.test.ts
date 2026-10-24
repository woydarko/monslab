import { describe, expect, it } from 'vitest';
import { keccak256 } from 'viem';
import type { Hex } from './types.ts';
import { packLoadout, unpackLoadout } from './loadout.ts';
import {
    fetchBattle,
    outcomeOf,
    resultHash,
    simulateBattle,
    verifyBattle,
    type BattleRecord,
    type LogsQuery,
    type ReplayLog,
} from './replay.ts';

const A = '0x00000000000000000000000000000000000000aa' as Hex;
const Z = '0x0000000000000000000000000000000000000000' as Hex;
const TX1 = `0x${'11'.repeat(32)}` as Hex;
const TX2 = `0x${'22'.repeat(32)}` as Hex;
const STARTER = packLoadout({ head: 101, body: 102, legs: 103, acc: 0 });

/** A finalized PVE record whose `final` block matches what the local sim produces. */
function record(over: Partial<BattleRecord> = {}): BattleRecord {
    const base: BattleRecord = {
        battleId: 7n,
        mode: 0,
        attacker: A,
        defender: Z,
        ref: 0n,
        atkLoadout: STARTER,
        defLoadout: 0n,
        seed: 42,
        simVersion: 1,
        startTx: TX1,
        final: null,
        rewards: null,
        ...over,
    };
    // Simulate the shipped version even when the caller overrides `simVersion`.
    const sim = simulateBattle({ ...base, simVersion: 1 });
    if (!sim) throw new Error('starter record must simulate');
    const o = outcomeOf(sim.result);
    return {
        ...base,
        final: { ...o, resultHash: resultHash(base.battleId, base.seed, o), txHash: TX2, blockNumber: 500n },
        rewards: { gloo: 0n, eggs: 1, brainDelta: 10 },
        ...over,
    };
}

describe('loadout packing', () => {
    it('round-trips a packed uint64', () => {
        const l = { head: 7, body: 102, legs: 103, acc: 201 };
        expect(unpackLoadout(packLoadout(l))).toEqual(l);
    });

    it('packs head<<48 | body<<32 | legs<<16 | acc', () => {
        expect(packLoadout({ head: 101, body: 102, legs: 103, acc: 0 })).toBe((101n << 48n) | (102n << 32n) | (103n << 16n));
        expect(unpackLoadout(STARTER)).toEqual({ head: 101, body: 102, legs: 103, acc: 0 });
    });
});

describe('resultHash', () => {
    // keccak256(abi.encode(uint256 battleId, uint32 seed, uint8 winner, uint16 actions,
    //                       uint32 hpLeftA, uint32 hpLeftB, uint32 maxHpA, uint32 maxHpB))
    it('matches the 8-word ABI encoding built by hand', () => {
        const words = [1n, 2841937721n, 0n, 17n, 42n, 0n, 108n, 95n].map((w) => w.toString(16).padStart(64, '0')).join('');
        const expectHash = keccak256(`0x${words}` as Hex);
        expect(resultHash(1n, 2841937721, { winner: 0, actions: 17, hpLeftA: 42, hpLeftB: 0, maxHpA: 108, maxHpB: 95 })).toBe(expectHash);
    });
});

describe('verifyBattle', () => {
    it('verifies a battle the contract recorded with the same hash', () => {
        const r = record();
        const v = verifyBattle(r);
        expect(v.status).toBe('verified');
        expect(v.hashOk).toBe(true);
        expect(v.recomputed).toEqual(v.claimed);
        expect(v.recomputed?.hpLeftB).toBe(0); // someone lost
        expect(v.sim?.parts[0]).toEqual(['goo_head', 'goo_body', 'goo_legs']);
    });

    it('flags a record whose HP does not match the seed', () => {
        const r = record();
        const tampered: BattleRecord = { ...r, final: { ...r.final!, hpLeftA: r.final!.hpLeftA + 1 } };
        const v = verifyBattle(tampered);
        expect(v.status).toBe('mismatch');
        expect(v.hashOk).toBe(true); // the re-simulation still reproduces the contract hash
        expect(v.recomputed).not.toEqual(v.claimed);
    });

    it('flags a record whose outcome fields match but the hash does not', () => {
        const r = record();
        const v = verifyBattle({ ...r, final: { ...r.final!, resultHash: `0x${'00'.repeat(32)}` as Hex } });
        expect(v.status).toBe('mismatch');
        expect(v.hashOk).toBe(false);
    });

    it('is unavailable while the battle is still open on chain', () => {
        const v = verifyBattle(record({ final: null }));
        expect(v).toMatchObject({ status: 'unavailable', reason: 'in_progress' });
        expect(v.sim).toBeUndefined();
    });

    it('is unavailable for a sim version this build does not carry', () => {
        const v = verifyBattle(record({ simVersion: 9 }));
        expect(v).toMatchObject({ status: 'unavailable', reason: 'unsupported_sim' });
    });
});

describe('fetchBattle', () => {
    /** Fake client that refuses wide windows, like a public RPC. */
    function client(startedAt = 12n, finalizedAt = 2100n) {
        const calls: LogsQuery[] = [];
        const log = (blockNumber: bigint, args: Record<string, unknown>, tx: Hex): ReplayLog => ({ blockNumber, args, transactionHash: tx });
        const started = log(startedAt, { battleId: 7n, attacker: A, defender: Z, mode: 0, ref: 0n, atkLoadout: STARTER, defLoadout: 0n, seed: 42, simVersion: 1 }, TX1);
        const finalized = log(finalizedAt, { battleId: 7n, winner: 0, actions: 17, hpLeftA: 42, hpLeftB: 0, maxHpA: 108, maxHpB: 95, resultHash: `0x${'ab'.repeat(32)}` }, TX2);
        const reward = log(finalizedAt, { player: A, battleId: 7n, gloo: 0n, eggs: 1, brainDelta: 10 }, TX2);
        return {
            calls,
            getBlockNumber: async () => 20_000n,
            getLogs: async (q: LogsQuery): Promise<readonly ReplayLog[]> => {
                calls.push(q);
                if (q.toBlock - q.fromBlock > 4_000n) throw new Error('block range too large (max 5000)');
                const within = (b: bigint) => b >= q.fromBlock && b <= q.toBlock;
                if (q.eventName === 'BattleStarted') return within(startedAt) ? [started] : [];
                if (q.eventName === 'BattleFinalized') return within(finalizedAt) ? [finalized] : [];
                if (q.eventName === 'RewardGranted') return within(finalizedAt) ? [reward] : [];
                return [];
            },
        };
    }

    it('reads both logs and halves the window when the RPC complains', async () => {
        const c = client();
        const r = await fetchBattle(7n, { client: c, fromBlock: 0n });
        expect(r).not.toBeNull();
        expect(r!.battleId).toBe(7n);
        expect(r!.mode).toBe(0);
        expect(r!.attacker).toBe(A);
        expect(r!.seed).toBe(42);
        expect(r!.atkLoadout).toBe(STARTER);
        expect(r!.simVersion).toBe(1);
        expect(r!.startTx).toBe(TX1);
        expect(r!.final).toMatchObject({ winner: 0, actions: 17, hpLeftA: 42, maxHpA: 108, resultHash: `0x${'ab'.repeat(32)}`, txHash: TX2 });
        expect(r!.rewards).toEqual({ gloo: 0n, eggs: 1, brainDelta: 10 });
        for (const q of c.calls) expect(q.toBlock - q.fromBlock).toBeLessThanOrEqual(10_000n);
        expect(c.calls.some((q) => q.toBlock - q.fromBlock > 4_000n)).toBe(true); // it started wide and adapted
    });

    it('returns the record with final: null while no finalize log exists', async () => {
        const c = client(12n, 99_999n);
        c.getBlockNumber = async () => 3_000n;
        const r = await fetchBattle(7n, { client: c, fromBlock: 0n });
        expect(r).not.toBeNull();
        expect(r!.final).toBeNull();
        expect(verifyBattle(r!).status).toBe('unavailable');
    });

    it('returns null when the battle never started', async () => {
        const c = client(99_999n, 99_999n);
        await expect(fetchBattle(7n, { client: c, fromBlock: 0n })).resolves.toBeNull();
    });
});
