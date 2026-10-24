import { useCallback, useState } from 'react';
import { store } from '../state/store.ts';
import { errorCopy } from './copy.ts';

/** Per-key single-flight: a second run with the same key while the first is pending is dropped (double-click guard). */
export function createActionRunner() {
    const pending = new Set<string>();
    return {
        async run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
            if (pending.has(key)) return undefined;
            pending.add(key);
            try {
                return await fn();
            } finally {
                pending.delete(key);
            }
        },
        isPending: (key: string): boolean => pending.has(key),
    };
}

const runner = createActionRunner();

type CodedError = { code?: string; details?: Record<string, unknown> };

/** Error copy for anything thrown by chain/api.ts (ApiError carries `code`). */
export function errorText(e: unknown): string {
    const err = e as CodedError;
    return errorCopy(err?.code ?? 'unknown', err?.details);
}

/**
 * Button-facing action: single-flight per key, TxChip state in the store, error copy.
 * `fn` may return `{ txHash }` so the chip can link the explorer.
 */
export function useAction(key: string, label = key) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const run = useCallback(
        async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
            if (runner.isPending(key)) return undefined;
            setError(null);
            setPending(true);
            store.patch({ tx: { label, status: 'pending' } });
            try {
                const out = await runner.run(key, fn);
                const hash = (out as { txHash?: string } | undefined)?.txHash;
                store.patch({ tx: { label, status: 'confirmed', hash } });
                return out;
            } catch (e) {
                setError(errorText(e));
                store.patch({ tx: { label, status: 'failed' } });
                return undefined;
            } finally {
                setPending(false);
            }
        },
        [key, label],
    );
    return { run, pending, error };
}
