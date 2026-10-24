/** Full round-robin of all 343 builds (both sides per seed). Shared by balance-check and fit-arena. */
import { PARTS } from '../src/game/data/parts.ts';
import { buildMonster } from '../src/game/sim/monster.ts';
import { simulate } from '../src/game/sim/battle.ts';
import type { MonsterParts } from '../src/game/data/types.ts';

export const SEEDS = [17, 7936, 4242, 99991, 31337, 2024];

export function allCombos(): MonsterParts[] {
    const by = (slot: string) => PARTS.filter((p) => p.slot === slot).map((p) => p.id);
    const out: MonsterParts[] = [];
    for (const h of by('head')) for (const b of by('body')) for (const l of by('legs')) out.push([h, b, l]);
    return out;
}

export function sweep(seeds: number[] = SEEDS) {
    const combos = allCombos();
    const mons = combos.map(buildMonster);
    const n = mons.length;
    const win = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
            let w = 0;
            for (const s of seeds) {
                if (simulate(mons[i], mons[j], s).winner === 0) w++;
                if (simulate(mons[j], mons[i], s + 1).winner === 1) w++;
            }
            win[i][j] = w / (seeds.length * 2);
            win[j][i] = 1 - win[i][j];
        }
    for (let i = 0; i < n; i++) win[i][i] = 0.5;
    const overall = win.map((r) => r.reduce((a, b) => a + b, 0) / n);
    const bestCounter = combos.map((_, j) => {
        let m = 0;
        for (let i = 0; i < n; i++) if (i !== j) m = Math.max(m, win[i][j]);
        return m;
    });
    const part: Record<string, number> = {};
    for (const p of PARTS) {
        const idx = combos.flatMap((c, i) => (c.includes(p.id) ? [i] : []));
        part[p.id] = idx.reduce((a, i) => a + overall[i], 0) / idx.length;
    }
    return { combos, overall, bestCounter, part };
}
