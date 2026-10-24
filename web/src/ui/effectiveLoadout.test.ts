import { describe, expect, it } from 'vitest';
import { effectiveLoadout } from './effectiveLoadout.ts';

describe('effectiveLoadout', () => {
    it('falls back to the starter for a part no longer owned', () => {
        expect(effectiveLoadout({ head: 7, body: 102, legs: 103, acc: 201 }, { 7: 0, 102: 1, 103: 1, 201: 1 }))
            .toEqual({ head: 101, body: 102, legs: 103, acc: 201, fallback: ['head'] });
    });

    it('clears an accessory no longer owned', () => {
        expect(effectiveLoadout({ head: 101, body: 102, legs: 103, acc: 201 }, { 101: 1, 102: 1, 103: 1, 201: 0 }))
            .toEqual({ head: 101, body: 102, legs: 103, acc: 0, fallback: ['acc'] });
    });

    it('keeps an empty accessory slot without flagging it', () => {
        expect(effectiveLoadout({ head: 101, body: 102, legs: 103, acc: 0 }, { 101: 1, 102: 1, 103: 1 }).fallback).toEqual([]);
    });
});
