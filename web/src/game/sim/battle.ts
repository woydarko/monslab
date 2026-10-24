/**
 * Deterministic 1v1 auto-battle (GDD §3.4). simulate() runs the WHOLE fight
 * up front and returns an event list; the 3D scene only replays it. Same
 * inputs + seed → identical events on every device.
 *
 * Pure: no Three, React, SDK, Date.now() or Math.random() in here.
 */
import { mulberry32 } from './rng.ts';
import type { Monster } from './monster.ts';
import type { AttackStyle } from '../data/types.ts';
import { clashMult, clashScore } from './clash.ts';

export type Side = 0 | 1;

export interface AttackEvent {
    type: 'attack';
    actor: Side;
    target: Side;
    /** Head-driven animation style (bite, spit, laser, claw, headbutt, spore, wail). */
    style: AttackStyle;
    /** Every 4th own action is the head's special move (bigger hit, bigger show). */
    special: boolean;
    /** Name of the special move, when special. */
    specialName: string;
    /** Second strike from Frenzy (no wind-up, quick follow). */
    followUp: boolean;
    /** 0 when dodged or blocked */
    damage: number;
    crit: boolean;
    dodged: boolean;
    /** Cap trait ate the hit. */
    blocked: boolean;
    /** HP of the target after the hit */
    targetHp: number;
    /** Lifesteal healed onto the actor (bite) */
    heal: number;
    actorHp: number;
    /** Target got slowed by this hit (spit) */
    slowed: boolean;
    /** Chimera / Rooted shrugged off the slow */
    resisted: boolean;
    /** Rattle stunned the target (it loses its next action). */
    stunned: boolean;
    /** Spores poisoned the target. */
    poisoned: boolean;
    /** Haunt lowered the target's ATK (current stack count, 0 = none applied). */
    haunt: number;
    /** Element clash score used for this strike (−4..4; damage × 1 + 0.25 × score). */
    clash: number;
}

export type BattleEvent =
    | AttackEvent
    | { type: 'regen'; actor: Side; heal: number; actorHp: number }
    | { type: 'poison'; target: Side; damage: number; targetHp: number }
    | { type: 'stunSkip'; actor: Side }
    | { type: 'revive'; actor: Side; hp: number }
    | { type: 'ko'; loser: Side }
    | { type: 'end'; winner: Side; reason: 'ko' | 'timeout' };

export interface BattleResult {
    events: BattleEvent[];
    winner: Side;
    actions: number;
    maxHp: [number, number];
    /** Total damage each side dealt (hits plus poison ticks). The daily boss score. */
    damage: [number, number];
}

const METER_FULL = 100;
const MAX_ACTIONS = 36;
const MAX_TICKS = 6000;
const CRIT_MULT = 1.8;
const SLOW_MULT = 0.7;
const SKITTER_MULT = 1.2;
/** Added to every fighter's SPD so speed gaps matter less than raw numbers suggest. */
const SPEED_BASE = 12;
/** Ooze regen per own action, as a fraction of max HP. */
const OOZE_REGEN = 0.04;
/** Bite lifesteal as a fraction of damage dealt. */
const BITE_LIFESTEAL = 0.15;
/** Every Nth own action is a special move. */
const SPECIAL_EVERY = 4;
const SPECIAL_MULT = 1.6;
/** Bat Feet head start (a full meter would be a free extra turn). */
const BAT_FEET_METER = 70;
const POUNCE_MULT = 1.6;
const FRENZY_CHANCE = 0.2;
/** Frenzy's second strike hits softer. */
const FRENZY_MULT = 0.6;
const HUNTER_MULT = 1.2;
const RATTLE_CHANCE = 0.1;
/** A Skull Bash (special) stuns more often but not always. */
const RATTLE_SPECIAL_CHANCE = 0.4;
const ARMOR = 3;
const REASSEMBLE_HP = 0.2;
const POISON_DAMAGE = 4;
const POISON_ACTIONS = 3;
const HAUNT_STEP = 0.07;
const HAUNT_MAX = 3;

