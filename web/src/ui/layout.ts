/**
 * Layout mode (DESIGN.md › Layout). Desktop web is the primary target:
 *   'wide': landscape window ≥ 900 px wide: side panels, monsters face off left/right.
 *   'tall': portrait or narrow window: the original phone layout.
 * Read it from React with useLayout(), from game code with getLayout().
 */
import { useSyncExternalStore } from 'react';

export type Layout = 'wide' | 'tall';

const WIDE_MIN_WIDTH = 900;
const WIDE_MIN_ASPECT = 1.15;

function compute(): Layout {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return w >= WIDE_MIN_WIDTH && w / h >= WIDE_MIN_ASPECT ? 'wide' : 'tall';
}

let current: Layout = typeof window === 'undefined' ? 'wide' : compute();
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
        const next = compute();
        if (next === current) return;
        current = next;
        for (const l of listeners) l();
    });
}

export function getLayout(): Layout {
    return current;
}

export function onLayoutChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function useLayout(): Layout {
    return useSyncExternalStore(onLayoutChange, getLayout);
}
