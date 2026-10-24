/** Shared API types. Imported by the client as types only. */

export type Hex = `0x${string}`;

export interface Loadout {
    head: number;
    body: number;
    legs: number;
    acc: number;
}

export interface MeView {
    address: Hex;
    registered: boolean;
    username?: string;
    /** Player code, `MONS-XXXXXX`. */
    code?: string;
    brain: number;
    gloo: number;
    eggs: number;
    rareEggs: number;
    /** Entropy sequences still waiting for a callback, as decimal strings. */
    pendingEggs: string[];
    highestTier: number;
    loadout: Loadout;
    /** tokenId → amount held. */
    balances: Record<number, number>;
    communityId?: number;
    limits: { glooToday: number; glooCap: number; pvpEggsToday: number; pvpEggCap: number };
}

export type BattleRequest =
    | { mode: 'pve'; tier: number }
    | { mode: 'pvp'; code: string }
    | { mode: 'war'; warId: number; targetIdx: number };

export type BattleMode = BattleRequest['mode'];

/** Same shape as `Outcome` in src/game/sim/outcome.ts (all integers, HP clamped ≥ 0). */
export interface BattleOutcome {
    winner: 0 | 1;
    actions: number;
    hpLeftA: number;
    hpLeftB: number;
    maxHpA: number;
    maxHpB: number;
}

export interface BattleView {
    /** uint256 as a decimal string. */
    battleId: string;
    seed: number;
    simVersion: number;
    mode: BattleMode;
    attacker: { address: Hex; loadout: Loadout };
    defender: { address?: Hex; loadout?: Loadout; tier?: number };
    outcome: BattleOutcome;
    rewards: { gloo: number; eggs: number; brainDelta: number; stars?: number };
    txStart: Hex;
    txFinal: Hex | null;
    status: 'final' | 'finalize_pending';
}

export interface EggStatus {
    status: 'pending' | 'hatched';
    tokenId?: number;
    rarity?: number;
    txHash?: Hex;
}

export interface PlayerLookup {
    address: Hex;
    username: string;
    brain: number;
    loadout: Loadout;
}

export interface HealthView {
    chainId: number;
    block: string;
    simVersion: number;
    relayers: Array<{ address: string; balanceMon: string }>;
    randomSource: string;
}

export interface ApiErrorBody {
    error: { code: string; message: string; details?: Record<string, unknown> };
}
