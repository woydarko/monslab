export type Slot = 'head' | 'body' | 'legs' | 'acc';
export interface Loadout { head: number; body: number; legs: number; acc: number }

const STARTER: Loadout = { head: 101, body: 102, legs: 103, acc: 0 };
const SLOTS: Slot[] = ['head', 'body', 'legs', 'acc'];

/** Loadout the chain will actually fight with: parts no longer owned fall back to the starter (acc to none). */
export function effectiveLoadout(loadout: Loadout, balances: Record<number, number>): Loadout & { fallback: Slot[] } {
    const out = { ...loadout, fallback: [] as Slot[] };
    for (const s of SLOTS) {
        const id = loadout[s];
        if (id === 0 || id === STARTER[s] || (balances[id] ?? 0) > 0) continue;
        out[s] = STARTER[s];
        out.fallback.push(s);
    }
    return out;
}
