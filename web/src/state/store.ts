/**
 * Tiny external store bridging game code and React, no state library.
 * Game code calls store.patch(); React subscribes with useStore(selector).
 *
 * UI-facing state only. Persistent progress lives in saveSystem.data; bump
 * `rev` (via actions.ts) whenever the save changes so screens re-render.
 */
import { useSyncExternalStore } from 'react';
import type { MonsterParts, Rarity } from '../game/data/types.ts';

export type Phase = 'loading' | 'title' | 'lab' | 'arena' | 'challenge' | 'battle' | 'result' | 'capsule' | 'collection' | 'daily';

export type BattleMode = 'ftue' | 'arena' | 'challenge' | 'boss';

export interface BattleUi {
    mode: BattleMode;
    tier: number;
    names: [string, string];
    parts: [MonsterParts, MonsterParts];
    maxHp: [number, number];
    winner: 0 | 1;
    challengeCode?: string;
}

export interface ResultUi {
    won: boolean;
    mode: BattleMode;
    capsule: boolean;
    goo: number;
    trophyPart: string | null;
    newTier: number | null;
    tip: string | null;
    /** Daily boss runs: the score and what is left today. */
    boss?: { score: number; best: number; newBest: boolean; triesLeft: number; name: string };
}

export interface CapsuleUi {
    rarity: Rarity;
    partId: string;
    isNew: boolean;
    goo: number;
    stage: 'egg' | 'open';
    cracks: number;
}

export interface AppState {
    phase: Phase;
    loadProgress: number;
    paused: boolean;
    /** Save revision: bump to re-render save-derived UI. */
    rev: number;
    battle: BattleUi | null;
    result: ResultUi | null;
    capsule: CapsuleUi | null;
    /** Which lab slot's tray is open. */
    traySlot: 'head' | 'body' | 'legs' | 'skin';
    /** Part the FTUE pointer / "NEW" badge highlights. */
    highlightPart: string | null;
    challengeTab: 'gallery' | 'send' | 'enter';
    /** How to Play cards open (title screen or lab). */
    howTo: boolean;
    pendingCode: string | null;
    toast: string | null;
}

const listeners = new Set<() => void>();

let state: AppState = {
    phase: 'loading',
    loadProgress: 0,
    paused: false,
    rev: 0,
    battle: null,
    result: null,
    capsule: null,
    traySlot: 'head',
    highlightPart: null,
    challengeTab: 'send',
    howTo: false,
    pendingCode: null,
    toast: null,
};

export const store = {
    get: (): AppState => state,
    patch(partial: Partial<AppState>): void {
        state = { ...state, ...partial };
        for (const l of listeners) l();
    },
    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

/**
 * React hook. The selector must return a primitive or a stable reference
 * (e.g. s => s.phase): a fresh object each call re-renders forever.
 */
export function useStore<T = AppState>(selector: (s: AppState) => T = (s) => s as unknown as T): T {
    return useSyncExternalStore(store.subscribe, () => selector(state));
}

// Dev-only handle for debugging/screenshots in the browser console.
if (import.meta.env.DEV) (window as unknown as { __store: typeof store }).__store = store;
