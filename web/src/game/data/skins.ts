/**
 * Cosmetic skins (PLAN-v0.3 B2): a tint over the whole monster. They change
 * nothing in battle. The index travels in challenge codes (3 bits, so at most
 * 8 skins): this list is APPEND-ONLY, never reorder.
 */
export type SkinSource =
    | { kind: 'free' }
    | { kind: 'daily'; day: number }
    | { kind: 'arena'; tier: number }
    | { kind: 'shop'; bundleId: string; costRB: number }
    | { kind: 'starterKit' };

export interface SkinDef {
    id: number;
    name: string;
    /** Multiplied into every part's color. */
    tint: number;
    source: SkinSource;
}

export const SKINS: SkinDef[] = [
    { id: 0, name: 'Natural', tint: 0xffffff, source: { kind: 'free' } },
    { id: 1, name: 'Frost', tint: 0x9cf7ff, source: { kind: 'daily', day: 5 } },
    { id: 2, name: 'Pumpkin', tint: 0xffb060, source: { kind: 'arena', tier: 10 } },
    { id: 3, name: 'Lilac', tint: 0xd0c0ff, source: { kind: 'shop', bundleId: 'skin_lilac', costRB: 150 } },
    { id: 4, name: 'Gold', tint: 0xffe08a, source: { kind: 'shop', bundleId: 'skin_gold', costRB: 300 } },
    { id: 5, name: 'Toxic', tint: 0xb4ff70, source: { kind: 'shop', bundleId: 'skin_toxic', costRB: 150 } },
    { id: 6, name: 'Midnight', tint: 0x8a90ff, source: { kind: 'shop', bundleId: 'skin_midnight', costRB: 200 } },
    { id: 7, name: 'Blood Moon', tint: 0xff7a7a, source: { kind: 'starterKit' } },
];

export function skinTint(id: number): number {
    return SKINS[id]?.tint ?? 0xffffff;
}

/** How to get a skin, for the locked tile. */
export function skinHowTo(def: SkinDef): string {
    switch (def.source.kind) {
        case 'free':
            return 'Free';
        case 'daily':
            return `Daily gift, day ${def.source.day}`;
        case 'arena':
            return `Clear Arena tier ${def.source.tier}`;
        case 'shop':
            return `${def.source.costRB} Bits`;
        case 'starterKit':
            return 'Starter Kit only';
    }
}
