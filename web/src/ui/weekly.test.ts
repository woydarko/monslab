import { describe, expect, it } from 'vitest';
import { tierState, TIERS } from './weekly.ts';

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
