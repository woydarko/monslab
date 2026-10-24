import { describe, expect, it, vi } from 'vitest';
import { createActionRunner } from './useAction.ts';

describe('createActionRunner', () => {
    it('runs one action per key at a time', async () => {
        const runner = createActionRunner();
        let release!: (v: number) => void;
        const slow = vi.fn(() => new Promise<number>((r) => { release = r; }));
        const first = runner.run('fight', slow);
        const second = runner.run('fight', slow);
        expect(slow).toHaveBeenCalledTimes(1);
        expect(runner.isPending('fight')).toBe(true);
        await expect(second).resolves.toBeUndefined();
        release(7);
        await expect(first).resolves.toBe(7);
        expect(runner.isPending('fight')).toBe(false);
    });

    it('clears pending after a rejection', async () => {
        const runner = createActionRunner();
        await expect(runner.run('egg', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
        expect(runner.isPending('egg')).toBe(false);
    });

    it('does not block other keys', async () => {
        const runner = createActionRunner();
        void runner.run('a', () => new Promise(() => {}));
        await expect(runner.run('b', async () => 1)).resolves.toBe(1);
    });
});
