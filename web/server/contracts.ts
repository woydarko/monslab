/** Read-side chain access for the API (viem public client + typed contract handles). */
import { createPublicClient, fallback, http, hexToString, type Abi } from 'viem';
import { monadTestnet } from 'viem/chains';
import gameAbi from '../src/chain/abi/MonsGame.json' with { type: 'json' };
import partsAbi from '../src/chain/abi/MonsParts.json' with { type: 'json' };
import communityAbi from '../src/chain/abi/MonsCommunity.json' with { type: 'json' };
import { getEnv } from './env.ts';
import { EGG_HATCHED, EGG_REQUESTED, BATTLE_STARTED } from './events.ts';
import type { Hex, Loadout, MeView } from './types.ts';

export const GAME_ABI = gameAbi as Abi;
export const PARTS_ABI = partsAbi as Abi;
export const COMMUNITY_ABI = communityAbi as Abi;

/** Every token id a player can hold: parts 1..21, starters 101..103, accessories 201..203. */
export const ALL_TOKEN_IDS = [...Array.from({ length: 21 }, (_, i) => i + 1), 101, 102, 103, 201, 202, 203];


/** Max block span per eth_getLogs call. */
export const LOG_CHUNK = 10_000n;

let client: ReturnType<typeof makeClient> | null = null;
function makeClient() {
    const env = getEnv();
    const transports = [http(env.rpcUrl), ...(env.rpcUrlFallback ? [http(env.rpcUrlFallback)] : [])];
    return createPublicClient({ chain: monadTestnet, transport: transports.length > 1 ? fallback(transports) : transports[0] });
}
export function publicClient() {
    return (client ??= makeClient());
}

export const game = () => ({ address: getEnv().game, abi: GAME_ABI });
export const parts = () => ({ address: getEnv().parts, abi: PARTS_ABI });
export const community = () => ({ address: getEnv().community, abi: COMMUNITY_ABI });

export function unpackLoadout(x: bigint): Loadout {
    return { head: Number((x >> 48n) & 0xffffn), body: Number((x >> 32n) & 0xffffn), legs: Number((x >> 16n) & 0xffffn), acc: Number(x & 0xffffn) };
}

export function codeString(bytes6: Hex): string | undefined {
    return BigInt(bytes6) === 0n ? undefined : `MONS-${hexToString(bytes6)}`;
}

interface PlayerStruct {
    registered: boolean;
    username: string;
    code: Hex;
    brain: number;
    gloo: bigint;
    eggs: number;
    rareEggs: number;
    pendingEggs: number;
    highestTier: number;
    glooToday: number;
    pvpEggsToday: number;
    loadout: bigint;
}

export async function getPlayer(address: Hex): Promise<PlayerStruct> {
    return (await publicClient().readContract({ ...game(), functionName: 'getPlayer', args: [address] })) as PlayerStruct;
}

/** getLogs over [from, latest] in LOG_CHUNK spans. */
export async function getLogsChunked<T>(fetch: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>, fromBlock = getEnv().deployBlock): Promise<T[]> {
    const latest = await publicClient().getBlockNumber();
    const out: T[] = [];
    for (let from = fromBlock; from <= latest; from += LOG_CHUNK) {
        const to = from + LOG_CHUNK - 1n < latest ? from + LOG_CHUNK - 1n : latest;
        out.push(...(await fetch(from, to)));
    }
    return out;
}

async function pendingSequences(address: Hex): Promise<string[]> {
    const pc = publicClient();
    const { address: gameAddr } = game();
    const [requested, hatched] = await Promise.all([
        getLogsChunked((fromBlock, toBlock) => pc.getLogs({ address: gameAddr, event: EGG_REQUESTED, args: { player: address }, fromBlock, toBlock })),
        getLogsChunked((fromBlock, toBlock) => pc.getLogs({ address: gameAddr, event: EGG_HATCHED, args: { player: address }, fromBlock, toBlock })),
    ]);
    const seq = (l: unknown) => String((l as { args: { sequence: bigint } }).args.sequence);
    const done = new Set(hatched.map(seq));
    return requested.map(seq).filter((s) => !done.has(s));
}

