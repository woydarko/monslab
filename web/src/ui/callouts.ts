/**
 * The current battle callout. A tiny store of its own so a callout does not
 * re-render every screen through the app store (same idea as game/events.ts).
 */
import { useSyncExternalStore } from 'react';
import type { Callout } from './battleCallout.ts';

const HOLD_MS = 900;

let current: Callout | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
    for (const l of listeners) l();
}

export function emitCallout(callout: Callout | null): void {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    current = callout;
    notify();
    if (callout) {
        timer = setTimeout(() => {
            current = null;
            timer = null;
            notify();
        }, HOLD_MS);
    }
}

export function clearCallout(): void {
    emitCallout(null);
}

export function currentCallout(): Callout | null {
    return current;
}

function subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
}

export function useCallout(): Callout | null {
    return useSyncExternalStore(subscribe, currentCallout, currentCallout);
}
