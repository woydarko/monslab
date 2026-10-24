import { describe, expect, it, vi, afterEach } from 'vitest';
import { loadLocal, saveLocal } from './localSave.ts';

describe('localSave', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('falls back when storage throws', () => {
        const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
        vi.stubGlobal('localStorage', broken);
        expect(loadLocal('sound', 'on')).toBe('on');
        expect(() => saveLocal('sound', 'off')).not.toThrow();
    });

    it('round-trips with monslab. prefix', () => {
        const mem = new Map<string, string>();
        vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) });
        saveLocal('skin', 3);
        expect(mem.has('monslab.skin')).toBe(true);
        expect(loadLocal('skin', 0)).toBe(3);
    });
});
