/**
 * PvP preview (F-16): the three lanes of the matchup shown before a fight.
 * `attack` is my head pair against their body pair, `defense` is my body pair
 * against their head pair, `special` is legs against legs. Pure, so the
 * thresholds stay pinned by a test.
 */
import { clashScore, partElements } from './elements.ts';

export interface Matchup {
    attack: number;
    defense: number;
    special: number;
}

function lane(mine: string | undefined, theirs: string | undefined): number {
    const a = mine ? partElements(mine) : null;
    const d = theirs ? partElements(theirs) : null;
    return a && d ? clashScore(a, d) : 0;
}

export function matchupOf(mine: readonly string[], theirs: readonly string[]): Matchup {
    return {
        attack: lane(mine[0], theirs[1]),
        defense: lane(mine[1], theirs[0]),
        special: lane(mine[2], theirs[2]),
    };
}

export type MatchupLabel = 'Strong' | 'Good' | 'Even' | 'Risky' | 'Weak';

export function matchupLabels(score: number): MatchupLabel {
    if (score >= 2) return 'Strong';
    if (score === 1) return 'Good';
    if (score === 0) return 'Even';
    if (score === -1) return 'Risky';
    return 'Weak';
}

/**
 * The one line the PvP preview and the war cards show. "Your attack" is my
 * HEAD pair against their BODY pair; "Their attack" is their HEAD pair against
 * my BODY pair — the same two lanes the sim rolls, read from my side.
 */
export function matchupLine(m: Matchup): string {
    return `Your attack: ${matchupLabels(m.attack)} · Their attack: ${matchupLabels(m.defense)}`;
}
