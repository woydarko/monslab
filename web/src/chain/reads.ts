import type { PublicClient } from 'viem';
import { publicClient } from './config.ts';
import { GAME, PARTS } from './addresses.ts';
import type { Hex, PlayerView } from './types.ts';

export async function getPlayer(addr: Hex, client: PublicClient = publicClient): Promise<PlayerView> {
    return (await client.readContract({ ...GAME, functionName: 'getPlayer', args: [addr] })) as PlayerView;
}

export async function getBalances(addr: Hex, ids: readonly number[], client: PublicClient = publicClient): Promise<Record<number, bigint>> {
    const out = (await client.readContract({
        ...PARTS,
        functionName: 'balanceOfBatch',
        args: [ids.map(() => addr), ids.map(BigInt)],
    })) as readonly bigint[];
    return Object.fromEntries(ids.map((id, i) => [id, out[i]]));
}

export async function getLoadout(addr: Hex, client: PublicClient = publicClient): Promise<bigint> {
    return (await client.readContract({ ...GAME, functionName: 'loadoutOf', args: [addr] })) as bigint;
}
