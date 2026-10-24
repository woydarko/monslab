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
