/**
 * Game → UI events that fire on discrete moments (hits, floating numbers).
 * React components subscribe directly so a hit doesn't re-render every screen
 * through the store.
 */
export type FloatKind = 'damage' | 'crit' | 'miss' | 'heal' | 'info' | 'poison' | 'special';

export interface GameEventMap {
    float: { x: number; y: number; text: string; kind: FloatKind };
    hp: { side: 0 | 1; hp: number };
    battleDone: { winner: 0 | 1 };
    shake: { strength: number };
    /** The 3D scene was swapped (UI fades from black to hide the cut). */
    sceneChange: Record<string, never>;
}

type Handler<K extends keyof GameEventMap> = (e: GameEventMap[K]) => void;

// Stored loosely; the typed on()/emit() signatures keep call sites safe.
const handlers = new Map<keyof GameEventMap, Set<(e: unknown) => void>>();

export const gameEvents = {
    on<K extends keyof GameEventMap>(type: K, fn: Handler<K>): () => void {
        let set = handlers.get(type);
        if (!set) handlers.set(type, (set = new Set()));
        const h = fn as (e: unknown) => void;
        set.add(h);
        return () => set.delete(h);
    },
    emit<K extends keyof GameEventMap>(type: K, e: GameEventMap[K]): void {
        const set = handlers.get(type);
        if (set) for (const fn of [...set]) fn(e);
    },
};
