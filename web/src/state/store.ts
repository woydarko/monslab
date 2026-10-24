/**
 * Tiny external store bridging game code and React, no state library.
 * Game code calls store.patch(); React subscribes with useStore(selector).
 *
 * UI-facing state only. Chain state arrives as `me` (MeView from /api/me) and is
 * mirrored into the local save view-model by actions.ts; bump `rev` on change.
 */
import { useSyncExternalStore } from 'react';
import type { MonsterParts, Rarity } from '../game/data/types.ts';
import type { BattleView, MeView } from '../../server/types.ts';
import type { DeepLink } from '../ui/deepLink.ts';

export type Phase =
    | 'loading' | 'title' | 'register' | 'lab' | 'egg' | 'levels' | 'pvp' | 'battle' | 'result'
    | 'replay' | 'community' | 'war' | 'redeem' | 'profile' | 'collection';

export type BattleMode = 'ftue' | 'arena' | 'challenge' | 'boss' | 'war' | 'replay';

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

export interface TxUi { label: string; status: 'pending' | 'confirmed' | 'failed'; hash?: string }

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
    traySlot: 'head' | 'body' | 'legs' | 'acc' | 'skin';
    /** Part the "NEW" badge highlights. */
    highlightPart: string | null;
    challengeTab: 'gallery' | 'send' | 'enter';
    howTo: boolean;
    pendingCode: string | null;
    toast: string | null;
    me: MeView | null;
    session: 'signedOut' | 'signedIn';
    tx: TxUi | null;
    deepLink: DeepLink;
    battleView: BattleView | null;
    replayId: string | null;
    warId: number | null;
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
    me: null,
    session: 'signedOut',
    tx: null,
    deepLink: {},
    battleView: null,
    replayId: null,
    warId: null,
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
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __store: typeof store }).__store = store;
