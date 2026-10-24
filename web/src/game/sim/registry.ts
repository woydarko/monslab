/** Sim versions: replays use the version recorded on-chain. Never edit a shipped version. */
import { ARENA } from '../data/arena.ts';
import { simulate, type BattleResult } from './battle.ts';
import { buildMonster, scaleMonster, type Monster } from './monster.ts';

export const SIM_VERSION = 1;

export const SIMS: Record<number, (a: Monster, b: Monster, seed: number) => BattleResult> = { 1: simulate };

export function opponentForTier(tier: number): Monster {
    return scaleMonster(buildMonster(ARENA[tier].parts), ARENA[tier].statMult);
}
