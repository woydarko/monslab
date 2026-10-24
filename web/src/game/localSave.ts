/**
 * Offline save: a typed blob in localStorage so the game boots and plays
 * without a chain or server. Chain state replaces it screen by screen.
 */
import { hasPart, STARTER_BONUS_PART, STARTER_PARTS } from './data/parts.ts';
import type { MonsterParts } from './data/types.ts';
import { autoName } from './names.ts';

const PREFIX = 'monslab.';

export function loadLocal<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
        return fallback;
    }
}

export function saveLocal<T>(key: string, value: T): void {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
        /* storage blocked or full: the in-memory save keeps working */
    }
}

export interface SavedMonster {
    parts: MonsterParts;
    name: string;
    /** true once the player renamed it (stop auto-renaming on part swaps). */
    customName: boolean;
    skin: number;
}

export interface MonsSave {
    version: number;
    ownedParts: Record<string, number>;
    monsters: SavedMonster[];
    active: number;
    labSlots: number;
    goo: number;
    /** epicPending: stored eggs that will hatch epic (Arena tier 10 reward). */
    capsules: { stored: number; winsToday: number; dayKey: string; pity: number; opened: number; epicPending: number };
    arena: { highestTier: number; wins: number };
    ftue: { step: number; done: boolean };
    stats: { battles: number; wins: number; challengesSent: number; challengesWon: number; mixes: number };
    settings: { sfx: number; music: number; haptics: boolean };
    ownedSkins: number[];
    /** Families whose Collection Book egg has been claimed. */
    collectionClaimed: string[];
}

export function defaultSave(): MonsSave {
    return {
        version: 1,
        ownedParts: { [STARTER_PARTS[0]]: 1, [STARTER_PARTS[1]]: 1, [STARTER_PARTS[2]]: 1, [STARTER_BONUS_PART]: 1 },
        monsters: [{ parts: [...STARTER_PARTS], name: autoName(STARTER_PARTS), customName: false, skin: 0 }],
        active: 0,
        labSlots: 3,
        goo: 0,
        capsules: { stored: 0, winsToday: 0, dayKey: '', pity: 0, opened: 0, epicPending: 0 },
        arena: { highestTier: 0, wins: 0 },
        ftue: { step: 0, done: false },
        stats: { battles: 0, wins: 0, challengesSent: 0, challengesWon: 0, mixes: 0 },
        settings: { sfx: 1, music: 0.6, haptics: true },
        ownedSkins: [0],
        collectionClaimed: [],
    };
}

/** Drop anything a hand-edited or older blob got wrong; keep the rest. */
function sanitize(raw: unknown): MonsSave {
    const def = defaultSave();
    if (!raw || typeof raw !== 'object') return def;
    const s = { ...def, ...(raw as Partial<MonsSave>) };
    for (const k of ['capsules', 'arena', 'ftue', 'stats', 'settings'] as const) {
        s[k] = { ...def[k], ...(typeof s[k] === 'object' && s[k] ? s[k] : {}) } as never;
    }
    if (typeof s.ownedParts !== 'object' || !s.ownedParts) s.ownedParts = def.ownedParts;
    for (const id of Object.keys(s.ownedParts)) if (!hasPart(id)) delete s.ownedParts[id];
    s.monsters = Array.isArray(s.monsters)
        ? s.monsters.filter((m) => Array.isArray(m?.parts) && m.parts.length === 3 && m.parts.every((p) => hasPart(p)))
        : [];
    if (s.monsters.length === 0) s.monsters = def.monsters;
    if (!(s.active >= 0 && s.active < s.monsters.length)) s.active = 0;
    if (!(s.goo >= 0)) s.goo = 0;
    if (!(s.labSlots >= 3)) s.labSlots = 3;
    if (!Array.isArray(s.collectionClaimed)) s.collectionClaimed = [];
    if (!Array.isArray(s.ownedSkins) || !s.ownedSkins.includes(0)) s.ownedSkins = [0];
    return s;
}

const SAVE_KEY = 'save';

/** Same surface the screens used before: `data` is the live object; mutate it, then `save()`. */
export const saveSystem = {
    data: null as MonsSave | null,
    async load(): Promise<MonsSave> {
        this.data = sanitize(loadLocal<unknown>(SAVE_KEY, null));
        return this.data;
    },
    save(): void {
        if (this.data) saveLocal(SAVE_KEY, this.data);
    },
    async flush(): Promise<void> {
        this.save();
    },
};
