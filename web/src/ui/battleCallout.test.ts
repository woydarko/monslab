import { describe, expect, it } from 'vitest';
import { calloutPlan, clashCallout, RESISTED, SUPER_EFFECTIVE } from './battleCallout.ts';
import type { BattleEvent } from '../game/sim/battle.ts';

const attack = (clash: number | undefined, heal = 0) =>
    ({ type: 'attack', actor: 0, target: 1, clash, heal }) as unknown as BattleEvent;

describe('clashCallout', () => {
    it('calls out a strong hit at +2 and above', () => {
        expect(clashCallout(2)?.text).toBe(SUPER_EFFECTIVE);
        expect(clashCallout(3)?.tone).toBe('primary');
    });

    it('calls out a resisted hit at -2 and below', () => {
        expect(clashCallout(-2)?.text).toBe(RESISTED);
        expect(clashCallout(-3)?.tone).toBe('muted');
    });

    it('stays quiet between -1 and +1, and when the sim has no clash (pre-elements replay)', () => {
        expect(clashCallout(0)).toBeNull();
        expect(clashCallout(1)).toBeNull();
        expect(clashCallout(-1)).toBeNull();
        expect(clashCallout(undefined)).toBeNull();
    });
});

describe('calloutPlan', () => {
    it('lines up with the hp events the battle scene emits', () => {
        const plan = calloutPlan([
            attack(2),
            attack(0),
            attack(-2),
            attack(3, 4), // draining hit: attacker hp reported a second time
            { type: 'poison', target: 1, damage: 4, targetHp: 20 } as unknown as BattleEvent,
            attack(1),
        ]);
        expect(plan.map((c) => c?.text ?? null)).toEqual([SUPER_EFFECTIVE, null, RESISTED, SUPER_EFFECTIVE, null, null, null]);
    });
});
