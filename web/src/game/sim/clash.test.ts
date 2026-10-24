import { describe, expect, it } from 'vitest';
import { beats, clashMult, clashScore, matchupLabel } from './clash.ts';
import { ELEMENT_ORDER, OPPOSITE } from '../data/elements.ts';
import { getPart, PARTS } from '../data/parts.ts';

describe('elements', () => {
    it('follows the cycle table', () => {
        const table: Record<string, string[]> = {
            water: ['stone', 'fire'], stone: ['fire', 'wind'], fire: ['wind', 'nature'],
            wind: ['nature', 'volt'], nature: ['volt', 'water'], volt: ['water', 'stone'],
        };
        for (const a of ELEMENT_ORDER) for (const d of ELEMENT_ORDER) expect(beats(a, d)).toBe(table[a].includes(d));
        expect(beats('water', 'stone') && beats('water', 'fire') && !beats('water', 'wind') && beats('nature', 'water') && beats('volt', 'water')).toBe(true);
    });

    it('every element beats exactly 2 and is beaten by exactly 2', () => {
        for (const e of ELEMENT_ORDER) {
            expect(ELEMENT_ORDER.filter((d) => beats(e, d))).toHaveLength(2);
            expect(ELEMENT_ORDER.filter((a) => beats(a, e))).toHaveLength(2);
        }
    });

    it('every part has 2 distinct, non-opposite elements', () => {
        for (const p of PARTS) {
            const [a, b] = p.elements;
            expect(p.elements).toHaveLength(2);
            expect(a).not.toBe(b);
            expect(OPPOSITE[a]).not.toBe(b);
        }
    });

    it('spreads elements evenly across parts and slots', () => {
        for (const e of ELEMENT_ORDER) {
            expect(PARTS.filter((p) => p.elements.includes(e))).toHaveLength(7);
            for (const slot of ['head', 'body', 'legs'] as const) {
                const n = PARTS.filter((p) => p.slot === slot && p.elements.includes(e)).length;
                expect(n === 2 || n === 3).toBe(true);
            }
        }
    });
});

describe('clash', () => {
    it('scores every attacker/defender pair', () => {
        expect(clashScore(['water', 'fire'], ['stone', 'wind'])).toBe(1);
        expect(clashScore(['volt', 'water'], ['water', 'stone'])).toBe(3);
    });

    it('maps scores to multipliers and labels', () => {
        expect(clashMult(3)).toBe(1.75);
        expect(clashMult(-3)).toBe(0.25);
        expect(matchupLabel(2)).toBe('Strong');
        expect(matchupLabel(1)).toBe('Good');
        expect(matchupLabel(0)).toBe('Even');
        expect(matchupLabel(-1)).toBe('Risky');
        expect(matchupLabel(-3)).toBe('Weak');
    });

    it('uses the rebalanced part stats', () => {
        expect(getPart('goo_body').stats).toEqual({ hp: 73, atk: 4, spd: 2 });
    });
});
