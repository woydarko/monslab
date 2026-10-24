import { describe, expect, it } from 'vitest';
import type { Hex, WarView } from '../chain/types.ts';
import { myWarRole, targetStatus } from './warView.ts';

const Z = '0x0000000000000000000000000000000000000000' as Hex;
const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Hex;
const five = <T>(f: (i: number) => T) => [0, 1, 2, 3, 4].map(f);

function war(over: Partial<WarView> = {}): WarView {
    return {
        a: 1, b: 2, status: 1, expiresAt: 0n, endsAt: 2000n,
        team: [five((i) => addr(i + 1)), five((i) => (i < 4 ? addr(i + 11) : Z))],
        loadouts: [five(() => 0n), five(() => 0n)],
        lockedBy: [five(() => Z), five(() => Z)],
        lockedUntil: [five(() => 0n), five(() => 0n)],
        done: [five(() => false), five(() => false)],
        stars: [five(() => 0), five(() => 0)],
        attacked: [five(() => false), five(() => false)],
        teamSize: [5, 4], starsA: 0, starsB: 0, winner: 0,
        ...over,
    };
}

describe('targetStatus', () => {
    const now = 1000;
    it('locked while lockedUntil is in the future', () => {
        const w = war({ lockedBy: [five(() => Z), five((i) => (i === 0 ? addr(3) : Z))], lockedUntil: [five(() => 0n), five((i) => (i === 0 ? 1030n : 0n))] });
        expect(targetStatus(w, 1, 0, now)).toEqual({ kind: 'locked', lockedBy: addr(3), secondsLeft: 30 });
    });

    it('available once the lock expired', () => {
        const w = war({ lockedBy: [five(() => Z), five(() => addr(3))], lockedUntil: [five(() => 0n), five(() => 999n)] });
        expect(targetStatus(w, 1, 0, now)).toEqual({ kind: 'available' });
    });

    it('done shows stars', () => {
        const w = war({ done: [five(() => false), five((i) => i === 2)], stars: [five(() => 0), five((i) => (i === 2 ? 2 : 0))] });
        expect(targetStatus(w, 1, 2, now)).toEqual({ kind: 'done', stars: 2 });
    });

    it('empty slot beyond team size', () => {
        expect(targetStatus(war(), 1, 4, now)).toEqual({ kind: 'empty' });
    });
});

describe('myWarRole', () => {
    it('finds my side and slot', () => {
        expect(myWarRole(war(), addr(12))).toEqual({ side: 1, idx: 1, attacked: false });
    });

    it('is case-insensitive on addresses', () => {
        const mixed = ('0x' + 'AB'.repeat(20)) as Hex;
        const w = war({ team: [five((i) => (i === 3 ? (('0x' + 'ab'.repeat(20)) as Hex) : addr(i + 1))), five(() => Z)] });
        expect(myWarRole(w, mixed)).toEqual({ side: 0, idx: 3, attacked: false });
    });

    it('non-member is a spectator', () => {
        expect(myWarRole(war(), addr(99))).toEqual({ side: null, idx: null, attacked: false });
    });
});
