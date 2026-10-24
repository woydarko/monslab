import type { Hex, WarView } from '../chain/types.ts';

export type TargetStatus =
    | { kind: 'available' }
    | { kind: 'locked'; lockedBy: Hex; secondsLeft: number }
    | { kind: 'done'; stars: number }
    | { kind: 'empty' };

/** Card state for target [side][idx]; a lock only counts while lockedUntil > now (seconds). */
export function targetStatus(war: WarView, side: 0 | 1, idx: number, now: number): TargetStatus {
    if (idx >= (war.teamSize[side] ?? 0)) return { kind: 'empty' };
    if (war.done[side][idx]) return { kind: 'done', stars: war.stars[side][idx] };
    const until = Number(war.lockedUntil[side][idx]);
    if (until > now) return { kind: 'locked', lockedBy: war.lockedBy[side][idx], secondsLeft: until - now };
    return { kind: 'available' };
}

export function myWarRole(war: WarView, me: Hex): { side: 0 | 1 | null; idx: number | null; attacked: boolean } {
    const lower = me.toLowerCase();
    for (const side of [0, 1] as const) {
        const idx = war.team[side].findIndex((a, i) => i < (war.teamSize[side] ?? 0) && a.toLowerCase() === lower);
        if (idx >= 0) return { side, idx, attacked: war.attacked[side][idx] };
    }
    return { side: null, idx: null, attacked: false };
}
