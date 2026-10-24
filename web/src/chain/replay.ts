/**
 * F-12 replay: read one battle from Monad, re-run the local sim from the
 * on-chain seed and loadout snapshots, and compare with what the contract
 * recorded. Read-only, no login, no transactions.
 *
 * Honesty rule: a battle is only `verified` when every outcome field AND the
 * recalled `resultHash` match the simulation. Otherwise it is `mismatch`, or
 * `unavailable` with a reason — never a fake badge.
 *
 * Deviation (logged for the lead): G2's `game/sim/outcome.ts` + `registry.ts`
 * and G5's `battlePlayer.ts` are not on `feat/frontend`, so `outcomeOf`,
 * `resultHash`, `SIMS` and `SIM_VERSION` live here until the branch is rebased
 * onto `feat/platform`. They are byte-compatible with the contract:
 * `resultHash = keccak256(abi.encode(uint256 battleId, uint32 seed, uint8 winner,
 * uint16 actions, uint32 hpLeftA, uint32 hpLeftB, uint32 maxHpA, uint32 maxHpB))`.
 */
import { encodeAbiParameters, keccak256 } from 'viem';
import { DEPLOY_BLOCK, GAME } from './addresses.ts';
import { partsFromLoadout } from './loadout.ts';
import { publicClient } from './config.ts';
import { simulate, type BattleResult } from '../game/sim/battle.ts';
import { buildMonster, scaleMonster, type Monster } from '../game/sim/monster.ts';
import { ARENA } from '../game/data/arena.ts';
import type { MonsterParts } from '../game/data/types.ts';
import type { Hex } from './types.ts';

/** Version of the sim this build ships. Replays of other versions are `unsupported_sim`. */
export const SIM_VERSION = 1;

export type SimFn = (a: Monster, b: Monster, seed: number) => BattleResult;

/** Every sim version we can still replay (ARCHITECTURE.md D-15). */
export const SIMS: Record<number, SimFn> = { 1: simulate };

export interface Outcome {
    winner: 0 | 1;
    actions: number;
    hpLeftA: number;
    hpLeftB: number;
    maxHpA: number;
    maxHpB: number;
}

export interface BattleFinal extends Outcome {
    resultHash: Hex;
    txHash: Hex;
    blockNumber: bigint;
}

/** `RewardGranted` for this battle, when the contract emitted one. */
export interface BattleRewards {
    gloo: bigint;
    eggs: number;
    brainDelta: number;
}

export interface BattleRecord {
    battleId: bigint;
    /** 0 PVE, 1 PVP, 2 WAR (`BattleStarted.mode`). */
    mode: 0 | 1 | 2;
    attacker: Hex;
    /** `address(0)` for PVE. */
    defender: Hex;
    /** PVE: tier. PVP: defender as uint160. WAR: `(warId << 8) | targetIdx`. */
    ref: bigint;
    atkLoadout: bigint;
    defLoadout: bigint;
    seed: number;
    simVersion: number;
    startTx: Hex;
    final: BattleFinal | null;
    rewards: BattleRewards | null;
}

/** One decoded log, as much as the replay needs from it. */
export interface ReplayLog {
    args?: Record<string, unknown>;
    transactionHash: Hex;
    blockNumber: bigint;
}

export interface LogsQuery {
    address: Hex;
    abi: unknown;
    eventName: string;
    args?: Record<string, unknown>;
    fromBlock: bigint;
    toBlock: bigint;
}

/** The slice of a viem public client the replay needs (fake-able in tests). */
export interface LogsClient {
    getBlockNumber: () => Promise<bigint>;
    getLogs: (query: LogsQuery) => Promise<readonly ReplayLog[]>;
}

export interface ReplayDeps {
    client: LogsClient;
    fromBlock: bigint;
}

/** `log(range)` limits: start wide, halve on RPC complaints, never below 500 blocks. */
const MAX_SPAN = 10_000n;
const MIN_SPAN = 500n;

