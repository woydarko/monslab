import { describe, expect, it } from 'vitest';
import { matchupLabels, matchupLine, matchupOf } from './matchup.ts';

describe('matchupLabels', () => {
    it('uses the G1b thresholds', () => {
        expect(matchupLabels(2)).toBe('Strong');
        expect(matchupLabels(3)).toBe('Strong');
        expect(matchupLabels(1)).toBe('Good');
        expect(matchupLabels(0)).toBe('Even');
        expect(matchupLabels(-1)).toBe('Risky');
        expect(matchupLabels(-2)).toBe('Weak');
    });
});

describe('matchupLine', () => {
    it('reads both attack lanes from my side', () => {
        expect(matchupLine({ attack: 2, defense: -1, special: 0 })).toBe('Your attack: Strong · Their attack: Risky');
    });

    it('says Even when both lanes are neutral', () => {
        expect(matchupLine({ attack: 0, defense: 0, special: 3 })).toBe('Your attack: Even · Their attack: Even');
    });
});

describe('matchupOf', () => {
    // goo_head: water+volt, goo_body: water+nature, goo_legs: water+stone
    // fang_head: wind+fire, fang_body: wind+nature, fang_legs: wind+fire
    it('scores my head against their body', () => {
        // water–wind 0, nature beats water −1, wind beats volt −1, nature beats volt −1
        expect(matchupOf(['goo_head', 'goo_body', 'goo_legs'], ['fang_head', 'fang_body', 'fang_legs']).attack).toBe(-3);
    });

    it('is positive when my head counters their body', () => {
        // wind–water 0, wind beats nature +1, water beats fire −1, fire beats nature +1
        expect(matchupOf(['fang_head', 'fang_body', 'fang_legs'], ['goo_head', 'goo_body', 'goo_legs']).attack).toBe(1);
    });

    it('reports all three lanes', () => {
        const m = matchupOf(['eye_head', 'eye_body', 'eye_legs'], ['bone_head', 'bone_body', 'bone_legs']);
        expect(Object.keys(m).sort()).toEqual(['attack', 'defense', 'special']);
        for (const v of Object.values(m)) expect(Number.isInteger(v)).toBe(true);
    });
});
