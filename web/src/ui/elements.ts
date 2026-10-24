/**
 * Element presentation (F-16) for the UI layer: names, shape icons and the
 * colour tokens from app.css. The sim keeps the rules (`beats`, `clashScore`);
 * this module only knows how an element looks and how to read a part's two
 * elements off the game data.
 */
import { PARTS } from '../game/data/parts.ts';

export type ElementId = 'water' | 'stone' | 'fire' | 'wind' | 'nature' | 'volt';

/** Cycle order: each element beats the next two and loses to the previous two. */
export const ELEMENT_ORDER: readonly ElementId[] = ['water', 'stone', 'fire', 'wind', 'nature', 'volt'];

export const ELEMENT_NAMES: Record<ElementId, string> = {
    water: 'Water',
    stone: 'Stone',
    fire: 'Fire',
    wind: 'Wind',
    nature: 'Nature',
    volt: 'Volt',
};

/** Design tokens only: the element colours live in app.css. */
export const ELEMENT_COLOR: Record<ElementId, string> = {
    water: 'var(--color-water)',
    stone: 'var(--color-stone)',
    fire: 'var(--color-fire)',
    wind: 'var(--color-wind)',
    nature: 'var(--color-nature)',
    volt: 'var(--color-volt)',
};

/**
 * One distinct 24 px shape per element so the chips stay readable without
 * colour: droplet, hexagon, flame, swirl, leaf, bolt.
 */
export const ELEMENT_SHAPE: Record<ElementId, string> = {
    water: 'M12 3c4 5 6 7.5 6 10a6 6 0 0 1-12 0c0-2.5 2-5 6-10z',
    stone: 'M12 2.5l8 4.5v9l-8 5-8-5V7z',
    fire: 'M12 2c4 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3 2-5.5 3-7 1 2 2 3 3 3V2z',
    wind: 'M3 8.5h11a3 3 0 1 0-3-3M3 15.5h13a3 3 0 1 1-3 3',
    nature: 'M20 4C10.5 4 4 9 4 16c0 2 .8 4 .8 4S7 19 9 19c7.5 0 11-6 11-15z',
    volt: 'M13.5 2L5 14h5l-1.5 8L18 10h-5z',
};

/**
 * `PartDef.elements` arrives with the element system (game/data/parts.ts).
 * Until that lands on this branch the same table ships here so the Lab can
 * show real chips; once the field exists it wins and this map can be dropped.
 */
const PART_ELEMENTS: Record<string, [ElementId, ElementId]> = {
    fang_head: ['wind', 'fire'],
    fang_body: ['wind', 'nature'],
    fang_legs: ['wind', 'fire'],
    goo_head: ['water', 'volt'],
    goo_body: ['water', 'nature'],
    goo_legs: ['water', 'stone'],
    eye_head: ['volt', 'stone'],
    eye_body: ['volt', 'stone'],
    eye_legs: ['volt', 'wind'],
    claw_head: ['fire', 'nature'],
    claw_body: ['fire', 'wind'],
    claw_legs: ['fire', 'stone'],
    bone_head: ['stone', 'wind'],
    bone_body: ['stone', 'volt'],
    bone_legs: ['stone', 'volt'],
    shroom_head: ['nature', 'water'],
    shroom_body: ['nature', 'volt'],
    shroom_legs: ['nature', 'wind'],
    ghost_head: ['water', 'fire'],
    ghost_body: ['water', 'fire'],
    ghost_legs: ['water', 'nature'],
};

/** The two elements of a part. Accessories have none (F-16: cosmetics never change the clash). */
export function partElements(partId: string): [ElementId, ElementId] | null {
    const part = PARTS.find((p) => p.id === partId) as unknown as { elements?: [ElementId, ElementId] } | undefined;
    if (!part) return null;
    return part.elements ?? PART_ELEMENTS[partId] ?? null;
}

/** Sum over each attacker/defender pair: +1 beats, -1 beaten, 0 neutral. */
export function clashScore(atk: readonly ElementId[], def: readonly ElementId[]): number {
    let score = 0;
    for (const a of atk) for (const d of def) score += beats(a, d) ? 1 : beats(d, a) ? -1 : 0;
    return score;
}

export function beats(a: ElementId, d: ElementId): boolean {
    const step = (ELEMENT_ORDER.indexOf(d) - ELEMENT_ORDER.indexOf(a) + 6) % 6;
    return step === 1 || step === 2;
}
