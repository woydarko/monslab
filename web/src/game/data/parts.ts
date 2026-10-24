/**
 * All 21 parts: 7 families × head/body/legs (GDD §3.3). This table is the single source of
 * truth for stats, tune balance here and re-run `npm test`.
 * ORDER MATTERS: challenge codes store indices into PARTS, so only ever
 * append new parts to the end.
 */
import type { PartDef, SlotId, TraitId } from './types.ts';

export const PARTS: PartDef[] = [
    {
        id: 'fang_head', slot: 'head', family: 'fang', rarity: 'common', name: 'Vampire Skull',
        stats: { hp: 10, atk: 13, spd: 4 }, traits: ['bite'], eyes: 2,
        nameSyllable: 'Fang', title: 'Thirsty', builder: 'fangHead',
        attack: { style: 'bite', special: 'Vampire Bite' },
    },
    {
        id: 'fang_body', slot: 'body', family: 'fang', rarity: 'common', name: 'Count Cape',
        stats: { hp: 46, atk: 7, spd: 4 }, traits: ['cape'], eyes: 0,
        nameSyllable: 'Drac', title: 'Dramatic', builder: 'fangBody',
    },
    {
        id: 'fang_legs', slot: 'legs', family: 'fang', rarity: 'rare', name: 'Bat Feet',
        stats: { hp: 12, atk: 5, spd: 7 }, traits: ['batFeet'], eyes: 0,
        nameSyllable: 'bat', title: 'Nocturnal', builder: 'fangLegs',
    },
    {
        id: 'goo_head', slot: 'head', family: 'goo', rarity: 'common', name: 'Drool Blob',
        stats: { hp: 22, atk: 11, spd: 3 }, traits: ['spit'], eyes: 1,
        nameSyllable: 'Gloop', title: 'Drippy', builder: 'gooHead',
        attack: { style: 'spit', special: 'Goo Cannon' },
    },
    {
        id: 'goo_body', slot: 'body', family: 'goo', rarity: 'common', name: 'Swamp Belly',
        stats: { hp: 64, atk: 4, spd: 2 }, traits: ['squish'], eyes: 0,
        nameSyllable: 'Slosh', title: 'Squishy', builder: 'gooBody',
    },
    {
        id: 'goo_legs', slot: 'legs', family: 'goo', rarity: 'common', name: 'Ooze Puddle',
        stats: { hp: 26, atk: 4, spd: 7 }, traits: ['ooze'], eyes: 0,
        nameSyllable: 'slurp', title: 'Sticky', builder: 'gooLegs',
    },
    {
        id: 'eye_head', slot: 'head', family: 'eye', rarity: 'rare', name: 'Peeper Dome',
        stats: { hp: 8, atk: 12, spd: 5 }, traits: ['stare'], eyes: 5,
        nameSyllable: 'Peep', title: 'Staring', builder: 'eyeHead',
        attack: { style: 'laser', special: 'Death Stare' },
    },
    {
        id: 'eye_body', slot: 'body', family: 'eye', rarity: 'epic', name: 'Watcher Mass',
        stats: { hp: 28, atk: 6, spd: 5 }, traits: ['watcher'], eyes: 7,
        nameSyllable: 'Ogle', title: 'Unblinking', builder: 'eyeBody',
    },
    {
        id: 'eye_legs', slot: 'legs', family: 'eye', rarity: 'common', name: 'Skitter Legs',
        stats: { hp: 12, atk: 4, spd: 11 }, traits: ['skitter'], eyes: 3,
        nameSyllable: 'skit', title: 'Twitchy', builder: 'eyeLegs',
    },
    // ── CLAW: werewolf. Fast, hits twice, punishes weak targets. ──
    {
        id: 'claw_head', slot: 'head', family: 'claw', rarity: 'common', name: 'Wolf Snout',
        stats: { hp: 12, atk: 12, spd: 5 }, traits: ['pounce'], eyes: 2,
        nameSyllable: 'Howl', title: 'Feral', builder: 'clawHead',
        attack: { style: 'claw', special: 'Rend' },
    },
    {
        id: 'claw_body', slot: 'body', family: 'claw', rarity: 'common', name: 'Shaggy Torso',
        stats: { hp: 42, atk: 7, spd: 5 }, traits: ['frenzy'], eyes: 0,
        nameSyllable: 'Shag', title: 'Shaggy', builder: 'clawBody',
    },
    {
        id: 'claw_legs', slot: 'legs', family: 'claw', rarity: 'rare', name: 'Hind Paws',
        stats: { hp: 12, atk: 6, spd: 10 }, traits: ['hunter'], eyes: 0,
        nameSyllable: 'paw', title: 'Prowling', builder: 'clawLegs',
    },
    // ── BONE: skeleton. Armored, stuns, comes back once. ──
    {
        id: 'bone_head', slot: 'head', family: 'bone', rarity: 'common', name: 'Grin Skull',
        stats: { hp: 18, atk: 12, spd: 3 }, traits: ['rattle'], eyes: 0,
        nameSyllable: 'Rattle', title: 'Grinning', builder: 'boneHead',
        attack: { style: 'headbutt', special: 'Skull Bash' },
    },
    {
        id: 'bone_body', slot: 'body', family: 'bone', rarity: 'common', name: 'Rib Cage',
        stats: { hp: 52, atk: 5, spd: 3 }, traits: ['armor'], eyes: 0,
        nameSyllable: 'Rib', title: 'Hollow', builder: 'boneBody',
    },
    {
        id: 'bone_legs', slot: 'legs', family: 'bone', rarity: 'epic', name: 'Femur Stilts',
        stats: { hp: 16, atk: 4, spd: 6 }, traits: ['reassemble'], eyes: 0,
        nameSyllable: 'bones', title: 'Restless', builder: 'boneLegs',
    },
    // ── SHROOM: fungus. Poison over time, blocks the first hit. ──
    {
        id: 'shroom_head', slot: 'head', family: 'shroom', rarity: 'rare', name: 'Toadstool Cap',
        stats: { hp: 20, atk: 10, spd: 4 }, traits: ['spores'], eyes: 1,
        nameSyllable: 'Spor', title: 'Spotty', builder: 'shroomHead',
        attack: { style: 'spore', special: 'Spore Burst' },
    },
    {
        id: 'shroom_body', slot: 'body', family: 'shroom', rarity: 'common', name: 'Mycel Trunk',
        stats: { hp: 50, atk: 5, spd: 3 }, traits: ['cap'], eyes: 0,
        nameSyllable: 'Myco', title: 'Moldy', builder: 'shroomBody',
    },
    {
        id: 'shroom_legs', slot: 'legs', family: 'shroom', rarity: 'common', name: 'Root Feet',
        stats: { hp: 32, atk: 5, spd: 5 }, traits: ['rooted'], eyes: 0,
        nameSyllable: 'root', title: 'Rooted', builder: 'shroomLegs',
    },
    // ── GHOST: spirit. Hard to hit, saps the enemy's strength. ──
    {
        id: 'ghost_head', slot: 'head', family: 'ghost', rarity: 'rare', name: 'Wailing Wisp',
        stats: { hp: 8, atk: 12, spd: 5 }, traits: ['haunt'], eyes: 2,
        nameSyllable: 'Boo', title: 'Wailing', builder: 'ghostHead',
        attack: { style: 'wail', special: 'Banshee Wail' },
    },
    {
        id: 'ghost_body', slot: 'body', family: 'ghost', rarity: 'epic', name: 'Sheet Shroud',
        stats: { hp: 28, atk: 7, spd: 6 }, traits: ['phase'], eyes: 0,
        nameSyllable: 'Shroud', title: 'Spectral', builder: 'ghostBody',
    },
    {
        id: 'ghost_legs', slot: 'legs', family: 'ghost', rarity: 'common', name: 'Ecto Trail',
        stats: { hp: 8, atk: 5, spd: 10 }, traits: ['float'], eyes: 0,
        nameSyllable: 'wisp', title: 'Drifting', builder: 'ghostLegs',
    },
];

