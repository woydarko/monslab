import { describe, expect, it } from 'vitest';
import { PARTS, partsForSlot } from '../data/parts.ts';
import { ARENA } from '../data/arena.ts';
import type { MonsterParts } from '../data/types.ts';
import { buildMonster, scaleMonster } from './monster.ts';
import { simulate } from './battle.ts';
import { mulberry32 } from './rng.ts';
import { autoName, sanitizeName } from '../names.ts';

const ALL_COMBOS: MonsterParts[] = [];
for (const h of partsForSlot('head'))
    for (const b of partsForSlot('body'))
        for (const l of partsForSlot('legs')) ALL_COMBOS.push([h.id, b.id, l.id]);

describe('monster', () => {
    it('has 343 combos (7 per slot)', () => {
        expect(ALL_COMBOS.length).toBe(343);
    });

    it('applies set and mix bonuses', () => {
        expect(buildMonster(['goo_head', 'goo_body', 'goo_legs']).bonus).toEqual({ kind: 'set', family: 'goo' });
        const mix = buildMonster(['fang_head', 'goo_body', 'eye_legs']);
        expect(mix.bonus).toEqual({ kind: 'mix' });
        expect(mix.traits).toContain('chimera');
        expect(buildMonster(['fang_head', 'fang_body', 'goo_legs']).bonus).toBeNull();
    });

    it('caps crit from eyes', () => {
        const eyes = buildMonster(['eye_head', 'eye_body', 'eye_legs']);
        expect(eyes.eyes).toBe(15);
        expect(eyes.critChance).toBeLessThanOrEqual(0.55);
    });
});

describe('battle', () => {
    it('is deterministic for the same inputs and seed', () => {
        const a = buildMonster(['fang_head', 'goo_body', 'eye_legs']);
        const b = buildMonster(['eye_head', 'eye_body', 'eye_legs']);
        const first = JSON.stringify(simulate(a, b, 1234));
        for (let i = 0; i < 100; i++) expect(JSON.stringify(simulate(a, b, 1234))).toBe(first);
    });

    it('always ends with exactly one end event and a winner', () => {
        for (const pa of ALL_COMBOS) {
            const r = simulate(buildMonster(pa), buildMonster(ALL_COMBOS[5]), 7);
            const ends = r.events.filter((e) => e.type === 'end');
            expect(ends.length).toBe(1);
            expect(r.events[r.events.length - 1].type).toBe('end');
            expect(r.actions).toBeLessThanOrEqual(30);
        }
    });

    it('lets the starter monster beat the FTUE dummy on every seed', () => {
        const starter = buildMonster(['goo_head', 'goo_body', 'goo_legs']);
        const dummy = scaleMonster(buildMonster(ARENA[0].parts), ARENA[0].statMult);
        for (let seed = 0; seed < 200; seed++) expect(simulate(starter, dummy, seed).winner).toBe(0);
    });

    it('keeps every Arena tier beatable, and harder near the top', () => {
        // Rate of the 50th best build against each tier (20 seeds): the ladder's difficulty curve.
        const all = ALL_COMBOS.map(buildMonster);
        const curve = ARENA.slice(1).map((t) => {
            const enemy = scaleMonster(buildMonster(t.parts), t.statMult);
            const rates = all
                .map((me) => {
                    let w = 0;
                    for (let seed = 0; seed < 20; seed++) if (simulate(me, enemy, seed * 7919 + 3).winner === 0) w++;
                    return w / 20;
                })
                .sort((a, b) => b - a);
            expect(rates[0], `${t.name}: best build`).toBeGreaterThanOrEqual(0.6);
            return rates[49];
        });
        expect(curve[curve.length - 1]).toBeLessThan(curve[0]);
    });

    it('has no combo winning more than 70% against the field (GDD §16 criterion 4)', () => {
        // 343 combos: every combo fights the same fixed sample of 80 opponents, both sides, 4 seeds each.
        const pick = mulberry32(99);
        const field = Array.from({ length: 80 }, () => ALL_COMBOS[Math.floor(pick() * ALL_COMBOS.length)]).map(buildMonster);
        const SEEDS = 4;
        const rates: { combo: string; rate: number; actions: number }[] = [];
        for (const pa of ALL_COMBOS) {
            const a = buildMonster(pa);
            let wins = 0;
            let total = 0;
            let actions = 0;
            for (const b of field) {
                for (let s = 0; s < SEEDS; s++) {
                    const r1 = simulate(a, b, s * 2 + 1);
                    const r2 = simulate(b, a, s * 2 + 2);
                    wins += (r1.winner === 0 ? 1 : 0) + (r2.winner === 1 ? 1 : 0);
                    total += 2;
                    actions += r1.actions + r2.actions;
                }
            }
            rates.push({ combo: pa.join('+'), rate: wins / total, actions: actions / total });
        }
        rates.sort((x, y) => y.rate - x.rate);
        const fmt = (r: (typeof rates)[number]) => `${(r.rate * 100).toFixed(1).padStart(5)}%  ${r.actions.toFixed(1).padStart(4)}  ${r.combo}`;
        const NL = String.fromCharCode(10);
        console.log(['Top 12:', ...rates.slice(0, 12).map(fmt), 'Bottom 6:', ...rates.slice(-6).map(fmt)].join(NL));
        // Per-part average win rate, to spot a single overtuned part.
        const byPart = new Map<string, number[]>();
        for (const r of rates) for (const id of r.combo.split('+')) byPart.set(id, [...(byPart.get(id) ?? []), r.rate]);
        const partAvg = [...byPart].map(([id, v]) => [id, v.reduce((x, y) => x + y, 0) / v.length] as const).sort((x, y) => y[1] - x[1]);
        console.log(['Parts:', ...partAvg.map(([id, v]) => `${(v * 100).toFixed(1).padStart(5)}%  ${id}`)].join(NL));
        expect(rates[0].rate).toBeLessThanOrEqual(0.7);
    }, 60_000);
});

describe('parts table', () => {
    it('keeps PARTS indices stable (append-only)', () => {
        expect(PARTS.slice(0, 9).map((p) => p.id)).toEqual([
            'fang_head', 'fang_body', 'fang_legs', 'goo_head', 'goo_body', 'goo_legs', 'eye_head', 'eye_body', 'eye_legs',
        ]);
    });
});

describe('names', () => {
    it('builds names and sanitizes input', () => {
        expect(autoName(['fang_head', 'eye_body', 'goo_legs'])).toBe('Fangslurp the Unblinking');
        expect(sanitizeName('  Mr   Eyes!!  ')).toBe('Mr Eyes');
        expect(sanitizeName('a'.repeat(40))?.length).toBe(16);
        expect(sanitizeName('   ')).toBeNull();
    });
});
