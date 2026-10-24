/** Accessory slot metadata (tokens 201–203). Cosmetics only: no stats, no elements (F-16). */
import type { IconName } from './Icon.tsx';

export const ACC_IDS = [201, 202, 203] as const;

const LABELS: Record<number, string> = {
    201: 'Monad Crown',
    202: 'Goo Trail',
    203: 'War Orb',
};

/** Placeholder glyphs until the accessory 3D thumbnails exist (shared with the render kit). */
const ICONS: Record<number, IconName> = {
    201: 'trophy',
    202: 'mix',
    203: 'eye',
};

export function accessoryName(id: number): string {
    return LABELS[id] ?? `Accessory ${id}`;
}

export function accessoryIcon(id: number): IconName {
    return ICONS[id] ?? 'gift';
}
