import type { FamilyId, Rarity } from './types.ts';

export const FAMILIES: Record<FamilyId, { name: string; color: string; primary: 'hp' | 'atk' | 'spd' }> = {
    fang: { name: 'Fang', color: '#E63946', primary: 'atk' },
    goo: { name: 'Goo', color: '#7BD389', primary: 'hp' },
    eye: { name: 'Eye', color: '#9B5DE5', primary: 'spd' },
    claw: { name: 'Claw', color: '#F4A261', primary: 'spd' },
    bone: { name: 'Bone', color: '#D9D2B6', primary: 'hp' },
    shroom: { name: 'Shroom', color: '#F15BB5', primary: 'hp' },
    ghost: { name: 'Ghost', color: '#9FFFE0', primary: 'atk' },
};

export const RARITY_COLOR: Record<Rarity, string> = {
    common: '#A0A0B0',
    rare: '#4CC9F0',
    epic: '#FFC300',
};

/** Set Bonus: 3 parts of one family → +15% on that family's primary stat. */
export const SET_BONUS = 0.15;
/** Mix Bonus: 3 different families → +5% all stats and the Chimera trait (tuned by the balance test). */
export const MIX_BONUS = 0.05;
