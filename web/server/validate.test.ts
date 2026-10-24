import { describe, expect, it } from 'vitest';
import { battleRequest, eggCount, eggType, parseJson, playerCode, redeemCode, tier, username, communityName } from './validate.ts';

const code = (f: () => unknown) => {
    try { f(); } catch (e) { return (e as { code?: string }).code; }
    return 'no-throw';
};

describe('validate', () => {
    it('normalizes usernames', () => {
        expect(username('Nabil_1')).toBe('nabil_1');
        expect(code(() => username('ab'))).toBe('invalid_username');
        expect(code(() => username('bad name'))).toBe('invalid_username');
    });

    it('parses player codes forgivingly', () => {
        expect(playerCode('mons-ab12cd')).toEqual({ code: 'MONS-AB12CD', bytes6: '0x414231324344' });
        expect(playerCode('MONS-AB1OCD').code).toBe('MONS-AB10CD');
        expect(playerCode('ab 12 cd').code).toBe('MONS-AB12CD');
        expect(playerCode('MONS-IL0UXY').code).toBe('MONS-110VXY');
        expect(code(() => playerCode('MONS-AB12C'))).toBe('bad_code_format');
        expect(code(() => playerCode(42 as unknown as string))).toBe('bad_code_format');
    });

    it('validates the rest', () => {
        expect(redeemCode(' blitzjogja ')).toBe('BLITZJOGJA');
        expect(code(() => redeemCode('a b'))).toBe('invalid_code');
        expect(eggCount(10)).toBe(10);
        expect(code(() => eggCount(11))).toBe('invalid_request');
        expect(code(() => eggCount(1.5))).toBe('invalid_request');
        expect(tier(0)).toBe(0);
        expect(code(() => tier(11))).toBe('invalid_request');
        expect(eggType('rare')).toBe(1);
        expect(code(() => eggType('gold'))).toBe('invalid_request');
        expect(communityName('  Jogja Devs ')).toBe('Jogja Devs');
        expect(code(() => communityName('x'))).toBe('invalid_name');
    });

    it('parses battle requests', () => {
        expect(battleRequest({ mode: 'pve', tier: 3 })).toEqual({ mode: 'pve', tier: 3 });
        expect(battleRequest({ mode: 'pvp', code: 'mons-ab12cd' })).toEqual({ mode: 'pvp', code: 'MONS-AB12CD' });
        expect(battleRequest({ mode: 'war', warId: 2, targetIdx: 4 })).toEqual({ mode: 'war', warId: 2, targetIdx: 4 });
        expect(code(() => battleRequest({ mode: 'war', warId: 2, targetIdx: 5 }))).toBe('invalid_request');
        expect(code(() => battleRequest({ mode: 'x' }))).toBe('invalid_request');
    });

    it('limits and parses JSON bodies', async () => {
        const big = new Request('http://x/api', { method: 'POST', body: 'x'.repeat(5000) });
        await expect(parseJson(big)).rejects.toMatchObject({ code: 'payload_too_large', status: 413 });
        const bad = new Request('http://x/api', { method: 'POST', body: '{nope' });
        await expect(parseJson(bad)).rejects.toMatchObject({ code: 'invalid_request', status: 400 });
        const good = new Request('http://x/api', { method: 'POST', body: '{"a":1}' });
        expect(await parseJson(good)).toEqual({ a: 1 });
    });
});
