import { describe, expect, it } from 'vitest';
import { buildFighters, computeBattle } from './battlePlayer.ts';
import { ARENA } from './data/arena.ts';
import { packLoadout, STARTER } from './data/tokenIds.ts';
import { buildMonster } from './sim/monster.ts';
import { simulate } from './sim/battle.ts';
import { outcomeOf } from './sim/outcome.ts';
import { opponentForTier } from './sim/registry.ts';

const starter = packLoadout({ ...STARTER, acc: 201 });

describe('battlePlayer', () => {
    it('builds PVE fighters from the arena tier', () => {
        const [a, b] = buildFighters({ mode: 'pve', atk: starter, def: null, tier: 3, atkName: 'me', defName: 'them' });
        expect(a.parts).toEqual(['goo_head', 'goo_body', 'goo_legs']);
        expect(a.acc).toBe(201);
        expect(b.parts).toEqual(ARENA[3].parts);
        expect(b.statMult).toBe(ARENA[3].statMult);
    });

    it('builds PVP fighters from both loadouts', () => {
        const def = packLoadout({ head: 1, body: 2, legs: 3, acc: 0 });
        const [, b] = buildFighters({ mode: 'pvp', atk: starter, def, tier: null, atkName: 'me', defName: 'them' });
        expect(b.parts).toEqual(['fang_head', 'fang_body', 'fang_legs']);
        expect(b.statMult).toBeUndefined();
    });

    it('computes the same outcome as the raw sim', () => {
        const [a, b] = buildFighters({ mode: 'pve', atk: starter, def: null, tier: 0, atkName: 'me', defName: 'them' });
        const { outcome } = computeBattle(a, b, 42, 1);
        expect(outcome).toEqual(outcomeOf(simulate(buildMonster(['goo_head', 'goo_body', 'goo_legs']), opponentForTier(0), 42)));
        expect(() => computeBattle(a, b, 42, 99)).toThrow('unsupported_sim_version');
    });
});