export async function readMe(address: Hex): Promise<MeView> {
    const pc = publicClient();
    const [p, balances, cid, params] = await Promise.all([
        getPlayer(address),
        pc.readContract({ ...parts(), functionName: 'balanceOfBatch', args: [ALL_TOKEN_IDS.map(() => address), ALL_TOKEN_IDS.map(BigInt)] }) as Promise<bigint[]>,
        pc.readContract({ ...community(), functionName: 'communityOf', args: [address] }).catch(() => 0) as Promise<number>,
        pc.readContract({ ...game(), functionName: 'params' }) as Promise<{ glooDailyCap: number; pvpEggCap: number }>,
    ]);
    const bal: Record<number, number> = {};
    ALL_TOKEN_IDS.forEach((id, i) => {
        if (balances[i] > 0n) bal[id] = Number(balances[i]);
    });
    return {
        address,
        registered: p.registered,
        username: p.registered ? p.username : undefined,
        code: codeString(p.code),
        brain: Number(p.brain),
        gloo: Number(p.gloo),
        eggs: Number(p.eggs),
        rareEggs: Number(p.rareEggs),
        // Logs only when the contract says something is pending (saves RPC calls).
        pendingEggs: Number(p.pendingEggs) > 0 ? await pendingSequences(address) : [],
        highestTier: Number(p.highestTier),
        loadout: unpackLoadout(BigInt(p.loadout)),
        balances: bal,
        communityId: Number(cid) > 0 ? Number(cid) : undefined,
        limits: { glooToday: Number(p.glooToday), glooCap: Number(params.glooDailyCap), pvpEggsToday: Number(p.pvpEggsToday), pvpEggCap: Number(params.pvpEggCap) },
    };
}

export async function readGame<T>(functionName: string, args: readonly unknown[] = []): Promise<T> {
    return (await publicClient().readContract({ ...game(), functionName, args })) as T;
}

export async function readCommunity<T>(functionName: string, args: readonly unknown[] = []): Promise<T> {
    return (await publicClient().readContract({ ...community(), functionName, args })) as T;
}

/** EggHatched log for a sequence, or null. */
export async function findHatched(sequence: bigint): Promise<{ tokenId: number; rarity: number; txHash: Hex } | null> {
    const pc = publicClient();
    const logs = await getLogsChunked((fromBlock, toBlock) => pc.getLogs({ address: game().address, event: EGG_HATCHED, args: { sequence }, fromBlock, toBlock }));
    const l = logs[0];
    return l ? { tokenId: Number(l.args.tokenId), rarity: Number(l.args.rarity), txHash: l.transactionHash } : null;
}

/** Everything a replay needs from `BattleStarted` (ARCHITECTURE §Flow F). */
export interface BattleStartedLog {
    battleId: bigint;
    attacker: Hex;
    defender: Hex;
    mode: number;
    ref: bigint;
    atkLoadout: bigint;
    defLoadout: bigint;
    seed: number;
    simVersion: number;
    txHash: Hex;
}

/** BattleStarted log for a battle id, or null. */
export async function findBattleStarted(battleId: bigint): Promise<BattleStartedLog | null> {
    const pc = publicClient();
    const logs = await getLogsChunked((fromBlock, toBlock) => pc.getLogs({ address: game().address, event: BATTLE_STARTED, args: { battleId }, fromBlock, toBlock }));
    const l = logs[0];
    if (!l) return null;
    return {
        battleId: l.args.battleId!,
        attacker: l.args.attacker!,
        defender: l.args.defender!,
        mode: Number(l.args.mode),
        ref: l.args.ref!,
        atkLoadout: l.args.atkLoadout!,
        defLoadout: l.args.defLoadout!,
        seed: Number(l.args.seed),
        simVersion: Number(l.args.simVersion),
        txHash: l.transactionHash,
    };
}
