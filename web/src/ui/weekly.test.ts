import { describe, expect, it } from 'vitest';
import { formatCountdown, themeFamily, TIER_REWARD, tierState, TIERS } from './weekly.ts';

describe('tierState', () => {
    it('marks claimed and locked tiers', () => {
        expect(tierState(12, 1, 0b001, TIERS.hatch)).toEqual(['claimed', 'locked', 'locked']);
    });

    it('needs a contribution before claiming', () => {
        expect(tierState(30, 0, 0, TIERS.hatch)).toEqual(['needContribution', 'needContribution', 'locked']);
    });

    it('all claimable at the top', () => {
        expect(tierState(50, 2, 0, TIERS.hatch)).toEqual(['claimable', 'claimable', 'claimable']);
    });
});

describe('formatCountdown', () => {
    it('shows days, hours and minutes while the week is long', () => {
        expect(formatCountdown(2 * 86_400 + 4 * 3600 + 12 * 60)).toBe('2d 04:12');
    });

    it('drops the day part on the last day', () => {
        expect(formatCountdown(4 * 3600 + 12 * 60 + 30)).toBe('04:12');
        expect(formatCountdown(59)).toBe('00:00');
    });

    it('is null once the week is over', () => {
        expect(formatCountdown(0)).toBeNull();
        expect(formatCountdown(-5)).toBeNull();
    });
});

describe('themeFamily', () => {
    it('maps the contract family index to a family id', () => {
        expect(themeFamily(0)).toBe('fang');
        expect(themeFamily(6)).toBe('ghost');
    });

    it('ignores an index outside the rotation', () => {
        expect(themeFamily(7)).toBeNull();
    });
});

describe('TIER_REWARD', () => {
    it('follows PRD F-10 for both tasks', () => {
        expect(TIER_REWARD.theme).toEqual(['1 egg', '1 egg', '1 rare egg + accessory']);
        expect(TIER_REWARD.hatch).toEqual(['1 egg', '1 egg', '1 rare egg + accessory']);
    });
});
