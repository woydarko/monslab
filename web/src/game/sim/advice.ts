/**
 * Loss advice: which single part swap would have helped most against this
 * opponent. Found by simulation, not guessed from stats, so it covers every
 * part and trait interaction (armor vs poison, dodge vs crit, ...).
 * Pure: deterministic seeds, no Math.random().
 */
import { PARTS, getPart } from '../data/parts.ts';
import type { MonsterParts } from '../data/types.ts';
import { simulate } from './battle.ts';
import { buildMonster, type Monster } from './monster.ts';

/** Practice fights per candidate. 24 keeps a full scan of 21 parts well under a frame budget. */
export const ADVICE_TRIALS = 24;
/** A swap must win this many more practice fights to be worth suggesting. */
const MIN_GAIN = 3;

export interface SwapAdvice {
    partId: string;
    wins: number;
    baseWins: number;
    trials: number;
}

/** Practice fights won by this build against `enemy` (same seeds every call). */
export function practiceWins(parts: MonsterParts, enemy: Monster, trials = ADVICE_TRIALS): number {
    const me = buildMonster(parts);
    let w = 0;
    for (let i = 0; i < trials; i++) if (simulate(me, enemy, (i * 7919 + 17) >>> 0).winner === 0) w++;
    return w;
}

/**
 * The single-part swap (from `candidates`) that wins the most practice fights
 * against `enemy`, or null if none beats the current build by MIN_GAIN.
 */
export function bestSwap(parts: MonsterParts, enemy: Monster, candidates: Iterable<string>, trials = ADVICE_TRIALS): SwapAdvice | null {
    const baseWins = practiceWins(parts, enemy, trials);
    let best: SwapAdvice | null = null;
    for (const id of candidates) {
        const p = getPart(id);
        const idx = p.slot === 'head' ? 0 : p.slot === 'body' ? 1 : 2;
        if (parts[idx] === id) continue;
        const trial = [...parts] as MonsterParts;
        trial[idx] = id;
        const w = practiceWins(trial, enemy, trials);
        if (w >= baseWins + MIN_GAIN && (!best || w > best.wins)) best = { partId: id, wins: w, baseWins, trials };
    }
    return best;
}

/** Every part id, for "a part you could still win" advice. */
export function allPartIds(): string[] {
    return PARTS.map((p) => p.id);
}
