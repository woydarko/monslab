/** Six elements (F-16). Cycle order: each beats the next two, loses to the previous two. */
export type ElementId = 'water' | 'stone' | 'fire' | 'wind' | 'nature' | 'volt';

export const ELEMENT_ORDER: readonly ElementId[] = ['water', 'stone', 'fire', 'wind', 'nature', 'volt'];

export const ELEMENT_NAMES: Record<ElementId, string> = {
    water: 'Water', stone: 'Stone', fire: 'Fire', wind: 'Wind', nature: 'Nature', volt: 'Volt',
};

/** Three steps apart on the cycle: neutral to each other, never on the same part. */
export const OPPOSITE: Record<ElementId, ElementId> = {
    water: 'wind', wind: 'water', stone: 'nature', nature: 'stone', fire: 'volt', volt: 'fire',
};
