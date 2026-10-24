/**
 * Combine 3 parts into effective battle stats (GDD §3.1–3.3). Pure.
 */
import { getPart, PARTS } from '../data/parts.ts';
import { FAMILIES, MIX_BONUS, SET_BONUS } from '../data/families.ts';
import type { AttackStyle, FamilyId, MonsterParts, SlotId, Stats, TraitId } from '../data/types.ts';

/** Every monster gets this on top of its parts so fragile builds stay viable. */
const BASE: Stats = { hp: 20, atk: 0, spd: 0 };
/** Crit per eye and cap (GDD: "3% × total eyes, max 45%"). */
export const CRIT_PER_EYE = 0.03;
export const CRIT_CAP = 0.45;

export type Bonus = { kind: 'set'; family: FamilyId } | { kind: 'mix' } | null;

export interface Monster {
    parts: MonsterParts;
    stats: Stats;
    eyes: number;
    critChance: number;
    dodgeChance: number;
    traits: TraitId[];
    bonus: Bonus;
    /** From the HEAD: how this monster attacks and what its special is called. */
    style: AttackStyle;
    special: string;
}

export function buildMonster(parts: MonsterParts): Monster {
    const defs = parts.map(getPart);
    if (defs[0].slot !== 'head' || defs[1].slot !== 'body' || defs[2].slot !== 'legs') {
        throw new Error(`Bad part order ${parts.join(',')}`);
    }

    const stats: Stats = { ...BASE };
    let eyes = 0;
    const traits: TraitId[] = [];
    for (const d of defs) {
        stats.hp += d.stats.hp;
        stats.atk += d.stats.atk;
        stats.spd += d.stats.spd;
        eyes += d.eyes;
        traits.push(...d.traits);
    }

    const families = new Set(defs.map((d) => d.family));
    let bonus: Bonus = null;
    if (families.size === 1) {
        const family = defs[0].family;
        bonus = { kind: 'set', family };
        const key = FAMILIES[family].primary;
        stats[key] *= 1 + SET_BONUS;
    } else if (families.size === 3) {
        bonus = { kind: 'mix' };
        stats.hp *= 1 + MIX_BONUS;
        stats.atk *= 1 + MIX_BONUS;
        stats.spd *= 1 + MIX_BONUS;
        traits.push('chimera');
    }

    stats.hp = Math.round(stats.hp);
    stats.atk = Math.round(stats.atk);
    stats.spd = Math.round(stats.spd);

    let critChance = Math.min(CRIT_CAP, eyes * CRIT_PER_EYE);
    if (traits.includes('stare')) critChance = Math.min(CRIT_CAP + 0.1, critChance + 0.1);

    let dodgeChance = 0;
    if (traits.includes('cape')) dodgeChance += 0.1;
    if (traits.includes('watcher')) dodgeChance += 0.15;
    if (traits.includes('phase')) dodgeChance += 0.2;
    if (traits.includes('float')) dodgeChance += 0.1;

    const attack = defs[0].attack ?? { style: 'bite' as const, special: 'Big Hit' };
    return { parts, stats, eyes, critChance, dodgeChance, traits, bonus, style: attack.style, special: attack.special };
}

/** Scale HP/ATK/SPD for AI opponents (arena tiers). */
export function scaleMonster(m: Monster, mult: number): Monster {
    return {
        ...m,
        stats: {
            hp: Math.max(1, Math.round(m.stats.hp * mult)),
            atk: Math.max(1, Math.round(m.stats.atk * mult)),
            spd: Math.max(1, Math.round(m.stats.spd * mult)),
        },
    };
}

let statMax: Stats | null = null;
/** Highest HP/ATK/SPD any build can reach: the full length of the Lab's stat bars. */
export function maxStats(): Stats {
    if (statMax) return statMax;
    const by = (slot: SlotId) => PARTS.filter((p) => p.slot === slot).map((p) => p.id);
    const max: Stats = { hp: 1, atk: 1, spd: 1 };
    for (const h of by('head'))
        for (const b of by('body'))
            for (const l of by('legs')) {
                const s = buildMonster([h, b, l]).stats;
                max.hp = Math.max(max.hp, s.hp);
                max.atk = Math.max(max.atk, s.atk);
                max.spd = Math.max(max.spd, s.spd);
            }
    return (statMax = max);
}
