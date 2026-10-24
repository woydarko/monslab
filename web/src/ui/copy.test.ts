import { describe, expect, it } from 'vitest';
import { errorCopy } from './copy.ts';

describe('errorCopy', () => {
    it('maps codes to the exact design copy', () => {
        expect(errorCopy('username_taken')).toBe('That name is taken. Try another one.');
        expect(errorCopy('no_egg')).toBe('No eggs left. Win PvP or buy one with Gloo.');
        expect(errorCopy('network')).toBe('Monad is slow right now. Try again.');
    });

    it('interpolates target_taken and cooldown', () => {
        expect(errorCopy('target_taken', { lockedByName: 'andi' })).toBe('andi already took this target. Pick another one.');
        expect(errorCopy('target_taken')).toBe('A teammate already took this target. Pick another one.');
        expect(errorCopy('cooldown', { timeLeft: '2d 04:12' })).toBe('You can join a new community next week (2d 04:12 left).');
    });

    it('falls back for unknown codes', () => {
        expect(errorCopy('weird_thing')).toBe('Something went wrong. Try again.');
    });
});
