/** Auto monster names (GDD §3.5): head syllable + legs syllable + " the " + body title. */
import { getPart } from './data/parts.ts';
import type { MonsterParts } from './data/types.ts';

export function autoName(parts: MonsterParts): string {
    const [head, body, legs] = parts.map(getPart);
    return `${head.nameSyllable}${legs.nameSyllable} the ${body.title}`;
}

export const NAME_MAX = 16;

const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'kontol', 'memek', 'anjing', 'bangsat'];

/** Clean a player-entered name; returns null when unusable. */
export function sanitizeName(raw: string): string | null {
    const s = raw.replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
    if (!s) return null;
    const lower = s.toLowerCase();
    if (BLOCKED.some((w) => lower.includes(w))) return null;
    return s;
}