interface Fighter {
    m: Monster;
    hp: number;
    meter: number;
    slowed: boolean;
    resistedSlow: boolean;
    ownActions: number;
    stunned: boolean;
    poison: number;
    capUsed: boolean;
    reassembled: boolean;
    haunt: number;
}

function has(f: Fighter, t: Monster['traits'][number]): boolean {
    return f.m.traits.includes(t);
}

function effectiveSpd(f: Fighter): number {
    let spd = f.m.stats.spd + SPEED_BASE;
    if (has(f, 'skitter') && f.hp < f.m.stats.hp * 0.5) spd *= SKITTER_MULT;
    if (f.slowed) spd *= SLOW_MULT;
    return Math.max(1, spd);
}

/** Damage `side` dealt: its attack hits plus poison ticking on the other side. */
export function totalDamage(events: BattleEvent[], side: Side): number {
    let d = 0;
    for (const e of events) {
        if (e.type === 'attack' && e.actor === side) d += e.damage;
        else if (e.type === 'poison' && e.target !== side) d += e.damage;
    }
    return d;
}

export function simulate(a: Monster, b: Monster, seed: number): BattleResult {
    const rng = mulberry32(seed);
    const mk = (m: Monster): Fighter => ({
        m, hp: m.stats.hp, meter: 0, slowed: false, resistedSlow: false, ownActions: 0,
        stunned: false, poison: 0, capUsed: false, reassembled: false, haunt: 0,
    });
    const f: [Fighter, Fighter] = [mk(a), mk(b)];
    // Bat Feet: head start on the action meter.
    for (const x of f) if (has(x, 'batFeet')) x.meter = BAT_FEET_METER;

    const events: BattleEvent[] = [];
    let actions = 0;
    let winner: Side | null = null;

    /** Applies a KO check with Reassemble. Returns true when the fighter is really down. */
    const checkKo = (side: Side): boolean => {
        const x = f[side];
        if (x.hp > 0) return false;
        if (has(x, 'reassemble') && !x.reassembled) {
            x.reassembled = true;
            x.hp = Math.max(1, Math.round(x.m.stats.hp * REASSEMBLE_HP));
            events.push({ type: 'revive', actor: side, hp: x.hp });
            return false;
        }
        events.push({ type: 'ko', loser: side });
        winner = side === 0 ? 1 : 0;
        return true;
    };

    /** One strike from actor to target. */
    const strike = (actor: Side, followUp: boolean): void => {
        const target: Side = actor === 0 ? 1 : 0;
        const att = f[actor];
        const def = f[target];
        const special = !followUp && att.ownActions % SPECIAL_EVERY === 0;
        const clash = clashScore(special ? att.m.spEl : att.m.atkEl, def.m.defEl);

        const dodged = rng() < def.m.dodgeChance;
        const roll = 0.9 + rng() * 0.2;
        const crit = !dodged && rng() < att.m.critChance;
        const blocked = !dodged && has(def, 'cap') && !def.capUsed;
        if (blocked) def.capUsed = true;

        let damage = 0;
        let heal = 0;
        let slowed = false;
        let resisted = false;
        let stunned = false;
        let poisoned = false;
        let haunt = 0;
        if (!dodged && !blocked) {
            let dmg = att.m.stats.atk * roll * (1 - att.haunt * HAUNT_STEP);
            if (crit) dmg *= CRIT_MULT;
            if (special) dmg *= SPECIAL_MULT;
            if (followUp) dmg *= FRENZY_MULT;
            dmg *= clashMult(clash);
            if (has(att, 'pounce') && att.ownActions === 1 && !followUp) dmg *= POUNCE_MULT;
            if (has(att, 'hunter') && def.hp < def.m.stats.hp * 0.5) dmg *= HUNTER_MULT;
            if (has(def, 'squish')) dmg *= 0.85;
            if (has(def, 'rooted')) dmg *= 0.9;
            if (has(def, 'armor')) dmg -= ARMOR;
            damage = Math.max(1, Math.round(dmg));
            def.hp = Math.max(0, def.hp - damage);
            if (has(att, 'bite')) {
                heal = Math.min(att.m.stats.hp - att.hp, Math.round(damage * BITE_LIFESTEAL * (special ? 2 : 1)));
                att.hp += heal;
            }
            if (def.hp > 0) {
                if (has(att, 'spit')) {
                    if (has(def, 'rooted') || (has(def, 'chimera') && !def.resistedSlow)) {
                        if (!has(def, 'rooted')) def.resistedSlow = true;
                        resisted = true;
                    } else {
                        def.slowed = true;
                        slowed = true;
                    }
                }
                if (has(att, 'rattle') && rng() < (special ? RATTLE_SPECIAL_CHANCE : RATTLE_CHANCE)) {
                    def.stunned = true;
                    stunned = true;
                }
                if (has(att, 'spores')) {
                    def.poison = POISON_ACTIONS + (special ? 2 : 0);
                    poisoned = true;
                }
                if (has(att, 'haunt') && def.haunt < HAUNT_MAX) {
                    def.haunt += special ? Math.min(2, HAUNT_MAX - def.haunt) : 1;
                    haunt = def.haunt;
                }
            }
        }
        events.push({
            type: 'attack', actor, target, style: att.m.style, special, specialName: special ? att.m.special : '',
            followUp, damage, crit, dodged, blocked, targetHp: def.hp, heal, actorHp: att.hp,
            slowed, resisted, stunned, poisoned, haunt, clash,
        });
    };

    for (let tick = 0; tick < MAX_TICKS && winner === null && actions < MAX_ACTIONS; tick++) {
        // Fill meters only when nobody is ready, so first-strike meters fire before any fill.
        if (f[0].meter < METER_FULL && f[1].meter < METER_FULL) {
            f[0].meter += effectiveSpd(f[0]) / 10;
            f[1].meter += effectiveSpd(f[1]) / 10;
        }
        // Whoever has more meter acts; ties go to the higher base SPD, then side 0.
        const ready = ([0, 1] as Side[]).filter((s) => f[s].meter >= METER_FULL);
        if (ready.length === 0) continue;
        ready.sort((x, y) => f[y].meter - f[x].meter || f[y].m.stats.spd - f[x].m.stats.spd || x - y);
        const actor = ready[0];
        const att = f[actor];
        att.meter -= METER_FULL;
        att.slowed = false; // a slow lasts until the slowed fighter's next action
        actions++;

        // Poison ticks at the start of the poisoned fighter's own action.
        if (att.poison > 0) {
            att.poison--;
            const dmg = Math.min(att.hp, POISON_DAMAGE);
            att.hp -= dmg;
            events.push({ type: 'poison', target: actor, damage: dmg, targetHp: att.hp });
            if (checkKo(actor)) break;
        }

        // Stunned: lose this action.
        if (att.stunned) {
            att.stunned = false;
            events.push({ type: 'stunSkip', actor });
            continue;
        }

        att.ownActions++;
        strike(actor, false);
        const target: Side = actor === 0 ? 1 : 0;
        if (checkKo(target)) break;

        // Frenzy: quick second strike.
        if (has(att, 'frenzy') && rng() < FRENZY_CHANCE) {
            strike(actor, true);
            if (checkKo(target)) break;
        }

        if (has(att, 'ooze') && att.hp < att.m.stats.hp) {
            const regen = Math.min(att.m.stats.hp - att.hp, Math.max(1, Math.round(att.m.stats.hp * OOZE_REGEN)));
            att.hp += regen;
            events.push({ type: 'regen', actor, heal: regen, actorHp: att.hp });
        }
    }

    let reason: 'ko' | 'timeout' = 'ko';
    if (winner === null) {
        // Tie-break: higher remaining HP fraction wins; exact tie → side 1 (defender).
        reason = 'timeout';
        const fa = f[0].hp / f[0].m.stats.hp;
        const fb = f[1].hp / f[1].m.stats.hp;
        winner = fa > fb ? 0 : 1;
    }
    events.push({ type: 'end', winner, reason });

    return { events, winner, actions, maxHp: [a.stats.hp, b.stats.hp], damage: [totalDamage(events, 0), totalDamage(events, 1)] };
}
