import { describe, expect, it } from 'vitest';
import { buildMonster } from './monster.ts';
import { simulate } from './battle.ts';
import { outcomeOf, resultHash } from './outcome.ts';
import { opponentForTier, SIMS, SIM_VERSION } from './registry.ts';

describe('outcome', () => {
    it('summarizes a battle with integer, clamped HP', () => {
        const r = simulate(buildMonster(['goo_head', 'goo_body', 'goo_legs']), opponentForTier(0), 42);
        const o = outcomeOf(r);
        expect(o.winner).toBe(r.winner);
        expect(o.actions).toBe(r.actions);
        expect(r.winner === 0 ? o.hpLeftB : o.hpLeftA).toBe(0);
        for (const v of Object.values(o)) expect(Number.isInteger(v) && v >= 0).toBe(true);
        expect([o.maxHpA, o.maxHpB]).toEqual(r.maxHp.map(Math.round));
    });

    it('hashes the outcome like the contract (abi.encode)', () => {
        const h = resultHash(1n, 2841937721, { winner: 0, actions: 17, hpLeftA: 42, hpLeftB: 0, maxHpA: 108, maxHpB: 95 });
        expect(h).toBe('0xc9bd0cccdaee2381dca37bcb952e8601000fbf6ade735ca2e88a74554c4e4535');
    });

    it('registers sim v1', () => {
        expect(SIM_VERSION).toBe(1);
        expect(typeof SIMS[1]).toBe('function');
    });
});
