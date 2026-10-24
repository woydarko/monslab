// Decoded shapes of contract view structs (viem: uint <= 48 bits → number, larger → bigint). Index [side][idx].
export type Hex = `0x${string}`;
type Pair<T> = readonly [readonly T[], readonly T[]];

export interface WarView {
    a: number;
    b: number;
    status: number; // 0 pending, 1 active, 2 settled, 3 expired
    expiresAt: bigint;
    endsAt: bigint;
    team: Pair<Hex>;
    loadouts: Pair<bigint>;
    lockedBy: Pair<Hex>;
    lockedUntil: Pair<bigint>;
    done: Pair<boolean>;
    stars: Pair<number>;
    attacked: Pair<boolean>;
    teamSize: readonly number[];
    starsA: number;
    starsB: number;
    winner: number;
}

export interface CommunityView {
    name: string;
    leader: Hex;
    members: readonly Hex[];
}

export interface PlayerView {
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
