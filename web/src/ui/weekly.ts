/**
 * Weekly community tasks (F-10): two goals per week, three tiers each.
 * Pure so the claim rules, the countdown and the theme name stay pinned.
 */
import type { FamilyId } from '../game/data/types.ts';

export const TIERS = { theme: [5, 10, 20], hatch: [10, 25, 50] } as const;
export type TierState = 'locked' | 'claimable' | 'claimed' | 'needContribution';

/** Per-tier claim state for one weekly task (claimedMask bit i = tier i claimed). */
export function tierState(progress: number, contribution: number, claimedMask: number, tiers: readonly number[]): TierState[] {
    return tiers.map((goal, i) => {
        if (claimedMask & (1 << i)) return 'claimed';
        if (progress < goal) return 'locked';
        return contribution > 0 ? 'claimable' : 'needContribution';
    });
}

/** Task index on chain: 0 = theme wins, 1 = eggs opened. */
export const TASK = { theme: 0, hatch: 1 } as const;
export type TaskName = keyof typeof TASK;
export const TASK_LABEL: Record<TaskName, string> = { theme: 'THEME', hatch: 'HATCH' };
export const TIER_LABEL = ['Bronze', 'Silver', 'Gold'] as const;

/** PRD F-10: bronze 1 egg, silver 1 egg, gold 1 rare egg + the community accessory (token 202). */
export const TIER_REWARD: Record<TaskName, readonly [string, string, string]> = {
    theme: ['1 egg', '1 egg', '1 rare egg + accessory'],
    hatch: ['1 egg', '1 egg', '1 rare egg + accessory'],
};

/** Contract family index → family id (weekly theme; default rotation in this order). */
const FAMILY_ORDER: readonly FamilyId[] = ['fang', 'goo', 'eye', 'claw', 'bone', 'shroom', 'ghost'];

export function themeFamily(index: number): FamilyId | null {
    return FAMILY_ORDER[index] ?? null;
}

/** "2d 04:12", "04:12", or null once the week has ended. */
export function formatCountdown(seconds: number): string | null {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const total = Math.floor(seconds);
    const days = Math.floor(total / 86_400);
    const hours = Math.floor((total % 86_400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const mm = String(minutes).padStart(2, '0');
    if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}:${mm}`;
    return `${String(hours).padStart(2, '0')}:${mm}`;
}
