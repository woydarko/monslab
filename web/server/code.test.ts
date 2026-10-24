import { describe, expect, it } from 'vitest';
import { codeToBytes6, playerCodeCandidates } from './code.ts';

describe('player codes', () => {
    it('derives 8 distinct deterministic Crockford candidates', () => {
        const a = '0x1111111111111111111111111111111111111111';
        const c = playerCodeCandidates(a);
        expect(c).toHaveLength(8);
        expect(new Set(c).size).toBe(8);
        for (const x of c) expect(x).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
        expect(playerCodeCandidates(a)).toEqual(c);
        expect(playerCodeCandidates('0x2222222222222222222222222222222222222222')).not.toEqual(c);
    });

    it('encodes codes as ASCII bytes6', () => {
        expect(codeToBytes6('AB12CD')).toBe('0x414231324344');
    });
});
