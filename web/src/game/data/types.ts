/** Shared data types for parts, families and monsters (GDD §3). */

export type SlotId = 'head' | 'body' | 'legs';
export type FamilyId = 'fang' | 'goo' | 'eye' | 'claw' | 'bone' | 'shroom' | 'ghost';
export type Rarity = 'common' | 'rare' | 'epic';

/**
 * How a monster attacks, decided by its HEAD (GDD §3.4). Melee styles lunge,
 * ranged styles fire a projectile; each has its own special move.
 */
export type AttackStyle = 'bite' | 'spit' | 'laser' | 'claw' | 'headbutt' | 'spore' | 'wail';

export type TraitId =
    | 'bite' // 15% of damage dealt heals the attacker
    | 'cape' // 10% dodge
    | 'batFeet' // starts with 70% of an action meter
    | 'spit' // hits slow the target's next action (-30% SPD)
    | 'squish' // -15% damage taken
    | 'ooze' // regen 4% max HP on each own action
    | 'stare' // +10% crit chance
    | 'watcher' // 15% dodge
    | 'skitter' // +20% SPD while below 50% HP
    | 'pounce' // first attack deals +60% damage
    | 'frenzy' // 20% chance to strike twice
    | 'hunter' // +20% damage against targets below 50% HP
    | 'rattle' // hits have a 10% chance to stun (40% on a special) (target loses its next action)
    | 'armor' // takes 3 less damage from every hit
    | 'reassemble' // once per battle, survives a KO at 20% HP
    | 'spores' // hits poison: 4 damage per target action, 3 actions
    | 'cap' // blocks the first hit completely
    | 'rooted' // immune to slow, takes 10% less damage
    | 'haunt' // hits lower the target's ATK by 7% (max 3 stacks)
    | 'phase' // 20% dodge
    | 'float' // 10% dodge
    | 'chimera'; // Mix Bonus: immune to the first slow

export interface Stats {
    hp: number;
    atk: number;
    spd: number;
}

export interface PartDef {
    id: string;
    slot: SlotId;
    family: FamilyId;
    rarity: Rarity;
    name: string;
    stats: Stats;
    traits: TraitId[];
    /** Eyes this part contributes (crit = 3% per eye, GDD §3.3). */
    eyes: number;
    /** Name generator syllable. */
    nameSyllable: string;
    /** Title used when this part is the body ("the Unblinking"). */
    title: string;
    /** Procedural 3D builder key (src/game/render/parts). */
    builder: string;
    /** HEAD only: attack style and its special move name. */
    attack?: { style: AttackStyle; special: string };
}

export type MonsterParts = [head: string, body: string, legs: string];