const BY_ID = new Map(PARTS.map((p) => [p.id, p]));

export function getPart(id: string): PartDef {
    const p = BY_ID.get(id);
    if (!p) throw new Error(`Unknown part ${id}`);
    return p;
}

export function hasPart(id: string): boolean {
    return BY_ID.has(id);
}

export function partsForSlot(slot: SlotId): PartDef[] {
    return PARTS.filter((p) => p.slot === slot);
}

export const TRAIT_INFO: Record<TraitId, { name: string; text: string }> = {
    bite: { name: 'Bite', text: 'Heals 15% of damage dealt' },
    cape: { name: 'Cape', text: '10% chance to dodge' },
    batFeet: { name: 'Bat Feet', text: 'Starts with its action meter 70% full' },
    spit: { name: 'Spit', text: 'Hits slow the enemy’s next action by 30%' },
    squish: { name: 'Squish', text: 'Takes 15% less damage' },
    ooze: { name: 'Ooze', text: 'Heals 4% of max HP every action' },
    stare: { name: 'Stare', text: '+10% crit chance' },
    watcher: { name: 'Watcher', text: '15% chance to dodge' },
    skitter: { name: 'Skitter', text: '+20% SPD below half HP' },
    pounce: { name: 'Pounce', text: 'First attack deals 60% more damage' },
    frenzy: { name: 'Frenzy', text: '20% chance to strike again at 60% damage' },
    hunter: { name: 'Hunter', text: '20% more damage to enemies below half HP' },
    rattle: { name: 'Rattle', text: 'Hits have a 10% chance to stun (enemy skips a turn)' },
    armor: { name: 'Armor', text: 'Takes 3 less damage per hit' },
    reassemble: { name: 'Reassemble', text: 'Once per fight, survives a KO with 20% HP' },
    spores: { name: 'Spores', text: 'Hits poison: 4 damage per enemy action, 3 times' },
    cap: { name: 'Cap', text: 'Blocks the first hit completely' },
    rooted: { name: 'Rooted', text: 'Can’t be slowed, takes 10% less damage' },
    haunt: { name: 'Haunt', text: 'Hits lower the enemy’s ATK by 7%, up to 3 times' },
    phase: { name: 'Phase', text: '20% chance to dodge' },
    float: { name: 'Float', text: '10% chance to dodge' },
    chimera: { name: 'Chimera', text: 'Ignores the first slow' },
};

/** Default monster every new player starts with (FTUE step 0, GDD §9). */
export const STARTER_PARTS: [string, string, string] = ['goo_head', 'goo_body', 'goo_legs'];
/** Extra part granted on a fresh save so the tray isn't a single option. */
export const STARTER_BONUS_PART = 'fang_head';
