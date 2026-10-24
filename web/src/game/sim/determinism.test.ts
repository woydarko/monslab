import { describe, expect, it } from 'vitest';
import vectors from './__vectors__/v1.json' with { type: 'json' };
import { buildMonster } from './monster.ts';
import { outcomeOf, resultHash, type Outcome } from './outcome.ts';
import { opponentForTier, SIMS } from './registry.ts';
import { partsFromLoadout } from '../data/tokenIds.ts';

interface Vector { atk: string; def: string | null; tier: number | null; seed: number; battleId: string; outcome: Outcome; resultHash: string }

describe('golden vectors v1', () => {
    it('has 20 vectors', () => expect((vectors as Vector[]).length).toBe(20));
    for (const v of vectors as Vector[]) {
        it(`replays battle ${v.battleId}`, () => {
            const a = buildMonster(partsFromLoadout(BigInt(v.atk)).parts);
            const b = v.def !== null ? buildMonster(partsFromLoadout(BigInt(v.def)).parts) : opponentForTier(v.tier!);
            const o = outcomeOf(SIMS[1](a, b, v.seed));
            expect(o).toEqual(v.outcome);
            expect(resultHash(BigInt(v.battleId), v.seed, o)).toBe(v.resultHash);
        });
    }
});
