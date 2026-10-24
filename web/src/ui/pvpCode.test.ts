import { describe, expect, it } from 'vitest';
import { inviteLink, normalizeCode } from './pvpCode.ts';

describe('normalizeCode', () => {
    it('accepts the full code, any case', () => {
        expect(normalizeCode('MONS-AB12CD')).toBe('MONS-AB12CD');
        expect(normalizeCode('mons-ab12cd')).toBe('MONS-AB12CD');
    });

    it('accepts the six characters on their own', () => {
        expect(normalizeCode('ab12cd')).toBe('MONS-AB12CD');
        expect(normalizeCode('  ab-12-cd ')).toBe('MONS-AB12CD');
        expect(normalizeCode('MONSAB12CD')).toBe('MONS-AB12CD');
    });

    it('rejects anything that is not six characters', () => {
        expect(normalizeCode('MONS-AB12')).toBeNull();
        expect(normalizeCode('')).toBeNull();
        expect(normalizeCode('MONS-')).toBeNull();
        expect(normalizeCode('MONS-AB12CDE')).toBeNull();
    });
});

describe('inviteLink', () => {
    it('points at the vs deep link on the current origin', () => {
        expect(inviteLink('MONS-AB12CD', 'https://monslab.xyz')).toBe('https://monslab.xyz/?vs=MONS-AB12CD');
    });
});