const defaultDeps: ReplayDeps = { client: publicClient as unknown as LogsClient, fromBlock: DEPLOY_BLOCK };

/** Replays `result.events` to the final HP of both fighters (same rule as the API's outcome). */
export function outcomeOf(result: BattleResult): Outcome {
    const hp: [number, number] = [result.maxHp[0], result.maxHp[1]];
    for (const e of result.events) {
        if (e.type === 'attack') {
            hp[e.target] = e.targetHp;
            hp[e.actor] = e.actorHp;
        } else if (e.type === 'regen') hp[e.actor] = e.actorHp;
        else if (e.type === 'poison') hp[e.target] = e.targetHp;
        else if (e.type === 'revive') hp[e.actor] = e.hp;
    }
    const i = (x: number) => Math.max(0, Math.round(x));
    return {
        winner: result.winner,
        actions: i(result.actions),
        hpLeftA: i(hp[0]),
        hpLeftB: i(hp[1]),
        maxHpA: i(result.maxHp[0]),
        maxHpB: i(result.maxHp[1]),
    };
}

/** The value the contract stores in `BattleFinalized.resultHash`. */
export function resultHash(battleId: bigint, seed: number, o: Outcome): Hex {
    return keccak256(
        encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'uint32' }, { type: 'uint8' }, { type: 'uint16' }, { type: 'uint32' }, { type: 'uint32' }, { type: 'uint32' }, { type: 'uint32' }],
            [battleId, seed, o.winner, o.actions, o.hpLeftA, o.hpLeftB, o.maxHpA, o.maxHpB],
        ),
    );
}

export interface ReplaySim {
    /** Fighter parts, attacker first (the battle scene renders these). */
    parts: [MonsterParts, MonsterParts];
    result: BattleResult;
}

/** The PVE opponent for a tier, exactly as the API builds it. */
export function opponentForTier(tier: number): { monster: Monster; parts: MonsterParts } {
    const t = ARENA[Math.max(0, Math.min(Math.round(tier), ARENA.length - 1))];
    return { monster: scaleMonster(buildMonster(t.parts), t.statMult), parts: t.parts };
}

/** Re-run the fight from the snapshots. `null` when this build has no sim for that version. */
export function simulateBattle(record: BattleRecord): ReplaySim | null {
    const sim = SIMS[record.simVersion];
    if (!sim) return null;
    const atk = partsFromLoadout(record.atkLoadout).parts;
    let defender: { monster: Monster; parts: MonsterParts };
    if (record.mode === 0) defender = opponentForTier(Number(record.ref));
    else {
        const parts = partsFromLoadout(record.defLoadout).parts;
        defender = { monster: buildMonster(parts), parts };
    }
    return { parts: [atk, defender.parts], result: sim(buildMonster(atk), defender.monster, record.seed) };
}

export type VerifyStatus = 'verified' | 'mismatch' | 'unavailable';
export type VerifyReason = 'in_progress' | 'unsupported_sim';

export interface VerifyResult {
    status: VerifyStatus;
    /** Set only when `status === 'unavailable'`. */
    reason?: VerifyReason;
    /** What the contract recorded (`BattleFinalized`). */
    claimed?: Outcome;
    /** What this browser recomputed from the on-chain seed + snapshots. */
    recomputed?: Outcome;
    /** `resultHash(recomputed) === final.resultHash`. */
    hashOk?: boolean;
    sim?: ReplaySim;
}

const FIELDS: (keyof Outcome)[] = ['winner', 'actions', 'hpLeftA', 'hpLeftB', 'maxHpA', 'maxHpB'];

