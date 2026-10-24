import { describe, expect, it } from 'vitest';
import { ARENA } from '../data/arena.ts';
import type { MonsterParts } from '../data/types.ts';
import { allPartIds, bestSwap } from './advice.ts';
import { buildMonster, scaleMonster } from './monster.ts';

const STARTER: MonsterParts = ['goo_head', 'goo_body', 'goo_legs'];

describe('loss advice', () => {
    it('is deterministic', () => {
        const t = ARENA[5];
        const enemy = scaleMonster(buildMonster(t.parts), t.statMult);
        expect(bestSwap(STARTER, enemy, allPartIds())).toEqual(bestSwap(STARTER, enemy, allPartIds()));
    });

    it('only suggests a swap that wins more practice fights', () => {
        for (const t of ARENA.slice(1)) {
            const enemy = scaleMonster(buildMonster(t.parts), t.statMult);
            const a = bestSwap(STARTER, enemy, allPartIds());
            if (a) expect(a.wins).toBeGreaterThanOrEqual(a.baseWins + 3);
        }
    });

    it('scans every part fast enough to run on the result screen', () => {
        const t = ARENA[5];
        const enemy = scaleMonster(buildMonster(t.parts), t.statMult);
        const t0 = performance.now();
        bestSwap(STARTER, enemy, allPartIds());
        expect(performance.now() - t0).toBeLessThan(150);
    });
});
