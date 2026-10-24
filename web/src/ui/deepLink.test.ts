import { describe, expect, it } from 'vitest';
import { parseDeepLink } from './deepLink.ts';

describe('parseDeepLink', () => {
    it('normalizes the code and drops invalid war', () => {
        expect(parseDeepLink('?vs=mons-ab12cd&replay=12&war=x')).toEqual({ vs: 'MONS-AB12CD', replay: '12' });
    });

    it('drops script injection', () => {
        expect(parseDeepLink('?replay=<script>')).toEqual({});
    });

    it('accepts a positive war id and rejects zero', () => {
        expect(parseDeepLink('?war=3')).toEqual({ war: 3 });
        expect(parseDeepLink('?war=0&replay=0')).toEqual({});
    });
});