export function verifyBattle(record: BattleRecord): VerifyResult {
    if (!record.final) return { status: 'unavailable', reason: 'in_progress' };
    const sim = simulateBattle(record);
    if (!sim) return { status: 'unavailable', reason: 'unsupported_sim' };
    const claimed: Outcome = {
        winner: record.final.winner,
        actions: record.final.actions,
        hpLeftA: record.final.hpLeftA,
        hpLeftB: record.final.hpLeftB,
        maxHpA: record.final.maxHpA,
        maxHpB: record.final.maxHpB,
    };
    const recomputed = outcomeOf(sim.result);
    const fieldsOk = FIELDS.every((k) => claimed[k] === recomputed[k]);
    const hashOk = resultHash(record.battleId, record.seed, recomputed) === record.final.resultHash;
    return { status: fieldsOk && hashOk ? 'verified' : 'mismatch', claimed, recomputed, hashOk, sim };
}

async function getLogsChunked(
    client: LogsClient,
    params: Omit<LogsQuery, 'fromBlock' | 'toBlock'>,
    from: bigint,
    to: bigint,
): Promise<readonly ReplayLog[]> {
    const out: ReplayLog[] = [];
    let span = MAX_SPAN;
    let start = from;
    while (start <= to) {
        const end = start + span - 1n < to ? start + span - 1n : to;
        try {
            out.push(...(await client.getLogs({ ...params, fromBlock: start, toBlock: end })));
            start = end + 1n;
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (span > MIN_SPAN && /range|limit|too many|exceed/i.test(message)) {
                span = span / 2n >= MIN_SPAN ? span / 2n : MIN_SPAN;
                continue;
            }
            throw e;
        }
    }
    return out;
}

const num = (v: unknown): number => Number(v as number | bigint);
const big = (v: unknown): bigint => BigInt(v as bigint | number | string);
const hex = (v: unknown): Hex => v as Hex;

function toStarted(log: ReplayLog): BattleRecord | null {
    const a = log.args;
    if (!a) return null;
    return {
        battleId: big(a.battleId),
        mode: num(a.mode) as 0 | 1 | 2,
        attacker: hex(a.attacker),
        defender: hex(a.defender),
        ref: big(a.ref),
        atkLoadout: big(a.atkLoadout),
        defLoadout: big(a.defLoadout),
        seed: num(a.seed),
        simVersion: num(a.simVersion),
        startTx: log.transactionHash,
        final: null,
        rewards: null,
    };
}

/** F-12: `BattleStarted` + `BattleFinalized` (+ `RewardGranted`) for one battle id. */
export async function fetchBattle(battleId: bigint, deps: Partial<ReplayDeps> = {}): Promise<BattleRecord | null> {
    const client = deps.client ?? defaultDeps.client;
    const from = deps.fromBlock ?? defaultDeps.fromBlock;
    const latest = await client.getBlockNumber();
    if (latest < from) return null;

    const started = await getLogsChunked(client, { ...GAME, abi: GAME.abi, eventName: 'BattleStarted', args: { battleId } }, from, latest);
    const record = started.length ? toStarted(started[0]) : null;
    if (!record) return null;

    const finals = await getLogsChunked(client, { ...GAME, abi: GAME.abi, eventName: 'BattleFinalized', args: { battleId } }, from, latest);
    const fin = finals[0];
    if (fin?.args) {
        record.final = {
            winner: num(fin.args.winner) as 0 | 1,
            actions: num(fin.args.actions),
            hpLeftA: num(fin.args.hpLeftA),
            hpLeftB: num(fin.args.hpLeftB),
            maxHpA: num(fin.args.maxHpA),
            maxHpB: num(fin.args.maxHpB),
            resultHash: hex(fin.args.resultHash),
            txHash: fin.transactionHash,
            blockNumber: fin.blockNumber,
        };
        // Rewards are emitted by the same finalize tx: one block is enough.
        const granted = await getLogsChunked(
            client,
            { ...GAME, abi: GAME.abi, eventName: 'RewardGranted', args: { battleId } },
            fin.blockNumber,
            fin.blockNumber,
        );
        const g = granted[0]?.args;
        if (g) record.rewards = { gloo: big(g.gloo), eggs: num(g.eggs), brainDelta: num(g.brainDelta) };
    }
    return record;
}
