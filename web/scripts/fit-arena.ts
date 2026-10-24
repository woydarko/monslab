/**
 * Re-fit ARENA[tier].statMult: the median of the top 50 builds wins ≈97% at tier 1,
 * falling linearly to ≈37% at tier 10. Tier 0 stays 0.45. Prints the multipliers.
 */
import { ARENA } from '../src/game/data/arena.ts';
import { buildMonster, scaleMonster } from '../src/game/sim/monster.ts';
import { simulate } from '../src/game/sim/battle.ts';
import { sweep } from './sweep.ts';

const { combos, overall } = sweep([17, 7936]);
const top = combos.map((c, i) => ({ c, r: overall[i] })).sort((a, b) => b.r - a.r).slice(0, 50).map((x) => buildMonster(x.c));
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

function medianWin(tier: number, mult: number): number {
    const opp = scaleMonster(buildMonster(ARENA[tier].parts), mult);
    const rates = top.map((m) => SEEDS.filter((s) => simulate(m, opp, s).winner === 0).length / SEEDS.length).sort((a, b) => a - b);
    return (rates[24] + rates[25]) / 2;
}

const out: Record<number, number> = { 0: 0.45 };
for (let tier = 1; tier <= 10; tier++) {
    const target = 0.97 - ((tier - 1) * 0.6) / 9;
    let lo = 0.3, hi = 3;
    for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        if (medianWin(tier, mid) > target) lo = mid;
        else hi = mid;
    }
    out[tier] = +((lo + hi) / 2).toFixed(2);
    console.log(`tier ${tier}: statMult ${out[tier]} (median win ${medianWin(tier, out[tier]).toFixed(3)}, target ${target.toFixed(3)})`);
}
console.log(JSON.stringify(out));
