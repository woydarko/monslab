import { describe, expect, it } from 'vitest';
import { PARTS } from './parts.ts';
import { packLoadout, partIdToToken, partsFromLoadout, slotOfToken, tokenToPartId, unpackLoadout } from './tokenIds.ts';

describe('tokenIds', () => {
    it('maps tokens to parts and back', () => {
        expect(tokenToPartId(1)).toBe(PARTS[0].id);
        expect(tokenToPartId(21)).toBe(PARTS[20].id);
        expect(tokenToPartId(101)).toBe('goo_head');
        expect(tokenToPartId(103)).toBe('goo_legs');
        expect(tokenToPartId(0)).toBeNull();
        expect(tokenToPartId(201)).toBeNull();
        expect(partIdToToken(PARTS[6].id)).toBe(7);
        expect(() => partIdToToken('nope')).toThrow();
    });

    it('knows the slot of every token', () => {
        expect(slotOfToken(201)).toBe('acc');
        expect(slotOfToken(102)).toBe('body');
        expect(slotOfToken(1)).toBe(PARTS[0].slot);
        expect(slotOfToken(999)).toBeNull();
    });

    it('packs loadouts as head<<48 | body<<32 | legs<<16 | acc', () => {
        const l = { head: 7, body: 102, legs: 103, acc: 201 };
        expect(unpackLoadout(packLoadout(l))).toEqual(l);
        expect(packLoadout({ head: 101, body: 102, legs: 103, acc: 0 })).toBe((101n << 48n) | (102n << 32n) | (103n << 16n));
        expect(partsFromLoadout(packLoadout({ head: 101, body: 102, legs: 103, acc: 0 }))).toEqual({ parts: ['goo_head', 'goo_body', 'goo_legs'], acc: 0 });
    });
});
