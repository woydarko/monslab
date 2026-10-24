/**
 * Arena ladder (GDD §4.4). Tier 0 is the FTUE dummy the player can't lose to.
 * statMult scales the opponent after buildMonster.
 */
import type { MonsterParts } from './types.ts';

export interface ArenaTier {
    tier: number;
    name: string;
    parts: MonsterParts;
    statMult: number;
}

export const ARENA: ArenaTier[] = [
    // FTUE dummy: a different family on purpose, so the first fight teases parts you can win.
    { tier: 0, name: 'Lab Rat', parts: ['eye_head', 'fang_body', 'eye_legs'], statMult: 0.45 },
    // Multipliers fitted by `pnpm fit:arena` after the element rebalance: the median of the top 50 of all 343 builds
    // wins about 97% at tier 1, falling to about 37% at tier 10. Re-fit after part changes.
    { tier: 1, name: 'Sludgeling', parts: ['goo_head', 'shroom_body', 'goo_legs'], statMult: 0.97 },
    { tier: 2, name: 'Mangy Mutt', parts: ['claw_head', 'claw_body', 'fang_legs'], statMult: 0.89 },
    { tier: 3, name: 'Rattlebones', parts: ['bone_head', 'bone_body', 'eye_legs'], statMult: 0.93 },
    { tier: 4, name: 'The Gawker', parts: ['eye_head', 'eye_body', 'ghost_legs'], statMult: 1.04 },
    { tier: 5, name: 'Mother Muck', parts: ['ghost_head', 'fang_body', 'shroom_legs'], statMult: 1.00 },
    { tier: 6, name: 'Hex Hound', parts: ['claw_head', 'fang_body', 'claw_legs'], statMult: 1.13 },
    { tier: 7, name: 'Bone Collector', parts: ['bone_head', 'bone_body', 'bone_legs'], statMult: 0.98 },
    { tier: 8, name: 'Spore Mother', parts: ['shroom_head', 'shroom_body', 'shroom_legs'], statMult: 1.01 },
    { tier: 9, name: 'The Banshee', parts: ['ghost_head', 'ghost_body', 'eye_legs'], statMult: 1.11 },
    { tier: 10, name: 'Count Monsula', parts: ['fang_head', 'eye_body', 'bone_legs'], statMult: 1.03 },
];

export const MAX_SLICE_TIER = 10;
