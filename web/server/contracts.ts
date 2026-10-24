/** Read-side chain access for the API (viem public client + typed contract handles). */
import { createPublicClient, fallback, http, hexToString, parseAbiItem, type Abi } from 'viem';
import { monadTestnet } from 'viem/chains';
import gameAbi from '../src/chain/abi/MonsGame.json' with { type: 'json' };
import partsAbi from '../src/chain/abi/MonsParts.json' with { type: 'json' };
import communityAbi from '../src/chain/abi/MonsCommunity.json' with { type: 'json' };
import { getEnv } from './env.ts';
import type { Hex, Loadout, MeView } from './types.ts';

export const GAME_ABI = gameAbi as Abi;
export const PARTS_ABI = partsAbi as Abi;
export const COMMUNITY_ABI = communityAbi as Abi;

/** Every token id a player can hold: parts 1..21, starters 101..103, accessories 201..203. */
export const ALL_TOKEN_IDS = [...Array.from({ length: 21 }, (_, i) => i + 1), 101, 102, 103, 201, 202, 203];

export const EGG_REQUESTED = parseAbiItem('event EggRequested(address indexed player, uint64 indexed sequence, uint8 eggType)');
export const EGG_HATCHED = parseAbiItem('event EggHatched(address indexed player, uint64 indexed sequence, uint256 tokenId, uint8 rarity)');

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
