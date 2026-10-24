import type { PublicClient } from 'viem';
import { publicClient } from './config.ts';
import { COMMUNITY, GAME, PARTS } from './addresses.ts';
import type { CommunityView, Hex, PlayerView, WeeklyView } from './types.ts';
import { partsFromLoadout } from './loadout.ts';
import type { MonsterParts } from '../game/data/types.ts';

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

// ── communities and weekly tasks (F-09, F-10) ───────────────────────────────
// There is no community read endpoint in the API plan (only create/join/leave/
// claim), so the client reads the community contract directly, like the replay.

/** A member row: chain identity plus the monster they have equipped right now. */
export interface MemberView {
    address: Hex;
    username: string;
    brain: number;
    parts: MonsterParts;
}

export async function getCommunity(cid: number, client: PublicClient = publicClient): Promise<CommunityView> {
    return (await client.readContract({ ...COMMUNITY, functionName: 'getCommunity', args: [cid] })) as CommunityView;
}

/** `progress[task]`, my `contribution[task]` and the per-tier `claimedMask[task]` for one week. */
export async function getWeekly(week: number, cid: number, player: Hex, client: PublicClient = publicClient): Promise<WeeklyView> {
    const [progress, contribution, claimedMask] = (await client.readContract({
        ...COMMUNITY,
        functionName: 'weeklyView',
        args: [week, cid, player],
    })) as [readonly number[], readonly number[], readonly number[]];
    return {
        progress: [Number(progress[0] ?? 0), Number(progress[1] ?? 0)],
        contribution: [Number(contribution[0] ?? 0), Number(contribution[1] ?? 0)],
        claimedMask: [Number(claimedMask[0] ?? 0), Number(claimedMask[1] ?? 0)],
    };
}

export async function getCurrentWeek(client: PublicClient = publicClient): Promise<number> {
    return Number(await client.readContract({ ...COMMUNITY, functionName: 'currentWeek' }));
}

/** Unix seconds. */
export async function getWeekEndsAt(client: PublicClient = publicClient): Promise<number> {
    return Number(await client.readContract({ ...COMMUNITY, functionName: 'weekEndsAt' }));
}

/** Weekly theme as a family index (0 fang … 6 ghost). */
export async function getThemeFamily(week: number, client: PublicClient = publicClient): Promise<number> {
    return Number(await client.readContract({ ...COMMUNITY, functionName: 'themeOf', args: [week] }));
}

/**
 * Member rows for the home screen. One `getPlayer` per member (capped at 30 by
 * the contract); a member that fails to read still appears, with their address
 * short-formed, so the roster never looks smaller than it is.
 */
export async function getMembers(addrs: readonly Hex[], client: PublicClient = publicClient): Promise<MemberView[]> {
    return Promise.all(
        addrs.map(async (address): Promise<MemberView> => {
            try {
                const p = await getPlayer(address, client);
                return { address, username: p.username, brain: Number(p.brain), parts: partsFromLoadout(p.loadout).parts };
            } catch {
                return { address, username: '', brain: 0, parts: partsFromLoadout(0n).parts };
            }
        }),
    );
}
