import { describe, expect, it } from 'vitest';
import { PARTS } from '../game/data/parts.ts';
import { clashScore, ELEMENT_ORDER, partElements } from './elements.ts';

const step = (a: string, b: string) => (ELEMENT_ORDER.indexOf(b as never) - ELEMENT_ORDER.indexOf(a as never) + 6) % 6;

describe('partElements', () => {
    it('gives every part two distinct, non-opposite elements', () => {
        const counts: Record<string, number> = {};
        for (const p of PARTS) {
            const els = partElements(p.id);
            expect(els, p.id).not.toBeNull();
            const [a, b] = els!;
            expect(a, p.id).not.toBe(b);
            // Three steps apart on the cycle = the neutral opposite pair, never on one part.
            expect(step(a, b), p.id).not.toBe(3);
            for (const e of els!) counts[e] = (counts[e] ?? 0) + 1;
        }
        // Each of the six elements appears exactly 7 times across the 21 parts.
        for (const el of ELEMENT_ORDER) expect(counts[el], el).toBe(7);
    });

    it('has no elements for an accessory token', () => {
        expect(partElements('201')).toBeNull();
    });
});

describe('clashScore', () => {
    it('scores a full counter at +3', () => {
        expect(clashScore(['stone', 'fire'], ['fire', 'wind'])).toBe(3);
    });

    it('is neutral for identical element pairs', () => {
        expect(clashScore(['fire', 'wind'], ['fire', 'wind'])).toBe(0);
    });

    it('scores a resisted attack at -3', () => {
        expect(clashScore(['wind', 'nature'], ['stone', 'fire'])).toBe(-3);
    });
});
