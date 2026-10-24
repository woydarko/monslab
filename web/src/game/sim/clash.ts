/** Element clash (F-16): pure scoring used by the sim and the Lab matchup hints. */
import { ELEMENT_ORDER, type ElementId } from '../data/elements.ts';
import type { Monster } from './monster.ts';

export const CLASH_K = 0.25;

const idx = (e: ElementId): number => ELEMENT_ORDER.indexOf(e);

export function beats(a: ElementId, d: ElementId): boolean {
    const step = (idx(d) - idx(a) + 6) % 6;
    return step === 1 || step === 2;
}

/** Sum over every attacker/defender element pair: +1 beats, −1 beaten, 0 otherwise. */
export function clashScore(atk: readonly ElementId[], def: readonly ElementId[]): number {
    let score = 0;
    for (const a of atk) for (const d of def) score += beats(a, d) ? 1 : beats(d, a) ? -1 : 0;
    return score;
}

export function clashMult(score: number): number {
    return 1 + CLASH_K * score;
}

/** attack = my head vs their body, special = my legs vs their body, defense = their head vs my body. */
export function matchup(mine: Monster, theirs: Monster): { attack: number; special: number; defense: number } {
    return {
        attack: clashScore(mine.atkEl, theirs.defEl),
        special: clashScore(mine.spEl, theirs.defEl),
        defense: clashScore(theirs.atkEl, mine.defEl),
    };
}

export function matchupLabel(score: number): 'Strong' | 'Good' | 'Even' | 'Risky' | 'Weak' {
    if (score >= 2) return 'Strong';
    if (score === 1) return 'Good';
    if (score === 0) return 'Even';
    if (score === -1) return 'Risky';
    return 'Weak';
}
